import { useState, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { createGroup } from "@/hooks/useRealtimeMessages";
import { makeConversation } from "@/store/chat-store";
import { supabase } from "@/utils/supabase";

interface Props {
  onClose: () => void;
}

export function CreateGroupModal({ onClose }: Props) {
  const [name, setName] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const setActiveChat = useChatStore((s) => s.setActiveChat);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Group name is required."); return; }
    if (!user) return;
    setLoading(true);
    setError("");

    let avatarUrl: string | null = null;
    if (avatarDataUrl?.startsWith("data:")) {
      const blob = await fetch(avatarDataUrl).then(r => r.blob());
      const ext = blob.type.split("/")[1] ?? "jpg";
      const path = `avatars/group-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true });
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = publicUrl;
      }
    }

    const convId = await createGroup(user.id, name.trim(), avatarUrl);
    setLoading(false);
    if (!convId) { setError("Failed to create group. Please try again."); return; }

    const conv = makeConversation(convId, name.trim(), avatarUrl, undefined, 1, true);
    upsertConversation(conv);
    setActiveChat(convId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-[#17212b] shadow-2xl ring-1 ring-white/5 animate-pop-in overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2f3f]">
          <span className="text-sm font-semibold text-white">New Group</span>
          <button onClick={onClose} className="text-[#6b8299] hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative">
              {avatarDataUrl
                ? <img src={avatarDataUrl} alt="Group avatar" className="h-16 w-16 rounded-xl object-cover ring-2 ring-[#7eb88a]/30 group-hover:ring-[#7eb88a] transition" />
                : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#1c2733] text-[#4a6580] ring-2 ring-dashed ring-[#2a3a4a] group-hover:ring-[#7eb88a]/60 transition">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                  </div>}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => setAvatarDataUrl(ev.target?.result as string);
              reader.readAsDataURL(file);
            }} />
            <span className="text-[10px] text-[#6b8299]">Group photo (optional)</span>
          </div>
          <div>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              placeholder="Group name"
              className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#7eb88a]/50"
              autoFocus
            />
            {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-[#6b8299] border border-[#2a3a4a] hover:bg-[#1c2733] transition">Cancel</button>
            <button type="submit" disabled={!name.trim() || loading} className="flex-1 py-2.5 rounded-xl text-sm bg-[#7eb88a] text-[#0e1621] font-semibold hover:bg-[#6da879] transition disabled:opacity-40">
              {loading ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
