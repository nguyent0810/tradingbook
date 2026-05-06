# Setup -> Trade -> Outcome Learning Loop (Design Review)

## Scope

This document reviews how to connect setup generation and trade execution into a single learning loop for the current trading app.

- In scope: product/data design, lifecycle, schema proposal, UX behavior, phased rollout.
- Out of scope: code implementation in this review.

---

## 1) Current Problem

Today the app has two valuable but disconnected surfaces:

- `Setups` page suggests trade opportunities.
- `Trades` page manually records trade actions/results.

Because there is no durable link between setup and trade:

- We cannot reliably measure which setup patterns drive profit/loss.
- We cannot evaluate entry quality in context of setup health.
- We cannot close the loop from outcome back to future setup prioritization.
- Free-text notes are useful for journal context, but weak for consistent analytics.

Net impact: decision quality and capital allocation cannot systematically improve from actual outcomes.

---

## 2) Proposed Lifecycle Model

Target lifecycle:

`Setup suggestion`  
-> `Create Trade from Setup`  
-> `Monitor Trade Health`  
-> `Close Trade`  
-> `Write Outcome`  
-> `Update Setup Performance / Learning History`

### Lifecycle intent

- Keep setup context immutable at entry time (snapshot for auditability).
- Treat open trade as a **living entity** with visible health.
- Treat close as a structured event that writes learning data, not just P&L.

---

## 3) Data Model Proposal

Model design follows two principles:

1. **Auditability first** (immutable snapshots + explicit events)
2. **Dropdown-first analytics** (enums over free text where possible)

## Setup (existing + extension context)

Recommended fields (logical view):

- `id`
- `symbol`
- `timeframe`
- `direction`
- `setupType`
- `setupTier`
- `zoneHigh`
- `zoneLow`
- `detectedAt`
- `setupSnapshot` (JSON, immutable context at detection)

Notes:

- `setupSnapshot` should include key levels, health at detect time (if available), and scanner reasons.
- Keep this separate from mutable watch state to preserve historical truth.

## Trade

Recommended fields:

- `id`
- `setupId` (nullable for manual trades; see decisions section)
- `entryPrice`
- `stopLoss`
- `takeProfit`
- `positionSize`
- `entryAt`
- `entryReason` (enum)
- `entryLocationVsZone` (enum)
- `healthLevelAtEntry` (enum)
- `healthScoreAtEntry`
- `status` (`ACTIVE | CLOSED`)
- `exitPrice`
- `exitAt`
- `exitReason` (enum)
- `exitDiscipline` (enum)
- `rMultiple`
- `pnl`
- `outcome` (`WIN | LOSS | BREAKEVEN`)
- `entryNote` (optional)
- `exitNote` (optional)

Notes:

- `healthLevelAtEntry` / `healthScoreAtEntry` are snapshots, never retroactively mutated.
- `entryNote` and `exitNote` remain optional journaling fields (not primary analytics drivers).

## TradeHealthLog

Recommended fields:

- `tradeId`
- `checkedAt`
- `healthScore`
- `healthLevel`
- `priceVsZone`
- `structureStatus`
- `warningFlags` (JSON array)
- `recommendedAction`

Notes:

- Serves as timeline for health degradation/recovery.
- Enables “what should I do next?” guidance on active trades.

## SetupOutcome

Recommended fields:

- `setupId`
- `tradeId`
- `setupType`
- `setupTierAtEntry`
- `entryReason`
- `entryLocationVsZone`
- `healthLevelAtEntry`
- `healthLevelAtExit`
- `exitReason`
- `exitDiscipline`
- `rMultiple`
- `pnl`
- `outcome`
- `createdAt`

Notes:

- Written once on trade close.
- Snapshot/event table to support robust historical analysis even if upstream setup state evolves.

## SetupPerformanceAggregate

Recommended grouping keys:

- `setupType`
- `setupTier`
- `symbol` (optional dim; toggleable)
- `timeframe`

Recommended aggregate fields:

- `tradeCount`
- `winRate`
- `avgR`
- `medianR`
- `maxDrawdownR`
- `bestEntryReason`
- `worstEntryReason`
- `commonExitReasons` (JSON map)
- `updatedAt`

Notes:

- Keep aggregate model simple; do not prematurely build multidimensional OLAP complexity.

---

## 4) Enum Design (Dropdown-First)

## `entryReason`

- `ZONE_RETEST`
- `BREAKOUT_CONFIRM`
- `PULLBACK_ENTRY`
- `STRUCTURE_CONTINUATION`
- `MOMENTUM_CONFIRM`
- `READY_ON_OPEN`
- `READY_INTRADAY`
- `LATE_CHASE`

## `exitReason`

- `TAKE_PROFIT_HIT`
- `STOP_LOSS_HIT`
- `ZONE_INVALIDATED`
- `STRUCTURE_BROKEN`
- `HEALTH_DEGRADED_EOD`
- `TIME_STOP`
- `MANUAL_RULE_BASED_EXIT`

## `exitDiscipline`

- `FOLLOWED_PLAN`
- `EARLY_EXIT_RULE_BASED`
- `EMOTIONAL_EXIT`
- `RULE_VIOLATION`

## `entryLocationVsZone`

- `IN_ZONE`
- `ABOVE_ZONE`
- `BELOW_ZONE`

## `healthLevel`

- `HEALTHY`
- `WARNING`
- `AT_RISK`
- `DEAD`

---

## 5) UI/UX Proposal (Minimal Upgrade Path)

No new major page in initial rollout.

## Setup page

- Add CTA: **Create Trade from Setup**
- Show lightweight historical hint per setup pattern:
  - win rate
  - avg R
  - best/worst entry pattern tags

## Trades page

- Show linked setup chip (`setupType/setupTier/symbol/timeframe`)
- Show health badge + lifecycle status for active trades
- Keep list compact; no data dump

## Trade detail drawer/modal

Use a detail drawer (or existing detail pattern) for lifecycle view:

- setup snapshot
- entry context
- health timeline
- exit + outcome

Prefer drawer/inline detail over full new page for first versions.

## Later optional page

- `Analytics / Learning` only after sufficient sample size and stable event capture.

---

## 6) Close Trade Behavior (`closeTrade()`)

On close action:

1. Update `Trade`:
   - status -> `CLOSED`
   - exit fields (`exitPrice`, `exitAt`, `exitReason`, `exitDiscipline`)
   - computed fields (`rMultiple`, `pnl`, `outcome`)
2. Create `SetupOutcome` event record.
3. Recompute or queue recomputation for `SetupPerformanceAggregate`.
4. Preserve original setup/trade snapshots (no destructive mutation).
5. Keep operation idempotent-safe (prevent double-close writes).

Critical audit rule:

- Historical setup context written at entry/close is immutable.
- Never rewrite past context in ways that invalidate analysis.

---

## 7) Reporting / Learning Use Cases

Examples enabled by the model:

- Filter: `Tier A + ZONE_RETEST + IN_ZONE + HEALTHY` -> win rate / avg R
- Identify failures by `exitReason = STRUCTURE_BROKEN`
- Compare expectancy of A-tier vs B-tier
- Quantify performance of `LATE_CHASE` entries
- Rank setup patterns by `avgR` with sample size guardrails

Suggested guardrail:

- Always display `n` (sample size) beside performance metrics.

---

## 8) Implementation Plan (Safe Phases)

## Phase 1 - Schema + enums + `setupId` link

- Add enums and trade context fields.
- Add `setupId` relation with nullable policy.
- Add `SetupOutcome` and aggregate tables (or minimal placeholders).

## Phase 2 - Create Trade from Setup

- Add CTA on setup row.
- Pre-fill trade form from setup snapshot.
- Allow manual override where needed.

## Phase 3 - Close Trade outcome writeback

- Implement structured `closeTrade()` workflow.
- Write `SetupOutcome`.
- Trigger aggregate recomputation path.

## Phase 4 - Trade detail lifecycle view

- Add health timeline + action hints for active and closed trade inspection.

## Phase 5 - Basic setup performance aggregation

- Add compact metrics in Setup and Trades context surfaces.
- Keep to top insights, no full analytics dashboard.

## Phase 6 - Analytics/Learning page (later)

- Only after data quality + sample size threshold is reached.

---

## 9) Risks / Decisions Needed

Key decisions before implementation:

1. **Should `setupId` be nullable?**
   - Recommendation: yes, nullable to preserve manual-trade path.
2. **How are trade health logs generated?**
   - Options: manual checkpoints, daily EOD job, auto on key events.
3. **Aggregate recomputation strategy**
   - Sync in request vs background job/queue.
4. **Minimum sample size for learning recommendations**
   - Recommendation: hide/soften guidance below threshold (e.g., n < 10).
5. **Overfitting risk**
   - Avoid strong recommendations from short windows or sparse buckets.

---

## 10) Design DNA (Critical)

This system is a **decision-support engine**, not a passive tracker.

## Living trade concept

- Every active trade must show current health state.
- UI must always answer:
  1. Is this trade healthy?
  2. What should I do next?

## Visual encoding

- `HEALTHY` = green
- `WARNING` = yellow
- `AT_RISK` = orange
- `DEAD` = red

## Action orientation

- Each degraded health state maps to explicit suggested action.
- Prefer operational phrases (“reduce risk”, “wait for reclaim”, “exit per rule”).

## No data dump

Prioritize in order:

1. Current health (most prominent)
2. Entry quality
3. Risk / R status
4. Lifecycle timeline
5. Outcome

## Learning in context

Setup surfaces should display:

- win rate
- avg R
- best/worst entry patterns

## Friction minimization

- Use dropdown enums over long free text.
- Keep forms short.
- Keep interactions fast and decisive.

## Page sprawl control

- Prefer inline upgrades, detail drawers, badges, hints.
- Do not add new pages until necessary.

---

## Recommended File Path

- `docs/trading/setup-trade-learning-loop-review.md`

---

## Final Recommendation

**Implement with minor adjustment first**:

- Proceed with phased rollout, but explicitly keep `setupId` nullable and enforce snapshot immutability from day one.
- Start with Phase 1-3 (linking + close outcome writeback) before any broader analytics UI.
- Add recommendation guardrails (sample-size thresholds) before surfacing pattern “learning” to avoid overfitting and false confidence.

---

## MVP Implementation Boundary

This boundary is mandatory before coding to control scope and risk.

## Must-build now (Phase 1-3 only)

1. **Schema + enums + nullable setup link**
   - Add `setupId` on trade (nullable).
   - Add dropdown-first enums for entry/exit/outcome context.
   - Add immutable snapshot fields on trade entry.
   - Add `SetupOutcome` writeback table/event model.

2. **Create Trade from Setup flow**
   - Add lightweight CTA from setup row.
   - Pre-fill trade form from setup context.
   - Preserve manual trade path (no setup required).

3. **Close trade outcome writeback**
   - On close: update trade exit fields + compute outcome.
   - Upsert/create setup outcome event.
   - Keep operation idempotent-safe.
   - Do not mutate historical snapshots.

## Defer until later (do not build now)

- Full Analytics/Learning page.
- Complex aggregation UI and ranking dashboards.
- Automated recommendation engine beyond simple context hints.
- Advanced health-log automation orchestration.
- Cross-setup attribution and deep correlation analytics.

## Non-negotiable MVP constraints

- `setupId` remains nullable.
- Snapshots are immutable once trade is created.
- Dropdown enums are primary analytics inputs.
- UI upgrades stay minimal and aligned with Design DNA.

