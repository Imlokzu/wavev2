import { supabase } from "@/utils/supabase";

const BOT_ID = "00000000-0000-0000-0000-000000000001";

export async function ensureBotConversation(userId: string): Promise<void> {
  await supabase.rpc("ensure_bot_conversation", { p_user_id: userId });
}

export async function sendBotMessage(userId: string, content: string): Promise<void> {
  const { error } = await supabase.rpc("send_bot_message", {
    p_user_id: userId,
    p_content: content,
  });
  if (error) console.error("[Wave Bot]", error.message);
}

export async function sendBotActionMessage(
  userId: string,
  content: string,
  actions: { id: string; label: string; style: "primary" | "danger" | "default" }[]
): Promise<void> {
  const { error } = await supabase.rpc("send_bot_action_message", {
    p_user_id: userId,
    p_content: content,
    p_actions: actions,
  });
  if (error) console.error("[Wave Bot Action]", error.message);
}

export async function sendWelcomeMessage(userId: string, name: string): Promise<void> {
  await sendBotMessage(
    userId,
    `👋 Welcome to Wave, **${name}**!\n\nI'm the official Wave bot. I'll send you security notifications here — like login alerts and verification reminders.\n\nEnjoy messaging! 🌊`
  );
}

export async function sendOtpNotification(userId: string, email: string): Promise<void> {
  let location = "Unknown location";
  let ip = "Unknown";
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    ip = data.ip ?? "Unknown";
    location = [data.city, data.country_name].filter(Boolean).join(", ") || "Unknown location";
  } catch {}

  const browser = detectBrowser();
  const os = detectOS();
  const time = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

  await sendBotActionMessage(
    userId,
    `🔐 New sign-in attempt\n\n📧 ${email}\n🌍 ${location}\n🖥️ ${browser} on ${os}\n🕐 ${time}\n🌐 IP: ${ip}`,
    [
      { id: "allow", label: "✅ Yes, this is me", style: "primary" },
      { id: "block", label: "🚫 Not me — secure account", style: "danger" },
    ]
  );
}

export async function sendCodeReminderViaBot(userId: string, email: string): Promise<void> {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  await sendBotMessage(
    userId,
    `🔑 **Login code sent**\n\nA 6-digit verification code was just sent to **${email}** at ${time}.\n\nCheck your email inbox (and spam folder).\n\n_The code expires in 10 minutes._`
  );
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
