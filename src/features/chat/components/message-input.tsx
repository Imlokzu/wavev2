import { useState, useRef, useEffect } from "react";
import { useChatStore, demoMessages } from "@/store/chat-store";
import { uploadToR2 } from "@/utils/r2";
import { sendSupabaseMessage, editSupabaseMessage } from "@/hooks/useRealtimeMessages";
import { useAuthStore } from "@/store/auth-store";

export function MessageInput() {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectionToolbar, setSelectionToolbar] = useState<{ x: number; y: number } | null>(null);
  const [mentionResults, setMentionResults] = useState<{ id: string; name: string; username: string }[]>([]);
  const [showMention, setShowMention] = useState(false);
  const [sendMenuPos, setSendMenuPos] = useState<{ x: number; y: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const sendButtonRef = useRef<HTMLButtonElement | null>(null);
  const suppressNextSendRef = useRef(false);

  const activeChat = useChatStore((s) => s.activeChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const editMessage = useChatStore((s) => s.editMessage);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const editingId = useChatStore((s) => s.editingId);
  const setEditingId = useChatStore((s) => s.setEditingId);
  const sentMessages = useChatStore((s) => s.sentMessages);
  const activePanelType = useChatStore((s) => s.activePanelType);
  const setActivePanelType = useChatStore((s) => s.setActivePanelType);
  const showScheduler = activePanelType === "scheduler";
  const user = useAuthStore((s) => s.user);

  // Pre-fill text when editing
  useEffect(() => {
    if (!editingId) return;
    const allMsgs = [...(demoMessages[activeChat] ?? []), ...(sentMessages[activeChat] ?? [])];
    const msg = allMsgs.find((m) => m.id === editingId);
    if (msg) { setText(msg.content); setTimeout(() => textareaRef.current?.focus(), 50); }
  }, [editingId, activeChat]);

  const handleSend = () => {
    if (!text.trim()) return;
    if (editingId) {
      editMessage(activeChat, editingId, text.trim());
      editSupabaseMessage(editingId, text.trim());
      setText("");
      return;
    }
    const content = text.trim();
    const replyTo = replyingTo || undefined;
    const tempId = crypto.randomUUID();
    sendMessage(activeChat, content, "text", user?.name ?? "You", true, undefined, replyTo, undefined, tempId);
    setText("");
    setReplyingTo(null);
    if (user) sendSupabaseMessage(activeChat, user.id, { content, type: "text", replyTo, tempId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape" && editingId) { setText(""); setEditingId(null); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setShowAttachMenu(false);
    setUploading(true);
    try {
      const url = await uploadToR2(file);
      const replyTo = replyingTo || undefined;
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        sendMessage(activeChat, url, "image", user?.name ?? "You", true, undefined, replyTo);
        if (user) sendSupabaseMessage(activeChat, user.id, { content: url, type: "image", replyTo });
      } else {
        const fileData = { name: file.name, size: file.size, mimeType: file.type || "application/octet-stream", url };
        sendMessage(activeChat, file.name, "file", user?.name ?? "You", true, undefined, replyTo, fileData);
        if (user) sendSupabaseMessage(activeChat, user.id, { content: file.name, type: "file", replyTo, fileData });
      }
      setReplyingTo(null);
    } catch (err) {
      sendMessage(activeChat, `❌ Failed to upload ${(file as File).name}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setShowMention(true);
      import("@/utils/supabase").then(({ supabase }) => {
        supabase.from("profiles").select("id, name, username").ilike("username", `%${match[1]}%`).limit(5).then(({ data }) => {
          setMentionResults(data ?? []);
        });
      });
    } else {
      setShowMention(false);
    }
  };

  const insertMention = (username: string) => {
    const cursor = textareaRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, cursor).replace(/@\w*$/, `@${username} `);
    setText(before + text.slice(cursor));
    setShowMention(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const applyFormat = (wrap: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.slice(start, end);
    if (!selected) return;
    setText(text.slice(0, start) + wrap + selected + wrap + text.slice(end));
    setSelectionToolbar(null);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + wrap.length, end + wrap.length); }, 0);
  };

  const handleSelect = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (text.slice(ta.selectionStart, ta.selectionEnd).length > 0) {
      const rect = ta.getBoundingClientRect();
      setSelectionToolbar({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    } else {
      setSelectionToolbar(null);
    }
  };

  const allMessages = [...(demoMessages[activeChat] ?? []), ...(sentMessages[activeChat] ?? [])];
  const replyingToMsg = allMessages.find((m) => m.id === replyingTo);

  const openSendMenu = (x: number, y: number) => {
    if (editingId) return;
    setSendMenuPos({ x, y });
  };

  const closeSendMenu = () => setSendMenuPos(null);

  const handleSendButtonTouchStart = () => {
    if (editingId) return;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      const rect = sendButtonRef.current?.getBoundingClientRect();
      if (rect) openSendMenu(rect.left + rect.width / 2, rect.top - 8);
      suppressNextSendRef.current = true;
      longPressTimerRef.current = null;
    }, 550);
  };

  const handleSendButtonTouchEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="shrink-0 bg-[#17212b] border-t border-[#1f2f3f] relative">
      {/* Reply banner */}
      {replyingTo && !editingId && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1f2f3f]">
          <div className="w-0.5 h-8 rounded-full bg-[#7eb88a] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[#7eb88a] text-xs font-medium">Replying to {replyingToMsg?.sender ?? "message"}</p>
            <p className="text-[#6b8299] text-xs truncate">{replyingToMsg ? (replyingToMsg.type === "text" ? replyingToMsg.content : "Attachment") : "..."}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-[#6b8299] hover:text-white transition p-1">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>
      )}

      {/* Editing banner */}
      {editingId && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1f2f3f]">
          <div className="w-0.5 h-8 rounded-full bg-[#6da879] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[#6da879] text-xs font-medium flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 2l2 2-7 7H3v-2L10 2z" /></svg>
              Editing message
            </p>
            <p className="text-[#6b8299] text-xs truncate">{text}</p>
          </div>
          <button onClick={() => { setText(""); setEditingId(null); }} className="text-[#6b8299] hover:text-white transition p-1">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>
      )}

      <div className="px-3 py-2.5 md:px-4 md:py-3">
        {/* Attach menu */}
        {showAttachMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
            <div className="absolute bottom-full left-4 mb-2 w-48 rounded-2xl bg-[#202b36] p-2 shadow-xl ring-1 ring-white/5 animate-pop-in z-50">
              <div className="flex flex-col gap-1">
                {[
                  { label: "Photo or Video", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#6da879]"><rect x="2" y="4" width="14" height="10" rx="2"/><circle cx="6" cy="8" r="1.5"/><path d="M2 14l4-3 3 2 4-4 3 2"/></svg>, action: () => { setShowAttachMenu(false); fileInputRef.current?.click(); } },
                  { label: "File", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#3b7ba2]"><path d="M4 3h6l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M10 3v4h4"/></svg>, action: () => { setShowAttachMenu(false); fileInputRef.current?.click(); } },
                  { label: "GIF", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#9c4757]"><rect x="2" y="4" width="14" height="10" rx="2"/><path d="M6 11V7M12 11V7M9 11v-2"/></svg>, action: () => { setShowAttachMenu(false); setActivePanelType("gif"); } },
                  { label: "Poll", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#8a7432]"><rect x="2" y="4" width="14" height="10" rx="2"/><path d="M5 11V7M9 11V5M13 11V8"/></svg>, action: () => { setShowAttachMenu(false); setActivePanelType("poll"); } },
                ].map(({ label, icon, action }) => (
                  <button key={label} onClick={action} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#e8e8e8] transition hover:bg-[#2b5278]">
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex items-end gap-2 relative z-20">
          {/* Selection formatting toolbar */}
          {selectionToolbar && (
            <div className="fixed z-[60] flex items-center gap-1 bg-[#202b36] rounded-xl px-2 py-1.5 shadow-xl ring-1 ring-white/10 animate-pop-in"
              style={{ left: Math.min(selectionToolbar.x - 80, window.innerWidth - 180), top: selectionToolbar.y - 44 }}
              onMouseDown={(e) => e.preventDefault()}>
              {[{ label: "B", wrap: "**", title: "Bold" }, { label: "I", wrap: "_", title: "Italic", cls: "italic" }, { label: "S", wrap: "~~", title: "Strike", cls: "line-through" }, { label: "</>", wrap: "`", title: "Code" }, { label: "||", wrap: "||", title: "Spoiler" }].map(({ label, wrap, title, cls }) => (
                <button key={wrap} title={title} onClick={() => applyFormat(wrap)} className={`px-2 py-0.5 text-[12px] text-white hover:bg-[#2b5278] rounded-lg transition font-mono ${cls ?? ""}`}>{label}</button>
              ))}
            </div>
          )}

          {/* @mention dropdown */}
          {showMention && mentionResults.length > 0 && (
            <div className="absolute bottom-full left-10 mb-2 w-52 bg-[#202b36] rounded-xl shadow-xl ring-1 ring-white/10 overflow-hidden z-50 animate-pop-in">
              {mentionResults.map((u) => (
                <button key={u.id} onClick={() => insertMention(u.username)} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[#2b5278] transition text-left">
                  <div className="h-7 w-7 rounded-full bg-[#2b5278] flex items-center justify-center text-[11px] font-bold text-white shrink-0">{u.name[0]?.toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="text-[12px] text-white truncate">{u.name}</p>
                    <p className="text-[10px] text-[#6b8299] truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Send actions menu */}
          {sendMenuPos && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeSendMenu} />
              <div
                className="fixed z-50 w-40 rounded-xl bg-[#202b36] p-1.5 shadow-xl ring-1 ring-white/10 animate-pop-in"
                style={{
                  left: Math.max(8, Math.min(sendMenuPos.x - 70, window.innerWidth - 168)),
                  top: Math.max(8, sendMenuPos.y - 84),
                }}
              >
                <button
                  onClick={() => {
                    closeSendMenu();
                    handleSend();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-white transition hover:bg-[#2b5278]"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="#7eb88a"><path d="M2 8l12-5-5 12-2-5-5-2z" stroke="#7eb88a" strokeWidth="1.1" strokeLinejoin="round"/></svg>
                  Send now
                </button>
                <button
                  onClick={() => {
                    closeSendMenu();
                    setActivePanelType("scheduler");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-white transition hover:bg-[#2b5278]"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 1v2M11 1v2M2 6h12M8 9v2M8 9h2"/></svg>
                  Schedule
                </button>
              </div>
            </>
          )}

          <button onClick={() => setShowAttachMenu(!showAttachMenu)} disabled={uploading || !!editingId}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-30 ${showAttachMenu ? "bg-[#202b36] text-white" : "text-[#4a6580] hover:bg-[#1c2733] hover:text-[#6b8299]"}`}>
            {uploading
              ? <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="9" r="7"/><path d="M9 2a7 7 0 010 14" strokeLinecap="round"/></svg>
              : <svg className={`transition-transform duration-200 ${showAttachMenu ? "rotate-45" : ""}`} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 4v12M4 10h12"/></svg>}
          </button>

          <textarea ref={textareaRef} value={text} onChange={handleTextChange} onSelect={handleSelect} onKeyDown={handleKeyDown}
            placeholder={editingId ? "Edit message..." : "Message"} disabled={uploading} rows={1}
            style={{ maxHeight: "100px", fontSize: "var(--font-size-base)" }}
            className={`flex-1 resize-none rounded-xl px-4 py-2.5 text-white placeholder-[#4a6580] outline-none transition focus:ring-1 disabled:opacity-50 ${editingId ? "bg-[#1b3a2d] focus:ring-[#6da879]/30" : "bg-[#1c2733] focus:ring-[#7eb88a]/30"}`}
          />

          <button
            ref={sendButtonRef}
            onClick={() => {
              if (suppressNextSendRef.current) {
                suppressNextSendRef.current = false;
                return;
              }
              handleSend();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              openSendMenu(e.clientX, e.clientY);
            }}
            onTouchStart={handleSendButtonTouchStart}
            onTouchEnd={handleSendButtonTouchEnd}
            onTouchCancel={handleSendButtonTouchEnd}
            disabled={!text.trim() || uploading}
            title={editingId ? "Save" : "Send (right-click/long-press for schedule)"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${editingId ? "bg-[#6da879] hover:bg-[#5c9a6a]" : "bg-[#7eb88a] hover:bg-[#6da879]"}`}>
            {editingId
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#0e1621" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l3 3 7-7"/></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="#0e1621"><path d="M2 8l12-5-5 12-2-5-5-2z" stroke="#0e1621" strokeWidth="1.2" strokeLinejoin="round"/></svg>}
          </button>

          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
        </div>
      </div>
    </div>
  );
}
