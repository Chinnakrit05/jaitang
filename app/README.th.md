# Jaitang (ใจถัง)

> **สมุดบัญชีในใจ** — แอปบันทึกรายรับ-รายจ่ายที่ออกแบบมาสำหรับครอบครัวไทย ฟรีแลนซ์ นักเดินทาง และทุกคนที่อยากรู้ว่าเงินตัวเองหายไปไหนหมด

รองรับหลายสกุลเงิน หลายสมุดบัญชี ผูกกับ AI ติดตั้งเป็น PWA ได้ ออกแบบสำหรับคนไทยแต่พูดอังกฤษ/ญี่ปุ่น/จีนได้ลื่น

🇬🇧 Read in English → [`README.md`](./README.md)

---

## ✨ ฟีเจอร์

### 📥 บันทึกรายการ
- **Quick add** — แตะ 2-3 ครั้งก็บันทึกรายการได้ พร้อมหมวด ช่องทางจ่าย บัญชี ทริป และโน้ต
- **OCR ใบเสร็จ** — ถ่ายรูปใบเสร็จ/สลิปธนาคาร/PromptPay → AI กรอกฟอร์มให้ (ยอด, วันที่, หมวด, ร้าน) ติดทริปที่ active อยู่ให้อัตโนมัติ
- **Auto-categorizer** — พิมพ์โน้ต "กาแฟ" → กด ✨ → AI เลือกหมวดให้จาก list ของเรา
- **Note autocomplete** — โน้ตเก่าเด้งมาใน `<datalist>` เรียงตามความถี่ที่ใช้ พิมพ์ "ก" → "กาแฟ", "ก๋วยเตี๋ยว" โผล่ทันที
- **CSV import** — auto-detect รูปแบบ Jaitang vs Apple Numbers vs ตาราง generic เก็บข้อมูลทริป/วิธีจ่าย/FX ครบ
- **Recurring v2** — ตั้งรายการประจำพร้อมระบุบัญชี/ทริป/สกุลเงินต่างประเทศได้ Cron จะสร้าง tx ของจริงให้พร้อมเรท FX ตามวันที่ run. รองรับ daily / weekly / monthly / **yearly** + **variable-cost mode** (ปล่อยช่องจำนวนว่างได้สำหรับบิลค่าไฟ/น้ำ/เน็ต — ถึงรอบแล้วจะขึ้นใน "บิลรอกรอก" panel ให้กรอกตอนได้บิล)

### 🗂 จัดระเบียบ
- **Categories** — มีหมวดมาตรฐานให้เริ่ม จัดการเองได้ครบทั้งไอคอน-สี. **Subcategory** สอง level (เช่น Transport → BTS / MRT / Taxi / Grab) — picker เลือก parent หรือ sub ก็ได้ ตั้ง budget ที่ parent → sub spend roll up ให้
- **Trips** — โฟลเดอร์ทริปต่างประเทศ เลือกสกุลเงิน → ลงรายการในสกุลนั้น → ดู breakdown กลับมาเป็นบาท
- **Accounts / Wallets** — เงินสด ธนาคาร บัตรเครดิต อีวอลเล็ท ยอดคงเหลือคำนวณสดจาก tx + transfers
- **Transfers** — โอนระหว่างบัญชีของตัวเอง ทั้งสกุลเดียวกันและข้ามสกุล (Wise-style: ใส่ยอดที่ได้รับจริง ระบบดึงเรทออกเอง)
- **Goals** — เป้าหมายการออมพร้อมเดดไลน์ บันทึกการออม + AI คอย nudge รายเป้า
- **Loans** — บันทึกเงินยืม-ให้ยืม (คนนอกระบบ) ลงคืนทีละนิด ปิดบัญชีอัตโนมัติเมื่อคืนครบ
- **Trip + Goal archive** — เก็บประวัติไว้โดยไม่รก list ใช้งาน

### 📊 ทำความเข้าใจ
- **Dashboard** — default เป็นวันนี้ สลับเป็น เมื่อวาน / 30 วัน / เดือน / ทั้งปี / ทั้งหมด ได้ มี toggle สกุลเงินต่างประเทศ
- **Account balances widget** — top 4 บัญชีแรก + ยอดรวมในสกุลหลัก
- **Net Worth tracker** — กราฟพื้นที่มูลค่าสุทธิย้อนหลัง 12 เดือน + delta เทียบเดือนที่แล้ว
- **Per-account chart** — กราฟเทรนด์ยอดต่อบัญชีในสกุลเงินตัวเอง
- **ปฏิทิน / heatmap** — กริดเดือนระบายสีตามความถี่ใช้ แตะวันไหนเห็นรายการของวันนั้น
- **Insights (MoM)** — เทียบเดือนนี้กับเดือนที่แล้ว หมวดไหนใช้เพิ่ม/ลด + AI commentary
- **Year-end report** — สรุปประจำปีที่ `/insights/year/[year]` พร้อมแท่งกราฟรายเดือน, top categories, รายการใหญ่สุด, เรียงเรียงโดย AI พิมพ์เป็น PDF ได้
- **Subscription tracker** — สรุปค่าใช้จ่ายต่อเดือน (per currency) + preview "อีก 30 วันข้างหน้า"
- **Search** — ค้นหา substring ในโน้ตของ tx ไฮไลท์คำที่เจอ

### 💸 Money quality-of-life
- **Multi-currency + FX live** — Frankfurter หลัก + exchangerate.host สำรอง cache 24 ชม. รองรับ 32 สกุล (10 ปักหมุด, 22 เรียงตามตัวอักษร)
- **Account reconciliation** — ใส่ยอดจริงจากแอปธนาคาร → ระบบเทียบ → ถ้าต่างกันบันทึกการปรับยอด 1 คลิก รองรับสกุลต่างประเทศ
- **Splits** — หารบิลในสมุดที่แชร์กับคนอื่น แบ่งเท่าๆ กัน เคลียร์หนี้ได้รายคู่
- **Multi-ledger** — สมุดส่วนตัว + สมุดที่แชร์กับคนอื่น สลับด้วย cookie แยกจาก URL

### 🤖 AI assistant
- **Chat** — หน้า `/chat` ถามเป็นภาษาธรรมชาติได้ "เดือนนี้ใช้ไปเท่าไหร่?", "เทียบเดือนนี้กับเดือนที่แล้ว", "30 วันที่ผ่านมาใช้ค่ากาแฟไปเท่าไหร่" Claude Haiku ใช้ tools อ่านข้อมูล (list tx, รวมตามช่วง, breakdown หมวด, ดูยอดบัญชี, MoM compare)

### 🌐 Platform
- **i18n** — ไทย / อังกฤษ / ญี่ปุ่น / จีน ทุกข้อความใน UI
- **PWA** — มี manifest + install prompt (Chrome/Edge อัตโนมัติ, iOS Safari แสดง hint ให้ทำเอง) ใช้งาน offline-tolerant
- **Push notifications** — Web Push API แจ้งเตือนรายการใหม่ในสมุดที่แชร์ + การเคลียร์หนี้
- **Theme** — light/dark โหมด ตามระบบหรือสลับเอง + 6 accent colors + 4 seasonal palettes
- **7 icon styles** — Sticker Pop (default) / Doodle / Watercolor / Geometric / Pixel Art / Lucide / Tabler เลือกที่ Settings → "สไตล์ไอคอน" sprite สลับทันทีทั้งแอป (เก็บใน `localStorage["jt-icon-style"]`) ห้าสไตล์วาดมือใช้ชื่อร่วมกัน 137 ชื่อ ส่วน Lucide/Tabler มีเพิ่มอีก 129 (`scripts/extra-icons.mjs`) — ชื่อกลุ่มหลังนี้ถ้าอยู่สไตล์วาดมือจะตกไปใช้ Tabler
- **อีโมจิเป็นภาพ** — อีโมจิในหน้าเลือกหมวดวาดด้วย [OpenMoji](https://openmoji.org) ไม่ใช่ฟอนต์ของเครื่อง ทุกอุปกรณ์จึงเห็นเหมือนกัน `scripts/build-emoji-assets.mjs` ก็อปเฉพาะตัวที่ใช้ไปไว้ที่ `public/emoji` **OpenMoji เป็น CC BY-SA 4.0** — เครดิตในหน้า Settings กับไฟล์ `public/emoji/LICENSE.txt` เป็นข้อบังคับ อย่าลบตราบใดที่ยังใช้ภาพชุดนี้
- **สมุดแชร์** — ทุกสมุด (รวมสมุดส่วนตัว) เชิญผ่านลิงก์/QR ได้ มี roles owner/editor/viewer
- **Backup / restore** — JSON export + import ทั้งสมุด (categories, tx, trips, goals, accounts, transfers, recurring, splits)

---

## 🚀 ติดตั้ง

### Local dev

```bash
cp .env.example .env.local        # เติมค่าตาม SETUP.md
npm install
npm run dev
```

เปิด <http://localhost:3000>

ดู [`SETUP.md`](./SETUP.md) สำหรับขั้นตอน Google OAuth, Supabase project, env vars และการ run schema migration

### Schema

`supabase/schema.sql` เป็น **idempotent** (รันซ้ำได้) — ก็อปทั้งไฟล์วางใน Supabase SQL Editor ตารางและ index ใช้ `if not exists`, types ใช้ `do $$ ... $$` block ดักซ้ำ

### AI features (optional)

ตั้ง `ANTHROPIC_API_KEY` เพื่อเปิดใช้ OCR, auto-categorizer, goal nudges, monthly insights summary, year-end commentary, AI chat ถ้าไม่ตั้งระบบจะ fallback เป็น deterministic หรือซ่อน feature นั้น

### FX rates

ฟรี ไม่ต้องใช้ key — Frankfurter (หลัก) → exchangerate.host (สำรอง) cache 24 ชม. ใน memory

---

## 🛠 Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript 5** + **Tailwind CSS v4**
- **Auth.js v5** — Google OAuth
- **Supabase** (Postgres) — service-role บน server, RLS เป็น defense-in-depth
- **Anthropic SDK** — Claude Haiku 4.5 สำหรับ OCR, suggestions, chat (with tool-use), commentary
- **next-intl** — i18n 4 ภาษา
- **next-themes** — theme management
- **Recharts** — กราฟ
- **Zod** + **react-hook-form** — validation + forms
- **web-push** — Web Push API
- **JSZip** — backup/restore archives
- **Vitest** — tests run with `TZ=Asia/Bangkok`

---

## 📁 โครงสร้างโปรเจค

```
src/
├── app/
│   ├── (app)/                        # routes ที่ต้อง login
│   │   ├── dashboard/                # หน้าแรก — สรุปวันนี้
│   │   ├── transactions/             # list, new, edit, export
│   │   ├── accounts/                 # /, /[id], ยอดรองรับ FX
│   │   ├── transfers/new/            # โอนข้ามสกุล
│   │   ├── trips/                    # /, /[id], ทริปหลายสกุล
│   │   ├── goals/                    # /, /[id], เป้าหมายการออม
│   │   ├── loans/                    # /, /[id], เงินยืม
│   │   ├── recurring/                # subscription tracker + จัดการ rules
│   │   ├── budgets/                  # งบประมาณรายหมวดต่อเดือน
│   │   ├── balances/                 # ยอดหารบิล (สมุดที่แชร์)
│   │   ├── calendar/                 # heatmap
│   │   ├── insights/                 # MoM compare + /year/[year]
│   │   ├── chat/                     # AI assistant
│   │   ├── ledgers/                  # สลับสมุด
│   │   ├── categories/               # จัดการหมวด
│   │   ├── import/                   # CSV import wizard
│   │   ├── settings/                 # theme, lang, push, danger zone
│   │   └── layout.tsx                # nav shell + แบนเนอร์ทริป + install prompt
│   ├── (auth)/login/                 # Google sign-in
│   ├── api/auth/[...nextauth]/       # Auth.js handlers
│   └── layout.tsx
├── auth.ts                           # Auth.js config
├── components/                       # UI components
├── lib/                              # server-side libs (แยกตามฟีเจอร์)
│   ├── transactions.ts               # tx CRUD + listDistinctNotes
│   ├── accounts.ts                   # คำนวณยอด
│   ├── transfers.ts                  # โอนข้ามสกุล
│   ├── trips.ts / goals.ts / loans.ts
│   ├── recurring.ts                  # cron + materialize
│   ├── insights.ts                   # MoM aggregation
│   ├── year-report.ts                # 12-month aggregation
│   ├── net-worth.ts                  # historic series
│   ├── fx.ts                         # FX with fallback + cache
│   ├── currencies.ts                 # 32 สกุลที่รองรับ
│   ├── ocr.ts                        # receipt vision
│   ├── categorize-ai.ts              # category suggester
│   ├── goals-ai.ts / insights-ai.ts / year-report-ai.ts
│   ├── chat-ai.ts                    # tool-use loop
│   ├── backup.ts                     # JSON export/restore
│   ├── jaitang-csv.ts                # CSV format
│   ├── business-tz.ts                # Asia/Bangkok date helpers
│   ├── date-range.ts                 # today/month/30d/etc resolvers
│   ├── splits.ts                     # equal-split math
│   ├── push.ts                       # Web Push
│   └── supabase/                     # client + server factories
├── messages/                         # th.json / en.json / ja.json / zh.json
└── middleware.ts                     # ป้องกัน routes

supabase/
└── schema.sql                        # idempotent — รันซ้ำปลอดภัย

public/
└── manifest.json                     # PWA manifest
```

---

## 🧪 การทดสอบ

```bash
npm test               # vitest run, TZ=Asia/Bangkok
npm run test:watch     # watch mode
```

**113 tests ใน 14 ไฟล์** ครอบคลุม: transactions aggregation, FX caching, trip math, account balance, transfer normalization, goals stats, splits, role checks, datetime round-trips, BUSINESS_TZ ranges, CSV round-trips, day-grouping in TZ

---

## 🔧 Conventions

- **Server actions** สำหรับ mutation ทุกตัว (ไม่มี REST) — client component เรียกผ่าน `useTransition`
- **`requireSession()`** ถูก React-cache — เรียกหลายครั้งใน request เดียวจ่าย auth + ledger fetch แค่ครั้งเดียว
- **datetime ทั้งหมด** ใน `lib/business-tz.ts` ใช้ `Asia/Bangkok` เพื่อให้ขอบเขตวันตรงกับ user ไม่ใช่ server
- **FX trio constraint**: `fx_currency`, `fx_amount`, `fx_rate` ต้องมาเป็นชุด หรือ null ทั้งสาม DB บังคับ + ฟอร์มยึด
- **Cookie active selections**: `active-ledger`, `active-trip` เคลียร์อัตโนมัติเมื่อข้ามสมุด
- **i18n keys** namespace ตามฟีเจอร์ (`accounts.*`, `trips.*`, `chat.*` ฯลฯ) เพิ่ม feature ใหม่ทำตามลำดับ: schema → types → lib → action → component → page → 4-lang i18n → nav → test → verify

---

## 📚 อ่านเพิ่ม

- [`SETUP.md`](./SETUP.md) — ขั้นตอนตั้งค่าครั้งแรก
- `../SPEC.md` / `../ROADMAP.md` — design intent (parent folder)
- `supabase/schema.sql` — DB schema ฉบับเต็ม

ทำด้วย 🦐
