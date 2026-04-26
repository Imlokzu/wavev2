import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { MessageInput } from "@/features/chat/components/message-input";
import { ChatPanels } from "@/features/chat/components/chat-panels";
import { SettingsPanel } from "@/features/chat/components/settings-panel";
import { useChatStore, makeConversation, type ChatMessage } from "@/store/chat-store";
import { useRealtimeMessages, deleteSupabaseMessage, editSupabaseMessage, loadConversations } from "@/hooks/useRealtimeMessages";
import { useAuthStore } from "@/store/auth-store";
import { ProfileModal } from "@/components/ProfileModal";
import { MarkdownText } from "@/components/MarkdownText";
import { supabase } from "@/utils/supabase";
import { usePresenceStore } from "@/hooks/usePresence";

export function ChatPage() {
  const activeChat = useChatStore((s) => s.activeChat);
  const showSettings = useChatStore((s) => s.showSettings);
  const sentMessages = useChatStore((s) => s.sentMessages);
  const typingStatus = useChatStore((s) => s.typingStatus);
  const storeConversations = useChatStore((s) => s.conversations);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const votePoll = useChatStore((s) => s.votePoll);
  const addReaction = useChatStore((s) => s.addReaction);
  const setEditingId = useChatStore((s) => s.setEditingId);
  const resolveAction = useChatStore((s) => s.resolveAction);
  const currentUser = useAuthStore((s) => s.user);
  const onlineIds = usePresenceStore((s) => s.onlineIds);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string, x: number, y: number, own: boolean } | null>(null);
  const [showReactionsFor, setShowReactionsFor] = useState<{ id: string, x: number, y: number } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aboutMsg, setAboutMsg] = useState<ChatMessage | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const setActiveChat = useChatStore((s) => s.setActiveChat);

  // Request notification permission on first load
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight-flash");
      setTimeout(() => el.classList.remove("highlight-flash"), 1200);
    }
  };

  const MessageTick = ({ msg }: { msg: ChatMessage }) => {
    if (!msg.own) return null;
    const conv = storeConversations.find(c => c.id === activeChat);
    const otherMemberCount = (conv?.memberCount ?? 2) - 1; // exclude sender
    const readCount = (msg.readBy ?? []).filter(id => id !== currentUser?.id).length;
    const allRead = otherMemberCount > 0 && readCount >= otherMemberCount;
    const anyRead = readCount > 0;

    return (
      <svg width="14" height="8" viewBox="0 0 14 8" fill="none" className={allRead ? "text-[#7eb88a]" : "text-[#6b8299]/60"}>
        {/* First tick — always shown for sent messages */}
        <path d="M1 4l2.5 2.5L8 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Second tick — shown when delivered/read */}
        <path d="M5 4l2.5 2.5L12 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const handleContextMenu = (e: React.MouseEvent, id: string, own: boolean) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY, own });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setShowReactionsFor(null);
  };

  const handleReply = () => {
    if (contextMenu) setReplyingTo(contextMenu.id);
    closeContextMenu();
  };

  const handleDelete = () => {
    if (contextMenu) {
      deleteMessage(activeChat, contextMenu.id);
      deleteSupabaseMessage(contextMenu.id); // no-op in demo mode
    }
    closeContextMenu();
  };

  const handleEdit = () => {
    if (!contextMenu) return;
    setEditingId(contextMenu.id);
    closeContextMenu();
    // Supabase update is triggered from message-input after the user saves
  };

  const handleAbout = () => {
    if (!contextMenu) return;
    const msg = allMessages.find(m => m.id === contextMenu.id);
    if (msg) setAboutMsg(msg);
    closeContextMenu();
  };

  const handleReact = (emoji: string) => {
    if (showReactionsFor) addReaction(activeChat, showReactionsFor.id, emoji, "You");
    closeContextMenu();
  };

  const chat = storeConversations.find((c) => c.id === activeChat);

  // IntersectionObserver — mark messages as read when they scroll into view
  useEffect(() => {
    if (!activeChat || !currentUser) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const msgId = (entry.target as HTMLElement).dataset.msgId;
          const senderId = (entry.target as HTMLElement).dataset.senderId;
          if (!msgId || !senderId || senderId === currentUser.id) return;
          // Mark as read via Supabase
          import("@/hooks/useRealtimeMessages").then(({ markConversationRead: _ }) => {
            supabase.from("messages").select("read_by").eq("id", msgId).maybeSingle().then(({ data }) => {
              const current: string[] = data?.read_by ?? [];
              if (!current.includes(currentUser.id)) {
                supabase.from("messages").update({ read_by: [...current, currentUser.id] }).eq("id", msgId).then(() => {
                  useChatStore.getState().markMessageRead(activeChat, msgId, currentUser.id);
                });
              }
            });
          });
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );

    // Observe all unread incoming messages
    const msgs = useChatStore.getState().sentMessages[activeChat] ?? [];
    msgs.forEach((msg) => {
      if (msg.own) return;
      if ((msg.readBy ?? []).includes(currentUser.id)) return;
      const el = document.getElementById(`msg-${msg.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [activeChat, currentUser?.id, sentMessages]);

  const handleProfileDm = async (userId: string, name: string, username: string, avatarUrl: string | null) => {
    if (!currentUser) return;
    const { data: myM } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", currentUser.id);
    const myIds = (myM ?? []).map((r: any) => r.conversation_id);
    let convId: string | null = null;
    if (myIds.length) {
      const { data: shared } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", userId).in("conversation_id", myIds);
      if (shared?.length) convId = shared[0].conversation_id;
    }
    if (!convId) {
      const { data: conv } = await supabase.from("conversations").insert({ is_group: false, created_by: currentUser.id }).select("id").maybeSingle();
      if (!conv) return;
      convId = conv.id;
      await supabase.from("conversation_members").insert([{ conversation_id: convId, user_id: currentUser.id }, { conversation_id: convId, user_id: userId }]);
    }
    upsertConversation(makeConversation(convId, name, avatarUrl, userId));
    setActiveChat(convId);
    setProfileUserId(null);
  };

  const handleMentionClick = async (username: string) => {
    const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
    if (data?.id) setProfileUserId(data.id);
  };

  const allMessages = [
    ...(sentMessages[activeChat] ?? []),
  ];

  const messages = searchQuery.trim()
    ? allMessages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : allMessages;

  const closeSidebar = () => setSidebarOpen(false);

  // Subscribe to real-time Supabase messages
  useRealtimeMessages(activeChat);

  return (
    <div className="flex h-screen w-screen bg-[#0e1621]">
      {profileUserId && (
        <ProfileModal
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
          onSendDm={handleProfileDm}
        />
      )}
      {/* Sidebar / Settings - Desktop */}
      <div className="hidden w-80 shrink-0 border-r border-[#1f2f3f] bg-[#17212b] lg:block">
        {showSettings ? <SettingsPanel /> : <Sidebar />}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          role="presentation"
        />
      )}

      {/* Sidebar / Settings - Mobile */}
      <div
        className={`fixed bottom-0 left-0 top-0 z-40 w-80 transform border-r border-[#1f2f3f] bg-[#17212b] transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {showSettings ? (
          <SettingsPanel onClose={closeSidebar} />
        ) : (
          <Sidebar onClose={closeSidebar} />
        )}
      </div>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col relative min-h-0">
        {activeChat ? (
          <>
            {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[#1f2f3f] px-3 md:px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6b8299] transition hover:bg-[#1c2733] hover:text-white lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3h14M2 9h14M2 15h14" />
            </svg>
          </button>

          <button
            onClick={() => !chat?.isBot && chat?.otherUserId && setProfileUserId(chat.otherUserId)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white overflow-hidden ${!chat?.isBot ? "transition hover:opacity-80 cursor-pointer" : "cursor-default"}`}
            style={{ backgroundColor: chat?.color ?? "#2e7d5b" }}
          >
            {chat?.avatarUrl
              ? <img src={chat.avatarUrl} alt={chat.name} className="w-full h-full object-cover" />
              : chat?.isBot
                ? <svg width="18" height="18" viewBox="0 0 40 40" fill="none"><path d="M10 20c3-5 6 5 10 0s6 5 10 0" stroke="#7eb88a" strokeWidth="2.5" strokeLinecap="round"/></svg>
                : chat?.initials ?? "?"}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white flex items-center gap-1">
              {chat?.name}
              {chat?.isBot && (
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[#7eb88a]">
                  <circle cx="6" cy="6" r="6" fill="currentColor"/>
                  <path d="M3 6l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </p>
            <p className="text-[10px] text-[#6b8299]">
              {chat?.isBot ? (
                <span className="text-[#7eb88a]">Official Wave Bot</span>
              ) : typingStatus[activeChat] ? (
                <span className="text-[#7eb88a]">typing...</span>
              ) : chat?.otherUserId && onlineIds.has(chat.otherUserId) ? (
                <span className="text-[#7eb88a]">online</span>
              ) : (
                "last seen recently"
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-[#1c2733] hover:text-white ${showSearch ? 'bg-[#1c2733] text-white' : 'text-[#6b8299]'}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <circle cx="7" cy="7" r="5" />
                <path d="M11 11l3 3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar Dropdown */}
        {showSearch && (
          <div className="bg-[#17212b] border-b border-[#1f2f3f] px-4 py-2 animate-slide-up flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#6b8299" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6" cy="6" r="4.5" />
              <path d="M9.5 9.5L13 13" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in chat..."
              className="flex-1 bg-transparent text-sm text-white placeholder-[#4a6580] outline-none"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-[#6b8299] hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-4 md:px-4 min-h-0">
          <div className="mb-4 flex justify-center">
            <span className="rounded-xl bg-[#1c2733]/80 px-3 py-1 text-[10px] text-[#6b8299]">
              Today
            </span>
          </div>

          {messages.map((msg, i) => {
            const isFirst = i === 0 || messages[i - 1].own !== msg.own;
            const repliedMsg = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;
            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                data-msg-id={msg.id}
                data-sender-id={msg.own ? currentUser?.id ?? "" : "other"}
                className={`flex animate-pop-in flex-col ${msg.own ? "items-end" : "items-start"} ${isFirst ? "mt-3" : "mt-1"}`}
              >
                <div
                  onContextMenu={(e) => handleContextMenu(e, msg.id, msg.own)}
                  className={`relative max-w-[85%] sm:max-w-[70%] md:max-w-[60%] select-none flex flex-col`}
                >
                  <div className={`px-3 py-1.5 ${msg.own ? "rounded-2xl bg-[#1b3a2d]" : "rounded-2xl bg-[#1c2733]"}`}>
                    {!msg.own && isFirst && (
                      <p className="mb-0.5 text-[11px] font-medium text-[#7eb88a]">{msg.sender}</p>
                    )}

                    {/* Reply Preview — inside bubble */}
                    {repliedMsg && (
                      <button
                        onClick={() => scrollToMessage(repliedMsg.id)}
                        className={`w-full text-left mb-1.5 px-2 py-1.5 rounded-lg border-l-[3px] text-[11px] transition-opacity hover:opacity-80 ${
                          msg.own
                            ? "border-[#7eb88a] bg-[#0e1621]/30"
                            : "border-[#7eb88a] bg-[#0e1621]/20"
                        }`}
                      >
                        <p className="font-semibold text-[#7eb88a] truncate">{repliedMsg.sender}</p>
                        <p className="text-[#c8d8e8] truncate opacity-90">
                          {repliedMsg.type !== "text" ? `📎 ${repliedMsg.type}` : repliedMsg.content}
                        </p>
                      </button>
                    )}

                    <div className="flex flex-col gap-1">
                      {msg.type === "gif" || msg.type === "image" ? (
                        <div className="rounded-xl overflow-hidden mt-1 mb-1 max-w-[200px]">
                          <img src={msg.content} alt="Attachment" className="w-full object-cover" />
                        </div>
                      ) : msg.type === "file" && msg.fileData ? (
                        <div className="flex items-center gap-3 min-w-[200px] bg-[#0e1621]/20 rounded-xl p-3 mt-1">
                          {/* File type icon */}
                          <div className="shrink-0 h-10 w-10 rounded-lg bg-[#2b5278] flex items-center justify-center">
                            {msg.fileData.mimeType.startsWith("video/") ? (
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h10a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V5a1 1 0 011-1zm10 3l4-2v6l-4-2"/></svg>
                            ) : msg.fileData.mimeType.includes("pdf") ? (
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#e05c5c" strokeWidth="1.5" strokeLinecap="round"><path d="M4 2h7l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1zm7 0v4h4"/><path d="M6 10h6M6 13h4"/></svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#6da879" strokeWidth="1.5" strokeLinecap="round"><path d="M4 2h7l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1zm7 0v4h4"/></svg>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <p className="text-[12px] font-medium text-[#e8e8e8] truncate">{msg.fileData.name}</p>
                            <p className="text-[10px] text-[#6b8299]">{(msg.fileData.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <a
                            href={msg.fileData.url}
                            download={msg.fileData.name}
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 text-[#6b8299] hover:text-[#7eb88a] transition"
                            title="Download"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M8 3v7M5 8l3 3 3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"/>
                            </svg>
                          </a>
                        </div>
                      ) : msg.type === "poll" && msg.pollData ? (
                        <div className="flex flex-col gap-2 mt-1 min-w-[200px]">
                          <p className="font-medium text-[13px] text-white">{msg.pollData.question}</p>
                          <div className="flex flex-col gap-1.5">
                            {msg.pollData.options.map(opt => {
                              const totalVotes = msg.pollData!.options.reduce((sum, o) => sum + o.votes.length, 0);
                              const percent = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                              const hasVoted = opt.votes.includes("You");
                              return (
                                <button 
                                  key={opt.id}
                                  onClick={() => votePoll(activeChat, msg.id, opt.id, "You")}
                                  className="relative overflow-hidden rounded-lg bg-[#0e1621]/30 p-2 text-left text-[12px] text-[#e8e8e8] transition hover:bg-[#0e1621]/50 border border-transparent focus:outline-none"
                                  style={{ borderColor: hasVoted ? "#7eb88a" : "transparent" }}
                                >
                                  <div className="absolute left-0 top-0 bottom-0 bg-[#7eb88a]/20 transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                  <div className="relative flex justify-between">
                                    <span>{opt.text}</span>
                                    {totalVotes > 0 && <span className="text-[10px] text-[#6b8299]">{percent}%</span>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-[10px] text-[#6b8299] mt-1">{msg.pollData.options.reduce((sum, o) => sum + o.votes.length, 0)} votes</span>
                        </div>
                      ) : msg.type === "action" ? (
                        <div className="flex flex-col gap-2 mt-1">
                          <MarkdownText content={msg.content} onMentionClick={handleMentionClick} />
                          {msg.actions && msg.actions.length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-1">
                              {msg.actions.map((action) => (
                                <button
                                  key={action.id}
                                  disabled={msg.actions!.some(a => a.done)}
                                  onClick={() => {
                                    resolveAction(activeChat, msg.id, action.id);
                                    if (action.id === "block") {
                                      // Sign out all sessions
                                      import("@/utils/sessions").then(({ terminateAllOtherSessions }) => {
                                        if (currentUser) terminateAllOtherSessions(currentUser.id);
                                      });
                                    }
                                  }}
                                  className={`w-full py-2 rounded-xl text-[13px] font-medium transition ${
                                    action.done
                                      ? "opacity-40 cursor-not-allowed bg-[#1c2733] text-[#6b8299]"
                                      : action.style === "primary"
                                        ? "bg-[#7eb88a]/20 text-[#7eb88a] hover:bg-[#7eb88a]/30 border border-[#7eb88a]/30"
                                        : action.style === "danger"
                                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                                          : "bg-[#1c2733] text-[#e8e8e8] hover:bg-[#202b36]"
                                  }`}
                                >
                                  {action.done && action.id === msg.actions!.find(a => a.done)?.id ? `✓ ${action.label}` : action.label}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex justify-end">
                            <span className="text-[9px] text-[#6b8299]/50">{msg.time}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-end gap-2">
                          <MarkdownText content={msg.content} onMentionClick={handleMentionClick} />
                          <span className="mb-0.5 flex shrink-0 items-center gap-0.5 text-[9px] text-[#6b8299]/50">
                            {msg.editedAt && <span className="italic">edited</span>}
                            {msg.time}
                            <MessageTick msg={msg} />
                          </span>
                        </div>
                      )}
                      
                      {(msg.type === "gif" || msg.type === "image" || msg.type === "poll") && (
                        <div className="flex justify-end w-full">
                          <span className="mb-0.5 flex shrink-0 items-center gap-0.5 text-[9px] text-[#6b8299]/50">
                            {msg.time}
                            <MessageTick msg={msg} />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reactions Below Bubble */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`flex gap-1 mt-1 z-10 ${msg.own ? "justify-end" : "justify-start"} -mt-1.5`}>
                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                        <button
                          key={emoji}
                          onClick={() => addReaction(activeChat, msg.id, emoji, "You")}
                          className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] border shadow-sm ${
                            users.includes("You") ? "bg-[#1b3a2d] border-[#7eb88a]/30 text-white" : "bg-[#1c2733] border-[#1f2f3f] text-[#6b8299]"
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="opacity-80">{users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {typingStatus[activeChat] && (
            <div className="flex justify-start mt-3 animate-pop-in">
              <div className="relative max-w-[85%] px-4 py-3 rounded-2xl bg-[#1c2733] flex items-center gap-1.5">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          )}
        </div>

        {/* Context Menu Overlay */}
        {contextMenu && !showReactionsFor && (
          <div className="fixed inset-0 z-50" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
            <div
              className="absolute w-48 rounded-2xl bg-[#202b36] p-1.5 shadow-xl ring-1 ring-white/5 animate-pop-in flex flex-col"
              style={{
                top: Math.min(contextMenu.y, window.innerHeight - 250),
                left: Math.min(contextMenu.x, window.innerWidth - 200),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={handleReply} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#e8e8e8] transition hover:bg-[#2b5278] text-left">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 6L2 9l3 3M2 9h9a3 3 0 003-3v0a3 3 0 00-3-3H8"/></svg>
                Reply
              </button>
              <button onClick={handleAbout} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#e8e8e8] transition hover:bg-[#2b5278] text-left border-b border-[#1f2f3f] pb-2 mb-1">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 7v5M8 5.5v.01"/></svg>
                About
              </button>
              {contextMenu.own && (
                <button onClick={handleEdit} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#e8e8e8] transition hover:bg-[#2b5278] text-left">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 2l3 3-9 9H2v-3L11 2z"/></svg>
                  Edit
                </button>
              )}
              {contextMenu.own && (
                <button onClick={handleDelete} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-400 transition hover:bg-[#3d2b2f] text-left">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M5 4v10M11 4v10M6 2h4"/></svg>
                  Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reactions Mini-Bar Overlay */}
        {showReactionsFor && (
          <div className="fixed inset-0 z-50" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
            <div
              className="absolute rounded-full bg-[#202b36] p-2 shadow-xl ring-1 ring-white/5 animate-pop-in flex gap-2"
              style={{
                top: Math.max(0, showReactionsFor.y - 60),
                left: Math.min(showReactionsFor.x - 50, window.innerWidth - 200),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map(emoji => (
                <button key={emoji} onClick={() => handleReact(emoji)} className="text-xl hover:scale-125 transition-transform">
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* About Message Modal */}
        {aboutMsg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAboutMsg(null)}>
            <div className="bg-[#202b36] rounded-2xl p-5 w-72 shadow-xl ring-1 ring-white/5 animate-pop-in" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-semibold text-sm mb-4">Message Info</h3>
              <div className="space-y-3 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#6b8299]">Sender</span>
                  <span className="text-[#e8e8e8] font-medium">{aboutMsg.sender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b8299]">Time</span>
                  <span className="text-[#e8e8e8]">{aboutMsg.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b8299]">Type</span>
                  <span className="text-[#e8e8e8] capitalize">{aboutMsg.type}</span>
                </div>
                {aboutMsg.editedAt && (
                  <div className="flex justify-between">
                    <span className="text-[#6b8299]">Edited</span>
                    <span className="text-[#e8e8e8] flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="#6b8299" strokeWidth="1.5" strokeLinecap="round"><path d="M10 2l2 2-7 7H3v-2L10 2z"/></svg>
                      {new Date(aboutMsg.editedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
                {aboutMsg.type === "text" && (
                  <div className="border-t border-[#1f2f3f] pt-3">
                    <p className="text-[#6b8299] text-[11px] mb-1">Content</p>
                    <p className="text-[#e8e8e8] break-words">{aboutMsg.content}</p>
                  </div>
                )}
                {aboutMsg.reactions && Object.keys(aboutMsg.reactions).length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#6b8299]">Reactions</span>
                    <span className="text-[#e8e8e8]">{Object.entries(aboutMsg.reactions).map(([e,u]) => `${e} ${u.length}`).join("  ")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#6b8299]">Status</span>
                  <span className="flex items-center gap-1">
                    {aboutMsg.own ? (
                      (aboutMsg.readBy ?? []).some(id => id !== currentUser?.id) ? (
                        <span className="text-[#7eb88a] flex items-center gap-1">
                          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                            <path d="M1 4l2.5 2.5L8 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M4 4l2.5 2.5L11 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Read
                        </span>
                      ) : (
                        <span className="text-[#6b8299] flex items-center gap-1">
                          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                            <path d="M1 4l2.5 2.5L8 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M4 4l2.5 2.5L11 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Delivered
                        </span>
                      )
                    ) : (
                      <span className="text-[#6b8299]">Received</span>
                    )}
                  </span>
                </div>
              </div>
              <button onClick={() => setAboutMsg(null)} className="mt-4 w-full text-center text-sm text-[#7eb88a] hover:underline">Close</button>
            </div>
          </div>
        )}

        {/* Panels — sit between messages and input, push messages up */}
        <ChatPanels />

        {/* Input */}
        <MessageInput />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-[#0e1621] text-[#4a6580] flex-col gap-4 animate-pop-in">
          <div className="w-20 h-20 rounded-full bg-[#1c2733] flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium">Select a chat to start messaging</p>
        </div>
      )}
      </div>
    </div>
  );
}
