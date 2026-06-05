# Cohort-only equity backfill (review tooling)

**Status:** Review branch tooling — **not merged**, **Tier B not run**, **no activation**, **no universe changes**.

Bars-only backfill for additive symbols in `data/expansion-300-cohort.json`. Existing `active` flags are never flipped; production baseline remains **206** actives.

## Tooling

| Script | Role |
|--------|------|
| `scripts/validate-cohort-backfill-preflight.ts` | Read-only DB safety gate before fetch |
| `scripts/write-cohort-shard-files.ts` | Frozen tier shard split (offline) |
| `scripts/run-cohort-equity-backfill.sh` | Fetch + import upserts only |
| `scripts/verify-cohort-backfill-alignment.ts` | Post-run session alignment check |

### Tier selection

| `--tier` | Symbols | Count |
|----------|---------|-------|
| `a` | `additiveByTier.tierA` | 23 |
| `b` | `additiveByTier.tierB` | 71 |
| `all` | `additiveSymbols` (aliases: `full`, `full_additive`, `additive`) | 94 |

### Safety checks (enforced)

1. **Preflight (DB, read-only):** every tier symbol exists, is in `additiveSymbols`, and is `active=false` (unless `--allow-baseline-fetch`).
2. **Offline shard build:** no duplicate symbols in tier list; no baseline overlap unless `--allow-baseline-fetch`.
3. **Shard split:** `overlapCount` must be **0**.
4. **Per-shard fetch:** failure rate must not exceed `FETCH_SHARD_FAIL_THRESHOLD_PCT` (default **5%**).
5. **Import:** `import-stock-bars.ts` upserts bars only on existing rows; it does not flip `active` on existing symbols. **Preflight blocks missing symbols** so import never creates new `StockSymbol` rows (new rows would be created with `active=true`).
6. **Manifest:** per-shard `importOk`, `importExitCode`, `importedSymbolCount`, and `importFailedSymbolCount` reflect the actual import command result (parsed from `import-stock-bars` stderr).
7. **Post-verify:** all tier symbols remain inactive; `activeCountInDb` must equal baseline **206**.

## Tier A pilot — completed (local)

**Date:** 2026-06-05 (production DB, local Git Bash runner)

| Metric | Result |
|--------|--------|
| Tier | `a` (23 liquid names) |
| Requested / fetched / imported | **23 / 23 / 23** |
| Shard failures | **0** |
| `overlapCount` | **0** (shards 12 + 11) |
| Session-aligned | **23/23** → `2026-06-05` |
| `activeCountInDb` | **206** (unchanged) |
| Tier A `active` in DB | **all false** |
| Runtime | ~6.5 min (2 shards) |

**Command used:**

```bash
SMOKE_DATABASE=production \
  PYTHON_BIN="/c/Users/Tung-QA/AppData/Local/Programs/Python/Python312/python.exe" \
  bash scripts/run-cohort-equity-backfill.sh \
    --tier=a \
    --cohort-file=data/expansion-300-cohort.json
```

**Post-run verify:**

```bash
SMOKE_DATABASE=production npx tsx scripts/verify-cohort-backfill-alignment.ts \
  --tier=a --cohort-file=data/expansion-300-cohort.json
```

Manifest (local): `reports/cohort-backfill/cohort-backfill-manifest.json`

## Tier B — planned (+71, not run)

Tier B covers the remaining 71 additive symbols (liquidity-ranked tail). Many are below scanner tradability floors; backfill is still required before any future activation review.

**Estimated runtime:** ~5–7 min (2 shards, ~35+36 split).

### Preflight (review before dispatch)

```bash
SMOKE_DATABASE=production npx tsx scripts/validate-cohort-backfill-preflight.ts \
  --tier=b --cohort-file=data/expansion-300-cohort.json
```

### Tier B backfill command (after human review)

```bash
SMOKE_DATABASE=production \
  PYTHON_BIN="/c/Users/Tung-QA/AppData/Local/Programs/Python/Python312/python.exe" \
  bash scripts/run-cohort-equity-backfill.sh \
    --tier=b \
    --cohort-file=data/expansion-300-cohort.json
```

### Post-run verify

```bash
SMOKE_DATABASE=production npx tsx scripts/verify-cohort-backfill-alignment.ts \
  --tier=b --cohort-file=data/expansion-300-cohort.json
```

**Success criteria:** 71/71 aligned, 0 shard failures above threshold, `overlapCount=0`, `activeCountInDb=206`, all Tier B remain `active=false`.

## Full additive (+94) — optional single run

If Tier A + Tier B were not run separately, or for a re-backfill of all additive symbols:

```bash
SMOKE_DATABASE=production \
  PYTHON_BIN="/c/Users/Tung-QA/AppData/Local/Programs/Python/Python312/python.exe" \
  bash scripts/run-cohort-equity-backfill.sh \
    --tier=all \
    --cohort-file=data/expansion-300-cohort.json
```

## Explicitly out of scope

- Setting `active=true` on additive symbols
- Batch B1 or wholesale `curate-active-symbols --apply`
- Scheduled `fetch_shard_count=2` on production cron
- GHA workflow wiring (local/Git Bash pilot only until reviewed)

## Related

- Cohort definition: `docs/trading/expansion-300-cohort-review.md`
- Cohort JSON validation: `npx tsx scripts/validate-expansion-300-cohort.ts --with-db`
