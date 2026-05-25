# Decision Cockpit — S1 integration plan

**Status:** PLANNED (not started on production `/dashboard`)  
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
- [ ] Wire parallel `buildDecisionCockpitDto` in `dashboard/page.tsx` (Option A)
- [ ] Optional: `data-testid="dashboard-cockpit-dto-ready"` empty marker in HTML comment for e2e (no visible UI)
- [ ] Document prod comparison: log `cockpitDto.verdict.gate1Resolution.mismatch` once in staging
- [ ] `npm run lint` · `npm test` · `npm run build`
- [ ] Update this doc status → IN PROGRESS / DONE
- [ ] Do **not** push until reviewed (same as Phase 2+3)

---

## 8. S2 preview (after S1 sign-off)

Replace hero row with Verdict + Evidence + Opportunity using DTO-driven components; demote performance/momentum/diagnostics per UX spec.

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
