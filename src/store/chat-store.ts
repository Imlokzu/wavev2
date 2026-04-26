import { create } from "zustand";

/* ── Types ─────────────────────────────────────────── */

export interface Conversation {
  id: string;
  name: string;
  initials: string;
  color: string;
  online: boolean;
  lastMessage: string;
  time: string;
  unread: number;
  avatarUrl?: string | null;
  otherUserId?: string;
  memberCount?: number;
  isBot?: boolean; // Wave official bot
  isGroup?: boolean;
  inviteCode?: string;
  groupRole?: 'admin' | 'member';
}

export const conversations: Conversation[] = []; // kept for compat, real data in store

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface FileData {
  name: string;
  size: number;
  mimeType: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  time: string;
  own: boolean;
  type: "text" | "image" | "poll" | "gif" | "file" | "action";
  pollData?: { question: string; options: PollOption[] };
  fileData?: FileData;
  reactions?: Record<string, string[]>;
  replyTo?: string;
  readBy?: string[];
  editedAt?: string | null;
  actions?: { id: string; label: string; style: "primary" | "danger" | "default"; done?: boolean }[];
}

export const demoMessages: Record<string, ChatMessage[]> = {};

/* ── Store ─────────────────────────────────────────── */

interface ChatState {
  activeChat: string;
  conversations: Conversation[];
  showSettings: boolean;
  showAttachMenu: boolean;
  activePanelType: "gif" | "poll" | "scheduler" | null;
  setActivePanelType: (type: "gif" | "poll" | "scheduler" | null) => void;
  replyingTo: string | null;
  editingId: string | null;
  sentMessages: Record<string, ChatMessage[]>;
  loadedChats: Set<string>;
  demoEdits: Record<string, Record<string, string>>;
  deletedDemoIds: Record<string, string[]>;
  typingStatus: Record<string, string>;
  setActiveChat: (id: string) => void;
  setConversations: (convs: Conversation[]) => void;
  upsertConversation: (conv: Conversation) => void;
  toggleSettings: () => void;
  setShowAttachMenu: (show: boolean) => void;
  setReplyingTo: (msgId: string | null) => void;
  setEditingId: (msgId: string | null) => void;
  setMessagesForChat: (chatId: string, msgs: ChatMessage[]) => void;
  markChatLoaded: (chatId: string) => void;
  sendMessage: (chatId: string, content: string, type?: ChatMessage["type"], sender?: string, own?: boolean, pollData?: ChatMessage["pollData"], replyTo?: string, fileData?: FileData, tempId?: string) => void;
  setTypingStatus: (chatId: string, typingSender: string | null) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  editMessage: (chatId: string, messageId: string, newContent: string) => void;
  addReaction: (chatId: string, messageId: string, emoji: string, user: string) => void;
  votePoll: (chatId: string, messageId: string, optionId: string, user: string) => void;
  addSupabaseMessage: (chatId: string, msg: ChatMessage) => void;
  markMessageRead: (chatId: string, messageId: string, userId: string) => void;
  replaceMessageId: (chatId: string, tempId: string, realId: string) => void;
  resolveAction: (chatId: string, messageId: string, actionId: string) => void;
}

const COLORS = ["#2e7d5b", "#2b5278", "#7d4e2e", "#4e2e7d", "#2e4e7d", "#7d2e4e"];
function colorFor(id: string) { return COLORS[id.charCodeAt(0) % COLORS.length]; }
function initialsFor(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export function makeConversation(id: string, name: string, avatarUrl?: string | null, otherUserId?: string, memberCount = 2, isGroup = false): Conversation {
  const BOT_ID = "00000000-0000-0000-0000-000000000001";
  return {
    id,
    name,
    initials: initialsFor(name),
    color: otherUserId === BOT_ID ? "#2e7d5b" : colorFor(id),
    online: false,
    lastMessage: "",
    time: "",
    unread: 0,
    avatarUrl: avatarUrl ?? null,
    otherUserId,
    memberCount,
    isBot: otherUserId === BOT_ID,
    isGroup,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeChat: "",
  conversations: [],
  showSettings: false,
  showAttachMenu: false,
  activePanelType: null,
  setActivePanelType: (type) => set({ activePanelType: type }),
  replyingTo: null,
  editingId: null,
  sentMessages: {},
  loadedChats: new Set(),
  typingStatus: {},
  demoEdits: {},
  deletedDemoIds: {},

  setActiveChat: (id) => set({ activeChat: id, showSettings: false, showAttachMenu: false, activePanelType: null, replyingTo: null, editingId: null }),
  setConversations: (convs) => set({ conversations: convs }),
  upsertConversation: (conv) => set((s) => {
    const exists = s.conversations.find(c => c.id === conv.id);
    if (exists) return { conversations: s.conversations.map(c => c.id === conv.id ? { ...c, ...conv } : c) };
    return { conversations: [conv, ...s.conversations] };
  }),
  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),
  setShowAttachMenu: (show) => set({ showAttachMenu: show }),
  setReplyingTo: (msgId) => set({ replyingTo: msgId }),
  setEditingId: (msgId) => set({ editingId: msgId }),
  setMessagesForChat: (chatId, msgs) => set((s) => ({ sentMessages: { ...s.sentMessages, [chatId]: msgs } })),
  markChatLoaded: (chatId) => set((s) => ({ loadedChats: new Set([...s.loadedChats, chatId]) })),

  sendMessage: (chatId, content, type = "text", sender = "You", own = true, pollData, replyTo, fileData, tempId) =>
    set((s) => ({
      sentMessages: {
        ...s.sentMessages,
        [chatId]: [
          ...(s.sentMessages[chatId] ?? []),
          {
            id: tempId ?? crypto.randomUUID(),
            sender,
            content,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            own,
            type,
            pollData,
            fileData,
            replyTo: replyTo ?? undefined,
          },
        ],
      },
      replyingTo: own ? null : s.replyingTo,
    })),

  setTypingStatus: (chatId, typingSender) =>
    set((s) => {
      const newStatus = { ...s.typingStatus };
      if (typingSender) newStatus[chatId] = typingSender;
      else delete newStatus[chatId];
      return { typingStatus: newStatus };
    }),

  deleteMessage: (chatId, messageId) =>
    set((s) => {
      const inSent = (s.sentMessages[chatId] ?? []).some((m) => m.id === messageId);
      if (inSent) {
        return { sentMessages: { ...s.sentMessages, [chatId]: s.sentMessages[chatId].filter((m) => m.id !== messageId) } };
      }
      return { deletedDemoIds: { ...s.deletedDemoIds, [chatId]: [...(s.deletedDemoIds[chatId] ?? []), messageId] } };
    }),

  editMessage: (chatId, messageId, newContent) =>
    set((s) => {
      const inSent = (s.sentMessages[chatId] ?? []).some((m) => m.id === messageId);
      if (inSent) {
        return {
          sentMessages: { ...s.sentMessages, [chatId]: s.sentMessages[chatId].map((m) => m.id === messageId ? { ...m, content: newContent, editedAt: new Date().toISOString() } : m) },
          editingId: null,
        };
      }
      return { demoEdits: { ...s.demoEdits, [chatId]: { ...(s.demoEdits[chatId] ?? {}), [messageId]: newContent } }, editingId: null };
    }),

  addReaction: (chatId, messageId, emoji, user) =>
    set((s) => {
      const msgs = s.sentMessages[chatId] ?? [];
      return {
        sentMessages: {
          ...s.sentMessages,
          [chatId]: msgs.map((m) => {
            if (m.id !== messageId) return m;
            const reactions = { ...(m.reactions || {}) };
            if (!reactions[emoji]) reactions[emoji] = [];
            if (!reactions[emoji].includes(user)) reactions[emoji] = [...reactions[emoji], user];
            else {
              reactions[emoji] = reactions[emoji].filter((u) => u !== user);
              if (reactions[emoji].length === 0) delete reactions[emoji];
            }
            return { ...m, reactions };
          }),
        },
      };
    }),

  addSupabaseMessage: (chatId, msg) =>
    set((s) => {
      const existing = s.sentMessages[chatId] ?? [];
      if (existing.some((m) => m.id === msg.id)) return s;
      return { sentMessages: { ...s.sentMessages, [chatId]: [...existing, msg] } };
    }),

  markMessageRead: (chatId, messageId, userId) =>
    set((s) => {
      const msgs = s.sentMessages[chatId] ?? [];
      return {
        sentMessages: {
          ...s.sentMessages,
          [chatId]: msgs.map((m) =>
            m.id === messageId
              ? { ...m, readBy: [...new Set([...(m.readBy ?? []), userId])] }
              : m
          ),
        },
      };
    }),

  replaceMessageId: (chatId, tempId, realId) =>
    set((s) => {
      const msgs = s.sentMessages[chatId] ?? [];
      return {
        sentMessages: {
          ...s.sentMessages,
          [chatId]: msgs.map((m) => m.id === tempId ? { ...m, id: realId } : m),
        },
      };
    }),

  resolveAction: (chatId, messageId, actionId) =>
    set((s) => {
      const msgs = s.sentMessages[chatId] ?? [];
      return {
        sentMessages: {
          ...s.sentMessages,
          [chatId]: msgs.map((m) =>
            m.id === messageId
              ? { ...m, actions: (m.actions ?? []).map(a => ({ ...a, done: a.id === actionId })) }
              : m
          ),
        },
      };
    }),

  votePoll: (chatId, messageId, optionId, user) =>
    set((s) => {
      const msgs = s.sentMessages[chatId] ?? [];
      return {
        sentMessages: {
          ...s.sentMessages,
          [chatId]: msgs.map((m) => {
            if (m.id !== messageId || !m.pollData) return m;
            const options = m.pollData.options.map((opt) => {
              const hasVoted = opt.votes.includes(user);
              if (opt.id === optionId) return { ...opt, votes: hasVoted ? opt.votes.filter(u => u !== user) : [...opt.votes, user] };
              return { ...opt, votes: opt.votes.filter(u => u !== user) };
            });
            return { ...m, pollData: { ...m.pollData, options } };
          }),
        },
      };
    }),
}));
