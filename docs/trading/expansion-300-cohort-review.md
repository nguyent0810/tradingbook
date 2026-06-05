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
- [ ] Human review accepts Tier B tail (71 names, incl. sub-tradability liquidity)
- [ ] **Tier B (+71) backfill** — tooling ready; not dispatched until reviewed
- [ ] Dispatch uses frozen symbol list derived from cohort JSON (`--tier=a|b|all`)
- [ ] `overlapCount=0`, ≤5% failures/shard, manifest sums to tier count

### **NO-GO** until resolved

- Batch B1 or wholesale `curate-active-symbols --apply`
- Mixing cold-start symbols into +94 without explicit approval
- Activation (`active=true`) before backfill validation
- Scheduled `fetch_shard_count=2` on cron

## Next steps (planning only)

1. Operator review of Tier B tail in `expansion-300-cohort.json`.
2. Cohort-only backfill dispatch (symbols from JSON, `trigger_scan=false`).
3. Verify ≥90% session-aligned post-backfill.
4. Separate approval for additive activation script (activate-only, no deactivations).
5. 300-symbol import+scan pilot.
