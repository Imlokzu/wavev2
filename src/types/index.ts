// ── Auth ──────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
}

// ── Chat ─────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  time: string;
  own: boolean;
  type: "text" | "image";
}
