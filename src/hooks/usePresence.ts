import { useEffect } from "react";
import { create } from "zustand";
import { supabase } from "@/utils/supabase";
import { useAuthStore } from "@/store/auth-store";

/* ── Online users store ─────────────────────────────── */
interface PresenceState {
  onlineIds: Set<string>;
  setOnline: (ids: string[]) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineIds: new Set(),
  setOnline: (ids) => set({ onlineIds: new Set(ids) }),
}));

export function isUserOnline(userId: string) {
  return usePresenceStore.getState().onlineIds.has(userId);
}

const isSupabaseConfigured =
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== "https://placeholder.supabase.co";

/* ── Hook — call once at app root ───────────────────── */
export function usePresence() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;

    const channel = supabase.channel("wave:presence", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        const ids = Object.values(state)
          .flat()
          .map((p: any) => p.user_id)
          .filter(Boolean);
        usePresenceStore.getState().setOnline(ids);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        const joined = newPresences.map((p: any) => p.user_id).filter(Boolean);
        const current = [...usePresenceStore.getState().onlineIds, ...joined];
        usePresenceStore.getState().setOnline(current);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const left = new Set(leftPresences.map((p: any) => p.user_id));
        const remaining = [...usePresenceStore.getState().onlineIds].filter((id) => !left.has(id));
        usePresenceStore.getState().setOnline(remaining);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id });
        }
      });

    // Untrack on tab close
    const onUnload = () => channel.untrack();
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.removeEventListener("beforeunload", onUnload);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
