# Tier A-only additive activation (dry-run / pilot plan)

**Status:** Dry-run tooling prepared — **not activated**, **not pushed**, no scan run.

Safe first activation step for 300-symbol expansion: activate only **23 Tier A** liquid, session-aligned names. Tier B (71) and full +94 remain **NO-GO** for activation.

## Scope

| Item | Value |
|------|--------|
| Activation file | `data/expansion-300-tier-a-activation.json` |
| Tier A symbols | **23** |
| Baseline actives (unchanged) | **206** |
| Projected actives after apply | **229** |
| Tier B / tail | **not included** |

## Dry-run (read-only)

```bash
SMOKE_DATABASE=production npx tsx scripts/dry-run-tier-a-additive-activation.ts
```

Report: `reports/tier-a-activation/dry-run-report.json`

### Validation checklist

- [ ] All 23 Tier A symbols `active=false`
- [ ] All 23 latest bar = expected session (`2026-06-05`)
- [ ] All 206 baseline symbols remain `active=true`
- [ ] Projected active count = **229**
- [ ] No duplicates, no baseline/additive overlap
- [ ] No Tier B symbols in activation set

## Apply (after human approval only)

```bash
APPLY_TIER_A_ADDITIVE_ACTIVATION=1 SMOKE_DATABASE=production \
  npx tsx scripts/apply-tier-a-additive-activation.ts
```

- Sets `active=true` only for inactive Tier A symbols in the activation file
- **No deactivation path** — baseline and all other rows untouched

## Rollback (deactivate Tier A only)

Dry-run:

```bash
SMOKE_DATABASE=production npx tsx scripts/rollback-tier-a-additive-activation.ts
```

Apply:

```bash
APPLY_TIER_A_ROLLBACK=1 SMOKE_DATABASE=production \
  npx tsx scripts/rollback-tier-a-additive-activation.ts
```

Report: `reports/tier-a-activation/rollback-dry-run.json`

## Post-activation validation (run after apply, not before)

```bash
# 1. Active export should list 229 symbols
SMOKE_DATABASE=production npx tsx scripts/export-active-symbol-keys.ts

# 2. Stale-only bar import health (no full-universe regression)
SMOKE_DATABASE=production npx tsx scripts/list-stale-fetch-targets.ts

# 3. Scan pilot — expect ~229 symbols scanned (no Gate 2/rankScore changes)
SMOKE_DATABASE=production npx tsx scripts/run-daily-scanner.ts

# 4. Market context row coverage
SMOKE_DATABASE=production npm run ops:verify-market-context
```

## Explicitly NO-GO

- Full +94 activation (57/94 session-aligned)
- Tier B activation (34/71 aligned)
- Batch B1 / wholesale `curate-active-symbols --apply`
- Scanner / Gate 2 / rankScore changes
- Production GHA workflow changes without separate review

## GO / NO-GO for Tier A activation

### GO when dry-run reports `goNoGo.readyForActivation: true`

All of:

- 23/23 Tier A inactive and session-aligned
- 206/206 baseline still active
- Projected count 229
- No overlap / no Tier B leakage

### NO-GO if

- Any Tier A symbol not aligned to latest session
- Any baseline symbol deactivated or missing
- Active count drift from 206 before apply
- Operator has not reviewed dry-run report
