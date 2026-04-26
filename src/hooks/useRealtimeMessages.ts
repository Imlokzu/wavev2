import { useEffect, useRef } from "react";
import { supabase } from "@/utils/supabase";
import { useChatStore, makeConversation } from "@/store/chat-store";
import { useAuthStore } from "@/store/auth-store";
import type { ChatMessage } from "@/store/chat-store";

const isSupabaseConfigured =
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== "https://placeholder.supabase.co";

async function markSingleMessageRead(messageId: string, userId: string, conversationId: string) {
  const { data } = await supabase.from("messages").select("read_by").eq("id", messageId).maybeSingle();
  const current: string[] = data?.read_by ?? [];
  if (current.includes(userId)) return;
  await supabase.from("messages").update({ read_by: [...current, userId] }).eq("id", messageId);
  useChatStore.getState().markMessageRead(conversationId, messageId, userId);
}

/**
 * Load all conversations for the current user from Supabase.
 */
export async function loadConversations(userId: string) {
  if (!isSupabaseConfigured) return;

  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  if (!memberships?.length) return;

  const convIds = memberships.map((m: any) => m.conversation_id);

  const { data: convRows } = await supabase
    .from("conversations")
    .select("id, name, is_group, created_at")
    .in("id", convIds)
    .order("created_at", { ascending: false });

  if (!convRows) return;

  const convs = await Promise.all(
    convRows.map(async (conv: any) => {
      // For DMs, find the other member's profile
      if (!conv.is_group) {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", conv.id)
          .neq("user_id", userId);

        const otherId = members?.[0]?.user_id;
        if (otherId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("id", otherId)
            .maybeSingle();

          const name = profile?.name ?? "Unknown";
          const c = makeConversation(conv.id, name, profile?.avatar_url, otherId, 2);

          // Get last message
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("content, created_at, type")
            .eq("conversation_id", conv.id)
            .eq("deleted", false)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastMsg) {
            c.lastMessage = lastMsg.type === "text" ? lastMsg.content : `[${lastMsg.type}]`;
            c.time = new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          }
          return c;
        }
      }
      return makeConversation(conv.id, conv.name ?? "Group", null);
    })
  );

  useChatStore.getState().setConversations(convs);
}

/**
 * Hook that subscribes to Supabase realtime for the active chat.
 * Falls back gracefully when Supabase isn't configured (demo mode).
 */
export function useRealtimeMessages(conversationId: string) {
  const addSupabaseMessage = useChatStore((s) => s.addSupabaseMessage);
  const setMessagesForChat = useChatStore((s) => s.setMessagesForChat);
  const markChatLoaded = useChatStore((s) => s.markChatLoaded);
  const loadedChats = useChatStore((s) => s.loadedChats);
  const user = useAuthStore((s) => s.user);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load history once per chat + mark as read
  useEffect(() => {
    if (!isSupabaseConfigured || !conversationId || !user) return;

    if (loadedChats.has(conversationId)) {
      // Already loaded — re-mark as read in case new messages arrived
      markConversationRead(conversationId, user.id);
      return;
    }

    loadMessages(conversationId, user.id).then((msgs) => {
      setMessagesForChat(conversationId, msgs);
      markChatLoaded(conversationId);
      markConversationRead(conversationId, user.id);
      refreshReadReceipts(conversationId, user.id);
    });
  }, [conversationId, user?.id]);

  // Refresh read receipts when tab becomes visible + poll every 10s while active
  useEffect(() => {
    if (!isSupabaseConfigured || !conversationId || !user) return;

    const onVisible = () => {
      if (!document.hidden) {
        refreshReadReceipts(conversationId, user.id);
        markConversationRead(conversationId, user.id);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // Poll every 8 seconds to catch any missed realtime events
    const interval = setInterval(() => {
      if (!document.hidden) refreshReadReceipts(conversationId, user.id);
    }, 8000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !conversationId || !user) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            content: string;
            type: ChatMessage["type"];
            file_url: string | null;
            file_name: string | null;
            file_size: number | null;
            file_mime: string | null;
            reply_to: string | null;
            created_at: string;
            actions: any[] | null;
          };

          // Fetch sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("id", row.sender_id)
            .maybeSingle();

          const msg: ChatMessage = {
            id: row.id,
            sender: profile?.name ?? "Unknown",
            content: row.content,
            time: new Date(row.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            own: row.sender_id === user.id,
            type: row.type ?? "text",
            actions: row.actions ?? undefined,
            fileData:
              row.type === "file" && row.file_url
                ? {
                    name: row.file_name ?? "file",
                    size: row.file_size ?? 0,
                    mimeType: row.file_mime ?? "application/octet-stream",
                    url: row.file_url,
                  }
                : undefined,
            replyTo: row.reply_to ?? undefined,
          };

          // Don't add messages sent by this user (already optimistically added)
          if (row.sender_id !== user.id) {
            addSupabaseMessage(conversationId, msg);
            // Mark as read immediately if this chat is currently open
            if (useChatStore.getState().activeChat === conversationId) {
              markSingleMessageRead(row.id, user.id, conversationId);
              // Also trigger a full conversation read to catch any others
              markConversationRead(conversationId, user.id);
            }
            // Push notification if tab not focused
            if (document.hidden && Notification.permission === "granted") {
              const title = profile?.name ?? "New message";
              const body = row.type === "text" ? row.content : `Sent a ${row.type}`;
              if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification(title, { body, icon: "/favicon.ico", tag: row.id, renotify: true });
                });
              } else {
                new Notification(title, { body, icon: "/favicon.ico" });
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; content: string; deleted: boolean; edited_at: string | null; read_by: string[] | null };
          if (row.deleted) {
            useChatStore.getState().deleteMessage(conversationId, row.id);
          } else if (row.edited_at) {
            useChatStore.getState().editMessage(conversationId, row.id, row.content);
          }
          // Always sync read_by regardless of other changes
          if (row.read_by?.length) {
            row.read_by.forEach((uid) => {
              useChatStore.getState().markMessageRead(conversationId, row.id, uid);
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);
}

/**
 * Load existing messages for a conversation from Supabase.
 */
export async function loadMessages(conversationId: string, userId: string) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*, profiles!sender_id(name, avatar_url)")
    .eq("conversation_id", conversationId)
    .eq("deleted", false)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error || !data) return [];

  return data.map((row) => {
    const profile = row.profiles as { name: string; avatar_url: string | null } | null;
    const msg: ChatMessage = {
      id: row.id,
      sender: profile?.name ?? "Unknown",
      content: row.content,
      time: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      own: row.sender_id === userId,
      type: row.type as ChatMessage["type"],
      readBy: row.read_by ?? [],
      editedAt: row.edited_at ?? null,
      actions: row.actions ?? undefined,
      fileData:
        row.type === "file" && row.file_url
          ? { name: row.file_name ?? "file", size: row.file_size ?? 0, mimeType: row.file_mime ?? "application/octet-stream", url: row.file_url }
          : undefined,
      replyTo: row.reply_to ?? undefined,
    };
    return msg;
  });
}

/**
 * Refresh read receipts for all messages in a conversation (called on focus).
 */
export async function refreshReadReceipts(conversationId: string, userId: string) {
  if (!isSupabaseConfigured) return;

  const { data } = await supabase
    .from("messages")
    .select("id, read_by")
    .eq("conversation_id", conversationId)
    .eq("deleted", false);

  (data ?? []).forEach((row: any) => {
    const readBy: string[] = row.read_by ?? [];
    readBy.forEach((uid: string) => {
      useChatStore.getState().markMessageRead(conversationId, row.id, uid);
    });
  });
}

/**
 * Mark all messages in a conversation as read by the current user.
 */
export async function markConversationRead(conversationId: string, userId: string) {
  if (!isSupabaseConfigured) return;

  // Use the DB function for atomic, fast bulk update
  const { error } = await supabase.rpc("mark_messages_read", {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });

  if (error) {
    console.error("[Wave] markConversationRead error:", error.message);
    return;
  }

  // Refresh local store to reflect the new read state
  refreshReadReceipts(conversationId, userId);
}

/**
 * Send a message to Supabase. Returns the message ID.
 */
export async function sendSupabaseMessage(
  conversationId: string,
  senderId: string,
  msg: {
    content: string;
    type: ChatMessage["type"];
    replyTo?: string;
    fileData?: ChatMessage["fileData"];
    tempId?: string; // local optimistic ID to replace
  }
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: msg.content,
      type: msg.type,
      reply_to: msg.replyTo ?? null,
      file_url: msg.fileData?.url ?? null,
      file_name: msg.fileData?.name ?? null,
      file_size: msg.fileData?.size ?? null,
      file_mime: msg.fileData?.mimeType ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[Wave] Failed to send message:", error.message);
    return null;
  }

  const realId = data?.id ?? null;

  // Replace temp ID with real DB ID so read receipts can match
  if (realId && msg.tempId) {
    useChatStore.getState().replaceMessageId(conversationId, msg.tempId, realId);
  }

  // Update sidebar last message preview
  const preview = msg.type === "text" ? msg.content : `[${msg.type}]`;
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const existing = useChatStore.getState().conversations.find(c => c.id === conversationId);
  if (existing) useChatStore.getState().upsertConversation({ ...existing, lastMessage: preview, time });

  return realId;
}

/**
 * Soft-delete a message in Supabase.
 */
export async function deleteSupabaseMessage(messageId: string) {
  if (!isSupabaseConfigured) return;
  await supabase.from("messages").update({ deleted: true }).eq("id", messageId);
}

/**
 * Edit a message in Supabase.
 */
export async function editSupabaseMessage(messageId: string, newContent: string) {
  if (!isSupabaseConfigured) return;
  await supabase
    .from("messages")
    .update({ content: newContent, edited_at: new Date().toISOString() })
    .eq("id", messageId);
}
