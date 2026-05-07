# Scanner rules vs current market audit (production)

Generated: 2026-05-07

Scope: document current scanner logic and compare with the current production market snapshot. No rule changes were made.

## 1) Pipeline, step-by-step

### Stage 0 — Universe selection

Source: `src/lib/scanner/run-daily-scan-job.ts`

1. Read active symbols from `stock_symbols` (`active=true`, sorted alphabetically).
2. Apply optional `SCAN_SYMBOL_LIMIT` (if env > 0, take first N alphabetically).
3. If `SCAN_SYMBOL_LIMIT` is unset/invalid, scan full active set.

### Stage 1 — Session alignment precondition

Source: `src/lib/scanner/expected-session.ts`

- Expected session date is **latest VNINDEX `index_daily_bar.date`**.
- If VNINDEX is missing, scan run is persisted as FAILED with `FAILED_NO_INDEX_SESSION` path.

### Stage 2 — Tradability filter

Sources:
- `src/lib/scanner/tradability.ts`
- `src/lib/scanner/tradability-constants.ts`

For each active symbol:

1. Load all `stock_daily_bar` rows (date asc).
2. Dedupe by UTC day, then evaluate:
   - `min bars >= 120`
   - `avg volume (last 20 bars) >= 100,000`
   - `avg traded value (last 20 bars) >= 2,000,000,000 VND`
   - `latest close >= 10,000 VND`
   - `latest bar date == expected VNINDEX session`
   - no consecutive calendar gap > 21 days
3. Only `passed=true` symbols continue to Gate 2.

### Stage 3 — Gate 1 market regime

Sources:
- `src/lib/playbook/get-market-regime.ts`
- `src/lib/playbook/gate1-market.ts`

Regime from VNINDEX bars:

- Need >= 50 index bars for MA50.
- Trend = close vs MA50.
- Momentum = strict 3-close sequence.

Mapping:
- `PASS`: bullish trend AND momentum up
- `FAIL`: bearish trend AND momentum down
- `WARNING`: all other cases

### Stage 4 — Gate 2 setup evaluation (breakout-pullback template)

Sources:
- `src/lib/scanner/gate2/breakout-pullback.ts`
- `src/lib/scanner/gate2/constants.ts`

Per tradable symbol:

1. Need >= 50 bars and latest date aligned to expected session.
2. Trend gates:
   - close >= MA50
   - MA20 >= MA50
3. Breakout recency:
   - find breakout in last 10 bars (`GATE2_BREAKOUT_RECENCY_BARS`)
   - breakout = close above prior 20-bar range high (`GATE2_RANGE_DAYS`)
4. Digestion/hold structure:
   - must dip below breakout-day close at least once
   - no close below breakout level after breakout
   - no mid-pullback close below MA50
   - if breakout-day low is swept and current close < MA20 => invalid
   - reject two consecutive closes under pullback zone floor
5. Pullback box interaction:
   - zone high = breakout level
   - zone low = max(breakout*(1-0.02), MA20)
   - current bar must interact with zone
6. Participation:
   - volume ratio vs median prior 20 bars >= 1.2 (`B` minimum)
7. Extension/depth/risk:
   - extension above breakout <= 5%
   - pullback depth below breakout <= 4%
   - stop = minLowSinceBreakout * (1 - 1%)
   - risk-to-stop >= 0.3%

Quality:
- `A` if vol ratio >= 1.5 and close >= MA20
- `B` if valid but weaker than A
- otherwise `INVALID`

### Stage 5 — Surfacing + persistence

Source: `src/lib/scanner/run-daily-scan-job.ts`

- Gate 2 counts (`A/B`) are computed before regime surfacing.
- Surfacing rules:
  - Gate1 FAIL: surface none
  - Gate1 WARNING: surface only A
  - Gate1 PASS: surface A and B
- Persisted to `daily_scan_runs` and `setup_candidates`.

### Stage 6 — Decision label

Source: `src/lib/scanner/trading-decision.ts`

Why Gate1 PASS can still be `NO_TRADE`:
- PASS only says market backdrop is supportive.
- If Gate2 has no valid A/B setups, decision is still `NO_TRADE` with explanation: market supportive but no valid setup.

## 2) Exact thresholds / rules map

- Tradability min bars: **120**
- Tradability latest-session requirement: **must equal latest VNINDEX session date**
- Tradability price floor: **10,000 VND**
- Tradability 20D volume floor: **100,000 shares**
- Tradability 20D value floor: **2,000,000,000 VND**
- Tradability max calendar gap: **21 days**

- Gate2 MA requirements: **close >= MA50** and **MA20 >= MA50**
- Breakout window: **within last 10 bars**, above prior **20-bar** range high
- Pullback box: high=breakout, low=max(breakout*(1-2%), MA20)
- Current bar must interact with pullback box
- Extension cap: **<= 5%** above breakout
- Pullback depth cap: **<= 4%** below breakout
- Stop buffer: **1%** under min low since breakout
- Minimum risk-to-stop fraction: **>= 0.3%**
- Volume ratio floor: **>=1.2x** (B), **>=1.5x** (A)

## 3) Latest production scan funnel (run `cmouwkvcz000004l27gp99kwd`)

Source: latest `daily_scan_run` and notes.

| Funnel step | Count |
|---|---:|
| Active universe start | 189 |
| Fresh/session-aligned bars among active | 189 |
| Pass tradability | 36 |
| Fail tradability | 153 |
| Gate2 INVALID | 36 |
| Gate2 A | 0 |
| Gate2 B | 0 |
| Surfaced | 0 |
| setupCandidatesCreated | 0 |

Tradability fail reasons (counts):
- 20D avg value below floor: 145
- 20D avg volume below floor: 134
- latest close < 10k VND: 57
- calendar gap >21d: 13

Gate2 terminal buckets (INVALID=36):
- trend_below_ma50: 26
- breakout_not_holding: 3
- breakout_recency: 3
- trend_ma20_below_ma50: 3
- pullback_zone_interaction: 1

## 4) Candidate-level audit artifact

Machine-readable export generated at:
- `reports/scanner-candidate-audit.json`

Rows include for each active symbol:
- symbol
- latest close/date
- tradability pass + reasons
- gate2 result (`A/B/INVALID/NOT_EVALUATED`)
- terminal category/reason
- MA20/MA50 + MA relationship
- breakout/pullback/stop fields
- distance to pullback zone
- risk-to-stop fraction
- stage rank
- near-miss diagnostic label

Snapshot summary from the artifact:
- active rows: 189
- `NOT_EVALUATED` (failed tradability): 153
- `INVALID`: 36
- `A`: 0
- `B`: 0

## 5) Manual market comparison checks

Checked symbols: VNINDEX, GEX, and closest-to-valid set (`ACB`, `BAF`, `AGR`, `ANV`).

### VNINDEX
- Data exists in `index_daily_bar`.
- Latest session aligned.
- Not a stock symbol candidate; used for session alignment + Gate1 regime only.

### GEX
- Exists in `stock_symbols` but currently `active=false`.
- `stock_daily_bar` count = 0 in this prod snapshot.
- Fails tradability (insufficient history), so Gate2 not evaluated.

### ACB
- Active, latest bar aligned, tradability pass.
- Gate2 fail: **below MA50 trend gate**.

### BAF
- Active, aligned, tradability pass.
- Gate2 fail: **no qualifying breakout in last 10 bars**.

### AGR
- Active, aligned, tradability pass.
- Gate2 fail: **below MA50**.

### ANV
- Active, aligned, tradability pass.
- Gate2 fail: **below MA50**.

## 6) Interpretation of current algorithm behavior

- The scanner is explicitly a **breakout-pullback entry** template, not a fresh-breakout momentum-chase template.
- It favors conditions where:
  - trend is already supportive,
  - a recent breakout happened,
  - a controlled pullback/digestion formed,
  - current bar is in/near pullback box,
  - liquidity and risk structure are acceptable.
- It intentionally misses:
  - early momentum bursts without pullback,
  - fresh breakouts outside the allowed recency/zone interaction template,
  - thin/low-value names even if chart looks attractive.

Current market-vs-template reading from latest scan:
- Gate1 PASS indicates broad market backdrop is supportive.
- But most tradable names fail at Gate2 trend gate or recency/structure checks.
- This is a **template mismatch** for many symbols right now (supportive market, but limited breakout-pullback entries at evaluation bar).

Primary bottlenecks in this snapshot:
1. **Tradability liquidity/value filters** remove most active symbols before Gate2.
2. For tradable names, **trend gate (MA-based)** is largest Gate2 blocker.
3. Secondary blockers: breakout recency and breakout-hold structure.

## 7) Recommendations (no implementation yet)

1. **Keep current core scanner unchanged** as the canonical breakout-pullback engine.
2. Add a **separate audit lane** (not replacing current lane) for “fresh breakout momentum” diagnostics to explain misses without diluting current setup definition.
3. Add/read clearer diagnostics labels in UI/reporting for:
   - “Breakout but no pullback yet”
   - “Trend pass failed (below MA50)”
   - “Tradability fail (value/volume)”
4. Continue universe curation + bar import quality work (already improved from 48 to 189 active), since tradability attrition remains very high.
5. If tuning is considered later, investigate one threshold at a time with before/after audit evidence (starting from highest-impact blocker for the intended playbook).

## Appendix — notes on NO_TRADE under PASS

`Gate1 PASS` means regime is supportive, not that entries exist now.
`NO_TRADE` with PASS is expected when `candidateCountA=0` and `candidateCountB=0`.
