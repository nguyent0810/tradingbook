# Tactical Universe / Hot Symbol Intake FRD

## 1. Functional objective

Introduce a tactical symbol intake layer that feeds high-priority user-supplied symbols into the existing scan pipeline while preserving all current tradability and Gate 2 rules.

This feature addresses intake/coverage latency, not strategy logic.

## 2. Proposed data model

## 2.1 New table: `tactical_symbols`

Suggested fields:

- `id` (pk)
- `symbol` (normalized uppercase, indexed)
- `source` (enum/string; e.g. `manual`, `ops`, `import`)
- `reasonNote` (optional text, short rationale)
- `activeForScanner` (boolean)
- `addedAt` (timestamp)
- `addedBy` (optional user id/audit actor)
- `expiresAt` (timestamp, required for MVP to enforce temporary behavior)
- `importedBarsAt` (timestamp, nullable)
- `lastEvaluatedAt` (timestamp, nullable)
- `status` (enum/string: `ACTIVE`, `EXPIRED`, `REMOVED`)

Constraints:

- unique active row per symbol (`symbol`, `status=ACTIVE`) or equivalent unique strategy.
- normalized symbol format (trim/uppercase) at write boundary.

## 2.2 Optional extension on `stock_symbols`

Do not overload `stock_symbols.active` semantics. Keep curation ownership intact. Tactical inclusion should be merged at runtime, not by mutating canonical curation state.

## 3. Intake flow

1. User manually adds symbol to tactical list.
2. System validates:
   - symbol format,
   - symbol exists in known listing source or can be created safely.
3. Create/activate `tactical_symbols` row with expiration.
4. Enqueue or trigger tactical bar fetch/import (throttled).
5. Mark `importedBarsAt` after successful import.
6. Symbol is included in next scan merge step if `activeForScanner=true` and not expired.
7. Update `lastEvaluatedAt` during scan.

Failure handling:

- symbol unresolved -> reject intake with explicit error.
- no bars fetched -> retain tactical row but flagged as coverage-blocked.
- repeated provider failures -> backoff and surface operator warning.

## 4. Scanner interaction contract

Universe composition for scan:

- `coreUniverse = stock_symbols where active=true`
- `tacticalUniverse = tactical_symbols where activeForScanner=true and now < expiresAt and status=ACTIVE`
- `effectiveUniverse = dedupe(coreUniverse U tacticalUniverse)`

Key rules:

- Tactical symbols do not bypass tradability checks.
- Tactical symbols do not bypass Gate 2 checks.
- Tactical symbols do not auto-create relaxed candidates.
- Diagnostics must include `universeSource` label: `CORE`, `TACTICAL`, or `BOTH`.

## 5. UI/UX requirements (minimal)

- Tactical badge on symbol rows where applicable.
- Filter toggle: `All | Core | Tactical`.
- Minimal tactical intake form:
  - symbol
  - source
  - optional note
  - expiration window
- No leaderboard, no hype ranking UI in MVP.
- Ensure tactical symbols are visually distinct from curated symbols.

## 6. Operational constraints

- Provider-safe fetch defaults:
  - batched requests,
  - conservative sleep (>= current safe value),
  - retry/backoff on failures.
- Batch size guardrails to avoid request bursts.
- Duplicate prevention across core+tactical merge.
- Stale tactical cleanup job (expire or deactivate automatically).
- No secret/materialized credentials in logs.

## 7. Metrics and logging

Capture at run and symbol level:

- tactical symbol count (active/expired/removed)
- tactical symbols with bars imported
- tactical tradability pass rate
- tactical Gate 2 outcomes (A/B/INVALID/NOT_EVALUATED)
- tactical setup candidates created (if any, under unchanged rules)
- common tactical blockers (no bars, stale bars, liquidity fail, trend fail, etc.)
- provider fetch/import failure counts for tactical jobs

Add structured logs:

- intake created/updated/expired
- fetch start/end (count, elapsed, failures)
- scan merge counts: core vs tactical vs overlap

## 8. Safeguards (required)

- Explicit expiration (`expiresAt`) mandatory.
- Max tactical count cap (configurable; small default).
- Explicit `source` required on intake.
- Audit trail (`addedBy`, `addedAt`, state changes).
- Manual remove/deactivate action.
- Clear diagnostics when symbol is not evaluated due to coverage/tradability.

## 9. Suggested MVP boundary

In scope:

- DB model + intake API/server action (manual only)
- tactical fetch/import hook
- scan universe merge + source labels in diagnostics
- minimal UI entry + badge/filter
- expiry cleanup + metrics

Out of scope:

- auto discovery/ranking of hot symbols
- strategy/rule tuning
- social/news ingestion
- algorithmic momentum lane

## 10. Acceptance criteria

- Tactical symbol can be added and appears in effective universe next run.
- Tactical symbol still obeys existing tradability + Gate 2 rules.
- Core curated universe remains unchanged by tactical operations.
- Tactical rows auto-expire and stop influencing scans after expiration.
- Scanner reliability and runtime stay within current operational envelope.

