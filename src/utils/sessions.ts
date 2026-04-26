import { supabase } from "@/utils/supabase";

export interface Session {
  id: string;
  device_name: string;
  browser: string | null;
  os: string | null;
  ip: string | null;
  fingerprint: string | null;
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

async function generateFingerprint(): Promise<string> {
  const components: Record<string, unknown> = {};

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "16px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = "#069";
      ctx.fillText("Wave FP 😀", 2, 15);
      components.canvas = canvas.toDataURL();
    }
  } catch {
    components.canvas = "";
  }

  try {
    const glCanvas = document.createElement("canvas");
    const gl = glCanvas.getContext("webgl") || glCanvas.getContext("experimental-webgl");
    if (gl) {
      const glCtx = gl as WebGLRenderingContext;
      const debugInfo = glCtx.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        components.webgl = glCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
      }
    }
  } catch {
    components.webgl = "";
  }

  components.screen = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  components.colorDepth = screen.colorDepth;
  components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  components.platform = navigator.platform;
  components.userAgent = navigator.userAgent;
  components.language = navigator.language;

  const fontList = [
    "Arial", "Courier New", "Georgia", "Times New Roman", "Verdana",
    "Helvetica", "Impact", "Comic Sans MS", "Trebuchet MS",
  ];
  const testString = "mmmmmmmmmmlli";
  const testSize = "72px";
  const testCanvas = document.createElement("canvas");
  const testCtx = testCanvas.getContext("2d");
  const availableFonts: string[] = [];
  if (testCtx) {
    for (const font of fontList) {
      testCtx.font = `${testSize} ${font}, monospace`;
      const width1 = testCtx.measureText(testString).width;
      testCtx.font = `${testSize} monospace`;
      const width2 = testCtx.measureText(testString).width;
      if (width1 !== width2) availableFonts.push(font);
    }
  }
  components.fonts = availableFonts;

  const data = JSON.stringify(components);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

let currentSessionId: string | null = null;
let registering = false;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let watchersSetup = false;

function setupSessionWatchers(sessionId: string): void {
  if (watchersSetup) return;
  watchersSetup = true;

  supabase
    .channel(`session:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${sessionId}`,
      },
      () => {
        supabase.auth.signOut().then(() => {
          window.location.reload();
        });
      }
    )
    .subscribe();

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (currentSessionId) {
      supabase
        .from("sessions")
        .update({ last_active: new Date().toISOString() })
        .eq("id", currentSessionId);
    }
  }, 2 * 60 * 1000);

}

export function clearSession(): void {
  currentSessionId = null;
  watchersSetup = false;
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export async function registerSession(userId: string): Promise<string | null> {
  if (registering || currentSessionId) return currentSessionId;
  registering = true;

  await supabase
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .lt("last_active", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  let fingerprint: string;
  try {
    fingerprint = await generateFingerprint();
  } catch {
    fingerprint = "";
  }

  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("sessions")
      .update({ last_active: new Date().toISOString() })
      .eq("id", existing.id);

    registering = false;
    if (error) return null;
    currentSessionId = existing.id;
    setupSessionWatchers(existing.id);
    return existing.id;
  }

  const browser = detectBrowser();
  const os = detectOS();
  const device = detectDevice();
  const device_name = `${device} · ${browser} on ${os}`;

  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: userId, device_name, browser, os, fingerprint })
    .select("id")
    .maybeSingle();

  registering = false;
  if (error || !data) return null;
  currentSessionId = data.id;
  setupSessionWatchers(data.id);
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
