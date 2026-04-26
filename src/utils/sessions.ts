import { supabase } from "@/utils/supabase";

export interface Session {
  id: string;
  device_name: string;
  browser: string | null;
  os: string | null;
  ip: string | null;
  last_active: string;
  created_at: string;
  isCurrent?: boolean;
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Browser";
}

function detectOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Unknown OS";
}

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return "Mobile";
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  return "Desktop";
}

let currentSessionId: string | null = null;
let registering = false;

export async function registerSession(userId: string): Promise<string | null> {
  if (registering || currentSessionId) return currentSessionId;
  registering = true;

  // Clean up stale sessions older than 30 days
  await supabase.from("sessions").delete().eq("user_id", userId)
    .lt("last_active", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const browser = detectBrowser();
  const os = detectOS();
  const device = detectDevice();
  const device_name = `${device} · ${browser} on ${os}`;

  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: userId, device_name, browser, os })
    .select("id")
    .maybeSingle();

  registering = false;
  if (error || !data) return null;
  currentSessionId = data.id;

  // Watch for this session being deleted (kicked out)
  supabase.channel(`session:${currentSessionId}`)
    .on("postgres_changes", {
      event: "DELETE",
      schema: "public",
      table: "sessions",
      filter: `id=eq.${currentSessionId}`,
    }, () => {
      // Session was terminated — sign out
      supabase.auth.signOut().then(() => {
        window.location.reload();
      });
    })
    .subscribe();

  // Heartbeat every 2 minutes
  setInterval(() => {
    if (currentSessionId) {
      supabase.from("sessions").update({ last_active: new Date().toISOString() }).eq("id", currentSessionId);
    }
  }, 2 * 60 * 1000);

  // Clean up on tab close
  window.addEventListener("beforeunload", () => {
    if (currentSessionId) {
      supabase.from("sessions").delete().eq("id", currentSessionId);
    }
  });

  return data.id;
}

export async function getSessions(userId: string): Promise<Session[]> {
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("last_active", { ascending: false });

  return (data ?? []).map((s: any) => ({
    ...s,
    isCurrent: s.id === currentSessionId,
  }));
}

export async function terminateSession(sessionId: string): Promise<void> {
  await supabase.from("sessions").delete().eq("id", sessionId);
}

export async function terminateAllOtherSessions(userId: string): Promise<void> {
  if (!currentSessionId) return;
  await supabase.from("sessions").delete().eq("user_id", userId).neq("id", currentSessionId);
}

export function getCurrentSessionId() {
  return currentSessionId;
}
