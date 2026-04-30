# Jaitang (ใจถัง) 📒

> สมุดบัญชีในใจ — รายรับ-รายจ่ายแบบส่วนตัว + แชร์ พร้อม AI สแกนใบเสร็จ
> Heart-pocket ledger — personal & shared expense tracking with AI receipt scanning

---

## 🇹🇭 ภาษาไทย

### โปรเจกต์นี้คืออะไร

**Jaitang** เป็น web app (PWA) สำหรับบันทึกรายรับ-รายจ่าย ออกแบบให้ใช้คนเดียวก็คล่อง แชร์กับคู่ชีวิต/ครอบครัว/รูมเมทก็ได้
- บันทึกง่าย ดูประวัติย้อนหลังละเอียด
- กราฟสรุปรายเดือน ตามหมวด ตามวัน
- ตั้งงบประมาณต่อหมวด เตือนเมื่อใช้เกิน
- ตั้งรายการประจำ (ค่าเช่า เน็ต ค่าสมาชิก) ระบบสร้างให้อัตโนมัติ
- หารบิลกับสมาชิกในสมุดแชร์ + คำนวณยอดติดเงินเป็น net
- 📸 สแกนใบเสร็จด้วย Claude Vision → กรอกฟอร์มอัตโนมัติ
- 🔔 Web Push แจ้งเตือนเมื่อมีกิจกรรมในสมุดแชร์
- ติดตั้งบนหน้าจอมือถือเหมือนแอปจริง (PWA)

### ฟีเจอร์ครบทั้งหมด

#### 📝 จดบันทึก
- เพิ่ม/แก้/ลบรายการ — รายรับ/รายจ่าย, จำนวน, หมวด, โน้ต, วันเวลา
- หมวดเริ่มต้น 13 หมวด (อาหาร, เดินทาง, ของใช้, สุขภาพ, เงินเดือน, ลงทุน, ฯลฯ)
- เพิ่ม/แก้หมวด ตั้งไอคอน + สีเอง

#### 📊 ดูรายงาน
- Dashboard: ยอดรับ/จ่าย/คงเหลือเดือนปัจจุบัน + กราฟ pie ตามหมวด + กราฟ bar รายวัน
- หน้ารายการ: filter ตามช่วงเวลา (เดือนนี้/เดือนก่อน/30 วัน/ปีนี้/ทั้งหมด) × รับ/จ่าย × หมวด
- สรุปยอดบนหัว: รวมรายรับ, รวมรายจ่าย, ยอดสุทธิ
- Group ตามวัน + แสดงผลรวมรายวัน

#### 💰 งบประมาณ
- ตั้งงบรายเดือนต่อหมวด
- Progress bar 3 ระดับ: ปกติ/ใกล้เต็ม (≥80%)/เกินงบ
- เห็นยอดที่เหลือทันที

#### 🔁 รายการประจำ
- ตั้งรายการที่เกิดทุกวัน/สัปดาห์/เดือน
- Pause/Resume ได้
- ปุ่ม "รันที่ครบกำหนด" — สร้าง transaction ที่ค้างทั้งหมดในครั้งเดียว (backfill ได้สูงสุด 12 ครั้งต่อกฎ)

#### 👥 สมุดแชร์
- สมุดส่วนตัว + สมุดแชร์ใช้พร้อมกันได้
- เชิญผ่านลิงก์ + QR (ตั้งจำนวนใช้และวันหมดอายุได้)
- Roles: Owner, Editor (ร่วมจด), Viewer (ดูอย่างเดียว)
- สลับสมุดได้ทันที (cookie-backed) — header โชว์สมุดที่ active
- แสดงชื่อ + avatar คนที่จดในแต่ละรายการ (สมุดแชร์)

#### 💸 หารบิล (Splitwise mode)
- Toggle "หารบิล" ตอนเพิ่มรายจ่าย → เลือกสมาชิก → ระบบหารเท่ากัน
- หน้า `/balances` สรุปยอดติดเงินกัน (หักลบ 2 ทางแล้ว)
- ปุ่ม "ปิดบิล" — settle ระหว่าง 2 คนรวดเดียว

#### 📸 สแกนใบเสร็จ (Optional)
- กดถ่ายภาพหรือเลือกรูปใน `/transactions/new`
- ส่งให้ Claude Haiku 4.5 อ่าน → ดึงยอด/หมวด/วันที่/โน้ต
- Auto-prefill ฟอร์ม + Confidence indicator
- ต้องตั้ง `ANTHROPIC_API_KEY` (ไม่ตั้งก็ใช้ฟอร์มกรอกเองได้)

#### 🔔 แจ้งเตือน Web Push (Optional)
- เปิด/ปิดที่ `/settings` แยกแต่ละเครื่อง
- แจ้งเตือนอัตโนมัติเมื่อมีคนเพิ่มรายการในสมุดแชร์
- ต้องตั้ง VAPID keys (ไม่ตั้งก็ใช้แอปได้ปกติ ปุ่มหายไปอัตโนมัติ)

#### 📥 Export
- ปุ่ม "CSV" บนหน้ารายการ → ดาวน์โหลดตาม filter ปัจจุบัน
- UTF-8 BOM → Excel เปิดอ่านภาษาไทยได้ทันที

#### 🌗 ธีม
- Light (default) + Dark mode
- Toggle อยู่บน header + หน้า settings
- เก็บค่าใน localStorage ผ่าน next-themes

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Auth.js (NextAuth) v5 — Google OAuth |
| Database | Supabase (PostgreSQL) |
| Charts | Recharts |
| Forms | Zod + React Hook Form |
| AI Vision | Anthropic SDK (Claude Haiku 4.5) |
| Push | web-push + service worker |
| Deploy | Vercel |

### Setup

1. ดูคู่มือเต็มใน [`app/SETUP.md`](./app/SETUP.md)
2. สรุปสั้น:
   ```bash
   cd app
   cp .env.example .env.local   # เติมค่าจริง
   npm install
   npm run dev                  # http://localhost:3000
   ```
3. ต้องเตรียม:
   - Google OAuth credentials (จำเป็น)
   - Supabase project + run `supabase/schema.sql` (จำเป็น)
   - Anthropic API key (optional — สแกนใบเสร็จ)
   - VAPID keys via `npx web-push generate-vapid-keys` (optional — แจ้งเตือน)

### โครงสร้างโปรเจกต์

```
~/Desktop/jaitang/
├── SPEC.md                  # spec ฉบับเต็ม (data model, security, etc.)
├── ROADMAP.md               # phase progression
├── README.md                # ไฟล์นี้
└── app/
    ├── README.md, SETUP.md, .env.example
    ├── public/
    │   ├── sw.js            # service worker (push + PWA shell)
    │   └── manifest.json
    ├── supabase/
    │   └── schema.sql       # run ครั้งเดียวบน Supabase
    └── src/
        ├── app/
        │   ├── (app)/       # route group สำหรับหน้าที่ต้อง auth
        │   │   ├── layout.tsx        # shell + active ledger
        │   │   ├── dashboard/
        │   │   ├── transactions/
        │   │   ├── budgets/
        │   │   ├── recurring/
        │   │   ├── balances/
        │   │   ├── categories/
        │   │   ├── ledgers/
        │   │   └── settings/
        │   ├── invite/[code]/         # accept invite (public)
        │   ├── login/                 # Google sign-in
        │   ├── api/auth/[...nextauth]/
        │   ├── layout.tsx
        │   └── page.tsx               # landing
        ├── auth.ts                    # Auth.js config
        ├── middleware.ts              # protect routes
        ├── components/                # 14 React components
        └── lib/                       # 11 server libs (categories, transactions, splits, push, ocr, ...)
```

### เปลี่ยนภาษาแอปได้ ✅

รองรับ **ไทย** (default) + **English** สลับได้จากหน้า `/settings` → "ภาษา"

**Stack ที่ใช้:**
- [`next-intl`](https://next-intl-docs.vercel.app/) — i18n library
- Locale เก็บใน cookie `jt_locale`
- Message catalogs: `src/messages/th.json` + `src/messages/en.json` (~250 strings)
- Date/currency formatting รับ locale param ทุกที่

**เพิ่มภาษาใหม่:**
1. เพิ่ม locale ใน `src/i18n/locales.ts` (เช่น `"ja"`)
2. สร้างไฟล์ `src/messages/ja.json` (copy โครงจาก en.json แล้วแปล)
3. เพิ่ม mapping ใน `src/lib/locale-format.ts` ถ้าต้องการ Intl locale พิเศษ
จบ — language switcher จะเห็นตัวเลือกใหม่อัตโนมัติ

---

## 🇬🇧 English

### What is this?

**Jaitang** ("heart-pocket" in Thai) is a PWA expense tracker built for personal and household use. Track money in/out, view detailed history, set budgets, share ledgers with partners or roommates, and split bills — with AI receipt scanning and web-push notifications.

### Features at a glance

- 📝 **Track**: add/edit/delete income & expenses with categories, notes, dates
- 📊 **Reports**: monthly summaries with pie/bar charts, filters across time/kind/category
- 💰 **Budgets**: per-category monthly budget with traffic-light progress bars
- 🔁 **Recurring**: daily/weekly/monthly templates that auto-create when due
- 👥 **Shared ledgers**: invite via link or QR, role-based access (owner/editor/viewer)
- 💸 **Bill splitting**: equal split, net balance computation, settle-up flow
- 📸 **AI receipt OCR**: Claude Vision parses photos into form fields (optional)
- 🔔 **Web push**: per-device opt-in, fires on shared-ledger activity (optional)
- 📥 **CSV export**: respects current filter, UTF-8 BOM for Excel
- 🌗 **Theme**: light default + dark toggle
- 📱 **PWA**: installable, offline shell, push notifications

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Auth.js v5 — Google OAuth |
| Database | Supabase (PostgreSQL) |
| Charts | Recharts |
| Forms | Zod + React Hook Form |
| AI Vision | Anthropic SDK (Claude Haiku 4.5) |
| Push | web-push + service worker |
| Deploy | Vercel |

### Quick start

```bash
cd app
cp .env.example .env.local        # fill in real values
npm install
npm run dev                       # http://localhost:3000
```

You'll need:
- Google OAuth credentials (required)
- Supabase project + run `supabase/schema.sql` (required)
- `ANTHROPIC_API_KEY` (optional — receipt OCR)
- VAPID keys: `npx web-push generate-vapid-keys` (optional — push notifications)

Full guide: [`app/SETUP.md`](./app/SETUP.md)

### Architecture notes

- **Auth**: Auth.js v5 with JWT sessions; on sign-in, user upserted to `public.users`; `users.id` stashed in token.
- **Active ledger**: cookie-backed (`jt_active_ledger`); always re-validated against ownership/membership before serving any request.
- **Permissions**: `requireSession()` returns `{userId, ledgerId, role}` and helpers `assertWritable()` / `assertOwner()`.
- **Splits**: stored only for non-payer users; payer carries their share implicitly. Net balances computed on read; reciprocal debts cancel out.
- **Push**: VAPID-based, per-device subscriptions; dead 404/410 endpoints cleaned up automatically.
- **Recurring**: backfill on demand (no background worker required); capped at 12 iterations per rule per call.

### Multi-language support ✅

Ships with **Thai** (default) and **English**, switchable in `/settings` → "Language".

**Stack:**
- [`next-intl`](https://next-intl-docs.vercel.app/) for messages and ICU formatting
- Locale stored in `jt_locale` cookie
- Message catalogs in `src/messages/{th,en}.json` (~250 strings)
- All currency/date formatters take a locale argument

**Adding another language:**
1. Append the new locale to `src/i18n/locales.ts` (e.g. `"ja"`)
2. Create `src/messages/ja.json` (start from `en.json` and translate)
3. Optionally extend `src/lib/locale-format.ts` for a special Intl tag

The language switcher picks up the new option automatically.

### Project Status

- **3 phases** delivered: MVP → Sharing → Polish & Advanced
- **17 routes**, build clean, TypeScript clean
- **8 commits** on `main`
- 🦐 Built with [Claude Code](https://claude.com/claude-code) over a single late-night session

### License

MIT (or whatever you prefer — set this when publishing)
