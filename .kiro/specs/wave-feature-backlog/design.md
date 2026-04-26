# Design Document

## Wave 2.0 — Feature Backlog

## Overview

This document covers the technical design for six backlog features in Wave 2.0: a session-registration bug fix, group chat functionality, a GIF rendering bug fix, Signal Protocol end-to-end encryption, settings panel polish, and full responsive design. The app is a React 19 + TypeScript SPA backed by Supabase, compiled to a single `dist/index.html`.

Each feature is scoped to minimise cross-cutting changes while delivering the full requirement. The design follows the existing architecture: Zustand stores for client state, Supabase for persistence and realtime, and Tailwind CSS 4 for styling.

---

## Architecture

The existing layered architecture is preserved and extended:

```
┌─────────────────────────────────────────────────────────┐
│  React Components (chat-page, sidebar, settings-panel)  │
├─────────────────────────────────────────────────────────┤
│  Zustand Stores  (auth-store, chat-store, settings-store)│
├─────────────────────────────────────────────────────────┤
│  Hooks / Utils   (useRealtimeMessages, sessions, signal) │
├─────────────────────────────────────────────────────────┤
│  Supabase  (PostgreSQL + Realtime + Auth + Storage)      │
│  IndexedDB (Signal Protocol private keys only)           │
└─────────────────────────────────────────────────────────┘
```

New additions per feature:

| Feature | New files / modules |
|---|---|
| Session bug fix | Patch `sessions.ts`, patch `auth-store.ts` |
| Group chats | `CreateGroupModal.tsx`, `InviteModal.tsx`, extend `useRealtimeMessages` |
| GIF fix | Patch `chat-page.tsx` |
| Signal Protocol | `src/utils/signal-protocol/KeyStore.ts`, `SignalSession.ts`, `crypto.ts`, `index.ts` |
| Settings polish | Patch `settings-panel.tsx`, patch `settings-store.ts`, patch `index.css` |
| Responsive design | Patch `chat-page.tsx`, `sidebar.tsx`, `settings-panel.tsx` |

---

## Components and Interfaces

### Feature 1 — Session Registration Fix

**Problem analysis:**

Two bugs exist in the current code:

1. `INITIAL_SESSION` handler in `auth-store.ts` calls `registerSession` unconditionally. Because `registerSession` already guards with `if (registering || currentSessionId) return currentSessionId`, a reload where `currentSessionId` is already set (from a prior call in the same module lifetime) is safe — but on a fresh page load the module resets, so `currentSessionId` is `null` and the guard does not fire. The fix is to check whether the Zustand-persisted `user` is already set before calling `registerSession` in the `INITIAL_SESSION` handler. The existing condition `!state.user` already gates the profile fetch, so `registerSession` should only be called inside that block (which it already is). The real issue is the `beforeunload` handler deleting the session on every page unload, including normal reloads.

2. `setupSessionWatchers` registers a `beforeunload` listener that deletes the session row. This fires on every page reload, not just explicit sign-out. The fix: remove the `beforeunload` delete. Session cleanup should happen only on explicit `signOut`. Stale sessions are already cleaned up by the 30-day TTL purge at the top of `registerSession`.

**Changes to `src/utils/sessions.ts`:**
- Remove the `window.addEventListener("beforeunload", ...)` block that deletes the session.
- No other changes needed — the `registering` and `currentSessionId` guards are already correct.

**Changes to `src/store/auth-store.ts`:**
- The `INITIAL_SESSION` handler already checks `!state.user` before calling `registerSession`. No change needed there.
- `signOut` should call a new exported `clearSession()` helper that sets `currentSessionId = null` and `watchersSetup = false` so the next login starts fresh.

New export from `sessions.ts`:
```typescript
export function clearSession(): void {
  currentSessionId = null;
  watchersSetup = false;
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
```

`signOut` in `auth-store.ts` calls `clearSession()` before `supabase.auth.signOut()`.

---

### Feature 2 — Group Chats

**New components:**

`src/components/CreateGroupModal.tsx`
- Input: group name (required), optional avatar upload
- On submit: calls `createGroup(name, avatarUrl)` from a new `useGroupActions` hook
- Closes on success, opens the new conversation

`src/components/InviteModal.tsx`
- Three tabs: Code, Username, Link
- Code tab: displays the 6-char invite code with a copy button
- Username tab: search input → debounced profile search → result list with "Add" buttons
- Link tab: displays `https://wave.app/join/{code}` with copy button
- Props: `conversationId: string`, `onClose: () => void`

**New hook additions in `src/hooks/useRealtimeMessages.ts`:**

```typescript
export async function createGroup(
  userId: string,
  name: string,
  avatarUrl: string | null
): Promise<string | null>

export async function joinGroupByCode(
  userId: string,
  code: string
): Promise<{ conversationId: string } | { error: string }>

export async function addMemberByUsername(
  conversationId: string,
  username: string,
  actingUserId: string
): Promise<{ error?: string }>

export async function searchProfiles(
  query: string
): Promise<Array<{ id: string; name: string; username: string; avatarUrl: string | null }>>
```

**`loadConversations` update:**

The existing function handles DMs but falls back to `makeConversation(conv.id, conv.name ?? "Group", null)` for groups without fetching member count. The updated version:

```typescript
if (conv.is_group) {
  const { count } = await supabase
    .from("conversation_members")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conv.id);
  const c = makeConversation(conv.id, conv.name ?? "Group", conv.avatar_url, undefined, count ?? 0);
  // fetch last message same as DM path
  return c;
}
```

**Sidebar update (`src/components/sidebar.tsx`):**

Group conversations display:
- Group icon placeholder (initials in a rounded square, not circle)
- Member count badge: `{memberCount} members`
- "New Group" button in the sidebar header

**`makeConversation` update in `chat-store.ts`:**

Add `isGroup?: boolean` to `Conversation` interface and pass it through.

**Invite code generation:**

```typescript
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => chars[b % chars.length])
    .join('');
}
```

Uniqueness is enforced by a `UNIQUE` constraint on `conversations.invite_code`.

---

### Feature 3 — GIF Rendering Fix

**Current bug:** The GIF/image container in `chat-page.tsx` uses `max-w-[200px] max-h-[200px]` but is inside a flex row with the timestamp, causing the timestamp to overlap the image on some layouts.

**Fix in `chat-page.tsx`** — replace the GIF/image render block:

```tsx
{msg.type === "gif" || msg.type === "image" ? (
  <div className="block mt-1 mb-1">
    <img
      src={msg.content}
      alt="Attachment"
      className="block max-w-[240px] max-h-[240px] object-contain rounded-xl"
    />
    <div className="flex justify-end mt-1">
      <span className="flex shrink-0 items-center gap-0.5 text-[9px] text-[#6b8299]/50">
        {msg.time}
        <MessageTick msg={msg} />
      </span>
    </div>
  </div>
) : ...}
```

The timestamp is moved out of the flex row and placed below the image in its own `div`. The outer container is `block` (not `flex`), preventing overlap.

---

### Feature 4 — Signal Protocol Encryption

**Library choice:** Use `@signalapp/libsignal-client` (the official Signal Protocol WASM library). This avoids implementing the Double Ratchet from scratch and is the production-grade solution.

**Module structure:**

```
src/utils/signal-protocol/
  index.ts          — public API: encrypt(), decrypt(), initSignal()
  KeyStore.ts       — IndexedDB wrapper for key persistence
  SignalSession.ts  — session management, wraps libsignal SessionBuilder/SessionCipher
  crypto.ts         — key bundle generation (X3DH), serialization/deserialization
  types.ts          — TypeScript interfaces
```

**`types.ts`:**

```typescript
export interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface PreKey {
  id: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SignedPreKey extends PreKey {
  signature: Uint8Array;
}

export interface KeyBundle {
  identityKey: IdentityKeyPair;
  signedPreKey: SignedPreKey;
  oneTimePreKeys: PreKey[];
  registrationId: number;
}

export interface PublicKeyBundle {
  identityKey: string;       // base64
  signedPreKey: {
    id: number;
    publicKey: string;       // base64
    signature: string;       // base64
  };
  oneTimePreKeys: Array<{ id: number; publicKey: string }>; // base64
  registrationId: number;
}

export interface EncryptedMessage {
  ciphertext: string;        // base64
  type: number;              // 1 = PreKeyWhisperMessage, 2 = WhisperMessage
}
```

**`KeyStore.ts`:**

```typescript
export class KeyStore {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'wave-signal-keys';
  private readonly DB_VERSION = 1;

  async open(): Promise<void>
  async storeKeyBundle(userId: string, bundle: KeyBundle): Promise<void>
  async getKeyBundle(userId: string): Promise<KeyBundle | null>
  async storeSession(recipientId: string, sessionData: Uint8Array): Promise<void>
  async getSession(recipientId: string): Promise<Uint8Array | null>
  async clear(): Promise<void>
}
```

All private key material stays in IndexedDB. Only public key bundles are uploaded to Supabase.

**`crypto.ts`:**

```typescript
export async function generateKeyBundle(registrationId: number): Promise<KeyBundle>
export function serializePublicBundle(bundle: KeyBundle): PublicKeyBundle
export function deserializePublicBundle(raw: PublicKeyBundle): PublicKeyBundle
export function serializeBundle(bundle: KeyBundle): string  // JSON
export function deserializeBundle(json: string): KeyBundle
```

The serializer converts all `Uint8Array` fields to base64 strings. The deserializer reverses this. The round-trip property `serialize(deserialize(serialize(b))) === serialize(b)` must hold for all valid `KeyBundle` values.

**`SignalSession.ts`:**

```typescript
export class SignalSession {
  constructor(private keyStore: KeyStore, private userId: string) {}

  async ensureKeyBundle(): Promise<void>
  async encrypt(plaintext: string, recipientId: string): Promise<EncryptedMessage>
  async decrypt(msg: EncryptedMessage, senderId: string): Promise<string>
}
```

**`index.ts` (public API):**

```typescript
export async function initSignal(userId: string): Promise<void>
export async function encrypt(plaintext: string, recipientId: string): Promise<EncryptedMessage>
export async function decrypt(msg: EncryptedMessage, senderId: string): Promise<string | null>
```

`decrypt` returns `null` on failure (never throws), so the UI can show a placeholder.

**Integration with message send/receive:**

In `sendSupabaseMessage`, before inserting:
```typescript
const encrypted = await encrypt(msg.content, recipientId);
// store encrypted.ciphertext as content, add encrypted.type as metadata
```

In the realtime INSERT handler in `useRealtimeMessages`, after receiving:
```typescript
const plaintext = await decrypt({ ciphertext: row.content, type: row.signal_type }, row.sender_id);
msg.content = plaintext ?? '[Message could not be decrypted]';
```

**Password validation (Requirement 4.1/4.2):**

New pure function in `src/utils/validation.ts`:

```typescript
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters.' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain at least one uppercase letter.' };
  if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must contain at least one digit.' };
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, error: 'Password must contain at least one special character.' };
  return { valid: true };
}
```

Called in `signUp` before any Supabase call.

---

### Feature 5 — Settings Panel Polish

**Notification toggle wiring:**

In `settings-panel.tsx`, the `handleToggle` for `notificationsEnabled` is extended:

```typescript
const handleToggle = async (key: keyof UserSettings, value: boolean) => {
  if (!user) return;
  if (key === 'notificationsEnabled' && value && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  await settings.save(user.id, { [key]: value });
  showSaveFeedback(); // brief green checkmark
};
```

**Font size wiring:**

In `handleFontSize`:
```typescript
const handleFontSize = async (size: UserSettings['fontSize']) => {
  if (!user) return;
  const sizeMap = { compact: '13px', normal: '15px', large: '17px' };
  document.documentElement.style.setProperty('--wave-font-size', sizeMap[size]);
  await settings.save(user.id, { fontSize: size });
  showSaveFeedback();
};
```

In `src/index.css`, add:
```css
:root {
  --wave-font-size: 15px;
}
```

Message text in `chat-page.tsx` already uses `style={{ fontSize: "var(--font-size-base)" }}` — this is renamed to `--wave-font-size` for consistency.

**Save feedback:**

A `savedKey` state tracks which setting was just saved:
```typescript
const [savedKey, setSavedKey] = useState<string | null>(null);
const showSaveFeedback = (key: string) => {
  setSavedKey(key);
  setTimeout(() => setSavedKey(null), 1500);
};
```

Each toggle row renders a small green checkmark SVG when `savedKey === key`.

**Tab transitions:**

In `index.css`:
```css
@keyframes wave-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: wave-fade-in 150ms ease-out;
}
```

The tab content `div` gets `key={tab}` so React remounts it on tab change, triggering the animation.

---

### Feature 6 — Responsive Design

**Breakpoint strategy:**

| Breakpoint | Sidebar | Width |
|---|---|---|
| `< 768px` (mobile) | Overlay, hidden by default | — |
| `768px – 1024px` (tablet) | Fixed, visible | 260px |
| `> 1024px` (desktop) | Fixed, visible | 320px |

The existing code already implements the mobile overlay pattern with `lg:hidden` / `lg:block`. The tablet breakpoint (260px) needs to be added.

**Changes to `chat-page.tsx`:**

```tsx
{/* Desktop sidebar */}
<div className="hidden lg:block w-80 shrink-0 ...">

{/* Tablet sidebar — new */}
<div className="hidden md:block lg:hidden w-[260px] shrink-0 ...">
```

Or more cleanly using a single responsive class:
```tsx
<div className="hidden md:block md:w-[260px] lg:w-80 shrink-0 ...">
```

**Message input sticky positioning:**

In `message-input.tsx`, the outer wrapper gets:
```tsx
<div className="sticky bottom-0 z-10 bg-[#17212b]">
```

This ensures the input stays anchored when the mobile keyboard opens (combined with `height: 100dvh` on the root).

**Long-press support:**

In `chat-page.tsx`, each message bubble gets touch handlers:

```typescript
const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleTouchStart = (e: React.TouchEvent, id: string, own: boolean) => {
  longPressTimer.current = setTimeout(() => {
    const touch = e.touches[0];
    setContextMenu({ id, x: touch.clientX, y: touch.clientY, own });
  }, 500);
};

const handleTouchEnd = () => {
  if (longPressTimer.current) clearTimeout(longPressTimer.current);
};
```

Added to each message `div`:
```tsx
onTouchStart={(e) => handleTouchStart(e, msg.id, msg.own)}
onTouchEnd={handleTouchEnd}
onTouchMove={handleTouchEnd}
```

**Fluid typography:**

In `index.css`:
```css
:root {
  --wave-font-size: clamp(13px, 1vw + 11px, 15px);
}
```

This scales smoothly from 13px at 320px viewport to 15px at 1440px.

**Root height fix for mobile keyboards:**

In `index.css`:
```css
html, body, #root {
  height: 100%;
}
.h-screen {
  height: 100dvh;
}
```

---

## Data Models

### Database Schema Changes

**`conversations` table — add columns:**

```sql
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url  TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_invite_code
  ON public.conversations (invite_code)
  WHERE invite_code IS NOT NULL;
```

**`conversation_members` table — add column:**

```sql
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS group_role TEXT NOT NULL DEFAULT 'member'
  CHECK (group_role IN ('admin', 'member'));
```

**New `signal_keys` table:**

```sql
CREATE TABLE IF NOT EXISTS public.signal_keys (
  user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  identity_key    TEXT NOT NULL,        -- base64 public identity key
  signed_pre_key  JSONB NOT NULL,       -- { id, publicKey, signature }
  one_time_keys   JSONB NOT NULL,       -- [{ id, publicKey }, ...]
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
```

**`messages` table — add column for Signal metadata:**

```sql
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS signal_type  INTEGER,  -- 1=PreKeyWhisperMessage, 2=WhisperMessage
  ADD COLUMN IF NOT EXISTS read_by      TEXT[] DEFAULT '{}';
```

(`read_by` already exists in the app logic but is missing from the schema SQL — add it here.)

### TypeScript Interface Updates

**`src/store/chat-store.ts` — `Conversation`:**

```typescript
export interface Conversation {
  id: string;
  name: string;
  initials: string;
  color: string;
  online: boolean;
  lastMessage: string;
  time: string;
  unread: number;
  avatarUrl?: string | null;
  otherUserId?: string;
  memberCount?: number;
  isBot?: boolean;
  isGroup?: boolean;       // NEW
  inviteCode?: string;     // NEW
  groupRole?: 'admin' | 'member'; // NEW — current user's role
}
```

**`src/utils/signal-protocol/types.ts`** — see Components section above.

**`src/utils/validation.ts`** — new file, see Components section above.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**PBT applicability assessment:** This feature set contains pure functions (password validation, invite code generation, Signal Protocol serialization/encryption, settings persistence logic) that are well-suited to property-based testing. IaC, pure UI layout, and integration concerns are excluded from PBT and covered by example-based or integration tests instead.

**Property reflection:** After reviewing all testable criteria, the following consolidations were made:
- 1.6 and 1.7 both test session deduplication — 1.7 (idempotence) subsumes 1.6 (fingerprint dedup) since idempotence covers all repeated-call scenarios. They are kept separate because they test different mechanisms (fingerprint match vs. in-flight guard).
- 4.4 (encrypt produces different output) and 4.5 (decrypt recovers plaintext) are combined into a single round-trip property — the round-trip implies both.
- 5.1–5.7 (settings persistence) all test the same pattern (toggle/select → store reflects value). They are consolidated into two properties: one for boolean toggles, one for enum selections.

---

### Property 1: Session deduplication by fingerprint

*For any* `userId` and browser fingerprint, if `registerSession` is called when a session row with that `(userId, fingerprint)` pair already exists, the result SHALL be exactly one session row in the database and the `last_active` timestamp SHALL be updated rather than a new row inserted.

**Validates: Requirements 1.6**

---

### Property 2: Session registration idempotence

*For any* `userId`, calling `registerSession` multiple times concurrently or sequentially SHALL result in exactly one session row being created, and all calls SHALL return the same session ID.

**Validates: Requirements 1.7**

---

### Property 3: Invite code uniqueness and format

*For any* batch of N group conversations created, all generated invite codes SHALL be distinct from one another, and each code SHALL match the pattern `[A-Z0-9]{6}`.

**Validates: Requirements 2.2**

---

### Property 4: Join by valid code grants membership

*For any* valid invite code belonging to a group conversation, calling `joinGroupByCode(userId, code)` SHALL result in a `conversation_members` row existing for that `userId` and the corresponding `conversationId`.

**Validates: Requirements 2.5**

---

### Property 5: Invalid invite code does not grant membership

*For any* string that is not a valid invite code (not present in the database, wrong format, or expired), calling `joinGroupByCode(userId, code)` SHALL return a descriptive error and SHALL NOT insert any `conversation_members` row for that `userId`.

**Validates: Requirements 2.6**

---

### Property 6: Group message sender name always present

*For any* incoming message in a group conversation where the sender is not the current user, the rendered message bubble SHALL contain the sender's display name as a non-empty string above the message content.

**Validates: Requirements 2.9**

---

### Property 7: GIF messages render in separate block rows

*For any* sequence of N consecutive GIF messages in the message list, each message SHALL be rendered in its own block-level container, and no two containers SHALL have overlapping vertical positions.

**Validates: Requirements 3.2**

---

### Property 8: Password validation correctness

*For any* string `s`, `validatePassword(s)` SHALL return `{ valid: true }` if and only if `s` has length ≥ 8, contains at least one uppercase letter (`[A-Z]`), at least one digit (`[0-9]`), and at least one special character (`[^A-Za-z0-9]`). For all other strings it SHALL return `{ valid: false }` with a non-empty `error` string.

**Validates: Requirements 4.1, 4.2**

---

### Property 9: Signal Protocol encryption round-trip

*For any* non-empty plaintext string and a valid established Signal session between two parties, `decrypt(encrypt(plaintext, recipientId), senderId)` SHALL return the original plaintext string.

**Validates: Requirements 4.4, 4.5**

---

### Property 10: Key bundle serialization round-trip

*For any* valid `KeyBundle`, let `s1 = serializeBundle(bundle)`, `b2 = deserializeBundle(s1)`, `s2 = serializeBundle(b2)`. Then `s1 === s2`.

**Validates: Requirements 4.8, 4.9**

---

### Property 11: Settings boolean toggle persistence

*For any* boolean value `v` and any boolean setting key `k` in `{ notificationsEnabled, soundEnabled, showReadReceipts, showLastSeen }`, calling `settings.save(userId, { [k]: v })` SHALL result in the store's value for `k` equalling `v` and a Supabase upsert being called with the corresponding column set to `v`.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

---

### Property 12: Settings enum selection persistence

*For any* valid enum value `v` for setting key `k` in `{ language, fontSize, profileVisibility }`, calling `settings.save(userId, { [k]: v })` SHALL result in the store's value for `k` equalling `v`.

**Validates: Requirements 5.5, 5.6, 5.7**

---

## Error Handling

### Session Registration
- If `generateFingerprint()` throws (e.g., canvas blocked), it falls back to `""` — the existing code already handles this. The empty fingerprint still deduplicates correctly.
- If the Supabase insert fails, `registerSession` returns `null` and the app continues without a session record. No crash.

### Group Chats
- `joinGroupByCode` with an invalid code returns `{ error: "Invalid or expired invite code." }`. The UI displays this in a toast/inline error.
- `addMemberByUsername` with an unknown username returns `{ error: "User not found." }`.
- Duplicate membership insert (user already in group) is handled by the `PRIMARY KEY (conversation_id, user_id)` constraint — the function catches the unique violation and returns success (idempotent join).

### Signal Protocol
- `decrypt` catches all exceptions and returns `null`. The caller in `useRealtimeMessages` substitutes `'[Message could not be decrypted]'` as the display content.
- If `initSignal` fails (IndexedDB unavailable), the app falls back to unencrypted mode with a console warning. Messages are still sent/received as plaintext.
- Key bundle fetch failure (recipient has no keys in `signal_keys`) returns an error from `encrypt` — the message send is aborted and the user sees an error toast.

### Settings
- If `Notification.requestPermission()` is denied, the toggle is set to `false` and the store is updated accordingly.
- If the Supabase upsert fails in `settings.save`, the local store state is already updated (optimistic), and the error is logged. No crash.

### GIF Rendering
- If the GIF URL fails to load, the `<img>` element's `onError` handler shows a broken-image placeholder at the same constrained dimensions.

### Responsive Design
- If `100dvh` is not supported (very old browsers), the fallback `100vh` is used via the existing Tailwind `h-screen` class.
- Long-press timer is always cleared on `touchend` and `touchmove` to prevent ghost context menus during scroll.

---

## Testing Strategy

### Unit Tests (example-based)

- `validatePassword`: specific examples covering each failure mode and the happy path.
- `generateInviteCode`: assert format `[A-Z0-9]{6}` and length 6.
- `serializeBundle` / `deserializeBundle`: specific key bundle fixture.
- `loadConversations`: mock Supabase, assert group conversations include `memberCount` and `isGroup: true`.
- GIF rendering: render a GIF message, assert `max-w-[240px]`, `max-h-[240px]`, `object-contain` classes on `<img>`, and timestamp appears after the image in DOM order.
- Session `beforeunload` removal: assert no `beforeunload` listener is registered after `setupSessionWatchers`.
- `signOut` calls `clearSession`: assert `currentSessionId` is null after sign-out.

### Property-Based Tests

Property-based testing is applied using **fast-check** (TypeScript-native, works in Vitest).

Each test runs a minimum of **100 iterations**.

Tag format: `// Feature: wave-feature-backlog, Property {N}: {property_text}`

**Property 1 — Session deduplication by fingerprint**
- Generator: arbitrary `userId` (UUID string), arbitrary fingerprint (hex string)
- Mock Supabase to return an existing session on the second call
- Assert: only one row exists, `last_active` updated

**Property 2 — Session registration idempotence**
- Generator: arbitrary `userId`
- Call `registerSession` twice with the same userId
- Assert: same session ID returned both times, `registering` guard fires on second call

**Property 3 — Invite code uniqueness and format**
- Generator: `fc.integer({ min: 2, max: 100 })` for batch size N
- Generate N codes, assert `new Set(codes).size === N` and all match `/^[A-Z0-9]{6}$/`

**Property 4 — Join by valid code grants membership**
- Generator: arbitrary valid 6-char alphanumeric code, arbitrary userId
- Mock Supabase to return a matching conversation
- Assert: membership row inserted

**Property 5 — Invalid invite code does not grant membership**
- Generator: `fc.string()` filtered to not match `/^[A-Z0-9]{6}$/`, plus valid-format codes not in DB
- Mock Supabase to return no matching conversation
- Assert: error returned, no insert called

**Property 6 — Group message sender name always present**
- Generator: arbitrary sender name (non-empty string), arbitrary message content
- Render message bubble with `own: false` in a group context
- Assert: rendered output contains the sender name

**Property 7 — GIF messages render in separate block rows**
- Generator: `fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 })` for GIF URLs
- Render N GIF messages, assert each is in a `display: block` container with no overlapping `top` positions

**Property 8 — Password validation correctness**
- Generator: `fc.string()` (arbitrary strings)
- Assert: `validatePassword(s).valid === (s.length >= 8 && /[A-Z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s))`

**Property 9 — Signal Protocol encryption round-trip**
- Generator: `fc.string({ minLength: 1 })` for plaintext
- Use a pre-established mock Signal session
- Assert: `decrypt(encrypt(plaintext)) === plaintext`

**Property 10 — Key bundle serialization round-trip**
- Generator: arbitrary `KeyBundle` (generated via `generateKeyBundle` with random `registrationId`)
- Assert: `serializeBundle(deserializeBundle(serializeBundle(b))) === serializeBundle(b)`

**Property 11 — Settings boolean toggle persistence**
- Generator: `fc.boolean()` for value, `fc.constantFrom('notificationsEnabled', 'soundEnabled', 'showReadReceipts', 'showLastSeen')` for key
- Mock Supabase upsert
- Assert: store value equals input value after save

**Property 12 — Settings enum selection persistence**
- Generator: `fc.constantFrom('compact', 'normal', 'large')` for fontSize; similar for language and profileVisibility
- Mock Supabase upsert
- Assert: store value equals selected value after save

### Integration Tests

- Group message delivery: send a message in a group conversation, verify all members receive it via Supabase Realtime (1–2 examples with real Supabase test project).
- Signal key upload: generate key bundle, assert `signal_keys` row exists in Supabase with correct `user_id`.
- Session persistence across reload: register session, simulate page reload (new module instance), assert session row still exists in DB.

### Smoke Tests

- Settings panel renders without horizontal scroll at 375px viewport width.
- Auth flow renders without horizontal scroll at 375px viewport width.
- Message input stays at bottom of viewport when mobile keyboard is open (manual / Playwright).
- Tab transition animation fires within 200ms (CSS class assertion).
