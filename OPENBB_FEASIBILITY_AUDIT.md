# OpenBB Feasibility Audit — Trading App (Vietnam Market)

> ### ⚠️ PARTIALLY SUPERSEDED — read [TRADING-DATA-REMEDIATION-PLAN.md](TRADING-DATA-REMEDIATION-PLAN.md) for current guidance
>
> The OpenBB conclusion (**NO-GO**) stands and has been accepted as baseline.
>
> **§9.6 of this document is WRONG and has been corrected in place.** It claimed VN prices were
> unadjusted and would cause false breakouts. Runtime testing later proved vnstock/VCI returns
> **fully back-adjusted prices**. The real defects — adjusted prices paired with *raw volume*, and
> frozen stored price levels compared against a silently re-based series — are documented in
> §2.3 and §2.4 of the remediation plan. Where the two documents disagree, **the remediation plan wins.**

**Date:** 2026-08-07
**Branch:** `main` @ `b4da734`
**Scope:** Architecture + feasibility audit only. No production code was modified, committed, or deployed.
**Method:** Direct code inspection (584 tracked TS/TSX files under `src/`, 58 Prisma models, 28 migrations) + runtime probes against live providers.

**Evidence legend used throughout:**
- **[VERIFIED]** — confirmed by running code in this session, output captured.
- **[CODE]** — confirmed by reading this repository's source.
- **[DOC]** — from official OpenBB/vendor documentation.
- **[ASSUMPTION]** — inference, explicitly flagged, not confirmed.

---

## 1. Executive Conclusion

### Verdict: **NO-GO** for OpenBB as a data/analytics foundation. **Narrow PARTIAL GO** for one optional, low-priority role.

**Does OpenBB solve a real problem in this application, or would we just be adding another abstraction layer?**

> For this application, as it exists today, **OpenBB would overwhelmingly be another abstraction layer.** It cannot supply the data this app is actually built on, and where it *can* supply data, the app already has it — ingested correctly, cheaply, and with better Vietnam-specific fidelity.

Three runtime-verified findings drive this:

**1. OpenBB cannot see the Vietnamese market this app trades.** I ran OpenBB's own `YFinanceEquityHistoricalFetcher` — the actual provider code path, not a documentation claim — against this repo's real symbol universe **[VERIFIED]**:

| Target | OpenBB result |
|---|---|
| VN-Index (`^VNINDEX`, `VNINDEX`) | ❌ `EmptyDataError` |
| HOSE equities (FPT, VCB, HPG, SSI, BSR) | ✅ 28/28 bars |
| HNX equities (SHS) | ❌ `EmptyDataError` |
| UPCOM equities (ACM, DDV) | ❌ `EmptyDataError` |

A by-exchange sweep of 90 randomly sampled symbols from the app's live 281-symbol universe **[VERIFIED]**: **HSX 42/42 covered (100%), UPCOM 0/39 (0%), HNX 0/9 (0%).**

The app's active universe is **123 HSX / 117 UPCOM / 41 HNX** **[VERIFIED]**. OpenBB's free path therefore covers **~44% of the universe and 0% of the market-regime layer**. Gate 1 — the regime filter every scan depends on — is computed from VN-Index MA20/MA50/volume **[CODE]**. OpenBB cannot produce it at all.

**2. Where OpenBB works, it duplicates working code.** For HOSE names, OpenBB returns exactly what the app already stores. I compared FPT for 2026-08-03→08-06 **[VERIFIED]**: vnstock and yfinance agree to the cent on OHLC (unit scale differs — vnstock returns thousand-VND, yfinance VND) and on volume. There is no accuracy or coverage gain to bank.

**3. OpenBB does not fix the one licensing problem this app actually has — it reproduces it.** See §9. This is the audit's most consequential finding and it is not an OpenBB question.

### What OpenBB *would* genuinely add

Two real gaps, honestly stated:

- **Fundamentals.** `MarketContextBundle.fundamentals` is hardcoded `null`, as is `newsSentiment`, as is `symbolMeta.sector` **[CODE:** `src/lib/paper-lab/context/build-market-context-bundle.ts:211,280,281`**]**. OpenBB's standardized `balance_sheet`/`income_statement` **do work** for HOSE tickers — FPT returned 5 annual periods with 75/80 fields populated **[VERIFIED]**. That is a genuine capability the app lacks.
- **Provider abstraction / MCP-for-agents.** Real, but see §5 — the app already has the normalized layer OpenBB would provide.

**But**: for Vietnam fundamentals, **vnstock — already installed and already in the pipeline — is strictly better than OpenBB.** vnstock returned FPT `balance_sheet (122×7)`, `income_statement (25×7)`, `cash_flow (41×7)`, `ratio (54×19)`, plus `shareholders (67×5)`, `officers (9×6)`, `subsidiaries (14×4)`, `news (50×21)`, `events (50×22)` **[VERIFIED]**. OpenBB/yfinance offers 4–5 annual periods of US-GAAP-mapped fields.

**So the fundamentals gap is real, and the cheapest fix is `vnstock.Finance` — not OpenBB.** Closing it via OpenBB means adding a Python service, an AGPL dependency, and a second normalization layer to obtain *less* Vietnamese fundamental data than a library already in `requirements.txt`.

### The finding that outranks the OpenBB question

**`vnstock` is licensed "Personal, research, non-commercial" — and this app is in production.**

```
License: Custom: Personal, research, non-commercial; contact support@vnstocks.com for other use
Classifier: License :: Other/Proprietary License          [VERIFIED via importlib.metadata]
```

The app has user registration, login, a Privacy Policy, Terms of Service, and a TikTok domain-verification file **[CODE]** — it is a public, user-facing deployment. Whether that constitutes "commercial use" is a legal question I am not qualified to answer, but it is **not** obviously "personal, research, non-commercial," and the entire production data pipeline depends on it.

**OpenBB does not solve this.** Its only VN-capable free path is yfinance, whose own README states the Yahoo API *"is intended for personal use only"* and that yfinance is *"not affiliated, endorsed, or vetted by Yahoo"* **[VERIFIED]**. Swapping vnstock for OpenBB/yfinance trades one personal-use-only source for another — while losing VN-Index, HNX, UPCOM, and foreign flow.

**Recommendation: treat §9 (data licensing) as P0 and the OpenBB question as P3.** They are independent, and only one of them is urgent.

---

## 2. Current Architecture & Data-Flow Map

### Stack **[CODE]**

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router, `use cache`/`cacheLife`/`cacheTag`), React 19.2.4 |
| Language | TypeScript (strict), 139 test files, Vitest + Playwright |
| ORM / DB | Prisma 7.6 → PostgreSQL (Neon), `@prisma/adapter-pg` + optional Accelerate |
| Auth | `jose` JWT sessions + `bcryptjs` |
| Charts / UI | Recharts, Tailwind 4, Framer Motion |
| Validation | Zod 4 |
| Ingestion | **Python 3.12 + `vnstock` 4.0.4** (out-of-band, GitHub Actions) |
| Hosting | Vercel (app + 4 crons), Neon (Postgres), GitHub Actions (ingestion) |
| Surface | 37 API routes, 5 server-action modules, 58 Prisma models |

### Real data flow (verified against code, not README)

```
┌─ SOURCE ────────────────────────────────────────────────────────────────┐
│  VCI (via vnstock 4.0.4, Python)                                        │
│    Quote.history()      → VNINDEX daily OHLCV                           │
│    Quote.history()      → equity daily OHLCV (281 active symbols)       │
│    Trading.price_board()→ foreign buy/sell EOD snapshot                 │
└────────────────────────────┬────────────────────────────────────────────┘
                             │  GitHub Actions "Production bar import"
                             │  cron: 30 12 * * 1-5 (~19:30 ICT, post-session)
                             │  timeout 45 min · concurrency-guarded
                             ▼
┌─ INGESTION (ephemeral JSON in $RUNNER_TEMP, never committed) ───────────┐
│  scripts/fetch_vnindex.py          → vnindex.json      (420d window)    │
│  scripts/fetch_stock_bars.py       → stock-bars.json   (200d, sleep 3.2s)│
│  scripts/fetch_foreign_snapshot.py → foreign-snapshot.json (batch 10)   │
│                                                                         │
│  Stale-only optimization: list-stale-fetch-targets.ts picks only        │
│  missing/stale symbols; optional 2-way sharding; retry queue for empties│
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─ NORMALIZATION ─────────────────────────────────────────────────────────┐
│  Date → UTC-midnight epoch ms (stable dedupe key)                       │
│  Prices kept in thousand-VND (kVND); price-units.ts converts to VND      │
│  import-bars.ts / import-stock-bars.ts / import-foreign-flow.ts (upsert)│
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─ STORAGE (Neon Postgres) ───────────────────────────────────────────────┐
│  index_daily_bars          (symbol,date) unique · source "vnstock:VCI"  │
│  stock_daily_bars          (symbol_id,date) unique                      │
│  foreign_trade_daily       (symbol_id,session_date) unique              │
│  stock_symbols / tactical_symbols  (core ∪ tactical effective universe) │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─ DERIVED / PRECOMPUTED ─────────────────────────────────────────────────┐
│  build-market-context.ts →                                              │
│    market_context_daily         (VN-Index MA20/MA50, vol ratio,         │
│                                  Gate1 level, foreign net 1/5/10d)      │
│    symbol_market_context_daily  (per-symbol vol MA, foreign net, quality)│
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─ CALCULATION (pure TypeScript, in-repo) ────────────────────────────────┐
│  Gate 1  regime filter (VN-Index MA/volume) → PASS | WARNING | FAIL     │
│  Tradability filter (min bars, close, avg vol/value 20d, max gap)       │
│  Gate 2  breakout-pullback + Relative Strength v1 + rank components     │
│  Early-entry state machine (reversal score, RR, stop selection)         │
│  → run-daily-scan-job.ts writes daily_scan_runs + setup_candidates      │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─ AI / AGENT LAYER (Paper Lab / Arena) ──────────────────────────────────┐
│  build-market-context-bundle.ts → MarketContextBundle (versioned)       │
│  agent-runner.ts → mock-rule-agents (default) | llm-structured-agent    │
│  Zod-validated AgentDecisionOutput → agent_decisions → paper portfolio  │
│  Arena battles, DNA, calibration, evolution, hall of fame, attribution  │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─ API / UI ──────────────────────────────────────────────────────────────┐
│  37 route handlers + server actions · "use cache" DTO layer             │
│  Dashboard / Setups / Book (Sổ lệnh) / Paper Lab / Settings             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Scheduled jobs **[CODE:** `vercel.json`, `.github/workflows/`**]**

| Job | Schedule (UTC) | Host | Purpose |
|---|---|---|---|
| Production bar import | `30 12 * * 1-5` | GitHub Actions | Python fetch → Neon → triggers scan |
| `/api/cron/daily-scan` | `0 14 * * 1-5` | Vercel | Backup scan trigger, `maxDuration=300` |
| `/api/cron/paper-lab-daily` | `15 14 * * 1-5` | Vercel | Agent decisions + mark-to-market |
| `/api/cron/lab-analytics-daily` | `45 14 * * 1-5` | Vercel | Rankings, calibration, evolution |
| `/api/cron/shadow-allocation-review` | `0 16 1 * *` | Vercel | Monthly capital-allocation review |

Ingestion deliberately runs on GitHub Actions, not Vercel — the workflow header states Python plus a 15–25 min equity fetch exceeds serverless limits **[CODE]**. This is a sound decision and OpenBB would not change it (OpenBB is also Python).

### Caching & rate-limit handling **[CODE]**

- **Caching:** Next.js `use cache` + `cacheLife({stale:300, revalidate:3600, expire:86400})` on VN-Index history, setups DTOs, market regime; `revalidateTag("daily-scan", {expire:0})` fired by the scan cron; `revalidatePath` on trade mutations. Precomputed `market_context_daily` acts as a materialized cache for the heaviest aggregation.
- **Rate limits:** handled at the *fetch script* level, not with a generic limiter — `--sleep 3.2` between symbol requests with the comment *"vnstock guest limit is ~20/min; use >=3.0"*, `--batch-size 10` for price_board, per-symbol try/except that records failures without aborting the run, and a retry-queue builder (`build-fetch-retry-queue.ts`) that re-queues empty results. `tenacity` retry is inside vnstock itself.
- **Egress discipline:** the most recent commit (`b4da734`) is specifically *"cut Neon egress with bounded, cached, chunked bar reads"* — DB cost is an active, managed concern.

---

## 3. Current Data-Source Inventory

| Data | Source | Path | Status | Provenance / risk |
|---|---|---|---|---|
| VN-Index daily OHLCV | vnstock → VCI | `fetch_vnindex.py` | ✅ Live | Undocumented broker endpoint; non-commercial license |
| Equity daily OHLCV (281) | vnstock → VCI | `fetch_stock_bars.py` | ✅ Live | Same |
| Foreign buy/sell EOD | vnstock → VCI `price_board` | `fetch_foreign_snapshot.py` | ✅ Live, forward-only | Session-cumulative snapshot; `dataQuality` enum tracks partiality |
| Symbol universe / exchange | vnstock `Listing` + curated seed | `seed-stock-symbols.ts` | ✅ Live | 1,536 seed rows; 281 active |
| Technical indicators | **Computed in-repo (TS)** | `src/lib/scanner/**` | ✅ Live | Own IP, fully tested |
| Market regime (Gate 1) | **Computed in-repo** | `compute-market-context.ts` | ✅ Live | Own IP |
| Relative Strength | **Computed in-repo** | `gate2/relative-strength.ts` | ✅ Live | Own IP |
| Portfolio / trading book | **Own** (Prisma) | `Trade`, `PaperPortfolio`, … | ✅ Live | Own data |
| **Fundamentals** | — | — | ❌ **`null` stub** | Gap |
| **News / sentiment** | — | — | ❌ **`null` stub** | Gap |
| **Sector / industry** | — | — | ❌ **`null` stub** | Gap (vnstock has ICB) |
| **Macro (CPI, GDP, FX, rates)** | — | — | ❌ **Absent** | Gap |
| **Proprietary (tự doanh) flow** | — | — | ❌ **Absent** | Gap |
| **Market breadth (A/D)** | — | — | ❌ **Absent** | Gap |
| **Corporate actions** | — | — | ❌ **Absent** | Gap — see §9 risk |
| LLM inference | OpenAI / ZenMux | `llm-config.ts` | ⚪ **Opt-in, default OFF** | Zero external calls unless `PAPER_LAB_LLM_ENABLED=true` |

**Licensing assumption currently embedded in the codebase:** none is stated anywhere. The `source` column defaults to the string `"vnstock:VCI"` **[CODE]**, which is good provenance hygiene, but no license/ToS assessment exists in the repo. This audit is the first.

---

## 4. OpenBB Capability Assessment

### What OpenBB is **[DOC + VERIFIED]**

OpenBB Platform (PyPI `openbb` **4.7.2**, Python `>=3.10,<4`) is an open-source **data integration and standardization layer**, not a data source. Architecture: a **Core** plus independent **provider extensions**, each implementing `QueryParams`/`Data` Pydantic subclasses so that one endpoint (`obb.equity.price.historical`) can be served by many providers with standardized field names.

Surfaces: Python (`from openbb import obb`), FastAPI REST (`openbb-api`, default `127.0.0.1:6900`), Excel, OpenBB Workspace, and an **MCP server** (`openbb-mcp-server`) exposing tools to AI agents with progressive tool discovery.

### Provider landscape **[DOC]**

- **Free / public:** `sec`, `federal-reserve`, `ecb`, `imf`, `oecd`, `government-us`, `us-eia`, `famafrench`, `econdb`, `cboe`, `finra`, `finviz`, `tmx`, `yfinance`, `seeking-alpha`, `biztoc`, `deribit`
- **Free tier w/ API key:** `fred`, `bls`, `cftc`, `congress-gov`, `polygon`, `fmp`, `alpha-vantage`, `tiingo`, `nasdaq`, `tradier`
- **Paid:** `benzinga`, `intrinio`, `tradingeconomics`

> **Confirmation of the brief's caution:** OpenBB itself provides **no** market data. Every row comes from a third party under that third party's terms. OpenBB is plumbing.

### Capability vs. this app

| OpenBB capability | Assessment for this app |
|---|---|
| Standardized data models | Real strength — but app already has `MarketContextBundle` (versioned) + Zod + 58 Prisma models |
| Provider abstraction | Value scales with N providers. App has **N=1** (vnstock). Abstraction over N=1 is pure overhead |
| Equity price/OHLCV | Works for HOSE only **[VERIFIED]** |
| Index data | **Fails for all VN indices [VERIFIED]** |
| Fundamentals | Works for HOSE **[VERIFIED]**, but shallower than vnstock for VN |
| Macro | US/EU/global excellent. **Vietnam macro not verifiable in this session** — `econdb` DNS-blocked, IMF symbol resolution failed twice **[ASSUMPTION: partial VN coverage likely via IMF/OECD, unconfirmed]** |
| News | No Vietnamese-language coverage; vnstock returns 50 VN news rows per symbol **[VERIFIED]** |
| Technical analysis | `openbb-technical` extra exists, but app's indicators are custom, tested IP — no reason to replace |
| Self-hosting | Fully supported (`openbb-api`, `openbb-mcp`) |
| **License** | **AGPL-3.0-only** — verified on `openbb-core` and `openbb-yfinance` metadata **[VERIFIED]** |

---

## 5. Vietnam-Market Coverage Matrix

Runtime-verified against OpenBB's real fetcher classes and this repo's live universe.

### Indices

| Target | OpenBB (free) | Status | Evidence |
|---|---|---|---|
| VN-Index | none | ❌ **UNSUPPORTED** | `^VNINDEX`, `VNINDEX`, `VNINDEX.VN`, `^VNI` → `EmptyDataError` **[VERIFIED]** |
| VN30 (index level) | none | ❌ **UNSUPPORTED** | No symbol resolves |
| VN30 (constituents) | none | ❌ **UNSUPPORTED** | vnstock `Listing.symbols_by_group('VN30')` returns 30 **[VERIFIED]** |
| HNX-Index / UPCOM-Index | none | ❌ **UNSUPPORTED** | vnstock returns 29 bars each **[VERIFIED]** |

### Equities

| Exchange | Universe | OpenBB coverage | Status |
|---|---|---|---|
| HOSE / HSX | 123 | **42/42 sampled = 100%** | ✅ **SUPPORTED** (`TICKER.VN`) |
| HNX | 41 | **0/9 sampled = 0%** | ❌ **UNSUPPORTED** |
| UPCOM | 117 | **0/39 sampled = 0%** | ❌ **UNSUPPORTED** |
| **Total** | **281** | **~123 (44%)** | ⚠️ **PARTIAL** |

Named checks **[VERIFIED]**: FPT ✅, VCB ✅, HPG ✅, SSI ✅, BSR ✅ · SHS ❌ (HNX), ACM ❌, DDV ❌ (UPCOM).

**Data quality where it works is good.** FPT.VN vs vnstock VCI, 2026-08-03→08-06 **[VERIFIED]**:

| Date | vnstock O/H/L/C (kVND) | yfinance O/H/L/C (VND) | Volume match |
|---|---|---|---|
| 2026-08-03 | 67.4 / 71.7 / 67.3 / 71.7 | 67400 / 71700 / 67300 / 71700 | 16,279,100 = 16,279,100 ✅ |
| 2026-08-04 | 72.4 / 73.3 / 71.3 / 71.5 | 72400 / 73300 / 71300 / 71500 | 6,584,300 ✅ |
| 2026-08-05 | 72.2 / 72.2 / 70.2 / 70.3 | 72200 / 72200 / 70200 / 70300 | 6,877,600 ✅ |
| 2026-08-06 | 70.4 / 71.4 / 70.4 / 70.7 | 70400 / 71400 / 70400 / 70700 | 4,629,700 ✅ |
| 2026-08-07 *(same-day)* | close 71.1 | close 71.2 | 2,655,000 vs 2,542,748 ❌ |

⚠️ **The current session's bar disagrees** — yfinance serves a provisional intraday snapshot. Any same-day use would need an explicit "settled bar" guard. Historical bars are exact. Depth: yfinance returned **1,305 rows back to 2021-08-09** for FPT.VN **[VERIFIED]** — deeper than the app's 200-day fetch window.

### Everything else

| Data type | OpenBB status | Note |
|---|---|---|
| Company profile | ⚠️ PARTIAL (HOSE) | `sector`, `industry`, `marketCap`, `trailingPE`, `priceToBook`, `returnOnEquity`, `currency=VND` present for FPT.VN **[VERIFIED]** |
| Financial statements | ⚠️ PARTIAL (HOSE) | FPT balance sheet 5 periods, 75/80 fields; income 4 periods, 47/50 **[VERIFIED]**. vnstock gives 7 periods, VN-GAAP-native |
| Valuation | ⚠️ PARTIAL | Derivable; vnstock `ratio_summary (41×61)` is richer **[VERIFIED]** |
| Corporate actions | ⚠️ PARTIAL | yfinance splits/dividends field exists; **VN accuracy unverified [ASSUMPTION]** |
| **Foreign investor flow** | ❌ **REQUIRES CUSTOM PROVIDER** | No global provider carries this. App already has it |
| **Proprietary (tự doanh) flow** | ❌ **REQUIRES CUSTOM PROVIDER** | Vietnam-specific; app lacks it too |
| **Market breadth** | ❌ **REQUIRES CUSTOM PROVIDER** | Computable from own bars |
| **Sector / index membership** | ❌ **REQUIRES CUSTOM PROVIDER** | vnstock `Listing` has ICB codes + VN30/HNX30/VN100 **[VERIFIED]** |
| Macro | ⚪ **UNVERIFIED** | econdb DNS-blocked; IMF symbol format rejected twice **[VERIFIED failures]** |
| News | ❌ UNSUPPORTED (VN) | English-only providers |

**Summary:** of 13 Vietnam data categories, OpenBB is `SUPPORTED` in **0**, `PARTIALLY SUPPORTED` in **5** (all HOSE-only), `UNSUPPORTED` in **4**, `REQUIRES CUSTOM PROVIDER` in **4**.

---

## 6. Gap Analysis — Current System vs. OpenBB

| Subsystem | Classification | Reasoning |
|---|---|---|
| VN-Index / index ingestion | **KEEP** | OpenBB has zero VN index coverage **[VERIFIED]** |
| Equity OHLCV ingestion | **KEEP** | OpenBB covers 44%; current path covers 100% and is already stale-optimized, sharded, retry-queued |
| Foreign flow ingestion | **KEEP** | No OpenBB provider exists |
| Symbol universe / tactical merge | **KEEP** | Bespoke core ∪ tactical logic with expiry/status — no OpenBB analogue |
| Normalization (kVND, UTC-midnight) | **KEEP** | Correct and VN-specific. OpenBB would add a *second* normalization pass |
| Postgres storage / Prisma | **KEEP** | **NOT APPLICABLE** to OpenBB — it is not a storage layer |
| Gate 1 regime | **KEEP** | Depends on VN-Index, which OpenBB cannot supply |
| Tradability / Gate 2 / RS / early-entry | **KEEP** | Custom, tested IP (139 test files). Replacing tested alpha logic with a generic TA extra would be a net loss |
| Market context precompute | **KEEP** | Materialized cache tuned for Neon egress (`b4da734`) |
| Portfolio / trading book / Paper Lab | **NOT APPLICABLE** | OpenBB has no portfolio-management scope |
| Arena / DNA / calibration / attribution | **NOT APPLICABLE** | Entirely bespoke |
| **Fundamentals** | **COMBINE** (prefer vnstock) | Real gap. OpenBB works for HOSE but vnstock is better for VN. Fill with vnstock; OpenBB optional secondary |
| **News / sentiment** | **KEEP GAP → vnstock** | OpenBB has no VN-language news; vnstock returns 50 rows/symbol |
| **Sector / ICB** | **KEEP GAP → vnstock** | vnstock `Listing` already carries `icb_code2` **[VERIFIED]** |
| **Macro** | ⚪ **CANDIDATE — WRAP WITH OPENBB** | The only place OpenBB is plausibly best-in-class. Unverified for VN specifically |
| Caching (`use cache`) | **KEEP** | **NOT APPLICABLE** |
| Cron / GitHub Actions | **KEEP** | OpenBB is Python too — same constraints, no gain |
| LLM agent layer | **KEEP** | See §8 |

**Where OpenBB would create unnecessary complexity or duplicate what exists:**

1. **Duplicate normalization.** `MarketContextBundle` + Zod + Prisma already standardize everything. OpenBB's Pydantic models would sit *beside* them, requiring a Pydantic→JSON→TS mapping — a third representation of the same bar.
2. **Duplicate provider abstraction.** OpenBB's core value is multiplexing many providers. This app has one, and the abstraction that matters (`source` column, `ForeignCaptureMethod`, `ForeignDataQuality` enums) already exists.
3. **A second Python runtime + service boundary.** Ingestion is already Python-in-CI. Adding `openbb-api` as a hosted service introduces a network hop, a deployment target, uptime surface, and AGPL exposure — to serve data the app already has.
4. **Unit-conversion risk.** The app is carefully kVND-based with a dedicated `price-units.ts`. OpenBB/yfinance returns raw VND. Mixing conventions in a system where stop/target math is money-critical is a real correctness hazard, not a theoretical one.

---

## 7. Proposed `VietnamProvider` Design — **NOT JUSTIFIED (do not build now)**

A custom OpenBB `VietnamProvider` is the technically "correct" way to make OpenBB work for Vietnam. It is nonetheless the wrong investment here, and I want to be explicit about why rather than just designing it.

**What it would require** (per OpenBB's provider-extension contract **[DOC]**): a Python package `openbb-vietnam` with, per endpoint, a `QueryParams` subclass, a `Data` subclass, and a `Fetcher` implementing `transform_query` / `(a)extract_data` / `transform_data`; registered via a `Provider` object and a `openbb_provider_extension` entry point.

Endpoints needed to reach parity with what the app has **today**:

| Endpoint | Backing source | Effort | Notes |
|---|---|---|---|
| `equity.price.historical` | vnstock/VCI | S | Wraps existing call |
| `index.price.historical` | vnstock/VCI | S | VNINDEX/VN30/HNX/UPCOM |
| `equity.profile` | vnstock `Company` | M | ICB sector mapping |
| `equity.fundamental.*` | vnstock `Finance` | **L** | VN-GAAP → OpenBB US-GAAP standard model is the hard part; bank vs. non-bank schemas differ |
| `equity.valuation` | vnstock `ratio` | M | |
| `equity.corporate_actions` | vnstock/manual | M | Accuracy unverified |
| **`vn.foreign_flow`** | VCI `price_board` | M | **Non-standard — no OpenBB model exists; custom `Data` only** |
| **`vn.proprietary_flow`** | ⚠️ no free source | **L** | Likely scraping — see §9 |
| **`vn.market_breadth`** | derive from own bars | S | |
| `index.constituents` | vnstock `Listing` | S | |
| `economy.*` (VN macro) | GSO / IMF / World Bank | M | |
| `news.company` | vnstock `Company.news` | S | Vietnamese-language |

**Estimated effort: 6–10 engineer-weeks** for initial build, plus continuous maintenance tracking both vnstock's API and OpenBB's core (a fast-moving AGPL project).

**Why this is not justified today:**

- It would be a **wrapper around vnstock** — the exact library already in the pipeline. Net new data: zero.
- 4 of the most valuable endpoints (foreign flow, proprietary flow, breadth, VN macro) have **no OpenBB standard model**, so they'd be custom `Data` classes anyway — i.e. OpenBB adds ceremony, not standardization, precisely where the app is most differentiated.
- It **inherits, and arguably amplifies, the vnstock license problem** (§9) by packaging and potentially publishing it.
- The VN-GAAP → OpenBB-standard fundamentals mapping is where most of the effort sits, and it is the one part that produces a *worse* result than reading vnstock directly.

**Revisit if and only if** (a) the app licenses a commercial VN vendor (FiinPro, SSI FastConnect, DNSE), *and* (b) it needs to multiplex ≥3 data sources, *and* (c) OpenBB Workspace/MCP becomes a deliberate product surface. Until all three hold, a thin internal `src/lib/market/providers/` interface in TypeScript delivers the same decoupling for ~1% of the cost.

---

## 8. AI Integration Opportunities

### Current AI architecture is already the target shape **[CODE]**

The brief proposes `sources → provider → OpenBB normalized layer → Postgres → analytics → AI agent → web`. **The app already implements this, minus OpenBB:**

```
vnstock/VCI → fetch_*.py → import-*.ts → Postgres → scanner/market-context
            → build-market-context-bundle.ts  ← THE NORMALIZED LAYER
            → agent-runner.ts → Zod AgentDecisionOutput → portfolios → UI
```

`MarketContextBundle` is versioned (`PAPER_CONTEXT_SCHEMA_VERSION`), typed, and carries price, volume, technicals, relative strength, early-entry, Gate 2 setup, market regime, liquidity, risk context, existing position, portfolio state — **and explicit `fundamentals: null` / `newsSentiment: null` slots already typed with `source: "stub" | "future_api"`** **[CODE]**. The authors anticipated exactly this gap and left a typed socket for it.

**OpenBB would not create the normalized layer. It would be a second one.**

### Against the four target queries

| Query | Feasible today? | Blocker | Does OpenBB help? |
|---|---|---|---|
| "Analyze FPT vs VN-Index over 12 months" | ⚠️ Partly | Fetch window is 200d; RS logic exists | ❌ No — OpenBB has no VN-Index. Fix = widen `--calendar-days` |
| "Compare FPT, VCB, HPG fundamentals & valuation" | ❌ No | `fundamentals: null` | ⚠️ Marginally — but vnstock does it better |
| "VN30 stocks: improving fundamentals + positive foreign flow + technical momentum" | ⚠️ 2 of 3 | Foreign flow ✅, momentum ✅, fundamentals ❌; VN30 membership not stored | ❌ No — OpenBB has neither foreign flow nor VN30 membership |
| "Bull/base/bear for FPT" | ⚠️ Partly | Needs fundamentals + news | ⚠️ Marginally |

**In 4 of 4 queries the binding constraint is fundamentals/news/VN30-membership — and in 3 of 4 the best fix is vnstock, not OpenBB.**

### The one genuinely interesting OpenBB AI angle

`openbb-mcp-server` exposes financial data as MCP tools with progressive discovery **[DOC]** — real value *if* the roadmap includes agents doing open-ended global research (US rates, oil, DXY, peer multiples). For Vietnam-specific analysis it contributes little, because the underlying providers don't cover Vietnam.

A cheaper path to the same outcome: expose the app's **own** analytics as MCP tools (`get_market_context`, `get_setup_candidates`, `get_foreign_flow`, `compare_symbols`). That serves agents Vietnam data OpenBB cannot reach, reuses tested TS logic, and adds no AGPL dependency.

**Note on the current LLM layer:** `PAPER_LAB_LLM_ENABLED` defaults false; agents run deterministic rule-based logic with zero external calls **[CODE]**. The wired provider is OpenAI/ZenMux via an OpenAI-compatible structured call. Whatever is decided on OpenBB, the LLM layer is orthogonal and currently dormant.

---

## 9. Licensing & Data-Rights Risks

Treating **software license** and **data rights** separately, as instructed.

### 9.1 🔴 P0 — `vnstock` license vs. production deployment

```
License: Custom: Personal, research, non-commercial;
         contact support@vnstocks.com for other use
Classifier: License :: Other/Proprietary License        [VERIFIED]
```

The production app has registration, login, Privacy Policy, ToS, and TikTok domain verification **[CODE]** — a public, user-facing service. This does not read as "personal, research, non-commercial."

**This is a legal question requiring a decision from you, not from me.** Options, in order of directness:
1. Email `support@vnstocks.com` and obtain written commercial permission. Cheapest if granted. vnstock also markets a paid "Insiders Program" with raised API limits (banner observed at runtime **[VERIFIED]**) — a commercial tier may already exist.
2. License a commercial VN vendor: **FiinPro/FiinTrade**, **SSI FastConnect API**, **DNSE**, **Vietstock**. Real cost, real ToS clarity, real SLA.
3. Restrict the deployment to genuinely private/personal use.

⚠️ **OpenBB does not mitigate this.** Its only VN path is yfinance → *"the Yahoo! finance API is intended for personal use only"* **[VERIFIED]**. Same class of risk, less data.

### 9.2 🟠 Undocumented upstream endpoint (reliability)

`source="VCI"` targets a broker's internal endpoints via vnstock — no published SLA, no versioning, no deprecation policy. The repo already carries scar tissue for this (`PRODUCTION_BAR_FRESHNESS_RECOVERY.md`, `PRODUCTION_DATA_INTEGRITY_INVESTIGATION.md`, retry queues, health snapshots). **Classification: public-but-undocumented, not officially licensed.** OpenBB does not improve this and its yfinance path is equally undocumented (Yahoo actively breaks it — I hit `Invalid Crumb` 401s during this audit **[VERIFIED]**).

### 9.3 🟠 OpenBB is AGPL-3.0-only **[VERIFIED]**

`openbb-core` and `openbb-yfinance` are `AGPL-3.0-only`. AGPL §13 extends copyleft to **network interaction**: users interacting with a modified AGPL work over a network must be offered its Corresponding Source.

- **Lower risk:** running unmodified `openbb-api` as a **separate process**, called over HTTP, in a batch/CI context. Widely practiced.
- **Higher risk:** modifying OpenBB, or building a custom `VietnamProvider` extension — a derivative work, distributed or network-served, plausibly triggering source-disclosure for that extension.
- **[ASSUMPTION]** The process-boundary argument is common practice but legally debated; I am not a lawyer and this needs counsel if OpenBB is adopted.

The rest of the stack is permissive (Next.js MIT, Prisma Apache-2.0, yfinance Apache-2.0), so AGPL would be the **only** copyleft dependency. **Note the irony: §7's `VietnamProvider` — the one deliverable that would make OpenBB useful here — sits squarely in the higher-risk category.**

### 9.4 🟡 `vnai` telemetry

vnstock hard-depends on `vnai>=2.4.8` **[VERIFIED]**, a usage-tracking/telemetry package, and prints promotional banners at runtime. **[ASSUMPTION]** — I did not audit what `vnai` transmits. Worth reviewing given the app's own Privacy Policy.

### 9.5 🟡 Redistribution surface

The app surfaces derived analytics (Gate scores, setups) rather than raw vendor feeds — a materially better posture than republishing quotes. But `market_context_daily` stores near-raw VN-Index OHLC. If a commercial vendor is adopted, check its redistribution/display clause before exposing values in the UI.

### 9.6 ~~🟢 Corporate-action correctness~~ — ❌ **THIS SECTION WAS WRONG. CORRECTED.**

> **Original claim (retracted):** *"No corporate-action handling exists anywhere in the schema. Un-adjusted
> historical bars will produce false breakout signals in Gate 2 and corrupt RS rankings."*
>
> **What testing actually showed:** vnstock/VCI returns **fully back-adjusted prices** — verified against
> HPG's 1.10 split on 2026-05-25 (no gap) and a two-year ratio series spanning two splits. I asserted
> "unadjusted" without testing it. The schema statement was true; the consequence drawn from it was not.
>
> **The real defects**, found only after testing:
> 1. vnstock returns adjusted prices with **raw, unadjusted volume** — corrupting the tradability
>    value floor and inflating Gate 2 volume confirmation.
> 2. **Frozen stored price levels** (`SetupWatchItem`, `Trade`, `PaperPosition`) are compared against a
>    series VCI silently re-bases after every corporate action — including cash dividends.
>
> See **§2.3 and §2.4 of [TRADING-DATA-REMEDIATION-PLAN.md](TRADING-DATA-REMEDIATION-PLAN.md)**.
> A `CorporateAction` model is still needed — for the reasons above, not the ones originally given.

---

## 10. Cost & Complexity Comparison

| Dimension | **A. Keep current** | **B. Hybrid (selective OpenBB)** | **C. OpenBB-centric** |
|---|---|---|---|
| Development effort | **0** | 2–4 wks (macro + fundamentals via `openbb-api` in CI) | **10–16 wks** (`VietnamProvider` + migration + reconciliation) |
| Maintenance | Low — 1 dep, known failure modes | Medium — +Python service, +AGPL, 2 normalization layers | **High** — track vnstock *and* OpenBB core; VN-GAAP mapping rot |
| Infrastructure | Vercel + Neon + GH Actions | +1 service or CI step | +hosted `openbb-api`, +uptime surface |
| Data cost | $0 (⚠️ license unresolved) | $0 (⚠️ **two** unresolved licenses) | $0–$$$ |
| Provider/API cost | $0 | $0 (FRED/IMF keys free) | $0 |
| Performance | Best — precomputed Postgres, egress-tuned | Slight regression (network hop) | **Worst** — extra hop + Pydantic on every read |
| Reliability | Known; retry queues + health checks | Two upstreams to fail | Worse — OpenBB covers 44% of universe, 0% of indices |
| Deployment complexity | Low | Medium | **High** |
| Licensing | 🔴 vnstock unresolved | 🔴 vnstock + 🟠 AGPL + 🟠 Yahoo | 🔴🔴 All three, maximal AGPL exposure |
| Vendor lock-in | vnstock (single point) | Reduced in theory | **Higher** — locked to OpenBB *and* still vnstock underneath |
| AI-agent readiness | Already good (`MarketContextBundle`) | Slightly better (macro, MCP) | Marginal — normalization already exists |

**Simplest architecture delivering meaningful benefit: A, extended with vnstock's own unused capabilities** — not B, and definitely not C.

Critically: **C does not even achieve its goal.** An OpenBB-centric architecture still needs vnstock underneath for VN-Index, HNX, UPCOM, and foreign flow. It adds a layer without removing a dependency — the definition of the abstraction tax the brief asked me to watch for.

---

## 11. Recommended Target Architecture

**Keep the current architecture. Close the real gaps with vnstock, which is already installed.**

```
┌─ SOURCES ───────────────────────────────────────────────────────────────┐
│  vnstock/VCI  ── OHLCV · foreign flow ────────────── [EXISTS, KEEP]     │
│  vnstock      ── Finance / Company / Listing ─────── [ADD: 3 gaps]      │
│                    · fundamentals + ratios                              │
│                    · ICB sector + VN30/HNX30/VN100 membership           │
│                    · Vietnamese company news                            │
│  (optional)   ── OpenBB `openbb-api` in CI ──────── [DEFER: macro only] │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼   GitHub Actions (unchanged)
┌─ INGEST → NORMALIZE → Postgres ─────────────────────────────────────────┐
│  + fundamentals_quarterly / fundamentals_annual                         │
│  + symbol_profile (sector, ICB, index membership)   ← fixes sector:null │
│  + corporate_actions                                ← fixes §9.6        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─ ANALYTICS (unchanged TS: Gate1/Gate2/RS/early-entry) ──────────────────┐
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─ MarketContextBundle  ← THE normalized AI layer (already exists) ───────┐
│  fundamentals: {...}   ← stub filled, `source: "future_api"` honored    │
│  newsSentiment: {...}  ← stub filled                                    │
│  symbolMeta.sector     ← populated                                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─ AI AGENTS · API · UI (unchanged) ──────────────────────────────────────┐
│  optional: expose own analytics as MCP tools (no OpenBB needed)         │
└─────────────────────────────────────────────────────────────────────────┘
```

Two principles: **fill typed sockets that already exist** rather than build a parallel layer; **add zero new runtimes, services, or copyleft dependencies.**

---

## 12. Migration Plan

There is no OpenBB migration to perform. The work that matters:

**Phase 0 — Legal (P0, blocking, non-engineering).** Contact `support@vnstocks.com` re: commercial use; in parallel price FiinPro / SSI FastConnect / DNSE. Everything below is wasted effort if the data rights fail.

**Phase 1 — Corporate actions (P1, correctness).** ⚠️ *Superseded — see §2.7 and the POC in [TRADING-DATA-REMEDIATION-PLAN.md](TRADING-DATA-REMEDIATION-PLAN.md).* Prices are already adjusted; the work is a `CorporateAction` model plus a volume-basis fix and re-basing of frozen stored levels, not "apply adjustment in bar reads".

**Phase 2 — Sector + index membership (P1, cheap, high leverage).** `Listing.symbols_by_exchange()` already returns `icb_code2`, and `symbols_by_group('VN30'|'HNX30'|'VN100')` works **[VERIFIED]**. Store on `StockSymbol`; populate `symbolMeta.sector`; unblocks sector-relative RS, `sectorExposure`, and the "VN30 screen" query. ~2–3 days.

**Phase 3 — Fundamentals (P2).** `vnstock.Finance` → `fundamentals_*` tables (quarterly + annual, separate bank/non-bank shapes); fill `MarketContextBundle.fundamentals` with `source: "future_api"`. Unblocks 3 of the 4 target AI queries. ~2 weeks.

**Phase 4 — News (P3).** `Company.news` → `symbol_news`; fill `newsSentiment`. ~1 week.

**Phase 5 — Macro (P3, the only place to reconsider OpenBB).** Evaluate `openbb-api` in CI vs. direct IMF/World Bank/GSO REST calls. **[ASSUMPTION]** direct REST likely wins on simplicity and avoids AGPL entirely.

**Rollback:** every phase is additive — new tables, nullable fields. No existing behavior changes. Any phase can be abandoned without touching the scanner.

---

## 13. POC Proposal

Since the recommendation is NO-GO on OpenBB, two POCs are proposed: one to **falsify** that verdict, one to capture the value that actually exists. **Run POC-B first.**

### POC-A — "Prove OpenBB adds value" (2 days, timeboxed, optional)

Exactly the brief's suggested scope: **VN-Index + FPT + VCB + HPG**.

1. `openbb-api` in a throwaway CI job; pull FPT/VCB/HPG via `equity.price.historical` + `equity.fundamental.balance_sheet`.
2. Reconcile OpenBB bars against `stock_daily_bars` — assert exact OHLC match and flag same-day divergence.
3. **Attempt VN-Index.** Expected: `EmptyDataError` **[already VERIFIED]**.
4. Map OpenBB fundamentals into `MarketContextBundle.fundamentals`; run one LLM query: *"Compare FPT, VCB, HPG fundamentals and valuation."*

**Kill criteria (pre-registered, any one → NO-GO confirmed):** VN-Index unavailable ✅*already met*; HNX/UPCOM unavailable ✅*already met*; OpenBB fundamentals shallower than vnstock ✅*already met*.

> All three kill criteria are **already satisfied by this audit's runtime evidence.** POC-A is offered only if you want independent confirmation before closing the question. I would skip it.

### POC-B — "Close the real gap" ✅ **Recommended** (3–4 days)

Same tight scope — **VN-Index + FPT + VCB + HPG** — demonstrating the full chain the brief asks for: *historical prices → normalized data → analytics → existing app/API → one AI analysis query.*

1. **Prices → normalized:** already live (VN-Index + all three in `stock_daily_bars`). Widen `--calendar-days` to 400 for the 12-month comparison.
2. **New data:** `vnstock.Finance('FPT'|'VCB'|'HPG')` → prototype `fundamentals_annual` + `fundamentals_quarterly`. Include VCB deliberately — it is a bank, and proves the bank/non-bank schema split early.
3. **Sector:** `Listing` ICB codes + VN30 membership → `StockSymbol`.
4. **Analytics:** RS of each vs. VN-Index over 12 months (logic exists); add a trivial fundamental-trend metric (YoY revenue/EPS).
5. **Bundle:** populate `fundamentals` and `symbolMeta.sector`. **This is the integration proof — no new normalization layer.**
6. **API/UI:** surface on the existing setup-detail surface.
7. **AI query:** with `PAPER_LAB_LLM_ENABLED=true`, run *"Analyze FPT versus VN-Index over the last 12 months, incorporating fundamentals."*

**Success criteria:** bundle carries non-null fundamentals + sector for all three; VN-Index RS computes over 12 months; bank/non-bank schemas both parse; the AI answer cites fundamental figures traceable to stored rows; **zero new services, zero new runtimes, zero AGPL dependencies.**

**What POC-B proves:** the app's existing architecture reaches the brief's target state without OpenBB — and does so in days rather than the 10–16 weeks option C would cost.

---

## 14. Final Recommendation

# 🔴 NO-GO — OpenBB as data/analytics foundation
# 🟡 PARTIAL GO — global macro only, deferred to P3, re-evaluate after Phase 4

**Does OpenBB solve a real problem, or would we just be adding another abstraction layer?**

> **Another abstraction layer.** OpenBB is well-engineered software solving a problem this app does not have — multiplexing many data providers across mostly-Western markets. This app has one provider, one market, and an existing normalized layer (`MarketContextBundle`) already serving its AI agents. OpenBB cannot supply VN-Index, HNX, UPCOM, foreign flow, proprietary flow, or market breadth — the data the app is actually built on. Where it works (HOSE equities, 44% of the universe) it returns byte-identical data the app already stores. An OpenBB-centric architecture would still require vnstock underneath: a layer added, no dependency removed.

**The real problems this audit surfaced, in priority order:**

| # | Finding | Severity | OpenBB fixes it? |
|---|---|---|---|
| 1 | vnstock licensed personal/research/**non-commercial**; app is in production | 🔴 **P0** | ❌ **No** — yfinance is personal-use-only too |
| 2 | ~~No corporate-action adjustment~~ → **corrected:** adjusted prices + *raw volume*, and frozen stored levels vs a re-based series (see remediation plan §2.3/§2.4) | 🔴 **P0** | ❌ No |
| 3 | `sector: null` despite ICB codes being one API call away | 🟠 **P1** | ❌ No — vnstock has it |
| 4 | `fundamentals: null` blocks 3 of 4 target AI queries | 🟡 **P2** | ⚠️ Partly — **vnstock does it better** |
| 5 | `newsSentiment: null` | 🟡 **P3** | ❌ No VN-language coverage |
| 6 | No macro data | 🟢 **P3** | ✅ **Yes** — the single genuine OpenBB win |

**OpenBB addresses one item on this list, and it is the least urgent one.**

**Do this next:**
1. Resolve the vnstock licensing question — email `support@vnstocks.com`, price the commercial alternatives. Nothing else matters if the data rights fail.
2. Run **POC-B** (3–4 days). It delivers the brief's exact target chain — VN-Index + FPT + VCB + HPG, prices → normalized → analytics → API → AI query — using infrastructure that already exists.
3. Fix corporate actions before the next universe expansion.
4. **Do not** build a `VietnamProvider`. Revisit only if a commercial vendor is licensed **and** ≥3 sources need multiplexing **and** OpenBB Workspace/MCP becomes a deliberate product surface.

**A closing note on what the audit found in your favor:** the ingestion pipeline is more mature than the OpenBB question implies — stale-only fetching, shard manifests, retry queues, pre/post health snapshots, production-DB assertions, egress-bounded reads, `ForeignDataQuality` provenance enums, and a versioned agent context schema with typed sockets left open for exactly the data that is missing. The gaps are in *data acquisition scope*, not architecture. OpenBB is an architecture answer to a data-rights-and-coverage problem.

---

## Appendix — Runtime Evidence Log

All probes run 2026-08-07 on this machine. Read-only; no production data written; no secrets read or printed.

| # | Probe | Result |
|---|---|---|
| 1 | `pip show vnstock` | 4.0.4 installed; `openbb` **not** installed |
| 2 | yfinance: `^VNINDEX`,`VNINDEX`,`^VNI`,`*.HM` | 0 rows (all) |
| 3 | yfinance: `FPT.VN`,`VCB.VN`,`HPG.VN`,`SSI.VN` | 24 rows each (1mo) |
| 4 | yfinance `FPT.VN` 5y | 1,305 rows from 2021-08-09 |
| 5 | vnstock `Quote('FPT','VCI')` Feb–Aug | 136 rows |
| 6 | **OHLC cross-check FPT 08-03→08-06** | **Exact match**; same-day 08-07 diverges (close 71.1 vs 71.2; vol 2.655M vs 2.543M) |
| 7 | yfinance 60-symbol random sample | 32 OK / 28 MISS |
| 8 | **yfinance 90-symbol sample by exchange** | **HSX 42/42 · UPCOM 0/39 · HNX 0/9** |
| 9 | vnstock `Listing.symbols_by_exchange()` | HSX 123 / UPCOM 117 / HNX 41 (active universe) |
| 10 | vnstock `symbols_by_group` | VN30 ✅30 · HNX30 ✅30 · VN100 ✅100 · VNMID ❌ |
| 11 | vnstock indices | VNINDEX ✅29 · VN30 ✅29 · HNXINDEX ✅29 · UPCOMINDEX ✅29 · VN30F1M ✅29 |
| 12 | vnstock `Finance('FPT')` | balance_sheet 122×7 · income 25×7 · cash_flow 41×7 · ratio 54×19 |
| 13 | vnstock `Company('FPT')` | overview 1×37 · shareholders 67×5 · officers 9×6 · subsidiaries 14×4 · news 50×21 · events 50×22 · ratio_summary 41×61 |
| 14 | yfinance `FPT.VN` `.info` | 161 keys; sector/industry/marketCap/PE/PB/ROE present; `currency=VND`, `exchange=VSE` |
| 15 | **OpenBB `YFinanceEquityHistoricalFetcher`** | FPT.VN ✅28 · VCB.VN ✅28 · HPG.VN ✅28 · SSI.VN ✅28 · BSR.VN ✅28 · **SHS.VN ❌ · ACM.VN ❌ · DDV.VN ❌ · ^VNINDEX ❌ · VNINDEX ❌** (`EmptyDataError`) |
| 16 | **OpenBB `YFinanceBalanceSheetFetcher`** | FPT.VN 5 periods, 75/80 fields · VCB.VN 5 periods, 50/52 |
| 17 | **OpenBB `YFinanceIncomeStatementFetcher`** | FPT.VN 4 periods, 47/50 · VCB.VN 5 periods, 34/36 |
| 18 | OpenBB `YFinanceKeyMetricsFetcher` | Failed — sync/async call mismatch in probe harness (not a coverage finding) |
| 19 | OpenBB `EconDbCountryProfileFetcher('vietnam')` | `ClientConnectorDNSError` — host unreachable from this environment. **UNVERIFIED** |
| 20 | OpenBB `ImfEconomicIndicatorsFetcher('vietnam')` | Symbol-format rejection ×2; `available_indicators` returned `None`. **UNVERIFIED** |
| 21 | **License metadata** | `vnstock`: *"Custom: Personal, research, non-commercial"* / Other-Proprietary · `openbb-core`,`openbb-yfinance`: **AGPL-3.0-only** · `yfinance`: Apache-2.0 |
| 22 | yfinance README legal | *"the Yahoo! finance API is intended for personal use only"*; *"not affiliated, endorsed, or vetted by Yahoo"* |
| 23 | Codebase counts | 584 tracked `src/` TS/TSX · 58 Prisma models · 28 migrations · 37 API routes · 139 test files |
| 24 | Stub confirmation | `build-market-context-bundle.ts:280-281` → `fundamentals: null`, `newsSentiment: null`; `:211,236` → `sector: null` |

**Environment caveats affecting probes 19–20:** econdb DNS was unreachable and the IMF symbol resolver rejected two formats. Vietnam macro coverage via OpenBB is therefore **genuinely unverified** — it is not evidence of absence. Since macro is a P3 nice-to-have, this does not change the recommendation, but it is the one claim in this audit I could not test.

**Sources:**
- [OpenBB Platform — GitHub README](https://github.com/OpenBB-finance/OpenBB)
- [OpenBB Docs — Providers](https://docs.openbb.co/odp/python/extensions/providers)
- [OpenBB Docs — Build Provider Extensions](https://docs.openbb.co/python/developer/extension_types/provider)
- [OpenBB Docs — Architecture Overview](https://docs.openbb.co/odp/python/developer/architecture_overview)
- [OpenBB Docs — openbb-mcp](https://docs.openbb.co/odp/python/extensions/interface/openbb-mcp)
- [openbb on PyPI](https://pypi.org/project/openbb/)
- [openbb-mcp-server on PyPI](https://pypi.org/project/openbb-mcp-server/)
- [vnstock — GitHub](https://github.com/thinh-vu/vnstock)
- [vnstock Docs — OpenBB Terminal integration](https://docs.vnstock.site/integrate/OpenBBTerminal/)
- [yfinance — GitHub README](https://github.com/ranaroussi/yfinance)
