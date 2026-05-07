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

## 11. Implementation readiness checklist

This section is pre-implementation planning only (no code changes).

### 11.1 Migration order

- [ ] Create `tactical_symbols` table first (no runtime dependencies yet).
- [ ] Add required indexes:
  - [ ] `symbol`
  - [ ] `status`
  - [ ] `activeForScanner`
  - [ ] `expiresAt`
  - [ ] composite index supporting active tactical scan query.
- [ ] Enforce expiration semantics in schema/API contract:
  - [ ] `expiresAt` required for ACTIVE tactical rows.
  - [ ] status transition path (`ACTIVE -> EXPIRED/REMOVED`) defined.
- [ ] Backward-safe deployment:
  - [ ] migration deploy before app reads/writes tactical rows.
  - [ ] no scanner behavior change until runtime merge flag is enabled.

### 11.2 Runtime ownership

- [ ] **Fetch/import trigger owner** decided:
  - [ ] manual trigger from intake action,
  - [ ] scheduled worker/cron follow-up,
  - [ ] or hybrid (manual immediate + cron reconciliation).
- [ ] **Cron vs manual responsibility** documented:
  - [ ] cron handles routine scan cadence,
  - [ ] manual action handles urgent tactical intake/update.
- [ ] **Universe merge owner** defined in scanner runtime:
  - [ ] one module computes effective universe (`core U tactical`).
- [ ] **Cleanup owner** defined:
  - [ ] periodic job marks expired tactical rows,
  - [ ] optional stale tactical bar refresh ownership.

### 11.3 Tactical fetch strategy

- [ ] Priority ordering policy set (deterministic):
  - [ ] newest intake first, or
  - [ ] earliest expiry first, or
  - [ ] explicit user priority field.
- [ ] Batch limits configured (MVP conservative default).
- [ ] Provider throttling defaults set:
  - [ ] sleep interval >= current safe baseline,
  - [ ] max symbols per fetch batch.
- [ ] Retry/backoff policy defined:
  - [ ] bounded retries,
  - [ ] exponential backoff,
  - [ ] circuit/cooldown after repeated provider failures.
- [ ] Tactical-first behavior clarified:
  - [ ] tactical symbols fetch before non-urgent universe refresh jobs.

### 11.4 Universe merge safeguards

- [ ] Dedupe order fixed and tested (symbol normalization before merge).
- [ ] Overlap handling explicit:
  - [ ] symbol in both core+tactical is evaluated once,
  - [ ] source label persisted as `BOTH`.
- [ ] Tactical expiry handling explicit:
  - [ ] expired tactical symbols excluded before scan starts.
- [ ] Stale tactical symbol handling defined:
  - [ ] stale/no-latest tactical remains labeled and blocked by tradability,
  - [ ] does not silently bypass freshness gates.

### 11.5 Operational guardrails

- [ ] Max tactical symbol count cap configured (hard limit).
- [ ] Max intake rate configured (per user/day or per system window).
- [ ] Optional cooldown defined for repeated failed intakes.
- [ ] Failure isolation confirmed:
  - [ ] tactical fetch/import failures do not break core scan run,
  - [ ] scanner still persists run with tactical failure diagnostics.

### 11.6 UI rollout order

- [ ] Backend data model + APIs first.
- [ ] Diagnostics source labels (`CORE`, `TACTICAL`, `BOTH`) next.
- [ ] Filter controls (`All/Core/Tactical`) after labels.
- [ ] Badges in list/detail views after filters.
- [ ] Intake UI last (once backend guardrails/observability are stable).

### 11.7 Suggested MVP implementation sequence

Recommended smallest safe vertical slices:

1. **Schema + read path only**
   - add `tactical_symbols` table + indexes + expiry fields,
   - add read query for active tactical rows,
   - no scanner merge yet.
2. **Scanner merge (read-only tactical integration)**
   - effective universe merge with dedupe + source labeling,
   - keep intake disabled; seed with controlled test rows only.
3. **Fetch/import integration**
   - tactical-priority batched fetch/import with throttling + retries,
   - persist `importedBarsAt` and failure diagnostics.
4. **Expiration + cleanup job**
   - automatic ACTIVE -> EXPIRED transition,
   - enforce exclusion of expired rows at merge time.
5. **Minimal diagnostics surfacing**
   - show tactical source labels and blocked reasons.
6. **Manual intake UI/API**
   - enable user add/remove with max count/rate guardrails.
7. **Hardening**
   - metrics, alerting, and runbook updates before broader usage.

