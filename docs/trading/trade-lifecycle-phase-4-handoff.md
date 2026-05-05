# Trade Lifecycle Phase 4 Handoff

## Purpose

This handoff captures the completed Phase 4 trading lifecycle loop before introducing additional product scope.

Current lifecycle implemented:

`Setup -> Trade -> Health Checkpoint -> Outcome`

This document is for product, QA, and engineering alignment.

---

## 1) Current Completed Flow

Phase 4 currently supports:

- Setup page can create a trade from setup context (`Create Trade from Setup` flow).
- Trade model has nullable `setupId` (manual and setup-linked paths both supported).
- Manual trades remain fully supported.
- Active (`OPEN`) trades support manual health checkpoint capture.
- Trades list shows EOD checkpoint status:
  - `Needs EOD check`
  - `Checked today`
- Trade detail shows:
  - setup outcome writeback status
  - health timeline entries
- Closing a linked trade writes `SetupOutcome` (unique by `tradeId`).

---

## 2) User Workflow

Expected user path:

1. Find setup candidate on `Setups`.
2. Create trade from setup (or manually from Trades page).
3. During active trade, record EOD health checkpoint.
4. Review health timeline progression on trade detail.
5. Close trade with exit context.
6. Confirm setup-outcome writeback status on trade detail.

---

## 3) Data Integrity Rules

The system currently enforces these data rules:

- `setupSnapshot` is immutable once established for a trade.
- `setupId` is nullable to preserve manual trade path.
- `SetupOutcome` is unique by `tradeId` (idempotent writeback target).
- Closed trades cannot add manual checkpoints (checkpoint form is open-trade only).
- Manual trades do not write setup learning linkage (no setup-linked outcome semantics).

---

## 4) Manual QA Checklist

Run through this checklist in order:

1. Create a **manual** trade.
2. Create a **setup-linked** trade from Setups page.
3. Add health checkpoint to active trade.
4. Confirm health timeline updates after save/refresh.
5. Confirm Trades list EOD badge changes (`Needs EOD check` -> `Checked today`).
6. Close linked trade.
7. Confirm Setup Outcome card indicates writeback and shows outcome details.
8. Close manual trade.
9. Confirm manual trade detail states no setup learning link.

Pass condition: all steps succeed without missing status transitions or data mismatch.

---

## 5) Known Non-Goals (Intentionally Deferred)

Not included in Phase 4:

- No analytics/learning page.
- No automatic health engine.
- No background EOD checkpoint job.
- No AI recommendation layer.
- No advanced scoring/ranking extensions beyond current state.

---

## 6) Recommended Next Phase (Later)

After enough linked closed trades accumulate:

- Add **basic setup performance hints** in context (not full analytics).
- Use sample-size guardrail before surfacing confidence:
  - Example: suppress strong conclusions for small `n`.
- Keep guidance conservative and decision-support oriented.

---

## Handoff Summary

Phase 4 provides a production-usable, auditable loop:

- Setup selection
- Trade execution
- Manual health checkpointing
- Outcome writeback

without overbuilding analytics or automation prematurely.

