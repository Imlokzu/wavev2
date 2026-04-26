-- ============================================================
-- Wave 2.0 — Supabase Schema (Optimized Order)
-- ============================================================

-- Enable pgcrypto
create extension if not exists "pgcrypto";

-- 1. PROFILES
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  name        text not null,
  avatar_url  text,
  created_at  timestamptz default now() not null
);

-- 2. CONVERSATIONS
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  is_group    boolean default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now() not null
);

-- 3. CONVERSATION MEMBERS
create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete cascade,
  joined_at       timestamptz default now() not null,
  primary key (conversation_id, user_id)
);

-- 4. MESSAGES
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,
  content         text not null default '',
  type            text not null default 'text' check (type in ('text','image','gif','file','poll')),
  file_url        text,
  file_name       text,
  file_size       bigint,
  file_mime       text,
  reply_to        uuid references public.messages(id) on delete set null,
  created_at      timestamptz default now() not null,
  edited_at       timestamptz,
  deleted         boolean default false
);

-- 5. REACTIONS
create table if not exists public.reactions (
  message_id  uuid references public.messages(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  emoji       text not null,
  primary key (message_id, user_id, emoji)
);

-- 6. SESSIONS
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  device_name text not null,
  browser     text,
  os          text,
  ip          text,
  fingerprint text,
  last_active timestamptz default now() not null,
  created_at  timestamptz default now() not null
);

-- ────────────────────────────────────────────────────────────
-- ENABLE RLS
-- ────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.sessions enable row level security;

-- ────────────────────────────────────────────────────────────
-- POLICIES
-- ────────────────────────────────────────────────────────────

-- Profiles
create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Conversations
create policy "Members can view their conversations" on public.conversations for select using (
  exists (select 1 from public.conversation_members where conversation_id = conversations.id and user_id = auth.uid())
);

-- Conversation Members
create policy "Members can view other members" on public.conversation_members for select using (
  user_id = auth.uid() or exists (
    select 1 from public.conversation_members cm2
    where cm2.conversation_id = conversation_members.conversation_id and cm2.user_id = auth.uid()
  )
);
create policy "Users can join conversations they created or were invited to"
on public.conversation_members for insert
with check (
  user_id = auth.uid() and (
    exists (select 1 from public.conversations where id = conversation_id and created_by = auth.uid())
    or exists (select 1 from public.conversation_members where conversation_id = conversation_members.conversation_id and user_id = auth.uid())
  )
);

-- Messages
create policy "Members can read messages" on public.messages for select using (
  exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid())
);
create policy "Members can insert messages" on public.messages for insert with check (
  sender_id = auth.uid() and exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid())
);
create policy "Senders can update own messages" on public.messages for update using (sender_id = auth.uid());

-- Reactions
create policy "Anyone in conversation can see reactions" on public.reactions for select using (true);
create policy "Users can add/remove own reactions" on public.reactions for insert with check (user_id = auth.uid());
create policy "Users can delete own reactions" on public.reactions for delete using (user_id = auth.uid());

-- Sessions
create policy "Users can manage own sessions" on public.sessions for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- STORAGE BUCKET
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

create policy "Anyone can view avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Authenticated users can upload avatars" on storage.objects
for insert with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Users can update own avatar" on storage.objects
for update using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);

-- ────────────────────────────────────────────────────────────
-- REALTIME
-- ────────────────────────────────────────────────────────────
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;

-- Feature: Group Chats schema additions
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_invite_code
  ON public.conversations (invite_code)
  WHERE invite_code IS NOT NULL;

ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS group_role TEXT NOT NULL DEFAULT 'member'
  CHECK (group_role IN ('admin', 'member'));

-- Feature: Signal Protocol schema additions
CREATE TABLE IF NOT EXISTS public.signal_keys (
  user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  identity_key    TEXT NOT NULL,
  signed_pre_key  JSONB NOT NULL,
  one_time_keys   JSONB NOT NULL,
  registration_id INTEGER NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.signal_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read any public key bundle"
  ON public.signal_keys FOR SELECT USING (true);

CREATE POLICY "Users can upsert own key bundle"
  ON public.signal_keys FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own key bundle"
  ON public.signal_keys FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS signal_type INTEGER;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_by TEXT[] DEFAULT '{}';
