import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AuthFlow } from "@/features/auth/components/auth-flow";
import { ChatPage } from "@/features/chat/pages/chat-page";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useScheduledMessages } from "@/hooks/useScheduledMessages";
import { usePresence } from "@/hooks/usePresence";
import { useSettings } from "@/store/settings-store";

export default function App() {
  const authStep = useAuthStore((s) => s.authStep);
  const user = useAuthStore((s) => s.user);
  const initialize = useAuthStore((s) => s.initialize);
  const loadSettings = useSettings((s) => s.load);
  const fontSize = useSettings((s) => s.fontSize);

  useScheduledMessages();
  usePresence();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load settings when user logs in
  useEffect(() => {
    if (!user) return;
    loadSettings(user.id);
  }, [user?.id]);

  // Sync font-size CSS custom property
  useEffect(() => {
    const sizes = { compact: "13px", normal: "14px", large: "16px" };
    document.documentElement.style.setProperty("--font-size-base", sizes[fontSize]);
  }, [fontSize]);

  if (authStep !== "done" || !user) {
    return <AuthFlow />;
  }

  return (
    <ErrorBoundary>
      <ChatPage />
    </ErrorBoundary>
  );
}
