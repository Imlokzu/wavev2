# Implementation Plan: Wave 2.0 — Feature Backlog

## Overview

Six features implemented in order: session bug fix, group chats, GIF rendering fix, Signal Protocol encryption, settings panel polish, and responsive design. Each feature builds on the previous. All code is TypeScript/React 19 with Tailwind CSS 4 and Supabase.

## Tasks

- [x] 1. Feature 1 — Session Registration Fix
  - [x] 1.1 Remove `beforeunload` delete from `src/utils/sessions.ts`
    - In `setupSessionWatchers`, delete the `window.addEventListener("beforeunload", ...)` block that calls `supabase.from("sessions").delete()`
    - Session cleanup must only happen on explicit sign-out, not page reload
    - _Requirements: 1.1, 1.5_

  - [x] 1.2 Add `clearSession` export to `src/utils/sessions.ts`
    - Export a new `clearSession(): void` function that sets `currentSessionId = null`, `watchersSetup = false`, and clears `heartbeatInterval`
    - This resets module state so the next login starts fresh
    - _Requirements: 1.7_

  - [x] 1.3 Call `clearSession` in `signOut` inside `src/store/auth-store.ts`
    - Import `clearSession` from `@/utils/sessions`
    - Call `clearSession()` before `supabase.auth.signOut()` in the `signOut` action
    - _Requirements: 1.2, 1.3_

  - [x] 1.4 Write property test for session registration idempotence
    - **Property 2: Session registration idempotence**
    - **Validates: Requirements 1.7**
    - Use `fc.uuid()` for arbitrary `userId`; mock Supabase to return an existing session on the second call; assert same session ID returned and `registering` guard fires
    - Tag: `// Feature: wave-feature-backlog, Property 2: Session registration idempotence`

  - [x] 1.5 Write property test for session deduplication by fingerprint
    - **Property 1: Session deduplication by fingerprint**
    - **Validates: Requirements 1.6**
    - Use `fc.uuid()` for `userId` and `fc.hexaString({ minLength: 64, maxLength: 64 })` for fingerprint; mock Supabase to return an existing row; assert `last_active` updated and no new row inserted
    - Tag: `// Feature: wave-feature-backlog, Property 1: Session deduplication by fingerprint`

- [x] 2. Feature 2 — Group Chats: Schema and Types
  - [x] 2.1 Add schema migrations to `supabase-schema.sql`
    - `ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE`
    - `ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT`
    - `CREATE INDEX IF NOT EXISTS idx_conversations_invite_code ON public.conversations (invite_code) WHERE invite_code IS NOT NULL`
    - `ALTER TABLE public.conversation_members ADD COLUMN IF NOT EXISTS group_role TEXT NOT NULL DEFAULT 'member' CHECK (group_role IN ('admin', 'member'))`
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Extend `Conversation` interface in `src/store/chat-store.ts`
    - Add `isGroup?: boolean`, `inviteCode?: string`, `groupRole?: 'admin' | 'member'` fields to the `Conversation` interface
    - Update `makeConversation` to accept and pass through `isGroup`
    - _Requirements: 2.1, 2.7_

- [x] 3. Feature 2 — Group Chats: Core Actions
  - [x] 3.1 Add `createGroup`, `joinGroupByCode`, `addMemberByUsername`, `searchProfiles` to `src/hooks/useRealtimeMessages.ts`
    - `createGroup(userId, name, avatarUrl)`: inserts a `conversations` row with `is_group=true`, generates a 6-char `[A-Z0-9]` invite code using `crypto.getRandomValues`, inserts a `conversation_members` row for the creator with `group_role='admin'`, returns the new `conversationId`
    - `joinGroupByCode(userId, code)`: queries `conversations` by `invite_code`, inserts a `conversation_members` row; returns `{ conversationId }` on success or `{ error }` on invalid/missing code
    - `addMemberByUsername(conversationId, username, actingUserId)`: looks up profile by username, inserts membership; returns `{ error }` if not found or already a member
    - `searchProfiles(query)`: queries `profiles` with `ilike` on `username`, returns array of `{ id, name, username, avatarUrl }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Update `loadConversations` in `src/hooks/useRealtimeMessages.ts` to handle group conversations
    - For rows where `conv.is_group === true`: fetch `avatar_url` from the `conversations` row, fetch member count via `count: "exact"` on `conversation_members`, fetch the current user's `group_role`, call `makeConversation` with `isGroup: true` and the correct `memberCount`
    - Fetch last message the same way as the DM path
    - _Requirements: 2.7, 2.8_

  - [x] 3.3 Write property test for invite code uniqueness and format
    - **Property 3: Invite code uniqueness and format**
    - **Validates: Requirements 2.2**
    - Use `fc.integer({ min: 2, max: 100 })` for batch size N; generate N codes using the same `generateInviteCode` logic; assert `new Set(codes).size === N` and all match `/^[A-Z0-9]{6}$/`
    - Tag: `// Feature: wave-feature-backlog, Property 3: Invite code uniqueness and format`

  - [x] 3.4 Write property test for join by valid code grants membership
    - **Property 4: Join by valid code grants membership**
    - **Validates: Requirements 2.5**
    - Use `fc.string({ minLength: 6, maxLength: 6 })` filtered to `/^[A-Z0-9]{6}$/` and `fc.uuid()` for userId; mock Supabase to return a matching conversation; assert membership insert is called
    - Tag: `// Feature: wave-feature-backlog, Property 4: Join by valid code grants membership`

  - [x] 3.5 Write property test for invalid invite code does not grant membership
    - **Property 5: Invalid invite code does not grant membership**
    - **Validates: Requirements 2.6**
    - Use `fc.string()` filtered to NOT match `/^[A-Z0-9]{6}$/`, plus valid-format codes not present in mock DB; assert error returned and no insert called
    - Tag: `// Feature: wave-feature-backlog, Property 5: Invalid invite code does not grant membership`

- [x] 4. Feature 2 — Group Chats: UI Components
  - [x] 4.1 Create `src/components/CreateGroupModal.tsx`
    - Inputs: group name (required text field), optional avatar upload (reuse the avatar upload pattern from `settings-panel.tsx`)
    - On submit: calls `createGroup(user.id, name, avatarUrl)`, upserts the new conversation into the chat store, sets it as the active chat, closes the modal
    - Show inline validation error if name is empty
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Create `src/components/InviteModal.tsx`
    - Props: `conversationId: string`, `onClose: () => void`
    - Three tabs: Code (displays 6-char invite code with copy button), Username (debounced `searchProfiles` input → result list with "Add" buttons that call `addMemberByUsername`), Link (displays `https://wave.app/join/{code}` with copy button)
    - Show success/error feedback inline after each add action
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 4.3 Update `src/components/sidebar.tsx` to support group conversations
    - Add a "New Group" button in the sidebar header (next to the existing "New Chat" `+` button)
    - Clicking it opens `CreateGroupModal`
    - In the conversation list, render group conversations with a rounded-square avatar (not circle) and a `{memberCount} members` sub-label
    - Import and use the `isGroup` field from the `Conversation` interface
    - _Requirements: 2.7_

  - [x] 4.4 Update `src/features/chat/pages/chat-page.tsx` to show sender name in group messages
    - In the message bubble render, the existing `{!msg.own && isFirst && <p>{msg.sender}</p>}` already handles this — verify it renders for all group messages, not just the first in a sequence
    - Change the condition from `isFirst` to always show sender name when `chat?.isGroup && !msg.own`
    - _Requirements: 2.9_

  - [x] 4.5 Write property test for group message sender name always present
    - **Property 6: Group message sender name always present**
    - **Validates: Requirements 2.9**
    - Use `fc.string({ minLength: 1 })` for sender name and `fc.string({ minLength: 1 })` for content; render a message bubble with `own: false` in a group context; assert rendered output contains the sender name as a non-empty string
    - Tag: `// Feature: wave-feature-backlog, Property 6: Group message sender name always present`

- [x] 5. Checkpoint — Group chats complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Feature 3 — GIF Rendering Fix
  - [x] 6.1 Fix the GIF/image render block in `src/features/chat/pages/chat-page.tsx`
    - Replace the current `<div className="rounded-xl overflow-hidden mt-1 mb-1 max-w-[200px]">` block with a `block` container
    - The `<img>` gets `className="block max-w-[240px] max-h-[240px] object-contain rounded-xl"`
    - Move the timestamp/tick out of the flex row and into its own `<div className="flex justify-end mt-1">` below the image
    - Remove the duplicate timestamp render in the `(msg.type === "gif" || msg.type === "image" || msg.type === "poll")` block below — the GIF timestamp is now inline below the image
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 6.2 Write property test for GIF messages render in separate block rows
    - **Property 7: GIF messages render in separate block rows**
    - **Validates: Requirements 3.2**
    - Use `fc.array(fc.webUrl(), { minLength: 2, maxLength: 10 })` for GIF URLs; render N GIF messages; assert each image container has `display: block` and no two containers have overlapping vertical bounding boxes
    - Tag: `// Feature: wave-feature-backlog, Property 7: GIF messages render in separate block rows`

- [x] 7. Feature 4 — Security: Password Validation
  - [x] 7.1 Create `src/utils/validation.ts` with `validatePassword`
    - Export `validatePassword(password: string): { valid: boolean; error?: string }`
    - Rules: length ≥ 8, at least one `[A-Z]`, at least one `[0-9]`, at least one `[^A-Za-z0-9]`
    - Return `{ valid: true }` when all rules pass; return `{ valid: false, error: '<specific message>' }` for the first failing rule
    - _Requirements: 4.1, 4.2_

  - [x] 7.2 Integrate `validatePassword` into `signUp` in `src/store/auth-store.ts`
    - Import `validatePassword` from `@/utils/validation`
    - Call it before any Supabase call in `signUp`; if `!result.valid`, call `set({ otpError: result.error, loading: false })` and return early
    - _Requirements: 4.1, 4.2_

  - [x] 7.3 Write property test for password validation correctness
    - **Property 8: Password validation correctness**
    - **Validates: Requirements 4.1, 4.2**
    - Use `fc.string()` for arbitrary strings; assert `validatePassword(s).valid === (s.length >= 8 && /[A-Z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s))`; also assert that when `valid === false`, `error` is a non-empty string
    - Tag: `// Feature: wave-feature-backlog, Property 8: Password validation correctness`

- [x] 8. Feature 4 — Signal Protocol: Schema and Types
  - [x] 8.1 Add `signal_keys` table and `messages` column to `supabase-schema.sql`
    - Add the `signal_keys` table with `user_id`, `identity_key`, `signed_pre_key`, `one_time_keys`, `registration_id`, `updated_at` columns, RLS enabled, and the two policies (public read, own write)
    - `ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS signal_type INTEGER`
    - `ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_by TEXT[] DEFAULT '{}'`
    - _Requirements: 4.3, 4.6_

  - [x] 8.2 Create `src/utils/signal-protocol/types.ts`
    - Define and export: `IdentityKeyPair`, `PreKey`, `SignedPreKey`, `KeyBundle`, `PublicKeyBundle`, `EncryptedMessage` interfaces exactly as specified in the design document
    - _Requirements: 4.3, 4.8_

- [x] 9. Feature 4 — Signal Protocol: Core Modules
  - [x] 9.1 Create `src/utils/signal-protocol/crypto.ts`
    - Implement `generateKeyBundle(registrationId: number): Promise<KeyBundle>` using `crypto.subtle` (ECDH P-256 for identity and pre-keys, HMAC-SHA256 for signed pre-key signature)
    - Implement `serializeBundle(bundle: KeyBundle): string` — converts all `Uint8Array` fields to base64, returns JSON string
    - Implement `deserializeBundle(json: string): KeyBundle` — reverses serialization
    - Implement `serializePublicBundle(bundle: KeyBundle): PublicKeyBundle` — extracts only public fields
    - _Requirements: 4.3, 4.8, 4.9_

  - [x] 9.2 Write property test for key bundle serialization round-trip
    - **Property 10: Key bundle serialization round-trip**
    - **Validates: Requirements 4.8, 4.9**
    - Use `fc.integer({ min: 1, max: 16383 })` for `registrationId`; generate a real `KeyBundle` via `generateKeyBundle`; assert `serializeBundle(deserializeBundle(serializeBundle(b))) === serializeBundle(b)`
    - Tag: `// Feature: wave-feature-backlog, Property 10: Key bundle serialization round-trip`

  - [x] 9.3 Create `src/utils/signal-protocol/KeyStore.ts`
    - Implement `KeyStore` class with `open()`, `storeKeyBundle(userId, bundle)`, `getKeyBundle(userId)`, `storeSession(recipientId, sessionData)`, `getSession(recipientId)`, `clear()` methods
    - All storage uses IndexedDB (`wave-signal-keys` DB, version 1); private key material never leaves IndexedDB
    - _Requirements: 4.6_

  - [x] 9.4 Create `src/utils/signal-protocol/SignalSession.ts`
    - Implement `SignalSession` class with constructor `(keyStore: KeyStore, userId: string)`
    - `ensureKeyBundle()`: generates and stores a key bundle if none exists; uploads the public bundle to `signal_keys` in Supabase
    - `encrypt(plaintext, recipientId)`: fetches recipient's public bundle from `signal_keys`, performs X3DH + Double Ratchet encrypt, returns `EncryptedMessage`
    - `decrypt(msg, senderId)`: retrieves session from KeyStore, performs Double Ratchet decrypt, returns plaintext string
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 9.5 Create `src/utils/signal-protocol/index.ts` (public API)
    - Export `initSignal(userId: string): Promise<void>` — initialises `KeyStore` and `SignalSession`, calls `ensureKeyBundle`
    - Export `encrypt(plaintext: string, recipientId: string): Promise<EncryptedMessage>` — delegates to `SignalSession`
    - Export `decrypt(msg: EncryptedMessage, senderId: string): Promise<string | null>` — wraps `SignalSession.decrypt` in try/catch, returns `null` on failure
    - If `initSignal` fails (IndexedDB unavailable), log a warning and fall back to passthrough mode
    - _Requirements: 4.4, 4.5, 4.7_

  - [x] 9.6 Write property test for Signal Protocol encryption round-trip
    - **Property 9: Signal Protocol encryption round-trip**
    - **Validates: Requirements 4.4, 4.5**
    - Use `fc.string({ minLength: 1 })` for plaintext; set up a mock established Signal session between two parties; assert `decrypt(encrypt(plaintext, recipientId), senderId) === plaintext`
    - Tag: `// Feature: wave-feature-backlog, Property 9: Signal Protocol encryption round-trip`

- [x] 10. Feature 4 — Signal Protocol: Integration
  - [x] 10.1 Integrate Signal encryption into `sendSupabaseMessage` in `src/hooks/useRealtimeMessages.ts`
    - Before the Supabase insert, call `encrypt(msg.content, recipientId)` if Signal is initialised
    - Store `encrypted.ciphertext` as `content` and `encrypted.type` as `signal_type` in the insert payload
    - Fall back to plaintext if Signal is not initialised (demo mode or IndexedDB unavailable)
    - _Requirements: 4.4_

  - [x] 10.2 Integrate Signal decryption into the realtime INSERT handler in `src/hooks/useRealtimeMessages.ts`
    - After receiving a message row, if `row.signal_type` is set, call `decrypt({ ciphertext: row.content, type: row.signal_type }, row.sender_id)`
    - Set `msg.content = plaintext ?? '[Message could not be decrypted]'`
    - _Requirements: 4.5, 4.7_

- [x] 11. Checkpoint — Security features complete
  - Ensure all tests pass, ask the user if questions arise.

- [-] 12. Feature 5 — Settings Panel Polish
  - [x] 12.1 Add `--wave-font-size` CSS custom property and `wave-fade-in` animation to `src/index.css`
    - In `:root`, add `--wave-font-size: 15px;`
    - Add `@keyframes wave-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }` and `.animate-fade-in { animation: wave-fade-in 150ms ease-out; }`
    - _Requirements: 5.6, 5.8_

  - [x] 12.2 Wire notification permission request in `src/features/chat/components/settings-panel.tsx`
    - In `handleToggle`, when `key === 'notificationsEnabled' && value === true && Notification.permission === 'default'`, call `await Notification.requestPermission()` before saving
    - If permission is denied, set the value to `false` before saving
    - _Requirements: 5.1_

  - [x] 12.3 Wire font size CSS variable in `handleFontSize` in `src/features/chat/components/settings-panel.tsx`
    - Map `{ compact: '13px', normal: '15px', large: '17px' }` and call `document.documentElement.style.setProperty('--wave-font-size', sizeMap[size])` before saving
    - Update `src/features/chat/pages/chat-page.tsx` to use `var(--wave-font-size)` instead of `var(--font-size-base)` in the text message `style` prop
    - _Requirements: 5.6_

  - [x] 12.4 Add save feedback state to `src/features/chat/components/settings-panel.tsx`
    - Add `const [savedKey, setSavedKey] = useState<string | null>(null)` state
    - Add `showSaveFeedback(key: string)` helper that sets `savedKey` and clears it after 1500 ms
    - Call `showSaveFeedback(key)` at the end of `handleToggle`, `handleLanguage`, `handleFontSize`, and `handleProfileVisibility`
    - Render a small green checkmark SVG next to each setting row when `savedKey === key`
    - _Requirements: 5.9_

  - [x] 12.5 Add tab transition animation to `src/features/chat/components/settings-panel.tsx`
    - Add `key={tab}` to the tab content `<div>` so React remounts it on tab change
    - Add `className="... animate-fade-in"` to that same div
    - _Requirements: 5.8_

  - [-] 12.6 Write property test for settings boolean toggle persistence
    - **Property 11: Settings boolean toggle persistence**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - Use `fc.boolean()` for value and `fc.constantFrom('notificationsEnabled', 'soundEnabled', 'showReadReceipts', 'showLastSeen')` for key; mock Supabase upsert; call `settings.save(userId, { [key]: value })`; assert store value equals input value
    - Tag: `// Feature: wave-feature-backlog, Property 11: Settings boolean toggle persistence`

  - [ ] 12.7 Write property test for settings enum selection persistence
    - **Property 12: Settings enum selection persistence**
    - **Validates: Requirements 5.5, 5.6, 5.7**
    - Use `fc.constantFrom('compact', 'normal', 'large')` for fontSize; `fc.constantFrom('everyone', 'contacts')` for profileVisibility; `fc.constantFrom(...LANGUAGES)` for language; mock Supabase upsert; assert store value equals selected value after save
    - Tag: `// Feature: wave-feature-backlog, Property 12: Settings enum selection persistence`

- [~] 13. Feature 6 — Responsive Design
  - [ ] 13.1 Add tablet sidebar breakpoint to `src/features/chat/pages/chat-page.tsx`
    - Replace `<div className="hidden w-80 shrink-0 ... lg:block">` with `<div className="hidden md:block md:w-[260px] lg:w-80 shrink-0 ...">`
    - Remove the separate mobile sidebar overlay width (`w-80`) and use `w-[260px]` on mobile too for consistency
    - _Requirements: 6.2, 6.8_

  - [ ] 13.2 Make message input sticky in `src/features/chat/components/message-input.tsx`
    - Wrap the outermost `<div>` with `className` including `sticky bottom-0 z-10 bg-[#17212b]`
    - _Requirements: 6.7_

  - [ ] 13.3 Add `100dvh` height and fluid typography to `src/index.css`
    - Add `html, body, #root { height: 100%; }` and `.h-screen { height: 100dvh; }` for mobile keyboard support
    - Update `--wave-font-size` in `:root` to `clamp(13px, 1vw + 11px, 15px)` for fluid typography
    - _Requirements: 6.7, 6.9_

  - [ ] 13.4 Add long-press touch handlers to message bubbles in `src/features/chat/pages/chat-page.tsx`
    - Add `const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)` at the top of `ChatPage`
    - Implement `handleTouchStart(e, id, own)` — sets a 500 ms timeout that calls `setContextMenu({ id, x: touch.clientX, y: touch.clientY, own })`
    - Implement `handleTouchEnd()` — clears the timer
    - Add `onTouchStart`, `onTouchEnd`, `onTouchMove={handleTouchEnd}` to each message bubble `<div>`
    - _Requirements: 6.6_

  - [ ] 13.5 Verify settings panel and auth flow are usable at 375 px
    - In `src/features/chat/components/settings-panel.tsx`: ensure the tab switcher in the header uses `overflow-x-auto` (already present) and all inputs have `w-full` — add `min-w-0` to any flex children that could overflow
    - In `src/features/auth/components/auth-flow.tsx`: verify all form inputs and buttons have `w-full` and no fixed widths wider than 375 px; add `max-w-sm w-full` to the root container if not already present
    - _Requirements: 6.4, 6.5_

  - [ ] 13.6 Write property test for GIF messages render in separate block rows (responsive)
    - This test is already covered by Property 7 in task 6.2 — no additional test needed here.
    - _Requirements: 6.2_

- [~] 14. Final Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use **fast-check** (`fc`) and run a minimum of 100 iterations each
- The `// Feature: wave-feature-backlog, Property N: ...` tag format is used for all PBT tasks
- Signal Protocol tasks (9.x, 10.x) assume `@signalapp/libsignal-client` is installed; if the WASM bundle is unavailable, a pure-JS fallback using `crypto.subtle` is acceptable for the key generation and serialization layers
- All Supabase schema changes in tasks 2.1 and 8.1 must be applied to the live project via the Supabase dashboard SQL editor or `supabase db push`
