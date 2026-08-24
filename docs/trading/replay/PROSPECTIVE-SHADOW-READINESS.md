# Prospective shadow registry — implementation and readiness

**Date:** 2026-08-24 · Plan `1c5f198` (amended §14) · Closure record `d5c9702`

> **This document makes no claim about whether feasibility has predictive value.**
> It cannot: zero prospective observations exist, and the first eligible session is
> still in the future. Everything below concerns registry **safety and correctness**.

---

## §13 Deliverable

| item | value |
|---|---|
| closure decision record | **`d5c9702`** |
| frozen plan (+ §14 amendment) | **`1c5f198`** |
| implementation | *(this commit)* |
| prospective start boundary | **`PROSPECTIVE_START_EXCLUSIVE = 2026-08-24`**, eligible ⇔ session **>** 2026-08-24 |
| classifier | **13 blob SHAs**, the transitive closure of D2 · contracts · stop-feasibility · breakout-pullback; introducing commit `2c9b418` |
| schema version | **`prospective-registry@1.0.0`** |
| outcome definition version | **`outcomes@1.0.0`** |
| first eligible session | the first settled session after 2026-08-24 |
| observations recorded so far | **0** — the newest settled session is 2026-08-21, and the recorder refuses it |

## What was built

| file | role |
|---|---|
| `src/lib/prospective/registry-schema.ts` | frozen constants, row types, hashing, eligibility rule |
| `src/lib/prospective/registry-store.ts` | append-only store, hash chain, lock, integrity verifier |
| `src/lib/prospective/recorder.ts` | late-run guard, row construction, fail-open wrapper |
| `src/lib/prospective/outcomes.ts` | `outcomes@1.0.0`, pure, T+5 |
| `scripts/replay/record-prospective-session.ts` | standalone recorder for one settled session |
| `scripts/replay/append-prospective-outcomes.ts` | outcome appender; writes only the outcomes file |
| `scripts/replay/report-prospective-checkpoint.ts` | operational health always; performance only at a frozen checkpoint |
| `src/lib/prospective/prospective.test.ts` | 37 tests — the four safety proofs |

## The four safety proofs

### 1. Immutability

Enforced on three levels rather than asserted:

- **two files.** Decisions and outcomes are separate; the outcome path has no code
  that opens the decisions file for writing. No update, rewrite or delete path exists.
- **a hash chain.** Every row carries `seq` and `prevEntryHash`. A per-row hash alone
  cannot see a *deleted* or *reordered* row — each survivor still verifies against
  itself. The chain can, and the test deletes a middle row to prove it: 0 hash
  mismatches, chain broken.
- **the store seals rows.** `setupId`, `eligible`, `seq`, `prevEntryHash` and
  `entryHash` are computed by the store from the row's own fields. A caller that
  hands in `eligible: true` on a `NOT_FEASIBLE_LIQUIDITY` row gets `eligible: false`
  written, and a hand-edited file with a re-hashed forged row is caught by
  `forgedEligibility`.

Duplicate `setupId`, duplicate `(symbol, session)`, malformed lines and an
unterminated final line are all refusals, not silent behaviours.

### 2. Production isolation

- **Zero production call sites.** The test walks `src/`, `app/` and `scripts/` on the
  filesystem — not `git grep`, which skips untracked files and would have let a
  freshly-written importer through.
- The module imports **nothing but node builtins and itself**; it contains no Prisma
  client and no mutation verb; it exports no function that decides visibility,
  ordering or size.
- `git diff --stat 2c9b418 -- src/ ':!*test*' ':!src/lib/prospective'` is **empty**:
  no production source file has changed since the shadow pipeline landed.
- **Disclosed consequence** (plan §6): the registry is not wired into the scan job,
  so it must be scheduled, and a missed run is a missed observation. Reconstructing
  one later is forbidden — and the late-run guard makes it impossible anyway.

### 3. Look-ahead impossibility

- **The late-run guard.** The recorder refuses session `T` if any bar dated after `T`
  already exists in the database. A run late enough to have seen the outcome cannot
  produce a prospective observation.
- **Verified live.** Run today against production it returns
  `REFUSED (BEFORE_PROSPECTIVE_BOUNDARY): 2026-08-21 <= 2026-08-24`.
- Decision features are read from queries bounded at `T` and passed through
  `createPointInTimeGuard(..., { throwOnViolation: true })`.
- `computeOutcome` is pure, takes only post-decision bars, and **refuses** any bar
  dated at or before the session. This matters concretely: `date > new Date("2026-09-01")`
  in SQL is midnight UTC, so a same-session bar stored at 07:00Z would pass a naive
  filter. The refusal turns that from something the verifier notices after the write
  into something that is never written.
- The verifier independently re-checks `barDatesUsed` against each decision's session.

### 4. Failure safety

- `runRecorderSafely` converts any throw into a returned error.
- `appendDecision` / `appendOutcome` catch filesystem failures and return
  `WRITE_FAILED` — the write path itself no longer throws.
- A crash mid-append leaves a truncated line: the reader survives it, the intact
  rows stay readable, the verifier reports it, and further appends refuse rather
  than splicing a new record onto the partial one.
- Concurrent runs are refused, not raced: an `O_EXCL` lock file wraps the
  read-then-append sequence, and the second writer gets `REGISTRY_LOCKED`.

## What the adversarial review changed

An independent adversarial pass (Codex CLI, `read-only`) reported ten findings.
Nine were accepted and fixed before any observation existed; one is a limit that
code cannot remove, and is stated rather than papered over.

| # | finding | resolution |
|---|---|---|
| 1 | outcome horizon off by one — `fwd1` read the second session after T, MFE/MAE ran T+2..T+6 | **fixed.** T+1 is the entry bar; a test now pins `fwd1` to the entry bar's close |
| 2 | a same-session bar could become the entry bar via the UTC-midnight SQL bound | **fixed.** end-of-day bound *and* an outright refusal in `computeOutcome` |
| 3 | malformed complete lines silently dropped | **fixed.** reported, integrity fails, appends refuse |
| 4 | deletion / reordering of whole rows undetectable | **fixed.** `seq` + `prevEntryHash` chain |
| 5 | eligibility forgeable by writing a raw row | **fixed.** recomputed at the storage boundary and re-derived by the verifier |
| 6 | performance can be peeked outside the report script | **acknowledged, not fixed.** See below |
| 7 | the actual write path could still throw | **fixed.** `WRITE_FAILED` |
| 8 | concurrent runs could double-append | **fixed.** `O_EXCL` lock |
| 9 | the classifier pin missed transitive thresholds | **fixed.** 13-file closure + a test that recomputes it (plan §14) |
| 10 | the isolation test used `git grep`, which ignores untracked files | **fixed.** filesystem walk |

### The limit that stands

**Nothing in code can stop someone reading the NDJSON and computing the delta at
N = 7.** The registry is plain text on disk. The checkpoint gate is a *default*,
not a cage. What the preregistration protects is the **meaning** of a result: an
early look is not evidence, and reporting one would violate the frozen plan rather
than cleverly route around it. The report script now says exactly this instead of
implying enforcement it does not have.

## Known operational conditions, disclosed

1. **The recorder must be scheduled** after the end-of-day import and before the
   next session's bars arrive. That window is a day; missing it loses the
   observation permanently.
2. **A provisional intraday bar for T** would be recorded as if settled. Gate 2's own
   `stale_or_session_mismatch` check makes `lastInputBarDate` always equal the
   session for recorded rows, so the report's *stale input bars* counter should
   read 0 forever; a non-zero value means something upstream changed.
3. **History revisions.** Originally observed decision-time values are preserved and
   never recomputed on revised history (plan §7).
4. **Accrual is slow by construction.** ~60–90 eligible setups per year, so N = 100
   is roughly 1.2–1.7 years away. That was computed and disclosed at freeze time so
   it cannot be quietly renegotiated later.

## Verification

```
npx tsc --noEmit -p tsconfig.json     clean
npx eslint <all new files>            clean
npx vitest run                        159 files, 1301 tests, all passing
```

---

## Verdict

# `PROSPECTIVE SHADOW READY`

Concerning **registry safety and correctness only**. The mechanism records
decisions before their outcomes exist, refuses to do so when it cannot prove that
ordering, cannot alter what it has written, and cannot affect production.

It says nothing whatever about whether `FEASIBLE` beats `NOT_FEASIBLE_NOISE`. That
question now has exactly one admissible source of evidence — observations this
registry has not yet collected — and the first one cannot be recorded before
2026-08-25.
