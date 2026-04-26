import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ScheduledMessage {
  id: string;
  chatId: string;
  content: string;
  sendAt: number; // unix ms
  sent: boolean;
}

interface ScheduledState {
  messages: ScheduledMessage[];
  add: (msg: Omit<ScheduledMessage, "id" | "sent">) => void;
  markSent: (id: string) => void;
  remove: (id: string) => void;
}

export const useScheduledStore = create<ScheduledState>()(
  persist(
    (set) => ({
      messages: [],
      add: (msg) =>
        set((s) => ({
          messages: [...s.messages, { ...msg, id: crypto.randomUUID(), sent: false }],
        })),
      markSent: (id) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, sent: true } : m)),
        })),
      remove: (id) =>
        set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
    }),
    { name: "wave-scheduled" }
  )
);
