# Wave 2.0

A real-time messaging web app built with React, Vite, and Supabase. Think WhatsApp/Telegram-style chat in a single-page application.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?logo=supabase)

## Features

- **Authentication** — Email OTP sign-in via Supabase Auth
- **Real-time Chat** — Live message sync with Supabase Realtime
- **Conversations** — Search and filter your chat list
- **File Uploads** — Images, files, and media via Cloudflare R2
- **Rich Messages** — Text, reactions, replies, edits, polls, and GIFs
- **Scheduled Messages** — Queue messages to send later
- **Presence** — See when contacts are online
- **Fully Responsive** — Mobile-first, works on any screen size
- **Accessibility** — Full keyboard navigation and screen reader support

## Tech Stack

- **Frontend:** React 19, TypeScript 5.9, Tailwind CSS 4
- **Build:** Vite 7 with single-file output
- **State:** Zustand
- **Backend:** Supabase (Auth, Database, Realtime)
- **Storage:** Cloudflare R2
- **Data Fetching:** TanStack React Query

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

The app works in **demo mode** out of the box (local state only). To enable the live backend, add your Supabase credentials below.

## Environment Variables

Create `.env.local`:

```
# Supabase (required for live mode)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudflare R2 (for file uploads)
VITE_CLOUDFLARE_ACCOUNT_ID=your_account_id
VITE_CLOUDFLARE_BUCKET_NAME=your_bucket_name
VITE_CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
VITE_CLOUDFLARE_API_TOKEN=your_api_token
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production (outputs `dist/index.html`) |
| `npm run preview` | Preview the production build |

## Project Structure

```
src/
├── components/          # Reusable UI components
├── features/
│   ├── auth/            # Authentication flow
│   └── chat/            # Chat UI, messages, settings
├── hooks/               # Custom React hooks
├── store/               # Zustand state stores
├── types/               # TypeScript types
└── utils/               # Utilities (Supabase client, R2, helpers)
```

## Build Output

The app compiles to a single `dist/index.html` file (~241 KB, ~72 KB gzipped) — easy to deploy anywhere.

## License

MIT
