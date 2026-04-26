import { useState, useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import { useAuthStore } from "@/store/auth-store";
import { useScheduledStore } from "@/store/scheduled-store";
import { sendSupabaseMessage } from "@/hooks/useRealtimeMessages";

export function ChatPanels() {
  const activePanelType = useChatStore((s) => s.activePanelType);
  const setActivePanelType = useChatStore((s) => s.setActivePanelType);
  const activeChat = useChatStore((s) => s.activeChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const user = useAuthStore((s) => s.user);

  // GIF state
  const [gifSearch, setGifSearch] = useState("");
  const [gifSearchInput, setGifSearchInput] = useState("");
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  // Poll state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Scheduler state
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduledText, setScheduledText] = useState("");
  const addScheduled = useScheduledStore((s) => s.add);
  const scheduledMessages = useScheduledStore((s) => s.messages).filter(
    (m) => m.chatId === activeChat && !m.sent
  );

  useEffect(() => {
    if (activePanelType !== "gif") return;
    setGifLoading(true);
    const endpoint = gifSearch.trim()
      ? `https://api.tenor.com/v1/search?q=${encodeURIComponent(gifSearch)}&key=LIVDSRZULELA&limit=20&contentfilter=medium&media_filter=minimal`
      : `https://api.tenor.com/v1/trending?key=LIVDSRZULELA&limit=20&contentfilter=medium&media_filter=minimal`;
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        const results = (data.results ?? []).map((r: any) => ({
          id: r.id,
          url: r.media[0]?.gif?.url ?? r.media[0]?.tinygif?.url ?? "",
          preview: r.media[0]?.tinygif?.url ?? r.media[0]?.gif?.url ?? "",
        })).filter((r: any) => r.url);
        setGifResults(results);
      })
      .catch(() => setGifResults([]))
      .finally(() => setGifLoading(false));
  }, [gifSearch, activePanelType]);

  const handleSendGif = (url: string) => {
    setActivePanelType(null);
    setGifSearch(""); setGifSearchInput("");
    sendMessage(activeChat, url, "gif", user?.name ?? "You", true);
    if (user) sendSupabaseMessage(activeChat, user.id, { content: url, type: "gif" });
    setReplyingTo(null);
  };

  const handleSendPoll = () => {
    if (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) return;
    const options = pollOptions.filter((o) => o.trim()).map((t) => ({ id: crypto.randomUUID(), text: t.trim(), votes: [] }));
    sendMessage(activeChat, pollQuestion.trim(), "poll", user?.name ?? "You", true, { question: pollQuestion.trim(), options });
    setActivePanelType(null);
    setPollQuestion(""); setPollOptions(["", ""]);
  };

  const handleSchedule = () => {
    if (!scheduledText.trim() || !scheduleDate || !scheduleTime) return;
    const sendAt = new Date(`${scheduleDate}T${scheduleTime}`).getTime();
    if (isNaN(sendAt) || sendAt <= Date.now()) return;
    addScheduled({ chatId: activeChat, content: scheduledText.trim(), sendAt });
    setScheduledText(""); setScheduleDate(""); setScheduleTime("");
    setActivePanelType(null);
  };

  if (!activePanelType) return null;

  return (
    <>
      {activePanelType === "gif" && (
        <div className="bg-[#202b36] border-t border-[#1f2f3f] flex flex-col shrink-0" style={{ height: "280px" }}>
          <div className="flex flex-col p-3 border-b border-[#1f2f3f] gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-sm font-medium">GIFs · Tenor</h3>
              <button onClick={() => { setActivePanelType(null); setGifSearch(""); setGifSearchInput(""); }} className="text-[#6b8299] hover:text-white transition">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4.5 4.5l9 9M13.5 4.5l-9 9" /></svg>
              </button>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b8299]" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" strokeLinecap="round" /></svg>
              <input type="text" value={gifSearchInput} onChange={(e) => { setGifSearchInput(e.target.value); clearTimeout((window as any)._gifTimer); (window as any)._gifTimer = setTimeout(() => setGifSearch(e.target.value), 400); }} placeholder="Search Tenor..." className="w-full bg-[#1c2733] text-[13px] text-white rounded-xl pl-9 pr-3 py-1.5 outline-none focus:ring-1 focus:ring-[#7eb88a]/50" autoFocus />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-2">
            {gifLoading ? (
              <div className="col-span-3 flex items-center justify-center py-6 text-[#6b8299]">
                <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 010 12" strokeLinecap="round" /></svg>
                <span className="text-sm">Loading...</span>
              </div>
            ) : gifResults.length > 0 ? gifResults.map((gif) => (
              <button key={gif.id} onClick={() => handleSendGif(gif.url)} className="rounded-xl overflow-hidden aspect-video bg-[#1c2733] hover:ring-2 hover:ring-[#7eb88a] transition active:scale-95">
                <img src={gif.preview} alt="GIF" className="w-full h-full object-cover" loading="lazy" />
              </button>
            )) : (
              <div className="col-span-3 flex items-center justify-center py-6 text-[#6b8299] text-sm">No GIFs found</div>
            )}
          </div>
        </div>
      )}

      {activePanelType === "poll" && (
        <div className="bg-[#202b36] border-t border-[#1f2f3f] shrink-0">
          <div className="flex items-center justify-between p-4 border-b border-[#1f2f3f]">
            <h3 className="text-white text-sm font-medium">Create a Poll</h3>
            <button onClick={() => setActivePanelType(null)} className="text-[#6b8299] hover:text-white transition"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4.5 4.5l9 9M13.5 4.5l-9 9" /></svg></button>
          </div>
          <div className="p-4 flex flex-col gap-3 max-h-60 overflow-y-auto">
            <input type="text" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Ask a question..." className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#7eb88a]/50" autoFocus />
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={opt} onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} placeholder={`Option ${i + 1}`} className="flex-1 bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#7eb88a]/50" />
                {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))} className="text-red-400 p-2 hover:bg-[#3d2b2f] rounded-xl transition"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 4h10M5 4v10M11 4v10M6 2h4" /></svg></button>}
              </div>
            ))}
            {pollOptions.length < 5 && <button onClick={() => setPollOptions([...pollOptions, ""])} className="text-[#7eb88a] text-xs font-medium hover:underline text-left">+ Add Option</button>}
          </div>
          <div className="p-4 border-t border-[#1f2f3f]">
            <button onClick={handleSendPoll} disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2} className="w-full bg-[#7eb88a] text-[#0e1621] font-semibold py-2.5 rounded-xl disabled:opacity-50 transition hover:bg-[#6da879]">Send Poll</button>
          </div>
        </div>
      )}

      {activePanelType === "scheduler" && (
        <div className="bg-[#202b36] border-t border-[#1f2f3f] shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2f3f]">
            <h3 className="text-white text-sm font-medium flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>
              Schedule Message
            </h3>
            <button onClick={() => setActivePanelType(null)} className="text-[#6b8299] hover:text-white transition"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <textarea value={scheduledText} onChange={(e) => setScheduledText(e.target.value)} placeholder="Type your message..." rows={2} className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#7eb88a]/50 resize-none" autoFocus />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-[#6b8299] mb-1 block uppercase tracking-wide">Date</label>
                <input type="date" value={scheduleDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setScheduleDate(e.target.value)} className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#7eb88a]/50 [color-scheme:dark]" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[#6b8299] mb-1 block uppercase tracking-wide">Time</label>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#7eb88a]/50 [color-scheme:dark]" />
              </div>
            </div>
            <button onClick={handleSchedule} disabled={!scheduledText.trim() || !scheduleDate || !scheduleTime} className="w-full bg-[#7eb88a] text-[#0e1621] font-semibold py-2.5 rounded-xl disabled:opacity-40 transition hover:bg-[#6da879] text-sm">Schedule Send</button>
          </div>
          {scheduledMessages.length > 0 && (
            <div className="border-t border-[#1f2f3f] px-4 py-3">
              <p className="text-[10px] text-[#6b8299] uppercase tracking-wide mb-2">Scheduled</p>
              <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
                {scheduledMessages.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 bg-[#1c2733] rounded-xl px-3 py-2">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#7eb88a" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>
                    <span className="flex-1 text-[12px] text-[#e8e8e8] truncate">{m.content}</span>
                    <span className="text-[10px] text-[#6b8299] shrink-0">{new Date(m.sendAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <button onClick={() => useScheduledStore.getState().remove(m.id)} className="text-red-400 hover:text-red-300 transition shrink-0"><svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
