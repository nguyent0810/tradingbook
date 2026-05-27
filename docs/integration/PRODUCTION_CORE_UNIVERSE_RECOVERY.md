# Production Core Universe Recovery (May 2026)

**Slice:** Smart Large Slice — Curated Core Activation + Production Bar Recovery  
**Executed:** 2026-05-27 (UTC)  
**Prerequisite:** `1c82403` — import/scanner effective universe alignment merged to `main`

---

## Activation set

Bounded **activate-only** set (17 symbols). Does not deactivate existing actives.

### Tier 1 (mandated audit leaders)

`VND, PDR, SSI, HPG, FPT, MWG, VHM, VIC, TCB, MBB, VPB, VRE, NVL`

### Tier 2 (supplemental high-liquidity stale cluster)

`SHB, VCB, STB, MSN`

### Explicitly excluded from this slice

- `BCG` — extreme staleness (164 sessions)
- `BCR`, `BGE` — lower liquidity vs tier targets
- `HCM`, `VCI`, `DIG`, `DXG` — no bars; need seed/import path before activation

Source file: `data/core-universe-recovery-activation.json`  
Apply script: `scripts/apply-core-universe-activation.ts` (requires `APPLY_CORE_UNIVERSE_ACTIVATION=1`)

---

## Universe counts

| Metric | Before | After activation | After import + scan |
|--------|-------:|-----------------:|--------------------:|
| Active core (`stock_symbols.active=true`) | 189 | **206** (+17) | 206 |
| Effective universe (core ∪ tactical) | 189 | 206 | 206 |
| Import export count (`effectiveExported`) | 189 | — | **206** |
| Scan `symbolCountTotal` | 189 | — | **206** |
| Scan `symbolCountAfterTradability` | 37 | — | **54** |
| Scan `candidateCountSurfaced` | 0 | — | **0** |

---

## Commands run

### 1) Dry-run activation impact

```bash
SMOKE_DATABASE=production npx tsx scripts/apply-core-universe-activation.ts
```

Artifact: `reports/core-activation-dryrun.json`

### 2) Apply bounded activation

```bash
SMOKE_DATABASE=production APPLY_CORE_UNIVERSE_ACTIVATION=1 \
  npx tsx scripts/apply-core-universe-activation.ts
```

Result: **17 rows** updated (`active: false` → `true` only).

### 3) Production bar import + scan (GitHub Actions)

```bash
gh workflow run "Production bar import" --ref main \
  -f trigger_scan=true -f skip_equity=false
```

- **Run:** https://github.com/nguyent0810/tradingbook/actions/runs/26487446554  
- **Conclusion:** `success` (~19 min)  
- Pipeline: VNINDEX fetch/import → effective universe export (206 symbols) → equity fetch/import → post health → `/api/cron/daily-scan`

### 4) Post-recovery diagnostics

```bash
SMOKE_DATABASE=production npx tsx scripts/symbol-case-diagnostic.ts \
  VND PDR SSI HPG FPT MWG VHM VIC TCB MBB VPB

SMOKE_DATABASE=production npx tsx scripts/market-coverage-gap-audit.ts \
  --json-out reports/market-coverage-gap-audit-post-recovery.json
```

---

## Bar freshness (VND / PDR)

| Symbol | Before latest bar | After latest bar | Session aligned |
|--------|-------------------|------------------|-----------------|
| VND | 2026-05-04 (inactive) | **2026-05-27** | Yes |
| PDR | 2026-05-04 (inactive) | **2026-05-27** | Yes |

Both are now `active=true`, `includedInImport=true`, `includedInScan=true`, tradability **passed**.

---

## Scan result (post-import)

| Field | Value |
|-------|-------|
| Scan run ID | `cmpnh6y98000004l4euheytfb` |
| `runAt` | 2026-05-27T02:59:28.364Z |
| Status | completed (via cron after successful import) |
| `symbolCountTotal` | 206 |
| `symbolCountAfterTradability` | 54 |
| `candidateCountSurfaced` | 0 |
| Gate1 | WARNING (VNINDEX momentum falling; still scanned) |

---

## VND / PDR diagnostics (scanner rules vs coverage)

| Symbol | Active | Latest bar | Import | Scan | Tradable | Gate2 | Momentum eligible | Setup candidate |
|--------|--------|------------|--------|------|----------|-------|-------------------|-----------------|
| VND | true | 2026-05-27 | yes | yes | yes | INVALID — pullback box interaction | no | no |
| PDR | true | 2026-05-27 | yes | yes | yes | INVALID — breakout recency | **yes** (fresh-breakout lane) | no |

**Conclusion:** Coverage/import gap is **resolved** for VND/PDR. Absence from Best Setups is now **Gate2 playbook rules**, not stale bars or universe exclusion. PDR may appear in Momentum Watch-style fresh-breakout surfaces when that lane is enabled in the app; VND is blocked by pullback-zone / failed-breakout risk labels.

---

## Priority majors (post-recovery snapshot)

| Symbol | Latest bar | Tradable | Gate2 terminal (summary) | Momentum eligible |
|--------|------------|----------|--------------------------|-------------------|
| SSI | 2026-05-27 | yes | breakout recency | no |
| HPG | 2026-05-27 | yes | breakout recency | no |
| FPT | 2026-05-27 | yes | below MA50 | no |
| MWG | 2026-05-27 | yes | below MA50 | no |
| VHM | 2026-05-27 | yes | breakout recency | no |
| VIC | 2026-05-27 | yes | breakout recency | no |
| TCB | 2026-05-27 | yes | breakout recency | no |
| MBB | 2026-05-27 | yes | (see diagnostic) | no |
| VPB | 2026-05-27 | yes | (see diagnostic) | no |

Full JSON: `reports/post-recovery-symbol-diagnostic.txt`, `reports/market-coverage-gap-audit-post-recovery.json`

---

## Remaining gaps

- **75** active symbols still have stale bars (pre-existing actives not in this activation batch).
- **1182** symbols remain inactive with no bars.
- **0** Gate2 candidates surfaced on latest scan — market/regime + playbook filters, not import failure.
- No-bar names (`HCM`, `VCI`, …) require a separate seed/first-fetch slice if desired.

---

## Rollback plan

1. **Deactivate recovery batch only** (does not touch other actives):

   ```sql
   UPDATE stock_symbols SET active = false
   WHERE symbol IN (
     'VND','PDR','SSI','HPG','FPT','MWG','VHM','VIC','TCB','MBB','VPB','VRE','NVL',
     'SHB','VCB','STB','MSN'
   );
   ```

   Or add a small rollback script mirroring `apply-core-universe-activation.ts` with `APPLY_CORE_UNIVERSE_ROLLBACK=1`.

2. **Revert code** only if universe merge logic must be undone (not required for flag rollback).

3. Bars already imported remain in DB (upserts are additive); rollback flags stop future fetch/scan only.

---

## Related docs

- `docs/integration/MARKET_COVERAGE_GAP_AUDIT.md` — pre-recovery audit
- `docs/integration/MARKET_UNIVERSE_COVERAGE_STRATEGY.md` — core + tactical strategy
- `docs/integration/PRODUCTION_BAR_IMPORT_AUTOMATION.md` — GHA import pipeline
