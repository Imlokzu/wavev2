import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/utils/supabase";
import { sendWelcomeMessage, sendOtpNotification } from "@/utils/wave-bot";

export type AuthStep = "email" | "otp" | "profile" | "done";

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  authStep: AuthStep;
  email: string;
  otpError: string | null;
  loading: boolean;
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (token: string) => Promise<void>;
  sendCodeViaBot: () => Promise<void>;
  saveProfile: (name: string, username: string, avatarUrl: string | null) => Promise<void>;
  setAuthStep: (step: AuthStep) => void;
  setEmail: (email: string) => void;
  initialize: () => void;
}

const isSupabaseConfigured =
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== "https://placeholder.supabase.co";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      authStep: "email",
      email: "",
      otpError: null,
      loading: false,

      setUser: (user) => set({ user, authStep: "done" }),
      setAuthStep: (authStep) => set({ authStep }),
      setEmail: (email) => set({ email }),
      initialize: () => {},

      sendCodeViaBot: async () => {
        const { email } = get();
        if (!email) return;
        await supabase.rpc("send_otp_via_bot", { p_email: email.trim() });
      },

      signOut: async () => {
        if (isSupabaseConfigured) await supabase.auth.signOut();
        set({ user: null, authStep: "email", email: "", otpError: null, loading: false });
      },

      sendOtp: async (email) => {
        if (!email?.trim()) {
          set({ otpError: "Please enter your email address.", authStep: "email" });
          return;
        }
        set({ loading: true, otpError: null, email: email.trim() });
        const timeout = setTimeout(() => {
          set({ loading: false, otpError: "Request timed out. Please check your connection and try again." });
        }, 15000);
        try {
          // Send OTP via Supabase (delivers to email)
          const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: true },
          });
          clearTimeout(timeout);
          if (error) {
            const msg = error.message || "";
            if (error.status === 429 || msg.includes("rate") || msg.includes("too many")) {
              set({ otpError: "Too many requests. Please wait a minute before trying again.", loading: false });
            } else {
              set({ otpError: msg || "Failed to send code", loading: false });
            }
          } else {
            set({ authStep: "otp", loading: false });
            // Send the SAME code via bot using pg_net admin API call
            supabase.rpc("send_otp_via_bot", { p_email: email.trim() }).catch(() => {});
            // Also send security notification to existing devices
            supabase.rpc("get_user_id_by_email", { p_email: email.trim() }).then(({ data: uid }) => {
              if (uid) sendOtpNotification(uid as string, email.trim()).catch(() => {});
            });
          }
        } catch (err: any) {
          clearTimeout(timeout);
          const msg = err?.message ?? "";
          if (msg.includes("429") || msg.includes("rate") || msg.toLowerCase().includes("too many")) {
            set({ otpError: "Too many requests. Please wait a minute before trying again.", loading: false });
          } else {
            set({ otpError: "Network error. Please try again.", loading: false });
          }
        }
      },

      verifyOtp: async (token) => {
        const cleanEmail = get().email?.trim();
        const cleanToken = token?.trim();

        if (!cleanEmail) {
          set({ otpError: "Session error. Please enter your email again.", authStep: "email" });
          return;
        }

        set({ loading: true, otpError: null });

        try {
          // First check our custom OTP table
          const { data: waveValid } = await supabase.rpc("verify_wave_otp", {
            p_email: cleanEmail,
            p_code: cleanToken,
          });

          if (waveValid) {
            // Our code matched — now sign in via Supabase using their OTP too
            // Try Supabase verify (may fail if they used our code only)
            const { data, error } = await supabase.auth.verifyOtp({
              email: cleanEmail,
              token: cleanToken,
              type: "email",
            });

            // If Supabase verify fails but our code was valid, try to get existing session
            if (error || !data?.user) {
              // User might already be authenticated or code was Wave-only
              // Fall through to check session
            }

            const { data: { session } } = await supabase.auth.getSession();
            const authUser = session?.user ?? data?.user;

            if (!authUser) {
              set({ otpError: "Authentication failed. Please try again.", loading: false });
              return;
            }

            const { data: profile } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
            if (profile) {
              set({ user: { id: profile.id, name: profile.name, username: profile.username, email: authUser.email ?? cleanEmail, avatarUrl: profile.avatar_url }, authStep: "done", loading: false });
              import("@/utils/wave-bot").then(({ ensureBotConversation }) => ensureBotConversation(profile.id).catch(() => {}));
            } else {
              set({ authStep: "profile", loading: false });
            }
            return;
          }

          // Fall back to Supabase OTP verification
          const { data, error } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanToken,
            type: "email",
          });

          if (error) {
            set({ otpError: error.message || "Invalid or expired code", loading: false });
            return;
          }

          // verifyOtp succeeded — fetch profile directly, don't wait for listener
          const userId = data.user?.id;
          const userEmail = data.user?.email ?? cleanEmail;

          if (!userId) {
            set({ otpError: "Authentication failed. Please try again.", loading: false });
            return;
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          if (profile) {
            set({
              user: {
                id: profile.id,
                name: profile.name,
                username: profile.username,
                email: userEmail,
                avatarUrl: profile.avatar_url,
              },
              authStep: "done",
              loading: false,
            });
            import("@/utils/wave-bot").then(({ ensureBotConversation }) => {
              ensureBotConversation(profile.id).catch(() => {});
            });
          } else {
            set({ authStep: "profile", loading: false });
          }
        } catch (err: any) {
          set({ otpError: err.message || "An unexpected error occurred", loading: false });
        }
      },

      saveProfile: async (name, username, avatarUrl) => {
        set({ loading: true, otpError: null });

        if (!isSupabaseConfigured) {
          const { email } = get();
          set({
            user: { id: crypto.randomUUID(), name, username, email, avatarUrl },
            authStep: "done",
            loading: false,
          });
          return;
        }

        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          set({ otpError: "Session expired. Please sign in again.", loading: false, authStep: "email" });
          return;
        }

        let finalAvatarUrl = avatarUrl;
        if (avatarUrl?.startsWith("data:")) {
          const blob = await fetch(avatarUrl).then((r) => r.blob());
          const ext = blob.type.split("/")[1] ?? "jpg";
          const path = `avatars/${authUser.id}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(path, blob, { upsert: true });
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
            finalAvatarUrl = publicUrl;
          }
        }

        const { error } = await supabase.from("profiles").upsert({
          id: authUser.id,
          name,
          username: username.toLowerCase().replace(/[^a-z0-9_]/g, ""),
          avatar_url: finalAvatarUrl,
        });

        if (error) {
          set({ otpError: error.message, loading: false });
          return;
        }

        set({
          user: {
            id: authUser.id,
            name,
            username,
            email: authUser.email ?? get().email,
            avatarUrl: finalAvatarUrl,
          },
          authStep: "done",
          loading: false,
        });

        // Send welcome message from bot on first profile creation
        sendWelcomeMessage(authUser.id, name).catch(() => {});
      },
    }),
    {
      name: "wave-auth-storage",
      partialize: (state) => ({ user: state.user, authStep: state.authStep, email: state.email }),
    }
  )
);

// Module-level listener — always active, handles session restore on reload
if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    const state = useAuthStore.getState();

    if (event === "SIGNED_OUT") {
      useAuthStore.setState({ user: null, authStep: "email", email: "", otpError: null, loading: false });
    } else if (event === "INITIAL_SESSION" && session?.user && !state.user) {
      // Restore session on page reload
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile) {
        useAuthStore.setState({
          user: {
            id: profile.id,
            name: profile.name,
            username: profile.username,
            email: session.user.email ?? state.email,
            avatarUrl: profile.avatar_url,
          },
          authStep: "done",
          loading: false,
        });
      }
    }
  });
}
