import { create } from "zustand";
import { supabase } from "@/utils/supabase";

export interface UserSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
  language: string;
  bio: string;
}

interface SettingsState extends UserSettings {
  loading: boolean;
  loaded: boolean;
  load: (userId: string) => Promise<void>;
  save: (userId: string, patch: Partial<UserSettings>) => Promise<void>;
  set: (patch: Partial<UserSettings>) => void;
}

const defaults: UserSettings = {
  notificationsEnabled: true,
  soundEnabled: true,
  showLastSeen: true,
  showReadReceipts: true,
  language: "English",
  bio: "",
};

export const useSettings = create<SettingsState>((set, get) => ({
  ...defaults,
  loading: false,
  loaded: false,

  set: (patch) => set(patch),

  load: async (userId) => {
    set({ loading: true });
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      set({
        notificationsEnabled: data.notifications_enabled ?? true,
        soundEnabled: data.sound_enabled ?? true,
        showLastSeen: data.show_last_seen ?? true,
        showReadReceipts: data.show_read_receipts ?? true,
        language: data.language ?? "English",
        bio: data.bio ?? "",
        loaded: true,
        loading: false,
      });
    } else {
      // Insert defaults
      await supabase.from("user_settings").insert({ user_id: userId, ...toRow(defaults) });
      set({ ...defaults, loaded: true, loading: false });
    }
  },

  save: async (userId, patch) => {
    set(patch);
    const current = get();
    await supabase.from("user_settings").upsert({
      user_id: userId,
      ...toRow(current),
      updated_at: new Date().toISOString(),
    });
  },
}));

function toRow(s: Partial<UserSettings>) {
  return {
    notifications_enabled: s.notificationsEnabled,
    sound_enabled: s.soundEnabled,
    show_last_seen: s.showLastSeen,
    show_read_receipts: s.showReadReceipts,
    language: s.language,
    bio: s.bio,
  };
}
