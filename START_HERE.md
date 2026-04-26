# 🚀 Wave 2.0 - Getting Started Guide

## Quick Start

### 1️⃣ **Start the Dev Server**
```bash
npm run dev
```
Then open: **http://localhost:5173**

### 2️⃣ **Build for Production**
```bash
npm run build
```
Output: `dist/index.html` (single file app)

### 3️⃣ **Preview Production Build**
```bash
npm run preview
```

---

## 📋 What You Can Do Right Now

### ✅ Already Working:
- **Auth Flow**: Email → Code → Profile (demo mode)
- **Chat UI**: Full messaging interface with conversations
- **Search**: Type in sidebar to filter conversations
- **Responsive**: Works on mobile, tablet, desktop
- **Message Sending**: Send messages (stored locally)
- **File Attachments**: UI for photo/file/location/contact
- **Settings Panel**: User profile and settings
- **Accessibility**: Full keyboard navigation + screen reader support

### 🎮 Try These:
1. Go through the auth flow (use any email, any 5-digit code)
2. Search conversations by name in the sidebar
3. Send messages - they appear in real-time
4. Toggle settings from hamburger menu
5. Try on your phone - sidebar slides in/out
6. Use keyboard (Tab navigation, Escape to close modals)

---

## 🔄 Next: Supabase Integration

Ready to add real backend? Follow these steps:

### Step 1: Set Up Supabase Project
```bash
# Create account at https://supabase.com
# Create new project
# Get your credentials from project settings
```

### Step 2: Install Supabase Client
```bash
npm install @supabase/supabase-js
```

### Step 3: Add Environment Variables
Create `.env.local`:
```
VITE_SUPABASE_URL=your_url_here
VITE_SUPABASE_ANON_KEY=your_key_here
```

### Step 4: Create Supabase Client
Create `src/utils/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### Step 5: Connect Auth
Update `src/store/auth-store.ts` to use Supabase auth

### Step 6: Add React Query
```bash
npm install @tanstack/react-query
```

Then wrap app with QueryClientProvider

### Step 7: Connect Messages
Replace demo data with real database queries

---

## 📁 Project Structure

```
src/
├── App.tsx                    # Main app with error boundary
├── main.tsx                   # React entry point
├── index.css                  # Tailwind + globals
├── components/                # Reusable components
│   ├── Avatar.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── ErrorBoundary.tsx
│   ├── Modal.tsx
│   ├── Skeleton.tsx
│   └── sidebar.tsx
├── features/                  # Feature modules
│   ├── auth/components/
│   │   └── auth-flow.tsx
│   └── chat/
│       ├── components/
│       │   ├── message-input.tsx
│       │   └── settings-panel.tsx
│       └── pages/
│           └── chat-page.tsx
├── hooks/                     # Custom hooks
│   ├── useLocalStorage.ts
│   └── useSearch.ts
├── store/                     # Zustand stores
│   ├── auth-store.ts
│   ├── chat-store.ts
│   └── theme-store.ts
├── types/                     # TypeScript types
│   └── index.ts
└── utils/                     # Utilities
    ├── cn.ts
    └── (supabase.ts - add this next)
```

---

## 🎯 Development Tips

### Add New Component
```typescript
// src/components/YourComponent.tsx
import { cn } from "@/utils/cn"

export function YourComponent() {
  return <div>Your component</div>
}
```

### Use a Hook
```typescript
import { useSearch } from "@/hooks"

const results = useSearch(items, query)
```

### Reusable Button
```typescript
import { Button } from "@/components"

<Button variant="primary" size="md">Click me</Button>
```

### Error Boundary
Already wraps the entire app! Components inside are protected.

---

## 📊 Quick Stats
- **Build**: 244 KB (72 KB gzipped)
- **Dev Server**: Instant hot reload
- **TypeScript**: Full strict mode
- **Tailwind**: v4 with custom theme
- **React**: v19 with latest features

---

## 🚨 Common Issues

**Q: Dev server not starting?**
```bash
npm install
npm run dev
```

**Q: TypeScript errors?**
Make sure tsconfig.json paths are correct:
```json
"paths": { "@/*": ["src/*"] }
```

**Q: Build fails?**
```bash
rm -rf node_modules dist
npm install
npm run build
```

---

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [React Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)

---

**Questions?** Check the code - it's all well-commented and organized! 🎉
