# Backend P0 — `trade_health_logs` Prisma Model + Exit Health Integrity

**Status:** P0A ✅ · P0B ✅ · P0C ✅ · P0D ✅ — P0E not started  
**Date:** 2026-05-25 (P0D section added after P0C deploy `c72a664`)  
**Sources:** `06-backend-gaps.md`, `02-api-contract.md`, `03-data-model-and-persistence.md`, `05-integration-mismatches.md`  
**Scope:** Promote `trade_health_logs` to Prisma; replace raw SQL where low-risk; fix `SetupOutcome.healthLevelAtExit`.  
**Out of scope:** Frontend/UI changes, REST APIs, `/trades/page.tsx` refactor, auth changes, destructive migrations.

---

## 1. Current State Trace

| Area | File | Current behavior | Risk |
|------|------|------------------|------|
| Table definition | `prisma/migrations/20260506120000_trade_health_logs/migration.sql` | Creates `trade_health_logs` (UUID PK, FK → `trades`) | Table exists in prod; not in Prisma schema |
| JSON column | `prisma/migrations/20260511103000_trade_health_review_checklist/migration.sql` | Adds nullable `review_checklist JSONB` | Must map as `Json?` in Prisma |
| Prisma schema | `prisma/schema.prisma` | **No** `TradeHealthLog` model; `Trade` has no `healthLogs` relation | Client cannot type-check health queries |
| Checkpoint write | `src/app/actions/trades.ts` → `addTradeHealthCheckpoint` | **P0C done** — `tradeHealthLog.create` via `buildTradeHealthLogCreateData` | — |
| Outcome write | `src/app/actions/trades.ts` → `writeSetupOutcomeFromTrade` | **P0D done** — `resolveHealthLevelAtExitForTrade` for `healthLevelAtExit` | — |
| Outcome trigger | `createTrade` / `updateTrade` | Calls `writeSetupOutcomeFromTrade` when `status === "CLOSED"` | Same bug on create-closed and update-closed |
| Trades ledger reads | `src/app/(dashboard)/trades/page.tsx` | 3× `$queryRaw`: today checkpoints, `DISTINCT ON` latest log, weekly JSON agg | Silent catch → empty Maps; no schema drift protection |
| Trade detail reads | `src/app/(dashboard)/trades/[id]/page.tsx` | **P0B done** — `loadTradeHealthLogsForDetailPage` (`tradeHealthLog.findMany`); silent catch → empty history | Low — reads typed; writes still raw SQL until P0C |
| Payload parsing | `src/lib/trades/review-outcome.ts`, `trade-health-review-checklist.ts` | `parseHealthReviewLogPayload` on `review_checklist` | Unchanged by P0 if column shape preserved |
| Consumer types | `src/lib/trades/open-position-intelligence.ts` | `LatestTradeHealthLog` uses `healthLevel: string` | May narrow to `SetupHealthLevel` after reads typed |
| Tests | `**/*.test.ts` | **No** tests for health logs or `writeSetupOutcomeFromTrade` | P0 must add targeted tests |

**Evidence (exit health bug):**

```155:167:src/app/actions/trades.ts
      healthLevelAtExit: trade.healthLevelAtEntry,
    },
    update: {
      ...
      healthLevelAtExit: trade.healthLevelAtEntry,
```

---

## 2. Existing Table Shape (SQL → Prisma)

From migrations `20260506120000` + `20260511103000`:

| SQL column | SQL type | Nullable? | Proposed Prisma field | Notes |
|------------|----------|-----------|----------------------|-------|
| `id` | `UUID` `DEFAULT gen_random_uuid()` | NO | `id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` | Do not switch to `cuid()` — would break existing rows |
| `trade_id` | `TEXT` | NO | `tradeId String @map("trade_id")` | FK to `trades.id` (cuid) |
| `checked_at` | `TIMESTAMP(3)` `DEFAULT CURRENT_TIMESTAMP` | NO | `checkedAt DateTime @default(now()) @map("checked_at")` | Inserts use `NOW()` today — Prisma `create` should set explicitly or rely on DB default |
| `health_level` | `TEXT` | NO | `healthLevel SetupHealthLevel @map("health_level")` | DB stores text; enum values match `SetupHealthLevel` + server validation Set |
| `health_score` | `INTEGER` | YES | `healthScore Int? @map("health_score")` | 0–100 validated in action |
| `price_vs_zone` | `TEXT` | YES | `priceVsZone String? @map("price_vs_zone")` | Free-text trader input |
| `structure_status` | `TEXT` | YES | `structureStatus String? @map("structure_status")` | Free-text |
| `recommended_action` | `TEXT` | YES | `recommended_action` → `recommendedAction String? @map("recommended_action")` | Free-text |
| `review_checklist` | `JSONB` | YES | `reviewChecklist Json? @map("review_checklist")` | Same JSON shape as today |

**Indexes (must appear in Prisma):**

| Index | Prisma |
|-------|--------|
| `trade_health_logs_pkey` on `id` | `@id` |
| `trade_health_logs_trade_id_checked_at_idx` on `(trade_id, checked_at)` | `@@index([tradeId, checkedAt])` |

**FK:** `trade_id` → `trades(id)` ON DELETE CASCADE — `Trade.healthLogs TradeHealthLog[]`, `TradeHealthLog.trade Trade @relation(...)`.

---

## 3. Proposed Prisma Model (draft — not applied)

```prisma
model TradeHealthLog {
  id                String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tradeId           String            @map("trade_id")
  trade             Trade             @relation(fields: [tradeId], references: [id], onDelete: Cascade)
  checkedAt         DateTime          @default(now()) @map("checked_at")
  healthLevel       SetupHealthLevel  @map("health_level")
  healthScore       Int?              @map("health_score")
  priceVsZone       String?           @map("price_vs_zone")
  structureStatus   String?           @map("structure_status")
  recommendedAction String?           @map("recommended_action")
  reviewChecklist   Json?             @map("review_checklist")

  @@index([tradeId, checkedAt])
  @@map("trade_health_logs")
}
```

**Add to `Trade` model:**

```prisma
healthLogs TradeHealthLog[]
```

### Relation decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PK type | UUID (DB-generated) | Matches existing table; never migrate to cuid |
| Relation | `Trade` 1 — N `TradeHealthLog` | Matches FK; cascade delete already in SQL |
| `checkedAt` vs `createdAt` | Keep `checkedAt` only | SQL has no separate `created_at`; renaming would confuse UI copy |
| JSON | `Json?` for `reviewChecklist` | Same as `Trade.setupSnapshot` pattern |
| `healthLevel` enum | `SetupHealthLevel` | Reuse existing enum; invalid legacy TEXT values **INFERRED** rare — handle in read parsers |
| `@@map` / `@map` | Required on model + snake_case columns | Table/columns already snake_case in Postgres |
| Append-only | No `updatedAt` | Table has no update column; checkpoints are immutable events |

### Open question (NEEDS_BACKEND_CONFIRMATION)

If historical rows contain `health_level` values outside `SetupHealthLevel`, Prisma reads will throw. Pre-migration audit:

```sql
SELECT DISTINCT health_level FROM trade_health_logs;
```

If outliers exist, use `healthLevel String @map("health_level")` in P0A and enum coercion in application layer only.

---

## 4. Migration Safety Plan

### Objective

Add Prisma model **without** `CREATE TABLE`, `DROP`, or column type changes.

### Recommended approach

1. **Hand-add** `TradeHealthLog` + `Trade.healthLogs` to `prisma/schema.prisma` (section 3).
2. Run `npx prisma migrate dev --name trade_health_log_prisma_model --create-only`.
3. Inspect generated SQL:
   - **Acceptable:** empty migration or comment-only (`-- Already applied`).
   - **Reject:** any `CREATE TABLE`, `DROP`, `ALTER TYPE`, `ALTER COLUMN` on `trade_health_logs`.
4. If SQL is non-empty and unsafe, replace migration body with no-op comment referencing existing migrations `20260506120000` and `20260511103000`.
5. Run `npx prisma migrate deploy` on staging with `DIRECT_URL` (see `prisma.config.ts` — Neon pooler breaks migrations).
6. Run `npx prisma generate` → client at `src/generated/prisma`.

### Compatibility checklist

| Check | Action |
|-------|--------|
| Table name | `@@map("trade_health_logs")` |
| Column names | `@map("...")` per section 2 |
| Index | `@@index([tradeId, checkedAt])` matches existing |
| FK | Relation mirrors `ON DELETE CASCADE` |
| Data loss | **No** destructive statements |
| Rollback | Revert schema + migration commit; drop migration folder if empty; regenerate client without model — table data untouched |

### Rollback plan

1. Revert Git commits for P0A schema/migration.
2. `prisma migrate deploy` does not run destructive SQL if migration was no-op.
3. Redeploy app still using raw SQL paths (P0B–D reverted) — functional parity with pre-P0.

### What P0 does **not** do

- Convert `health_level` TEXT → Postgres ENUM type (would rewrite table).
- Add new columns (unless product requests — out of P0).
- Change `checked_at` semantics (server local day vs UTC stays as-is per `05-integration-mismatches.md` §8).

---

## 5. Raw SQL Replacement Plan

| File | Query purpose | Replace now? | Replacement approach | Risk |
|------|---------------|--------------|----------------------|------|
| `src/app/actions/trades.ts` | INSERT checkpoint | **P0C ✅** | `prisma.tradeHealthLog.create` + `buildTradeHealthLogCreateData` | Done |
| `src/app/(dashboard)/trades/[id]/page.tsx` | Last 20 logs for one trade | **P0B** | `findMany({ where: { tradeId }, orderBy: { checkedAt: 'desc' }, take: 20 })` | **Low** — isolated block; can move to `src/lib/trades/trade-health-logs.ts` helper |
| `src/app/(dashboard)/trades/page.tsx` | DISTINCT trade_ids checked today | **Defer** | Helper `findTradeIdsWithCheckpointBetween(tradeIds, dayStart, dayEnd)` | Medium — date boundary logic must match exactly |
| `src/app/(dashboard)/trades/page.tsx` | `DISTINCT ON` latest log per trade | **Defer** | `findMany` + in-app dedupe **or** `$queryRaw` kept until Prisma supports DISTINCT ON via extension | **High** — DISTINCT ON is why raw SQL exists; replacement must be behavior-identical |
| `src/app/(dashboard)/trades/page.tsx` | Weekly BOOL_OR on JSON keys | **Defer** | Keep raw SQL in P0 or use `$queryRaw` typed + Prisma.sql | **High** — JSON aggregation; test-heavy |
| `src/lib/trades/unrealized-from-close.ts` etc. | No health log SQL | N/A | — | — |

**P0B “low-risk” definition:** Single-trade reads and simple filters — no `DISTINCT ON`, no weekly aggregation.

**Recommended helper module (P0B+):** `src/lib/trades/trade-health-logs.ts`

- `listHealthLogsForTrade(tradeId, limit)`
- `findLatestHealthLogByTradeId(tradeId)` — for exit health + detail page
- `findTradeIdsReviewedBetween(tradeIds, start, end)` — parity with today query
- Keeps SQL shape out of page files **without** refactoring page layout (import helper only).

### Silent catch policy (planning note — implementation optional in P0)

`05-integration-mismatches.md` recommends failing loudly. **P0 backend** can:

- Log and rethrow in helpers, **or**
- Return `Result` type with error string for pages to pass to existing `ErrorStateWithEvidence` (UI change minimal if callers already have error banners).

**NEEDS_BACKEND_CONFIRMATION:** Whether P0 includes changing catch blocks on `[id]/page.tsx` or only trades list — user forbade frontend refactor; prefer **helper throws** + existing try/catch until UI slice approves loud failure.

---

## 6. Exit Health Fix Plan (summary)

**Superseded by § P0D Exit Health Fix Plan** — rules and tests are locked there. Key point: `healthLevelAtExit` must come from `TradeHealthLog` resolution, never `healthLevelAtEntry`.

---

## 7. Test Plan

| # | Test | Type | Notes |
|---|------|------|-------|
| 1 | `prisma generate` + TypeScript build | CI | After P0A |
| 2 | `prisma migrate deploy` on clean DB with prior migrations | Integration | Table pre-exists; new migration no-op |
| 3 | Read existing rows via `tradeHealthLog.findMany` | Integration | Seed from SQL fixture or test DB |
| 4 | `addTradeHealthCheckpoint` creates row | Integration | Compare fields to raw INSERT |
| 5 | Trade detail: history count/order | Integration | Helper matches 20-desc order |
| 6 | Trades list: “reviewed today” set | Integration | Only after DISTINCT ON query ported |
| 7 | `writeSetupOutcomeFromTrade` exit health | Unit/integration | P0D — core bug fix |
| 8 | Invalid `healthLevel` rejected | Unit | Action validation unchanged |
| 9 | Cascade delete | Integration | Deleting `Trade` removes logs (FK) |

**Test location proposal:**

- `src/lib/trades/trade-health-logs.test.ts` — helpers
- `src/app/actions/trades.exit-health.test.ts` — `writeSetupOutcomeFromTrade` (may need prisma test harness or mock)

**No tests today** — grep found zero matches for `healthLevelAtExit` / `trade_health_logs` in `*.test.ts`.

---

## 8. Implementation Slices

### P0A — Prisma model only

| Field | Value |
|-------|--------|
| **Files** | `prisma/schema.prisma`, optional empty migration `prisma/migrations/..._trade_health_log_prisma_model/` |
| **Risk** | Low if migration SQL reviewed |
| **Validation** | `prisma migrate deploy`, `prisma generate`, `npm run build` |
| **Stop if** | Generated SQL touches existing table structure |

**No query replacement. No action changes.**

---

### P0B — Typed read path (low-risk)

| Field | Value |
|-------|--------|
| **Files** | `src/lib/trades/trade-health-logs.ts` (new), `src/app/(dashboard)/trades/[id]/page.tsx` (import helper only — **not** a layout refactor) |
| **Risk** | Low for detail page |
| **Validation** | Manual/automated: open trade detail shows same history; build passes |
| **Stop if** | Row shape or parse mismatch for `review_checklist` |

**Explicitly defer** `trades/page.tsx` batch queries to P0B2 or P0E follow-up.

---

### P0C — Typed write path

| Field | Value |
|-------|--------|
| **Files** | `src/app/actions/trades.ts` (`addTradeHealthCheckpoint` only); optional `src/lib/trades/trade-health-logs.ts` helper for testability |
| **Risk** | Medium — production checkpoint path |
| **Validation** | See **§ P0C Typed Write Path Plan** below |
| **Stop if** | JSON/null handling differs from `$executeRawUnsafe`; enum write fails against TEXT `health_level` |

**Implemented** — deploy `dcfd6c4` / `c72a664`.

---

## P0C Typed Write Path Plan

**Scope:** Replace only the `$executeRawUnsafe` INSERT inside `addTradeHealthCheckpoint`. No UI, no `[id]/page.tsx`, no `trades/page.tsx`, no `writeSetupOutcomeFromTrade`, no schema/migrations.

### Pre-implementation audit — `health_level` DISTINCT

Run on staging/production before coding P0C:

```sql
SELECT DISTINCT health_level FROM trade_health_logs ORDER BY health_level;
```

| Environment | Date | Result |
|-------------|------|--------|
| Production (Neon, `.env.prod.local`) | 2026-05-25 (pre-P0C) | Empty table |
| Production (post-P0C smoke) | 2026-05-25 | **`HEALTHY` only** — safe for enum read/write |
| Local dev (`.env` → localhost) | — | Not run (P1001) |

**Implication:** No outlier `health_level` values in production yet. Enum write is **likely safe** (validated set matches `SetupHealthLevel`). **Re-run audit after first real checkpoint** and before P0D if historical TEXT rows appear.

**P0B evidence:** `tradeHealthLog.findMany` on production succeeded (read path); enum column mapping did not break reads on empty table.

---

### 1. Current Write Trace

| File | Current write | Validation | Redirect / revalidate | Risk |
|------|---------------|------------|------------------------|------|
| `src/app/actions/trades.ts` → `addTradeHealthCheckpoint` (≈487–543) | `$executeRawUnsafe` INSERT into `trade_health_logs` with `NOW()` for `checked_at`; parameterized `$1`–`$7::jsonb` | See validation table below | Success: `revalidatePath(\`/trades/${id}\`)`, `revalidatePath("/trades")`, `redirect(\`/trades/${id}\`)` | **Medium** — production write path |
| Same | No `try/catch` around INSERT | — | DB error → unhandled exception (Next error surface); same as today | No silent swallow on write |
| Same | Trade gate | `requireUser()`; trade must exist for user | Not found → `redirect("/trades")` | Auth unchanged |
| Same | Status gate | `trade.status === "OPEN"` required to reach INSERT | Non-OPEN → `revalidatePath` detail + `redirect` detail **without** insert | Preserves “no checkpoint on closed” |
| Same | `healthLevel` | `Set(["HEALTHY","WARNING","AT_RISK","DEAD"])` on trimmed form string | Invalid → revalidate detail + redirect detail **without** insert | Must keep pre-DB rejection |
| Same | `healthScore` | Optional; if non-empty, `Number` finite and `0–100` → `Math.round`; else `null` | Invalid numeric → treated as `null` (not rejected) | Preserve lenient parse |
| Same | `priceVsZone`, `structureStatus`, `recommendedAction` | `nullIfBlank` (trim; empty → `null`) | — | Free text unchanged |
| Same | `review_checklist` | `serializeTradeHealthReviewPayloadForDb(reviewChecklistFromFormData(...), reviewOutcomeFromFormData(...))` → `string \| null` | Empty checklist + no outcome → SQL `NULL`; else JSON string cast `::jsonb` | **Highest parity risk** — Prisma `Json?` needs object/null not string |
| `src/lib/trades/trade-health-review-checklist.ts` | Form → booleans | Checkbox presence `"on"` | — | Unchanged |
| `src/lib/trades/review-outcome.ts` | Merge checklist + outcome JSON | `reviewOutcome` whitelist via `REVIEW_OUTCOME_IDS` | — | Unchanged |

**Current INSERT (reference):**

```527:538:src/app/actions/trades.ts
  await prisma.$executeRawUnsafe(
    `INSERT INTO trade_health_logs
      (trade_id, checked_at, health_level, health_score, price_vs_zone, structure_status, recommended_action, review_checklist)
     VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7::jsonb)`,
    trade.id,
    healthLevelRaw,
    healthScore,
    priceVsZone,
    structureStatus,
    recommendedAction,
    reviewPayloadJson
  );
```

**Columns written vs omitted:**

| Column | INSERT behavior |
|--------|-----------------|
| `id` | Omitted — DB `gen_random_uuid()` |
| `trade_id` | `$1` = `trade.id` |
| `checked_at` | `NOW()` (DB server clock) |
| `health_level` | `$2` = validated TEXT string |
| `health_score` | `$3` nullable |
| `price_vs_zone`, `structure_status`, `recommended_action` | `$4`–`$6` nullable |
| `review_checklist` | `$7::jsonb` or NULL |

---

### 2. Proposed Prisma Write (draft — do not implement until approved)

Replace the `$executeRawUnsafe` block with a single `prisma.tradeHealthLog.create`. Keep all validation and redirect/revalidate **above** the create unchanged.

```typescript
import { SetupHealthLevel, type Prisma } from "@/generated/prisma/client";

// After validation (healthLevelRaw is in allowedLevels):
const healthLevel = healthLevelRaw as SetupHealthLevel;

const reviewChecklist: Prisma.InputJsonValue | null =
  reviewPayloadJson != null
    ? (JSON.parse(reviewPayloadJson) as Prisma.InputJsonValue)
    : null;

await prisma.tradeHealthLog.create({
  data: {
    tradeId: trade.id,
    // Omit id — @default(dbgenerated("gen_random_uuid()")) on DB
    // Omit checkedAt — @default(now()) on model; see parity note below
    healthLevel,
    healthScore,
    priceVsZone,
    structureStatus,
    recommendedAction,
    reviewChecklist,
  },
});
```

**Prisma model mapping (P0A — already deployed):**

| Prisma field | DB column | Write note |
|--------------|-----------|------------|
| `id` | `id` UUID | Omit on create |
| `tradeId` | `trade_id` | Required |
| `checkedAt` | `checked_at` | Omit → `@default(now())` |
| `healthLevel` | `health_level` TEXT | `SetupHealthLevel` enum in client |
| `healthScore` | `health_score` | `Int?` |
| `priceVsZone` | `price_vs_zone` | `String?` |
| `structureStatus` | `structure_status` | `String?` |
| `recommendedAction` | `recommended_action` | `String?` |
| `reviewChecklist` | `review_checklist` JSONB | `Json?` — **object or `null`**, not JSON string |

**Enum vs TEXT column:** Schema uses `SetupHealthLevel` without `@db.Text` (native PG enum exists elsewhere; this column remains TEXT). P0B reads succeeded on production. Writes should emit string enum values (`HEALTHY`, etc.) compatible with TEXT — **verify in P0C integration smoke**; if Prisma errors, stop and report (do not alter schema in P0C).

**`checkedAt` parity:** Raw SQL uses `NOW()`. Omitting `checkedAt` uses Prisma `@default(now())` (may be client-generated timestamp vs DB `NOW()`). Acceptable if within seconds; **test** that omitting field matches DB default or set `checkedAt: new Date()` explicitly if audit requires closer parity.

---

### 3. Behavior Parity Checklist

| Behavior | Preserve? | P0C approach |
|----------|-------------|--------------|
| UUID generated by DB | Yes | Omit `id` in `create` |
| `trade_id` = open trade id | Yes | `tradeId: trade.id` |
| `checked_at` ≈ insert time | Yes | Omit `checkedAt` or explicit `new Date()` — verify in test |
| `health_level` = validated form value | Yes | Cast `healthLevelRaw as SetupHealthLevel` after Set check |
| Optional `health_score` 0–100 or null | Yes | Same `healthScore` variable |
| Optional text fields null when blank | Yes | Same `nullIfBlank` results |
| `review_checklist` null when empty payload | Yes | `reviewChecklist: null` when `reviewPayloadJson === null` |
| JSON shape `{ stopReviewed?, …, reviewOutcome? }` | Yes | Parse serialized string to `InputJsonValue` (same object as `::jsonb`) |
| Invalid `healthLevel` → no row | Yes | Keep early redirect before `create` |
| Non-OPEN trade → no row | Yes | Keep status gate before `create` |
| Success redirect to `/trades/[id]` | Yes | Unchanged |
| `revalidatePath` detail + `/trades` | Yes | Unchanged |
| Write failure → surfaces error | Yes | No new try/catch (match current) |
| `/trades/page.tsx` batch reads | N/A | Still raw SQL — list may not show new checkpoint until P0E |
| Detail page shows new row | Yes | P0B `loadTradeHealthLogsForDetailPage` after redirect |

---

### 4. Test Plan (P0C)

| # | Check | Type | Pass criteria |
|---|-------|------|---------------|
| 1 | Valid checkpoint insert | Manual / integration | OPEN trade → submit form → row in `trade_health_logs`; `health_level` correct |
| 2 | Null optional fields | Unit / integration | No score/text/checklist → DB NULLs for nullable columns |
| 3 | Review checklist + outcome JSON | Unit (existing) + integration | `serializeTradeHealthReviewPayloadForDb` round-trip; after insert, `parseHealthReviewLogPayload` via P0B helper matches |
| 4 | Invalid `healthLevel` | Unit | `"bogus"` → no `create` call (mock prisma) or no new row |
| 5 | Non-OPEN trade | Manual | CLOSED trade → redirect, no new row |
| 6 | P0B read after write | Manual | Detail timeline shows new checkpoint; `hasCheckpointToday` true when same local day |
| 7 | Production enum write | Smoke (post-deploy) | One checkpoint on staging/prod OPEN trade; no Prisma enum/TEXT error |
| 8 | DISTINCT audit after first row | SQL | Only `HEALTHY` \| `WARNING` \| `AT_RISK` \| `DEAD` |
| 9 | CI | `npm run lint`, `npm test`, `npm run build` | All pass |

**Proposed test files (minimal):**

| File | Purpose |
|------|---------|
| `src/app/actions/trades.health-checkpoint.test.ts` (new) | Mock `prisma.tradeHealthLog.create`; assert data shape for valid/invalid level |
| Reuse `review-outcome.test.ts` | JSON payload unchanged |

**Out of scope for P0C tests:** `trades/page.tsx` DISTINCT ON / weekly agg; `writeSetupOutcomeFromTrade`.

---

### 5. Implementation Slice (smallest safe diff)

| File | Change | Risk | Validation |
|------|--------|------|------------|
| `src/app/actions/trades.ts` | Replace `$executeRawUnsafe` INSERT with `tradeHealthLog.create`; add `SetupHealthLevel` + `Prisma` imports; map `reviewPayloadJson` → `InputJsonValue \| null` | **Medium** | Manual checkpoint + build |
| `src/lib/trades/trade-health-logs.ts` (optional) | Extract `buildTradeHealthLogCreateData(...)` for unit tests | Low | Optional — only if action test needs pure mapper |
| `src/app/actions/trades.health-checkpoint.test.ts` (optional) | Mapper / mock create tests | Low | `npm test` |

**Do not touch:** `[id]/page.tsx`, `trades/page.tsx`, `writeSetupOutcomeFromTrade`, `prisma/schema.prisma`, UI components, migrations.

**Suggested commit message (when approved):** `refactor(db): write trade health checkpoints through Prisma`

---

### P0C approval question (before coding)

> **Approve P0C implementation** — replace `addTradeHealthCheckpoint` INSERT with `prisma.tradeHealthLog.create` only, with parity checklist above and post-deploy checkpoint smoke on OPEN trade?

Confirm also:

- **`checkedAt`:** omit field (Prisma/DB default) vs explicit `new Date()` — default recommendation: **omit** unless test shows drift.
- **`reviewChecklist`:** parse JSON string to `Prisma.InputJsonValue` (required for parity with `::jsonb`).
- **No helper extraction** unless tests need it (Y/N).

---

## P0D Exit Health Fix Plan

**Scope:** Fix `SetupOutcome.healthLevelAtExit` in `writeSetupOutcomeFromTrade` only. No UI, no `[id]/page.tsx`, no `trades/page.tsx`, no checkpoint write changes, no schema/migrations, no P0E.

### Approved resolution rules (locked for implementation)

1. If trade has `exitDate`, use the **latest** `TradeHealthLog` where `checkedAt <= exitDate` **end-of local calendar day** (`23:59:59.999` on that date, same pattern as `loadTradeHealthLogsForDetailPage` / `hasCheckpointToday`).
2. If no checkpoint on/before that bound → `healthLevelAtExit: null`.
3. If trade has **no** `exitDate`, use global latest checkpoint by `checkedAt DESC`.
4. **Never** copy `healthLevelAtEntry` as fallback.

---

### 1. Current Exit Health Trace

| File | Current behavior | Problem | User / data impact |
|------|------------------|---------|-------------------|
| `src/app/actions/trades.ts` → `writeSetupOutcomeFromTrade` (≈137–176) | Loads trade + `setupCandidate`; no-op unless `setupId`, candidate, `status === "CLOSED"` | Ignores `trade_health_logs` entirely | Setup learning stats use wrong exit health |
| Same — `create` branch | `healthLevelAtExit: trade.healthLevelAtEntry` (line 156) | Exit health = entry snapshot | Closed-trade outcome rows misstate deterioration/improvement at exit |
| Same — `update` branch | `healthLevelAtExit: trade.healthLevelAtEntry` (line 168) | Re-upsert on re-close/update repeats bug | Updating a closed trade overwrites outcome with same wrong value |
| Same — other fields | `healthLevelAtEntry`, PnL, R, exit reason/discipline from trade | Entry fields correct | Entry vs exit conflation in analytics only |
| `src/app/actions/trades.ts` → `createTrade` (≈311–312) | After insert, if `data.status === "CLOSED"` → `writeSetupOutcomeFromTrade(created.id)` | Triggers bug on create-as-closed | One-shot closed trades get wrong exit health |
| `src/app/actions/trades.ts` → `updateTrade` (≈457–458) | After update, if `data.status === "CLOSED"` → `writeSetupOutcomeFromTrade(tradeId)` | Triggers bug on close transition | Primary user close path |
| `prisma/schema.prisma` → `SetupOutcome` | `healthLevelAtExit SetupHealthLevel?` | Schema allows fix | No migration required |
| `src/lib/trades/trade-health-logs.ts` | P0B read + P0C write helpers | No exit-resolution helper yet | P0D adds query helper only |
| `**/*.test.ts` | **Zero** tests for `writeSetupOutcomeFromTrade` / `healthLevelAtExit` | No regression guard | P0D must add tests |

**Evidence (bug):**

```155:168:src/app/actions/trades.ts
      healthLevelAtEntry: trade.healthLevelAtEntry,
      healthLevelAtExit: trade.healthLevelAtEntry,
    },
    update: {
      ...
      healthLevelAtEntry: trade.healthLevelAtEntry,
      healthLevelAtExit: trade.healthLevelAtEntry,
```

---

### 2. Proposed Exit Health Resolution

Add **`resolveHealthLevelAtExitForTrade(db, { tradeId, exitDate })`** in `src/lib/trades/trade-health-logs.ts` (pure query + date bound; unit-testable).

**End-of-day bound (shared with detail page convention):**

```typescript
function endOfLocalCalendarDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}
```

| Scenario | Query | `healthLevelAtExit` |
|----------|--------|---------------------|
| **Closed + `exitDate` set** | `findFirst({ where: { tradeId, checkedAt: { lte: endOfLocalCalendarDay(exitDate) } }, orderBy: { checkedAt: 'desc' }, select: { healthLevel: true } })` | `log?.healthLevel ?? null` |
| **Closed + `exitDate` null** | `findFirst({ where: { tradeId }, orderBy: { checkedAt: 'desc' }, select: { healthLevel: true } })` | `log?.healthLevel ?? null` |
| **No matching log** | — | `null` (not entry level) |
| **Checkpoints only after exit EOD** | Filter excludes them → no row | `null` |
| **Open / not closed** | `writeSetupOutcomeFromTrade` returns early (unchanged) | N/A |

**`writeSetupOutcomeFromTrade` change (only):**

```typescript
const healthLevelAtExit = await resolveHealthLevelAtExitForTrade(prisma, {
  tradeId: trade.id,
  exitDate: trade.exitDate,
});

await prisma.setupOutcome.upsert({
  // ...
  create: { /* ... */ healthLevelAtExit, /* entry fields unchanged */ },
  update: { /* ... */ healthLevelAtExit, /* entry fields unchanged */ },
});
```

**Invalid / missing checkpoint behavior:**

- No checkpoint rows → `null`.
- Prisma returns `SetupHealthLevel` enum from validated P0C writes; legacy TEXT outliers **unlikely** (prod audit: `HEALTHY` only). If `findFirst` throws on corrupt row, behavior matches today (unhandled) — optional follow-up: `normalizeTradeHealthLevel` on read (out of minimal P0D slice).

**Timezone note:** EOD bound uses **server local calendar day** on `exitDate` (consistent with `[id]` page `hasCheckpointToday`). Document in code comment; full TZ contract remains P1 (`06-backend-gaps.md` §7).

---

### 3. Schema Compatibility

| Field | Prisma type | Nullable? | P0D `null` fallback |
|-------|-------------|-----------|---------------------|
| `SetupOutcome.healthLevelAtExit` | `SetupHealthLevel?` | **Yes** (`?`) | **Allowed** — no schema change |

**Conclusion:** Implementation may proceed with `healthLevelAtExit: null`. **Do not** stop for schema reasons.

`healthLevelAtEntry` remains `SetupHealthLevel?` — unchanged; still copied from trade at writeback.

---

### 4. Test Plan

**New file (proposed):** `src/lib/trades/trade-health-logs.exit-health.test.ts` or `src/app/actions/trades.exit-health.test.ts`

| # | Case | Setup | Expected `healthLevelAtExit` |
|---|------|--------|------------------------------|
| 1 | Checkpoint before exit date | Logs at T−2d, T−1d; `exitDate` = T | Level at T−1d (latest ≤ EOD) |
| 2 | Checkpoint after exit date only | Log at T+1d only; `exitDate` = T | `null` |
| 3 | No checkpoints | No rows | `null` |
| 4 | No `exitDate` | Logs at various times; `exitDate: null` | Global latest `checkedAt DESC` |
| 5 | Entry health unchanged | Trade `healthLevelAtEntry: HEALTHY`, exit resolved `WARNING` | Upsert: entry still `HEALTHY`, exit `WARNING` |
| 6 | Upsert still succeeds | Mock `setupOutcome.upsert` | Called once with resolved exit level |
| 7 | Non-closed trade | `status: OPEN` | `writeSetupOutcomeFromTrade` no-op (no upsert) |

**Implementation approach:** Unit-test `resolveHealthLevelAtExitForTrade` with mocked `tradeHealthLog.findFirst` (deterministic). Optional thin integration test if test DB harness exists later.

**Manual validation:**

1. OPEN trade → add checkpoint `WARNING` → close with `exitDate` today → `setup_outcomes.health_level_at_exit = WARNING`.
2. Close with only post-exit checkpoints → exit health `null` in DB.
3. `healthLevelAtEntry` on same row still matches trade form.

**Regression:** `npm run lint`, `npm test`, `npm run build`. No changes to `addTradeHealthCheckpoint`.

---

### 5. Implementation Slice

| File | Change | Risk | Validation |
|------|--------|------|------------|
| `src/lib/trades/trade-health-logs.ts` | Add `endOfLocalCalendarDay`, `resolveHealthLevelAtExitForTrade` | Low | Unit tests |
| `src/lib/trades/trade-health-logs.exit-health.test.ts` (new) | Cases 1–4 for resolver | Low | `npm test` |
| `src/app/actions/trades.ts` | `writeSetupOutcomeFromTrade`: call resolver; set `healthLevelAtExit` on create/update | **Medium** — learning loop | Manual close + DB inspect |
| `docs/integration/BACKEND_P0_HEALTH_LOGS_PLAN.md` | Mark P0D done after implementation | — | — |

**Do not touch:** `addTradeHealthCheckpoint`, `[id]/page.tsx`, `trades/page.tsx`, UI, `prisma/schema.prisma`, migrations.

**Suggested commit message (when approved):** `fix(trades): resolve setup outcome exit health from checkpoints`

---

### P0D approval question (before coding)

> **Approve P0D implementation** — update `writeSetupOutcomeFromTrade` to set `healthLevelAtExit` via `resolveHealthLevelAtExitForTrade` using the four locked rules above (`null` fallback, no entry copy, exitDate EOD filter, global latest when no exitDate)?

Confirm:

- **EOD semantics:** server-local calendar day on `exitDate` (match `[id]` page) — Y/N.
- **Tests:** resolver unit tests only (no full Prisma integration DB) — Y/N.

---

### Optional P0E — Trades list reads (separate approval)

| Field | Value |
|-------|--------|
| **Files** | `src/app/(dashboard)/trades/page.tsx` — **3 query blocks only** |
| **Risk** | High — DISTINCT ON + weekly agg |
| **Validation** | Full trades ledger review queue parity tests |
| **Stop if** | Review ordering/counts diverge |

**Not part of initial P0 approval** unless explicitly requested — respects “do not refactor `/trades/page.tsx` broadly.”

---

## 9. Files Touched Summary (by slice)

| Slice | Likely paths |
|-------|----------------|
| P0A | `prisma/schema.prisma`, `prisma/migrations/*` |
| P0B | `src/lib/trades/trade-health-logs.ts`, `src/app/(dashboard)/trades/[id]/page.tsx` |
| P0C | `src/app/actions/trades.ts` |
| P0D | `src/app/actions/trades.ts`, tests |
| P0E (optional) | `src/app/(dashboard)/trades/page.tsx`, `src/lib/trades/trade-health-logs.ts` |

**Forbidden in all slices:** UI components, new routes, Server Action signatures exposed to client (except unchanged), Prisma changes to other models.

---

## 10. Approval Gate (before coding)

Confirm:

1. **P0A–P0D only** first (exclude P0E `/trades/page.tsx` batch SQL)?
2. **`healthLevelAtExit` fallback:** `null` (recommended) vs `healthLevelAtEntry`?
3. **Exit log selection:** latest by `checkedAt` globally vs `checkedAt <= exitDate`?
4. **Failed reads:** keep silent catch for P0 or require throw + UI error (may need tiny caller change on `[id]/page.tsx`)?
5. **`health_level` enum:** run DISTINCT audit query on prod/staging before enum mapping?

**P0A–P0D:** implemented and closed (see § Backend P0 Closure). **P0E:** **DEFER** (see closure table). **P1 DTO foundation:** implemented in `P1_FRESHNESS_LIFECYCLE_DTO_CONTRACT.md` — not wired into UI pages yet.

---

## Backend P0 Closure (2026-05-25)

| Slice | Status | Commit | Production verified? | Notes |
|-------|--------|--------|----------------------|-------|
| P0A Prisma model | ✅ Complete | `ad1af84` | Yes (migrate deploy + deploy `c72a664`) | No-op migration `20260525120000`; table pre-existed |
| P0B typed detail read | ✅ Complete | `8f6a0f7` | Yes (`8f6a0f7` deploy) | `loadTradeHealthLogsForDetailPage`; `[id]/page.tsx` only |
| P0C typed checkpoint write | ✅ Complete | `dcfd6c4` | Yes (`c72a664` deploy) | `buildTradeHealthLogCreateData` + `tradeHealthLog.create` |
| P0D true exit health | ✅ Complete | `d1de890` | Yes (`d1de890` deploy) | `resolveHealthLevelAtExitForTrade`; never copies entry |
| P0D production smoke | ✅ Verified | — | Yes (Neon) | Trade `cmpkmn7vt000344sznauan3yn`: entry `HEALTHY`, exit `WARNING`, not copied |
| P0E `/trades/page.tsx` batch SQL | **DEFER** | — | N/A | Maintainability-only; batch SQL works; does not block P0 correctness |

### P0E decision: **DEFER**

| Criterion | Assessment |
|-----------|------------|
| Correctness | Trades ledger batch reads still function; silent catch unchanged |
| UI rebuild blocker? | No — P1 DTOs address freshness/lifecycle separately |
| Risk | High (`DISTINCT ON`, weekly JSON agg) |
| Trigger later | Typed batch helpers + parity tests when `/trades` page refactor is approved (P0E or Phase 2 slice) |

### P0D smoke script

| Item | Decision |
|------|----------|
| `scripts/p0d-exit-health-verification-smoke.ts` | **Committed** — requires `RUN_P0D_EXIT_HEALTH_SMOKE=1` + optional `SMOKE_DATABASE=production` |
| Markers | `P0DEXIT`, `P0D_EXIT_HEALTH_SMOKE`, `notes.p0dExitHealthSmoke` |
| Cleanup | Documented in script header; **do not auto-delete** — keep prod smoke row as audit evidence unless approved cleanup |

**Backend P0:** **conditionally complete** — all P0A–P0D shipped; P0E explicitly deferred; failed-read loudness still optional (`06-backend-gaps.md` §1).

---

## Appendix — Raw SQL inventory (complete)

| Location | Line area (approx) | SQL type |
|----------|-------------------|----------|
| `src/app/actions/trades.ts` | ~~527–537~~ | **Removed in P0C** — `tradeHealthLog.create` |
| `src/app/(dashboard)/trades/[id]/page.tsx` | ~~203–207~~ | **Removed in P0B** — `loadTradeHealthLogsForDetailPage` |
| `src/app/(dashboard)/trades/page.tsx` | 301–307 | SELECT DISTINCT today |
| `src/app/(dashboard)/trades/page.tsx` | 331–339 | SELECT DISTINCT ON latest |
| `src/app/(dashboard)/trades/page.tsx` | 377–385 | SELECT weekly BOOL_OR JSON |

**Total:** 5 call sites, 1 table.
