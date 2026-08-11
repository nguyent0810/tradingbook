# Trading App — Data Remediation & POC Plan

**Date:** 2026-08-07 · **Branch:** `main` @ `b4da734` · **Baseline:** [OPENBB_FEASIBILITY_AUDIT.md](OPENBB_FEASIBILITY_AUDIT.md) accepted — **OpenBB is not being integrated.**
**Status:** Plan only. No production code modified. Nothing committed or deployed.
**Review:** Two independent reviews completed — an adversarial subagent review and a Codex CLI review. Material findings resolved (§8).

**Evidence legend:** **[VERIFIED]** ran in this session · **[CODE]** read in this repo · **[ESTIMATED]** derived, stated uncertainty · **[UNVERIFIED]** could not test, flagged.

---

## 0. What changed since the OpenBB audit

The adversarial review overturned two of my earlier conclusions and surfaced one defect I had missed entirely. Stating these up front because they change what you should do this week.

| # | Prior position | Corrected position |
|---|---|---|
| 1 | "No corporate-action adjustment → false breakouts" | **Wrong.** vnstock/VCI prices *are* fully back-adjusted **[VERIFIED]**. There is no raw-price gap at splits |
| 2 | "Live scanner signals are unaffected" | **Wrong.** Live signals *are* affected — via frozen stored price levels, not lookback depth (§2.4) |
| 3 | — (missed) | **vnstock returns adjusted prices with RAW volume.** Independently replicated **[VERIFIED]**. This is the highest-value, lowest-cost fix in this document (§2.3) |

---

## 1. Data Licensing & Provenance

### 1.1 Source inventory

Every external source the app touches, verified against ingestion code.

| # | Source | Reached via | Used for | Provenance class |
|---|---|---|---|---|
| 1 | **Vietcap (VCI)** — `trading.vietcap.com.vn`, `iq.vietcap.com.vn` | `vnstock` 4.0.4 (Python) | VN-Index OHLCV, 281-symbol equity OHLCV, foreign flow, symbol listing | **Undocumented private broker API** |
| 2 | **vnstocks.com** (`vnai` 2.4.8) | transitive hard dep of vnstock | device registration, license verification, analytics | **Vendor telemetry / license enforcement** |
| 3 | **Neon** (`us-east-1`) | Prisma/`pg` | stores all of the above | Third-party US cloud |
| 4 | **Vercel** | hosting | serves derived analytics | Third-party US cloud |
| 5 | **GitHub Actions** | ingestion runner | executes 1 & 2 daily | Third-party CI |
| 6 | OpenAI / ZenMux | `llm-config.ts` | agent inference | **Opt-in, default OFF** **[CODE]** — no external calls today |
| 7 | *(audit only)* Yahoo via `yfinance` | my probes | corporate-action cross-check | **Removed in §7** |

### 1.2 The licensing chain — corrected

My OpenBB audit framed this as "buy a vnstock commercial licence." The adversarial review correctly identified that as too shallow. The actual chain:

```
HOSE / HNX / UPCOM          ← own & commercially license exchange EOD data
        ↓
Vietcap Securities (VCI)    ← licensed redistributor; serves its own clients via private APIs
        ↓
vnstock (3rd-party lib)     ← accesses those private APIs; does NOT own or sublicense the data
        ↓
This app (public, Neon US)  ← stores and serves derived analytics
```

**vnstock cannot grant rights it does not hold.** A paid vnstock "Insiders" membership raises API quota — it does not convey exchange data rights. **[ASSUMPTION — this is my reading of the chain, not legal advice; it needs counsel.]**

### 1.3 Constraints — confirmed facts

| Fact | Evidence |
|---|---|
| vnstock License = *"Custom: Personal, research, non-commercial; contact support@vnstocks.com for other use"*; classifier `License :: Other/Proprietary License` | **[VERIFIED]** `importlib.metadata` |
| vnstock free tier caps financial statements at **4 periods** — *"Phiên bản cộng đồng: Báo cáo tài chính được giới hạn tối đa 4 kỳ… Insiders Program"* | **[VERIFIED]** runtime banner |
| `vnai` ships license-enforcement + fingerprinting endpoints: `/auth/device-register`, `/license/verify`, `hq.vnstocks.com/analytics`, `/v1/user/profile/sync` | **[VERIFIED]** extracted from installed package |
| `requirements.txt` pins only `vnstock>=3.0`; `vnai` undeclared; reinstalled every CI run | **[VERIFIED]** + **[CODE]** `production-bar-import.yml:83` |
| App is public-facing: registration, login, Privacy Policy, ToS, TikTok domain verification | **[CODE]** |
| yfinance/Yahoo is *"intended for personal use only"* | **[VERIFIED]** README |

### 1.4 Risk register

| ID | Risk | Severity | Confirmed vs assumed |
|---|---|---|---|
| **L1** | Public deployment likely exceeds vnstock's non-commercial licence | 🔴 P0 | License text **confirmed**; "commercial" classification **assumed** |
| **L2** | Underlying exchange data is licensed by HOSE/HNX via Vietcap; no agreement exists at any level | 🔴 P0 | Chain **assumed**; needs counsel |
| **L3** | `vnai` gives the vendor active means to detect commercial use — "use quietly" is not viable | 🟠 P1 | Endpoints **confirmed**; enforcement behaviour **assumed** |
| **L4** | `vnai` transmits device fingerprints from CI to a Vietnamese third party, undisclosed in the app's Privacy Policy | 🟠 P1 | Endpoints **confirmed**; payload contents **[UNVERIFIED]** |
| **L5** | Unpinned `vnstock>=3.0` — a minor release could silently change adjustment semantics and rewrite 200 days of bars overnight | 🟠 P1 | **Confirmed** |
| **L6** | Storing VN exchange data in Neon `us-east-1` may constitute redistribution | 🟡 P2 | **Assumed** |
| **L7** | Derived analytics (Gate scores, RS) are lower risk than raw quotes, but `market_context_daily` stores near-raw VN-Index OHLC | 🟡 P2 | **Confirmed** storage; risk **assumed** |

### 1.5 Alternatives — for evaluation, no provider changes now

| Option | Type | Notes |
|---|---|---|
| Written permission from vnstocks.com | Fastest | Cheapest if granted; **does not resolve L2** |
| **SSI FastConnect** | Official broker API | Documented, licensed, VN-native. Strongest candidate |
| **DNSE / Entrade** | Official broker API | Free tier exists for account holders |
| **FiinPro / FiinTrade** | Commercial vendor | Best fundamentals + foreign/proprietary flow. Highest cost |
| **Vietstock / TCBS** | Commercial vendor | Mid-tier |
| Direct HOSE/HNX licence | Exchange | Definitive; heaviest process |

**Action now:** ① email `support@vnstocks.com` stating the deployment shape and asking what licence applies; ② request pricing from SSI FastConnect + FiinGroup; ③ have counsel review the §1.2 chain. **Do not swap any provider until the target licence is signed.**

---

## 2. Corporate Actions

### 2.1 Are stored prices adjusted or raw? — **Adjusted**

**[VERIFIED]** HPG 1.10 stock split, ex-date 2026-05-25. vnstock/VCI closes (kVND):

| 05-21 | 05-22 | **05-25** | 05-26 | 05-27 |
|---|---|---|---|---|
| 24.14 | 23.95 | **24.10** | 24.25 | 24.15 |

Continuous — no ~9% gap. **VCI back-adjusts.** My earlier "unadjusted → false breakouts" claim was wrong.

Two-year vnstock-vs-Yahoo ratio confirms it across *both* recent splits **[VERIFIED]**:

```
month     px_ratio   vol_ratio
2024-06     0.9820     0.7581   ← 1/(1.20 × 1.10)
2025-07     0.9821     0.9050   ← step at 2025-06-26 split (1.20)
2026-04     0.9821     0.9102
2026-05     1.0000     0.9104   ← step at 2026-05-11 CASH DIVIDEND
2026-06     1.0000     1.0000   ← step at 2026-05-25 split (1.10)
```

`px_ratio` is flat across both splits → vnstock is split-adjusted. The 0.982 → 1.000 step lands on the **cash dividend**, not the split → **vnstock adjusts for cash dividends too.** That widens the trigger set from "the few stocks that split" to "essentially every symbol, at least annually."

### 2.2 ⚠️ Do not use yfinance as a VN corporate-action source

The adversarial review found yfinance fabricates a **33% cliff for VCB on 2025-03-03**, nine sessions before the 1.495 bonus-issue ex-date it itself records (2025-03-12), while vnstock stays continuous and correct. yfinance was used in this audit *only* as a corporate-action detector, and it is removed in §7. **Do not adopt it for backfill or as an event calendar.**

### 2.3 🔴 **Adjusted prices + RAW volume** — the defect to fix first

From the table in §2.1: `vol_ratio` steps **exactly at each split by exactly the split factor** while `px_ratio` does not. Yahoo volume is split-adjusted; **vnstock volume is raw**. Therefore every `stock_daily_bars` row for a stock that has ever split holds **a price and a volume on inconsistent bases**.

Two live consequences, both independent of any fetch window:

**(a) Tradability floor understates traded value.**
`tradedValueVnd(close, volume) = close × 1000 × volume` **[CODE:** `price-units.ts:13`**]** = adjusted_close × raw_volume. For any bar predating a split, this understates true traded value by the split factor, measured against a hard `TRADABILITY_MIN_AVG_VALUE_VND_20 = 2_000_000_000` floor. **Borderline-liquidity symbols are silently dropped from the universe for ~20 sessions after every split.**

**(b) Gate 2 volume confirmation is inflated.**
Raw volume has a genuine step up at a split (more shares outstanding). For ~20 sessions afterward, the prior-20 median still sits on the smaller share base, so today/median is inflated by up to the split factor — against `GATE2_VOL_RATIO_A = 1.5` / `_B = 1.2`. **This manufactures Gate 2 volume passes.** Same exposure in `computeSymbolVolumeContext` **[CODE:** `compute-market-context.ts:88`**]** and the `VOLUME_FADE_RATIO = 0.7` watch-health check.

**Fix (small):** rebase volume onto the price basis at ingest — persist a `volume_basis_factor`, or divide raw volume by the cumulative adjustment factor so both columns share one basis. Add an ingest assertion that flags any day-over-day volume step matching a known action ratio.

### 2.4 🔴 Frozen stored levels vs a silently re-based series — **live, this week**

This replaces my earlier "live signals are unaffected."

**[CODE:** `persist-watch-health.ts:110`**]** `evaluateWatchHealth` is fed the **stored** `w.breakoutLevel`, `w.pullbackZoneLow`, `w.pullbackZoneHigh` together with **freshly re-adjusted** bars. When a corporate action lands, VCI re-bases the whole series overnight while the watch item's levels stay on the old basis. With `DEAD_SETUP_DISTANCE_PCT = 0.1` **[CODE:** `evaluate-watch-health.ts:21`**]**, **a routine 1.10 split alone is enough to false-flag every open watch item on that symbol the morning after the ex-date.**

The only price-sanity guard in the system cannot catch this: `detectTradePriceUnitMismatch` returns false unless `ratio >= 100` **[CODE:** `price-unit-guard.ts:22`**]** — built for 1000× kVND/VND errors, structurally blind to a 10% re-basing.

**Full set of frozen-level surfaces** **[CODE]**:

| Table | Frozen fields |
|---|---|
| `SetupWatchItem` | `breakoutLevel`, `pullbackZoneLow`, `pullbackZoneHigh` |
| `SetupCandidate` | `close`, `breakoutLevel`, `pullbackZoneLow/High`, `stopLevel` |
| `SymbolMarketContextDaily` | `close`, `volume`, `volMa20` — written daily, never recomputed → permanent step |
| `Trade` | `entryPrice`, `exitPrice`, `stopLoss`, `takeProfit`, `setupSnapshot` |
| `PaperPosition` / `PaperTrade` | `avgEntryKvnd`, `stopLossKvnd`, `takeProfitKvnd`, `highWaterMarkKvnd`, `trailingStopKvnd`, `entryKvnd`, `exitKvnd` |

**P&L impact is live.** `Trade.entryPrice` is a user-entered *raw traded* price; bars are adjusted. Any position held across an action carries a phantom P&L error equal to the adjustment factor, plus a wrong R-multiple and wrong stop/target distance. The Arena runs in production with a live monthly Shadow Allocation cron, so this reaches allocation decisions.

### 2.5 Mixed adjustment basis at the fetch-window edge

Mechanism, all steps **[CODE]**-verified:

- fetch window `--calendar-days 200` **[**`run-production-equity-fetch.sh:151`**]**
- upsert **updates** OHLCV on conflict **[**`import-stock-bars.ts:166-190`**]**
- no production pruning of `stock_daily_bars` → history accumulates
- stale-only fetch selects `missing_bars | stale_session` only

⇒ A bar for date `D` is last rewritten ≈ `D+200 days`. Any corporate action after that leaves it permanently on the old basis. For HPG's 2026-05-25 split the boundary is `2025-11-06`.

**Magnitude: [ESTIMATED], not verified.** Neon DNS is blocked from this sandbox, so I could not measure stored history depth. Committed artifacts (`reports/market-coverage-gap-audit.json` 2026-05-26: `equityBarCount: 58461`; `reports/phase-a-300-readiness-gap-audit.json` 2026-06-05: `60253`) show growth, but the universe also grew 189 → 206 in that window, which **confounds any per-symbol estimate**. The adversarial review's "~25 bars/symbol" figure inherits that confound; I am not repeating it as fact.

**Good news the review surfaced:** `StockDailyBar.updatedAt` **[CODE:** `schema.prisma:300`**]** already records the last rewrite, so the stale-basis boundary is **directly queryable** — one indexed query, no guesswork. This is POC step 1.

Read window is deeper than the write window: `TRADABILITY_BATCH_LOOKBACK_CALENDAR_DAYS = 300` **[CODE]** ≈ 205 sessions vs a 200-calendar-day ≈ 137-session write window → **~68 sessions of potentially stale-basis bars sit inside the live read window.** Deepest numeric lookback is `STRUCTURAL_LOOKBACK = 60` **[CODE:** `risk-reward.ts:37`**]**, clearing by only ~8 sessions. The repo's own planned "rerun diagnostics at lookback 120" **[CODE:** `gate2-evidence-readiness.ts:204`**]** needs ~170 sessions and **would cross the boundary.**

### 2.6 Impact summary

| Consumer | Impact | Severity |
|---|---|---|
| Watch-health / DEAD_SETUP | False dead-flags after every action (§2.4) | 🔴 live |
| Tradability value floor | Understated ~20 sessions post-split (§2.3a) | 🔴 live |
| Gate 2 volume confirmation | Inflated ~20 sessions post-split (§2.3b) | 🔴 live |
| Trade & Paper P&L, R-multiple | Phantom error across any action | 🔴 live |
| `SymbolMarketContextDaily` | Permanent step in stored series | 🟠 |
| MA20 / MA50 / breakout levels | Self-consistent within fresh window | 🟢 OK |
| RS ranking (20/50 sessions) | Inside fresh window | 🟢 OK |
| Backtests / lookback-120 diagnostics | Cross the boundary | 🟠 |
| Long charts | Visible step | 🟡 |

### 2.7 Canonical model & strategy

```prisma
model CorporateAction {
  id            String   @id @default(cuid())
  symbolId      String   @map("symbol_id")
  exDate        DateTime @db.Date @map("ex_date")
  type          CorporateActionType     // CASH_DIVIDEND | STOCK_DIVIDEND | SPLIT
                                        // | BONUS_ISSUE | RIGHTS_ISSUE | REVERSE_SPLIT
  ratio         Float?                  // share-ratio actions
  cashPerShare  Float?                  // VND, cash dividends
  rightsStrike  Float?                  // VND, rights issues
  priceFactor   Float                   // canonical multiplier applied to pre-ex prices
  volumeFactor  Float                   // share-count multiplier (fixes §2.3)
  source        String
  confirmedAt   DateTime?
  @@unique([symbolId, exDate, type])
}
```

Strategy — **store both bases, never one**:
1. Persist `raw_close` alongside adjusted, plus `adjustment_basis_version` per bar.
2. Compute `priceFactor` / `volumeFactor` per action. Rights issues use HOSE's `(P_cum + ratio × strike) / (1 + ratio)` reference-price formula, not a bare ratio.
3. **Re-base frozen levels** whenever an action lands: migrate `SetupWatchItem`, `SetupCandidate`, `Trade`, `PaperPosition` price fields, or store them basis-tagged and convert on read. **This is the §2.4 fix.**
4. Rebase volume onto the price basis (§2.3).
5. Add an ingest guard: any day-over-day price or volume step matching a known action ratio, without a matching `CorporateAction` row, fails the run.

**Corrections to the naive action list, from the review** — worth stating so they aren't re-litigated:
- **ESOP issuance and treasury buybacks get no HOSE reference-price adjustment** → they are share-count/per-share-metric concerns, *not* price-series risks.
- **Par value is fixed at 10,000 VND by law** for listed VN equities → drop it.
- **Rights issues at below-market strike are already handled upstream** by HOSE's reference-price formula and propagated by VCI → not a missing adjustment, just another non-round re-basing event feeding §2.3/§2.4.

### 2.8 Survivorship & identity

**[CODE]** zero handling for delisting, symbol change, or exchange migration. `StockSymbol.symbol` is `@unique`; `active` is an undated mutable boolean; scanner queries filter `active: true`. `reports/market-coverage-gap-audit.json` shows `activeTrue: 189` of `1537`.

⇒ **Point-in-time universe reconstruction is impossible, so every backtest carries survivorship bias** — driven by the undated curation flag, not by delistings. **Ticker reuse** is unguarded: a reused ticker silently inherits the dead company's bars.

Fix: `SymbolListingHistory(symbolId, exchange, listedFrom, listedTo, status, predecessorId)` + replace `active` with effective-dated rows. Backtests then resolve the universe as of the simulated date.

### 2.9 Proven example (execution) ✅

**HPG, 1.10 stock split, ex-date 2026-05-25** — used to prove (a) VCI back-adjusts prices, (b) volume is *not* adjusted, (c) the 2026-05-11 cash dividend also re-bases prices. Full outputs in §7.2, probes #4–#6.

---

## 3. Fundamentals & Sector

### 3.1 Current state

`MarketContextBundle` hardcodes `fundamentals: null`, `newsSentiment: null`, `symbolMeta.sector: null` **[CODE:** `build-market-context-bundle.ts:236,280,281`**]** — with typed `source: "stub" | "future_api"` sockets already waiting.

Also `PortfolioSnapshot.sectorExposureJson` exists **[CODE:** `schema.prisma:989`**]** and *is* populated — but `computePortfolioState` buckets **all** exposure into a single `UNKNOWN` key **[CODE:** `portfolio-service.ts:33,40`**]**, because no sector data exists. So sector concentration is unmeasurable rather than unwritten. (`{}` at bundle line 173 is only the no-portfolio fallback; line 319 passes real state through.) Correcting my earlier phrasing: this is **not** a "risk logic no-op" — I found no consumer of `sectorExposure` in allocation or manager evaluation. It is a latent gap that §3.4 closes, not an active defect.

### 3.2 Bank vs non-bank — measured

**[VERIFIED]** balance-sheet `item_id` sets:

| Pair | Overlap |
|---|---|
| FPT ∩ HPG (both non-bank) | **109 / 109 — identical** |
| FPT ∩ VCB (non-bank vs bank) | **15** of 109 / 78 — **~86% divergence** |

VCB-only: `balances_with_the_sbv`, `available_for_sales_securities`, `accrued_interest_and_fee_receivables`… FPT-only: `cash_and_cash_equivalents`, `accounts_receivable`, `advances_from_customers`…

Two wide-column tables would be needed. One schema is preferable.

**Don't infer the discriminator** — the review found vnstock already returns `com_type_code` via `_get_company_type()`. Store it; don't derive bank-ness from item-set overlap.

### 3.3 Schema — JSONB, not EAV *(revised after review)*

My draft proposed a long/EAV table. **Cut.** The review's objections hold:
- The schema already uses ~40 `Json` columns for variable-shape payloads — EAV would be inconsistent with the surrounding code.
- EAV sizing ≈ 109 items × 4 periods × 3 statements × 1537 symbols ≈ **2M rows** with a 109-row fan-out per read — re-introducing exactly the egress pattern commit `b4da734` was written to remove.
- With only 4 free periods, this is **not a time series**; its real job is accumulating snapshots, which is a `fetched_at` problem, not a normalization problem.

```prisma
model SymbolFinancials {
  id           String   @id @default(cuid())
  symbolId     String   @map("symbol_id")
  statement    StatementType          // INCOME | BALANCE | CASHFLOW | RATIO
  periodType   PeriodType             // YEAR | QUARTER
  periodEnd    DateTime @db.Date @map("period_end")
  comTypeCode  String   @map("com_type_code")   // bank vs non-bank, from vnstock
  items        Json                             // { item_id: value } — GIN-indexable
  currency     String   @default("VND")
  source       String   @default("vnstock:VCI")
  fetchedAt    DateTime @default(now()) @map("fetched_at")   // vintage → no look-ahead
  @@unique([symbolId, statement, periodType, periodEnd, fetchedAt])
  @@index([symbolId, statement, periodEnd(sort: Desc)])
}

model FinancialItemLabel {
  itemId   String @id @map("item_id")   // vnstock stable key
  labelVi  String @map("label_vi")
  labelEn  String @map("label_en")
}
```

≈18k rows, one row per read, handles both bank and non-bank, and carries the **vintage dimension**. `fetched_at` matters: vnstock returns *restated* figures, so without it any fundamental backtest has look-ahead bias — a bigger issue than wide-vs-long.

### 3.4 Sector & index membership

**[VERIFIED]** `Listing.symbols_by_exchange()` → `icb_code2`, `organ_name`, `exchange`; `symbols_by_group()` → VN30 ✅30, HNX30 ✅30, VN100 ✅100 (`VNMID` errors).

```prisma
model SymbolProfile {
  symbolId    String  @id @map("symbol_id")
  icbCode     String? @map("icb_code")
  sectorName  String? @map("sector_name")
  organName   String? @map("organ_name")
  comTypeCode String? @map("com_type_code")
}
model IndexMembership {
  indexCode String                 // VN30 | HNX30 | VN100
  symbolId  String @map("symbol_id")
  from      DateTime @db.Date      // effective-dated: VN30 rebalances quarterly
  to        DateTime? @db.Date
  @@unique([indexCode, symbolId, from])
}
```

Effective dating is required — VN30 rebalances quarterly, and an undated membership table would reintroduce survivorship bias into any "VN30 screen" backtest.

### 3.5 Cost note

Free tier = **4 annual periods [VERIFIED]** — comparable to yfinance, *not* the "7 periods" I claimed in the OpenBB audit (that was 7 columns = 3 label + 4 period). vnstock's real advantage is breadth (VN-GAAP-native line items, stable `item_id`, 54 ratios, bank schemas, shareholders/officers), not depth. Deeper history needs a paid tier — which does not resolve §1.2.

Also: `Finance()` **construction itself makes a network call** (`_get_company_type()` → `Listing().symbols_by_industries()`), so each symbol costs 2 requests against the guest quota. At 281 symbols × `--sleep 3.2` that is a multi-hour job — plan it as a separate weekly workflow, not an add-on to the daily bar import.

---

## 4. News / Sentiment

**Recommendation: store source-backed news; do NOT build sentiment scoring.**

**[VERIFIED]** `Company('FPT').news()` → 50 rows × 21 cols; `.events()` → 50 × 22.

Build now — thin, cheap, useful as AI evidence:
```prisma
model SymbolNews {
  id, symbolId, publishedAt, title, url, sourceName, rawJson, fetchedAt
  @@unique([symbolId, url])
}
```

Do **not** build sentiment scoring:
- No labelled Vietnamese financial-sentiment corpus → no way to validate.
- No measurable lift: the app has no attribution harness that could show sentiment improving Gate 2 hit-rate or Arena returns.
- An unvalidated score entering `MarketContextBundle` becomes an authoritative-looking number an LLM will cite as fact.

Prefer giving the agent **headlines with sources and dates** and letting it reason with citations. Revisit only if a measurable-lift experiment is designed first.

`Company.events()` (dividends, AGMs, issuance) is a **better** early investment — it partially feeds the §2.7 `CorporateAction` model.

---

## 5. AI-Ready Market Context

**Reuse `MarketContextBundle`. No new abstraction layer.** Fill the sockets that already exist.

```ts
symbolMeta: {
  exchange, name,
  sector: string | null,            // ← §3.4
  icbCode: string | null,           // ← §3.4
  indexMembership: string[],        // ← §3.4  e.g. ["VN30","VN100"]
  tradability,
},
fundamentals: null | {              // ← §3.3
  periodEnd, periodType, comTypeCode,
  pe, pb, roe, eps,
  revenueGrowthYoY, epsGrowthYoY,
  source: "vnstock:VCI", fetchedAt, // vintage → auditable, no look-ahead
},
priceBasis: {                       // ← §2.7 — NEW, load-bearing
  adjustmentBasisVersion: string,
  lastCorporateActionExDate: string | null,
  levelsRebasedAt: string | null,
},
newsContext: null | {               // ← §4 — headlines only, no score
  headlines: { publishedAt, title, url, sourceName }[],
},
```

`priceBasis` is the one genuinely new structure, and it is not ceremony: it is what lets an agent (or a human) know whether a stored level and a bar are comparable — the §2.4 defect made explicit in the contract.

| Target query | Needs | After Phases 1–3 |
|---|---|---|
| "Analyze FPT vs VN-Index over 12 months" | 12m bars + RS | ✅ widen fetch window to 400d; RS logic exists |
| "Compare FPT, VCB, HPG fundamentals & valuation" | fundamentals + bank/non-bank | ✅ §3.3 |
| "VN30 stocks: improving fundamentals + positive flow + momentum" | VN30 membership + fundamentals + foreign flow + RS | ✅ membership §3.4; flow already live |

All three are reachable with the existing architecture. **Nothing here justifies an OpenBB-shaped abstraction.**

---

## 6. POC Plan — *plan only, no implementation*

**Scope:** VN-Index + **FPT** (non-bank), **VCB** (bank), **HPG** (recent split + recent cash dividend). Deliberately chosen: one of each hard case.

### 6.1 Pipeline & steps

```
vnstock/VCI → normalize (basis-tagged) → Postgres (+cache) → analytics → API → MarketContextBundle → 1 AI query
```

| # | Step | Output |
|---|---|---|
| 0 | **Measure the damage.** Query `stock_daily_bars.updatedAt` vs `date` per symbol → stale-basis boundary; join `CorporateAction` candidates | Report: bars/symbol on a stale basis. **Settles §2.5 [UNVERIFIED]** |
| 1 | **Volume-basis fix.** Detect volume steps at action dates; rebase onto price basis | Consistent bars; §2.3 closed |
| 2 | **Corporate-action table.** Backfill 24 months for the 3 symbols from `Company.events()` + manual confirmation | ≥6 confirmed actions incl. HPG 2026-05-25 |
| 3 | **Basis tagging + re-base frozen levels.** `adjustment_basis_version` on bars; re-base `SetupWatchItem`/`SetupCandidate`/`Trade` levels | §2.4 closed |
| 4 | **Sector + VN30 membership** (effective-dated) | `symbolMeta.sector`, `indexMembership` populated |
| 5 | **Fundamentals** → `SymbolFinancials` JSONB with `fetched_at` | FPT+HPG non-bank, VCB bank, both parse |
| 6 | **Widen window** 200 → 400 calendar days (3 symbols only) | 12-month RS possible |
| 7 | **Bundle + one AI query** | *"Analyze FPT versus VN-Index over the last 12 months."* |

### 6.2 Acceptance criteria

1. Step 0 report produced with a real number for stale-basis bars per symbol.
2. HPG volume series shows **no** step at 2026-05-25 after the fix; `tradedValueVnd` for pre-split bars rises by ~1.10.
3. Simulated 1.10 action on a test watch item does **not** trip `DEAD_SETUP`.
4. `SymbolFinancials` holds FPT/HPG (`com_type_code` non-bank, 109 items) and VCB (bank, 78 items) — one schema, both parse, `fetched_at` populated.
5. Bundle carries non-null `sector`, `indexMembership` (VCB+FPT+HPG all in VN30), `fundamentals`, `priceBasis` for all three.
6. RS of each vs VN-Index computes over 12 months without crossing a basis boundary.
7. AI answer cites fundamental figures traceable to stored rows with `fetched_at`.
8. **Zero new services, runtimes, or copyleft dependencies.**

### 6.3 Test fixtures

| Fixture | Purpose |
|---|---|
| `hpg-split-2026-05-25.json` | 40 bars spanning the split — the §2.3/§2.4 regression fixture |
| `hpg-dividend-2026-05-11.json` | cash-dividend re-basing (§2.1) |
| `vcb-bank-financials.json` | 78-item bank balance sheet |
| `fpt-nonbank-financials.json` | 109-item non-bank |
| `vcb-bonus-2025-03-12.json` | 1.495 bonus issue — large non-round factor |
| `watch-item-frozen-level.json` | synthetic watch item + post-action bars → asserts no false DEAD_SETUP |
| `vn30-membership-rebalance.json` | quarterly rebalance → effective dating |

Fixtures go under `src/lib/**/__fixtures__/`, matching the existing pattern **[CODE:** `scanner/early-entry/__fixtures__`**]**.

### 6.4 Runtime evidence required

- Step-0 query output (real counts, production, read-only).
- Before/after `tradedValueVnd` for HPG across 2026-05-25.
- Before/after watch-health for a symbol crossing an action.
- Bundle JSON for all three symbols with non-null new fields.
- The AI answer, with the SQL rows behind each cited figure.
- `npm run typecheck && npm run test` green.

### 6.5 Rollback & cleanup

Every step is additive — new tables, nullable columns, one widened fetch window on 3 symbols. Rollback = drop the new tables and revert the window; the scanner is untouched. Steps 1 and 3 mutate existing rows, so **snapshot `stock_daily_bars` for the 3 symbols first** and gate both behind a `--dry-run` that prints the diff. Feature-flag the bundle fields (`FUNDAMENTALS_ENABLED`), matching the existing `EARLY_ENTRY_V` pattern **[CODE]**.

### 6.6 Kill criteria

| # | Condition | Action |
|---|---|---|
| K1 | Licensing (§1) returns "no commercial use permitted" | **Stop all data work.** Resolve licence first |
| K2 | Step 0 shows **zero** stale-basis bars and no volume mismatch | Drop §2.3/§2.5; keep §2.4 |
| K3 | Bank + non-bank cannot share one JSONB schema | Re-open the schema decision *before* writing ingest |
| K4 | Fundamentals fetch exceeds the guest quota at 3 symbols | Fundamentals need a paid/licensed source — escalate to §1.5 |
| K5 | AI answer cannot be traced to stored rows | Bundle contract is wrong — fix before any further AI work |

### 6.7 Complexity

| Step | Effort | Risk |
|---|---|---|
| 0 Measure | 0.5 d | Low — read-only |
| 1 Volume basis | 1–2 d | **Med** — mutates bars |
| 2 Corporate actions | 2–3 d | Med — manual confirmation |
| 3 Basis tagging + re-base | 3–4 d | **High** — touches live tables |
| 4 Sector + membership | 2–3 d | Low |
| 5 Fundamentals | 3–4 d | Med — quota |
| 6 Widen window | 0.5 d | Low |
| 7 Bundle + AI | 2 d | Low |
| **Total** | **~14–19 days** | |

Steps 0–1 alone (~2 days) close the highest-severity live defect and are independently shippable.

---

## 7. Python Environment — Record & Cleanup

### 7.1 Packages installed for the audit

Baseline before: `vnstock 4.0.4` (2026-06-03), `selenium 4.33.0` (2025-06-09) — both pre-existing, **not** installed by me.

| Time | Command | Newly installed |
|---|---|---|
| 11:27 | `pip install yfinance` | `yfinance 1.5.2`, `curl_cffi 0.16.0`, `multitasking 0.0.13`, `peewee 3.19.0`, `websockets 15.0.1`, `protobuf 5.29.5` |
| 11:32 | `pip install openbb-yfinance` | `openbb-core 1.6.13`, `openbb-yfinance 1.6.3`, `fastapi 0.136.3`, `uvicorn 0.40.0`, `aiohttp 3.14.3`, `aiohttp-client-cache 0.11.1`, `pydantic 2.13.4`↑, `pydantic_core 2.46.4`↑, **`typing_extensions 4.16.0`↑**, `ruff 0.15.22`, `deepdiff 9.1.0`, `cachebox 5.2.3`, +12 more |
| 11:34 | `pip install openbb-imf openbb-econdb` | `openbb-imf 2.1.3`, `openbb-econdb 1.5.1`, `openbb-economy 1.6.2`, `openbb-platform-api 1.3.6` |

**Environment change:** `typing_extensions` upgraded to **4.16.0**, breaking `selenium 4.33.0` (requires `~=4.13.2`). Verified via `pip check` — this was the **only** conflict introduced.

### 7.2 Commands & key outputs

| # | Probe | Result |
|---|---|---|
| 1 | yfinance VN tickers | `FPT/VCB/HPG/SSI.VN` ✅; `^VNINDEX` ❌ |
| 2 | 90-symbol sample by exchange | HSX 42/42 · UPCOM 0/39 · HNX 0/9 |
| 3 | OpenBB `YFinanceEquityHistoricalFetcher` | HOSE ✅; VN-Index/HNX/UPCOM ❌ `EmptyDataError` |
| 4 | **vnstock HPG around 2026-05-25** | Continuous — **no split gap** → VCI back-adjusts |
| 5 | **HPG 2y vnstock vs Yahoo ratios** | px flat `0.9820`→`1.0000` at the **cash dividend**; vol steps `0.7581`→`0.9101`→`1.0000` at **each split** → **price adjusted, volume raw** |
| 6 | yfinance `.actions` | HPG splits 2025-06-26 (1.20), 2026-05-25 (1.10); div 2026-05-11 |
| 7 | vnstock `Finance` FPT/VCB/HPG | 4 annual periods; banner confirms free-tier cap |
| 8 | **balance-sheet `item_id` overlap** | FPT∩HPG **109/109**; FPT∩VCB **15** |
| 9 | vnstock `Listing` | VN30 30 · HNX30 30 · VN100 100; exchange + `icb_code2` ✅ |
| 10 | vnstock indices | VNINDEX/VN30/HNXINDEX/UPCOMINDEX ✅ 29 bars each |
| 11 | License metadata | vnstock *"Personal, research, non-commercial"*; openbb-core AGPL-3.0-only; yfinance Apache-2.0 |
| 12 | `vnai` endpoint extraction | `/auth/device-register`, `/license/verify`, `hq.vnstocks.com/analytics`, `/v1/user/profile/sync` |
| 13 | Neon production probe | ❌ `getaddrinfo ENOTFOUND` — DNS blocked. §2.5 magnitude **[UNVERIFIED]** |

**No production data was written.** The only DB connection attempted was read-only and failed at DNS.

### 7.3 Cleanup — executed and verified

| Step | Result |
|---|---|
| Uninstalled `openbb-yfinance`, `openbb-core`, `openbb-imf`, `openbb-econdb`, `openbb-economy`, `openbb-platform-api`, `yfinance` | ✅ 7 removed |
| Uninstalled 18 transitive audit-only deps | ✅ |
| Restored `typing_extensions` 4.16.0 → **4.13.2** (selenium's range) | ✅ |
| Downgraded `pydantic` 2.13.4 → **2.11.10** (`pydantic-core` 2.33.2) — 2.13.4 required `typing-extensions>=4.14.1` and would have kept selenium broken | ✅ |
| **Over-removal corrected:** `peewee`, `uvicorn`, `python-multipart`, `websockets` were pre-existing deps of `semgrep`/`mcp`/`google-genai`/`undetected-chromedriver`, not audit-only — my install-timestamp heuristic misread *upgrades* as *new installs*. All four restored, `websockets` pinned to `>=13.0.0,<15.1.0` for `google-genai` | ✅ |
| `pip check` | ✅ **"No broken requirements found."** |
| `import selenium` | ✅ 4.33.0 — **conflict resolved** |
| `python scripts/fetch_vnindex.py` (real production ingestion script) | ✅ **"Wrote 301 bars"** — pipeline verified working |

**Net environment delta vs. pre-audit:** `pydantic` 2.11.10 and `typing_extensions` 4.13.2 are now *older* than the versions present when the audit began (2.13.4 / 4.16.0). Those newer versions were themselves installed by my OpenBB install at 11:32, so this restores the pre-audit state rather than regressing it. `vnstock 4.0.4` and `selenium 4.33.0` are untouched at their original versions.

---

## 8. Adversarial Review — Findings & Resolution

One independent subagent review (opus, 51 tool calls). Material findings and how each was handled — **I independently re-verified every finding I adopted**; I did not take them on trust.

| # | Finding | Resolution |
|---|---|---|
| E1 | yfinance fabricates a 33% VCB cliff on 2025-03-03 → invalid as a VN action source | **Accepted.** §2.2; yfinance removed in §7.3 |
| E2 | **Adjusted price + raw volume** | **Accepted after independent replication** (probe #5). Now §2.3, the top fix |
| E3 | vnstock adjusts cash dividends too → trigger set is far wider | **Accepted, replicated** (probe #5, 2026-05 step) |
| E4 | §2.5 magnitude overstated; `updatedAt` makes it queryable | **Partly accepted.** Adopted the `updatedAt` insight. **Rejected the "~25 bars" figure** — its arithmetic is confounded by universe growth (189→206). Kept as `[ESTIMATED]`, made POC step 0 |
| E5 | "Live signals unaffected" is wrong — frozen levels vs re-based bars | **Accepted, verified** at `persist-watch-health.ts:110` + `DEAD_SETUP_DISTANCE_PCT = 0.1`. Rewrote §2.4 |
| E6 | `sectorExposureJson` is a production no-op; "2–3 days" optimistic | **Partly accepted.** "2–3 days" optimistic — yes. **"No-op" rejected** on Codex re-check: it is populated, but collapsed into one `UNKNOWN` bucket, and has no allocation consumer (§3.1) |
| M1 | Rights holder is Vietcap/HOSE, not vnstock | **Accepted.** Reframed §1.2 |
| M2 | `vnstock>=3.0` unpinned | **Accepted.** L5, NOW |
| M3 | `vnai` is license enforcement + fingerprinting | **Accepted after verifying endpoints myself.** L3/L4 |
| M4 | `Finance()` costs 2 requests; `com_type_code` gives bank/non-bank | **Accepted.** §3.2, §3.5 |
| M5 | No T+2, board lots, or price bands → Arena fills unexecutable | ❌ **REJECTED on Codex re-check — I accepted this without verifying.** 100-share board lots and a VN limit band **are** enforced **[CODE:** `engine/order-validator.ts:66,88`; `constants.ts:9` `PAPER_VN_LIMIT_BAND_PCT = 0.07`**]**, plus a 15% session-close outlier check. Real remaining gaps are narrower: no T+2, and one flat 7% band instead of HOSE 7% / HNX 10% / UPCOM 15% |
| M6 | No fundamentals vintage → look-ahead bias | **Accepted.** `fetched_at` in §3.3 |
| M7 | ESOP/buyback/par-value corrections | **Accepted.** §2.7 |
| O1 | EAV table over-engineered | **Accepted.** Replaced with JSONB (§3.3) |
| O2 | Foreign ownership room is noise | **Accepted.** DO NOT DO |

### 8.2 Codex CLI review (second pass, `codex-cli 0.146.1`)

Run after the adversarial review. It **blocked the commit** and was right to — it caught two claims I had accepted from the first reviewer *without verifying them myself*, which is exactly the failure mode I said I would avoid.

| # | Codex finding | Resolution |
|---|---|---|
| 1 | The two documents contradict each other on corporate actions; the OpenBB audit still asserted the retracted claim | **Accepted.** Added a SUPERSEDED banner and rewrote §9.6 of the audit in place |
| 2 | `sectorExposureJson` is populated (bucketed to `UNKNOWN`), not fed `{}`; "risk logic no-op" overstated; no allocation consumer found | **Accepted, verified** at `portfolio-service.ts:33,40`. §3.1 rewritten |
| 3 | **Board lots and price bands already exist** in Paper Lab | **Accepted, verified** at `order-validator.ts:66,88`. I had taken the first reviewer's M5 on trust. Real gaps are narrower: T+2, and one flat 7% band vs HOSE 7% / HNX 10% / UPCOM 15% |
| 4 | Stale counts and line-number drift | **Accepted.** 584 tracked `src/` TS/TSX, 28 migrations; `schema.prisma:300`; bundle `sector` at `:236` |
| 5 | Shipping "fix volume basis" this week is unsafe before a confirmed action model exists | **Accepted.** NOW #4 is now **detect-only**; bar mutation moved to NEXT #8b behind `--dry-run` + snapshot |

**Lesson recorded:** the first reviewer's M5 and E6 were wrong, and I propagated them because they were specific and plausible. Adversarial review output needs the same verification bar as any other tool result.

---

## 9. Prioritized Actions

### 🔴 NOW — this week

| # | Action | Why | Effort |
|---|---|---|---|
| 1 | **Email `support@vnstocks.com`**; request SSI FastConnect + FiinGroup pricing; counsel review of §1.2 | L1/L2 gate everything | 0.5 d + wait |
| 2 | **Pin `vnstock==4.0.4`** in `requirements.txt`; declare `vnai` | One line; protects every finding here from an overnight silent rewrite | 15 min |
| 3 | **POC step 0** — measure stale-basis bars via `updatedAt` | Settles the one **[UNVERIFIED]** claim | 0.5 d |
| 4 | **Detect** the volume-basis mismatch (§2.3) — read-only report of affected symbols/sessions. ⚠️ **Do NOT mutate bars yet** — rebasing must wait for confirmed action factors (NEXT #7/#8), not factors inferred from volume steps | Live: wrong tradability floor + inflated Gate 2 volume passes. Quantify first, mutate second | 1 d |
| 5 | **Guard frozen levels** (§2.4) — alert when an action lands on an open watch/trade | Live: false DEAD_SETUP on every action | 1 d (alert) |
| 6 | Disclose `vnai` transmission in the Privacy Policy, or remove it | L4 | 0.5 d |

### 🟠 NEXT — 2–6 weeks

| # | Action | Gate |
|---|---|---|
| 7 | `CorporateAction` model + 24-month backfill for POC symbols (§2.7) | after 3 |
| 8 | Basis tagging + re-base frozen levels (§2.7 step 3) | after 7 |
| 8b | **Rebase volume** onto the price basis using confirmed `CorporateAction` factors — behind `--dry-run` + a snapshot of the affected bars | after 7 |
| 9 | `SymbolProfile` + effective-dated `IndexMembership` (§3.4) — fixes the `sectorExposureJson` no-op | — |
| 10 | `SymbolFinancials` JSONB with `fetched_at` (§3.3) | after 9 |
| 11 | Widen fetch window 200 → 400 d | after 8 |
| 12 | Bundle fields + one AI query (§5) | after 10 |
| 13 | `SymbolNews` headlines, **no scoring** (§4) | after 12 |

### 🟡 LATER — after licensing resolves

| # | Action |
|---|---|
| 14 | `SymbolListingHistory` — effective-dated universe, kills survivorship bias (§2.8) |
| 15 | Ticker-reuse guard |
| 16 | **T+2 settlement** (missing) and **exchange-specific price bands** — today one flat `PAPER_VN_LIMIT_BAND_PCT = 0.07` is applied to HNX (10%) and UPCOM (15%) names too. Board lots already enforced — no work needed |
| 17 | Provider migration to the licensed source |
| 18 | Backtest re-run on corrected history; re-run lookback-120 diagnostics |
| 19 | Store `raw_close` alongside adjusted for full auditability |

### ⛔ DO NOT DO

| # | Item | Why |
|---|---|---|
| 20 | **Integrate OpenBB** | Settled in the baseline audit |
| 21 | **Build a `VietnamProvider`** | Wrapper around vnstock; adds AGPL; zero new data |
| 22 | **Sentiment scoring** | No labelled VN corpus, no lift harness; a fake-authoritative number for the LLM (§4) |
| 23 | **EAV fundamentals table** | ~2M rows, 109-row fan-out; reverses commit `b4da734` (§3.3) |
| 24 | **yfinance as a VN data or corporate-action source** | Fabricates events (§2.2) |
| 25 | **Foreign ownership room tracking** | Noise for a domestic-retail product; `ForeignTradeDaily` already covers flow |
| 26 | **Swap providers before the licence is signed** | Rework risk; L1/L2 unresolved |
| 27 | **Par-value / ESOP / buyback price adjustments** | Par value fixed by law; neither gets a HOSE reference-price adjustment (§2.7) |

---

## 10. Bottom Line

The OpenBB question is closed, and it was the wrong question. The live defects are in the existing pipeline and none of them need a new abstraction layer:

1. **Licensing (§1)** — unresolved and gates everything. The rights holder is Vietcap/HOSE, not vnstock, so a vnstock membership does not cure it.
2. **Adjusted prices with raw volume (§2.3)** — actively corrupting the tradability floor and Gate 2 volume confirmation today. Cheapest fix in this document.
3. **Frozen levels vs a silently re-based series (§2.4)** — false DEAD_SETUP flags and phantom P&L after every corporate action, including cash dividends. Reaches the Arena's live allocation cron.

Items 2 and 3 are ~2–3 days combined and independently shippable. Item 1 is a phone call and a lawyer, and it should start today because every other decision depends on the answer.

I was wrong about corporate actions in the OpenBB audit — I assumed unadjusted prices without testing. Testing showed the opposite, and the adversarial review then found the defect that assumption had hidden. The `[UNVERIFIED]` marker on §2.5 is the one remaining gap; POC step 0 closes it in half a day.
