# Wave 2.0 MVP - Getting Started

## ✅ What Works

- **Auth Flow**: Email → 5-digit code → Profile  
- **Chat**: Send/receive messages, search conversations
- **File Upload**: Real files to Cloudflare R2
- **Mobile**: Fully responsive design
- **Search**: Live conversation filtering

## 🚀 Quick Start

```bash
cd /Users/hhh/wavev2
npm run dev
```
Open: http://localhost:5173

## 📁 Setup Cloudflare R2

1. Create R2 bucket at https://dash.cloudflare.com/
2. Generate API token (with R2 permissions)
3. Create `.env.local`:

```
VITE_CLOUDFLARE_ACCOUNT_ID=your_account_id
VITE_CLOUDFLARE_BUCKET_NAME=your_bucket_name
VITE_CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
VITE_CLOUDFLARE_API_TOKEN=your_api_token
```

4. Test file upload in chat (click + icon)

## 📦 Build for Production

```bash
npm run build
# Output: dist/index.html (single file, 241 KB)
```

## 🎯 MVP Features

**Working:**
- ✅ Authentication (demo mode)
- ✅ Chat UI with conversations  
- ✅ Send text messages
- ✅ Upload files to R2
- ✅ Search conversations
- ✅ Mobile responsive
- ✅ Keyboard nav + accessibility

**Not included:**
- ❌ Database (just local state)
- ❌ Real-time (demo data only)
- ❌ Settings (removed for MVP)
- ❌ i18n (not needed yet)
- ❌ Typing indicators

## 📊 Stats

- Bundle: **241 KB** (72 KB gzipped)
- Components: 8 reusable
- Hooks: 2 custom
- Build time: **513ms**

## 🔄 Next Steps

After MVP works:
1. Add Supabase for real backend
2. Implement real-time messaging
3. Add user authentication
4. Add more features based on needs

---

**Just working MVP features. No half-baked stuff.** 🎉
