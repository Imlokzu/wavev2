import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useAuthStore } from "@/store/auth-store";
import { usePresenceStore } from "@/hooks/usePresence";

interface Profile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  last_seen: string | null;
}

interface Props {
  userId: string;
  onClose: () => void;
  onSendDm: (userId: string, name: string, username: string, avatarUrl: string | null) => void;
}

export function ProfileModal({ userId, onClose, onSendDm }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = useAuthStore((s) => s.user);
  const onlineIds = usePresenceStore((s) => s.onlineIds);
  const isOnline = onlineIds.has(userId);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, name, username, avatar_url, bio, created_at, last_seen")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [userId]);

  const isSelf = currentUser?.id === userId;

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString([], { month: "long", year: "numeric" })
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl bg-[#17212b] shadow-2xl ring-1 ring-white/5 animate-pop-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover / Avatar */}
        <div className="relative h-24 bg-gradient-to-br from-[#1b3a2d] to-[#2b5278]">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/60 hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
          <div className="absolute -bottom-8 left-4">
            <div className="relative h-16 w-16 rounded-full ring-4 ring-[#17212b] overflow-hidden bg-[#2b5278] flex items-center justify-center text-xl font-bold text-white">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                : profile?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            {isOnline && (
              <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-[#7eb88a] border-2 border-[#17212b]" />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="pt-10 px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6b8299" strokeWidth="1.5">
                <circle cx="10" cy="10" r="8"/><path d="M10 2a8 8 0 010 16" strokeLinecap="round"/>
              </svg>
            </div>
          ) : profile ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-white font-semibold text-base">{profile.name}</h2>
                  <p className="text-[#6b8299] text-xs">@{profile.username}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isOnline ? "bg-[#1b3a2d] text-[#7eb88a]" : "bg-[#1c2733] text-[#6b8299]"}`}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>

              {profile.bio && (
                <p className="mt-3 text-[13px] text-[#c8d8e8] leading-relaxed">{profile.bio}</p>
              )}

              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#4a6580]">
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="2" y="2" width="10" height="10" rx="2"/><path d="M5 1v2M9 1v2M2 5h10"/>
                </svg>
                Joined {joined}
              </div>

              {!isSelf && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => { onSendDm(profile.id, profile.name, profile.username, profile.avatar_url); onClose(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-[#7eb88a] text-[#0e1621] font-semibold py-2 rounded-xl text-sm transition hover:bg-[#6da879]"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M14 2L9 14l-2-5-5-2 12-5z"/>
                    </svg>
                    Message
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-[#6b8299] text-sm text-center py-4">User not found</p>
          )}
        </div>
      </div>
    </div>
  );
}
