import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AuthFlow } from "@/features/auth/components/auth-flow";
import { ChatPage } from "@/features/chat/pages/chat-page";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useScheduledMessages } from "@/hooks/useScheduledMessages";
import { usePresence } from "@/hooks/usePresence";
import { useSettings } from "@/store/settings-store";
import { registerSession } from "@/utils/sessions";

export default function App() {
  const authStep = useAuthStore((s) => s.authStep);
  const user = useAuthStore((s) => s.user);
  const initialize = useAuthStore((s) => s.initialize);
  const loadSettings = useSettings((s) => s.load);

  useScheduledMessages();
  usePresence();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load settings + register session when user logs in
  useEffect(() => {
    if (!user) return;
    loadSettings(user.id);
    registerSession(user.id);
  }, [user?.id]);

  if (authStep !== "done" || !user) {
    return <AuthFlow />;
  }

  return (
    <ErrorBoundary>
      <ChatPage />
    </ErrorBoundary>
  );
}
