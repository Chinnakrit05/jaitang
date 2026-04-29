# Jaitang — Personal & Shared Expense Tracker

> "ใจถัง" — สมุดบัญชีในใจ จดเงินเข้า-ออกง่าย ๆ ทั้งของตัวเองและแชร์กับคนอื่น

## Vision

แอปจดบันทึกรายรับ-รายจ่ายแบบเว็บ (PWA) ที่ใช้คนเดียวก็ได้ แชร์กับคนอื่นก็ได้ ดูประวัติย้อนหลังละเอียด มีกราฟสรุปสวย ๆ และติดตั้งบนหน้าจอมือถือได้

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Theme | Light default + Dark toggle (next-themes) |
| Auth | Auth.js (NextAuth) — Google OAuth only |
| Database | Supabase (PostgreSQL) |
| ORM/Client | `@supabase/supabase-js` + raw SQL |
| Charts | Recharts |
| Deploy | Vercel |
| PWA | next-pwa |
| Forms | React Hook Form + Zod |

## Data Model

```
users (จาก Google OAuth)
  - id (uuid, pk)
  - email (unique)
  - name
  - image
  - created_at

ledgers (สมุดบัญชี — ส่วนตัว/แชร์)
  - id (uuid, pk)
  - name
  - icon (emoji)
  - color
  - currency (default: THB)
  - owner_id → users.id
  - is_personal (bool)        # true = สมุดส่วนตัว
  - created_at

ledger_members (สมาชิกของสมุดแชร์)
  - id (uuid, pk)
  - ledger_id → ledgers.id
  - user_id → users.id
  - role (enum: owner, editor, viewer)
  - joined_at
  - UNIQUE(ledger_id, user_id)

categories (หมวดหมู่)
  - id (uuid, pk)
  - ledger_id → ledgers.id   # หมวดผูกกับสมุด
  - name
  - icon (emoji)
  - color
  - kind (enum: income, expense)
  - sort_order

transactions (รายการเงินเข้า-ออก)
  - id (uuid, pk)
  - ledger_id → ledgers.id
  - user_id → users.id        # คนที่บันทึก
  - category_id → categories.id
  - kind (enum: income, expense)
  - amount (numeric, positive)
  - note (text, nullable)
  - occurred_at (timestamptz)
  - created_at
  - updated_at

invites (ลิงก์เชิญเข้าสมุดแชร์)
  - id (uuid, pk)
  - ledger_id → ledgers.id
  - code (unique, short)
  - role (enum: editor, viewer)
  - max_uses (int, default 1)
  - used_count (int)
  - expires_at (timestamptz, nullable)
  - created_by → users.id
  - created_at
```

### Default Categories (สำหรับสมุดใหม่)

**Expense:** อาหาร 🍜, เดินทาง 🚗, ของใช้ 🛒, บันเทิง 🎮, สุขภาพ 💊, ที่อยู่อาศัย 🏠, การศึกษา 📚, อื่น ๆ ✨

**Income:** เงินเดือน 💰, โบนัส 🎁, ขายของ 🏷️, ลงทุน 📈, อื่น ๆ ✨

## Features

### MVP (Phase 1)
- [x] Google Login
- [x] Auto-create personal ledger ครั้งแรกที่ login
- [x] เพิ่ม/แก้/ลบรายการ (kind, amount, category, note, date)
- [x] Quick-add modal (กดปุ่ม + ลอย)
- [x] List view: ประวัติพร้อม filter (ช่วงเวลา/หมวด/kind)
- [x] Dashboard: ยอดรับ/ยอดจ่าย/คงเหลือเดือนนี้ + กราฟ pie ตามหมวด + กราฟ bar รายวัน
- [x] CRUD หมวดหมู่
- [x] Theme toggle (light/dark)
- [x] PWA (installable, offline shell)
- [x] Responsive (mobile + desktop)

### Phase 2 — Sharing
- [ ] สร้างสมุดแชร์ใหม่
- [ ] Invite link + QR code
- [ ] Roles (owner/editor/viewer) + RLS
- [ ] Member list + remove member
- [ ] Activity log (ใครบันทึก/แก้รายการไหน)
- [ ] Switch ledger (dropdown ที่ header)

### Phase 3 — Advanced
- [ ] Budget ต่อหมวด + alert เมื่อใกล้เกิน
- [ ] Recurring transactions
- [ ] Export CSV/Excel
- [ ] Splitwise mode (หารบิล)
- [ ] Receipt scan (OpenAI Vision / Anthropic)
- [ ] Web Push notification (สรุปประจำวัน)
- [ ] Email สรุปประจำเดือน

## Routes (App Router)

```
/                        → redirect /dashboard ถ้า login | /login ถ้าไม่
/login                   → Google sign-in
/dashboard               → home: สรุปเดือนนี้ + recent + กราฟ
/transactions            → list + filter + edit
/transactions/new        → modal/page เพิ่มรายการ
/categories              → จัดการหมวดหมู่
/ledgers                 → list สมุดทั้งหมด
/ledgers/[id]            → settings ของสมุด
/ledgers/[id]/members    → จัดการสมาชิก (owner)
/invite/[code]           → join via invite link
/settings                → profile, theme, prefs
/api/auth/[...nextauth]  → Auth.js routes
/api/transactions        → REST/RSC actions
/api/ledgers             → ...
```

## Security & Permissions

- ใช้ **Supabase Row-Level Security (RLS)** เป็น primary defense
- Policy: user เห็นเฉพาะ ledger ที่ตัวเองเป็น owner หรืออยู่ใน `ledger_members`
- Editor: เพิ่ม/แก้/ลบ transactions ในสมุดที่ตัวเป็น member
- Viewer: SELECT only
- API routes ตรวจสอบ session ก่อนทุก mutation

## Theme

- **Default: Light**
- ปุ่ม toggle อยู่ที่ header, persist ใน `localStorage` ผ่าน `next-themes`
- โทนสี Light: warm neutral + accent น้ำเงินอ่อน/เขียวมิ้นต์
- โทนสี Dark: deep navy + accent เดียวกัน

## Non-functional

- รองรับ Thai/English (เริ่มจาก Thai เป็นหลัก)
- Responsive: mobile-first
- Performance: < 2s LCP บน 4G
- Accessibility: keyboard navigation + aria labels

## Out of Scope (ตอนนี้)

- ❌ LINE integration (ยกเลิก)
- ❌ Bank/SMS sync
- ❌ Multi-currency conversion (ใช้ THB เป็นหลักก่อน)
- ❌ Crypto/investment tracking
