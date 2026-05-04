# Jaitang — Icon Brief for Redesign

This is a complete inventory of every icon used in the app today, plus a list of icons we'll likely need as new features land.

The app currently uses **Lucide** as the line-art icon set (one weight, ~1.5px stroke) and **emoji** for user-picked decorative icons (categories, accounts, trips, goals). For the redesign, please replace all Lucide icons with custom artwork; you can choose to either replace the emoji palette with custom monochrome glyphs, or keep emoji and just match weight/style with the rest.

---

## 🎨 Style notes for the designer

- **Sizes used in code**: 12, 13, 14, 16, 18, 20, 22, 26, 28 px (most common: 14, 16, 18). Optimize legibility at 14px.
- **Stroke**: matches Lucide's ~1.5–2px stroke. Single weight; no fills (except the income/expense direction arrows where a slight emphasis helps).
- **Visual rhythm**: navigation icons sit in 24×24 boxes, action icons in 18×18.
- **Color**: icons inherit `color: currentColor` from the parent. Do NOT bake in colors. The app theme has `--accent` (cyan), `--income` (green), `--expense` (red), `--muted` (gray), `--foreground`.
- **Bilingual**: app supports TH/EN/JA/ZH — icons must read without text labels.
- **Mobile-first**: icons must remain crisp on a 375px-wide phone.

---

## 1. Navigation icons

Used in the sidebar (desktop) and bottom tab bar (mobile). Each represents an entire app section.

| Icon name | Section | Current Lucide | Notes |
|---|---|---|---|
| `home` | Dashboard / home | `LayoutDashboard` | The app's first screen — summary tiles |
| `quick` | Quick add | `Sparkles` | Single-tap "log a transaction" express form |
| `transactions` | Transactions list | `ListOrdered` | Table-style list of every entry |
| `calendar` | Calendar / heatmap | `CalendarDays` | Month grid colored by spending intensity |
| `insights` | Insights / MoM compare | `LineChart` | Analytics: comparisons, trends |
| `chat` | Ask AI | `MessageCircle` | AI assistant page |
| `budgets` | Budgets | `PiggyBank` | Per-category monthly limits |
| `recurring` | Recurring / subscriptions | `Repeat` | Monthly/weekly/daily auto-tx rules |
| `balances` | Bill split balances | `Scale` | Who owes whom in a shared ledger |
| `accounts` | Accounts / Wallets | `Wallet` | Cash, bank, credit, e-wallet pots |
| `loans` | Loans (lent / borrowed) | `HandCoins` | Money lent to or borrowed from people |
| `trips` | Trips | `Plane` | Travel folders (Tokyo trip, etc.) |
| `goals` | Savings goals | `Target` | "Korea trip 100k" style targets |
| `categories` | Category management | `FolderTree` | Edit category list |
| `ledgers` | Ledger switcher | `BookOpen` | Personal book + shared books |
| `import` | CSV / JSON import | `Upload` | Bring data in from spreadsheets / backups |
| `settings` | Settings | `Settings` | Theme, lang, push, danger zone |
| `more` | "More" overflow on mobile | `MoreHorizontal` | Mobile bottom-nav opens this for hidden items |

---

## 2. Action icons

Buttons, inline controls, row affordances.

| Icon name | Used for |
|---|---|
| `Plus` | Add a new entry (transaction, trip, goal, loan, account, …) |
| `Pencil` | Edit row / modal trigger |
| `Trash2` | Delete row |
| `X` | Close modal / dismiss banner / remove from set |
| `Check` | Confirm / accept |
| `CheckCircle2` | Success state — settled loan, completed goal, reconciled account |
| `Search` | Search input affordance |
| `Send` | Send message in chat |
| `Download` | Save as PDF (year report) / export CSV |
| `Upload` | Import CSV / restore JSON |
| `RefreshCw` | Refresh / "run now" button on recurring rules |
| `RotateCcw` | Reopen settled loan / undo state |
| `Pause` | Pause recurring rule |
| `Play` | Resume recurring rule |
| `Archive` | Archive trip / goal / account |
| `ArchiveRestore` | Unarchive |
| `Eraser` | Clear / reset (used in danger zone) |
| `Copy` | Copy to clipboard (invite link) |
| `Share` | Share button (iOS install hint) |
| `Camera` | Receipt scan trigger |
| `LogOut` | Sign out |

---

## 3. Status / signal icons

Inline marks that communicate state without reading text.

| Icon name | Meaning |
|---|---|
| `TrendingUp` | Income, going up, increase |
| `TrendingDown` | Expense, going down, decrease |
| `Minus` | Flat / no change |
| `AlertTriangle` | Warning — overdue loan, FX rate stale |
| `AlertCircle` | Generic error / problem |
| `HelpCircle` | Help / hint |
| `Bell` | Notifications enabled |
| `BellOff` | Notifications muted |
| `Loader2` | Loading spinner (rotate animation) |
| `Sparkles` | AI-touched content / suggestion |
| `Bot` | AI assistant avatar in chat bubble |
| `User` | User avatar fallback in chat bubble & member rows |
| `Users` | Shared ledger / multi-user feature |
| `Globe` | Language / locale picker |
| `Sun` | Light theme |
| `Moon` | Dark theme |
| `Flame` | "Hottest" / top-spending day badge |
| `CalendarCheck` | Active days stat on calendar page |

---

## 4. Domain / context icons

Icons that label a concept (account type, transaction direction, etc.).

| Icon name | Meaning |
|---|---|
| `Banknote` | Cash payment method, Cash account type |
| `Landmark` | Bank account type, "transfer" payment method |
| `CreditCard` | Credit card account type |
| `Smartphone` | E-wallet account type, also iOS install hint |
| `Wallet` | Generic account / money pot |
| `HandCoins` | Loans (lending or borrowing) |
| `ArrowUpRight` | Money sent out / lent |
| `ArrowDownLeft` | Money received / borrowed |
| `ArrowLeftRight` | Transfer between accounts |
| `ArrowRight` | Forward/next/transfer-direction inline |
| `ArrowLeft` | Back navigation |
| `ChevronLeft` | Previous (calendar, insights month nav) |
| `ChevronRight` | Next (calendar, insights month nav) |
| `ChevronDown` | Expand / dropdown |
| `Plane` | Trip (travel) |
| `Target` | Savings goal |
| `PiggyBank` | Budget |
| `Layers` | Subscription stack / monthly cost rollup |
| `Calendar` | Generic date picker / scheduled item |
| `LineChart` | Analytics / chart context |
| `BarChart3` | Bar chart context (currently used in some legend) |
| `Scale` | Reconcile / balance / compare |

---

## 5. Emoji palettes (user-picker)

Users pick one of these emojis when creating an account, trip, or goal. Designer can either:
- **Replace each emoji with a custom monochrome glyph** that scales to 24px–48px — preferred, gives the app a unified look.
- **Keep emoji** and just ensure surrounding chrome looks polished against them.

### 🏦 Account types (default 8)

```
💵   cash bill        (Cash)
🏦   bank building    (Bank — savings/checking)
💳   credit card      (Credit card)
📱   phone            (E-wallet)
💰   money bag        (Generic / piggy / savings)
👛   coin purse       (Cash sub-pot)
🏧   ATM              (ATM-stored cash)
🪙   gold coin        (Coin / generic)
```

### ✈️ Trip icons (default 10)

```
✈️   airplane         (Generic travel)
🏖️   beach            (Beach / vacation)
🏔️   mountain         (Hiking / nature)
🍜   ramen            (Food trip)
🎉   party            (Celebration trip)
🎒   backpack         (Backpacking)
🚗   car              (Road trip)
🛳️   cruise ship      (Cruise)
🏕️   camping          (Camping)
🎁   gift             (Special-occasion trip)
```

### 🎯 Goal icons (default 10)

```
🎯   bullseye         (Generic goal)
✈️   airplane         (Travel goal)
🏖️   beach            (Vacation goal)
🏠   house            (House / down-payment)
🚗   car              (Vehicle goal)
💍   ring             (Wedding / engagement)
🎓   graduation cap   (Education)
💻   laptop           (Gadget / equipment)
🎮   game controller  (Hobby / luxury)
🛒   shopping cart    (Big purchase)
```

### 🍜 Category icons (default 13)

These come from `seed_default_categories`. Used at sign-up; users can add their own with any emoji.

```
EXPENSE
🍜   ramen            (Food)              — orange  #f97316
🚗   car              (Transport)          — blue    #3b82f6
🛒   shopping cart    (Groceries / shop)   — purple  #a855f7
🎮   game controller  (Entertainment)      — pink    #ec4899
💊   pill             (Health)             — green   #10b981
🏠   house            (Housing)            — slate   #64748b
📚   books            (Education)          — sky     #0ea5e9
✨   sparkle          (Other)              — gray    #94a3b8

INCOME
💰   money bag        (Salary)             — green   #22c55e
🎁   gift             (Bonus / gift)       — lime    #84cc16
🏷️   tag              (Sales)              — teal    #14b8a6
📈   trending-up      (Investment)         — cyan    #06b6d4
✨   sparkle          (Other)              — gray    #94a3b8
```

### 🎨 Color palette (8 colors per picker)

These pair with the icon picker. Used for cards, badges, chart accents.

```
Green    #10b981   (default for accounts)
Cyan     #06b6d4
Blue     #3b82f6   (default for trips)
Purple   #a855f7
Pink     #ec4899
Amber    #f59e0b
Red      #ef4444
Slate    #64748b
```

---

## 6. Future icons (planned features)

These will be needed in the next 2-3 features the team is considering. Designing them now alongside the rest avoids style drift later.

| Icon name | Purpose | Lucide reference |
|---|---|---|
| `Receipt` | Receipt photo storage / list | `Receipt` |
| `ScanLine` | Scan-receipt CTA upgrade | `ScanLine` / `ScanText` |
| `FileText` | Tax export / annual statement | `FileText` |
| `TrendingFlat` | Net change ≈ 0 indicator | (composite) |
| `Bell` | Budget alert push trigger | `Bell` |
| `Gauge` | Forecast / projected end-of-month | `Gauge` |
| `Mic` | Voice-input transaction | `Mic` |
| `Volume2` | Voice-input listening state | `Volume2` |
| `Lightbulb` | Smart insight / proactive nudge | `Lightbulb` |
| `Zap` | Streak / quick action | `Zap` |
| `Coffee` | Subscription category (Spotify, etc. — quick filter) | `Coffee` |
| `Building2` | Investment tracker (stocks) | `Building2` |
| `Bitcoin` | Crypto holdings (if added) | `Bitcoin` |
| `EyeOff` | Privacy mode (hide amounts) | `EyeOff` |
| `Eye` | Privacy mode toggle (show) | `Eye` |
| `Filter` | Bulk-edit / multi-select filter | `Filter` |
| `CheckSquare` | Bulk select state | `CheckSquare` |
| `Square` | Bulk unselect state | `Square` |
| `Keyboard` | Keyboard shortcuts panel | `Keyboard` |
| `Mail` | Email digest / report delivery | `Mail` |
| `Link2` | Linked account / external bank link | `Link2` |
| `Tag` | Tags on transaction (mood, project) | `Tag` |
| `Map` | Bills tracker — location / utility map | `Map` |
| `FileBarChart` | Year report / tax-year statement | `FileBarChart` |
| `Inbox` | Onboarding / unread notifications | `Inbox` |
| `Award` | Goal achieved badge | `Award` |
| `Flag` | Milestone / important marker | `Flag` |
| `Clock` | Reminder / timer / scheduled | `Clock` |
| `History` | Activity log / audit trail | `History` |
| `ShieldCheck` | 2FA / security settings | `ShieldCheck` |

---

## 7. Quick stats

- **Lucide icons currently used**: ~70 unique
- **Emoji choice palettes**: 4 sets × ~10 each = ~40 unique emoji
- **Default category seeds**: 13 emoji + 13 colors
- **Future icons**: ~30 additions expected
- **Total scope for redesign**: ~140 distinct glyphs

---

## 8. Reference link

Existing Lucide icons can be browsed at <https://lucide.dev> — typing the icon name in the search box shows the current line-art. Use those as a starting point for shape/proportion, then redraw in your style.

---

If you want to receive everything as raw SVGs, run this in the repo:

```bash
# Lucide ships SVGs in node_modules
ls app/node_modules/lucide-react/dist/esm/icons/
```

Or grab originals from <https://github.com/lucide-icons/lucide/tree/main/icons>.
