import { useState, useEffect } from "react";
import { addMemberByUsername, searchProfiles } from "@/hooks/useRealtimeMessages";
import { useChatStore } from "@/store/chat-store";

interface Props {
  conversationId: string;
  onClose: () => void;
}

type Tab = "code" | "username" | "link";

export function InviteModal({ conversationId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("code");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; username: string; avatarUrl: string | null }>>([]);
  const [feedback, setFeedback] = useState<{ key: string; msg: string; ok: boolean } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const conv = useChatStore(s => s.conversations.find(c => c.id === conversationId));
  const inviteCode = conv?.inviteCode ?? "";
  const inviteLink = inviteCode ? `${window.location.origin}?invite=${inviteCode}` : "";

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await searchProfiles(query.trim());
      setResults(r);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setFeedback({ key, msg: "Copied!", ok: true });
      setTimeout(() => setFeedback(null), 1500);
    });
  };

  const handleAdd = async (username: string) => {
    setAdding(username);
    const result = await addMemberByUsername(conversationId, username, "");
    setAdding(null);
    if (result.error) {
      setFeedback({ key: username, msg: result.error, ok: false });
    } else {
      setFeedback({ key: username, msg: "Added!", ok: true });
    }
    setTimeout(() => setFeedback(null), 2000);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "code", label: "Code" },
    { id: "username", label: "Username" },
    { id: "link", label: "Link" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-[#17212b] shadow-2xl ring-1 ring-white/5 animate-pop-in overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2f3f]">
          <span className="text-sm font-semibold text-white">Invite to Group</span>
          <button onClick={onClose} className="text-[#6b8299] hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-[#1c2733] mx-4 mt-3 rounded-lg p-0.5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition ${tab === t.id ? "bg-[#2b5278] text-white" : "text-[#6b8299] hover:text-white"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "code" && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-[#6b8299]">Share this code to invite people to the group</p>
              <div className="flex items-center gap-2 bg-[#1c2733] rounded-xl px-4 py-3">
                <span className="flex-1 text-xl font-bold text-white tracking-widest text-center">{inviteCode || "—"}</span>
                <button onClick={() => copyToClipboard(inviteCode, "code")} className="text-[#6b8299] hover:text-[#7eb88a] transition">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="5" y="5" width="9" height="9" rx="1"/><path d="M3 11V3h8"/></svg>
                </button>
              </div>
              {feedback?.key === "code" && <p className={`text-[11px] text-center ${feedback.ok ? "text-[#7eb88a]" : "text-red-400"}`}>{feedback.msg}</p>}
            </div>
          )}

          {tab === "username" && (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by username"
                className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#7eb88a]/50"
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                {results.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#1c2733]">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[#2b5278] flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                      {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" /> : u.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{u.name}</p>
                      <p className="text-[10px] text-[#6b8299]">@{u.username}</p>
                    </div>
                    <button
                      onClick={() => handleAdd(u.username)}
                      disabled={adding === u.username}
                      className="text-[11px] text-[#7eb88a] border border-[#7eb88a]/30 rounded-lg px-2 py-1 hover:bg-[#7eb88a]/10 transition disabled:opacity-40"
                    >
                      {adding === u.username ? "..." : "Add"}
                    </button>
                  </div>
                ))}
                {!query && <p className="text-[11px] text-[#4a6580] text-center py-2">Type a username to search</p>}
              </div>
              {feedback && feedback.key !== "code" && feedback.key !== "link" && (
                <p className={`text-[11px] text-center ${feedback.ok ? "text-[#7eb88a]" : "text-red-400"}`}>{feedback.msg}</p>
              )}
            </div>
          )}

          {tab === "link" && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-[#6b8299]">Share this link to invite people in the app</p>
              <div className="flex items-center gap-2 bg-[#1c2733] rounded-xl px-3 py-2.5">
                <span className="flex-1 text-[11px] text-[#7eb88a] truncate">{inviteLink}</span>
                <button onClick={() => inviteLink && copyToClipboard(inviteLink, "link")} className="shrink-0 text-[#6b8299] hover:text-[#7eb88a] transition">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="5" y="5" width="9" height="9" rx="1"/><path d="M3 11V3h8"/></svg>
                </button>
              </div>
              {feedback?.key === "link" && <p className={`text-[11px] text-center ${feedback.ok ? "text-[#7eb88a]" : "text-red-400"}`}>{feedback.msg}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
