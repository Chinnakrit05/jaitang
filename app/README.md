# Jaitang App

> สมุดบัญชีในใจ — Next.js + Supabase + Auth.js

ดู `../SPEC.md` กับ `../ROADMAP.md` ที่โฟลเดอร์ parent สำหรับ spec ฉบับเต็ม

## Setup ครั้งแรก

ดู [`SETUP.md`](./SETUP.md) — ขั้นตอนสร้าง Google OAuth + Supabase project + ตั้ง env

## Dev

```bash
cp .env.example .env.local        # แล้วเติมค่าจริงตาม SETUP.md
npm install
npm run dev
```

เปิด http://localhost:3000

## Stack

- **Next.js 16** (App Router)
- **TypeScript** + **Tailwind CSS v4**
- **Auth.js v5** — Google OAuth
- **Supabase** (Postgres) — service-role key on the server
- **next-themes** — light/dark toggle
- **Recharts** — charts
- **Zod** + **react-hook-form** — forms

## โครงสร้าง

```
src/
├── app/
│   ├── page.tsx                  # landing
│   ├── login/page.tsx            # Google sign-in
│   ├── dashboard/
│   │   ├── layout.tsx            # protected shell
│   │   └── page.tsx              # summary
│   ├── api/auth/[...nextauth]/route.ts
│   ├── globals.css
│   └── layout.tsx
├── auth.ts                       # Auth.js config
├── components/
│   ├── dashboard-shell.tsx
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── lib/
│   ├── ledgers.ts
│   ├── supabase/server.ts
│   └── utils.ts
└── middleware.ts                 # protect /dashboard etc.

supabase/
└── schema.sql                    # run once in Supabase SQL editor
```
