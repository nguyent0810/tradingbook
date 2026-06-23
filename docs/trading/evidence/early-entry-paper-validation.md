# Early Entry Paper Validation

Generated: 2026-06-23

## Status

**Research lane only** — `EARLY_ENTRY_V1_ENABLED` defaults off. Not decision support.

## How to run

```bash
npm run audit:early-entry:paper-log          # log latest session
npm run audit:early-entry:paper-log -- --seed-historical  # backfill cohort
npm run audit:early-entry:paper-validate     # resolve outcomes + refresh report
```

## Signal inventory

| Metric | Count |
|--------|-------|
| Total logged | 144 |
| Open (awaiting 20d) | 0 |
| Resolved | 144 |

## Per-state summary (resolved)

### Watch (n=49)
- Avg 10d: 1.28% · Median 10d: 1.29% · Win rate: 55.10%

### Extended — Do Not Chase (n=79)
- Avg 10d: -0.80% · Median 10d: -2.15% · Win rate: 37.97%

### Pilot Candidate (n=14)
- Avg 10d: -3.32% · Median 10d: -2.52% · Win rate: 28.57%

### Add Zone (n=2)
- Avg 10d: -8.15% · Median 10d: -8.15% · Win rate: 0.00%

## Calibration variant leaderboard

| Variant | Pilots | Resolved | Win% 10d | False% | Avg 10d | Med 10d | Ready? |
|---------|--------|----------|----------|--------|---------|---------|--------|
| baseline | 14 | 14 | 28.57% | 71.43% | -3.32% | -2.52% | ❌ no |
| rr_min_2_5 | 6 | 6 | 0.00% | 100.00% | -7.58% | -5.07% | ❌ no |
| demote_weak_regime | 4 | 4 | 25.00% | 75.00% | -4.95% | -6.30% | ❌ no |
| rr_min_2_5_plus_demote_weak_regime | 2 | 2 | 0.00% | 100.00% | -7.88% | -7.88% | ❌ no |
| next_day_confirmation_candidate | 4 | 4 | 50.00% | 50.00% | 2.63% | 0.56% | ❌ no |
| two_day_follow_through | 3 | 3 | 66.67% | 33.33% | 4.67% | 3.94% | ❌ no |

## EXTENDED_DO_NOT_CHASE defensive validation

- Total signals: **79**
- Resolved: **79**
- Correctly avoided bad 5d (price down): **46** / 79

### Examples — correctly avoided chase

- **ACM** 2025-02-14 — 5d -12.50%, 10d -12.50%
- **ACS** 2025-06-24 — 5d -5.88%, 10d -13.24%
- **AME** 2025-08-12 — 5d -1.10%, 10d -2.20%
- **AME** 2025-08-19 — 5d -1.11%, 10d -1.11%
- **ACM** 2025-09-19 — 5d -14.29%, 10d -14.29%

### Examples — possibly too conservative (5d > +3%)

- **AMV** 2025-02-21 — 5d 26.32%, 10d 10.53%
- **AGM** 2025-06-06 — 5d 14.29%, 10d 17.86%
- **AGM** 2025-07-11 — 5d 3.12%, 10d 3.12%
- **AME** 2025-07-25 — 5d 5.06%, 10d 15.19%
- **AME** 2025-08-01 — 5d 9.64%, 10d 8.43%

## Open signals (awaiting outcome)

_None — all logged signals resolved._

## Closed signals (sample)

| Date | Symbol | State | 5d | 10d | 20d | MAE | MFE | R |
|------|--------|-------|----|-----|-----|-----|-----|---|
| 2024-10-10 | AMV | Watch | -4.55% | -4.55% | -31.82% | -9.09% | 4.55% | 0.33 |
| 2025-01-03 | ACM | Extended — Do Not Chase | 0.00% | -12.50% | -25.00% | -25.00% | 12.50% | 0.33 |
| 2025-02-14 | ACM | Extended — Do Not Chase | -12.50% | -12.50% | -12.50% | -37.50% | 12.50% | 0.33 |
| 2025-02-21 | AMV | Extended — Do Not Chase | 26.32% | 10.53% | -5.26% | 0.00% | 47.37% | 1.75 |
| 2025-04-10 | AGM | Pilot Candidate | -29.05% | -22.38% | 33.33% | -33.81% | 6.67% | 0.50 |
| 2025-06-06 | AGM | Extended — Do Not Chase | 14.29% | 17.86% | 17.86% | 0.00% | 35.71% | 0.77 |
| 2025-06-24 | ACS | Extended — Do Not Chase | -5.88% | -13.24% | -4.41% | -13.24% | 0.00% | 0.00 |
| 2025-07-11 | AGM | Extended — Do Not Chase | 3.12% | 3.12% | -12.50% | -3.13% | 18.75% | 0.39 |
| 2025-07-25 | AME | Extended — Do Not Chase | 5.06% | 15.19% | 12.66% | -5.06% | 15.19% | 0.50 |
| 2025-08-01 | AME | Extended — Do Not Chase | 9.64% | 8.43% | 7.23% | -1.20% | 12.05% | 0.40 |
| 2025-08-12 | AME | Extended — Do Not Chase | -1.10% | -2.20% | -2.20% | -14.29% | 2.20% | 0.07 |
| 2025-08-15 | AGM | Extended — Do Not Chase | 0.00% | 0.00% | -33.33% | -6.06% | 30.30% | 1.13 |
| 2025-08-19 | AME | Extended — Do Not Chase | -1.11% | -1.11% | 0.00% | -13.33% | 1.11% | 0.04 |
| 2025-09-19 | A32 | Pilot Candidate | -5.41% | -1.61% | -9.19% | -5.41% | 0.00% | 0.00 |
| 2025-09-19 | ACM | Extended — Do Not Chase | -14.29% | -14.29% | 0.00% | -28.57% | 0.00% | 0.00 |
| 2025-09-19 | AGM | Extended — Do Not Chase | 0.00% | -15.15% | -30.30% | -24.24% | 30.30% | 1.17 |
| 2025-09-29 | ALT | Extended — Do Not Chase | 3.12% | 5.47% | 1.56% | -8.59% | 17.19% | 1.72 |
| 2025-10-06 | ALT | Extended — Do Not Chase | 2.27% | -12.12% | -7.58% | -12.88% | 13.64% | 1.07 |
| 2025-10-15 | AIC | Watch | -3.77% | -5.66% | -5.66% | -10.38% | 0.00% | 0.00 |
| 2025-10-23 | ALT | Extended — Do Not Chase | -14.07% | -3.70% | -5.19% | -15.56% | 0.00% | 0.00 |
| 2025-11-04 | AMC | Watch | 9.68% | 12.90% | 8.87% | 0.00% | 15.08% | 2.51 |
| 2025-11-05 | ALT | Watch | 12.07% | 5.17% | 11.21% | -1.72% | 16.38% | 1.56 |
| 2025-11-11 | AMC | Extended — Do Not Chase | 2.94% | 0.00% | 0.74% | -4.93% | 4.93% | 0.38 |
| 2025-11-17 | ACS | Watch | -10.64% | -12.77% | -10.64% | -17.02% | 0.00% | 0.00 |
| 2025-11-18 | AGX | Pilot Candidate | -11.25% | -2.81% | -5.63% | -11.25% | 1.19% | 0.12 |

## Current recommendation

1. **Do not enable** for staging decision support.
2. **Keep Pilot Candidate** as research-only UI label.
3. **Continue paper logging** until ≥20 resolved pilots per variant.
4. Baseline resolved pilots: **14** (need 20).
5. **EXTENDED_DO_NOT_CHASE** remains the most useful defensive signal — keep prominent in UI.

### Blockers

- Need ≥20 resolved pilots (have 14)
- False pilot rate 71% exceeds 35%
- Median 10d return not positive
- Results appear driven by a single outlier