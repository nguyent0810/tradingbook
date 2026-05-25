# Decision Cockpit — DTO-first spike plan

**Status:** SPIKE IN PROGRESS (lib + tests; production `/dashboard` unchanged)  
**UX spec:** [DASHBOARD_DECISION_COCKPIT_UX_SPEC.md](../design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md) (committed `37d9839`)  
**Implementation:** `src/lib/dashboard/decision-cockpit-dto.ts`

---

## 1. Goal

Build one **tested server view model** (`buildDecisionCockpitDto`) before reordering production dashboard UI. No fake confidence %, breadth %, or NEUTRAL state.

---

## 2. Loader inventory (current `/dashboard`)

| Loader / field | Used today | Cockpit block |
|----------------|------------|---------------|
| `getSession` + `prisma.trade.findMany` | Open/closed book | Risk guardrail (exposure) |
| `getMarketRegimeFromDb("VNINDEX")` | `regime.level`, VNINDEX line | Evidence — **live Gate 1** |
| `fetchMarketSessionSnapshot` + `analyzeMarketDataAlignment` | Freshness inputs | Evidence / trust |
| `buildMarketFreshnessDto` | Market status bar | Evidence / confidence |
| `getLatestDailyScanRun` | Scan meta, counts, candidates | Verdict, evidence, opportunity |
| `parseDailyScanGate2Notes` | `decision`, rejections, near-miss | Verdict, blockers, opportunity |
| `toCandidateRows` + `prepareSurfacedCandidatesHealthView` | Best setups top 5 | Opportunity + ladder |
| `computeDailyTradingDecision` | Fallback verdict | Verdict (when notes.decision absent) |
| `setupWatchItem.findMany` | Watchlist panel | Tomorrow watch + opportunity supplement |
| `prisma.stockDailyBar` (watch closes) | Distance to zone | Watchlist (optional in DTO v1) |

**Not wired on dashboard today:** `closestToValidSymbols` (only `/setups`), momentum rows, gate2 funnel counts.

---

## 3. DC-1 Gate 1 resolution (documented + implemented)

| Source | When used | Provenance |
|--------|-----------|------------|
| `latestScan.gate1Level` | Scan exists | **Canonical** for verdict + primary evidence chip |
| `getMarketRegimeFromDb().level` | Always loaded | **Live** chip when mismatch; fallback canonical when no scan |

`Gate1Resolution.mismatch === true` when scan and live differ. Production dashboard today uses **live regime only** for `computeDailyTradingDecision` fallback — DTO spike fixes this for future UI.

---

## 4. `buildDecisionCockpitDto` shape

Pure function: `DecisionCockpitInput` → `DecisionCockpitDto`. Callers keep existing Prisma/RSC loaders; map into snapshots (no new DB queries in v1).

### Blocks

| Block | DTO section | Key fields |
|-------|-------------|------------|
| Today's Verdict | `verdict` | `uxLevel`, `persistedLevel`, `explanation`, `allocation`, `perTradeGuidance`, `confidenceBand`, `gate1Resolution` |
| Evidence Stack | `evidence[]` | Chips: Gate 1, VNINDEX, Tier A/B, surfaced, universe, aligned, scan time |
| Opportunity Board | `opportunity` | `mode`: candidates \| near_miss \| empty |
| Setup Quality Ladder | `ladder[]` | `ladderStage` per symbol |
| Risk Guardrail | `risk` | caps, exposure, static rules |
| Tomorrow's Plan | `tomorrow` | watch, trigger, avoid, posture |
| Actionable Diagnostics | `blockers[]` | ≤3, severity-sorted |

Each verdict field uses `ProvenanceField<T>` (`real` \| `derived` \| `static_copy` \| `gap`).

### Explicit non-fields

- `confidencePercent` — **not implemented** (gap DC-4)
- `breadthPercentHealthy` — **not implemented** (mock)
- `neutralBadge` — **not implemented** (mock)

---

## 5. Mapping rules (summary)

| Rule | Function |
|------|----------|
| NORMAL → TRADE | `mapDecisionLevelToUxVerdict` |
| Verdict source | `scanNotes.decision` else `computeDailyTradingDecision(canonical Gate 1, A/B counts)` |
| Confidence band | `computeConfidenceBand` (high/medium/low only) |
| Ladder (surfaced) | `resolveSetupLadderStage` |
| Ladder (near-miss) | `resolveNearMissLadderStage` + `computeClosestExecutionStatus` |
| Blockers | `buildActionableBlockers` — real counts/symbols + severity classes |
| Tomorrow | `buildTomorrowPlan` — derived from opportunity + watchlist + blockers |

---

## 6. Unit tests

**File:** `src/lib/dashboard/decision-cockpit-dto.test.ts`

| Case | Asserts |
|------|---------|
| DC-1 mismatch | Scan PASS + live WARNING → canonical PASS, mismatch true |
| Zero surfaced prod-like | NO_TRADE, near-miss HPG, blockers real counts |
| No fake metrics | JSON has no confidencePercent / NEUTRAL / breadth |
| TRADE day | NORMAL → ux TRADE, tier_a ladder, setupCandidateId hint |
| Blocker cap | ≤3 items |
| Confidence low | Missing benchmark → low band |

Run: `npm test -- src/lib/dashboard/decision-cockpit-dto.test.ts`

---

## 7. Integration phases (after UX + DTO review)

| Phase | Work | Production touch |
|-------|------|------------------|
| **S1** | Map `dashboard/page.tsx` loaders → `DecisionCockpitInput` | Read-only parallel render behind flag (optional) |
| **S2** | Replace layout blocks with cockpit components | `/dashboard` UI reorder |
| **S3** | Wire P1 lifecycle warnings into ladder | Display only |
| **S4** | DC-5 risk budget API | Exposure meter headroom |

**Out of scope:** Prisma schema, scanner rules, cron, Server Actions, new routes.

---

## 8. Backend gaps (unchanged priorities)

See UX spec §11 (DC-1 … DC-10) and [06-backend-gaps.md](./06-backend-gaps.md) P1 #4–6.

**Spike closes:** DC-1 (documented), DC-2 (foundation), DC-6 (tomorrow derived), DC-7 (blocker severity in FE).

**Still open:** DC-3 persisted ladder, DC-4 formal confidence model, DC-5 risk budget API.

---

## 9. Review checklist

- [ ] Gate 1 canonical = scan when scan exists (agreed with Setups)
- [ ] No mock breadth/confidence % in DTO or preview
- [ ] Near-miss on dashboard path when surfaced = 0
- [ ] Blockers ≤3 with real counts/samples
- [ ] Tests green before UI slice
