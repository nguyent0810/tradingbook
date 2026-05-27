# Post-Recovery Scanner Interpretation — VND / PDR & Dashboard Readiness

**Slice:** Smart Large Slice — Post-Recovery Scanner Interpretation  
**Mode:** Read-only analysis (no threshold changes, no production writes)  
**Probed at:** 2026-05-27 (production DB)  
**Reference scan:** `cmpnh6y98000004l4euheytfb` (`2026-05-27T02:59:28Z`)

---

## Executive summary

Coverage recovery **succeeded**: VND and PDR are active, session-aligned on **2026-05-27**, tradable, and included in import/scan.

**Best Setups is empty for the right reasons:**

1. **Gate2 breakout-pullback** found **0 Tier A / 0 Tier B** among **54** tradable symbols.
2. **Gate1 WARNING** would suppress Tier B even if any existed (only Tier A may surface).
3. Rejections are dominated by **trend structure** and **breakout timing**, not stale data.

**VND** is a **near-miss** (deep Gate2 pipeline, fails pullback-box interaction while extended above the zone).  
**PDR** is **Momentum Watch–eligible** (fresh close above 20-day high) but **cannot** be a Best Setup because Gate2 requires a **prior-session** breakout in the last 10 bars—a different rule than the momentum audit.

**Product:** Keep Gate2 strict; **do not** loosen thresholds now. Ship **Momentum Watch** + **near-miss / rejection** surfaces (already partially implemented server-side).

**Dashboard Command Center v1:** **Ready to proceed** on FE—the data layer is fresh; empty Best Setups must be explained via near-miss + momentum, not hidden.

---

## A. VND deep trace

**Session:** 2026-05-27 · **Close:** 17.95 (thousand VND) · **Volume:** 3,466,700 · **Vol ratio (20d):** 0.26×

| Gate | Rule | VND value | Pass/Fail | Notes |
|------|------|-----------|-----------|-------|
| Universe | Active core ∪ tactical | `active=true`, in effective universe | **Pass** | Post-recovery activation |
| Data freshness | Latest bar = VNINDEX session | 2026-05-27 | **Pass** | Was 2026-05-04 pre-recovery |
| Tradability | Volume, value, gap, history, stale session | All checks clear | **Pass** | `tradability.passed=true` |
| Gate1 (regime) | VNINDEX playbook | **WARNING** | **Pass (scan runs)** | Bullish vs MA50; last 3 closes falling |
| Gate2 — session | Latest bar date = expected session | 2026-05-27 | **Pass** | |
| Gate2 — trend | Close ≥ MA50 | Above MA50 | **Pass** | `aboveMa50=true` in momentum metrics |
| Gate2 — trend | MA20 ≥ MA50 | Supportive intermediate trend | **Pass** | Implied by pipeline depth (failed later, not at trend stage) |
| Gate2 — breakout recency | Close > prior 20d **range high** on a bar in last **10** sessions (excl. today) | Breakout found in window | **Pass** | 4 reason lines before terminal → passed recency + digestion |
| Gate2 — digestion | Post-breakout dip below breakout-day close | Observed | **Pass** | |
| Gate2 — hold | No close back under breakout level since breakout | Holding | **Pass** | |
| Gate2 — pullback box | Today’s bar must interact with zone **floor–ceiling** | Close **17.95**; box **17.10–17.45** | **Fail** | `lastBar.low > pullbackZoneHigh` (price **above** box—no entry location) |
| Gate2 — volume (if reached) | Today vol ≥ **1.2×** 20d median | **0.26×** | **Fail** (not reached) | Terminal failure is earlier (zone) |
| Gate2 quality | Tier A / B | **INVALID** | **Fail** | Terminal: `pullback_zone_interaction` |
| Gate1 × surfacing | WARNING → Tier A only | No Tier A | **Fail** | `wouldSurfaceAtScanTime=false` |
| Momentum audit | `FRESH_BREAKOUT` / inclusion filter | Label: **FAILED_BREAKOUT_RISK** | **Fail** | Prior session lost hold above breakout ref.; group **AVOID_RISK** |
| Momentum UI row | `shouldIncludeFreshBreakoutRow` + not AVOID | — | **Fail** | `momentumWatchIncluded=false` |
| Setup candidate | Persisted Gate2 A/B | — | **No** | `inLatestScanCandidate=null` |

**Pullback zone (from terminal reason):** low **17.10**, high **17.45** (ceiling = breakout level).  
**Extension:** Close **17.95** is ~**2.9%** above box ceiling—price is **chasing above** the pullback box, not interacting with it.

**Near-miss rank:** VND is **#4** in `closestToValidSymbols` for scan `cmpnh6y98000004l4euheytfb` (`partialPipelineScore` 5804, stage 58).

**Why VND still does not qualify for Best Setups:** The breakout-pullback template requires an **entry inside/near the pullback box** after digestion. VND is **too high** relative to the box today.

**Why VND is not on Momentum Watch:** Momentum lane flagged **failed breakout risk** (recent close back under breakout reference), not a clean **FRESH_BREAKOUT** watch row.

---

## B. PDR deep trace

**Session:** 2026-05-27 · **Close:** 17.05 (thousand VND) · **Volume:** 5,369,500 · **Vol ratio (20d):** 0.47×

| Gate | Rule | PDR value | Pass/Fail | Notes |
|------|------|-----------|-----------|-------|
| Universe / freshness / tradability | Same as VND | Active, 2026-05-27, tradable | **Pass** | |
| Gate1 | Regime | WARNING | **Pass (scan runs)** | |
| Gate2 — breakout recency | Prior session close > 20d range high within last **10** bars | **None found** | **Fail** | Terminal: `breakout_recency` |
| Gate2 — pullback template | (not reached) | — | **Fail** | Stops at recency |
| Gate2 quality | Tier A / B | **INVALID** | **Fail** | |
| Momentum — prior 20d high | Today’s close > max close of prior 20 sessions | **Yes** | **Pass** | `closeAbovePriorNDayHigh=true` |
| Momentum — label | `FRESH_BREAKOUT` | Present | **Pass** | Extension ~0.59% |
| Momentum — ignition | Vol ≥ 1.5× + MAs | Vol **0.47×** | **Fail** sub-tier | No `MOMENTUM_IGNITION` |
| Momentum — group | `determineFreshBreakoutGroup` | **ACTIONABLE_WATCH** | **Pass** | |
| Momentum UI | `shouldIncludeFreshBreakoutRow` (tradable, labels) | Included | **Pass** | `momentumWatchIncluded=true` |
| Setup candidate | Gate2 surfaced | — | **No** | Different pipeline |

**Critical distinction (PDR):**

| Concept | Definition | PDR |
|---------|------------|-----|
| **Momentum “fresh breakout”** | Today’s close vs **highest close** of prior 20 days | **Pass** |
| **Gate2 “fresh breakout”** | Some **earlier** session (last 10) must close above that day’s **20-day range high** | **Fail** |

PDR can **lift today** without having had the **prior-session impulse** Gate2 requires. That is why Momentum and Best Setups **diverge by design**.

**Why not Gate2 surfaced:** Fails at **breakout_recency** (stage 25)—listed in `rejectionSymbolsByCategory.breakout_recency` with HPG, SSI, VHM, etc.

---

## C. Best Setups empty explanation (scan `cmpnh6y98000004l4euheytfb`)

| Metric | Value |
|--------|------:|
| Total symbols scanned | **206** |
| Tradable after Gate0 | **54** |
| Gate1 level | **WARNING** |
| Gate2 Tier A (pre–Gate1 filter) | **0** |
| Gate2 Tier B (pre–Gate1 filter) | **0** |
| Surfaced candidates | **0** |
| Tier B suppressed by Gate1 | **N/A** (0 B existed; WARNING would block B anyway) |
| Daily decision | **NO_TRADE** — “Market is mixed and no Tier A setup is available.” |
| Equity max bar date | **2026-05-27** (aligned with VNINDEX) |
| Benchmark backdrop delayed | **false** |

### Top rejection buckets (tradable symbols only)

| Bucket | Count | % of tradable |
|--------|------:|----------------:|
| `trend_below_ma50` | 26 | 48% |
| `breakout_recency` | 15 | 28% |
| `trend_ma20_below_ma50` | 5 | 9% |
| `breakout_not_holding` | 4 | 7% |
| `pullback_zone_interaction` | 4 | 7% |

**Likely bottleneck (persisted):** `trend_ma` (combined MA structure)—**not** data freshness.

### Near misses (closest to valid)

| Symbol | Terminal category | Preview |
|--------|-------------------|---------|
| C69 | pullback_zone_interaction | Above pullback box |
| CTR | pullback_zone_interaction | Above pullback box |
| VCB | pullback_zone_interaction | Above pullback box |
| **VND** | pullback_zone_interaction | Above box **17.10–17.45** |
| BID | breakout_not_holding | Closed back under resistance |

**PDR** is **not** a near-miss for Gate2—it fails earlier (recency). It belongs on **Momentum Watch**, not near-miss pullback ladder.

### Smoke guardrail

Production smoke symbols (`P0DEXIT`, etc.) are excluded from **import export** only. They did **not** cause this empty scan (0/206 smoke in universe).

### Data freshness

**Acceptable.** VNINDEX and equity max = **2026-05-27**; VND/PDR session-aligned. Empty Best Setups is **not** a coverage artifact.

---

## D. Product recommendation

**Recommended: Option 2 + Option 1 (combined)—not Option 3.**

| Option | Verdict |
|--------|---------|
| **1. Better rejection / near-miss UI** | **Yes** — VND-like names already in `closestToValidSymbols`; cockpit supports `near_miss` mode. |
| **2. Separate Momentum / Volume Explosion Watch** | **Yes** — PDR-like names; `getMomentumWatchRowsForPhase1` + `momentum-watch-section` exist. |
| **3. Loosen Gate2 thresholds** | **No (now)** — would mix chase/noise into Best Setups; market already yields 0 A/B on fresh data. |
| **4. New “Breakout Ignition” setup type** | **Later** — only if Momentum Watch proves insufficient after UX trial. |
| **5. No change** | **Partial** — behavior is **correct** for Gate2, but **insufficient UX** without momentum + near-miss. |

### What Dashboard Command Center v1 should show

| Surface | Content |
|---------|---------|
| **Best Setups** | Empty state with Gate1 WARNING + “0 Tier A” + link to near-miss / setups |
| **Momentum Watch** | PDR and peers with `ACTIONABLE_WATCH` + disclaimer (“not a validated setup”) |
| **Near misses / rejection reasons** | VND, VCB, C69, CTR with pullback-zone “wait for interaction” copy |
| **Data freshness** | Green / OK — session **2026-05-27**, import recovery complete |

---

## Dashboard FE readiness

| Criterion | Status |
|-----------|--------|
| Fresh bars for priority symbols | **Ready** |
| Scanner pipeline running on full universe | **Ready** |
| Server DTOs for cockpit + near-miss | **Ready** (`decision-cockpit-dto`, scan notes parse) |
| Momentum Watch loader | **Ready** (`momentum-watch.ts`) |
| Empty Best Setups explainable | **Ready** (with near-miss + momentum panels) |
| Blocker for FE start | **None** (interpretation complete) |

**Proceed with Dashboard Command Center v1** in the **dirty UI worktree** only after explicit FE slice approval—this doc does not start UI work.

---

## Artifacts (local, not committed)

- `reports/vnd-pdr-diag.json` — `symbol-case-diagnostic` output  
- `reports/scan-run-cmpnh6y98.json` — scan notes dump  
- `reports/post-recovery-symbol-diagnostic.txt` — extended priority-major run  

---

## Related docs

- `docs/integration/PRODUCTION_CORE_UNIVERSE_RECOVERY.md`  
- `docs/integration/MARKET_COVERAGE_GAP_AUDIT.md`  
- `docs/design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md`  
- `docs/integration/DASHBOARD_FE_REBUILD_PLAN.md`
