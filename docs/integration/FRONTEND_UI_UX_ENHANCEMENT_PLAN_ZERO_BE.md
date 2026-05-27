# Frontend UI/UX Enhancement Plan — Zero Backend Touch

**Slice type:** Audit + Planning only (Smart Large Slice — Frontend UI/UX)  
**Worktree:** `D:/Tools/Trading`  
**Audit date:** 2026-05-27  
**Status:** Awaiting implementation approval  
**Constraint:** No backend, Prisma, Server Actions behavior, API contracts, scanner thresholds, or auth changes in recommended first slice.

---

## 1. Executive summary

TradeLog’s frontend is a **Next.js 16 App Router** product with **no REST client layer**—pages load via Server Components + Prisma, mutations via Server Actions (`docs/integration/00-INDEX.md`). The UI already has a **dark trading-OS design token system** (`src/app/globals.css`), **shared data-state primitives** (`src/components/ui/*`), and a **recent Dashboard Command Center v1** (`docs/integration/DASHBOARD_COMMAND_CENTER_V1.md`).

**Strengths today**

- Decision-first dashboard cockpit with freshness, verdict, near-miss, and observational vs actionable labeling (Momentum vs Best Setups).
- Suspense streaming on `/setups` with skeleton fallbacks.
- Reusable `EmptyStateWithReason`, `ErrorStateWithEvidence`, `LoadingSkeleton`, `StaleDataWarning`.
- Approved visual direction in `docs/design/TRADING_OS_V2_VISUAL_SPEC.md` (4 surface levels, numeric honesty, depth-over-borders).

**Primary gaps**

- **Visual hierarchy drift:** Dashboard layout does not yet match approved 5/12 cockpit grid; information density varies page-to-page.
- **Cognitive load:** `/trades` is a ~1,900-line monolith mixing ledger, review session, operating snapshot, and book intelligence—hard to scan on mobile.
- **Consistency:** Inline styles, mixed table patterns, lifecycle label confusion (computed vs DB), momentum price unit display mismatch (documented in `05-integration-mismatches.md`).
- **Accessibility:** Table-row click targets without full keyboard parity; motion without systematic `prefers-reduced-motion`.
- **Parallel in-flight work** on Setups candidate rows—first implementation slice should avoid that surface.

**Recommendation:** Ship **Smart Large Slice 1 — Dashboard Command Center v1.1** first: highest daily-use impact, zero BE risk, aligns with approved visual spec, minimal conflict with parallel Setups work.

---

## 2. Worktree safety check

### 2.1 Git status (before doc creation)

```
 M next.config.ts
 M package-lock.json
 M package.json
 M playwright.config.ts
 M src/app/(dashboard)/setups/setups-candidates-async.tsx
 M src/components/dashboard/dashboard-performance-panel.tsx
 M src/components/performance-edge-grid.tsx
 M src/components/setups-candidate-health-strip.tsx
 M src/components/trade-form.tsx
?? .superpowers/
?? docs/design/TRADING_OS_V2_VISUAL_SPEC.md
?? src/app/(dashboard)/setups/candidate-row-client.tsx
?? src/app/design-preview/trading-os/
```

### 2.2 Local change classification

| File/Area | Status | Related To This Audit? | Safe To Touch? | Notes |
|-----------|--------|------------------------|----------------|-------|
| `docs/integration/FRONTEND_UI_UX_ENHANCEMENT_PLAN_ZERO_BE.md` | New (this doc) | Yes | **SAFE_DOC_TARGET** | Created by this slice only. |
| `docs/design/TRADING_OS_V2_VISUAL_SPEC.md` | Untracked | Yes (reference) | **SAFE_DOC_TARGET** | Read-only reference for plan; do not overwrite. |
| `src/app/design-preview/trading-os/` | Untracked | Yes (reference) | **LOCAL_ONLY_DO_NOT_TOUCH** | Design preview; parallel mockup work. |
| `.superpowers/` | Untracked | No | **LOCAL_ONLY_DO_NOT_TOUCH** | Agent session artifacts. |
| `src/app/(dashboard)/setups/candidate-row-client.tsx` | Untracked | Yes (Setups UX) | **PARALLEL_WORK_DO_NOT_TOUCH** | New client accordion row; active FE experiment. |
| `src/app/(dashboard)/setups/setups-candidates-async.tsx` | Modified | Yes | **PARALLEL_WORK_DO_NOT_TOUCH** | Wires `CandidateRowClient`. |
| `src/components/setups-candidate-health-strip.tsx` | Modified | Yes | **PARALLEL_WORK_DO_NOT_TOUCH** | Shared by dashboard + setups. |
| `src/components/trade-form.tsx` | Modified | Yes (Trade Form slice) | **PARALLEL_WORK_DO_NOT_TOUCH** | Framer Motion / form UX in progress. |
| `src/components/dashboard/dashboard-performance-panel.tsx` | Modified | Yes | **RELEVANT_EXISTING_FE_WORK** | Coordinate in Dashboard v1.1; merge carefully. |
| `src/components/performance-edge-grid.tsx` | Modified | Yes | **RELEVANT_EXISTING_FE_WORK** | Dashboard performance widgets. |
| `package.json`, `package-lock.json` | Modified | Partial | **PARALLEL_WORK_DO_NOT_TOUCH** | May add deps (e.g. framer-motion already present); do not revert. |
| `next.config.ts`, `playwright.config.ts` | Modified | No | **PARALLEL_WORK_DO_NOT_TOUCH** | Infra/test config; unrelated to this audit write. |

**Risk note:** Any implementation must **not** reset, stash, or overwrite the modified/untracked files above without explicit owner coordination.

---

## 3. Scope audit summary

Evidence-based map of major frontend areas (cross-checked 2026-05-27).

| File/Area | Current Role | Relevant To UI/UX Plan? | Classification | Notes |
|-----------|--------------|-------------------------|----------------|-------|
| `src/app/(dashboard)/dashboard/page.tsx` | RSC orchestrator: trades, scan, cockpit DTO, panels | Yes | **DASHBOARD** | Command center v1 panels; `DashboardEntrance` motion wrapper. |
| `src/components/dashboard/*` | Cockpit panels (command, opportunity, best setups, near-miss, etc.) | Yes | **DASHBOARD** | 20+ focused components; primary v1.1 target. |
| `src/app/(dashboard)/setups/page.tsx` | Suspense-segmented pipeline page | Yes | **SETUPS** | `tos-setups-grid` main + sidebar. |
| `src/app/(dashboard)/setups/setups-*-async.tsx` | Cached RSC loaders | Yes | **SETUPS** | Candidates, overview, sidebar, tail. |
| `src/app/(dashboard)/setups/candidate-row-client.tsx` | Client accordion candidate row | Yes | **PARALLEL_WORK_DO_NOT_TOUCH** | In-flight; Framer Motion. |
| `src/components/momentum-watch-section.tsx` | Observational momentum table | Yes | **SETUPS** / **DASHBOARD** | Shared section; disclaimer copy present. |
| `src/components/setups-rejection-accordion.tsx` | Near-miss / rejection diagnostics | Yes | **SETUPS** | Gate2 reason grouping. |
| `src/app/(dashboard)/trades/page.tsx` | Ledger + review session + book OS | Yes | **TRADES** | Very large; `dynamic = "force-dynamic"`. |
| `src/app/(dashboard)/trades/trade-filters.tsx` | URL-driven filters (client) | Yes | **TRADES** | `useSearchParams`. |
| `src/app/(dashboard)/trades/[id]/page.tsx` | Trade detail + health checkpoint form | Yes | **TRADE_DETAIL** | Raw SQL health logs. |
| `src/app/(dashboard)/trades/new/page.tsx` | New trade wrapper | Yes | **TRADE_FORM** | Prefill from `setupCandidateId`. |
| `src/components/trade-form.tsx` | create/update trade form | Yes | **TRADE_FORM** | `useActionState`, entry unit check. |
| `src/app/(auth)/login/*`, `register/*` | Auth forms | Yes | **AUTH** | Minimal styling; functional. |
| `src/app/(dashboard)/layout.tsx` | App shell header + nav | Yes | **APP_SHELL** | Sticky header, mobile nav. |
| `src/components/app-shell-nav.tsx` | Route nav + `aria-current` | Yes | **APP_SHELL** | 3 routes only. |
| `src/app/globals.css` | Design tokens, utilities, page layouts | Yes | **DESIGN_SYSTEM** | ~3k lines; cockpit/setups/trades classes. |
| `src/components/ui/*` | State primitives | Yes | **DATA_STATES** | Empty/error/skeleton/stale. |
| `src/app/*/loading.tsx` | Route-level skeletons | Yes | **DATA_STATES** | Dashboard, setups, trades loaders. |
| `src/app/design-preview/*` | Static UX previews | Yes | **LOCAL_ONLY_DO_NOT_TOUCH** | Not production routes. |
| `src/lib/*` (dashboard, trades, scanner) | DTOs & display helpers | Partial | **COPY_AND_INFORMATION_ARCHITECTURE** | FE may only adjust *presentation* mapping, not contracts. |
| `src/app/actions/*`, `src/app/api/*` | Mutations & cron | No (read for alignment) | **DEFERRED_BE_REQUIRED** if behavior change needed | Out of scope for implementation. |

---

## 4. Current UI/UX assessment

### 4.1 Design system maturity

| Dimension | Assessment | Evidence |
|-----------|------------|----------|
| Color / surfaces | Strong — 4-level surfaces + semantic status tokens | `globals.css` `:root`, `TRADING_OS_V2_VISUAL_SPEC.md` |
| Typography | Good tokens; uneven application | Spec defines page title 24px; some panels use ad-hoc inline sizes |
| Spacing | Token scale exists; mixed utility vs custom gaps | `--space-*` vs per-component `space-y-5` / inline |
| Components | Partial library — dashboard/setups patterns, not unified `<Button>` | `.btn`, `.dash-panel`, `.table` classes |
| Motion | Framer Motion on dashboard entrance, trade form, candidate rows | `dashboard-entrance.tsx`, `trade-form.tsx`, `candidate-row-client.tsx` |
| Data states | Good primitives, inconsistent adoption | Some sections still bare text empty |

### 4.2 Page-level snapshot

| Page | UX maturity | Key issue |
|------|-------------|-----------|
| Dashboard | High content quality, medium layout polish | Vertical stack; approved 5/12 hero split not fully applied |
| Setups | Good pipeline mental model | Sidebar/main responsive OK; candidate row parallel refactor |
| Trades | Feature-rich, low scannability | Monolith page; review mode hidden behind params |
| Trade detail | Functional | Dense; health timeline vs form competing for attention |
| Auth | Adequate | No trust/branding polish; generic form |

---

## 5. Pain points

| Area | Current Problem | User Impact | Severity | Evidence File | Proposed Direction |
|------|-----------------|-------------|----------|---------------|-------------------|
| Dashboard layout | Command panels stack vertically; hero metrics not in approved 5/12 split | Slower EOD scan; fatigue | **P1_HIGH** | `dashboard/page.tsx`, `TRADING_OS_V2_VISUAL_SPEC.md` §4.1 | Reflow to Row A–D grid; sticky market bar |
| Trades page density | Single file renders ledger + review session + book briefing | Overwhelm; mobile scroll fatigue | **P1_HIGH** | `trades/page.tsx` (~1947 lines) | Workspace layout: ledger default, review as mode |
| Lifecycle labels | READY/WATCHING computed vs DB lifecycle on watchlist | Mistrust in setup state | **P2_MEDIUM** | `05-integration-mismatches.md` §3–4 | FE copy: “price-in-zone” vs “watchlist status”; tooltips |
| Momentum pricing | `PriceWithUnit` on setups but inconsistent elsewhere | Wrong unit mental model | **P2_MEDIUM** | `momentum-watch-section.tsx`, mismatch doc §6 | Standardize `PriceWithUnit` / k ₫ everywhere |
| Table keyboard UX | Candidate rows `onClick` on `<tr>` without row `tabIndex`/Enter | Keyboard users blocked | **P2_MEDIUM** | `candidate-row-client.tsx` | `role="button"`, keyboard toggle, focus ring |
| Motion a11y | Entrance animations always run | Vestibular discomfort | **P2_MEDIUM** | `dashboard-entrance.tsx` | `prefers-reduced-motion: reduce` → instant |
| Trades loading UX | `loading.tsx` exists but page is force-dynamic | Full wait, no progressive reveal | **P2_MEDIUM** | `trades/page.tsx`, `trades/loading.tsx` | Split RSC sections + Suspense boundaries (FE only) |
| Auth trust | Plain forms, no product value prop | Weak first impression | **P3_POLISH** | `login/login-form.tsx` | Split panel, security copy, inline validation polish |
| Inline styles | Many `style={{}}` on components | Harder theming consistency | **P3_POLISH** | `trade-form.tsx`, `setups-closest-symbols.tsx` | Migrate to CSS utility classes |
| Health logs silent fail | Missing table → empty history, no banner | False “never reviewed” | **P1_HIGH** | `05-integration-mismatches.md` §2 | FE: `BackendBlockedState` when query fails (no BE) |
| Take profit prefill | Setup → new trade omits TP | Extra clicks, perceived bug | **P2_MEDIUM** | `05-integration-mismatches.md` §10 | **DEFERRED_BE_REQUIRED** if TP must be authoritative from scanner |
| Analytics tiles | Equity curve components unused | Blueprint expectation gap | **P3_POLISH** | `04-frontend-integration-map.md` dead UI | Defer or wire read-only in later slice |

---

## 6. User journey audit

| Flow | Current Friction | Desired Experience | Proposed Fix | FE Only? | Notes |
|------|------------------|-------------------|--------------|----------|-------|
| 1. Login / register | Generic forms; error banner only | Clear value prop, field-level errors, visible loading | Auth layout upgrade, password visibility toggle, focus order | **Yes** | Slice 6 or late polish |
| 2. Dashboard command center | Good panels; scan order long | 5-second EOD: stance → exposure → setups → watch | v1.1 grid + sticky market bar + collapse secondary | **Yes** | Builds on v1 |
| 3. Setups discovery | Pipeline strip good; candidates table wide | Scan funnel → actionable shortlist → log trade CTA | Pipeline slice: funnel sticky, dense table, mobile cards | **Yes** | Avoid parallel candidate files initially |
| 4. Momentum / near-miss | Disclaimer present; near-miss separate panels | Clear “observe vs act” with cross-links | Unified observational band + link to setups diagnostics | **Yes** | No API change |
| 5. Trade creation | Long form; Framer layout; TP not prefilled | Setup context card, grouped fields, inline unit fix | Form productivity slice | **Partial** | TP prefill may need BE |
| 6. Trade list management | Filters work; page heavy | Filter chips + dense ledger + quick open detail | Trades workspace slice | **Yes** | Split RSC |
| 7. Trade detail / journal | Form + metrics + health mixed | Console: summary rail + timeline + edit drawer | Trade detail slice | **Yes** | |
| 8. Health checkpoint / exit | Checkpoint on detail; list review mode hidden | Obvious “review today” queue from ledger | Promote review mode entry in trades header | **Yes** | Uses existing SQL reads |

---

## 7. API contract / Data-UX alignment

No API changes. Map UI states to existing Server Component / Server Action truth (`02-api-contract.md`, `04-frontend-integration-map.md`).

| UI State | Current Behavior | Better UX | Data Source / Contract | BE Change Needed? |
|----------|------------------|-----------|------------------------|-------------------|
| Dashboard partial DB fail | Banner + empty sections | Section-level error with retry copy (navigation refresh) | `dashboard/page.tsx` try/catch | **NO** |
| Best setups empty | `EmptyStateWithReason` + cockpit copy | Compact empty + link to setups + gate explanation | `resolveBestSetupsPanelPresentation`, scan counts | **NO** |
| Momentum empty | Empty vs error distinguished | Same + “why observational” one-liner | `getMomentumWatchRowsForPhase1` | **NO** |
| Near-miss panel | Reads `cockpitDto.opportunity.nearMiss` | Expandable reason chips per symbol | `parseDailyScanGate2Notes` | **NO** |
| Setups candidates partial | `ErrorStateWithEvidence` banner | Per-section stale badge | `loadSurfacedCandidatesHealthCached` errors | **NO** |
| Trades list DB fail | Top banner | Block ledger, keep nav | `prisma.trade.findMany` catch | **NO** |
| Health logs missing | Silent empty maps | `BackendBlockedState` “Review history unavailable” | Raw SQL try/catch | **NO** (surface failure) |
| Stale scan | `StaleDataWarning` / freshness DTO | Timestamp + “decisions based on {session}” | `buildMarketFreshnessDto` | **NO** |
| Entry price unit warn | Client `checkTradeEntryPriceAlignment` | Inline fix button (exists) | Server Action read-only check | **NO** |
| Operating snapshot | Cookie via `useEffect` | Label “device-local memory” | Cookie `tl_book_op_v1_*` | **NO** |
| Optimistic trade create | Full round-trip redirect | Optional spinner on submit only | `createTrade` action state | **NO** |
| Lifecycle mismatch tooltip | None | Explain computed READY vs DB WATCHING | `prepareSurfacedCandidatesHealthView` vs watch item | **NO** |
| Take profit prefill | undefined | Show scanner levels read-only even if not submitted | candidate `stopLevel`, zones | **DEFERRED_BE_REQUIRED** to auto-fill TP field |
| Real risk budget enforcement | Guidance copy only | Keep honest “guidance only” badge | env `TRADING_ACCOUNT_EQUITY_VND` | **DEFERRED_BE_REQUIRED** for real caps |

---

## 8. Top-tier UX inspiration and practical translation

| Proposal | Inspired By | Where Applied | Implementation Stack | Risk | FE Only? |
|----------|-------------|---------------|----------------------|------|----------|
| Sticky compact market/status bar | Linear | Dashboard, Setups, Trades headers | CSS `position: sticky`, existing tokens | Low | **Yes** |
| 5/12 decision hero + performance rail | Vercel dashboard | Dashboard Row B | CSS grid, `dash-cockpit__hero-row` | Low | **Yes** |
| Section stagger entrance (respect reduced motion) | Apple / Linear | Dashboard panels | Framer Motion (already dep) + CSS fallback | Medium | **Yes** |
| Dense ledger 36–40px rows | Bloomberg | Trades, setups tables | `.tos-dense-table` | Low | **Yes** |
| Filter chips with clear reset | Airbnb | Trades filters | Client URL state, existing `trade-filters.tsx` | Low | **Yes** |
| Command palette (jump routes, log trade) | Linear | App shell | Optional kbd handler; no new dep | Medium | **Yes** |
| Card row on mobile (setup candidates) | Stripe dashboard | Setups candidates | CSS grid `@media` | Medium | **Yes** |
| Hover/active surface lift | Vercel | Tables, panels | `--bg-hover`, `transition` | Low | **Yes** |
| Inline form validation hints | Stripe | Trade form | Existing `state.errors` + aria-describedby | Low | **Yes** |
| Prefetch on nav hover | Next.js | App shell links | `Link` prefetch default | Low | **Yes** |
| Premium empty states | Apple HIG | All major panels | `EmptyStateWithReason` + icon slot | Low | **Yes** |
| Route transition fade | Airbnb | Between dashboard routes | CSS view transitions (optional) | Medium | **Yes** |
| TanStack Query cache | — | — | Not recommended without architecture approval | High | N/A |

---

## 9. Page / component enhancement plan

| Page/Component | Current State | Weakness | Proposed Upgrade | Case Study Reference | Tech Approach | Priority | FE Only? |
|----------------|---------------|----------|------------------|---------------------|---------------|----------|----------|
| Dashboard | v1 panels, vertical stack | Hierarchy vs spec | 5/12 hero, Row C–D split, collapse diagnostics | Vercel / Linear | CSS grid + panel refactor | P0 slice 1 | **Yes** |
| Setups page | Suspense pipeline | Candidate row conflict | Align with spec layout; defer row accordion merge | Stripe pipeline | CSS + server tables | P0 slice 2 | **Yes** |
| Candidate rows/cards | Table + parallel accordion | a11y, mobile | Dense row + expand panel pattern | Linear issues list | CSS + minimal client | P1 slice 2 | **Yes** |
| Momentum Watch | Table + disclaimer | Unit consistency | `PriceWithUnit`, mobile stack | Bloomberg watch | RSC + CSS | P1 | **Yes** |
| Near Miss / Rejection | Separate dashboard + setups components | Duplicated patterns | Shared `ObservationalSignalPanel` | Linear inbox | Component extract | P1 | **Yes** |
| Trades list | Monolith | Scannability | Mode switch: Ledger / Review | Stripe Dashboard | RSC split | P0 slice 3 | **Yes** |
| Trade detail | Form-centric | Journal clarity | Summary column + timeline | Notion | Layout grid | P1 slice 4 | **Yes** |
| Trade form | 2-col, motion | Long, grouping | Sections: Entry / Risk / Journal | Stripe Checkout | CSS + optional motion | P1 slice 5 | **Yes** |
| Auth pages | Basic | Trust | Branded split layout | Vercel auth | CSS | P2 slice 6 | **Yes** |
| App shell/nav | 3 links | No quick actions | Log trade CTA, cmd-k stub | Linear | CSS + client kbd | P2 slice 6 | **Yes** |
| Shared UI | 7 exports | No Button/Card primitives | Document patterns in globals | shadcn-like via CSS | CSS classes | P2 slice 6 | **Yes** |
| Data state components | Good base | Underused | Mandate for empty/error | — | Composition | P1 all slices | **Yes** |
| Responsive | Desktop-first | Trades tables overflow | Card fallback breakpoints | Airbnb | CSS | P1 | **Yes** |
| Accessibility | Focus ring global | Tables/rows incomplete | Row keyboard, aria-live errors | WCAG 2.2 | HTML + CSS | P1 | **Yes** |

---

## 10. Quick wins

*Grouped into Smart Large Slices — not standalone implementation slices.*

| Quick Win | File/Area | Expected Impact | Risk | Effort | Belongs To Slice |
|-----------|-----------|-----------------|------|--------|------------------|
| Apply 5/12 dashboard hero grid | `globals.css`, dashboard layout | Faster visual scan | Low | M | Slice 1 |
| Sticky market status bar | `dashboard-market-status-bar.tsx` | Context always visible | Low | S | Slice 1 |
| `prefers-reduced-motion` on entrance | `dashboard-entrance.tsx` | a11y compliance | Low | S | Slice 1 |
| Compact empty Best Setups | `dashboard-best-setups-panel.tsx` | Less vertical waste | Low | S | Slice 1 |
| Unify k ₫ via `PriceWithUnit` | `momentum-watch-section.tsx` | Trust in numbers | Low | S | Slice 1–2 |
| Lifecycle tooltip copy | `setups-candidate-health-strip.tsx` | Reduce confusion | Low | S | Slice 2 |
| Table row hover surface | `globals.css` `.table tbody tr` | Premium feel | Low | S | Slice 2–3 |
| Filter active chips | `trade-filters.tsx` | Clear applied filters | Low | M | Slice 3 |
| Health log failure banner | `trades/page.tsx` | Honest data state | Low | M | Slice 3 |
| Mobile nav touch targets | `app-shell-nav` CSS | Mobile usability | Low | S | Slice 6 |
| Dashboard loading match layout | `dashboard/loading.tsx` | Perceived speed | Low | S | Slice 1 |
| Observational badge component | shared CSS `.badge-observational` | Clarity | Low | S | Slice 1–2 |
| Focus ring on interactive rows | candidate rows, trades | Keyboard parity | Low | M | Slice 2–3 |
| “Log trade” sticky CTA | setups + dashboard headers | Conversion | Low | S | Slice 1–2 |
| Section headings uppercase meta | `dash-section-title` | Visual hierarchy | Low | S | Slice 6 |
| Retry via `router.refresh()` copy | `retry-action-panel.tsx` | Recovery UX | Low | S | All |
| Collapse secondary dashboard panels | `dashboard-secondary-intelligence.tsx` | Reduce load | Low | M | Slice 1 |
| Trades header session entry | `trades-page-header.tsx` | Discover review mode | Low | S | Slice 3 |
| Form field `aria-describedby` | `trade-form.tsx` | Screen reader errors | Low | M | Slice 5 |
| Prefetch nav routes | `app-shell-nav.tsx` | Snappier nav | Low | S | Slice 6 |

---

## 11. Smart Large Feature Slice roadmap

| Slice | User-Facing Outcome | Ships | Files Likely Touched | UX Quality Bar | Data-State Handling | Accessibility | Responsive | Risk | Validation | Rollback |
|-------|---------------------|-------|----------------------|----------------|---------------------|---------------|------------|------|------------|----------|
| **1. Dashboard Command Center v1.1** | EOD decisions in one screen: stance, exposure, setups, watch, near-miss—without scrolling hunt | Approved grid layout, sticky market bar, panel order, collapsible secondary, motion a11y, performance rail polish | `dashboard/page.tsx`, `dashboard/*`, `globals.css`, `dashboard/loading.tsx` | Match `TRADING_OS_V2_VISUAL_SPEC` §4.1 | Keep v1 empty/error patterns; section-level errors | Reduced motion, heading order, live regions for errors | Stack → 5/12 → single col mobile | Med — merge `dashboard-performance-panel` local edits | `npm run build`, Playwright dashboard tests, manual EOD checklist | Revert layout CSS + page composition |
| **2. Setups Opportunity Pipeline** | Scanner story → shortlist → log trade in one flow | Pipeline strip upgrade, sidebar funnel, candidate dense table/cards, near-miss/rejection unify, momentum band | `setups/page.tsx`, `setups-*-async.tsx`, `setups/*`, `momentum-watch-section.tsx`, `setups-rejection-accordion.tsx` | Pipeline metaphor obvious in 10s | Suspense fallbacks match final layout | Keyboard expandable rows, table captions | 8/4 grid → stacked cards | **High** — parallel `candidate-row-client` | Setups e2e + visual compare | Revert setups page only |
| **3. Trades Workspace Redesign** | Ledger is default; review mode discoverable; filters scannable | Split RSC, header modes, dense ledger, review chrome surfaced, health failure honesty | `trades/page.tsx`, `trade-filters.tsx`, `trades/*`, `review-session-chrome.tsx`, `focus-review-workspace.tsx` | Stripe-like ledger clarity | Partial load per section | Review keyboard shortcuts doc | Horizontal scroll → cards | High — large file | Trades e2e, filter matrix QA | Feature flag class on body |
| **4. Trade Detail / Journal Console** | Position story + health timeline + edit without clutter | Summary rail, timeline component, checkpoint prominence | `trades/[id]/page.tsx`, new presentational components | Apple Settings density | Health log failure state | Form landmarks, timeline list semantics | Single column mobile | Medium | Manual trade detail QA | Page-level revert |
| **5. Trade Form Productivity** | Faster log from setup with clear risk fields | Sectioned form, inline validation, setup context card, optional motion off | `trade-form.tsx`, `trades/new/page.tsx` | Stripe form clarity | `useActionState` errors preserved | Labels, describedby, focus trap none | Single col mobile | Med — parallel edits | Form e2e create/edit | Revert form component |
| **6. App Shell + Design System Hardening** | Cohesive product chrome + documented primitives | Nav CTA, cmd-k stub, token cleanup, primitive docs | `layout.tsx`, `app-shell-nav.tsx`, `globals.css`, `ui/*` | Linear nav simplicity | N/A | Skip link, nav landmarks | Bottom nav polish | Low | Smoke all routes | CSS revert |

---

## 12. Recommended first implementation slice

### 12.1 Choice: **Smart Large Slice 1 — Dashboard Command Center v1.1**

### 12.2 Why this slice first

1. **Highest daily-use surface** — post-login landing (`/dashboard`).
2. **Zero BE risk** — recomposition of existing RSC data and components (`DASHBOARD_COMMAND_CENTER_V1.md`).
3. **Clean validation** — existing dashboard tests + visual spec acceptance criteria.
4. **Minimal parallel conflict** — avoids `setups/candidate-row-client.tsx` and `trade-form.tsx`; only coordinate `dashboard-performance-panel.tsx` / `performance-edge-grid.tsx`.
5. **Foundation** — establishes grid, sticky bar, and observational labeling patterns reused in Setups/Trades slices.

### 12.3 User-facing outcome

Trader opens dashboard and within ~5 seconds sees: **market freshness → stance/verdict → exposure → best setups or honest empty → momentum/near-miss observational band → watchlist/diagnostics** in a stable spatial layout (desktop 5/12; mobile stacked).

### 12.4 Files likely touched

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/components/dashboard/dashboard-command-panel.tsx`
- `src/components/dashboard/dashboard-opportunity-board.tsx`
- `src/components/dashboard/dashboard-secondary-intelligence.tsx`
- `src/components/dashboard/dashboard-best-setups-panel.tsx`
- `src/components/dashboard/dashboard-market-status-bar.tsx`
- `src/components/dashboard/dashboard-entrance.tsx`
- `src/components/dashboard/dashboard-performance-panel.tsx` *(coordinate with local edits)*
- `src/components/performance-edge-grid.tsx`
- `src/app/(dashboard)/dashboard/loading.tsx`
- `src/app/globals.css` (cockpit grid utilities only)

### 12.5 Will ship

- Layout per `TRADING_OS_V2_VISUAL_SPEC.md` §4.1 (Rows A–D).
- Sticky `MarketStatusBar` + scan meta strip.
- Collapsible secondary intelligence / diagnostics.
- `prefers-reduced-motion` guard on entrance animations.
- Unified observational labeling for Momentum section on dashboard (if mounted there).
- Loading skeleton aligned to final grid.

### 12.6 Will NOT touch

- `src/app/(dashboard)/setups/candidate-row-client.tsx` and related parallel setups files
- `src/components/trade-form.tsx`
- Server Actions, Prisma, scanner, auth
- `package.json` (unless explicit dep approval)
- Backend docs except this plan

### 12.7 UX quality checklist

- [ ] Decision visible above fold at 1280×800
- [ ] Empty Best Setups explains *why* (gate/tradability)
- [ ] Momentum labeled observational-only
- [ ] Near-miss separate from actionable setups
- [ ] No new borders-only cards; use surface levels
- [ ] Numeric columns right-aligned monospace

### 12.8 Accessibility checklist

- [ ] Logical heading order (h1 → h2 per panel)
- [ ] `prefers-reduced-motion` disables stagger
- [ ] Focus visible on all links/CTAs
- [ ] Error banners use `role="alert"` or `aria-live`
- [ ] Tables have `<caption>` or `aria-label` where needed

### 12.9 Responsive checklist

- [ ] 5/12 grid collapses to single column &lt; 1024px
- [ ] Tables horizontal scroll with shadow hint
- [ ] Sticky bar does not obscure mobile nav
- [ ] Touch targets ≥ 44px on mobile CTAs

### 12.10 Data-state checklist

- [ ] Partial DB error banner preserved
- [ ] Empty states use `EmptyStateWithReason`
- [ ] Errors use `ErrorStateWithEvidence`
- [ ] Freshness/stale copy from DTO only (no invented data)

### 12.11 Validation commands

```bash
npm run lint
npm run build
npm run test
npm run test:e2e -- --grep dashboard
```

### 12.12 Manual QA checklist

- [ ] Login → dashboard loads with latest scan or honest empty
- [ ] Gate1 WARNING shows correct suppressed Tier B copy
- [ ] Links: Setups, Log trade, candidate drill-down
- [ ] Resize 375px width — no overlapping sticky headers
- [ ] Keyboard tab through header nav and primary CTAs
- [ ] Toggle OS reduced motion — no stagger animation

### 12.13 Rollback plan

Revert commits touching `dashboard/*` and cockpit CSS blocks in `globals.css`; `dashboard/page.tsx` composition returns to pre-v1.1 order. No DB migrations.

### 12.14 Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Merge conflict on `dashboard-performance-panel.tsx` | Sync with parallel agent before editing; read diff first |
| Framer Motion layout shift | Prefer CSS grid first; motion optional |
| Regression in cockpit DTO wiring | No changes to `buildDecisionCockpitDto` inputs |

---

## 13. Code samples (illustrative only — not in app source)

### 13.1 Premium state card (CSS surfaces)

```tsx
// Illustrative — docs only
export function StateCard({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "success";
}) {
  return (
    <section
      className={`dash-panel dash-surface-2 state-card state-card--${tone}`}
      aria-labelledby={`state-card-${title}`}
    >
      <h2 id={`state-card-${title}`} className="dash-section-title">
        {title}
      </h2>
      <div className="state-card__body">{children}</div>
    </section>
  );
}
```

```css
/* globals.css — illustrative */
.state-card { border-radius: var(--radius-lg); padding: var(--space-5); }
.state-card--warning { box-shadow: inset 3px 0 0 var(--warning); }
```

### 13.2 Skeleton loading pattern

```tsx
import { LoadingSkeletonGroup } from "@/components/ui/loading-skeleton";

export function DashboardHeroSkeleton() {
  return (
    <div className="dash-cockpit__hero-row" aria-busy="true" aria-label="Loading dashboard">
      <LoadingSkeletonGroup rows={4} rowHeight="3.5rem" className="dash-surface-2 rounded-xl p-6" />
      <LoadingSkeletonGroup rows={3} rowHeight="2.5rem" className="dash-surface-1 rounded-lg p-5" />
    </div>
  );
}
```

### 13.3 Keyboard-accessible expandable row

```tsx
// Illustrative pattern for setups/trades rows
<tr
  tabIndex={0}
  role="button"
  aria-expanded={open}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((v) => !v);
    }
  }}
  onClick={() => setOpen((v) => !v)}
  className="table-row-interactive"
>
```

### 13.4 CSS-only hover micro-interaction

```css
.table-row-interactive {
  transition: background var(--transition-fast);
}
.table-row-interactive:hover,
.table-row-interactive:focus-visible {
  background: var(--bg-hover);
}
@media (prefers-reduced-motion: reduce) {
  .table-row-interactive { transition: none; }
}
```

### 13.5 Inline validation (trade form field)

```tsx
<div>
  <label htmlFor="entryPrice" className="label">Entry (k ₫)</label>
  <input
    id="entryPrice"
    name="entryPrice"
    aria-invalid={!!errors?.entryPrice}
    aria-describedby={errors?.entryPrice ? "entryPrice-error" : "entryPrice-hint"}
    className="input"
  />
  <p id="entryPrice-hint" className="text-xs text-muted">Prices use thousand-VND per share.</p>
  {errors?.entryPrice ? (
    <p id="entryPrice-error" role="alert" className="text-xs text-danger">
      {errors.entryPrice[0]}
    </p>
  ) : null}
</div>
```

### 13.6 Command-style quick action (no new deps)

```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useCommandPalette() {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Phase 1: simple route jump; Phase 2: modal palette
        router.push("/trades/new");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}
```

### 13.7 Accessible empty state

```tsx
<EmptyStateWithReason
  title="No qualified setups in the latest scan"
  reason="54 symbols passed tradability; Gate 1 WARNING suppressed Tier B. This is scanner truth—not missing data."
  data-testid="dashboard-best-setups-empty"
>
  <Link href="/setups" className="btn btn-secondary">Open pipeline</Link>
</EmptyStateWithReason>
```

---

## 14. Zero-BE guardrails

**In scope (FE only)**

- Layout, CSS tokens, presentational components
- Copy explaining existing scanner/trade truth
- Client-side accessibility, motion, responsive layouts
- Suspense boundaries splitting existing RSC fetches (no new queries)
- Display-only mapping using existing DTOs/helpers

**Out of scope**

- Prisma schema, migrations, raw SQL changes
- Server Action signatures or validation rules
- Scanner thresholds, cron, external integrations
- New API routes or contract fields
- Auth/session behavior
- Production data fixes

**DEFERRED_BE_REQUIRED (track only — exclude from first slice)**

- Authoritative lifecycle / action hints from backend
- Take-profit prefill from setup candidate
- Real portfolio risk budget enforcement
- `trade_health_logs` in Prisma + typed client
- Timezone-aware “reviewed today”
- Setup outcome exit health accuracy
- Analytics/equity curve data wiring

---

## 15. Validation plan (docs slice)

| Check | Command / action | Expected |
|-------|------------------|----------|
| Worktree clean of app edits | `git status --short` after doc | Only new/modified plan doc (+ pre-existing local files unchanged by us) |
| No backend files touched | `git diff --name-only` | No `prisma/`, `src/app/actions/`, `src/app/api/` changes from this slice |
| Doc completeness | Manual review | All 16 sections present |

---

## 16. Open questions / deferred BE-required ideas

| # | Question | Owner | Blocks |
|---|----------|-------|--------|
| 1 | Should watchlist “action hints” become server-derived? | Product | Watchlist trust |
| 2 | TP prefill from setup on `/trades/new` — allowed as display-only or must submit? | Product | Form slice |
| 3 | Merge strategy for `candidate-row-client.tsx` vs dense table slice 2? | FE lead | Setups slice start |
| 4 | Is `DASHBOARD_COMMAND_CENTER_V1_ACCEPTANCE.md` needed formally? | QA | Sign-off |
| 5 | Command palette scope: route jump only vs fuzzy search? | Product | App shell slice |
| 6 | Framer Motion: standardize or reduce to CSS? | FE | Motion consistency |
| 7 | Review session: default mode for power users? | Product | Trades slice |
| 8 | TZ for health checkpoint “today” | Backend | Review counts accuracy |

**Deferred BE ideas catalog:** See §14 and `05-integration-mismatches.md` items 2, 4, 5, 7, 8, 10, 11.

---

## Appendix A — Post-doc git verification

*To be filled after file write:*

```
git status --short
```

Expected: `?? docs/integration/FRONTEND_UI_UX_ENHANCEMENT_PLAN_ZERO_BE.md` only as new artifact from this audit; all pre-existing `M`/`??` entries unchanged.

---

*End of plan. Implementation requires explicit approval.*
