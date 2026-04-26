import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { useSettings } from "@/store/settings-store";

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const settingsTabs: SettingsTab[] = [
  {
    id: "notifications",
    label: "Notifications",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM9 7.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM9 13.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
      </svg>
    ),
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="12" height="7" rx="1.5" />
        <path d="M6 8V5a3 3 0 016 0v3" />
      </svg>
    ),
  },
  {
    id: "chat",
    label: "Chat Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h12v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
        <path d="M3 5l6 4 6-4" />
      </svg>
    ),
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7" />
        <path d="M9 5v4l3 2" />
      </svg>
    ),
  },
  {
    id: "language",
    label: "Language",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7" />
        <ellipse cx="9" cy="9" rx="3" ry="7" />
      </svg>
    ),
  },
];

function ToggleSetting({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (val: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-[#202b36] transition">
      <span className="text-sm text-[#e8e8e8]">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-[#7eb88a]" : "bg-[#2a3a4a]"}`}
      >
        <span
          className={`absolute h-5 w-5 rounded-full bg-white transition-all ${enabled ? "right-0.5 top-0.5" : "left-0.5 top-0.5"}`}
        />
      </button>
    </div>
  );
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("notifications");
  const user = useAuthStore((s) => s.user);
  const toggleSettings = useChatStore((s) => s.toggleSettings);
  const signOut = useAuthStore((s) => s.signOut);

  const {
    notificationsEnabled,
    soundEnabled,
    vibrationEnabled,
    showLastSeen,
    showReadReceipts,
    theme,
    fontSize,
    setNotifications,
    setSound,
    setVibration,
    setLastSeen,
    setReadReceipts,
    setTheme,
    setFontSize,
  } = useSettings();

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleBack = () => {
    toggleSettings();
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0e1621]">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[#1f2f3f] px-4">
        <button
          onClick={handleBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6b8299] transition hover:bg-[#202b36] hover:text-white"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M15 10H5M5 10l4-4M5 10l4 4" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">Settings</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="hidden w-64 border-r border-[#1f2f3f] bg-[#17212b] sm:flex sm:flex-col">
          {/* Profile card */}
          <div className="flex items-center gap-4 border-b border-[#1f2f3f] px-4 py-5">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Profile" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2e7d5b] text-base font-bold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="text-xs text-[#6b8299]">@{user?.username}</p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex-1 overflow-y-auto py-2">
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  activeTab === tab.id
                    ? "bg-[#2b5278] border-l-2 border-[#7eb88a]"
                    : "hover:bg-[#202b36]"
                }`}
              >
                <span className="text-[#6b8299]">{tab.icon}</span>
                <span className={`text-sm ${activeTab === tab.id ? "font-semibold text-white" : "text-[#6b8299]"}`}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Sign out */}
          <div className="border-t border-[#1f2f3f]">
            <button
              onClick={handleSignOut}
              className="w-full py-3 text-center text-sm text-red-400 transition hover:bg-[#1c2733]"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Mobile tab selector */}
          <div className="flex border-b border-[#1f2f3f] bg-[#17212b] sm:hidden">
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 transition text-xs ${
                  activeTab === tab.id
                    ? "border-b-2 border-[#7eb88a] text-white"
                    : "text-[#6b8299]"
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden xs:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 md:p-6">
            {activeTab === "notifications" && (
              <div className="max-w-2xl rounded-2xl bg-[#17212b] border border-[#1f2f3f]">
                <div className="px-6 py-4 border-b border-[#1f2f3f]">
                  <h2 className="text-lg font-semibold text-white">Notifications</h2>
                </div>
                <div>
                  <ToggleSetting label="Enable Notifications" enabled={notificationsEnabled} onChange={setNotifications} />
                  <ToggleSetting label="Sound Enabled" enabled={soundEnabled} onChange={setSound} />
                  <ToggleSetting label="Vibration Enabled" enabled={vibrationEnabled} onChange={setVibration} />
                </div>
              </div>
            )}

            {activeTab === "privacy" && (
              <div className="max-w-2xl rounded-2xl bg-[#17212b] border border-[#1f2f3f]">
                <div className="px-6 py-4 border-b border-[#1f2f3f]">
                  <h2 className="text-lg font-semibold text-white">Privacy & Security</h2>
                </div>
                <div>
                  <ToggleSetting label="Show Last Seen" enabled={showLastSeen} onChange={setLastSeen} />
                  <ToggleSetting label="Show Read Receipts" enabled={showReadReceipts} onChange={setReadReceipts} />
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="max-w-2xl rounded-2xl bg-[#17212b] border border-[#1f2f3f] px-6 py-4">
                <h2 className="text-lg font-semibold text-white mb-4">Chat Settings</h2>
                <p className="text-sm text-[#6b8299]">Chat settings coming soon</p>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="max-w-2xl rounded-2xl bg-[#17212b] border border-[#1f2f3f] p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Appearance</h3>
                  <div>
                    <p className="mb-3 text-sm font-semibold text-white">Theme</p>
                    <div className="flex gap-2">
                      {["dark", "light"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t as "dark" | "light")}
                          className={`px-4 py-2 rounded-lg transition text-sm ${
                            theme === t
                              ? "bg-[#7eb88a] text-[#0e1621]"
                              : "bg-[#1c2733] text-[#6b8299] hover:text-white"
                          }`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-sm font-semibold text-white">Font Size</p>
                  <div className="flex gap-2">
                    {["compact", "normal", "large"].map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size as "compact" | "normal" | "large")}
                        className={`px-4 py-2 rounded-lg transition text-sm ${
                          fontSize === size
                            ? "bg-[#7eb88a] text-[#0e1621]"
                            : "bg-[#1c2733] text-[#6b8299] hover:text-white"
                        }`}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "language" && (
              <div className="max-w-2xl rounded-2xl bg-[#17212b] border border-[#1f2f3f] px-6 py-4">
                <h2 className="text-lg font-semibold text-white mb-4">Language</h2>
                <p className="text-sm text-[#6b8299]">Language settings coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
