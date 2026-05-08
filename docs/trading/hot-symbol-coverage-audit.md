# Hot Symbol Coverage Audit (production)

Generated: 2026-05-07

Scope: audit manually supplied hot symbols against production universe/data/tradability/Gate2 pipeline to separate **coverage issues** from **scanner-template mismatch**.

Symbols audited in this pass:
- GEX
- GEE

(Additional user-provided names can be appended in the same workflow.)

## Production session baseline

- Expected latest session (from VNINDEX index bars): `2026-05-06`
- Scanner rules unchanged.
- No symbol activation changes.
- No setup candidates created by this audit.

## Symbol-level coverage and stage audit

### GEX

- Exists in `stock_symbols`: **yes**
- Active: **no**
- Has `stock_daily_bar`: **no**
- Bar count: **0**
- Latest bar date: **null**
- Latest close: **null**
- Latest-session aligned: **no**
- avgVolume20: **null**
- avgValue20(VND): **null**
- Price floor pass: **fail** (no price)
- Tradability: **fail** (`Insufficient history: need >= 120 daily bars`)
- Gate2: **NOT_EVALUATED**
- Seeded-source coverage: **present** (`data/vn-symbols-seed.json`)

Classification (inactive):
- no bars
- stale/no latest bar

Interpretation:
- This is a **coverage/data gap** first (no bars), not a Gate2 logic rejection.

### GEE

- Exists in `stock_symbols`: **yes**
- Active: **no**
- Has `stock_daily_bar`: **no**
- Bar count: **0**
- Latest bar date: **null**
- Latest close: **null**
- Latest-session aligned: **no**
- avgVolume20: **null**
- avgValue20(VND): **null**
- Price floor pass: **fail** (no price)
- Tradability: **fail** (`Insufficient history: need >= 120 daily bars`)
- Gate2: **NOT_EVALUATED**
- Seeded-source coverage: **present** (`data/vn-symbols-seed.json`)

Classification (inactive):
- no bars
- stale/no latest bar

Interpretation:
- This is a **coverage/data gap** first (no bars), not a Gate2 logic rejection.

## Summary table

| symbol | coverage status | active | tradability | Gate2 result | blocked by | interpretation |
|---|---|---:|---|---|---|---|
| GEX | `no_stock_bars` | false | fail | `NOT_EVALUATED` | no bars; stale/no latest bar | Missing bars prevents scanner evaluation |
| GEE | `no_stock_bars` | false | fail | `NOT_EVALUATED` | no bars; stale/no latest bar | Missing bars prevents scanner evaluation |

## What this says about "missed breakouts"

For GEX/GEE specifically in current production state:

- The miss is currently **not** caused by Gate2 template strictness.
- The miss is caused earlier by **universe/data coverage**:
  - symbol is inactive,
  - there are zero stock daily bars,
  - tradability and Gate2 therefore cannot run.

So for these names, fix order is:
1. ensure symbols are included in fetch batches,
2. import bars,
3. curate active universe,
4. then re-evaluate whether scanner rules or template mismatch is the blocker.

## Recommendation

1. **First priority: improve hot-symbol coverage**
   - include GEX/GEE in next bar-fetch batches,
   - import bars,
   - re-run curation dry-run/apply.
2. **Do not change scanner rules yet**
   - these two symbols are blocked before Gate2.
3. **Only consider Secondary Fresh Breakout audit lane** after coverage is fixed
   - if hot symbols become active + tradable but still fail mainly due to breakout-pullback template constraints.

## Artifact

Machine-readable output saved (not auto-committed):
- `reports/hot-symbol-coverage-audit.json`

Contains all requested raw fields for audited symbols:
- existence/active/bars/latest-date/latest-close
- latest-session alignment
- avgVolume20 / avgValue20 / price-floor pass
- tradability pass + reasons
- Gate2 result + terminal category/reason + near-miss label + MA/pullback fields

## Next run (additional symbols)

If you send more breakout tickers, run the same audit with an expanded symbol list and append a second table in this doc.
