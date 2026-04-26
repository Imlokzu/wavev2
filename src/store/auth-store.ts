import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/utils/supabase";
import { sendWelcomeMessage, sendOtpNotification } from "@/utils/wave-bot";
import { registerSession, clearSession } from "@/utils/sessions";
import { validatePassword } from "@/utils/validation";

export type AuthStep = "email" | "otp" | "profile" | "forgot-password" | "reset-password" | "done";
export type AuthMode = "login-password" | "login-otp" | "signup";

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
  authMode: AuthMode;
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
  setAuthMode: (mode: AuthMode) => void;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
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
      authMode: "login-password",
      email: "",
      otpError: null,
      loading: false,

      setUser: (user) => set({ user, authStep: "done" }),
      setAuthStep: (authStep) => set({ authStep }),
      setEmail: (email) => set({ email }),
      setAuthMode: (authMode) => set({ authMode }),
      initialize: () => {
        if (!isSupabaseConfigured) return;
        supabase.auth.getSession().catch(() => {});
      },

      sendCodeViaBot: async () => {
        const { email } = get();
        if (!email) return;
        await supabase.rpc("send_otp_via_bot", { p_email: email.trim() });
      },

      signOut: async () => {
        clearSession();
        if (isSupabaseConfigured) await supabase.auth.signOut();
        set({ user: null, authStep: "email", authMode: "login-password", email: "", otpError: null, loading: false });
      },

      signUp: async (email, password) => {
        if (!email?.trim()) {
          set({ otpError: "Please enter your email address.", authStep: "email" });
          return;
        }
        if (!password) {
          set({ otpError: "Please enter a password.", authStep: "email" });
          return;
        }
        // Validate password strength before hitting Supabase
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          set({ otpError: passwordValidation.error, loading: false });
          return;
        }
        set({ loading: true, otpError: null, email: email.trim(), authMode: "signup" });
        const timeout = setTimeout(() => {
          set({ loading: false, otpError: "Request timed out. Please check your connection and try again." });
        }, 15000);
        try {
          const { error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
          });
          if (signUpError) {
            clearTimeout(timeout);
            set({ otpError: signUpError.message, loading: false });
            return;
          }

          const { error: otpError } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: true },
          });
          clearTimeout(timeout);
          if (otpError) {
            set({ otpError: otpError.message, loading: false });
            return;
          }

          set({ authStep: "otp", loading: false });
          supabase.rpc("send_otp_via_bot", { p_email: email.trim() }).then(() => {}, () => {});
          supabase.rpc("get_user_id_by_email", { p_email: email.trim() }).then(({ data: uid }) => {
            if (uid) sendOtpNotification(uid as string, email.trim()).catch(() => {});
          });
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

      signInWithPassword: async (email, password) => {
        if (!email?.trim() || !password) {
          set({ otpError: "Please enter your email and password.", authStep: "email" });
          return;
        }
        set({ loading: true, otpError: null, email: email.trim(), authMode: "login-password" });
        const timeout = setTimeout(() => {
          set({ loading: false, otpError: "Request timed out. Please check your connection and try again." });
        }, 15000);
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          clearTimeout(timeout);
          if (error) {
            set({ otpError: error.message, loading: false });
            return;
          }

          const userId = data.user?.id;
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
                email: data.user.email ?? email.trim(),
                avatarUrl: profile.avatar_url,
              },
              authStep: "done",
              loading: false,
            });
            import("@/utils/wave-bot").then(({ ensureBotConversation }) => ensureBotConversation(profile.id).catch(() => {}));
          } else {
            set({ authStep: "profile", loading: false });
          }
          registerSession(userId).catch(() => {});
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

      sendOtp: async (email) => {
        if (!email?.trim()) {
          set({ otpError: "Please enter your email address.", authStep: "email" });
          return;
        }
        const currentMode = get().authMode;
        const nextMode = currentMode === "signup" ? "signup" : "login-otp";
        set({ loading: true, otpError: null, email: email.trim(), authMode: nextMode });
        const timeout = setTimeout(() => {
          set({ loading: false, otpError: "Request timed out. Please check your connection and try again." });
        }, 15000);
        try {
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
            supabase.rpc("send_otp_via_bot", { p_email: email.trim() }).then(() => {}, () => {});
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
          const { data: waveValid } = await supabase.rpc("verify_wave_otp", {
            p_email: cleanEmail,
            p_code: cleanToken,
          });

          if (waveValid) {
            const { data, error } = await supabase.auth.verifyOtp({
              email: cleanEmail,
              token: cleanToken,
              type: "email",
            });

            if (error || !data?.user) {
              set({ otpError: error?.message || "Authentication failed. Please try again.", loading: false });
              return;
            }

            if (data.user.email !== cleanEmail) {
              set({ otpError: "Email mismatch. Please try again.", loading: false });
              return;
            }

            const authUser = data.user;

            const { data: profile } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
            if (profile) {
              set({ user: { id: profile.id, name: profile.name, username: profile.username, email: authUser.email ?? cleanEmail, avatarUrl: profile.avatar_url }, authStep: "done", loading: false });
              import("@/utils/wave-bot").then(({ ensureBotConversation }) => ensureBotConversation(profile.id).catch(() => {}));
            } else {
              set({ authStep: "profile", loading: false });
            }
            registerSession(authUser.id).catch(() => {});
            return;
          }

          const { data, error } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanToken,
            type: "email",
          });

          if (error) {
            set({ otpError: error.message || "Invalid or expired code", loading: false });
            return;
          }

          const userId = data.user?.id;
          const userEmail = data.user?.email ?? cleanEmail;

          if (!userId) {
            set({ otpError: "Authentication failed. Please try again.", loading: false });
            return;
          }

          if (data.user?.email !== cleanEmail) {
            set({ otpError: "Email mismatch. Please try again.", loading: false });
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
          registerSession(userId).catch(() => {});
        } catch (err: any) {
          set({ otpError: err.message || "An unexpected error occurred", loading: false });
        }
      },

      sendPasswordReset: async (email) => {
        if (!email?.trim()) {
          set({ otpError: "Please enter your email address." });
          return;
        }
        set({ loading: true, otpError: null });
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin,
          });
          if (error) {
            set({ otpError: error.message, loading: false });
            return;
          }
          set({ loading: false, otpError: null });
        } catch (err: any) {
          set({ otpError: err?.message || "Network error. Please try again.", loading: false });
        }
      },

      updatePassword: async (newPassword) => {
        if (!newPassword) {
          set({ otpError: "Please enter a new password." });
          return;
        }
        set({ loading: true, otpError: null });
        try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) {
            set({ otpError: error.message, loading: false });
            return;
          }

          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) {
            set({ otpError: "Session expired. Please try again.", loading: false, authStep: "email" });
            return;
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();

          if (profile) {
            set({
              user: {
                id: profile.id,
                name: profile.name,
                username: profile.username,
                email: authUser.email ?? get().email,
                avatarUrl: profile.avatar_url,
              },
              authStep: "done",
              loading: false,
            });
            import("@/utils/wave-bot").then(({ ensureBotConversation }) => ensureBotConversation(profile.id).catch(() => {}));
          } else {
            set({ authStep: "profile", loading: false });
          }
          registerSession(authUser.id).catch(() => {});
        } catch (err: any) {
          set({ otpError: err?.message || "An unexpected error occurred", loading: false });
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

        registerSession(authUser.id).catch(() => {});
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
      useAuthStore.setState({ user: null, authStep: "email", authMode: "login-password", email: "", otpError: null, loading: false });
    } else if (event === "PASSWORD_RECOVERY") {
      useAuthStore.setState({ authStep: "reset-password", loading: false, otpError: null });
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
        registerSession(session.user.id).catch(() => {});
      }
    }
  });
}
