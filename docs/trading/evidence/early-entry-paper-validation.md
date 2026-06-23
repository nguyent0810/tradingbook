# Early Entry Paper Validation

Generated: 2026-06-23T02:35:47.755Z

## Status

**Research lane only** — `EARLY_ENTRY_V1_ENABLED` defaults off. Not decision support.

Pilot Candidate is **not** buy-ready. Use **EXTENDED_DO_NOT_CHASE** only as a cautionary anti-FOMO warning.

## Weekly operating routine

1. **After each market session** — `npm run audit:early-entry:paper-log` (idempotent; skips duplicates).
2. **Weekly** — `npm run audit:early-entry:paper-validate` to resolve partial/full horizons.
3. **Review** — `npm run audit:early-entry:paper-summary` for open counts and acceptance gates.
4. Read open vs resolved live signals in this report.
5. **Do not** enable staging or trade from Pilot Candidate until live acceptance gates pass.

## Safety summary (live paper)

| Metric | Value |
|--------|-------|
| Open signals (all) | 0 |
| Open live signals | 0 |
| EXTENDED 5d avoidance (live) | — (0 live EXTENDED) |
| Any variant staging-ready | no |

## Historical seed summary

### Historical seed cohort

| Metric | Count |
|--------|-------|
| Total signals | 144 |
| Baseline pilots | 14 |
| Open | 0 |
| Partial (5d/10d only) | 0 |
| Fully resolved (20d) | 144 |
| EXTENDED_DO_NOT_CHASE | 79 |
| EXTENDED 5d avoidance rate | 58% |

#### Variant leaderboard — historical seed only

| Variant | Pilots | Resolved | Partial | Open | False% 10d | Avg 10d | Med 10d | Staging ready? |
|---------|--------|----------|---------|------|------------|---------|---------|----------------|
| baseline | 14 | 14 | 0 | 0 | 71% | -3.32% | -2.52% | ❌ no |
| rr_min_2_5 | 6 | 6 | 0 | 0 | 100% | -7.58% | -5.07% | ❌ no |
| demote_weak_regime | 4 | 4 | 0 | 0 | 75% | -4.95% | -6.30% | ❌ no |
| rr_min_2_5_plus_demote_weak_regime | 2 | 2 | 0 | 0 | 100% | -7.88% | -7.88% | ❌ no |
| next_day_confirmation_candidate | 4 | 4 | 0 | 0 | 50% | 2.63% | 0.56% | ❌ no |
| two_day_follow_through | 3 | 3 | 0 | 0 | 33% | 4.67% | 3.94% | ❌ no |

## Live paper summary

### Live forward paper

| Metric | Count |
|--------|-------|
| Total signals | 0 |
| Baseline pilots | 0 |
| Open | 0 |
| Partial (5d/10d only) | 0 |
| Fully resolved (20d) | 0 |
| EXTENDED_DO_NOT_CHASE | 0 |
| EXTENDED 5d avoidance rate | — |

#### Variant leaderboard — live paper only

| Variant | Pilots | Resolved | Partial | Open | False% 10d | Avg 10d | Med 10d | Staging ready? |
|---------|--------|----------|---------|------|------------|---------|---------|----------------|
| baseline | 0 | 0 | 0 | 0 | — | — | — | ❌ no |
| rr_min_2_5 | 0 | 0 | 0 | 0 | — | — | — | ❌ no |
| demote_weak_regime | 0 | 0 | 0 | 0 | — | — | — | ❌ no |
| rr_min_2_5_plus_demote_weak_regime | 0 | 0 | 0 | 0 | — | — | — | ❌ no |
| next_day_confirmation_candidate | 0 | 0 | 0 | 0 | — | — | — | ❌ no |
| two_day_follow_through | 0 | 0 | 0 | 0 | — | — | — | ❌ no |

## Combined view (historical + live)

_Combined metrics are for context only. **Staging acceptance gates apply to live paper only.**_

### Combined

| Metric | Count |
|--------|-------|
| Total signals | 144 |
| Baseline pilots | 14 |
| Open | 0 |
| Partial (5d/10d only) | 0 |
| Fully resolved (20d) | 144 |
| EXTENDED_DO_NOT_CHASE | 79 |
| EXTENDED 5d avoidance rate | 58% |

#### Variant leaderboard — combined (not for staging)

| Variant | Pilots | Resolved | Partial | Open | False% 10d | Avg 10d | Med 10d | Staging ready? |
|---------|--------|----------|---------|------|------------|---------|---------|----------------|
| baseline | 14 | 14 | 0 | 0 | 71% | -3.32% | -2.52% | ❌ no |
| rr_min_2_5 | 6 | 6 | 0 | 0 | 100% | -7.58% | -5.07% | ❌ no |
| demote_weak_regime | 4 | 4 | 0 | 0 | 75% | -4.95% | -6.30% | ❌ no |
| rr_min_2_5_plus_demote_weak_regime | 2 | 2 | 0 | 0 | 100% | -7.88% | -7.88% | ❌ no |
| next_day_confirmation_candidate | 4 | 4 | 0 | 0 | 50% | 2.63% | 0.56% | ❌ no |
| two_day_follow_through | 3 | 3 | 0 | 0 | 33% | 4.67% | 3.94% | ❌ no |

## Open live signals

### Awaiting forward data

_None._

## Resolved live signals

### Fully resolved (20 sessions)

_None._

## Acceptance gates (staging enablement)

Do **not** recommend staging unless **all** pass on **live paper** resolved pilots:

- ≥20 live resolved pilot-qualified signals per variant under review
- False pilot rate ≤ 35%
- Median 10d or 20d return > 0
- Average R multiple > 0
- No single outlier explains most gains
- ≥2 market regimes represented (or explicit regime filter required)

## EXTENDED_DO_NOT_CHASE (all sources)

- Total: **79** · With 5d outcome: **79**
- Correctly avoided bad 5d: **46** / 79 (58%)

**Keep EXTENDED_DO_NOT_CHASE prominent** — strongest useful defensive signal in research.

## Open signals (all sources)

_None._

## Current recommendation

1. **Do not enable** staging decision support.
2. **Keep Pilot Candidate** as research-only UI label.
3. **Run paper-log daily** after each session; **paper-validate weekly**.
4. Live resolved pilots (baseline): **0** (need 20 for staging).
5. **EXTENDED_DO_NOT_CHASE** remains the most useful defensive signal.