# UI Blueprint — Dashboard, Trades, Trade Detail

Companion to **`DESIGN.md`**. Concrete layouts and component hierarchy only—**no implementation**.

**Viewport baseline:** desktop **≥ 1280px** width unless noted. Mobile stacks vertically with same priority order.

---

## Priority zones (global)

| Zone | Meaning |
|------|---------|
| **P1** | Must be visible without scroll on first paint (above the fold). |
| **P2** | Visible with minimal scroll; supports decisions. |
| **P3** | Supporting detail; scroll acceptable. |

---

## 1. Dashboard layout (primary surface)

### 1.1 Grid definition (12-column)

Assume **full viewport width** inside app chrome (nav). Vertical rhythm in **three bands**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ROW A — REGIME STRIP                         height: ~56–72px (fixed)   P1   │
│  col 1–12  (100% width)                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ ROW B — METRICS + EQUITY                     height: ~320–420px (flex)   P1   │
│  ┌─────────────────────────────┬───────────────────────────────────────────┐   │
│  │ METRICS BLOCK               │ EQUITY CHART                               │   │
│  │ col 1–5  (~42%)             │ col 6–12 (~58%)                            │   │
│  │ min-height 280px            │ min-height 280px                         │   │
│  └─────────────────────────────┴───────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ROW C — TRADE TABLE PREVIEW                  height: remainder / min 280px P2 │
│  col 1–12  (100% width)                                                       │
│  capped preview rows (see §3–4)                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Section | Position | Width | Height (relative) | Priority |
|---------|----------|-------|-------------------|----------|
| **A — Regime strip** | Row 1, full bleed | **100%** (12/12 cols) | **Low fixed** (~56–72px); never steals vertical space from metrics | **Primary** (informational gate) |
| **B — Metrics** | Row 2, left block | **~42%** (5/12 cols) | **High** (~35–40% of main content area below nav) | **Primary** |
| **B — Equity** | Row 2, right block | **~58%** (7/12 cols) | Same row height as metrics | **Primary** |
| **C — Trade preview table** | Row 3, full bleed | **100%** (12/12 cols) | **Flexible**: fills remaining viewport; **min-height** ~280px so ledger always “exists” on dashboard | **Secondary** (preview; full ledger on `/trades`) |

**Breakpoints (intent):**

- **< 1024px:** Row B stacks: Metrics **above** Equity (both still P1). Regime strip stays full width on top.
- **< 768px:** Row C table horizontal scroll; sticky column rules in §4.

---

### 1.2 ASCII — full page stack

```
┌ App shell (nav: logo | Dashboard | Trades | … | Sign out) ────────────────────┐
│                                                                                 │
│  Dashboard                                                           [+ Log]   │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  ┌ REGIME STRIP (Gate 1) ────────────────────────────────────────────────────┐ │
│  │ VNINDEX · PASS │ reasons… │ Updated … UTC                                   │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│  ┌ METRICS (grid/tiles) ────────────────┐ ┌ EQUITY (chart + subtitle) ────────┐ │
│  │ Closed | Open | Win% | Cum P&L …    │ │ Line chart, cumulative realized    │ │
│  │ (Performance Edge row optional)      │ │                                    │ │
│  └──────────────────────────────────────┘ └────────────────────────────────────┘ │
│  Recent trades ────────────────────────────────────────────────────────────────   │
│  ┌ table preview (see trades columns, max ~8–12 rows) ────────────────────────┐ │
│  │ …                                                                           │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│  [ View all trades → ]                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.3 Component hierarchy — Dashboard

```
DashboardPage
├── PageHeader
│   ├── Title ("Dashboard")
│   └── PrimaryAction ("Log trade")
├── RegimePanel (Gate 1)              [optional wire-up; placeholder OK until data]
├── SplitMain (Row B)
│   ├── MetricsCluster
│   │   ├── MetricTile × N (KPI band)
│   │   └── MetricTile × M (Performance Edge band — optional second row)
│   └── EquityPanel
│       ├── SectionLabel + helper text
│       └── EquityChart (Recharts or equivalent)
├── TradePreviewSection
│   ├── SectionHeader ("Recent trades" | link "View all")
│   ├── TradeTable (dense preview)
│   └── EmptyState (if no trades)
└── (Future) PlaybookPerformanceTable — **secondary**; below preview or collapsible; not blocking P1
```

**Priority zones:**

- **P1:** `PageHeader`, `RegimePanel`, `MetricsCluster` top row, `EquityPanel`, first rows of `TradeTable`.
- **P2:** Extra metric rows, playbook breakdown table, “View all”.
- **P3:** Footer hints, long helper copy.

---

## 2. Regime panel (Gate 1)

### 2.1 Placement & visibility

| Attribute | Decision |
|-----------|----------|
| **Placement** | **Top strip** directly under page title row (above metrics + equity). |
| **Always visible** | **Yes** on Dashboard once Gate 1 is wired. If no DB bars / insufficient history: strip **still visible** with **WARNING** copy per product logic—never hide the affordance silently. |
| **Size** | **Horizontal strip** (not a tall card). Single row on desktop; wraps to 2 lines max on narrow screens before truncation rules apply. |
| **NOT** | A competing “hero” card; height capped so Row B retains dominance. |

### 2.2 Content contract

| Element | Rule |
|---------|------|
| **Symbol** | Left cluster: e.g. `VNINDEX` (monospace). **Always shown** when regime is active. |
| **Level** | `PASS` \| `WARNING` \| `FAIL` — word + semantic styling (see §2.4). Never icon-only. |
| **Reasons** | **Max 2 lines** visible in strip (~120–160 chars per line desktop); if more, truncate with **“+N”** or single **“View reasons”** expansion **inside strip** (future). No multi-paragraph prose in strip. |
| **Last updated** | Right-aligned cluster: `Updated YYYY-MM-DD HH:mm UTC` (or fixed TZ policy). Small tertiary type. |

### 2.3 Visual rules

| Rule | Detail |
|------|--------|
| **Color** | PASS = restrained green border or left accent bar (not full green background). WARNING = amber/neutral border. FAIL = red accent. Background stays near page bg—**signal via border + label**, not full-width flood fill. |
| **Spacing** | Padding **12–16px** vertical; **16–24px** horizontal inside strip; **8px** gap between symbol cluster and level cluster. |
| **Typography** | Symbol: mono, **secondary** size. Level: **semibold**, same size as body emphasis. Reasons: **regular**, one step smaller than title. Updated: **caption**, tertiary color. |

### 2.4 ASCII — regime strip only

```
│ VNINDEX    [ WARNING ]   Close … vs MA50 … · Momentum …          Updated 2026-05-04 14:30 UTC │
└── mono ──── └── pill ─── └── max 2 lines, ellipsis if needed ──────────────────────────────┘
```

---

## 3. Metrics block

### 3.1 Which metrics (dashboard KPI band)

**Row 1 (always):**

| Metric | Notes |
|--------|--------|
| Closed trades | Count |
| Open positions | Count |
| Win rate | % when closed > 0; else em dash |
| Cumulative P&L | Primary money emphasis; compact format (₫) |

**Row 2 (Performance Edge — optional band, same MetricsCluster):**

| Metric |
|--------|
| Expectancy |
| Profit factor |
| Max drawdown |
| Avg winner |
| Avg loser |
| Largest win |
| Largest loss |

### 3.2 Layout

- **KPI band:** **responsive grid** inside left column (5/12): **2×2** or **4×1** on wide screens for Row 1; stack 2 cols on narrow.
- **Performance Edge:** **single horizontal row of 7** on very wide; or **wrap** to 2 rows; **max without vertical scroll inside metrics block:** aim **10–12 metric tiles** visible (4 + 7) on 1280px height ~1080 viewport—if not, Performance Edge becomes **horizontally scrollable inner row** (optional) or wraps to P2 scroll—**prefer wrap** over scroll for gravitas.

### 3.3 Relative importance

1. **Cumulative P&L** — strongest visual weight (not larger font carnival—**semibold + color**).
2. **Closed / Open / Win rate** — equal secondary weight.
3. **Performance Edge** — tertiary band; smaller labels or single shared section title “Performance edge”.

---

## 4. Table layout — Trades list (`/trades`)

### 4.1 Column order (left → right)

| # | Column | Content |
|---|--------|---------|
| 1 | **Symbol** | Monospace, uppercase |
| 2 | **Direction** | LONG / SHORT pill |
| 3 | **Playbook** | Single label (e.g. Breakout → Pullback) |
| 4 | **Status** | PLANNED / OPEN / CLOSED / CANCELLED |
| 5 | **Entry date** | Short date |
| 6 | **Entry price** | Right-aligned |
| 7 | **Exit price** | Right-aligned or “—” |
| 8 | **Qty** | Right-aligned |
| 9 | **P&L** | Right-aligned; semantic color |
| 10 | **Actions** | Edit link/button |

### 4.2 Width priority

1. **Symbol** — narrow fixed (~100–120px effective).
2. **P&L** — enough for formatted ₫ compact (~100–140px).
3. **Entry/Exit price** — flexible mid.
4. **Playbook** — flexible; can truncate with tooltip later.
5. **Direction / Status** — minimal pill width.

### 4.3 Sticky columns

- **Desktop:** optional sticky **Symbol** if horizontal scroll enabled (narrow breakpoints).
- **Mobile:** **sticky Symbol** when table scrolls horizontally.

### 4.4 Density

- **Row height:** **compact** (~36–44px) — terminal-like; no luxurious vertical padding.
- **Header row:** **sticky** on long lists (implementation phase).
- **Zebra:** optional **subtle** alternating row bg for scan lines.

### 4.5 Dashboard preview vs full list

- **Preview:** same columns **except** optionally hide **Playbook** on preview only if width constrained—**prefer full parity**; if one column drops, drop **Exit date** column first (not on full list spec).

---

## 5. Trade detail page (`/trades/[id]`)

### 5.1 Layout structure

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER BAR (P1)                                                  │
│  Title: Edit trade                                               │
│  Subtitle row: SYMBOL · direction · status · playbook · P&L    │
│  [ Delete ]                                        (destructive) │
├─────────────────────────────────────────────────────────────────┤
│ CORE FORM (P1)                                                   │
│  Row grid: Symbol | Direction | Status                         │
│  Playbook read-only panel                                        │
│  Entry / Exit datetime                                           │
│  Entry price | Exit price                                        │
│  Quantity | Fees                                                  │
├─────────────────────────────────────────────────────────────────┤
│ NOTES (P2)                                                       │
│  Textarea — full width                                           │
├─────────────────────────────────────────────────────────────────┤
│ ACTIONS (P1)                                                     │
│  [ Update trade ]  [ Cancel → list ]                             │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Above the fold (desktop ~900px tall viewport)

**Must appear without scroll:**

- Page title **Edit trade**
- **Symbol, direction, status, playbook line** (subtitle)
- **Realized P&L** in subtitle when closed (colored)
- **Delete** affordance (top right)
- **First form row:** Symbol, Direction, Status fields
- **Playbook** read-only strip
- **Entry date** field start

**Below fold acceptable without hurting task:**

- Exit datetime, exit price (if long form)
- Fees, notes textarea lower half
- Submit row pinned visually near notes or bottom of card—**primary submit** should still be reachable with **one short scroll** if notes are long.

### 5.3 Component hierarchy — Trade detail

```
TradeDetailPage
├── HeaderCluster
│   ├── Title
│   ├── MetaLine (symbol · dir · status · playbook · pnl)
│   └── DeleteTradeButton
├── TradeForm
│   ├── FieldRow (symbol, direction, status)
│   ├── PlaybookReadOnlyPanel
│   ├── FieldRow (entry date, exit date)
│   ├── FieldRow (entry price, exit price)
│   ├── FieldRow (quantity, fees)
│   ├── NotesField
│   └── FormActions (submit, cancel)
```

---

## 6. Interaction notes (blueprint level)

| Interaction | Behavior |
|-------------|----------|
| **Dashboard → Trades** | “View all trades” navigates to `/trades`; filters not carried unless URL params defined later. |
| **Regime strip** | Read-only; no click-to-trade; optional future: expand reasons (not in initial scope). |
| **Trades table Edit** | Navigate to `/trades/[id]`; preserve sort/filter via URL when implemented. |
| **Trade save** | Redirect to `/trades` with list stable (existing product behavior). |
| **Delete** | Confirm dialog; plain copy (DESIGN.md). |

---

## 7. Summary diagram — three surfaces

```
                    ┌─────────────┐
                    │  Regime     │  ← advisory, top strip (Dashboard)
                    └─────────────┘
┌──────────────────┬──────────────────────┐
│ Metrics          │ Equity               │
└──────────────────┴──────────────────────┘
┌─────────────────────────────────────────┐
│ Trade preview table                     │
└─────────────────────────────────────────┘

/trades ───────────► full table (filters + all rows)

/trades/[id] ──────► header + form + notes (journal record)
```

---

*End of blueprint. Align implementation with **`DESIGN.md`** principles; adjust pixel values during build within the bands above.*
