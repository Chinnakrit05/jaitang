# Roadmap

## Phase 0 — Setup (วันนี้)
- [x] เลือก stack: Next.js + Supabase + Vercel + Google OAuth
- [ ] Init Next.js project
- [ ] Setup Tailwind + theme toggle
- [ ] Setup Supabase client + Auth.js
- [ ] Initial DB schema + RLS policies
- [ ] Project ขึ้น git + push

## Phase 1 — MVP Personal (1-2 sessions)
- [ ] Google login flow
- [ ] Auto-create personal ledger + default categories
- [ ] Quick-add transaction (modal)
- [ ] Transaction list + filter
- [ ] Dashboard: summary cards + charts
- [ ] Category CRUD
- [ ] PWA manifest + service worker
- [ ] Deploy ขึ้น Vercel

## Phase 2 — Sharing (1-2 sessions)
- [ ] Multi-ledger UI
- [ ] Invite system (link + QR)
- [ ] Members management
- [ ] Roles + permissions
- [ ] Activity feed

## Phase 3 — Polish & Advanced (ตามความต้องการ)
- [x] Budgets + alerts (per-category monthly budget + progress bars)
- [x] Recurring transactions (daily/weekly/monthly + manual apply-due)
- [x] Export CSV (with current filter respected)
- [ ] Splitwise mode
- [x] Receipt OCR (Claude Vision; requires ANTHROPIC_API_KEY, gracefully hidden if absent)
- [ ] Web push notifications
- [x] Activity log / "by [user]" attribution (shown in shared ledgers)

## ของที่ต้องเตรียมจากพี่ฟลุ๊ค

### 1. Google OAuth Credentials
1. ไป https://console.cloud.google.com
2. สร้าง project ใหม่ (เช่น "Jaitang")
3. APIs & Services → Credentials → Create OAuth client ID
4. Application type: Web application
5. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://<your-vercel-domain>/api/auth/callback/google` (prod)
6. ได้ `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`

### 2. Supabase Project
1. ไป https://supabase.com → New project
2. ตั้งชื่อ "jaitang", region "Singapore"
3. ได้:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (เก็บไว้ดี ๆ ห้ามขึ้น git)

### 3. Vercel
1. ไป https://vercel.com → Login Google → Connect GitHub repo
2. Import project → ตั้ง env vars ทั้งหมดข้างบน
3. Deploy

(ขั้นตอนละเอียดอยู่ใน SETUP.md หลัง scaffold เสร็จ)
