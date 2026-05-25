# Decision Cockpit — S1 integration plan

**Status:** S1–S5 on production (`e58199a`) · **S6 local** — full cockpit layout reorder per UX spec  
**Prerequisites (pushed):** `37d9839` UX spec + preview · `596e792` `buildDecisionCockpitDto` + tests  
**Spike doc:** [DASHBOARD_DECISION_COCKPIT_DTO_SPIKE.md](./DASHBOARD_DECISION_COCKPIT_DTO_SPIKE.md)

---

## 1. S1 goal

Wire **existing** `dashboard/page.tsx` loader output into `DecisionCockpitInput` → `buildDecisionCockpitDto()` **without**:

- Reordering dashboard layout or visual hierarchy
- Changing which panels render
- Adding mock fields (confidence %, breadth %, NEUTRAL)

S1 proves the DTO matches real production data and fixes **DC-1** at the mapping layer before cockpit UI (S2).

---

## 2. Current loader inventory (`src/app/(dashboard)/dashboard/page.tsx`)

| Step | Loader / computation | Variable(s) | Used by UI today |
|------|----------------------|-------------|------------------|
| 1 | `getSession` | session | auth |
| 2 | `prisma.trade.findMany` | `trades` | performance panel |
| 3 | `getMarketRegimeFromDb` | `regime` | decision fallback **Gate 1**, hero meta |
| 4 | `fetchMarketSessionSnapshot` | `marketSnapshot` | freshness |
| 5 | `analyzeMarketDataAlignment` | `alignmentAnalysis` | freshness |
| 6 | `getLatestDailyScanRun` | `latestScan` | scan meta, candidates, counts |
| 7 | `parseDailyScanGate2Notes` | `scanNotes` | decision, diagnostics, backdrop |
| 8 | `buildMarketFreshnessDto` | `freshness` | market status bar |
| 9 | `toCandidateRows` + `prepareSurfacedCandidatesHealthView` | `candidatesWithHealth`, `topSetups` | best setups |
| 10 | `computeDailyTradingDecision` (fallback) | `decision` | hero, exposure — **uses `regime.level`** |
| 11 | Open trades reduce | `currentExposure` | exposure panel |
| 12 | `setupWatchItem.findMany` | `activeWatchItems` | watchlist |
| 13 | `stockDailyBar` distinct | `latestCloseBySymbol` | watchlist distances |
| 14 | Rejection slice | `rejectionBuckets` | diagnostics (top 5) |
| 15 | `MomentumWatchSection` | internal fetch | momentum block |

**Not loaded on dashboard today:** full `closestToValidSymbols` UI (in `scanNotes` but only via diagnostics copy pointing to Setups).

---

## 3. Field mapping → `DecisionCockpitInput`

Implemented in `src/lib/dashboard/map-dashboard-cockpit-input.ts` (mapper only; page not wired yet).

| `DecisionCockpitInput` field | Source on dashboard page | Notes |
|------------------------------|--------------------------|-------|
| `latestScan` | `latestScan` | `id`, `runAt`, `gate1Level`, A/B/surfaced counts; `universeScannedCount` omitted (not on run row today) |
| `scanNotes` | `scanNotes` | Includes `decision`, `topRejectionCategories`, `rejectionSymbolsByCategory`, `closestToValidSymbols` |
| `liveRegime` | `regime` | `level`, `symbol`, `latestBar` |
| `freshness` | `freshness` | Already built |
| `surfacedCandidates` | `candidatesWithHealth` (all, not only top 5) | Full list for opportunity/ladder |
| `watchlist` | `activeWatchItems` | symbol, lifecycle, health, zones |
| `openExposureVnd` | `currentExposure` | OPEN notional |
| `portfolioRiskConfigured` | `isTradingRiskBudgetConfigured()` | env flag |

**DTO output blocks** (no extra queries):

| Cockpit block | Fed by |
|---------------|--------|
| Verdict | `scanNotes.decision` or DTO `computeDailyTradingDecision` with **scan Gate 1** |
| Evidence | freshness + scan counts + regime |
| Opportunity | `candidatesWithHealth` or `scanNotes.closestToValidSymbols` |
| Ladder | same as opportunity |
| Risk | decision + exposure |
| Tomorrow | opportunity + watchlist + blockers |
| Blockers | `scanNotes` rejection maps |

---

## 4. DC-1 behavior change (S1 vs production UI)

| | Production UI today (`596e792` parent) | S1 DTO path |
|--|----------------------------------------|-------------|
| Verdict fallback Gate 1 | `regime.level` (live) | `latestScan.gate1Level` when scan exists |
| Hero Gate 1 display | `regime.level` | Unchanged until S2 |
| Evidence | Partial | DTO adds live chip on mismatch |

S1 may compute DTO in parallel; **hero still uses legacy decision** until product signs off on DTO verdict.

---

## 5. No-risk integration options (pick one for S1 implementation commit)

### Option A — Parallel compute only (recommended)

In `dashboard/page.tsx` after existing loaders:

```typescript
import { buildDashboardCockpitInput } from "@/lib/dashboard/map-dashboard-cockpit-input";
import { buildDecisionCockpitDto } from "@/lib/dashboard/decision-cockpit-dto";

const cockpitInput = buildDashboardCockpitInput({ ... });
const cockpitDto = buildDecisionCockpitDto(cockpitInput);
void cockpitDto; // or log in development only
```

- No JSX changes except optional dev-only block.
- Zero user-visible diff in production.

### Option B — Dev-only debug panel

Render when `process.env.NODE_ENV === "development"` && `?cockpit=1`:

- `<pre data-testid="dashboard-cockpit-dto-debug">` with `JSON.stringify(cockpitDto, null, 2)` summary (verdict, opportunity.mode, blockers.length).
- Gated behind query param so prod users never see it.

### Option C — Tests only (current state + mapper tests)

- `map-dashboard-cockpit-input.test.ts` validates mapping from fixture page bundle.
- No `page.tsx` edit until Option A approved.

**Recommendation:** **Option A + C** in one S1 commit: mapper tests + parallel compute with no render. Option B only if you want manual QA in dev.

---

## 6. Explicitly out of S1

- Production UI reorder (S2)
- New Prisma queries / schema
- Momentum rows in DTO (defer — separate audit track; disclaimer stays on dashboard)
- `universeScannedCount` until field exists on `DailyScanRun` or notes
- Replacing `DashboardDecisionHero` props with DTO

---

## 7. S1 implementation checklist

- [x] Mapper `buildDashboardCockpitInput` in `src/lib/dashboard/map-dashboard-cockpit-input.ts` + unit tests
- [x] Wire parallel `buildDecisionCockpitDto` in `dashboard/page.tsx` (`3228344`)
- [x] `npm run lint` · `npm test` · `npm run build` — pushed `3228344`

---

## 8. S2 — verdict + evidence render (`857a761`)

- [x] `DashboardDecisionHero` from `cockpitDto.verdict` (TRADE not NORMAL in UI)
- [x] `DashboardEvidenceStack` after hero row (chips + top 2 blockers)
- [x] Production validation — [DASHBOARD_FE_REBUILD_PLAN.md](./DASHBOARD_FE_REBUILD_PLAN.md) § Production validation — Decision Cockpit S2

**Out of S2 (unchanged):** exposure, best setups, momentum, watchlist, diagnostics data paths.

---

## 9. S3 — exposure alignment + opportunity preview (`a9337ff`)

### Part A — Exposure

- [x] `DashboardExposurePanel` consumes `cockpitDto.risk` + `cockpitDto.verdict` (not legacy `decision` / `regime.level`)
- [x] Max book, per-trade, stance, Gate 1 (canonical + live when mismatch) aligned with verdict hero
- [x] Open notional unchanged (`risk.openExposureVnd` — same entry×qty derivation)
- [x] Honest copy when `TRADING_ACCOUNT_EQUITY_VND` unset (qualitative caps; DC-5 headroom still gap)
- [x] Top 2 `risk.rules` shown as bullets (includes gap-labeled stop/R rules)

### Part B — Opportunity preview

- [x] `DashboardOpportunityPreview` from `cockpitDto.opportunity` only (no new queries)
- [x] Modes: `candidates` | `near_miss` | `empty` with link to `/setups`
- [x] Near-miss from `scanNotes.closestToValidSymbols` via existing dashboard loader path (**DC-9 partial** — dashboard preview only; full queue still on Setups)
- [x] `DashboardBestSetupsPanel` retained (table detail unchanged)

### Production validation (2026-05-25)

| Check | Result |
|-------|--------|
| Deploy SHA | `a9337ff` |
| `/api/db-health` | `{"ok":true}` |
| `/dashboard` logged out | **307** → `/login` |
| Exposure ↔ verdict Gate 1 | Aligned (canonical scan Gate 1) |

See [DASHBOARD_FE_REBUILD_PLAN.md](./DASHBOARD_FE_REBUILD_PLAN.md) § Production validation — Decision Cockpit S3.

## 10. S4 — actionable diagnostics + tomorrow plan (production)

### Part A — Actionable blockers

- [x] `DashboardActionableBlockers` replaces flat `DashboardDiagnosticsStack` on `/dashboard`
- [x] Data: `cockpitDto.actionableDiagnostics` (= `blockers`, max 3, severity-sorted)
- [x] Fields: severity label, title, **meaning**, count, real sample symbols (≤3), wait-for
- [x] Preserved testids: `dashboard-diagnostics-panel`, `dashboard-diagnostics-stack`, `dashboard-diagnostics-empty`
- [x] Link to `/setups` for full Gate 2 detail

### Part B — Tomorrow’s plan

- [x] `DashboardTomorrowPlan` from `cockpitDto.tomorrow`
- [x] Watch / trigger / avoid / posture sections
- [x] `watchNote` when no symbols (honest near-miss / setups copy — no fabrication)
- [x] Testids: `dashboard-tomorrow-plan`, `dashboard-tomorrow-watch`, `dashboard-tomorrow-trigger`, `dashboard-tomorrow-avoid`, `dashboard-tomorrow-posture`

### DTO

- [x] `ActionableDiagnosticsDto`, `meaning` on blockers, `watchNote` on `TomorrowPlanDto`
- [x] Tests: near-miss plan, empty near-miss plan, candidate day, blocker cap, real symbols only

### Layout

- [x] `dash-cockpit__plan-row` after watchlist (2-col on lg) — not full UX reorder

### Production validation (2026-05-25)

| Check | Result |
|-------|--------|
| Deploy SHA | `bcbad8e` |
| `/api/db-health` | `{"ok":true}` |
| `/dashboard` logged out | **307** → `/login` |
| Tomorrow + actionable blockers | Deployed on `/dashboard` |
| Full diagnostics detail | Still on `/setups` |

See [DASHBOARD_FE_REBUILD_PLAN.md](./DASHBOARD_FE_REBUILD_PLAN.md) § Production validation — Decision Cockpit S4.

## 11. S5 — setup quality ladder + Best Setups dedup (production)

### Part A — Setup quality ladder

- [x] `setupQualityLadder` on `DecisionCockpitDto` — grouped counts from full `surfacedCandidates` + `closestToValidSymbols` (no new queries)
- [x] `DashboardSetupQualityLadder` — six stages always visible (zero state per stage)
- [x] Up to 3 real sample symbols per stage; no fabrication
- [x] Placement: after Opportunity preview, before scan meta / Best Setups
- [x] Testids: `dashboard-setup-quality-ladder`, `dashboard-ladder-stage-*`, `dashboard-ladder-count-*`

### Part B — Opportunity vs Best Setups

- [x] `resolveBestSetupsPanelPresentation` — `full_table` when rows exist; `compact_empty` when zero
- [x] Compact copy points to Opportunity preview on `near_miss` / `empty` (no repeated Gate 1 paragraph)
- [x] `dashboard-best-setups-empty` preserved

### Production validation (2026-05-25)

| Check | Result |
|-------|--------|
| Deploy SHA | `e58199a` |
| `/api/db-health` | `{"ok":true}` |
| `/dashboard` logged out | **307** → `/login` |
| Setup quality ladder | Deployed — six stages on `/dashboard` |
| Best Setups dedup | `compact_empty` / `full_table` per `resolveBestSetupsPanelPresentation` |

See [DASHBOARD_FE_REBUILD_PLAN.md](./DASHBOARD_FE_REBUILD_PLAN.md) § Production validation — Decision Cockpit S5.

## 12. S6 — full cockpit layout reorder (local)

### Zones (top → bottom)

1. **Status** — `DashboardMarketStatusBar` + `DashboardScanMetaStrip` (`dashboard-cockpit-zone-status`)
2. **Decision** — verdict + exposure grid; evidence full width below (`dashboard-cockpit-zone-decision`)
3. **Opportunity** — preview + ladder side-by-side on lg (`dashboard-cockpit-zone-opportunity`)
4. **Execution** — Best Setups → momentum + watchlist → performance (`dashboard-cockpit-zone-execution`)
5. **Next session** — tomorrow + blockers (`dashboard-cockpit-zone-next-session`)

### Polish

- [x] NO_TRADE decision zone tint (`dash-cockpit__zone--no-trade`)
- [x] Blockers visually lighter than verdict/opportunity (next-session zone CSS)
- [x] Performance panel demoted (compact padding in execution zone)
- [x] All existing testids preserved; zone wrappers additive

### Remaining (S7+)

- [ ] Risk budget headroom API (DC-5)

### Caveats (unchanged)

- Parsed % vs equity only when env configured and verdict ≠ NO_TRADE — labeled qualitative / DC-5.
- Opportunity preview max 5 candidates / 8 near-miss; ladder classifies **all** surfaced + closest rows (may exceed preview cap).

---

## 9. Validation commands

```bash
npm run lint
npm test
npm run build
```

Targeted:

```bash
npm test -- src/lib/dashboard/
```

Logged-in manual (after Option B or S2): compare DTO `verdict.uxLevel` vs hero `decision.level` when Gate 1 mismatch.
