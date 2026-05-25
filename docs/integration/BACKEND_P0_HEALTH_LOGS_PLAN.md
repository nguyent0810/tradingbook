# Backend P0 — `trade_health_logs` Prisma Model + Exit Health Integrity

**Status:** Planning only — **no implementation approved yet**  
**Date:** 2026-05-25  
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
| Checkpoint write | `src/app/actions/trades.ts` → `addTradeHealthCheckpoint` | `$executeRawUnsafe` INSERT; validates `healthLevel` via string Set; serializes `review_checklist` JSON | SQL injection surface low (parameterized) but untyped; no Prisma errors surfaced to UI |
| Outcome write (bug) | `src/app/actions/trades.ts` → `writeSetupOutcomeFromTrade` | On `CLOSED`, upserts `SetupOutcome` with `healthLevelAtExit: trade.healthLevelAtEntry` (lines 155, 167) | **Learning-loop / exit stats wrong** |
| Outcome trigger | `createTrade` / `updateTrade` | Calls `writeSetupOutcomeFromTrade` when `status === "CLOSED"` | Same bug on create-closed and update-closed |
| Trades ledger reads | `src/app/(dashboard)/trades/page.tsx` | 3× `$queryRaw`: today checkpoints, `DISTINCT ON` latest log, weekly JSON agg | Silent catch → empty Maps; no schema drift protection |
| Trade detail reads | `src/app/(dashboard)/trades/[id]/page.tsx` | `$queryRawUnsafe` SELECT last 20 logs; silent catch → empty history | User sees “no history” on DB errors |
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
| `src/app/actions/trades.ts` | INSERT checkpoint | **P0C** | `prisma.tradeHealthLog.create({ data: { tradeId, healthLevel, healthScore, priceVsZone, structureStatus, recommendedAction, reviewChecklist } })` | Medium — must map enum + `Json`; keep validation identical |
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

## 6. Exit Health Fix Plan

### Current incorrect behavior (TRACED)

`writeSetupOutcomeFromTrade` sets:

- `healthLevelAtExit: trade.healthLevelAtEntry` on create and update of `SetupOutcome`.

So closed-trade learning stats treat exit health as entry-time snapshot, ignoring EOD checkpoints.

### Intended behavior (from `06-backend-gaps.md` + FRD intent)

`healthLevelAtExit` on `SetupOutcome` should reflect **health at/near exit**, not entry.

### Proposed resolution

| Step | Logic |
|------|--------|
| 1 | When `trade.status === "CLOSED"` and `setupId` present, load latest checkpoint: `tradeHealthLog.findFirst({ where: { tradeId }, orderBy: { checkedAt: 'desc' } })` |
| 2 | `exitHealth = latestLog?.healthLevel ?? null` |
| 3 | **Do not** copy `trade.healthLevelAtEntry` to `healthLevelAtExit` |
| 4 | Optional tie-break **NEEDS_BACKEND_CONFIRMATION:** if `trade.exitDate` set, prefer latest log with `checkedAt <= trade.exitDate` (if multiple checkpoints after exit timestamp, exclude them) |

### Fallback when no checkpoint exists

| Option | Behavior |
|--------|----------|
| **A (recommended)** | `healthLevelAtExit: null` | Honest — no checkpoint data |
| B | `trade.healthLevelAtEntry` | Preserves old (wrong) semantics |
| C | `trade.healthLevelAtEntry` only when `healthLevelAtEntry != null` else null | Partial |

**Plan recommends A** unless product requires B for backward-compat dashboards.

### Interaction with `Trade.healthLevelAtEntry`

Entry field remains set at trade create/update from form — unchanged.

### Call sites (unchanged flow)

- `createTrade` → `writeSetupOutcomeFromTrade(created.id)` when closed
- `updateTrade` → `writeSetupOutcomeFromTrade(tradeId)` when closed

Only internal assignment of `healthLevelAtExit` changes.

### Tests required (P0D)

- Closed trade **with** checkpoint → `SetupOutcome.healthLevelAtExit` equals latest log `healthLevel`
- Closed trade **without** checkpoint → `healthLevelAtExit` is `null` (if option A)
- Closed trade with multiple checkpoints → uses latest `checkedAt`
- Open trade → `writeSetupOutcomeFromTrade` no-op (unchanged)
- Update closed trade after new checkpoint → upsert picks up new latest log

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
| **Files** | `src/app/actions/trades.ts` (`addTradeHealthCheckpoint` only) |
| **Risk** | Medium — production checkpoint path |
| **Validation** | Add checkpoint on OPEN trade; row appears in DB; detail + list see it |
| **Stop if** | JSON/null handling differs from `$executeRawUnsafe` |

---

### P0D — Exit health fix

| Field | Value |
|-------|--------|
| **Files** | `src/app/actions/trades.ts` (`writeSetupOutcomeFromTrade` + small helper `resolveHealthLevelAtExit(tradeId, exitDate?)`) |
| **Risk** | Low logic change; high product impact |
| **Validation** | Close trade with prior checkpoint; inspect `setup_outcomes.health_level_at_exit` |
| **Stop if** | Stakeholder requires entry-level fallback (option B) |

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

**Do not implement until written approval for slices P0A–P0D (and optional P0E).**

---

## Appendix — Raw SQL inventory (complete)

| Location | Line area (approx) | SQL type |
|----------|-------------------|----------|
| `src/app/actions/trades.ts` | 527–537 | INSERT |
| `src/app/(dashboard)/trades/[id]/page.tsx` | 203–207 | SELECT … LIMIT 20 |
| `src/app/(dashboard)/trades/page.tsx` | 301–307 | SELECT DISTINCT today |
| `src/app/(dashboard)/trades/page.tsx` | 331–339 | SELECT DISTINCT ON latest |
| `src/app/(dashboard)/trades/page.tsx` | 377–385 | SELECT weekly BOOL_OR JSON |

**Total:** 5 call sites, 1 table.
