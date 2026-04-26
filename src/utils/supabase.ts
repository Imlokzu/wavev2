import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Wave] Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to enable real auth & messaging."
  );
}

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder",
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    }
  }
);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      conversations: {
        Row: {
          id: string;
          name: string | null;
          is_group: boolean;
          created_at: string;
          created_by: string;
        };
        Insert: Omit<Database["public"]["Tables"]["conversations"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["conversations"]["Row"]>;
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["conversation_members"]["Row"], "joined_at">;
        Update: never;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          type: "text" | "image" | "gif" | "file" | "poll";
          file_url: string | null;
          file_name: string | null;
          file_size: number | null;
          file_mime: string | null;
          reply_to: string | null;
          created_at: string;
          edited_at: string | null;
          deleted: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "created_at" | "edited_at" | "deleted">;
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
      };
    };
  };
};
