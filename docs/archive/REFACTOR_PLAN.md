> **ARCHIVED** — superseded by [`docs/design/PLAYBOOK.md`](../design/PLAYBOOK.md). This plan targeted the `/trades` ledger dashboard shape, which has since been replaced by the Decision Cockpit (see `docs/design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md`). Kept for historical reference only.

# UI refactor plan — align with DESIGN.md & UI_BLUEPRINT.md

**Scope:** Audit + controlled refactor proposal only. **No code changes** in this document. **Backend / Gate 1 data wiring out of scope** unless noted as future.

---

## 1. Dashboard audit

### A. Current structure (brief)

- **Layout:** Single vertical stack inside `page-container` (`max-width: 1200px`, `space-y-8`): header row → **4-column responsive grid** of `metric-card` (closed, open, win %, cum P&L) → **Equity Curve** block (title + `EquityCurveChart` in ~350px-tall bordered area) → **Performance Edge** section (7× `.card` tiles in `grid-cols-2 sm:3 lg:7`) → **Playbook Performance** (table or empty state) → optional **empty-state card** when `trades.length === 0`.
- **Main components:** `EquityCurveChart` (Recharts), inline metric cards, inline performance cards, inline playbook table, `formatVND`, `computeAdvancedMetrics` / `computeEquityCurve` / `computePlaybookPerformance`.
- **Regime / trade preview:** **Not present.**

### B. Mismatch vs UI_BLUEPRINT

#### 1. Layout

| Issue | Blueprint | Current |
|-------|-----------|---------|
| **Row A — Regime strip** | Full-width top strip (~56–72px) under title, **P1** | **Missing** (no shell, no placeholder) |
| **Row B — Metrics \| Equity** | **Single row:** left **~5/12** metrics cluster, right **~7/12** equity, **same row height** | **Stacked:** full-width 4-metric grid, then **full-width** equity **below** — not side-by-side |
| **Row C — Trade table preview** | Full-width **recent trades** table + **“View all trades”** | **Absent**; dashboard shows **no** ledger preview |
| **Section order** | Regime → Metrics+Equity → **trade preview** → (optional) playbook rollup | KPI → Equity → Performance Edge → Playbook table → empty state |

#### 2. Hierarchy (P1 / P2 / P3)

| Issue | Severity |
|-------|----------|
| **Equity + primary KPIs** are P1 but **equity is pushed down** by full-width stacking — cognitive order OK, spatial blueprint violated | IMPORTANT |
| **Performance Edge** (7 tiles) sits **above** any trade ledger preview; blueprint treats extended metrics as **part of left metrics cluster** or **below** preview depending on height — currently occupies prime vertical space **before** journal preview | IMPORTANT |
| **Playbook Performance** table is **P2/P3** but appears **without** trade preview above it — breaks “ledger-first” emphasis | IMPORTANT |

#### 3. Density

| Issue | Severity |
|-------|----------|
| `space-y-8` **32px** between major blocks vs blueprint **tighter** terminal density | MINOR |
| `metric-card` **padding 24px** + **28px** metric values — readable but **less dense** than blueprint “compact KPI band” | MINOR |
| Performance Edge uses **7 separate cards** with **p-4** each — more **card sprawl** than blueprint “metrics cluster” | IMPORTANT |

#### 4. Component usage (table vs cards)

| Issue | Severity |
|-------|----------|
| Primary KPIs use **cards** (acceptable per DESIGN); **no conflict** | OK |
| **No dashboard trade table** — blueprint explicitly requires **table preview**, not more cards | CRITICAL (vs blueprint) |
| Playbook rollup uses **table** — appropriate | OK |

#### 5. Typography / alignment

| Issue | Severity |
|-------|----------|
| Page subtitle *“Advanced analytical breakdown of your performance edge”* leans **marketing** vs DESIGN **tooling** tone | MINOR |
| KPI numbers use `metric-value` / semantic P&L color — **aligned** | OK |

#### 6. Interaction patterns

| Issue | Severity |
|-------|----------|
| No **“View all trades →”** from dashboard | IMPORTANT |
| Primary CTA **Log Trade** present — **aligned** | OK |

### C. Severity summary (Dashboard)

| ID | Issue | Severity |
|----|--------|----------|
| D1 | No **Regime strip** (Row A) | **CRITICAL** vs blueprint *(defer wiring per product; shell optional in Phase 1)* |
| D2 | Metrics and Equity **not** in **5/12 \| 7/12** split row | **CRITICAL** vs blueprint |
| D3 | No **trade table preview** + no **View all** link | **CRITICAL** vs blueprint |
| D4 | Performance Edge placement / **card sprawl** vs clustered metrics | **IMPORTANT** |
| D5 | Vertical spacing / metric padding vs density target | **MINOR** |
| D6 | Subtitle copy tone | **MINOR** |

---

## 2. Trades list audit (`/trades`)

### A. Current structure (brief)

- **Layout:** `page-container` → header (title + count + Log Trade) → `TradeFilters` (search, status, sort) → **single full ledger** in `table-container` > `table` **or** empty state card.
- **Main components:** `TradeFilters` (client), native `.table` styles from `globals.css`.

### B. Mismatch vs UI_BLUEPRINT

#### 1. Layout

| Issue | Blueprint | Current |
|-------|-----------|---------|
| Column **set** | Symbol → Direction → Playbook → Status → Entry date → Entry → Exit → Qty → P&L → Actions | **Matches** order |
| **Preview vs full** | N/A on full list | Full list — OK |

#### 2. Hierarchy

| Issue | Severity |
|-------|----------|
| **P1** header + filters + first table rows — **OK** | OK |

#### 3. Density

| Issue | Severity |
|-------|----------|
| `td`/`th` **padding 12px 16px** — slightly **roomier** than blueprint ~36–44px row height target (depends on line-height) | MINOR |

#### 4. Table vs cards

| Issue | Severity |
|-------|----------|
| **Ledger is table** — **aligned** | OK |

#### 5. Typography / alignment

| Issue | Severity |
|-------|----------|
| **All `th` are `text-align: left`** in `.table`; blueprint: **Entry price, Exit price, Qty, P&L** should be **right-aligned** | **IMPORTANT** |
| **Header row not sticky** for long lists; blueprint implies **sticky thead** | **IMPORTANT** |
| Symbol uses **mono** — **aligned** | OK |

#### 6. Interaction

| Issue | Severity |
|-------|----------|
| Filters update URL — **good** for bookmarking (DESIGN) | OK |
| Search debounce in `trade-filters.tsx` returns cleanup incorrectly (React pattern) — **risk of extra navigations** | **IMPORTANT** (bug / polish, not layout) |

### C. Severity summary (Trades)

| ID | Issue | Severity |
|----|--------|----------|
| T1 | Numeric columns not **right-aligned** | **IMPORTANT** |
| T2 | **Sticky thead** missing | **IMPORTANT** |
| T3 | Filter `onChange` debounce cleanup bug | **IMPORTANT** |
| T4 | Row density fine-tuning | **MINOR** |

---

## 3. Layout shell & navigation

### A. Current (`dashboard/layout.tsx`)

- Sticky header: logo **TradeLog**, links Dashboard / Trades, email, logout.
- Duplicate mobile nav row.

### B. Mismatch

| Issue | Severity |
|-------|----------|
| **No active route styling** on `NavLink` — Linear-like orientation weaker | **IMPORTANT** |
| **max-w-[1200px]** matches `page-container` — consistent | OK |
| Header **backdrop-blur** — acceptable fintech chrome | MINOR |

---

## 4. Refactor strategy

### Phase 1 — Safe changes (layout / CSS / copy only)

**Goals:** Move toward blueprint **without** new data fetching or Gate 1.

| Action | Targets |
|--------|---------|
| **Restructure Dashboard DOM** | `dashboard/page.tsx`: introduce **CSS grid** `lg:grid-cols-12`; **Row B:** `lg:col-span-5` metrics column + `lg:col-span-7` equity column **siblings**; stack on `<lg`. |
| **Tighten vertical rhythm** | Reduce `space-y-8` → `space-y-6` or section-specific gaps per blueprint bands. |
| **Numeric alignment** | `globals.css` or page-level: `.table th/td` utilities for **text-right** on price, qty, P&L columns (use class names or nth-child for trades table only). |
| **Sticky thead** | `.table thead { position: sticky; top: …; z-index; background }` inside `.table-container` — verify overlap with sticky app header. |
| **Subtitle copy** | Shorten dashboard subtitle to factual line (e.g. performance summary + date context later). |
| **Optional: placeholder strip** | **Non-functional** regime strip (border + “Market regime — coming soon” or hide until Gate 1 UI approved) — **only if** product wants visual shell without data. |

**Explicitly out of Phase 1:** Gate 1 real data, new API routes, Prisma query changes for regime.

### Phase 2 — Component refactor

**Goals:** Reusable pieces + dashboard fidelity.

| Action | Targets |
|--------|---------|
| **Extract `DashboardKpiBand`** | Props: metric configs; keeps **4 KPI tiles** inside left column. |
| **Extract `DashboardMetricsEdge`** | Move Performance Edge tiles **into** left column **below** KPI band (within **5/12**), or secondary row inside left stack — **reduce** 7 floating cards replacing with **shared metric tile style** or denser grid matching DESIGN. |
| **Extract `EquityPanel`** | Title + chart only; sits in **right 7/12**. |
| **`TradePreviewTable`** | New server fragment or client boundary: **last N trades** (`orderBy entryDate desc`, `take 8–12`), **reuse column semantics** with trades page (shared column helper or small component). |
| **Link row** | “View all trades →” to `/trades`. |
| **`TradeFilters` fix** | Proper debounce (`useRef` + `useEffect` or `useDebouncedCallback`) — **behavior only**. |
| **Nav active state** | `usePathname()` in small client `NavLink` or layout wrapper — highlight current route. |

**Backend:** Only **read** queries already similar to trades list (subset + limit) — **minimal** new server code for preview; **no** trade mutation API changes.

### Phase 3 — Future

| Action | Notes |
|--------|------|
| **Regime panel** | Wire `getMarketRegimeFromDb` (when allowed); strip UI per UI_BLUEPRINT §2. |
| **Mobile sticky Symbol column** | Horizontal scroll + sticky first column on trades table. |
| **Playbook Performance** placement | Move **below** trade preview on dashboard or collapsible **per blueprint P3**. |

---

## 5. File-level change plan

| File | Modify | Remove | Keep |
|------|--------|--------|------|
| `src/app/(dashboard)/dashboard/page.tsx` | Grid Row B (5+7); reorder sections; add preview query + table + link; optionally relocate Performance Edge into left column | Overly loose stack-only layout for Row B | Data fetching pattern, analytics calls, equity chart import |
| `src/app/(dashboard)/trades/page.tsx` | Add alignment classes on cells/headers OR import shared table cell helpers | — | Filters, prisma query, column order |
| `src/app/globals.css` | `.table` variants: `th.numeric`, `td.numeric` text-right; sticky thead; optional tighter `.metric-card` modifier `.metric-card--dense` | — | Tokens, badges, buttons |
| `src/app/(dashboard)/layout.tsx` | Optional: wrap `NavLink` with active state (may require client subcomponent) | — | Structure, auth gate |
| `src/app/(dashboard)/trades/trade-filters.tsx` | Fix debounce pattern | Broken timeout cleanup | UI controls |
| **New** `src/components/dashboard-kpi-band.tsx` (example name) | Extract KPI grid | — | — |
| **New** `src/components/trade-preview-table.tsx` or inline fragment | Preview table + columns aligned with trades | — | — |
| `src/components/equity-curve-chart.tsx` | Optional: height prop to fit Row B min-height | — | Chart logic |

**Do not remove:** `computePlaybookPerformance` / playbook table — **relocate** lower in page order after preview.

---

## 6. Risks

| Risk | Mitigation |
|------|------------|
| **Dashboard query duplication** (full trades + preview fetch) | Single `findMany` + slice vs two queries — prefer **one** fetch and derive preview + metrics if acceptable for perf. |
| **Sticky thead vs sticky app header** | Set `top` under header height; test scroll. |
| **Grid reflow** breaks mobile | Blueprint already allows stack — match `lg:` breakpoint. |
| **Scope creep** | Gate 1 UI **only** when explicitly scheduled; placeholder strip only if stakeholders agree. |

---

## 7. Success criteria (post-refactor)

- Dashboard shows **top band reserved for regime** (real or placeholder per decision) + **metrics \| equity** **side-by-side** on desktop + **recent trades preview** with **View all**.
- Trades table **right-aligns** numeric columns; **sticky header** on scroll.
- **No** full rewrite of pages; **no** backend logic change beyond optional **limit** query for preview.

---

## 8. Verdict

| Area | Ready for phased refactor? |
|------|----------------------------|
| **Dashboard** | **Yes** — largest gap vs blueprint; Phase 1–2 address layout + preview. |
| **Trades** | **Yes** — mostly CSS + small filter fix. |
| **Nav** | **Yes** — active state in Phase 2. |

**Overall:** **Controlled refactor is appropriate** — align layout grid and table typography first, then component extraction and preview table; **Gate 1 strip last** per product gate.
