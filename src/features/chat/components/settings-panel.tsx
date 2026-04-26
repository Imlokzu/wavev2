import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { useSettings, type UserSettings } from "@/store/settings-store";
import { useThemeStore } from "@/store/theme-store";
import { supabase } from "@/utils/supabase";
import { cn } from "@/utils/cn";
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
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  type Tab = "general" | "appearance" | "account" | "privacy" | "sessions" | "about";
  const [tab, setTab] = useState<Tab>("general");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? "");
  const [editUsername, setEditUsername] = useState(user?.username ?? "");
  const [editBio, setEditBio] = useState(settings.bio ?? "");
  const [editAvatar, setEditAvatar] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [savedKey, setSavedKey] = useState<string | null>(null);
  const showSaveFeedback = (key: string) => {
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1500);
  };

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
    let finalValue = value;
    if (key === 'notificationsEnabled' && value === true && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'denied') {
        finalValue = false;
      }
    }
    await settings.save(user.id, { [key]: finalValue });
    showSaveFeedback(key as string);
  };

  const handleFontSize = async (size: UserSettings["fontSize"]) => {
    if (!user) return;
    const sizeMap: Record<UserSettings["fontSize"], string> = {
      compact: '13px',
      normal: '15px',
      large: '17px',
    };
    document.documentElement.style.setProperty('--wave-font-size', sizeMap[size]);
    await settings.save(user.id, { fontSize: size });
    showSaveFeedback('fontSize');
  };

  const handleLanguage = async (lang: string) => {
    if (!user) return;
    await settings.save(user.id, { language: lang });
    setActiveMenu(null);
    showSaveFeedback('language');
  };

  const handleProfileVisibility = async (visibility: UserSettings["profileVisibility"]) => {
    if (!user) return;
    await settings.save(user.id, { profileVisibility: visibility });
    showSaveFeedback('profileVisibility');
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    setPasswordError("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword("");
      setTimeout(() => { setShowPasswordModal(false); setPasswordSuccess(false); }, 1500);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      setEmailError("Please enter a valid email.");
      return;
    }
    setEmailError("");
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setEmailError(error.message);
    } else {
      setEmailSuccess(true);
      setNewEmail("");
      setTimeout(() => { setShowEmailModal(false); setEmailSuccess(false); }, 1500);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    if (user) {
      await supabase.from("user_settings").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);
    }
    await signOut();
    setDeleting(false);
    setShowDeleteModal(false);
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
        <div className="flex gap-1 bg-[#1c2733] rounded-lg p-0.5 overflow-x-auto">
          {[
            { id: "general" as Tab, label: "General" },
            { id: "appearance" as Tab, label: "Appearance" },
            { id: "account" as Tab, label: "Account" },
            { id: "privacy" as Tab, label: "Privacy" },
            { id: "sessions" as Tab, label: "Sessions" },
            { id: "about" as Tab, label: "About" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium transition whitespace-nowrap", tab === t.id ? "bg-[#2b5278] text-white" : "text-[#6b8299] hover:text-white")}>
              {t.label}
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

          {/* Tab content */}
          <div key={tab} className="flex-1 overflow-y-auto py-1 relative animate-wave-fade-in">
            {tab === "general" && (
              <div className="flex flex-col">
                {/* Notifications */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M9 16c2 0 3-1 3-3H6c0 2 1 3 3 3zm5.5-4c0-3.5-1.5-4.5-1.5-6a4 4 0 00-8 0c0 1.5-1.5 2.5-1.5 6h11z"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Notifications</span>
                  {savedKey === 'notificationsEnabled' && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#7eb88a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 7l3.5 3.5L12 3"/>
                    </svg>
                  )}
                  <Toggle value={settings.notificationsEnabled} onChange={(v) => handleToggle("notificationsEnabled", v)} />
                </div>

                {/* Sound */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M3 7v4h3l4 4V3L6 7H3zm11-2a6 6 0 010 8"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Sound</span>
                  {savedKey === 'soundEnabled' && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#7eb88a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 7l3.5 3.5L12 3"/>
                    </svg>
                  )}
                  <Toggle value={settings.soundEnabled} onChange={(v) => handleToggle("soundEnabled", v)} />
                </div>

                {/* Read receipts */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 9l4 4L16 4M6 9l4 4"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Read Receipts</span>
                  {savedKey === 'showReadReceipts' && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#7eb88a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 7l3.5 3.5L12 3"/>
                    </svg>
                  )}
                  <Toggle value={settings.showReadReceipts} onChange={(v) => handleToggle("showReadReceipts", v)} />
                </div>

                {/* Last seen */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M9 5v4l3 2"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Show Last Seen</span>
                  {savedKey === 'showLastSeen' && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#7eb88a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 7l3.5 3.5L12 3"/>
                    </svg>
                  )}
                  <Toggle value={settings.showLastSeen} onChange={(v) => handleToggle("showLastSeen", v)} />
                </div>

                {/* Language */}
                <button onClick={() => setActiveMenu("language")} className="flex items-center gap-3 px-4 py-3 hover:bg-[#202b36] transition">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M2 9h14M9 2c-2 3-2 11 0 14"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1">Language</span>
                  <span className="text-xs text-[#6b8299]">{settings.language}</span>
                  <svg className="text-[#2a3a4a]" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3l4 4-4 4"/></svg>
                </button>
              </div>
            )}

            {tab === "appearance" && (
              <div className="flex flex-col gap-4 px-4 py-4">
                <div>
                  <p className="text-xs font-medium text-[#6b8299] uppercase tracking-wide mb-2">Theme</p>
                  <div className="flex gap-2">
                    {(["dark", "light"] as const).map((t) => (
                      <button key={t} onClick={() => setTheme(t)}
                        className={cn("px-4 py-2 rounded-lg transition text-sm", theme === t ? "bg-[#7eb88a] text-[#0e1621] font-semibold" : "bg-[#1c2733] text-[#6b8299] hover:text-white")}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6b8299] uppercase tracking-wide mb-2">Font Size</p>
                  <div className="flex gap-2">
                    {([
                      { value: "compact" as const, label: "Compact" },
                      { value: "normal" as const, label: "Normal" },
                      { value: "large" as const, label: "Large" },
                    ]).map((opt) => (
                      <button key={opt.value} onClick={() => handleFontSize(opt.value)}
                        className={cn("px-4 py-2 rounded-lg transition text-sm", settings.fontSize === opt.value ? "bg-[#7eb88a] text-[#0e1621] font-semibold" : "bg-[#1c2733] text-[#6b8299] hover:text-white")}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "account" && (
              <div className="flex flex-col gap-1 px-4 py-2">
                <div className="px-4 py-3 rounded-xl bg-[#1c2733]">
                  <p className="text-[11px] text-[#6b8299] mb-1">Current Email</p>
                  <p className="text-sm text-white font-medium">{user?.email ?? "—"}</p>
                </div>

                <button onClick={() => { setShowPasswordModal(true); setPasswordError(""); setPasswordSuccess(false); setNewPassword(""); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#202b36] transition rounded-xl mt-2">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="3" y="8" width="12" height="7" rx="1.5"/><path d="M6 8V5a3 3 0 016 0v3"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1 text-left">Change Password</span>
                  <svg className="text-[#2a3a4a]" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3l4 4-4 4"/></svg>
                </button>

                <button onClick={() => { setShowEmailModal(true); setEmailError(""); setEmailSuccess(false); setNewEmail(""); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#202b36] transition rounded-xl">
                  <span className="text-[#6b8299]"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 5h14v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5z"/><path d="M2 5l7 4 7-4"/></svg></span>
                  <span className="text-sm text-[#e8e8e8] flex-1 text-left">Update Email</span>
                  <svg className="text-[#2a3a4a]" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3l4 4-4 4"/></svg>
                </button>

                <button onClick={() => { setShowDeleteModal(true); setDeleteConfirm(""); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition rounded-xl mt-2 border border-red-400/10">
                  <span className="text-red-400"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M3 6h12M5 6v10h8V6M7 3h4"/></svg></span>
                  <span className="text-sm text-red-400 flex-1 text-left">Delete Account</span>
                  <svg className="text-red-400/40" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3l4 4-4 4"/></svg>
                </button>
              </div>
            )}

            {tab === "privacy" && (
              <div className="flex flex-col gap-4 px-4 py-4">
                <div>
                  <p className="text-xs font-medium text-[#6b8299] uppercase tracking-wide mb-2">Who can see my profile</p>
                  <div className="flex flex-col gap-1">
                    {(["everyone", "contacts"] as const).map((opt) => (
                      <button key={opt} onClick={() => handleProfileVisibility(opt)}
                        className={cn("flex items-center justify-between px-4 py-3 rounded-xl transition text-left", settings.profileVisibility === opt ? "bg-[#1c2733] ring-1 ring-[#7eb88a]/30" : "hover:bg-[#202b36]")}>
                        <span className={cn("text-sm", settings.profileVisibility === opt ? "text-[#7eb88a] font-medium" : "text-[#e8e8e8]")}>
                          {opt === "everyone" ? "Everyone" : "Contacts Only"}
                        </span>
                        {settings.profileVisibility === opt && <svg className="text-[#7eb88a]" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8l3 3 7-7"/></svg>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-[#6b8299] uppercase tracking-wide mb-2">Blocked Users</p>
                  <div className="rounded-xl bg-[#1c2733] px-4 py-6 text-center">
                    <p className="text-sm text-[#6b8299]">No blocked users</p>
                    <p className="text-[11px] text-[#4a6580] mt-1">Manage who can message you</p>
                  </div>
                </div>
              </div>
            )}

            {tab === "about" && (
              <div className="flex flex-col items-center px-4 py-8 text-center gap-4">
                <div className="h-16 w-16 bg-[#2e7d5b] rounded-2xl flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 40 40" fill="none"><path d="M10 20c3-5 6 5 10 0s6 5 10 0" stroke="#7eb88a" strokeWidth="2.5" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Wave 2.0</h3>
                  <p className="text-xs text-[#6b8299]">Version 2.0.0</p>
                </div>
                <p className="text-xs text-[#4a6580] max-w-[220px]">Real-time messaging built with React, Supabase, and Tailwind CSS.</p>
                <div className="flex gap-4 mt-2">
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-[11px] text-[#7eb88a] hover:underline">Terms of Service</a>
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-[11px] text-[#7eb88a] hover:underline">Privacy Policy</a>
                </div>
              </div>
            )}

            {/* Active menu overlay (language) */}
            {activeMenu && (
              <div className="absolute inset-0 bg-[#17212b] z-10 flex flex-col animate-pop-in">
                <button onClick={() => setActiveMenu(null)} className="flex items-center gap-2 px-4 py-3 text-[#7eb88a] text-sm font-medium border-b border-[#1f2f3f] hover:bg-[#202b36] transition">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 5l-4 4 4 4"/></svg>
                  Back
                </button>
                <div className="flex-1 overflow-y-auto">
                  {activeMenu === "language" && LANGUAGES.map((lang) => (
                    <button key={lang} onClick={() => handleLanguage(lang)} className="flex w-full items-center justify-between px-4 py-3 hover:bg-[#202b36] transition">
                      <span className={cn("text-sm", settings.language === lang ? "text-[#7eb88a] font-medium" : "text-[#e8e8e8]")}>{lang}</span>
                      {settings.language === lang && <svg className="text-[#7eb88a]" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8l3 3 7-7"/></svg>}
                    </button>
                  ))}
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

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowPasswordModal(false)}>
          <div className="bg-[#202b36] rounded-2xl p-6 w-80 shadow-xl ring-1 ring-white/5 animate-pop-in flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-sm">Change Password</h3>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#7eb88a]/50" />
            {passwordError && <p className="text-[11px] text-red-400">{passwordError}</p>}
            {passwordSuccess && <p className="text-[11px] text-[#7eb88a]">Password updated!</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6b8299] border border-[#2a3a4a] hover:bg-[#1c2733] transition">Cancel</button>
              <button onClick={handleChangePassword} className="flex-1 py-2.5 rounded-xl text-sm bg-[#7eb88a] text-[#0e1621] font-semibold hover:bg-[#6da879] transition">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowEmailModal(false)}>
          <div className="bg-[#202b36] rounded-2xl p-6 w-80 shadow-xl ring-1 ring-white/5 animate-pop-in flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-sm">Update Email</h3>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#7eb88a]/50" />
            {emailError && <p className="text-[11px] text-red-400">{emailError}</p>}
            {emailSuccess && <p className="text-[11px] text-[#7eb88a]">Email updated!</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowEmailModal(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6b8299] border border-[#2a3a4a] hover:bg-[#1c2733] transition">Cancel</button>
              <button onClick={handleUpdateEmail} className="flex-1 py-2.5 rounded-xl text-sm bg-[#7eb88a] text-[#0e1621] font-semibold hover:bg-[#6da879] transition">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-[#202b36] rounded-2xl p-6 w-80 shadow-xl ring-1 ring-white/5 animate-pop-in flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-sm">Delete Account</h3>
            <p className="text-[11px] text-[#6b8299]">This will permanently delete your profile and settings. Type <span className="text-red-400 font-medium">DELETE</span> to confirm.</p>
            <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Type DELETE" className="w-full bg-[#1c2733] text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-red-400/50" />
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6b8299] border border-[#2a3a4a] hover:bg-[#1c2733] transition">Cancel</button>
              <button onClick={handleDeleteAccount} disabled={deleteConfirm !== "DELETE" || deleting} className="flex-1 py-2.5 rounded-xl text-sm bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition disabled:opacity-40">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
