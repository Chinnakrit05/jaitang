# Setup Guide

ขั้นตอนสร้างของจริง 3 ส่วน: Google OAuth, Supabase, ตั้ง env

---

## 1. Google OAuth

1. เปิด https://console.cloud.google.com → เลือก/สร้าง project (ชื่อ "Jaitang")
2. **APIs & Services → OAuth consent screen** → เลือก *External* → กรอก:
   - App name: `Jaitang`
   - User support email: อีเมลพี่
   - Developer contact: อีเมลพี่
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://<YOUR_VERCEL_DOMAIN>` (ใส่หลัง deploy รอบแรก)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<YOUR_VERCEL_DOMAIN>/api/auth/callback/google`
4. คัดลอก **Client ID** + **Client secret** เก็บไว้

---

## 2. Supabase

1. เปิด https://supabase.com → New project
2. Name: `jaitang`, Region: `Singapore (Southeast Asia)`, Database password: *เก็บไว้*
3. รอ project provision เสร็จ
4. **SQL Editor → New query** → วางเนื้อหาจาก `supabase/schema.sql` → Run
5. **Project Settings → API** → คัดลอก:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (กดเปิดดู) → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **ห้าม commit**

---

## 3. Local env

```bash
cd app
cp .env.example .env.local
```

เปิด `.env.local` แล้วเติม:

```env
AUTH_SECRET="<run: openssl rand -base64 32>"
AUTH_GOOGLE_ID="<from step 1>"
AUTH_GOOGLE_SECRET="<from step 1>"

NEXT_PUBLIC_SUPABASE_URL="<from step 2>"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<from step 2>"
SUPABASE_SERVICE_ROLE_KEY="<from step 2>"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

generate AUTH_SECRET:

```bash
openssl rand -base64 32
```

---

## 4. Run dev

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 → กด "เริ่มใช้งาน" → login Google → เด้งเข้า /dashboard

---

## 5. Deploy to Vercel

1. push โค้ดขึ้น GitHub repo
2. https://vercel.com/new → import repo
3. Root directory: `app`
4. Environment Variables: copy ทุกตัวจาก `.env.local` (ยกเว้น `NEXT_PUBLIC_APP_URL` → ใช้ Vercel domain แทน)
5. Deploy
6. กลับไป Google Cloud Console → เพิ่ม Vercel domain ใน Authorized redirect URIs
7. กลับไป Supabase → (อนาคต) เพิ่ม Vercel domain ใน Auth Settings ถ้าใช้ Supabase Auth ตรง ๆ

---

## Troubleshooting

- **`AUTH_SECRET` missing** → generate ด้วย openssl และใส่ใน `.env.local`
- **Google sign-in error: redirect_uri_mismatch** → ตรวจ Authorized redirect URI ใน Google Console
- **Supabase 401** → ตรวจว่าใช้ `SUPABASE_SERVICE_ROLE_KEY` ฝั่ง server (ไม่ใช่ anon)
- **schema.sql fails on `create extension`** → ใช้ admin role ของ Supabase หรือ run แต่ละบล็อกแยก
