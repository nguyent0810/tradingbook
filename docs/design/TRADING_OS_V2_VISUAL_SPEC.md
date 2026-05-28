# Trading OS Visual Spec v2

**Status**: APPROVED  
**Target Viewport**: Desktop $\ge$ 1280px (Responsive stack on mobile)  
**Metaphor**: Bloomberg (data-density & numeric honesty) + Linear/Vercel (visual hierarchy & clean typography)

---

## 1. Visual Direction & Principles

1. **Operator Focus**: Optimize for end-of-day (EOD) decision-making in under 5 seconds under fatigue.
2. **Depth Over Borders**: Define component regions using background surface shading instead of separating every block with outline borders.
3. **Numeric Honesty**: Tabular monospace numbers for prices, quantities, and dates, right-aligned to allow rapid vertical scanning.
4. **Stance-Appropriate Semantics**: Keep semantic colors restricted to status, risk, and P&L. Use a warm warning/amber tone for capital preservation (`NO_TRADE` or `NEUTRAL`) rather than a critical red error color.

---

## 2. Design System Tokens

### 2.1 Color Swatches (4 Surface Layers)
* **LEVEL 1: App Canvas (Background)**: `#09090b` (Deep ink black)
* **LEVEL 2: Page Panel / Section Card**: `#121215` (Elevated charcoal)
* **LEVEL 3: Elevated Card / Inset**: `#18181c` (Isolating metrics/focus states)
* **LEVEL 4: Interactive / Active Row**: `#202026` (Hover and selection highlights)
* **Borders (Sparingly used)**: `#1f1f23` (Subtle boundary line)
* **Brand Accent**: `#6366f1` / `#818cf8` (Indigo/violet, used for primary actions and active indicators)

### 2.2 Typographic Hierarchy
* **Page Title**: `24px` semibold, letter-spacing `-0.035em`, color `#fafafa`
* **Decision Headline**: `20px` bold, letter-spacing `-0.025em`, color `#fafafa`
* **Primary Metric**: `26px` bold, tabular-nums (monospace), semantic green/red colors
* **Section Heading**: `13px` uppercase, letter-spacing `0.05em`, semibold, color `#71717a`
* **Table / Body Text**: `12px` / `13px` regular, monospace font for tickers and numeric values
* **Caption / Meta**: `11px` regular, color `#52525b`

---

## 3. Visual Primitives & Component Inventory

* **MarketStatusBar**: A compact, 40px-high bar at the top displaying index status (`VNINDEX`), Gate 1 level, trend indicator, breadth status, and scan age.
* **DecisionHero**: A prominent left-bordered card indicating EOD stance (`NORMAL`, `PROBE`, `NO_TRADE`) and trade execution parameters.
* **ExposureMeter**: A progress bar showing active portfolio allocation against stance capacity.
* **PipelineSummaryStrip**: A horizontal workflow mapping universe filters to candidate counts.
* **DiagnosticsReasonStack**: Cards grouping rejected symbols by severity (Extended from MA20, Fading Volume, Bearish Trend).
* **DenseDataTable**: Ledger rows limited to 36-40px height, right-aligned numbers, and active filter chips.

---

## 4. Page-by-Page Layout Rules

### 4.1 Dashboard Cockpit
* **Row A**: `MarketStatusBar` (Full width)
* **Row B**: Split cockpit (5/12 left for `DecisionHero` + `ExposureMeter`; 7/12 right for realized P&L curve + metric tiles)
* **Row C**: `BestSetups` (with compact empty state)
* **Row D**: Side-by-side split (Watchlist on left, `DiagnosticsReasonStack` on right)

### 4.2 Setups Scanner Pipeline
* **Row A**: Page header + `MarketStatusBar`
* **Row B**: `PipelineSummaryStrip`
* **Row C**: Split layout (8/12 left for active surfaced candidates and `Near-Misses Queue`; 4/12 right for `Pipeline Filter Funnel` and `Rejection Diagnostics`)

### 4.3 Trades Ledger
* **Row A**: Page header + `MarketStatusBar` + `Log Trade` primary CTA
* **Row B**: `Risk Panels` (HPG missing stop levels warning)
* **Row C**: `Filter Bar` with search input, status drop-downs, active filter chips, and a reset button
* **Row D**: `DenseDataTable` with right-aligned numeric fields

---

## 5. Mockup Approval Status

* [x] **Section 1 (Visual Spec & tokens)**: Approved (revised v2 applies 4 surface levels and refined type scale).
* [x] **Dashboard Cockpit Mockup**: Approved (implements 5/12 split grid, caution-toned `NO_TRADE`, and SVG equity chart).
* [x] **Setups Pipeline Mockup**: Approved (implements horizontal summary, filter funnel, and candidate rows).
* [x] **Trades Ledger Mockup**: Approved (implements aligned columns, active chips, and risk warnings).

---

## 6. Phase-by-Phase Implementation Guidance

1. **Phase 1: Dashboard Cockpit** (Refactor `src/app/(dashboard)/dashboard/page.tsx` layout structure, add `MarketStatusBar` and 5/12 grid split).
2. **Phase 2: Setups Scanner Pipeline** (Refactor `src/app/(dashboard)/setups/page.tsx`, implement filter summary and diagnostics stacks).
3. **Phase 3: Trades Ledger** (Refactor `src/app/(dashboard)/trades/page.tsx`, apply right-alignment to numeric columns, clean filter controls, active chips, and position warnings).

*Note: Defer `/trades/[id]` details timeline, `/trades/new` edits, external chart links, and inline sizing expansions until explicitly requested.*
