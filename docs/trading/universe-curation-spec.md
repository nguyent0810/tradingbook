# Universe curation spec (Batch B — production-safe activation)

**Status:** Planning / dry-run only until explicit production `--apply` approval.  
**Deferred:** Batch B1 production `--apply` (206→168 shrink) until Batch D stale-only fetch is merged and validated.  
**Tool:** `scripts/curate-active-symbols.ts` (default dry-run; persist with `--apply` only).

## Goals

- Expand daily scan universe by **data quality and liquidity**, not alphabetical ramp.
- Maximize **latest-session bar alignment** with VNINDEX `IndexDailyBar` session.
- Keep provider fetch and scan workloads predictable.

## Activation rules (recommended)

| Rule | Flag / constant | Purpose |
|------|-----------------|--------|
| Latest-session bar | `--require-latest-bar` | `max(StockDailyBar.date)` must equal expected VNINDEX session (UTC day). |
| Minimum history | `--min-bars=120` | Matches `TRADABILITY_MIN_BARS` (scanner needs ≥120 trading days). |
| Liquidity ranking | `--sort=liquidity20d` | Select top N by mean volume of last 20 daily bars; tie-break alphabetical. |
| Optional core tier | `--require-tradability` | Only symbols passing scanner tradability (volume, value, price, gaps, session). |
| Target size | `--target=N` | Cap active universe (e.g. 300). If fewer eligible, activate all eligible. |

## Exclusions (implicit)

- Symbols with **no bars** or **&lt; min-bars** rows in DB.
- Symbols whose **latest bar is before** expected session when `--require-latest-bar` is set.
- **Suspended / illiquid** names (via tradability when `--require-tradability` is used).
- Do **not** use `seed-stock-symbols.ts --ramp-target=N` alone for production scale-up (alphabetical bias).

## Tiers (operational model)

| Tier | Suggested flags | Typical size | Fetch priority |
|------|-----------------|--------------|----------------|
| **Core tradable** | `--require-tradability --require-latest-bar --min-bars=120 --sort=liquidity20d` | ~50–80 on prod (estimate via dry-run) | Daily full stale-only pass |
| **Extended scan** | `--require-latest-bar --min-bars=120 --sort=liquidity20d` | 300 (or max eligible) | Daily stale-only |
| **Watchlist / research** | Manual or tactical table | Outside core fetch | Weekly or on-demand |

## Production workflow (read-only vs apply)

```bash
# Dry-run (no writes) — production
SMOKE_DATABASE=production npx tsx scripts/curate-active-symbols.ts \
  --target=300 --require-latest-bar --min-bars=120 --sort=liquidity20d

# Apply (requires separate approval; sets StockSymbol.active + active-symbol-keys.json)
SMOKE_DATABASE=production npx tsx scripts/curate-active-symbols.ts \
  --target=300 --require-latest-bar --min-bars=120 --sort=liquidity20d --apply
```

## Verification after apply

```bash
npx tsx scripts/report-bar-coverage.ts
npx tsx scripts/report-symbol-universe-quality.ts
npx tsx scripts/verify-bar-import-health.ts --json
```

## Rollback

- Re-export previous `data/active-symbol-keys.json` from git or backup.
- `updateMany` deactivate new symbols / re-activate known-good list (`apply-core-universe-activation.ts` is additive-only; prefer `curate-active-symbols` for full replace).

## Related

- `docs/trading/scan-coverage-expansion-plan.md`
- `scripts/market-coverage-gap-audit.ts` (read-only gap reasons on production)
