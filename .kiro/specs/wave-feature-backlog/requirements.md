# Requirements Document

## Introduction

This document covers six backlog features for Wave 2.0, a real-time messaging web app built with React 19, TypeScript, Tailwind CSS 4, Zustand, and Supabase. The features address a session-registration bug, group chat functionality, a GIF rendering bug, end-to-end encryption via the Signal Protocol, settings panel polish, and full responsive design across all screen sizes.

---

## Glossary

- **Auth_Store**: The Zustand store in `src/store/auth-store.ts` that manages authentication state and calls `registerSession`.
- **Session_Manager**: The module in `src/utils/sessions.ts` responsible for browser fingerprinting and Supabase session CRUD.
- **Chat_Store**: The Zustand store in `src/store/chat-store.ts` that holds conversation and message state.
- **Settings_Store**: The Zustand store in `src/store/settings-store.ts` that persists user preferences to Supabase.
- **Settings_Panel**: The React component in `src/features/chat/components/settings-panel.tsx`.
- **Chat_Page**: The React component in `src/features/chat/pages/chat-page.tsx` that renders the message list.
- **Signal_Protocol**: The end-to-end encryption protocol implemented in `src/utils/signal-protocol/`.
- **Group_Conversation**: A `conversations` row where `is_group = true`, with multiple `conversation_members` rows.
- **Invite_Code**: A short alphanumeric token stored on a `Group_Conversation` that allows users to join without a direct invitation.
- **Fingerprint**: A deterministic browser-derived hash computed by `Session_Manager` to identify a device across page reloads.
- **Authenticated_User**: A user who has completed the full authentication flow (OTP verified or password verified) and has a valid Supabase session.
- **Supabase**: The backend-as-a-service providing the PostgreSQL database, Realtime, Auth, and Storage used by Wave.

---

## Requirements

### Requirement 1: Session Registration Timing

**User Story:** As a security-conscious user, I want sessions to be registered only after I have fully authenticated, so that incomplete sign-in attempts do not create orphaned session records.

#### Acceptance Criteria

1. WHEN a user submits their email address but has not yet verified an OTP or password, THE Auth_Store SHALL NOT call `registerSession`.
2. WHEN a user successfully verifies an OTP code, THE Auth_Store SHALL call `registerSession` exactly once with the authenticated user's ID.
3. WHEN a user successfully signs in with a password, THE Auth_Store SHALL call `registerSession` exactly once with the authenticated user's ID.
4. WHEN a user completes the profile-creation step after OTP verification, THE Auth_Store SHALL call `registerSession` exactly once with the authenticated user's ID.
5. WHEN a page reload occurs and a valid Supabase session is restored via `INITIAL_SESSION`, THE Auth_Store SHALL call `registerSession` exactly once with the restored user's ID.
6. WHEN `registerSession` is called and a session with the same `user_id` and `Fingerprint` already exists in the `sessions` table, THE Session_Manager SHALL update the `last_active` timestamp of the existing session instead of inserting a new row.
7. WHEN `registerSession` is called while a registration is already in progress (`registering = true`) or a `currentSessionId` is already set, THE Session_Manager SHALL return the existing session ID without creating a duplicate.

---

### Requirement 2: Group Chats

**User Story:** As a user, I want to create group conversations and invite others to join, so that I can communicate with multiple people at once.

#### Acceptance Criteria

1. WHEN an Authenticated_User creates a group, THE Chat_Store SHALL insert a new `conversations` row with `is_group = true` and `created_by` set to the user's ID, and insert a `conversation_members` row for the creator.
2. WHEN a Group_Conversation is created, THE Chat_Store SHALL generate a unique Invite_Code and store it on the conversation record.
3. WHEN an Authenticated_User searches for another user by username, THE Chat_Store SHALL query the `profiles` table and return matching results within 500 ms.
4. WHEN an Authenticated_User adds a member by username, THE Chat_Store SHALL insert a `conversation_members` row for the target user and the Group_Conversation.
5. WHEN an Authenticated_User shares an Invite_Code link and a second Authenticated_User opens that link, THE Chat_Store SHALL add the second user to the Group_Conversation by inserting a `conversation_members` row.
6. IF an Invite_Code is invalid or expired, THEN THE Chat_Store SHALL return a descriptive error message and SHALL NOT add the user to any conversation.
7. WHEN a Group_Conversation is loaded, THE Chat_Page SHALL display the group name, member count, and a group avatar placeholder.
8. WHEN a message is sent in a Group_Conversation, THE Chat_Store SHALL persist the message with the correct `conversation_id` and `sender_id`, and all members SHALL receive the message via Supabase Realtime.
9. WHILE a user is a member of a Group_Conversation, THE Chat_Page SHALL display the sender's display name above each incoming message bubble.

---

### Requirement 3: GIF Rendering Fix

**User Story:** As a user, I want GIFs in the chat to display correctly without overlapping other messages, so that the conversation is readable.

#### Acceptance Criteria

1. WHEN a GIF message is rendered in the message list, THE Chat_Page SHALL display the GIF image within a block-level container that does not overlap adjacent message bubbles.
2. WHEN multiple GIF messages appear consecutively, THE Chat_Page SHALL render each GIF in its own vertically stacked row with no z-index or position overlap.
3. WHEN a GIF message is rendered, THE Chat_Page SHALL constrain the image to a maximum width of 240 px and a maximum height of 240 px while preserving the aspect ratio.
4. WHEN a GIF message is rendered alongside a timestamp and read-receipt tick, THE Chat_Page SHALL display the timestamp and tick below the image, not overlapping it.

---

### Requirement 4: Security and Signal Protocol Encryption

**User Story:** As a privacy-conscious user, I want my messages to be end-to-end encrypted using the Signal Protocol, so that only the intended recipients can read them.

#### Acceptance Criteria

1. THE Auth_Store SHALL require a password of at least 8 characters containing at least one uppercase letter, one digit, and one special character during account creation.
2. IF a password submitted during sign-up does not meet the strength requirements, THEN THE Auth_Store SHALL reject the submission and return a descriptive validation error before contacting Supabase.
3. WHEN an Authenticated_User sends their first message in a conversation, THE Signal_Protocol SHALL generate an X3DH key bundle (identity key, signed pre-key, one-time pre-keys) for that user if one does not already exist.
4. WHEN an Authenticated_User sends a message, THE Signal_Protocol SHALL encrypt the plaintext using the Double Ratchet algorithm before the message content is written to Supabase.
5. WHEN an Authenticated_User receives a message, THE Signal_Protocol SHALL decrypt the ciphertext using the Double Ratchet algorithm before the message content is displayed in the Chat_Page.
6. THE Signal_Protocol SHALL store private keys exclusively in the browser's IndexedDB and SHALL NOT transmit private keys to Supabase or any external service.
7. IF decryption of a received message fails, THEN THE Chat_Page SHALL display a placeholder indicating the message could not be decrypted, and SHALL NOT crash or expose raw ciphertext.
8. THE Signal_Protocol SHALL implement a pretty-printer that serialises a key bundle to a JSON string and a parser that deserialises a JSON string back to a key bundle.
9. FOR ALL valid key bundles, serialising then deserialising then serialising SHALL produce an identical JSON string (round-trip property).

---

### Requirement 5: Settings Panel Polish

**User Story:** As a user, I want all settings to work correctly and the settings panel to feel smooth and well-designed, so that I can customise my experience confidently.

#### Acceptance Criteria

1. WHEN a user toggles the Notifications setting, THE Settings_Store SHALL persist the new value to the `user_settings` table and THE browser notification permission request SHALL be triggered if notifications are enabled for the first time.
2. WHEN a user toggles the Sound setting, THE Settings_Store SHALL persist the new value and THE Chat_Page SHALL play or suppress incoming-message audio accordingly on the next received message.
3. WHEN a user toggles the Read Receipts setting, THE Settings_Store SHALL persist the new value and THE Chat_Page SHALL show or hide the double-tick read-receipt indicator on all subsequent sent messages.
4. WHEN a user toggles the Show Last Seen setting, THE Settings_Store SHALL persist the new value and THE Chat_Page SHALL show or hide the "last seen" timestamp in conversation headers accordingly.
5. WHEN a user selects a language from the language picker, THE Settings_Store SHALL persist the selected language and THE Settings_Panel SHALL display the selected language as the current value.
6. WHEN a user selects a font size (Compact, Normal, or Large), THE Settings_Store SHALL persist the selection and THE Chat_Page SHALL apply the corresponding CSS custom property (`--font-size-base`) to message text within 100 ms.
7. WHEN a user selects a profile visibility option (Everyone or Contacts Only), THE Settings_Store SHALL persist the selection and THE Settings_Panel SHALL reflect the active selection with a visual indicator.
8. WHEN the Settings_Panel transitions between tabs, THE Settings_Panel SHALL animate the content change using a CSS transition of no more than 200 ms.
9. WHEN a settings value is saved, THE Settings_Panel SHALL provide visual feedback (e.g., a brief success state on the toggle or button) within 300 ms of the save completing.

---

### Requirement 6: Responsive Design

**User Story:** As a user on any device, I want the app to display and function correctly on phones, tablets, and laptops, so that I can use Wave regardless of my screen size.

#### Acceptance Criteria

1. THE Chat_Page SHALL render a single-column layout on viewports narrower than 768 px, hiding the sidebar by default and showing a hamburger button to open it as an overlay.
2. THE Chat_Page SHALL render a two-column layout (sidebar + chat area) on viewports 768 px and wider.
3. WHEN the sidebar overlay is open on a mobile viewport, THE Chat_Page SHALL display a semi-transparent backdrop behind the sidebar and SHALL close the sidebar when the backdrop is tapped.
4. THE Settings_Panel SHALL be fully usable on viewports narrower than 375 px, with all interactive controls reachable without horizontal scrolling.
5. THE Auth_Flow SHALL be fully usable on viewports narrower than 375 px, with all form inputs and buttons visible without horizontal scrolling.
6. WHEN a user is on a touch device, THE Chat_Page SHALL support long-press (500 ms hold) on a message bubble to open the context menu, in addition to the existing right-click behaviour.
7. THE Chat_Page message input area SHALL remain anchored to the bottom of the viewport on mobile browsers, including when the software keyboard is open.
8. WHERE the viewport width is between 768 px and 1024 px (tablet), THE Chat_Page SHALL render the sidebar at a width of 260 px and the chat area SHALL fill the remaining space.
9. THE Chat_Page SHALL use fluid typography so that message text scales proportionally between the minimum viewport width of 320 px and the maximum of 1440 px.
