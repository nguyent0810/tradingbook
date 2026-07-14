> **ARCHIVED** — superseded by [`docs/design/PLAYBOOK.md`](../design/PLAYBOOK.md) (principles) and [`docs/design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md`](../design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md) (current, implemented IA). This PRD's decision-hierarchy and anti-pattern guidance was ported forward; its concrete section inventory (Today's Action, Best Setups, Watchlist, Diagnostics) has been superseded by the Decision Cockpit's verdict/evidence/opportunity/guardrail/tomorrow's-plan structure. Kept for historical reference only.

# Trading Dashboard PRD

## 1) Core Philosophy

This dashboard is **decision-first**, not data-first.

- Primary objective: improve trade decisions under uncertainty.
- Secondary objective: preserve capital by avoiding low-quality or late entries.
- Principle: show only what changes action now; hide the rest behind progressive disclosure.
- Quality bar: a trader should decide in ~5 seconds whether to act, wait, or skip.

## 2) Decision Hierarchy

Use a strict top-down flow:

1. **Market** - Is environment favorable enough to deploy risk today?
2. **Setups** - Are there any valid surfaced opportunities?
3. **Health** - Is each setup still tradable or degrading?
4. **Risk** - Does this trade fit account and portfolio constraints?
5. **Execution** - What exact action is allowed right now?

If a higher layer blocks action, do not override with lower-layer optimism.

## 3) Dashboard Sections (Production Scope)

## Today’s Action

Purpose: one-line daily stance from scanner context (market + setup availability).

- Inputs: Gate 1 regime, surfaced setup counts, decision payload.
- Output: stance (`NORMAL`, `REDUCED`, `NO_TRADE`) + allocation guidance.
- UI role: top card, always visible.

Example:
- `Today’s Action: NO_TRADE`
- `Max exposure guidance: 0%`
- `Reason: Market mixed and no Tier A setup available.`

## Best Setups

Purpose: shortlist surfaced candidates ranked for immediate review.

- Inputs: surfaced candidates from scanner (`A/B`), execution proximity, health overlay.
- Output: compact rows with symbol, quality, health level, score label, key prices.
- UI role: first actionable table.

Example row:
- `DEMOSETUP  READY  HEALTHY  Strong (100)  close 92.5  zone 90-93  stop 86.5`

## Watchlist

Purpose: track non-triggered opportunities that may become executable.

- Inputs: lifecycle state (`WATCHING`, `READY`) and health state.
- Output: queue with next expected event (retest, digest, reset).
- UI role: optional list below surfaced setups when available.

Example:
- `SAB  WATCHING  WARNING`
- `Next: wait for pullback zone interaction`

## Diagnostics

Purpose: explain why symbols are not surfaced; reduce impulsive off-system trades.

- Inputs: Gate 2 rejection buckets and sample symbols.
- Output: expandable categories (`what it means`, `wait for`, sample symbols).
- UI role: disclosure sections for evidence and coaching.

Example:
- `Breakout failed to hold (4)`
- `Wait for: close above breakout level and hold as support`

## Portfolio Risk

Purpose: enforce account-level and portfolio-level risk limits before execution.

- Inputs: equity, max exposure, current exposure, per-trade cap, stop distance.
- Output: position size, capital used, remaining risk budget, sector concentration.
- UI role: position sizing block attached to each setup.

Example:
- `Risk at stop: 4,998,000 ₫`
- `Position % of account: 15.41%`

## Portfolio Allocation Strategy (Capital Preservation)

Allocation is governed by stance first, then setup quality.

- **Max portfolio exposure by stance**
  - `NO_TRADE`: 0%
  - `REDUCED`: 20-40%
  - `NORMAL`: 50-70%
- **Max per-trade exposure**: clamp to 10-20% of account equity.
- **Multi-setup allocation**
  - Split exposure budget across top-priority setups, do not fully allocate to first row.
  - Keep reserve capacity (at least 10% of stance budget) for late-session updates.
- **Tier A vs Tier B sizing**
  - Tier A baseline: 1.0x sizing unit.
  - Tier B baseline: 0.5-0.7x of Tier A.
- **Correlation control**
  - If two setups share high sector/beta correlation, reduce each by 20-40%.
  - Prefer one primary setup per correlated cluster.

Example (NORMAL day, 60% cap, 3 setups):
- Setup 1 (Tier A): 20%
- Setup 2 (Tier A, same sector as #1): 12% (reduced for correlation)
- Setup 3 (Tier B): 10%
- Reserve: 18%

## Portfolio Panel (Required Surface)

Purpose: make allocation limits explicit before execution.

- `Capital allocated across setups` (sum of planned/active allocations)
- `Remaining capacity` (stance cap minus allocated)
- `Sector exposure` (e.g. Banking 28%, Tech 12%)
- Optional warning lines:
  - `Sector concentration high (>35%)`
  - `Capacity exceeded by planned orders`

## Execution Feedback Loop (Self-Improving Engine)

Purpose: convert completed trades into practical system feedback.

- Capture a small set of execution + context fields at entry.
- Aggregate weekly performance snapshots.
- Surface only 1-2 actionable insight lines to improve next decisions.

### Minimal Schema Additions

Use lightweight fields attached to existing trade records (or a linked execution snapshot table).

Core captured fields per executed trade:

- `entryLocationVsZone` (enum)
  - `IN_ZONE`, `ABOVE_ZONE`, `BELOW_ZONE`
- `healthLevelAtEntry` (enum)
  - `HEALTHY`, `WARNING`, `AT_RISK`, `DEAD`
- `healthScoreAtEntry` (int, 0-100)
- `riskUsedPct` (float)
  - % of account risk used for this trade
- `rMultiple` (float)
  - realized result in R units
- `setupTierAtEntry` (enum)
  - `A`, `B`
- `entryTimingTag` (enum)
  - `READY_ON_OPEN`, `READY_INTRADAY`, `LATE_CHASE`, `RETEST_ENTRY`

Suggested Prisma shape (illustrative):

- Add columns to `Trade`:
  - `entry_location_vs_zone` (String/enum)
  - `health_level_at_entry` (String/enum)
  - `health_score_at_entry` (Int)
  - `risk_used_pct` (Float)
  - `r_multiple` (Float)
  - `setup_tier_at_entry` (String/enum)
  - `entry_timing_tag` (String/enum)

Keep optional/null for legacy trades.

### Summary Metrics (Weekly, Action-Focused)

Compute from closed trades in a rolling weekly window.

- `Win rate by Tier` (`A` vs `B`)
  - wins / total per tier
- `Performance by Health at entry`
  - average `rMultiple` by `HEALTHY/WARNING/AT_RISK/DEAD`
- `Performance by Entry timing`
  - average `rMultiple` and win rate by `entryTimingTag`
- `Risk efficiency`
  - average `rMultiple` per 1% risk used

Minimum sample safeguards:

- If sample size < 5 trades in bucket, show `low sample` marker.
- Do not generate prescriptive guidance from low-sample buckets.

### Weekly Feedback Card (UI)

Single compact card, no full analytics page.

Required fields:

- `This week: +2.6R` (or `-1.4R`)
- `Win rate: 57% (4/7)`
- `Tier A vs B: 63% vs 33%`
- `Best context: HEALTHY entries (+0.9R avg)`

Insight lines (max 2):

- `Tier A entries outperform Tier B this week; prioritize A setups.`
- `Late chase entries underperform (-0.7R avg); wait for retest-ready timing.`

### Decision Usage

Use feedback as a guardrail, not a hard rule engine:

- If `AT_RISK` entries underperform for 2-3 weeks, tighten allocation for `AT_RISK`.
- If `IN_ZONE` entries consistently outperform `ABOVE_ZONE`, reinforce wait discipline.
- If Tier B drags expectancy, reduce Tier B size multiplier further.

No automatic strategy mutation in this phase; human-in-the-loop adjustment only.

## 4) User Decisions Per Section

## Today’s Action
- Decide whether to trade at all today.
- Decide maximum portfolio exposure ceiling.

## Best Setups
- Decide which 0-2 setups deserve deeper review now.
- Decide whether setup is executable (`READY`) or requires waiting.

## Watchlist
- Decide what to monitor next session (not what to buy now).
- Decide alerts/checklist for setup progression.

## Diagnostics
- Decide why to stand down on rejected names.
- Decide what must change before reconsidering.

## Portfolio Risk
- Decide maximum allowed position size.
- Decide if setup remains valid after risk constraints.

## 5) Action Mapping

Use explicit behavioral guidance:

- **READY**: Eligible for execution workflow. Validate risk and plan order.
- **WAIT**: Do not execute. Monitor trigger condition only.
- **INVALID**: Skip setup. Remove from active consideration until re-qualified.
- **AT_RISK**: Avoid initiating fresh risk unless strong reset appears; prioritize patience.

Execution emphasis:
- `READY + HEALTHY/WARNING`: eligible if portfolio capacity and per-trade caps allow.
- `READY + AT_RISK`: reduce size, prefer wait-for-reset unless exceptional context.
- `READY + DEAD`: do not allocate new capital (row remains informational).

If state combinations conflict, follow strictness:
`INVALID`/`DEAD` > `AT_RISK` > `WAIT` > `READY`.

## 6) Anti-Patterns (Avoid)

- Treating diagnostics as entry signals.
- Overriding market stance because one chart "looks good".
- Chasing extended setups despite `AT_RISK`/`DEAD` warnings.
- Expanding every row before selecting a candidate.
- Overloading top-level cards with raw metrics.
- Replacing explicit actions with generic sentiment language.

## 7) Success Criteria

The dashboard succeeds when:

- A trader can identify daily stance in <= 5 seconds.
- A trader can classify each surfaced setup as act/wait/skip in <= 5 seconds.
- Risk sizing can be completed without external calculator.
- Diagnostics reduce impulsive out-of-system trades.
- UI remains readable at normal laptop width without clipped decision text.
- User can confirm allocation safety (capacity + sector concentration) in <= 5 seconds.

## Sorting Refinement (Best Setups)

Primary sort order for surfaced candidates:

1. `READY` first
2. closest to entry zone
3. best health (`HEALTHY` -> `WARNING` -> `AT_RISK` -> `DEAD`)
4. highest health score

This ordering is decision-centric: execution readiness first, then quality/risk.

## UI Mapping to Current System

- Scanner regime + decision -> `Today’s Action` block.
- Surfaced candidates (`A/B`) -> `Best Setups` table.
- Lifecycle (`WATCHING/READY/...`) + health overlay -> row badges and details.
- Rejection categories -> `Diagnostics` accordion.
- Position sizing inputs/outputs -> per-candidate risk block.
- Portfolio panel -> aggregate from sizing + stance + sector grouping.
- Weekly feedback card -> aggregates closed-trade outcomes (small, actionable loop).

This PRD intentionally aligns with current Next.js app architecture and existing scanner/lifecycle/health/position-sizing primitives.

