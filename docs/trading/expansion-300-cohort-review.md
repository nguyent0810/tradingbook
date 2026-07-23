# Expansion 300 cohort review (additive only)

**Status:** Local review artifact — **not applied**, **not pushed**, no production workflows run.  
**Generated:** 2026-06-05 from production read-only audit (`expectedLatestSessionDay: 2026-06-05`).

## Summary

| Field | Value |
|--------|--------|
| **Cohort file** | `data/expansion-300-cohort.json` |
| **Baseline actives** | **206** (preserved in full) |
| **Additive proposed** | **94** (all currently inactive) |
| **Intended active total** | **300** |
| **Tier A** | 23 liquid (≥2B VND 20d avg value) |
| **Tier B** | 71 remainder (liquidity-ranked, ≥120 bars) |
| **Batch B1** | **NO-GO** |
| **Wholesale `curate-active-symbols --apply`** | **NO-GO** (shrinks to ~135 with `--require-latest-bar`) |

## Selection rules

1. **Additive only** — no deactivation of existing 206 actives.
2. **≥120 bars** required for additive symbols (`TRADABILITY_MIN_BARS`).
3. **Tier A:** inactive, `avgValue20Vnd ≥ 2B`, `weekdaySessionsStale ≤ 60`.
4. **Tier B:** fill to 94 from remaining inactive ≥120-bar pool by liquidity rank, same staleness cap.
5. **Excluded:** cold-start track (`HCM`, `VCI`, `DIG`, `DXG`, `KBC`), manual exclusions (`BCG`, `CCP`, `CK8`, `DAG`), `weekdaySessionsStale > 60`, 0-bar symbols.
6. **Sector:** not stored in DB; liquidity via `avgValue20Vnd` only.

## Validation (passed)

```bash
# Offline + production read-only cross-check
SMOKE_DATABASE=production npx tsx scripts/validate-expansion-300-cohort.ts --with-db
```

Result: `ok: true` — no duplicates, all additive inactive in DB, all ≥120 bars, `intendedActiveCount: 300`.

Regenerate cohort (read-only):

```bash
SMOKE_DATABASE=production npx tsx scripts/prepare-expansion-300-cohort.ts
```

## Tier A — liquid blue chips (23)

| Symbol | Bars | Latest | Stale (wd) | Avg 20d value | Exchange |
|--------|------|--------|------------|---------------|----------|
| HDB | 145 | 2026-05-04 | 24 | 313.8B | HOSE |
| GEX | 160 | 2026-05-06 | 22 | 260.5B | — |
| VCG | 145 | 2026-05-04 | 24 | 227.8B | HOSE |
| VNM | 145 | 2026-05-04 | 24 | 222.4B | HOSE |
| VJC | 145 | 2026-05-04 | 24 | 221.2B | HOSE |
| PLX | 145 | 2026-05-04 | 24 | 130.0B | HOSE |
| POW | 145 | 2026-05-04 | 24 | 126.5B | HOSE |
| GMD | 145 | 2026-05-04 | 24 | 112.7B | HOSE |
| TPB | 145 | 2026-05-04 | 24 | 107.9B | HOSE |
| GAS | 145 | 2026-05-04 | 24 | 105.1B | HOSE |
| VIB | 145 | 2026-05-04 | 24 | 104.8B | HOSE |
| GEE | 160 | 2026-05-06 | 22 | 91.8B | — |
| PNJ | 145 | 2026-05-04 | 24 | 82.0B | HOSE |
| REE | 145 | 2026-05-04 | 24 | 71.4B | HOSE |
| VGC | 145 | 2026-05-04 | 24 | 35.8B | HOSE |
| SAB | 145 | 2026-05-04 | 24 | 34.5B | HOSE |
| VTP | 145 | 2026-05-04 | 24 | 33.8B | HOSE |
| SSB | 145 | 2026-05-04 | 24 | 31.7B | HOSE |
| ACV | 161 | 2026-05-07 | 21 | 31.4B | — |
| ABB | 161 | 2026-05-07 | 21 | 9.6B | — |
| AAS | 161 | 2026-05-07 | 21 | 5.7B | — |
| BCR | 160 | 2026-04-24 | 30 | 3.3B | — |
| BGE | 160 | 2026-04-24 | 30 | 3.0B | — |

**Backfill:** all 23 require session catch-up (~21–30 weekday sessions stale). None session-aligned at audit time.

## Tier B — remainder (71)

Liquidity-ranked fill; **many names are below scanner tradability floors** (2B VND / 100k volume). Full table in `data/expansion-300-cohort.json` → `symbolMetadata`.

| Liquidity band | Count | Examples |
|----------------|-------|----------|
| 1B–2B VND | 6 | APS, DDG, ATG, DFF, AMS, BOT |
| 100M–1B VND | 20 | AVG, AMV, ACM, … |
| &lt;100M VND | 45 | C92, BQB, AME, … (tail) |

**Warning:** Tier B tail will **not pass tradability** until bars refresh; most will not surface as scan candidates. Review whether tail size is acceptable before activation.

## Excluded symbols (not in +94)

### Cold-start track (separate path)

| Symbol | Reason |
|--------|--------|
| HCM, VCI, DIG, DXG, KBC | 0 bars — cold-start fetch before any activation |

### Manual / extreme staleness (sample)

| Symbol | Reason |
|--------|--------|
| BCG | 172 wd stale; prior recovery exclusion |
| DAG | 472 wd stale |
| CCP | 180 wd stale |
| CK8 | 140 wd stale |
| ART, AVF, BT6 | 486 wd stale |

Full exclusion list: `data/expansion-300-cohort.json` → `exclusions` (1210 entries including 0-bar and &lt;120-bar inactive).

## Staleness / liquidity warnings

| Warning | Detail |
|---------|--------|
| **100% backfill required** | 0/94 additive symbols session-aligned at audit |
| **Tier B tradability** | ~45 symbols &lt;100M VND 20d avg — likely filtered at Gate 1 |
| **Exchange metadata** | Often unset (`—`); HOSE populated for large caps only |
| **No sector field** | Schema has no sector; exchange optional on `StockSymbol` |

## Estimated cohort-only backfill (frozen 2-shard)

| Scope | Symbols | Est. wall time |
|-------|---------|----------------|
| Tier A only | 23 | ~2–3 min |
| Full +94 cohort | 94 | ~7–9 min |
| Post-backfill activation | — | Separate approved step (not in this file) |

Use Phase A frozen-list `fetch_shard_count=2` dispatch **after** cohort approval; **do not** enable scheduled sharding.

## GO / NO-GO — cohort-only backfill (no activation)

### Conditional **GO** (Tier A +94 frozen backfill pilot)

Proceed with **cohort-only bar backfill** (no `active` flag changes) when:

- [x] **Tier A (23) backfill pilot** — completed 2026-06-05 (23/23 aligned, 0 failures, universe 206 unchanged). See `docs/trading/cohort-backfill-pilot.md`.
- [x] Human review accepts Tier B tail (71 names, incl. sub-tradability liquidity) — approved 2026-07-23, with partial-batch activation (see below) instead of all-or-nothing.
- [x] **Tier B (+71) backfill** — completed 2026-07-23: `SMOKE_DATABASE=production bash scripts/run-cohort-equity-backfill.sh --tier=b`, 71/71 fetched and imported, 0 failures (2 shards, 36+35).
- [x] Dispatch uses frozen symbol list derived from cohort JSON (`--tier=a|b|all`)
- [x] `overlapCount=0`, ≤5% failures/shard, manifest sums to tier count

### **NO-GO** until resolved

- Batch B1 or wholesale `curate-active-symbols --apply`
- Mixing cold-start symbols into +94 without explicit approval
- Activation (`active=true`) before backfill validation
- Scheduled `fetch_shard_count=2` on cron

## Tier B activation result (2026-07-23)

Unlike Tier A's all-or-nothing gate, Tier B activation is **partial-batch**: only inactive Tier B symbols within a
weekday-session staleness tolerance are activated; stragglers are skipped (left inactive) rather than blocking the
whole batch. Tooling: `scripts/lib/tier-b-additive-activation.ts` (+ `dry-run`/`apply`/`rollback-tier-b-additive-activation.ts`),
`data/expansion-300-tier-b-activation.json`.

Only 18/71 (25%) matched the expected session exactly — most Tier B names are genuinely thin-traded and don't print
every session, so an exact-match bar (same standard as Tier A's liquid blue chips) was too strict. Reviewed and
relaxed to **`--max-weekday-stale=5`** (≤5 weekday sessions behind VNINDEX's latest session):

| Outcome | Count | Symbols |
|---|---|---|
| Activated (≤5 sessions stale) | **52** | see `apply-tier-b-additive-activation.ts` output, 2026-07-23 |
| Skipped (>5 sessions stale) | **19** | ATG, CAR, BXH, C21, BGW, CBI, ARM, DAN, CHC, DDH, BMG, CMF, BMK, CPI, C22, CX8, CCT, BTV, BSG |

Of the 19 skipped, 5 are severely stale and likely need separate review before any future retry: **CX8** (72 sessions,
~4 months), **CCT** (60 sessions, ~3 months), **CAR / C21 / BMG** (33 sessions each, ~7 weeks) — these may be
suspended, delisted, or otherwise structurally inactive rather than just low-volume.

**Active universe: 229 → 281.** Rollback: `APPLY_TIER_B_ROLLBACK=1 SMOKE_DATABASE=production npx tsx scripts/rollback-tier-b-additive-activation.ts` (deactivates only the 52 Tier B symbols; baseline and Tier A untouched).

## Next steps

1. ~~Operator review of Tier B tail in `expansion-300-cohort.json`~~ — done, partial-batch approach approved.
2. ~~Cohort-only backfill dispatch~~ — done, 71/71 fetched.
3. ~~Verify ≥90% session-aligned post-backfill~~ — superseded: exact-match alignment was only 25%; relaxed tolerance (≤5 sessions) used instead, yielding 52/71 (73%) activatable.
4. ~~Separate approval for additive activation script~~ — done, 52/71 activated 2026-07-23.
5. 300-symbol import+scan pilot — partially done; current universe is 281, not 300 (19 Tier B stragglers held back). Run `SMOKE_DATABASE=production npx tsx scripts/run-daily-scanner.ts` to validate the 281-symbol scan.
6. Beyond 300: reaching a 500-symbol target requires a **new cohort selection** (~220 more symbols) drawn from the ~1210 currently-excluded pool in `expansion-300-cohort.json`, applying the same `≥120 bars` / liquidity rules used for this cohort.
