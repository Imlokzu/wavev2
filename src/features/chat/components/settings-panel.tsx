import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { useSettings } from "@/store/settings-store";
import { supabase } from "@/utils/supabase";
import { getSessions, terminateSession, terminateAllOtherSessions, type Session } from "@/utils/sessions";

const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Arabic", "Chinese", "Russian"];

/* ── Toggle ─────────────────────────────────────────── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? "bg-[#7eb88a]" : "bg-[#2a3a4a]"}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}

/* ── Sessions Tab ────────────────────────────────────── */
function SessionsTab({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await getSessions(userId);
    setSessions(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const handleTerminate = async (id: string) => {
    setTerminating(id);
    await terminateSession(id);
    setSessions((s) => s.filter((x) => x.id !== id));
    setTerminating(null);
  };

  const handleTerminateAll = async () => {
    setTerminating("all");
    await terminateAllOtherSessions(userId);
    setSessions((s) => s.filter((x) => x.isCurrent));
    setTerminating(null);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  if (loading) return (
    <div className="flex justify-center py-8">
      <svg className="animate-spin" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6b8299" strokeWidth="1.5">
        <circle cx="10" cy="10" r="8"/><path d="M10 2a8 8 0 010 16" strokeLinecap="round"/>
      </svg>
    </div>
  );

  const others = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="flex flex-col gap-1 px-2 py-2">
      {sessions.map((s) => (
        <div key={s.id} className={`flex items-start gap-3 rounded-xl px-3 py-3 ${s.isCurrent ? "bg-[#1b3a2d]" : "bg-[#1c2733]"}`}>
          <div className="mt-0.5 shrink-0 text-[#6b8299]">
            {s.device_name?.includes("Mobile") ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="4" y="1" width="8" height="14" rx="2"/><path d="M8 12h.01"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="3" width="14" height="9" rx="1"/><path d="M5 14h6M8 12v2"/></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white truncate">{s.device_name}</p>
            <p className="text-[11px] text-[#6b8299]">
              {s.isCurrent ? <span className="text-[#7eb88a]">This device</span> : timeAgo(s.last_active)}
            </p>
          </div>
          {!s.isCurrent && (
            <button
              onClick={() => handleTerminate(s.id)}
              disabled={terminating === s.id}
              className="shrink-0 text-red-400 hover:text-red-300 transition text-[11px] font-medium"
            >
              {terminating === s.id ? "..." : "End"}
            </button>
          )}
        </div>
      ))}

      {others.length > 0 && (
        <button
          onClick={handleTerminateAll}
          disabled={terminating === "all"}
          className="mt-2 w-full py-2.5 rounded-xl text-sm text-red-400 border border-red-400/20 hover:bg-red-400/10 transition"
        >
          {terminating === "all" ? "Ending..." : "End All Other Sessions"}
        </button>
      )}

      {sessions.length === 0 && (
        <p className="text-center text-[#6b8299] text-sm py-4">No active sessions</p>
      )}
    </div>
  );
}

/* ── Main Settings Panel ─────────────────────────────── */
export function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const signOut = useAuthStore((s) => s.signOut);
  const toggleSettings = useChatStore((s) => s.toggleSettings);
  const settings = useSettings();

  const [tab, setTab] = useState<"settings" | "sessions">("settings");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? "");
  const [editUsername, setEditUsername] = useState(user?.username ?? "");
  const [editBio, setEditBio] = useState(settings.bio ?? "");
  const [editAvatar, setEditAvatar] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleClose = () => { toggleSettings(); onClose?.(); };
  const handleSignOut = () => { signOut(); handleClose(); };

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) return;
    setSaving(true);

    let finalAvatarUrl = editAvatar;
    if (editAvatar?.startsWith("data:")) {
      const blob = await fetch(editAvatar).then((r) => r.blob());
      const ext = blob.type.split("/")[1] ?? "jpg";
      const path = `avatars/${user.id}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        finalAvatarUrl = publicUrl;
      }
    }

    const cleanUsername = editUsername.trim().replace(/[^a-z0-9_]/gi, "").toLowerCase() || user.username;
    await supabase.from("profiles").update({ name: editName.trim(), username: cleanUsername, avatar_url: finalAvatarUrl }).eq("id", user.id);
    await settings.save(user.id, { bio: editBio });

    setUser({ ...user, name: editName.trim(), username: cleanUsername, avatarUrl: finalAvatarUrl });
    setSaving(false);
    setEditingProfile(false);
  };

  const handleToggle = async (key: keyof typeof settings, value: boolean) => {
    if (!user) return;
    await settings.save(user.id, { [key]: value });
  };

  const handleLanguage = async (lang: string) => {
    if (!user) return;
    await settings.save(user.id, { language: lang });
    setActiveMenu(null);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-3 border-b border-[#1f2f3f]">
        <button onClick={handleClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6b8299] transition hover:bg-[#202b36] hover:text-white">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M15 10H5M5 10l4-4M5 10l4 4" /></svg>
        </button>
        <span className="text-sm font-semibold text-white flex-1">Settings</span>
        {/* Tab switcher */}
        <div className="flex gap-1 bg-[#1c2733] rounded-lg p-0.5">
          {(["settings", "sessions"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition capitalize ${tab === t ? "bg-[#2b5278] text-white" : "text-[#6b8299] hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "sessions" ? (
        <div className="flex-1 overflow-y-auto">
          {user && <SessionsTab userId={user.id} />}
        </div>
      ) : (
        <>
          {/* Profile card */}
          <button
            onClick={() => { setEditName(user?.name ?? ""); setEditUsername(user?.username ?? ""); setEditBio(settings.bio ?? ""); setEditAvatar(user?.avatarUrl ?? null); setEditingProfile(true); }}
            className="flex items-center gap-4 border-b border-[#1f2f3f] px-4 py-4 w-full text-left hover:bg-[#202b36] transition group"
          >
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="Profile" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2e7d5b] text-base font-bold text-white">{initials}</div>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="text-xs text-[#6b8299]">@{user?.username}</p>
              {settings.bio && <p className="text-[11px] text-[#4a6580] truncate">{settings.bio}</p>}
            </div>
            <svg className="text-[#4a6580] group-hover:text-[#7eb88a] transition shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 2l1 1-9 9H3v-2L13 2z"/></svg>
          </button>

          {/* Settings list */}
          <div className="flex-1 overflow-y-auto py-1 relative">
            {!activeMenu ? (
              <div className="flex flex-col">
                {/* Notifications */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M9 16c2 0 3-1 3-3H6c0 2 1 3 3 3zm5.5-4c0-3.5-1.5-4.5-1.5-6a4 4 0 00-8 0c0 1.5-1.5 2.5-1.5 6h11z"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Notifications</span>
                  <Toggle value={settings.notificationsEnabled} onChange={(v) => handleToggle("notificationsEnabled", v)} />
                </div>

                {/* Sound */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M3 7v4h3l4 4V3L6 7H3zm11-2a6 6 0 010 8"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Sound</span>
                  <Toggle value={settings.soundEnabled} onChange={(v) => handleToggle("soundEnabled", v)} />
                </div>

                {/* Read receipts */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 9l4 4L16 4M6 9l4 4"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Read Receipts</span>
                  <Toggle value={settings.showReadReceipts} onChange={(v) => handleToggle("showReadReceipts", v)} />
                </div>

                {/* Last seen */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M9 5v4l3 2"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Show Last Seen</span>
                  <Toggle value={settings.showLastSeen} onChange={(v) => handleToggle("showLastSeen", v)} />
                </div>

                {/* Language */}
                <button onClick={() => setActiveMenu("language")} className="flex items-center gap-3 px-4 py-3 hover:bg-[#202b36] transition">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M2 9h14M9 2c-2 3-2 11 0 14"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Language</span>
                  <span className="text-xs text-[#6b8299]">{settings.language}</span>
                  <svg className="text-[#2a3a4a]" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3l4 4-4 4"/></svg>
                </button>

                {/* About */}
                <button onClick={() => setActiveMenu("about")} className="flex items-center gap-3 px-4 py-3 hover:bg-[#202b36] transition">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M9 8v5M9 6h.01"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">About</span>
                  <svg className="text-[#2a3a4a]" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3l4 4-4 4"/></svg>
                </button>
              </div>
            ) : (
              <div className="absolute inset-0 bg-[#17212b] z-10 flex flex-col animate-pop-in">
                <button onClick={() => setActiveMenu(null)} className="flex items-center gap-2 px-4 py-3 text-[#7eb88a] text-sm font-medium border-b border-[#1f2f3f] hover:bg-[#202b36] transition">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 5l-4 4 4 4"/></svg>
                  Back
                </button>
                <div className="flex-1 overflow-y-auto">
                  {activeMenu === "language" && LANGUAGES.map((lang) => (
                    <button key={lang} onClick={() => handleLanguage(lang)} className="flex w-full items-center justify-between px-4 py-3 hover:bg-[#202b36] transition">
                      <span className={`text-sm ${settings.language === lang ? "text-[#7eb88a] font-medium" : "text-[#e8e8e8]"}`}>{lang}</span>
                      {settings.language === lang && <svg className="text-[#7eb88a]" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8l3 3 7-7"/></svg>}
                    </button>
                  ))}
                  {activeMenu === "about" && (
                    <div className="flex flex-col items-center px-4 py-8 text-center gap-4">
                      <div className="h-16 w-16 bg-[#2e7d5b] rounded-2xl flex items-center justify-center">
                        <svg width="32" height="32" viewBox="0 0 40 40" fill="none"><path d="M10 20c3-5 6 5 10 0s6 5 10 0" stroke="#7eb88a" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Wave 2.0</h3>
                        <p className="text-xs text-[#6b8299]">Version 2.0.0</p>
                      </div>
                      <p className="text-xs text-[#4a6580] max-w-[200px]">Real-time messaging built with React, Supabase, and Tailwind CSS.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#1f2f3f]">
            <button onClick={handleSignOut} className="w-full py-3 text-center text-sm text-red-400 hover:bg-[#1c2733] transition">Sign Out</button>
            <p className="pb-3 text-center text-[10px] text-[#4a6580]">Wave 2.0</p>
          </div>
        </>
      )}

      {/* Profile Edit Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingProfile(false)}>
          <div className="bg-[#202b36] rounded-2xl p-6 w-80 shadow-xl ring-1 ring-white/5 animate-pop-in flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-sm">Edit Profile</h3>
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={() => avatarInputRef.current?.click()} className="group relative">
                {editAvatar
                  ? <img src={editAvatar} alt="Avatar" className="h-20 w-20 rounded-full object-cover ring-2 ring-[#7eb88a]/30 group-hover:ring-[#7eb88a] transition" />
                  : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#2e7d5b] text-xl font-bold text-white ring-2 ring-dashed ring-[#2a3a4a] group-hover:ring-[#7eb88a]/60 transition">{(editName[0] ?? "?").toUpperCase()}</div>}
                <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#2e7d5b] text-white shadow-lg">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s1-3 4-3l2-3h2l2 3c3 0 4 3 4 3H1z"/><circle cx="8" cy="7" r="2"/></svg>
                </span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => setEditAvatar(ev.target?.result as string);
                reader.readAsDataURL(file);
              }} />
              {editAvatar && <button onClick={() => setEditAvatar(null)} className="text-[10px] text-red-400 hover:underline">Remove photo</button>}
            </div>
            <div>
              <label className="text-[11px] text-[#6b8299] mb-1 block">Display Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#7eb88a]/50" />
            </div>
            <div>
              <label className="text-[11px] text-[#6b8299] mb-1 block">Username</label>
              <div className="flex items-center bg-[#1c2733] rounded-xl px-3 py-2.5">
                <span className="text-[#4a6580] text-sm mr-1">@</span>
                <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())} placeholder="username" className="flex-1 bg-transparent text-sm text-white outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[#6b8299] mb-1 block">Bio</label>
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Tell people about yourself..." rows={2} maxLength={160} className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#7eb88a]/50 resize-none" />
              <p className="text-[10px] text-[#4a6580] text-right">{editBio.length}/160</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingProfile(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6b8299] border border-[#2a3a4a] hover:bg-[#1c2733] transition">Cancel</button>
              <button onClick={handleSaveProfile} disabled={!editName.trim() || saving} className="flex-1 py-2.5 rounded-xl text-sm bg-[#7eb88a] text-[#0e1621] font-semibold hover:bg-[#6da879] transition disabled:opacity-40">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
