import { useEffect } from "react";
import { useScheduledStore } from "@/store/scheduled-store";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { sendSupabaseMessage } from "@/hooks/useRealtimeMessages";

export function useScheduledMessages() {
  const user = useAuthStore((s) => s.user);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const { messages, markSent } = useScheduledStore();

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      messages
        .filter((m) => !m.sent && m.sendAt <= now)
        .forEach((m) => {
          markSent(m.id);
          sendMessage(m.chatId, m.content, "text", user?.name ?? "You", true);
          if (user) {
            sendSupabaseMessage(m.chatId, user.id, { content: m.content, type: "text" });
          }
        });
    }, 5000); // check every 5s

    return () => clearInterval(interval);
  }, [messages, user?.id]);
}
