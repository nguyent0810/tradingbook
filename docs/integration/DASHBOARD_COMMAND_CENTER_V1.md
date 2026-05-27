# Dashboard Command Center v1

**Slice:** Smart Large Slice — Dashboard Command Center v1 (FE)  
**Worktree:** `D:/Tools/Trading` only  
**Depends on:** Production core recovery + post-recovery scanner interpretation (`POST_RECOVERY_SCANNER_INTERPRETATION_VND_PDR.md`)

---

## What shipped

Visible `/dashboard` improvements that explain **fresh data + empty Best Setups** without hiding scanner truth:

1. **Market / data freshness** — existing `DashboardMarketStatusBar` + `DashboardScanMetaStrip` (now includes tradable count).
2. **Trading decision summary** — new panel: Gate1, verdict (NO_TRADE/PROBE/NORMAL), Tier A/B counts, tradable count, why no setups.
3. **Best Setups** — intentional empty state when 0 Tier A/B (coverage fresh; Gate2 rules).
4. **Momentum Watch** — existing loader, limit raised to 8; explicit “observational only” copy.
5. **Near miss / rejection** — dedicated panel with VND/PDR trader notes when applicable.
6. **Data integrity notes** — smoke exclusion, recovery context, session alignment.

Reuses existing cockpit stack (`buildDecisionCockpitDto`, `DashboardEntrance`, command/opportunity/secondary zones).

---

## Data sources (no new APIs)

| Surface | Source |
|---------|--------|
| Freshness | `buildMarketFreshnessDto`, `fetchMarketSessionSnapshot` |
| Scan meta | `getLatestDailyScanRun` |
| Verdict / opportunity / near-miss | `buildDecisionCockpitDto` ← `parseDailyScanGate2Notes`, regime |
| Momentum Watch | `getMomentumWatchRowsForPhase1` |
| Best Setups table | `prepareSurfacedCandidatesHealthView` + `toCandidateRows` |

---

## Why Best Setups can be empty

Example production state after recovery (scan `cmpnh6y98000004l4euheytfb`):

- **206** symbols scanned, **54** tradable, **0** Tier A/B surfaced.
- **Gate1 WARNING** → Tier B suppressed even if present.
- Dominant Gate2 buckets: trend structure, breakout recency, pullback-box interaction.

Empty Best Setups means **no validated breakout-pullback template match**, not missing bars.

---

## Momentum Watch vs Best Setups

| | Best Setups | Momentum Watch |
|---|-------------|----------------|
| Pipeline | Gate2 breakout-pullback → Tier A/B | Fresh Breakout Audit (observational) |
| PDR | Fails Gate2 (no prior-session breakout in window) | Can show `FRESH_BREAKOUT` |
| VND | Fails pullback-box interaction | Usually excluded (`FAILED_BREAKOUT_RISK`) |
| UI disclaimer | Validated setups only | “Not a validated Best Setup” |

---

## Near misses (VND-like)

`DashboardNearMissRejectionsPanel` reads `cockpitDto.opportunity.nearMiss` from scan notes `closestToValidSymbols`.

- **VND:** pullback zone interaction — price above box, not actionable in template.
- **PDR:** breakout recency fail — may still appear in Momentum Watch.

---

## Deferred

- Gate2 threshold changes.
- New setup types (e.g. Breakout Ignition) as Tier A/B.
- Analytics / Settings routes.
- `/trades/page.tsx` refactor.
- Fake candidates or momentum rows.

---

## Files (Dashboard v1)

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/components/dashboard/dashboard-trading-decision-summary.tsx`
- `src/components/dashboard/dashboard-near-miss-rejections-panel.tsx`
- `src/components/dashboard/dashboard-data-integrity-notes.tsx`
- `src/components/dashboard/dashboard-scan-meta-strip.tsx`
- `src/components/momentum-watch-section.tsx`
- `src/lib/dashboard/decision-cockpit-dto.ts` (empty-state copy only)
- `src/app/globals.css` (v1 panel styles)
