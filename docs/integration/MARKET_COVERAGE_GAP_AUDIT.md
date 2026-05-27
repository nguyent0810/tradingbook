# Market Coverage Gap Audit (Production)

**Slice:** Smart Large Slice — Market Coverage Gap Audit  
**Mode:** Investigation-only (read-only diagnostics)  
**Probed at:** 2026-05-27T01:27:03Z  
**Expected latest session:** 2026-05-26

---

## Executive summary

VND/PDR are **not isolated**. They are part of a broader coverage pattern where many relevant symbols are inactive and therefore excluded from both:

1. equity bar import fetch universe, and
2. scanner effective universe.

The core mechanism is consistent:

- Bar import automation exports **only `StockSymbol.active = true`** symbols, then fetches/imports bars for that list.
- Daily scanner also evaluates **active core universe** (plus tactical overlays if configured).
- Inactive names do not get refreshed in normal operations, so many remain stale or have no bars.

Result: VND/PDR stopped at 2026-05-04 for the same reason as multiple other liquid names (SSI, HPG, VIC, VHM, TCB, VPB, etc.): inactive coverage exclusion.

---

## 1) Symbol coverage snapshot

| Metric | Count |
|---|---:|
| Total `stock_symbols` | 1537 |
| `active=true` | 189 |
| `active=false` | 1348 |
| active symbols with fresh bars | 148 |
| active symbols with stale bars | 41 |
| inactive symbols with fresh bars | 0 |
| inactive symbols with stale bars | 166 |
| symbols with no bars | 1182 |
| symbols stale by more than 5 sessions | 173 |
| symbols stale by more than 15 sessions | 136 |

Interpretation:

- There is substantial inactive-symbol non-coverage.
- Staleness is concentrated in inactive symbols, but not exclusively.
- Active universe freshness is better, but still not perfect.

---

## 2) Stale symbol list (ranked)

Ranked by stale severity, then liquidity (`avgValue20Vnd`) and relevance.

### Highest severity + liquid + inactive

| Symbol | Active | Latest Bar Date | Sessions Stale (weekday) | Bar Count | 20D Avg Value (VND) | Reason Guess |
|---|---|---|---:|---:|---:|---|
| BCG | false | 2025-10-08 | 164 | 160 | 19,954,726,000 | IMPORT_UNIVERSE_GAP |
| BCR | false | 2026-04-24 | 22 | 160 | 3,290,242,500 | IMPORT_UNIVERSE_GAP |
| BGE | false | 2026-04-24 | 22 | 160 | 3,030,747,000 | IMPORT_UNIVERSE_GAP |
| SHB | false | 2026-05-04 | 16 | 145 | 1,065,330,437,388 | IMPORT_UNIVERSE_GAP |
| HPG | false | 2026-05-04 | 16 | 145 | 971,380,372,750 | IMPORT_UNIVERSE_GAP |
| VHM | false | 2026-05-04 | 16 | 145 | 848,083,889,000 | IMPORT_UNIVERSE_GAP |
| VIC | false | 2026-05-04 | 16 | 145 | 771,996,956,500 | IMPORT_UNIVERSE_GAP |
| SSI | false | 2026-05-04 | 16 | 145 | 623,569,896,250 | IMPORT_UNIVERSE_GAP |
| FPT | false | 2026-05-04 | 16 | 145 | 608,145,091,500 | IMPORT_UNIVERSE_GAP |
| NVL | false | 2026-05-04 | 16 | 145 | 550,201,380,500 | IMPORT_UNIVERSE_GAP |
| MWG | false | 2026-05-04 | 16 | 145 | 517,043,523,500 | IMPORT_UNIVERSE_GAP |
| TCB | false | 2026-05-04 | 16 | 145 | 453,324,561,750 | IMPORT_UNIVERSE_GAP |
| MBB | false | 2026-05-04 | 16 | 145 | 386,703,485,250 | IMPORT_UNIVERSE_GAP |
| VPB | false | 2026-05-04 | 16 | 145 | 374,911,723,250 | IMPORT_UNIVERSE_GAP |
| VRE | false | 2026-05-04 | 16 | 145 | 238,902,939,750 | IMPORT_UNIVERSE_GAP |
| PDR | false | 2026-05-04 | 16 | 145 | 156,033,479,000 | IMPORT_UNIVERSE_GAP |
| VND | false | 2026-05-04 | 16 | 145 | 154,078,162,000 | IMPORT_UNIVERSE_GAP |

### Pattern summary by latest bar date (stale symbols)

- 2026-05-04: 39 symbols
- 2026-04-24: 29 symbols
- 2026-05-25: 24 symbols
- 2026-05-05: 15 symbols

This confirms a cluster-style coverage gap, not just isolated per-symbol random failure.

---

## 3) Important missing-name audit

Requested symbols:
`VND, PDR, SSI, HCM, VCI, DIG, DXG, CEO, KBC, NVL, HPG, FPT, MWG, VHM, VRE, VIC, CTG, BID, TCB, MBB, VPB`

| Symbol | Exists | Active | Latest Bar Date | In Effective Universe | Latest Scan Considered? | Notes |
|---|---|---|---|---|---|---|
| VND | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| PDR | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| SSI | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| HCM | Yes | false | null | No | No | Inactive; no bars |
| VCI | Yes | false | null | No | No | Inactive; no bars |
| DIG | Yes | false | null | No | No | Inactive; no bars |
| DXG | Yes | false | null | No | No | Inactive; no bars |
| CEO | Yes | true | 2026-05-26 | Yes | Yes | Fresh/aligned |
| KBC | Yes | false | null | No | No | Inactive; no bars |
| NVL | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| HPG | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| FPT | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| MWG | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| VHM | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| VRE | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| VIC | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| CTG | Yes | true | 2026-05-26 | Yes | Yes | Fresh/aligned |
| BID | Yes | true | 2026-05-26 | Yes | Yes | Fresh/aligned |
| TCB | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| MBB | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |
| VPB | Yes | false | 2026-05-04 | No | No | Inactive; stale 16 sessions |

Conclusion: important liquid names are mixed. Some are active/fresh (CTG, BID, CEO), many are inactive and stale/no-bar.

---

## 4) Import universe trace

### What symbols are fetched/imported?

- `fetch_stock_bars.py` reads symbols from:
  1) `--symbols-file`,
  2) else `data/active-symbol-keys.json`,
  3) else `data/vn-symbols-seed.json` fallback.
- Production workflow explicitly passes exported active symbols file.

### Does import use `stock_symbols.active=true`?

Yes. Production workflow uses `scripts/export-active-symbol-keys.ts`, which exports only active symbols.

### Does scan use same universe?

Yes (core): scanner loads `StockSymbol` with `active=true` as core scan universe, then merges tactical active symbols.

### Are inactive symbols intentionally excluded?

Operationally yes. This is current expected behavior by design of active-universe curation.

### Tactical mechanism for temporary symbols?

Yes, tactical universe exists and is merged into effective scan universe if active and non-expired.

### Is `vn-symbols-seed.json` stale?

Not the main blocker in this audit. Symbols exist in `stock_symbols`; the key issue is **active flag + import universe scope**, not seed-file existence.

---

## 5) Root cause classification

| Issue | Root Cause | Severity | Fix Type |
|---|---|---|---|
| VND/PDR bars stop at 2026-05-04 | Inactive symbols excluded from ongoing production import + scan universe | High | IMPORT_UNIVERSE_GAP |
| Many liquid names also stale at 2026-05-04 | Same as above; broad inactive cluster | High | ACTIVE_FLAG_COVERAGE |
| Many symbols have no bars | Inactive and never fetched/imported under current active-only fetch flow | Medium | ACTIVE_FLAG_COVERAGE |
| Active universe still has some stale rows | Upstream provider/fetch coverage noise for some active names | Medium | FETCH_FAILURE |
| Scanner missing these names | Scanner behaving as configured (active + tactical only) | Expected | SCANNER_EXPECTED_BEHAVIOR |

---

## Is VND/PDR isolated?

No. They are part of a broader important-symbol coverage gap.

---

## Recommended strategy options

- **Option A — Activate only VND/PDR:** too narrow; does not fix broader missing-liquidity names.
- **Option B — Curate active universe list:** **recommended baseline**. Promote a broader set of liquid/relevant names, not only VND/PDR.
- **Option C — Add tactical watch universe:** useful complement for temporary opportunity intake without destabilizing core active set.
- **Option D — Expand import beyond active set:** higher cost/noise; optional later, not first move.
- **Option E — No change:** not recommended given breadth of high-liquidity stale exclusions.

### Recommended option: **B + C**

1. **B:** Curate active universe to include key liquid leaders/sectors.
2. **C:** Use tactical universe for short-lived opportunity overlays.

This addresses both structural coverage and tactical agility.

---

## Direct answer: why VND/PDR stopped at 2026-05-04

Because they are `active=false`, and production import/scan workflows are driven by active universe. They were not refreshed after earlier historical bars existed.

---

## Artifacts

- Audit report JSON: `reports/market-coverage-gap-audit.json`
- Script (read-only): `scripts/market-coverage-gap-audit.ts`

