# GEX / GEE — Breakout-recency retrospective

Generated (UTC): `2026-05-07T04:40:33.792Z`

## Methodology

- **Diagnostic only**: replay uses existing `evaluateTradability` + `evaluateBreakoutPullbackCandidate` unchanged.
- **Walk-forward**: for each session `t`, only bars with date ≤ `t` are visible; `expectedLatestSession` is set to `t`.
- **Window**: last **40** sessions per symbol (from latest stored daily bar backward).
- **`passedBreakoutRecencyGate`**: true iff evaluator appended a line beginning with `Fresh breakout:` (found a qualifying breakout bar `j` in `[t−10, t−1]` vs prior 20-day range high).

## Direct answers

### GEX

- **Ever Tier A or B in window?** No.
- **Ever pass breakout-recency (fresh breakout detected)?** Yes.
  - First session in window with recency pass: **2026-04-13**.
  - When recency passed but Gate2 stayed **INVALID**, terminal categories (session counts):
    - `breakout_not_holding`: 3
    - `pullback_zone_interaction`: 8

**Latest session in replay (most recent bar)**

| Field | Value |
| --- | --- |
| date | 2026-05-06 |
| close | 29.35 |
| volume | 14267291 |
| ma20 | 27.44 |
| ma50 | 25.79 |
| tradability | PASS |
| Gate2 | INVALID |
| passedBreakoutRecencyGate | false |
| terminalCategory | breakout_recency |
| terminalReason (trimmed) | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| distanceToPullbackZoneFrac | null |
| riskToStopFrac | null |
| stageRank | 25 |

**Interpretation (latest move vs template):** The core playbook expects a **fresh** close-through of the **prior 20-day range high** on one of the **10 bars before today**, then **digestion**, then **pullback-zone interaction** under caps. If price is strong on **MA structure** but stuck in `breakout_recency`, the move is usually **not** a missed Tier-A/B signal under current definitions — it is **trend / continuation without that specific breakout trigger**, or an **older impulse** outside the recency window.

### GEE

- **Ever Tier A or B in window?** No.
- **Ever pass breakout-recency (fresh breakout detected)?** Yes.
  - First session in window with recency pass: **2026-04-08**.
  - When recency passed but Gate2 stayed **INVALID**, terminal categories (session counts):
    - `breakout_not_holding`: 1
    - `pullback_zone_interaction`: 5

**Latest session in replay (most recent bar)**

| Field | Value |
| --- | --- |
| date | 2026-05-06 |
| close | 114.2 |
| volume | 1902872 |
| ma20 | 107.43 |
| ma50 | 100.71 |
| tradability | PASS |
| Gate2 | INVALID |
| passedBreakoutRecencyGate | false |
| terminalCategory | breakout_recency |
| terminalReason (trimmed) | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| distanceToPullbackZoneFrac | null |
| riskToStopFrac | null |
| stageRank | 25 |

**Interpretation (latest move vs template):** The core playbook expects a **fresh** close-through of the **prior 20-day range high** on one of the **10 bars before today**, then **digestion**, then **pullback-zone interaction** under caps. If price is strong on **MA structure** but stuck in `breakout_recency`, the move is usually **not** a missed Tier-A/B signal under current definitions — it is **trend / continuation without that specific breakout trigger**, or an **older impulse** outside the recency window.

## Consolidated Q&A

- **Did either symbol ever become Tier A or B in the last 40 sessions?** **No** — neither GEX nor GEE cleared the full Gate2 ladder to A/B in this window.
- **Did either symbol ever pass breakout-recency (`Fresh breakout:`)?** **Yes** — both did on multiple days inside this 40-session replay window (see tables).
- **If recency passed, what later gate blocked setups?** Aggregate INVALID **after** recency cleared: **`pullback_zone_interaction`** (price never interacted with the pullback box on those days) and **`breakout_not_holding`** (closes back under the anchored resistance). See per-symbol counts above.
- **Why does the detector often say “no breakout” on the latest bars?** The rule only accepts a breakout session **`j` in `[L−10, L−1]`** with **`close[j] >` prior 20-day range high before `j`**. After older impulses roll off that 10-session window, continued upside reads as **grind / continuation** without a **fresh** qualifying close-through — hence **`breakout_recency`** even when trend (MA20/MA50) looks strong.
- **How to label the current move vs playbook?** Best fit: **extended momentum after an older breakout episode**, combined with **no valid low-risk pullback-and-zone interaction** under current caps on recent bars — **not** “scanner missed an obvious fresh breakout today,” because **today’s bar is excluded from breakout detection** and the last decisive structural pushes are **outside the recency window**.

## Session-by-session detail (full window)

Columns: date, close, vol, ma20, ma50, trad_ok, G2, pass_recency?, category, stageRank, dist_zone, r_stop, breakout, zone_lo, zone_hi, terminal (trimmed).

### GEX (160 bars total in DB; replay tail 40)

| date | close | vol | ma20 | ma50 | trad | G2 | rec? | category | rank | dz | rStop | brk | zLo | zHi | terminal |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-03-09 | 22.86 | 3178513 | 25.31 | 27.03 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (27.03 vs close 22.86). Wait or skip. |
| 2026-03-10 | 21.93 | 14587445 | 25.12 | 26.89 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (26.89 vs close 21.93). Wait or skip. |
| 2026-03-11 | 23.45 | 5870608 | 25.01 | 26.74 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (26.74 vs close 23.45). Wait or skip. |
| 2026-03-12 | 23.69 | 7090828 | 24.94 | 26.60 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (26.60 vs close 23.69). Wait or skip. |
| 2026-03-13 | 23.28 | 5820785 | 24.92 | 26.46 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (26.46 vs close 23.28). Wait or skip. |
| 2026-03-16 | 22.97 | 3282712 | 24.93 | 26.33 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (26.33 vs close 22.97). Wait or skip. |
| 2026-03-17 | 24.07 | 6221675 | 24.98 | 26.22 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (26.22 vs close 24.07). Wait or skip. |
| 2026-03-18 | 24.14 | 5199478 | 24.95 | 26.10 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (26.10 vs close 24.14). Wait or skip. |
| 2026-03-19 | 23.45 | 4247552 | 24.91 | 25.96 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.96 vs close 23.45). Wait or skip. |
| 2026-03-20 | 23.83 | 5676857 | 24.80 | 25.83 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.83 vs close 23.83). Wait or skip. |
| 2026-03-23 | 22.17 | 11032267 | 24.52 | 25.71 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.71 vs close 22.17). Wait or skip. |
| 2026-03-24 | 23.17 | 5548496 | 24.29 | 25.59 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.59 vs close 23.17). Wait or skip. |
| 2026-03-25 | 24.55 | 14241502 | 24.18 | 25.50 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.50 vs close 24.55). Wait or skip. |
| 2026-03-26 | 24.42 | 4374829 | 24.03 | 25.41 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.41 vs close 24.42). Wait or skip. |
| 2026-03-27 | 24.79 | 7329651 | 23.91 | 25.36 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.36 vs close 24.79). Wait or skip. |
| 2026-03-30 | 25.04 | 8264994 | 23.86 | 25.31 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.31 vs close 25.04). Wait or skip. |
| 2026-03-31 | 25.52 | 8772863 | 23.84 | 25.22 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-01 | 25.55 | 8822642 | 23.91 | 25.16 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-02 | 24.93 | 6626284 | 23.92 | 25.08 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.08 vs close 24.93). Wait or skip. |
| 2026-04-03 | 24.35 | 5281928 | 23.91 | 25.00 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (25.00 vs close 24.35). Wait or skip. |
| 2026-04-06 | 25.11 | 6793415 | 24.02 | 24.93 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-07 | 25.28 | 3183297 | 24.19 | 24.87 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-08 | 27.04 | 14578059 | 24.37 | 24.87 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-09 | 27.93 | 15789333 | 24.58 | 24.88 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-10 | 27.66 | 9123798 | 24.80 | 24.89 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-13 | 28.66 | 14977274 | 25.08 | 24.96 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (25.59–26.11)—no actionable entry location yet. |
| 2026-04-14 | 28.31 | 8414485 | 25.30 | 25.02 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (25.59–26.11)—no actionable entry location yet. |
| 2026-04-15 | 27.59 | 9647368 | 25.47 | 25.08 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (25.59–26.11)—no actionable entry location yet. |
| 2026-04-16 | 27.59 | 8265795 | 25.67 | 25.12 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (25.67–26.11)—no actionable entry location yet. |
| 2026-04-17 | 26.90 | 6596553 | 25.83 | 25.16 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (25.83–26.11)—no actionable entry location yet. |
| 2026-04-20 | 28.24 | 11175351 | 26.13 | 25.24 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (26.13–26.11)—no actionable entry location yet. |
| 2026-04-21 | 27.79 | 5715925 | 26.36 | 25.28 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (26.36–26.11)—no actionable entry location yet. |
| 2026-04-22 | 28.24 | 8917367 | 26.55 | 25.33 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (26.55–26.11)—no actionable entry location yet. |
| 2026-04-23 | 27.28 | 14016241 | 26.69 | 25.37 | Y | INVALID | Y | breakout_not_holding | 38 | — | — | — | — | — | Setup failed—session closed back under resistance 27.04; former breakout not holding. |
| 2026-04-24 | 27.45 | 5807706 | 26.82 | 25.45 | Y | INVALID | Y | breakout_not_holding | 38 | — | — | — | — | — | Setup failed—session closed back under resistance 28.48; former breakout not holding. |
| 2026-04-28 | 26.90 | 5911537 | 26.92 | 25.53 | Y | INVALID | Y | breakout_not_holding | 38 | — | — | — | — | — | Setup failed—session closed back under resistance 28.48; former breakout not holding. |
| 2026-04-29 | 26.97 | 7068695 | 26.99 | 25.61 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-05-04 | 27.11 | 9236980 | 27.07 | 25.66 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-05-05 | 27.45 | 8968535 | 27.19 | 25.72 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-05-06 | 29.35 | 14267291 | 27.44 | 25.79 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |

### GEE (160 bars total in DB; replay tail 40)

| date | close | vol | ma20 | ma50 | trad | G2 | rec? | category | rank | dz | rStop | brk | zLo | zHi | terminal |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-03-09 | 85.60 | 217774 | 96.81 | 109.47 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (109.47 vs close 85.60). Wait or skip. |
| 2026-03-10 | 80.36 | 484685 | 95.68 | 109.00 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (109.00 vs close 80.36). Wait or skip. |
| 2026-03-11 | 85.94 | 895525 | 94.86 | 108.50 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (108.50 vs close 85.94). Wait or skip. |
| 2026-03-12 | 86.16 | 488799 | 94.24 | 107.99 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (107.99 vs close 86.16). Wait or skip. |
| 2026-03-13 | 83.01 | 389317 | 93.75 | 107.30 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (107.30 vs close 83.01). Wait or skip. |
| 2026-03-16 | 81.60 | 373939 | 93.43 | 106.58 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (106.58 vs close 81.60). Wait or skip. |
| 2026-03-17 | 87.29 | 1181693 | 93.29 | 105.89 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (105.89 vs close 87.29). Wait or skip. |
| 2026-03-18 | 93.36 | 2029962 | 93.26 | 105.16 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (105.16 vs close 93.36). Wait or skip. |
| 2026-03-19 | 94.85 | 736020 | 93.36 | 104.35 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (104.35 vs close 94.85). Wait or skip. |
| 2026-03-20 | 90.85 | 611790 | 92.94 | 103.40 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (103.40 vs close 90.85). Wait or skip. |
| 2026-03-23 | 84.68 | 788090 | 91.92 | 102.52 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (102.52 vs close 84.68). Wait or skip. |
| 2026-03-24 | 88.85 | 734684 | 91.33 | 101.69 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (101.69 vs close 88.85). Wait or skip. |
| 2026-03-25 | 92.80 | 963015 | 91.22 | 101.00 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (101.00 vs close 92.80). Wait or skip. |
| 2026-03-26 | 96.57 | 1160222 | 90.98 | 100.55 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (100.55 vs close 96.57). Wait or skip. |
| 2026-03-27 | 98.62 | 868987 | 90.62 | 100.21 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (100.21 vs close 98.62). Wait or skip. |
| 2026-03-30 | 105.48 | 1867796 | 90.61 | 99.96 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-03-31 | 112.85 | 2046091 | 91.30 | 99.77 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-01 | 118.28 | 2131334 | 92.60 | 99.78 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-02 | 119.02 | 1304489 | 93.91 | 99.64 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-03 | 111.02 | 832234 | 94.86 | 99.29 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-06 | 113.14 | 986213 | 96.24 | 98.97 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-07 | 107.42 | 755292 | 97.59 | 98.69 | Y | INVALID | N | trend_ma20_below_ma50 | 18 | — | — | — | — | — | Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries. |
| 2026-04-08 | 114.68 | 1043073 | 99.03 | 98.72 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (104.79–106.93)—no actionable entry location yet. |
| 2026-04-09 | 111.71 | 514547 | 100.30 | 98.65 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (104.79–106.93)—no actionable entry location yet. |
| 2026-04-10 | 111.94 | 602650 | 101.75 | 98.61 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (104.79–106.93)—no actionable entry location yet. |
| 2026-04-13 | 112.74 | 770005 | 103.31 | 98.71 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (104.79–106.93)—no actionable entry location yet. |
| 2026-04-14 | 111.42 | 471457 | 104.51 | 98.74 | Y | INVALID | Y | pullback_zone_interaction | 58 | — | — | — | — | — | Current bar does not interact with the pullback box (104.79–106.93)—no actionable entry location yet. |
| 2026-04-15 | 111.14 | 731096 | 105.40 | 98.89 | Y | INVALID | Y | breakout_not_holding | 38 | — | — | — | — | — | Setup failed—session closed back under resistance 112.85; former breakout not holding. |
| 2026-04-16 | 106.91 | 658904 | 106.01 | 98.94 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-04-17 | 102.57 | 582262 | 106.59 | 98.95 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-04-20 | 109.71 | 1546473 | 107.84 | 99.22 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-04-21 | 107.42 | 785330 | 108.77 | 99.31 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-04-22 | 104.22 | 766177 | 109.34 | 99.35 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-04-23 | 101.65 | 1112420 | 109.60 | 99.41 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-04-24 | 100.00 | 401357 | 109.67 | 99.56 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-04-28 | 101.14 | 608894 | 109.45 | 99.82 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-04-29 | 99.94 | 388674 | 108.80 | 100.02 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (100.02 vs close 99.94). Wait or skip. |
| 2026-05-04 | 99.88 | 771235 | 107.88 | 100.13 | Y | INVALID | N | trend_below_ma50 | 15 | — | — | — | — | — | Trend not supportive for long swings—price finished below its 50-day average (100.13 vs close 99.88). Wait or skip. |
| 2026-05-05 | 106.80 | 1555653 | 107.27 | 100.41 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |
| 2026-05-06 | 114.20 | 1902872 | 107.43 | 100.71 | Y | INVALID | N | breakout_recency | 25 | — | — | — | — | — | No qualifying breakout in the last 10 sessions—need a fresh push above the prior 20-day range high (excluding today). |

## Recommendation (operations / research, not rule edits)

- **Keep core scanner unchanged** unless business promotes a second template: recency **did** clear on multiple historical days, but **later gates** (`pullback_zone_interaction`, `breakout_not_holding`, etc.) prevented Tier A/B — the ladder is **behaving as coded**.
- **Add a Secondary Fresh Breakout audit lane** (offline only): study continuation names where **MA trend is constructive** but **`breakout_recency`** fires because the impulse is **older than 10 bars** — compare alternate anchors **without** promoting anything into core Tier A/B until reviewed.
- **Expand tactical watch reporting** for deepest INVALID stage after recency (dominant `terminalCategory`) and for **recency-fail + trend-OK** profiles.
- **Adjust breakout_recency diagnostics** only as **documentation / telemetry labels** (clearer reason text, breakdown counts) — still **no logic change** unless approved.

---

Regenerate: `npx tsx scripts/gex-gee-breakout-retrospective.ts --sessions=40 --prod-local` (loads `.env.prod.local` when flagged; never log secrets).
