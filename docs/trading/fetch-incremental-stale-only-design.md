# Fetch incremental / stale-only (Batch D)

**Status:** Implemented (CLI helpers + docs). Production universe apply (Batch B1) **deferred**.

## Why stale-only

| Mode | 206 active (prod) | 300 symbols | 1000 symbols |
|------|-------------------|---------------|--------------|
| Full fetch @ 3.55 s/symbol | ~12 min | ~18 min | ~59 min |
| Stale-only (38 on prod today) | **~2.2 min** | varies | varies |

Scanner in-job time is **not** the bottleneck (local 221/300 &lt;1s). **Provider fetch** and **bar freshness** block scale-up.

## Rationale

1. After universe is curated, most symbols already align with the latest VNINDEX session.
2. Daily jobs should fetch only **stale** or **missing** symbols plus **retry** failures.
3. Full universe backfill remains a rare, sharded operation.

## Tools (read-only vs local artifacts)

| Script | DB writes | Purpose |
|--------|-----------|---------|
| `list-stale-fetch-targets.ts` | **None** | List stale/missing; optional `--write-symbols-file` |
| `build-fetch-retry-queue.ts` | **None** | Build retry list from fetch JSON |
| `plan-fetch-shards.ts` | **None** | Shard/time estimates |
| `fetch_stock_bars.py` | **None** (file only) | Fetch; `--symbols-file`, `--retry-file` |
| `import-stock-bars.ts` | Upsert bars | Run only after explicit import approval |

### list-stale-fetch-targets

```bash
# Local
npx tsx scripts/list-stale-fetch-targets.ts --active-only --json
npx tsx scripts/list-stale-fetch-targets.ts --active-only --write-symbols-file=data/stale-fetch-targets.json

# Production read-only (no DB writes; local JSON optional)
SMOKE_DATABASE=production npx tsx scripts/list-stale-fetch-targets.ts \
  --production-read-only --active-only --json
```

### Stale-only fetch (when approved — not run in planning phase)

```bash
npx tsx scripts/list-stale-fetch-targets.ts --active-only \
  --write-symbols-file=data/stale-fetch-targets.json
python scripts/fetch_stock_bars.py \
  --symbols-file data/stale-fetch-targets.json \
  --sleep 3.2 \
  --end-date <expected-session-day>
npx tsx scripts/import-stock-bars.ts data/stock-bars.json
```

## Retry-failed-only

1. `python scripts/fetch_stock_bars.py ...` → `data/stock-bars.json`
2. `npx tsx scripts/build-fetch-retry-queue.ts data/stock-bars.json`
3. Second pass: `fetch_stock_bars.py --symbols-file data/fetch-retry-queue.json`  
   or merge: `--retry-file data/fetch-retry-queue.json`
4. Re-import (upsert idempotent).

## Shard layout (GHA)

| Universe | Shards | Symbols/shard | Est. fetch/shard | 45m GHA |
|----------|--------|---------------|------------------|---------|
| **300** | 1 | 300 | ~18 min | OK (+ overhead) |
| **500** | 2 | 250 | ~15 min | OK per shard |
| **1000** | 4 | 250 | ~15 min | OK per shard (parallel jobs) |

```bash
npx tsx scripts/plan-fetch-shards.ts
```

**Split symbols:**

```bash
npx tsx scripts/list-stale-fetch-targets.ts --active-only \
  --shard-index=0 --shard-count=2 \
  --write-symbols-file=data/stock-bars-shard-0-symbols.json
```

**Artifacts:** `stock-bars-shard-{i}.json` on runner temp.

**Import order:** VNINDEX → shard 0 import → shard 1 import → … (upsert safe).

**Failure threshold:** fail if &gt;5% symbols empty/failed per shard, or tier-1 core symbol fails.

**Retry:** upload failed list artifact → `workflow_dispatch` retry job with `--retry-file`.

## Phase A: 2-shard stale plumbing pilot (206 universe)

**Status:** Merged to `main` (PR #6); pilots #1–#2 completed. Frozen-list shard split fix prevents per-shard DB re-list after imports.  
**Scope:** `workflow_dispatch` only; **no** universe apply, Batch B1, or scanner changes.

### Purpose

Prove GHA can split the **stale-only** target list across two shards, fetch/import each shard, and emit a manifest — using the current **206** active universe (~35 stale targets typical).

### Controls

| Input | Default | Effect |
|-------|---------|--------|
| `fetch_shard_count` | `1` | `2` = two stale shards (pilot) |
| `stale_only_fetch` | `true` | Required for `fetch_shard_count=2` |
| `trigger_scan` | `true` | Unchanged |
| `skip_equity` | `false` | Unchanged |

**Scheduled cron:** always `fetch_shard_count=1` (dispatch input absent).

### Flow when `fetch_shard_count=2`

1. Full stale listing → `stale-fetch-target-summary.json` (unchanged).
2. `Select equity symbol list` → must be stale-only (`0 < stale < full`).
3. `scripts/run-production-equity-fetch.sh`:
   - Freeze `STALE_SYMBOLS_JSON` once (workflow listing step) → `stale-fetch-targets-frozen.json`.
   - `scripts/write-frozen-stale-shard-files.ts` splits the frozen list (round-robin `i % shardCount`) into `stale-fetch-targets-shard-{i}.json` — **no** per-shard `list-stale-fetch-targets` after imports start.
   - For each shard: fetch → `build-fetch-retry-queue.ts` → fail if &gt;5% empty → `import-stock-bars.ts` (sequential).
4. Upload `fetch-shard-manifest.json` + frozen/shard symbol/stock/retry artifacts (`overlapCount` must be 0).

### Artifacts (pilot)

| File | Content |
|------|---------|
| `fetch-shard-manifest.json` | `initialFetchTargetCount`, `shardTargetCounts`, `uniqueTargetCount`, `overlapCount` (0), per-shard fetch/import counts |
| `stale-fetch-targets-frozen.json` | Full stale snapshot before any shard fetch |
| `stale-fetch-targets-shard-{0,1}.json` | Precomputed shard symbol lists from frozen snapshot |
| `stock-bars-shard-{0,1}.json` | Fetch output per shard |
| `fetch-retry-queue-shard-{0,1}.json` | Failed symbols per shard |

### Manual pilot commands (re-validate after frozen-list fix)

```powershell
# Plumbing only (no scan)
gh workflow run production-bar-import.yml --ref main `
  -f skip_equity=false `
  -f stale_only_fetch=true `
  -f fetch_shard_count=2 `
  -f trigger_scan=false

# Full path including scan
gh workflow run production-bar-import.yml --ref main `
  -f skip_equity=false `
  -f stale_only_fetch=true `
  -f fetch_shard_count=2 `
  -f trigger_scan=true
```

Expect manifest `overlapCount: 0` and `uniqueTargetCount` = `initialFetchTargetCount`.

### Rollback

- `fetch_shard_count=1` (default) → previous single-fetch behavior.
- `stale_only_fetch=false` → full universe single fetch (rollback smoke).
- No DB delete required (upsert idempotent).

## Operational safeguards

- `describeDatabaseUrl()` only (no credentials in logs).
- `--production-read-only` + `SMOKE_DATABASE=production` required for Neon listing.
- `list-stale-fetch-targets` never calls `--apply` or Prisma writes.
- `BAR_IMPORT_REQUIRE_PRODUCTION_DB=1` stays on GHA import path only.
- Do **not** run full 1000-symbol fetch in a single 45m job.

## Rollback

- Re-run full fetch for affected symbols using previous `effective-universe-symbol-keys.json` from artifact.
- Import is upsert — no need to delete bars for rollback.
- Universe activation rollback: separate `curate-active-symbols` / git-tracked `active-symbol-keys.json` (Batch B1 — **deferred**).

## Why Batch B1 (prod apply to 168) is deferred

- Applying now would **shrink** active universe **206 → 168** (higher fidelity, smaller scope).
- Batch D reduces **daily fetch cost** without changing who is active.
- Expand toward 300 only after stale-only pipeline is proven and provider coverage allows more latest-session symbols.

## GitHub Actions (`production-bar-import.yml`)

Scheduled and manual production bar import uses **stale-only equity fetch** by default.

### Flow (equity path)

1. VNINDEX fetch + import (unchanged).
2. `export-active-symbol-keys.ts` → full effective universe JSON (`SYMBOLS_JSON`).
3. When `STALE_ONLY_FETCH=1` (default): `list-stale-fetch-targets.ts --production-read-only --active-only` (read-only DB).
4. `Select equity symbol list`: use stale JSON if `0 < staleCount < fullCount`, else full universe.
5. `fetch_stock_bars.py --symbols-file "$FETCH_SYMBOLS_JSON"` (unchanged sleep/end-date).
6. `import-stock-bars.ts` (unchanged upsert).
7. Health artifacts + optional scan trigger (unchanged).

### Environment / rollback

| Control | Effect |
|---------|--------|
| `STALE_ONLY_FETCH=1` (job default) | List stale targets; fetch subset when smaller than full universe |
| `STALE_ONLY_FETCH=0` | **Rollback:** skip stale listing; always fetch full `SYMBOLS_JSON` |
| `workflow_dispatch` → `stale_only_fetch: false` | Sets `STALE_ONLY_FETCH=0` for one run |

To force full universe on a scheduled run, add a repository variable or temporarily change job `env.STALE_ONLY_FETCH` to `"0"` in the workflow file.

### Artifacts

| File | Content |
|------|---------|
| `stale-fetch-target-summary.json` | JSON from `list-stale-fetch-targets --json` (masked `databaseUrlHint`, counts) |
| `pre-import-health.json` / `post-import-health.json` | Existing bar-import health |
| `scan-response.json` | Daily scan HTTP response when triggered |

Runner temp (not uploaded): `stale-fetch-targets.json` (symbol list passed to Python fetch).

### Safety

- `list-stale-fetch-targets` does **not** write to Postgres.
- Logs print **masked** `databaseUrlHint` only (no credentials).
- `BAR_IMPORT_REQUIRE_PRODUCTION_DB=1` unchanged.
- Production universe activation (Batch B1) is **not** modified by this workflow.

### Operational behavior

- **~38 stale / 206 active (typical):** fetch ~2 min instead of ~12 min full.
- **0 stale:** falls back to full universe fetch (health unchanged).
- **stale ≥ full:** falls back to full (defensive).
- **Listing step fails:** step skipped if `STALE_ONLY_FETCH=0`; if listing fails with exit 1, job fails before fetch (fix DB/network).

## Related

- [universe-curation-spec.md](./universe-curation-spec.md)
- [PRODUCTION_BAR_IMPORT_AUTOMATION.md](../integration/PRODUCTION_BAR_IMPORT_AUTOMATION.md)
- `.github/workflows/production-bar-import.yml`
