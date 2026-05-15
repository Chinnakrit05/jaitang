# Jaitang (ใจถัง)

> **Heart-pocket ledger** — a thoughtful expense tracker for Thai households, freelancers, travelers, and anyone who wants to know exactly where their money goes.

Multi-currency, multi-ledger, AI-aware, PWA-installable. Built for Thai but speaks English/Japanese/Chinese fluently.

🇹🇭 อ่านภาษาไทย → [`README.th.md`](./README.th.md)

---

## ✨ Features

### Capture
- **Quick add** — 2-3 taps to log a transaction with category, payment method, account, trip, and note.
- **Receipt OCR** — snap a photo of a receipt or PromptPay/bank slip → AI fills the form (amount, date, category, merchant note). Inherits the active trip when scanned.
- **Auto-categorizer** — type a note like "กาแฟ" → tap ✨ → AI picks the category from your list.
- **Note autocomplete** — past notes pop up in a `<datalist>` ranked by usage frequency. Type "ก" → "กาแฟ", "ก๋วยเตี๋ยว" appear.
- **CSV import** — auto-detects Jaitang format vs Apple Numbers vs generic columns. Preserves trip / payment method / FX.
- **Recurring transactions v2** — set rules with optional account, trip, and foreign currency. Cron materializes them into real tx with correct FX rate at run time. Frequency: daily / weekly / monthly / **yearly**. Amount can be left blank for variable-cost bills (electricity, water) — a "Bills to file" panel surfaces them when due so the user can plug the amount in once the bill arrives.

### Organize
- **Categories** — seeded defaults; full CRUD with icons + colors. **Subcategories** (two levels max, e.g. Transport → BTS / MRT / Taxi / Grab) — picker can pick parent or sub; budgets at parent level roll up sub spend.
- **Trips** — multi-currency travel folders. Pick a currency, log expenses in that currency, see breakdown back in home currency.
- **Accounts / Wallets** — cash, bank, credit card, e-wallet. Per-account balance computed live from transactions + transfers.
- **Transfers between accounts** — same-currency or cross-currency (Wise-style: enter the actual received amount, system derives the rate).
- **Goals** — savings targets with deadlines, contribution log, AI nudge per goal.
- **Loans** — track money lent or borrowed (counterparty outside the system, partial repayments, auto-settle when fully repaid).
- **Trip + Goal archive** — keep history without cluttering the active list.

### Understand
- **Dashboard** — defaults to today; sliders for yesterday / 30d / month / YTD / all. Foreign-currency toggle.
- **Account balances widget** — top 4 accounts at a glance + home-currency total.
- **Net Worth tracker** — area chart of total net worth over the past 12 months, with month-over-month delta.
- **Per-account chart** — balance trend per account in its own currency.
- **Calendar / heatmap** — month grid with intensity by spending; tap a day to see entries.
- **Insights (MoM)** — compare this month vs last; categories trending up/down; AI commentary.
- **Year-end report** — annual review at `/insights/year/[year]` with monthly bars, top categories, biggest tx, AI year-in-review narrative. Print to PDF via browser.
- **Subscription tracker** — monthly cost rollup (per currency) + "next 30 days" upcoming preview.
- **Search** — substring match on transaction notes with highlighted matches.

### Money quality-of-life
- **Multi-currency with live FX** — Frankfurter primary + exchangerate.host fallback, in-memory cache. 32 currencies (10 pinned, 22 alphabetical).
- **Account reconciliation** — type your bank's actual balance → compare with system → log a one-click adjustment tx if they differ. Foreign-currency aware.
- **Splits** — share a bill with members in shared ledgers, equal split, balance settling per pair.
- **Multi-ledger** — personal + shared books. Switch via cookie, distinct from the URL.

### AI assistant
- **Chat** — `/chat` page where you ask in plain language: "เดือนนี้ใช้ไปเท่าไหร่?", "เปรียบเทียบเดือนนี้กับเดือนที่แล้ว", "ใช้ค่ากาแฟไปเท่าไหร่ใน 30 วัน". Claude Haiku with read-only tools (list tx, sum by period, breakdown by category, list accounts, MoM compare).

### Platform
- **i18n** — Thai / English / Japanese / Chinese, all UI strings.
- **PWA** — manifest + install prompt (Chromium auto, iOS Safari with manual hint). Works offline-tolerant.
- **Push notifications** — Web Push API for new transactions in shared ledgers, settlements.
- **Light + dark theme** — system-aware default with manual toggle. 6 accents + 4 seasonal palettes.
- **5 icon styles** — Sticker Pop (default) / Doodle / Watercolor / Geometric / Pixel Art. Pick in Settings → Icon style; the chosen sprite swaps every `<JtIcon>` in the app instantly. Persisted in `localStorage["jt-icon-style"]`.
- **Shared ledgers** — every ledger (including the auto-created personal one) can be invited via link/QR with owner/editor/viewer roles.
- **Backup / restore** — JSON export + import for full migration (categories, tx, trips, goals, accounts, transfers, recurring, splits).

---

## 🚀 Setup

### Local dev

```bash
cp .env.example .env.local        # fill in per SETUP.md
npm install
npm run dev
```

Open <http://localhost:3000>.

See [`SETUP.md`](./SETUP.md) for: Google OAuth setup, Supabase project, env vars, and the schema migration step.

### Schema

`supabase/schema.sql` is **fully idempotent** — copy/paste the whole file into the Supabase SQL Editor. Re-running is safe; tables and indexes use `if not exists`, types use exception-catching `do $$ ... $$` blocks.

### AI features (optional)

Set `ANTHROPIC_API_KEY` to enable: OCR, auto-categorizer, goal nudges, monthly insights summary, year-end commentary, AI chat. Without the key, the app degrades to deterministic fallbacks (or hides the AI feature).

### FX rates

Free, no key needed. Frankfurter (primary) → exchangerate.host (fallback). 24h in-memory cache.

---

## 🛠 Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript 5** + **Tailwind CSS v4**
- **Auth.js v5** — Google OAuth
- **Supabase** (Postgres) — service-role on server, RLS as defense-in-depth
- **Anthropic SDK** — Claude Haiku 4.5 for OCR, suggestions, chat (with tool-use), commentary
- **next-intl** — i18n in 4 languages
- **next-themes** — theme management
- **Recharts** — charts
- **Zod** + **react-hook-form** — validation + forms
- **web-push** — Web Push API
- **JSZip** — backup/restore archives
- **Vitest** — tests run with `TZ=Asia/Bangkok`

---

## 📁 Project layout

```
src/
├── app/
│   ├── (app)/                        # protected routes
│   │   ├── dashboard/                # home — today's snapshot
│   │   ├── transactions/             # list, new, edit, export
│   │   ├── accounts/                 # /, /[id], FX-aware balances
│   │   ├── transfers/new/            # cross-currency transfers
│   │   ├── trips/                    # /, /[id], multi-currency trips
│   │   ├── goals/                    # /, /[id], savings targets
│   │   ├── loans/                    # /, /[id], lent/borrowed tracking
│   │   ├── recurring/                # subscription tracker + rule mgmt
│   │   ├── budgets/                  # per-category month budgets
│   │   ├── balances/                 # split-bill balances (shared ledgers)
│   │   ├── calendar/                 # heatmap view
│   │   ├── insights/                 # MoM compare + /year/[year] report
│   │   ├── chat/                     # AI assistant
│   │   ├── ledgers/                  # ledger switcher
│   │   ├── categories/               # category mgmt
│   │   ├── import/                   # CSV import wizard
│   │   ├── settings/                 # theme, lang, push, danger zone
│   │   └── layout.tsx                # nav shell + active trip banner + install prompt
│   ├── (auth)/login/                 # Google sign-in
│   ├── api/auth/[...nextauth]/       # Auth.js handlers
│   └── layout.tsx
├── auth.ts                           # Auth.js config
├── components/                       # presentational + interactive UI
├── lib/                              # server-side libs (per feature)
│   ├── transactions.ts               # tx CRUD + listDistinctNotes
│   ├── accounts.ts                   # balance computation
│   ├── transfers.ts                  # cross-currency transfer math
│   ├── trips.ts / goals.ts / loans.ts
│   ├── recurring.ts                  # cron + materialize
│   ├── insights.ts                   # MoM aggregation
│   ├── year-report.ts                # 12-month aggregation
│   ├── net-worth.ts                  # historic series
│   ├── fx.ts                         # FX with fallback + cache
│   ├── currencies.ts                 # 32 supported codes
│   ├── ocr.ts                        # receipt vision
│   ├── categorize-ai.ts              # category suggester
│   ├── goals-ai.ts / insights-ai.ts / year-report-ai.ts
│   ├── chat-ai.ts                    # tool-use loop
│   ├── backup.ts                     # JSON export/restore (full ledger)
│   ├── jaitang-csv.ts                # CSV export/import format
│   ├── business-tz.ts                # Asia/Bangkok date helpers
│   ├── date-range.ts                 # today/month/30d/etc resolvers
│   ├── splits.ts                     # equal-split math
│   ├── push.ts                       # Web Push
│   └── supabase/                     # client + server factories
├── messages/                         # th.json / en.json / ja.json / zh.json
└── middleware.ts                     # route protection

supabase/
└── schema.sql                        # idempotent — run once / re-run safely

public/
└── manifest.json                     # PWA manifest
```

---

## 🧪 Testing

```bash
npm test               # vitest run, TZ=Asia/Bangkok pinned
npm run test:watch     # watch mode
```

**113 tests across 14 files** covering: transactions aggregation, FX caching, trip math, account balance computation, transfer normalization, goals stats, splits, role checks, datetime round-trips, BUSINESS_TZ ranges, CSV round-trips, day-grouping in TZ.

---

## 🔧 Conventions

- **Server actions** for mutations (no REST). Client components call them via `useTransition`.
- **`requireSession()`** is React-cached — multiple calls in the same request share one auth + ledger fetch.
- **All datetime parts** in `lib/business-tz.ts` use `Asia/Bangkok` so day boundaries align with the user, not the server.
- **FX trio constraint**: `fx_currency`, `fx_amount`, `fx_rate` are all-or-nothing per transaction. The DB enforces it; the form ensures it.
- **Cookie-backed active selections**: `active-ledger`, `active-trip`. Cleared automatically on cross-ledger access.
- **i18n keys** are namespaced per feature (`accounts.*`, `trips.*`, `chat.*`, etc.). Adding a new feature follows: schema → types → lib → action → component → page → 4-lang i18n → nav → test → verify.

---

## 📚 More

- [`SETUP.md`](./SETUP.md) — first-time provisioning
- `../SPEC.md` / `../ROADMAP.md` — design intent (parent folder)
- `supabase/schema.sql` — full DB schema

Made with 🦐
