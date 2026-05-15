# Jaitang (ใจถัง) 📒

> สมุดบัญชีในใจ — รายรับ-รายจ่ายส่วนตัว + แชร์ + ทริปต่างประเทศ พร้อม AI ผู้ช่วย
> Heart-pocket ledger — personal & shared expense tracking with trips, multi-currency, and AI

---

## 🇹🇭 ภาษาไทย

### Jaitang คืออะไร

**Jaitang** เป็น web app (PWA) สำหรับบันทึกรายรับ-รายจ่าย ออกแบบให้ใช้คนเดียวก็คล่อง แชร์กับคู่ชีวิต/ครอบครัว/รูมเมทก็ได้ พกไปต่างประเทศก็จดด้วยสกุลเงินท้องถิ่น แล้วระบบแปลงเป็นบาทให้

- บันทึก/แก้/ค้นหา รายการรายรับ-รายจ่าย ตามหมวด/ทริป/ช่วงเวลา/สกุลเงิน
- Dashboard + กราฟ + ปฏิทิน heatmap + วิเคราะห์เดือนนี้ vs เดือนก่อน (พร้อม AI summary)
- งบประมาณรายเดือนต่อหมวด, รายการประจำ, หารบิลแบบ Splitwise
- ทริป (เช่น "ทริปญี่ปุ่น") พร้อม **multi-currency** — จด JPY แล้วเก็บอัตราแลกเปลี่ยนสด ๆ ให้ ดูสรุปเป็น THB ได้
- AI สแกน **ใบเสร็จ + สลิปโอน** + AI พิมพ์เร็ว ("กาแฟ 65" → จัดเข้าหมวดให้)
- Web push แจ้งเตือน, sync ข้ามอุปกรณ์, dark mode, 4 ภาษา (TH/EN/JA/ZH)
- Backup/restore ทุกข้อมูลเป็น JSON, export CSV เปิดใน Excel ได้

---

### ฟีเจอร์ครบทั้งหมด

#### 📝 บันทึกรายการ
- รายรับ/รายจ่าย — จำนวน, หมวด, โน้ต, วันเวลา
- หมวดเริ่มต้น 13 หมวด — เพิ่ม/แก้/ลบ ตั้งไอคอน+สีเอง
- **หมวดย่อย (subcategory)** — สอง level เช่น Transport → BTS / MRT / Taxi / Grab. Picker เลือก parent ได้เลยหรือเจาะ sub
- **ช่องทางจ่าย** — เงินสด / เงินโอน
- **Trip tagging** — ผูกรายการกับทริปได้ default จากทริปที่ active หรือเลือกได้
- ค้นหา note + filter รวมตามช่วงเวลา / หมวด / รับ-จ่าย / ทริป

#### 📊 Dashboard + Reports
- 3 cards: รายรับ / รายจ่าย / ยอดสุทธิ ของช่วงที่เลือก
- 2 กราฟ: pie ตามหมวด + bar รายวัน
- **Range filter ใหม่**: วันนี้ / เมื่อวาน / เมื่อวันก่อน / เดือนนี้ / เดือนก่อน / 30 วัน / ปีนี้ / ทั้งหมด
- **Payment method breakdown** — สรุปเงินสด vs เงินโอน vs ไม่ระบุ ในช่วงเดือน
- **Currency toggle** บน dashboard เมื่อมีรายการต่างสกุลเงิน — สลับดู THB หรือ JPY ได้

#### 📅 Calendar / Heatmap (ใหม่)
- ปฏิทินรายเดือน — สีเข้ม = วันใช้เยอะ, สีอ่อน = ใช้น้อย
- คลิกวัน → expand แสดงยอดรายรับ/รายจ่ายของวันนั้น
- Navigate prev/next month
- Bangkok timezone aware — รายการ 03:00 น. ของวันที่ 1 ขึ้นวันที่ 1 ไม่ใช่วันก่อน

#### 📈 Insights — เดือนนี้ vs เดือนก่อน (ใหม่)
- **AI summary** 2-3 ประโยค (Claude Haiku 4.5) — ภาษาไทย/อังกฤษ/ญี่ปุ่น/จีนตาม locale
- เทียบ income/expense + delta % (handle baseline = 0 → "ใหม่เดือนนี้")
- Top 3 หมวดที่ใช้เพิ่มขึ้น / ใช้ลดลง

#### ✈️ ทริป + Multi-currency (ใหม่)
- สร้างทริป ("ทริปญี่ปุ่น") พร้อมไอคอน, สี, วันเริ่ม/สิ้นสุด, **สกุลเงิน**
- 32 currencies รองรับ (10 pinned ยอดนิยมไทย + 22 alphabetical)
- รายการในทริป default = trip currency แต่ override ต่อ tx ได้
- **Live FX preview** ขณะกรอก: "≈ ฿350.00 (อัตรา 0.2333 / 1 JPY)"
- FX rate snapshot ตอน submit (Frankfurter.dev → fallback exchangerate.host) cache 24 ชม.
- Trip detail แสดง multi-currency totals + home equivalent รวม
- Active trip banner ใต้ navbar — ทุกรายการใหม่ auto-tag จนกด X ปิด
- Archive/unarchive/delete trip — รายการที่ tag ไว้กลายเป็นรายการธรรมดา (ไม่ถูกลบ)
- ดึงรายการออกจากทริปทีละแถวได้

#### 💰 งบประมาณ
- ตั้งงบรายเดือนต่อหมวด — Progress bar 3 ระดับ (ปกติ / ≥80% / เกิน)
- **Sub roll-up** — ตั้ง budget ที่ parent (เช่น Transport 5,000) จะ sweep รวม sub ทุกตัว (BTS+MRT+Taxi+Grab)
- ใช้ home currency เสมอ (FX รายการแปลงให้แล้ว)

#### 🔁 รายการประจำ
- daily / weekly / monthly / **yearly** (ค่าเทอม, ภาษีรถ, ประกัน, domain renewal)
- **Variable-cost mode** — ปล่อยช่องจำนวนว่างได้สำหรับบิลที่ราคาไม่แน่ (ค่าไฟ/น้ำ/เน็ต)
- ถึงรอบแล้วยังไม่กรอก → ขึ้น panel "บิลรอกรอก" ใส่ราคา + กดปุ่มเดียวจบ
- Pause/Resume, "รันที่ครบกำหนด" backfill สูงสุด 12 ครั้ง/กฎ

#### 👥 สมุดแชร์
- **ทุกสมุดแชร์ได้** (รวมสมุดส่วนตัว) — กด ⚙️ ที่การ์ดเพื่อสร้าง invite link
- เชิญผ่านลิงก์ + QR (ตั้ง max uses + expiry)
- Roles: Owner / Editor / Viewer
- แสดงชื่อ+avatar ของคนที่จดในแต่ละรายการ

#### 💸 หารบิล (Splitwise mode)
- Toggle ตอนเพิ่มรายจ่าย → เลือกสมาชิก → หารเท่ากัน (cent-precise)
- หน้า `/balances` สรุปยอดติดเงินกัน (net both ways)
- ปุ่ม "ปิดบิล" settle ระหว่าง 2 คน

#### 📸 AI สแกนใบเสร็จ / สลิปโอน
- Claude Haiku 4.5 ผ่าน Anthropic SDK
- รองรับ 2 ประเภท: ใบเสร็จร้านค้า + สลิปโอนเงินธนาคารไทย/PromptPay
- Auto-detect: ใบเสร็จ → cash, สลิป → transfer
- Auto-prefill ยอด/หมวด/วันที่/โน้ต + Confidence indicator (high/medium/low)

#### ✨ AI พิมพ์เร็ว
- พิมพ์ "30 bts" หรือ "ค่ากาแฟ 65" → ระบบ parse + บันทึก
- เลือกหมวดอัตโนมัติ + แสดง confidence

#### 🔔 Web Push
- เปิด/ปิดต่อเครื่อง — มือถือ + คอมแยกกัน
- แจ้งเตือนเมื่อ:
  - มีคนเพิ่มรายการในสมุดแชร์ (รวม trip context, FX amount)
- ต้อง VAPID keys (optional)

#### 📥 Export / Import / Backup
- **CSV export** — 10 columns: วันที่, ประเภท, หมวด, จำนวน, ช่องทาง, ทริป, สกุลต่างประเทศ, จำนวนต่างประเทศ, อัตรา, โน้ต. UTF-8 BOM (Excel เปิดอ่านไทยได้)
- **Jaitang CSV import** — auto-detect format ระหว่างฟอร์แมตของเรา (round-trip ครบ) กับ Apple Numbers .zip/.csv
- ภาษาไทยจาก Numbers app: AI map หมวด + recreate trip linkage by name
- **JSON Backup/Restore** — เก็บ/กู้คืนทุกข้อมูล (สมุด, รายการ, หมวด, งบ, รายการประจำ, splits, ทริป, FX) — รองรับ cross-user (รายการ split routed by email)

#### 🔐 Danger zone (Settings)
- **ลบรายการทั้งหมดในสมุดที่ใช้อยู่** — owner-only, type-to-confirm
- **ลบข้อมูลทั้งหมดของฉัน** — ลบทุกสมุดที่ user เป็น owner + push subscriptions + sign out

#### 🎨 Custom icon system (JtIcon)
- **5 sprite ที่เลือกได้** — Sticker Pop (default) / Doodle / Watercolor / Geometric / Pixel Art
- ~136 icons ต่อสไตล์ (nav, action, status, domain, emoji palette, future)
- เปลี่ยนสไตล์ได้ที่ /settings → "สไตล์ไอคอน" — sprite เปลี่ยนทันทีทั้งแอป
- Persist ผ่าน localStorage (`jt-icon-style`)
- **EmojiOrIcon** — dual-format helper render JtIcon ถ้า value ตรงกับ sprite, fall back เป็น emoji char สำหรับข้อมูลเก่า

#### 🌗 Theme + i18n + PWA
- Light (default) + Dark mode — toggle บน header (desktop) หรือ /settings (mobile)
- 6 accent colors + 4 seasonal palettes (auto-by-date หรือเลือกเอง)
- 4 ภาษา: ไทย / English / 日本語 / 中文 — สลับได้ที่ /settings
- Date/currency formatting ตาม locale
- PWA: ติดตั้งบน home screen, offline shell, service worker

---

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Auth.js (NextAuth) v5 — Google OAuth |
| Database | Supabase (PostgreSQL) |
| Charts | Recharts |
| Forms | Zod + React Hook Form |
| AI | Anthropic SDK — Claude Haiku 4.5 (OCR / quick parse / insights summary) |
| FX rates | Frankfurter.dev + exchangerate.host (free, no key) |
| Push | web-push + service worker (VAPID) |
| i18n | next-intl |
| Tests | Vitest |
| Deploy | Vercel |

---

### Setup

1. ดูคู่มือเต็ม: [`app/SETUP.md`](./app/SETUP.md)
2. สรุปสั้น:
   ```bash
   cd app
   cp .env.example .env.local   # เติมค่าจริง
   npm install
   npm run dev                  # http://localhost:3000
   ```
3. ต้องเตรียม:
   - Google OAuth credentials (จำเป็น)
   - Supabase project + run `supabase/schema.sql` (จำเป็น) — schema เป็น idempotent (run ซ้ำได้, ไม่ทำลายข้อมูลเดิม)
   - `ANTHROPIC_API_KEY` (optional — AI OCR + quick parse + insights)
   - VAPID keys via `npx web-push generate-vapid-keys` (optional — push notifications)

### Run tests

```bash
cd app
npm test           # one-off (TZ=Asia/Bangkok built-in)
npm run test:watch # watch mode
```

113 unit tests ครอบคลุม: timezone correctness, FX fetcher fallback, CSV import/export round-trip, MoM compare math, role authorization, search highlight, currency aggregation

---

### โครงสร้างโปรเจกต์

```
~/Documents/jaitang/
├── SPEC.md, ROADMAP.md, README.md
└── app/
    ├── README.md, SETUP.md, AGENTS.md, CLAUDE.md
    ├── public/
    │   ├── sw.js              # service worker (push + PWA shell)
    │   └── manifest.json
    ├── supabase/
    │   └── schema.sql         # idempotent — รัน 1 ครั้งหรือซ้ำก็ได้
    ├── vitest.config.ts
    └── src/
        ├── app/
        │   ├── (app)/         # routes ที่ต้อง auth
        │   │   ├── dashboard/         # หน้าแรก + range/currency toggle
        │   │   ├── transactions/      # list + new + edit + export route
        │   │   ├── trips/             # list + create + detail + actions + fx-actions
        │   │   ├── calendar/          # heatmap view
        │   │   ├── insights/          # MoM compare + AI summary
        │   │   ├── budgets/
        │   │   ├── recurring/
        │   │   ├── balances/          # split balances
        │   │   ├── categories/
        │   │   ├── ledgers/[id]/members/
        │   │   ├── import/            # auto-detect Numbers vs Jaitang CSV
        │   │   ├── settings/          # account, push, theme, lang, backup, danger zone
        │   │   └── layout.tsx
        │   ├── api/
        │   │   ├── auth/[...nextauth]/
        │   │   └── backup/route.ts
        │   ├── invite/[code]/
        │   ├── login/, page.tsx, layout.tsx, globals.css
        ├── auth.ts, middleware.ts
        ├── components/        # ~25 React components
        ├── lib/
        │   ├── transactions.ts, trips.ts, splits.ts, members.ts, invites.ts
        │   ├── ledgers.ts, categories.ts, recurring.ts, budgets.ts
        │   ├── push.ts, ocr.ts, quick-parser.ts
        │   ├── insights.ts, insights-ai.ts        # MoM compare + AI summary
        │   ├── fx.ts, currencies.ts                # FX fetcher + 32 currencies
        │   ├── jaitang-csv.ts, numbers-parser.ts   # 2 import formats
        │   ├── import-mapper.ts, backup.ts
        │   ├── active-ledger.ts, active-trip.ts    # cookie-backed selection
        │   ├── session.ts, role.ts                 # auth helpers
        │   ├── business-tz.ts, date-range.ts       # Asia/Bangkok TZ math
        │   ├── locale-format.ts, period.ts
        │   ├── types.ts, utils.ts
        │   └── supabase/server.ts
        └── messages/          # th.json / en.json / ja.json / zh.json (~340 strings each)
```

---

### Multi-language

รองรับ **ไทย** (default) + **English** + **日本語** + **中文** — สลับได้จาก `/settings` → "ภาษา"

**Stack:**
- [`next-intl`](https://next-intl-docs.vercel.app/) สำหรับ messages + ICU formatting
- Locale เก็บใน cookie `jt_locale`
- Message catalogs: `src/messages/{th,en,ja,zh}.json` (~340 strings/file)
- Currency/date formatters รับ locale ทุกที่

**เพิ่มภาษาใหม่:**
1. เพิ่ม locale ใน `src/i18n/locales.ts` (เช่น `"vi"`)
2. สร้าง `src/messages/vi.json` (copy จาก `en.json` แล้วแปล)
3. เพิ่ม mapping ใน `src/lib/locale-format.ts` ถ้าต้องการ Intl tag พิเศษ

จบ — language switcher จะเห็นตัวเลือกใหม่อัตโนมัติ

---

### Timezone correctness

Jaitang ใช้ **Asia/Bangkok (UTC+7)** เป็น "business timezone" สำหรับ:
- Bucket รายการเข้าวัน/เดือน (Calendar, Insights, Dashboard)
- Range filter "เดือนนี้/เดือนก่อน" — ขอบเขตคือเที่ยงคืน Bangkok ไม่ใช่ UTC
- Group by day ใน Transactions list ใช้ browser timezone

หมายความว่า: รายการที่ user จดตอน 02:00 น. กรุงเทพของวันที่ 1 พ.ค. → ขึ้นวันที่ 1 พ.ค. ใน UI (ไม่ใช่ 30 เม.ย. แบบที่ JS default จะให้)

ทดสอบครอบคลุมในชุด tests — `lib/utils.test.ts`, `lib/date-range.test.ts`, `lib/datetime-roundtrip.test.ts`

---

## 🇬🇧 English

### What is this?

**Jaitang** ("heart-pocket" in Thai) is a PWA expense tracker for personal and household use, with first-class support for overseas trips: log in JPY, store the FX-converted home amount, and the rest of the app keeps working in your home currency.

### Features at a glance

- 📝 **Track**: income/expenses with categories (now with two-level subcategories: Transport → BTS / Taxi / Grab), notes, payment methods, trip tags
- 📊 **Reports**: dashboard + per-day heatmap calendar + month-over-month insights with AI summary
- ✈️ **Trips + Multi-currency**: create trip with native currency, all entries auto-tag, live FX preview, snapshot rate at submit
- 💰 **Budgets**: per-category monthly with traffic-light progress; parent budgets roll up child spend
- 🔁 **Recurring**: daily / weekly / monthly / **yearly** + **variable-cost mode** (leave amount blank for ค่าไฟ-style bills, fill in when the bill arrives)
- 👥 **Shared ledgers**: every ledger is shareable (including the personal one) via link/QR, owner/editor/viewer roles
- 💸 **Bill splitting**: equal-split with cent precision, settle-up flow
- 📸 **AI receipt OCR**: receipts + bank/PromptPay slips parsed via Claude
- ✨ **AI quick add**: type "coffee 65" → categorized + saved
- 🔍 **Search + filters**: full-text on notes, range/category/trip/currency filters
- 🔔 **Web push**: per-device opt-in for shared-ledger activity
- 📥 **CSV + JSON**: export/import + full backup/restore
- 🎨 **5 icon styles**: Sticker Pop / Doodle / Watercolor / Geometric / Pixel — pick in Settings, swaps every icon app-wide
- 🌗 **Theme + i18n**: dark mode + 6 accents + 4 seasonal palettes, 4 languages (TH/EN/JA/ZH)
- 🔒 **Danger zone**: wipe ledger transactions or delete all owned data
- 📱 **PWA**: installable, offline shell, service worker

### Multi-currency × Trip walkthrough

1. Create a trip "Japan Trip" — pick currency JPY → trip activates
2. A banner pins under the navbar: "🏖️ Japan Trip · JPY · new entries auto-tagged"
3. Add a transaction: "ramen 1500" — currency dropdown auto = JPY
4. Live preview below the input: `≈ ฿350.00 (rate 0.2333 / 1 JPY)`
5. On submit, server re-fetches the rate (Frankfurter → exchangerate.host fallback) and stores all of: home amount, JPY amount, rate snapshot
6. Dashboard/budgets/insights still in home currency. Trip detail page shows JPY native + ≈ THB.
7. Toggle dashboard to "JPY" pills row to see the trip in native currency.

### Tech Stack

Same as Thai section above.

### Quick start

```bash
cd app
cp .env.example .env.local        # fill in real values
npm install
npm run dev                       # http://localhost:3000
npm test                          # 113 unit tests
```

You'll need:
- Google OAuth credentials (required)
- Supabase project + run `supabase/schema.sql` (required, idempotent)
- `ANTHROPIC_API_KEY` (optional — AI OCR + quick parse + insights summary)
- VAPID keys: `npx web-push generate-vapid-keys` (optional — push)

Full guide: [`app/SETUP.md`](./app/SETUP.md)

### Architecture notes

- **Auth**: Auth.js v5 with JWT sessions; on sign-in, user upserted to `public.users`; `users.id` stashed in token
- **Active context**: cookie-backed for ledger (`jt_active_ledger`) and trip (`jt_active_trip`), each validated against ownership/membership before serving any request
- **Permissions**: `requireSession()` returns `{userId, ledgerId, role, ledger, activeTripId}` and helpers `assertWritable()` / `assertOwner()`
- **Splits**: stored only for non-payer users; payer carries their share implicitly. Net balances computed on read; reciprocal debts cancel out
- **Push**: VAPID-based, per-device subscriptions; dead 404/410 endpoints cleaned up automatically
- **Recurring**: backfill on demand (no background worker required); capped at 12 iterations per rule per call
- **FX**: Snapshot at submit time. `amount` is always home currency; `fx_currency`/`fx_amount`/`fx_rate` are an all-or-none triple enforced by a Postgres CHECK constraint
- **Timezone**: server uses `Asia/Bangkok` for date bucketing; client `<TransactionList>` uses browser TZ for grouping. All datetime-local inputs SSR with empty value, populated client-side via ref to avoid UTC server-time leaking into the form

### Multi-language support ✅

Ships with **Thai** (default), **English**, **Japanese**, **Chinese** — switchable in `/settings` → "Language".

**Stack:**
- [`next-intl`](https://next-intl-docs.vercel.app/) for messages and ICU formatting
- Locale stored in `jt_locale` cookie
- Message catalogs in `src/messages/{th,en,ja,zh}.json`
- All currency/date formatters take a locale argument

**Adding another language:**
1. Append the new locale to `src/i18n/locales.ts` (e.g. `"vi"`)
2. Create `src/messages/vi.json` (start from `en.json` and translate)
3. Optionally extend `src/lib/locale-format.ts` for a special Intl tag

The language switcher picks up the new option automatically.

### Project Status

- **113 unit tests** passing
- **Timezone-correct** server-side date math (Asia/Bangkok)
- **Multi-currency × Trip** end-to-end (32 currencies, 2-source FX fallback)
- **AI-assisted** OCR / quick parse / monthly insights summary
- **5 icon styles** (Sticker / Doodle / Watercolor / Geometric / Pixel) — runtime switcher in Settings
- **Subcategories** (parent → child, 2 levels) with parent-only budget rollup
- **Variable-cost recurring rules** for unpredictable bills (ค่าไฟ / ค่าน้ำ)
- **Every ledger shareable** including the personal one
- **4 languages** localized
- TypeScript clean, ESLint clean
- 🦐 Built with [Claude Code](https://claude.com/claude-code) over many sessions

### License

MIT (or whatever you prefer — set this when publishing)
