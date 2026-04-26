# Wave 2.0 — Product Overview

Wave is a real-time messaging web app (WhatsApp/Telegram-style). It's a single-page application that compiles to a single `dist/index.html` file.

## Core Features
- Email OTP authentication (via Supabase)
- Conversations list with live search/filtering
- Chat with text, images, files, GIFs, polls, and reactions
- Message reply, edit, and soft-delete
- Supabase Realtime for live message sync
- File uploads to Cloudflare R2
- Fully responsive (mobile-first)
- Full keyboard navigation and screen reader support

## Modes
- **Demo mode**: Works without any backend config — uses local state only
- **Live mode**: Activated when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local`

## Environment Variables (`.env.local`)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLOUDFLARE_ACCOUNT_ID=
VITE_CLOUDFLARE_BUCKET_NAME=
VITE_CLOUDFLARE_R2_ENDPOINT=
VITE_CLOUDFLARE_API_TOKEN=
```
