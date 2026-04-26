import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import { useSearch } from "@/hooks/useSearch";
import { supabase } from "@/utils/supabase";
import { useAuthStore } from "@/store/auth-store";
import { makeConversation } from "@/store/chat-store";
import { loadConversations } from "@/hooks/useRealtimeMessages";
import { usePresenceStore } from "@/hooks/usePresence";

/* ── New Chat Modal ─────────────────────────────────── */

function NewChatModal({ onClose, onStartChat, starting, startError }: { onClose: () => void; onStartChat: (userId: string, name: string, username: string, avatarUrl: string | null) => void; starting: boolean; startError: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (!q) { setResults([]); setError(""); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .ilike("username", `%${q}%`)
        .neq("id", currentUser?.id ?? "")
        .limit(10);

      setLoading(false);
      if (err) { setError("Search failed. Try again."); return; }
      setResults(data ?? []);
      if ((data ?? []).length === 0) setError("No users found.");
    }, 300);

    return () => clearTimeout(timer);
  }, [query, currentUser?.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-[#17212b] shadow-2xl ring-1 ring-white/5 animate-pop-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2f3f]">
          <span className="text-sm font-semibold text-white">New Chat</span>
          <button onClick={onClose} className="text-[#6b8299] hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl bg-[#1c2733] px-3 py-2.5">
            <span className="text-[#4a6580] text-sm font-medium">@</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username"
              className="flex-1 bg-transparent text-sm text-white placeholder-[#4a6580] outline-none"
            />
            {loading && (
              <svg className="animate-spin shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#6b8299" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto pb-2">
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => onStartChat(user.id, user.name, user.username, user.avatar_url)}
              disabled={starting}
              className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-[#202b36] transition text-left disabled:opacity-60"
            >
              <div className="h-10 w-10 shrink-0 rounded-full bg-[#2b5278] flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  : user.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-[#6b8299] truncate">@{user.username}</p>
              </div>
              {starting && (
                <svg className="animate-spin shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#7eb88a" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" />
                </svg>
              )}
            </button>
          ))}
          {!loading && error && (
            <p className="px-4 py-3 text-xs text-[#6b8299] text-center">{error}</p>
          )}
          {!query && (
            <p className="px-4 py-3 text-xs text-[#4a6580] text-center">Type a username to search</p>
          )}
          {startError && (
            <p className="px-4 py-3 text-xs text-red-400 text-center">{startError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar ────────────────────────────────────────── */

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [startChatError, setStartChatError] = useState("");
  const activeChat = useChatStore((s) => s.activeChat);
  const storeConversations = useChatStore((s) => s.conversations);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const toggleSettings = useChatStore((s) => s.toggleSettings);
  const filteredConversations = useSearch(storeConversations, searchQuery);
  const currentUser = useAuthStore((s) => s.user);
  const onlineIds = usePresenceStore((s) => s.onlineIds);

  useEffect(() => {
    if (!currentUser) return;
    loadConversations(currentUser.id);
    // Reload after 3s to pick up bot conversation created on login
    const t = setTimeout(() => loadConversations(currentUser.id), 3000);
    return () => clearTimeout(t);
  }, [currentUser?.id]);

  const handleChatSelect = (id: string) => {
    setActiveChat(id);
    onClose?.();
  };

  const handleSettings = () => {
    toggleSettings();
    onClose?.();
  };

  const handleStartChat = async (userId: string, name: string, _username: string, avatarUrl: string | null) => {
    if (!currentUser || startingChat) return;
    setStartingChat(true);
    setStartChatError("");

    try {
      // Find existing DM between these two users
      const { data: myMemberships, error: memErr } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUser.id);

      if (memErr) { setStartChatError(memErr.message); return; }

      const myConvIds = (myMemberships ?? []).map((r: any) => r.conversation_id);
      let conversationId: string | null = null;

      if (myConvIds.length > 0) {
        const { data: shared } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", userId)
          .in("conversation_id", myConvIds);

        if (shared && shared.length > 0) {
          conversationId = shared[0].conversation_id;
        }
      }

      if (!conversationId) {
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .insert({ is_group: false, created_by: currentUser.id })
          .select("id")
          .maybeSingle();

        if (convErr) { setStartChatError(convErr.message); return; }
        if (!conv) { setStartChatError("Failed to create conversation. Check RLS policies."); return; }
        conversationId = conv.id;

        const { error: memberErr } = await supabase.from("conversation_members").insert([
          { conversation_id: conversationId, user_id: currentUser.id },
          { conversation_id: conversationId, user_id: userId },
        ]);
        if (memberErr) { setStartChatError(memberErr.message); return; }
      }

      upsertConversation(makeConversation(conversationId, name, avatarUrl, userId));
      setShowNewChat(false);
      setStartChatError("");
      setActiveChat(conversationId);
      onClose?.();
    } catch (err: any) {
      setStartChatError(err?.message ?? "Unexpected error");
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <>
      {showNewChat && (
        <NewChatModal
          onClose={() => { setShowNewChat(false); setStartChatError(""); }}
          onStartChat={handleStartChat}
          starting={startingChat}
          startError={startChatError}
        />
      )}

      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between px-3">
          <button
            onClick={handleSettings}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6b8299] transition hover:bg-[#202b36] hover:text-white"
            aria-label="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-white">Chats</span>
          <button
            onClick={() => setShowNewChat(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6b8299] transition hover:bg-[#202b36] hover:text-white"
            aria-label="New chat"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 1v16M1 9h16" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#1c2733] px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#4a6580" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6" cy="6" r="4.5" />
              <path d="M9.5 9.5L13 13" />
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white placeholder-[#4a6580] outline-none"
              aria-label="Search conversations"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleChatSelect(conv.id)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                  activeChat === conv.id ? "bg-[#2b5278]" : "hover:bg-[#202b36]"
                }`}
                aria-pressed={activeChat === conv.id}
              >
                <div className="relative shrink-0">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold text-white overflow-hidden"
                    style={{ backgroundColor: conv.color }}
                  >
                    {conv.avatarUrl
                      ? <img src={conv.avatarUrl} alt={conv.name} className="w-full h-full object-cover" />
                      : conv.isBot
                        ? <svg width="20" height="20" viewBox="0 0 40 40" fill="none"><path d="M10 20c3-5 6 5 10 0s6 5 10 0" stroke="#7eb88a" strokeWidth="2.5" strokeLinecap="round"/></svg>
                        : conv.initials}
                  </div>
                  {conv.isBot && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#7eb88a] border-2 border-[#17212b] flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  )}
                  {!conv.isBot && conv.otherUserId && onlineIds.has(conv.otherUserId) && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#17212b] bg-[#7eb88a]" aria-label="Online" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-white flex items-center gap-1">
                      {conv.name}
                      {conv.isBot && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[#7eb88a]">
                          <circle cx="6" cy="6" r="6" fill="currentColor"/>
                          <path d="M3 6l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span className={`shrink-0 text-[10px] ${conv.unread > 0 ? "text-[#7eb88a]" : "text-[#4a6580]"}`}>
                      {conv.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-[#6b8299]">{conv.lastMessage}</span>
                    {conv.unread > 0 && (
                      <span className="flex h-4.5 min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#7eb88a] px-1 text-[9px] font-bold text-[#0e1621]" aria-label={`${conv.unread} unread messages`}>
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1c2733] text-[#4a6580]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">No chats yet</p>
              <p className="mt-1 text-xs text-[#6b8299]">Tap <span className="text-white">+</span> to find a friend by username.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
