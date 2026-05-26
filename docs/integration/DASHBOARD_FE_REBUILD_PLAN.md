# Dashboard FE Rebuild Plan

**Started:** 2026-05-25  
**Production assumptions:** Bars through **2026-05-25**, GHA import + scan automation active, smoke guardrails deployed.  
**Contracts:** [02-api-contract.md](./02-api-contract.md), [04-frontend-integration-map.md](./04-frontend-integration-map.md), [UI_UX_MOCKUP_AND_REBUILD_BLUEPRINT.md](./UI_UX_MOCKUP_AND_REBUILD_BLUEPRINT.md), [P1_FRESHNESS_LIFECYCLE_DTO_CONTRACT.md](./P1_FRESHNESS_LIFECYCLE_DTO_CONTRACT.md)

---

## 1. Current route inventory (no invented routes)

| Route | File | Setup detail? |
|-------|------|---------------|
| `/` | `src/app/page.tsx` | — |
| `/login` | `src/app/(auth)/login/page.tsx` | — |
| `/register` | `src/app/(auth)/register/page.tsx` | — |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | — |
| `/setups` | `src/app/(dashboard)/setups/page.tsx` | Inline details (no `/setups/[id]`) |
| `/trades` | `src/app/(dashboard)/trades/page.tsx` | — |
| `/trades/new` | `src/app/(dashboard)/trades/new/page.tsx` | — |
| `/trades/[id]` | `src/app/(dashboard)/trades/[id]/page.tsx` | Trade detail |

**Not in repo:** `/analytics`, `/settings`, `/setups/[id]` — recommend only after inventory (Blueprint §2 P2).

**HTTP product APIs:** None on pages — RSC + Server Actions only (`/api/db-health`, `/api/cron/*` are ops).

---

## 2. Shared FE inventory

| Category | Existing |
|----------|----------|
| Shell | `(dashboard)/layout.tsx`, `app-shell-nav.tsx`, `logout-button.tsx` |
| UI states | `error-state-with-evidence`, `empty-state-with-reason`, `stale-data-warning`, `loading-skeleton`, `backend-blocked-state` |
| Market | `market-data-alignment-banner`, `fetchMarketSessionSnapshot`, **`fetchMarketFreshnessDto`** (P1, not wired until Slice 1) |
| Setups display | `setups-candidate-health-strip`, `setups-trader-copy`, trading display labels |
| Data loaders | `setups-queries`, `prepareSurfacedCandidatesHealthView`, `momentum-watch.ts` |
| Loading | `dashboard/loading.tsx`, `setups/*-fallbacks.tsx` |

**No client data hooks** on dashboard/setups list — server components only.

---

## 3. Page-by-page rebuild plan

### `/dashboard` — **Slice 1 (this PR)** `DONE`

| | |
|--|--|
| **User goal** | Decide today’s stance, confirm data trust, scan top setups, exposure + watchlist at a glance |
| **Required data** | `getMarketRegimeFromDb`, `fetchMarketFreshnessDto`, `getLatestDailyScanRun`, `prepareSurfacedCandidatesHealthView`, `setupWatchItem`, user `trades`, scan `notes` |
| **Current problems** | Silent empty cards; alignment banner only when stale (no positive freshness); no scan run metadata; loading skeleton mismatches layout |
| **Proposed layout** | Header → freshness strip → error (partial) → **cockpit grid** (Today’s Action \| Exposure) → scan meta → Best Setups → Momentum → Watchlist → Diagnostics |
| **Reuse** | All existing loaders; P1 `MarketFreshnessDto`; UI state components |
| **Create** | `DashboardFreshnessStrip`, `DashboardScanRunMeta`, `DashboardPageHeader`, cockpit grid CSS |
| **Empty** | `EmptyStateWithReason` for zero candidates / watchlist / diagnostics |
| **Error** | `ErrorStateWithEvidence` (keep) |
| **Mobile** | Stack cockpit columns; horizontal scroll tables |

**Trading OS v2 cockpit (2026-05-25, `/dashboard` only):** `DashboardMarketStatusBar`, `DashboardDecisionHero`, `DashboardExposurePanel`, `DashboardPerformancePanel` (analytics sparkline, no chart lib), `DashboardScanMetaStrip`, `DashboardBestSetupsPanel`, `DashboardWatchlistPanel`, `DashboardDiagnosticsStack`. Preserved testids: `dashboard-freshness-ok`, `dashboard-freshness-stale`, `dashboard-scan-meta`, `dashboard-best-setups-empty`, `dashboard-watchlist-empty`, `dashboard-diagnostics-empty`, `dashboard-db-load-error`.

**Decision Cockpit UX spec:** [DASHBOARD_DECISION_COCKPIT_UX_SPEC.md](../design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md) · mockup `/design-preview/decision-cockpit`

**Decision Cockpit stack:** `37d9839` spec · `596e792` DTO · `9743847` S1 mapper · `3228344` S1 parallel compute · `857a761` **S2 verdict + evidence render** (production)

**S1/S2 integration:** [DASHBOARD_DECISION_COCKPIT_S1_INTEGRATION.md](./DASHBOARD_DECISION_COCKPIT_S1_INTEGRATION.md) · [DASHBOARD_DECISION_COCKPIT_DTO_SPIKE.md](./DASHBOARD_DECISION_COCKPIT_DTO_SPIKE.md)

**S2 scope on `/dashboard`:** `DashboardDecisionHero` + `DashboardEvidenceStack` from `cockpitDto` (`857a761`).

**S3 scope (`a9337ff`, production):** `DashboardExposurePanel` from `cockpitDto.risk` + `verdict`; `DashboardOpportunityPreview` from `cockpitDto.opportunity`; best setups table retained.

**S4 scope (production `bcbad8e`):** `DashboardActionableBlockers` + `DashboardTomorrowPlan`; legacy diagnostics stack removed from `/dashboard`.

**S5 scope (production `e58199a`):** `DashboardSetupQualityLadder` from `cockpitDto.setupQualityLadder`; Best Setups compact empty when zero surfaced rows (dedup with Opportunity preview via `resolveBestSetupsPanelPresentation`).

**S6 scope (production `945de00`):** Full Decision Cockpit IA reorder on `/dashboard` — five zones (status → decision → opportunity → execution → next-session); desktop grids; scan meta with freshness; performance demoted in execution zone; no DTO/query changes.

**S7 scope (production `744df69`):** DC-5 `riskBudgetHeadroom` DTO + exposure panel book headroom (env equity + open notional + parsed verdict cap); audit in S1 integration §13.

**S8 scope (local):** Action-first IA — verdict + compact evidence \| What next; opportunity \| visual ladder; risk \| best setups; secondary momentum/watchlist/blockers; progressive disclosure.

### `/setups` — **Slice 2** `DONE` (`f3a677e`) · **Trading OS v2 Phase 2** `DONE` (`614d53b`)

| | |
|--|--|
| **User goal** | Full pipeline table, perf + near-miss panels |
| **Data** | `setups-cached-data.ts` loaders, Suspense segments |
| **Problems** | Skeleton-only fallbacks; lifecycle DB vs computed merge unclear in UI |
| **Reuse** | Suspense boundaries, cached loaders, `SetupsPipelineContext` (P1 DTO + scan meta) |
| **Implemented** | Slice 2: `SetupsPipelineContextAsync`, `SetupsPageHeader`, improved empty states. Phase 2 (`614d53b`): summary strip, sidebar funnel + diagnostics stack, `SetupsSidebarAsync`, near-miss empty |

### `/trades` — **Slice 3** `DONE` (shell polish — see §6) · **Trading OS v2 Phase 3** `DONE` (`614d53b`)

| | |
|--|--|
| **User goal** | Review queue, filters, EOD checkpoints |
| **Data** | `prisma.trade`, health logs (Prisma post-P0), cookies |
| **Problems** | ~1955-line monolith; alignment banner only when stale; legacy empty-state markup |
| **Note** | P0E batch SQL on `/trades` deferred — **do not split monolith in Slice 3** |
| **Phase 3 (`614d53b`)** | Trades ledger header, filter chips + clear, `tos-ledger-table`, risk/context panels restyled; monolith + `$queryRaw` unchanged |

### `/trades/new` — **Slice 4B** `DONE` (stale candidate warning — see §7)

### `/trades/[id]` — **Slice 4A** `PENDING` (health timeline — see §7)

### Recommended new pages (after inventory)

| Page | Priority | Blocker |
|------|----------|---------|
| Analytics | P2 | No wired backend reads |
| Settings | P2 | No settings model |
| `/setups/[id]` | P3 | Optional; inline details may suffice |

---

## 4. Slice 1 implementation checklist

- [x] `DashboardFreshnessStrip` — P1 DTO + aligned OK state
- [x] `DashboardScanRunMeta` — run id, counts, `delayedBackdrop`
- [x] `DashboardPageHeader`
- [x] Cockpit grid + improved `loading.tsx`
- [x] `EmptyStateWithReason` on Best Setups / Watchlist / Diagnostics
- [x] Dashboard Slice 1 committed (`f5b7eea`) — pushed & production deployed
- [x] Setups page (Slice 2) — `f3a677e` pushed & production deployed
- [x] Trades page (Slice 3) — `0634571` pushed & production deployed
- [x] Trading OS v2 dashboard cockpit — `81922d6` pushed & production deployed
- [x] Trading OS v2 `/setups` pipeline + `/trades` ledger — `614d53b` pushed & production deployed (`0e82e01` docs)
- [x] Decision Cockpit S2 verdict + evidence — `857a761` pushed & production deployed
- [x] Decision Cockpit S3 exposure + opportunity — `a9337ff` pushed & production deployed
- [x] Decision Cockpit S4 diagnostics + tomorrow — `bcbad8e` pushed & production deployed
- [x] Decision Cockpit S5 ladder + best-setups dedup — `e58199a` pushed & production deployed
- [x] Decision Cockpit S6 layout reorder — `945de00` pushed & production deployed
- [x] Decision Cockpit S7 DC-5 risk headroom — `744df69` pushed & production deployed
- [ ] Decision Cockpit S8 action-first layout — local (not pushed)

---

## Production validation — Decision Cockpit S7 / DC-5 (2026-05-26)

| Check | Result | Evidence |
|-------|--------|----------|
| Commit | `744df69` | `feat(dashboard): add Decision Cockpit risk budget headroom` — 9 files only |
| Push to `main` | `744df69` | `b8c2fa8..744df69` |
| Vercel Production deploy | **Ready** | GitHub Production deployment SHA `744df69`, `2026-05-26T01:07:28Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` (HTTP 200) |
| `/dashboard` auth (logged out) | **307** → `/login` | Production `fetch(..., { redirect: 'manual' })` |
| `riskBudgetHeadroom` DTO | Deployed | `buildRiskBudgetHeadroom()` — book notional only, no R/stop math |
| Exposure — configured | When env + parseable cap | `dashboard-exposure-headroom` — equity (config), max book, open notional, remaining |
| Exposure — partial | Equity set, bad allocation string | `dashboard-exposure-headroom-partial` |
| Exposure — unavailable | No `TRADING_ACCOUNT_EQUITY_VND` | `dashboard-exposure-headroom-unavailable` + `dashboard-exposure-qualitative-hint` |
| Provenance | Honest | Equity `config` — caveats state not live broker balance |
| No fake R/stop headroom | Yes | DTO has no `riskAtStop` / R-multiple fields; panel caveats explicit |
| S1–S6 cockpit | Unchanged | Five zones, verdict, evidence, opportunity, ladder, execution, next-session |
| Backend / contracts | Unchanged | No Prisma/cron/scanner/import/API/Server Action changes |
| Tests (local pre-push) | **290/290** | +6 DC-5 tests in `decision-cockpit-dto.test.ts` |

**Logged-in smoke:** Sign in → `/dashboard` → confirm five zones; **Risk guardrail** shows headroom grid when Vercel `TRADING_ACCOUNT_EQUITY_VND` is set and verdict allocation parses, otherwise partial/unavailable copy; no live-broker equity implied; no stop/R headroom; all other cockpit panels unchanged.

**Remaining (post-cockpit):** Live broker equity sync; stop-based / R headroom — see S1 integration §13.

**Cockpit scope:** S1–S7 production-safe dashboard Decision Cockpit is **complete** for current contracts.

---

## Production validation — Decision Cockpit S6 (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Commit | `945de00` | `feat(dashboard): reorder Decision Cockpit layout` — 4 files only |
| Push to `main` | `945de00` | `ebfd0ad..945de00` |
| Vercel Production deploy | **Ready** | GitHub Production deployment SHA `945de00`, `2026-05-25T09:36:36Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` (HTTP 200) |
| `/dashboard` auth (logged out) | **307** → `/login` | Production `fetch(..., { redirect: 'manual' })` |
| Zone 1 — Status | Deployed | `dashboard-cockpit-zone-status` — freshness + scan meta (md+ side-by-side) |
| Zone 2 — Decision | Deployed | `dashboard-cockpit-zone-decision` — verdict + exposure grid; evidence full width |
| Zone 3 — Opportunity | Deployed | `dashboard-cockpit-zone-opportunity` — preview + ladder (lg+ 2-col) |
| Zone 4 — Execution | Deployed | `dashboard-cockpit-zone-execution` — best setups, momentum, watchlist, compact performance |
| Zone 5 — Next session | Deployed | `dashboard-cockpit-zone-next-session` — tomorrow + blockers (lg+ 2-col) |
| NO_TRADE polish | Deployed | `dash-cockpit__zone--no-trade` tint + hero preservation copy |
| Blockers visual weight | Demoted | Lighter title/padding in next-session zone vs verdict/opportunity |
| All S2–S5 panels | Unchanged data | Same `cockpitDto` fields and panel testids |
| Backend / contracts | Unchanged | Layout/CSS only — no Prisma/cron/scanner/import/API/Server Action changes |
| Tests (local pre-push) | **284/284** | No new tests (layout-only slice) |

**Logged-in smoke:** Sign in → `/dashboard` → confirm five zones top-to-bottom; desktop: status row, decision grid (verdict \| exposure, evidence below), opportunity \| ladder, execution block, tomorrow \| blockers; mobile stacks per DOM order; NO TRADE feels like capital preservation; blockers secondary to verdict/opportunity.

**Remaining (post-S7):** Live broker equity and stop/R headroom — see S1 integration §13.

---

## Production validation — Decision Cockpit S5 (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Commit | `e58199a` | `feat(dashboard): add Decision Cockpit setup quality ladder` — 8 files only |
| Push to `main` | `e58199a` | `b3dc34d..e58199a` (GitHub push retried after transient 500) |
| Vercel Production deploy | **Ready** | GitHub Production deployment SHA `e58199a`, `2026-05-25T09:03:53Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` (HTTP 200) |
| `/dashboard` auth (logged out) | **307** → `/login` | Production `fetch(..., { redirect: 'manual' })` |
| Verdict + evidence + exposure (S2–S3) | Unchanged | `cockpitDto` hero, evidence, exposure, opportunity panels |
| Setup quality ladder | Deployed | `dashboard-setup-quality-ladder` — six stages always visible |
| Ladder data | Honest | Counts + sample symbols from `surfacedCandidates` + `closestToValidSymbols` only; per-stage zero copy when empty |
| Best Setups dedup | Deployed | `compact_empty` when 0 rows — points to Opportunity preview; `full_table` when Tier A/B rows exist |
| `dashboard-best-setups-empty` | Preserved | Compact empty path retains testid |
| Tomorrow + blockers (S4) | Unchanged | Plan row after watchlist |
| Freshness, scan meta, momentum, watchlist | Unchanged | Below ladder / best setups |
| Layout insert | One section | Opportunity → **Setup quality ladder** → scan meta / best setups |
| Backend / contracts | Unchanged | No Prisma/cron/scanner/import/API/Server Action changes |
| Tests (local pre-push) | **284/284** | +5 in `decision-cockpit-dto.test.ts` (ladder groups, dedup) |

**Logged-in smoke:** Sign in → `/dashboard` → confirm S2–S4 panels; **Setup quality ladder** shows all six stages (Tier A through Avoid) with real symbols or “None in latest scan data”; **Best Setups** compact empty when no surfaced rows (references Opportunity preview), full table when candidates exist; freshness, scan meta, momentum, watchlist unchanged.

**Remaining (post-S7):** Live broker equity and stop/R headroom — see S1 integration §13.

---

## Production validation — Decision Cockpit S4 (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Commit | `bcbad8e` | `feat(dashboard): add Decision Cockpit diagnostics and tomorrow plan` — 8 files only |
| Push to `main` | `bcbad8e` | `567d71e..bcbad8e` |
| Vercel Production deploy | **Ready** | GitHub Production deployment SHA `bcbad8e`, `2026-05-25T08:50:36Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` (HTTP 200) |
| `/dashboard` auth (logged out) | **307** → `/login` | Production `fetch(..., { redirect: 'manual' })` |
| Verdict + evidence (S2) | Unchanged | `dashboard-decision-hero`, `dashboard-evidence-*` from `cockpitDto` |
| Exposure + opportunity (S3) | Unchanged | `dashboard-exposure-*`, `dashboard-opportunity-*` from `cockpitDto` |
| Tomorrow’s Plan | Deployed | `dashboard-tomorrow-plan` — watch / trigger / avoid / posture + `watchNote` when empty |
| Actionable blockers | Deployed | `dashboard-diagnostics-panel` — max 3, severity, meaning, count, sample symbols, wait-for |
| Legacy diagnostics on dashboard | Removed | `DashboardDiagnosticsStack` + `rejectionBuckets` slice no longer on page |
| Full Gate 2 detail | On `/setups` | Unchanged — dashboard shows actionable subset only |
| Freshness, scan meta, best setups, momentum, watchlist | Unchanged | Same panels below cockpit hero/evidence/opportunity |
| Layout | Plan row after watchlist | `dash-cockpit__plan-row` — tomorrow + blockers (2-col lg) |
| Backend / contracts | Unchanged | No Prisma/cron/scanner/import/API/Server Action changes; existing `scanNotes` path only |
| Tests (local pre-push) | **279/279** | +5 in `decision-cockpit-dto.test.ts` |

**Logged-in smoke:** Sign in → `/dashboard` → confirm verdict + evidence + exposure Gate 1 match + opportunity preview; scroll to plan row — Tomorrow’s Plan (watch/trigger/avoid/posture) and Actionable blockers (≤3 with meaning and real sample symbols when scan has rejections); freshness, scan meta, best setups, momentum, watchlist still present.

**Remaining (post-S7):** Live broker equity and stop/R headroom — see S1 integration §13.

---

## Production validation — Decision Cockpit S3 (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Commit | `a9337ff` | `feat(dashboard): align Decision Cockpit exposure and opportunity preview` — 6 files |
| Push to `main` | `a9337ff` | `ecc39a3..a9337ff` |
| Vercel Production deploy | **Ready** | GitHub Production deployment SHA `a9337ff`, `2026-05-25T08:41:43Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` (HTTP 200) |
| `/dashboard` auth (logged out) | **307** → `/login` | Production `fetch(..., { redirect: 'manual' })` |
| Legacy exposure decision removed | **Yes** | UI no longer uses `computeDailyTradingDecision` + `regime.level` for exposure panel |
| Exposure aligned to DTO | Deployed | `dashboard-exposure-panel` — `cockpitDto.risk` + `verdict.gate1Resolution` |
| Exposure testids | Deployed | `dashboard-exposure-stance`, `dashboard-exposure-max-book`, `dashboard-exposure-per-trade`, `dashboard-exposure-gate1`, `dashboard-exposure-qualitative-hint` |
| Hero/exposure Gate 1 match | **Yes** | Same canonical Gate 1; live suffix on both when mismatch |
| Opportunity preview | Deployed | `dashboard-opportunity-preview` — mode from `cockpitDto.opportunity` |
| Near-miss path (prod-like) | **near_miss** when `closestToValidSymbols` in scan notes | Real symbols only — no fabrication; prod often 0 surfaced |
| Candidates path | **candidates** when Tier A/B surfaced | `dashboard-opportunity-candidate-row`, Log trade link when READY |
| Empty path | **empty** + Setups link | `dashboard-opportunity-empty` when no surfaced and no closest rows |
| Best Setups table | Unchanged | `dashboard-best-setups-panel` retained below preview |
| Layout insert | One section | Evidence → **Opportunity preview** → scan meta; hero row unchanged |
| S2 panels preserved | Unchanged | Verdict, evidence, freshness, momentum, watchlist (S4 replaced flat diagnostics) |
| Backend / contracts | Unchanged | No Prisma/cron/actions/new queries in `a9337ff` |

**Logged-in smoke:** Sign in → `/dashboard` → confirm verdict + evidence (S2), exposure max book/stance/Gate 1 match hero, opportunity preview shows near-miss rows (e.g. HPG) or empty with Setups CTA when prod has 0 surfaced, best setups / scan meta / momentum / watchlist still present.

**Remaining (post-S4):** See S4 production validation § Remaining (S5+).

---

## Production validation — Decision Cockpit S2 (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Commit | `857a761` | `feat(dashboard): render Decision Cockpit verdict and evidence` — 4 files only |
| Prior stack on `main` | `3228344` S1 · `9743847` mapper · `596e792` DTO · `37d9839` spec | Pushed before S2 |
| Push to `main` | `857a761` | `3228344..857a761` |
| Vercel Production deploy | **Ready** | GitHub Production deployment SHA `857a761`, `2026-05-25T08:26:12Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` (HTTP 200) |
| `/dashboard` auth (logged out) | **307** → `/login` | Production `fetch(..., { redirect: 'manual' })` |
| No mock metrics | **Yes** | No `confidencePercent`, breadth %, or NEUTRAL in components |
| Verdict hero | Deployed | `dashboard-decision-hero` — `Today's verdict`, uxLevel **NO TRADE** / **PROBE** / **TRADE** |
| Capital preservation | Deployed | `dashboard-verdict-preservation` when NO_TRADE (amber hero) |
| Confidence qualitative | Deployed | `dashboard-verdict-confidence` — High / Medium / Low only |
| Gate 1 canonical (scan) | Deployed | `dashboard-verdict-gate1` — `gate1Resolution.canonical` (scan when present) |
| Gate 1 live (mismatch only) | Deployed | `dashboard-verdict-gate1-live` when scan ≠ live regime |
| Evidence stack | Deployed | `dashboard-evidence-stack`, `dashboard-evidence-chips`, `dashboard-evidence-chip-*` |
| Top blocker chips | Deployed | `dashboard-evidence-blocker-chip` (max 2 from `cockpitDto.blockers`) |
| Layout insert | One section | Evidence between hero row and scan meta row; other panels unchanged |
| Freshness / exposure / setups panels | Unchanged | `dashboard-freshness-ok`, exposure panel, best setups, momentum, watchlist, diagnostics testids preserved |
| Exposure caveat (S2) | **Resolved in S3** | Exposure now uses `cockpitDto.risk` + canonical Gate 1 — see S3 commit |
| Backend / contracts | Unchanged | No Prisma/cron/actions in `857a761` |

**Logged-in smoke:** Sign in → `/dashboard` → confirm **Today's verdict** (not legacy “Today's action” only), NO TRADE preservation line when applicable, evidence chips (Gate 1, Tier A/B, surfaced, aligned), live Gate 1 chip only if mismatch, exposure/best setups/momentum/watchlist/diagnostics still below.

---

## Trading OS v2 Phase 2+3 — Setups + Trades (2026-05-25)

**Commit:** `614d53b` — `feat(ui): apply Trading OS visual system to setups and trades`

| | |
|--|--|
| **Scope** | `/setups` and `/trades` only (+ shared `globals.css` `.tos-*`; reuses dashboard `DashboardMarketStatusBar`, `DashboardScanMetaStrip`) |
| **Routes unchanged** | No `/setups/[id]`, `/analytics`, `/settings`; `/trades/new`, `/trades/[id]` logic untouched |
| **Backend** | No Prisma/schema/cron/import/scanner/Server Action changes |

### `/setups` — pipeline workspace

- Page header (no “Run Scan Now” / Scanner Settings — no production actions)
- Compact market status + scan meta via `SetupsPipelineContext` (`setups-pipeline-context`)
- Pipeline summary strip (`setups-pipeline-summary`) — counts labeled **remaining after stage**
- Sidebar: today’s action, vertical funnel (`setups-pipeline-funnel`), flat diagnostics stack (`setups-diagnostics-panel`, `setups-diagnostics-stack`, `setups-diagnostics-empty`)
- Candidates panel + near-miss empty (`setups-near-miss-empty`) when no closest symbols
- READY → `/trades/new?setupCandidateId=...` preserved
- Suspense + `setups-cached-data.ts` loaders unchanged

### `/trades` — professional ledger

- Header “Trades ledger” + count (`trades-page-header`, `trades-header-count`) + CTA `/trades/new`
- `TradesFreshnessContext` → market bar + scan meta strip
- Filter bar with active chips + clear all (`trades-active-filters`, `trades-clear-filters`)
- Dense ledger table (`tos-ledger-table`); right-aligned numerics; no fees column
- Explicit Edit links (no mandatory row navigation)
- Monolith `page.tsx`, 3× `$queryRaw`, review-session params/cookies/filters/warnings unchanged

### Testids preserved / added

| Route | Preserved | Added |
|-------|-----------|-------|
| `/setups` | `setups-pipeline-context`, `setups-candidates-empty`, `setups-overview-no-scan-run`, `setups-overview-db-banner*`, `setups-diagnostics-empty` | `setups-pipeline-summary`, `setups-pipeline-funnel`, `setups-diagnostics-panel`, `setups-diagnostics-stack`, `setups-near-miss-empty` |
| `/trades` | `trades-page-header`, `trades-header-count`, `trades-freshness-context`, `dashboard-freshness-ok`/`stale`, `dashboard-scan-meta`, `trades-db-load-error`, `trades-ledger-empty`, `trades-ledger-empty-filtered`, `trades-table`, `trades-scroll-container`, review-session ids | `trades-clear-filters`, `trades-active-filters` |

### Pre-push validation (`614d53b`)

| Check | Result |
|-------|--------|
| `npm run lint` | Pass |
| `npm test` | **261/261** pass |
| `npm run build` | Pass |
| Playwright | `tests/trades-table-layout.spec.ts` — h1 **“Trades ledger”** |

### Visual compromises (vs design mockup)

- No Run Scan Now / Scanner Settings on `/setups`
- Funnel counts labeled as remaining-after-stage (not rejection totals)
- Diagnostics use flat stack (not accordion mockup)
- No fees column on ledger
- No mandatory row click-through on `/trades`
- Near-miss empty state when no closest symbols

---

## Production validation — Trading OS v2 Phase 2+3 (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Feature commit | `614d53b` | `feat(ui): apply Trading OS visual system to setups and trades` — 20 files, `/setups` + `/trades` only |
| Docs commit | `0e82e01` | `docs: record Trading OS v2 Phase 2+3 setups and trades integration` |
| Push to `main` | `0e82e01` | `04b6ce1..0e82e01` (includes `614d53b`) |
| Vercel Production deploy | **Ready** | GitHub Production deployment SHA `0e82e01`, `2026-05-25T07:45:22Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` (HTTP 200) |
| `/setups` auth (logged out) | **307** → `/login` | Production `fetch(..., { redirect: 'manual' })` |
| `/trades` auth (logged out) | **307** → `/login` | Production `fetch(..., { redirect: 'manual' })` |
| Market data aligned (data) | **Yes** (baseline) | Prior prod probe: bars **2026-05-25**, `delayedBackdrop: false` — local `ops:verify-bar-import` unreachable (P1001) this session |
| Latest scan id (data) | **`cmpku2jyq000004l42cv873wq`** (baseline) | Same prod probe as dashboard validation |
| `/setups` pipeline context | Deployed in `614d53b` | `setups-pipeline-context`, `setups-pipeline-summary`, `setups-pipeline-funnel`, `setups-diagnostics-stack` |
| `/setups` candidate / near-miss empties | Deployed | `setups-candidates-empty`, `setups-near-miss-empty`, `setups-overview-no-scan-run` |
| `/trades` ledger header | Deployed | `trades-page-header`, h1 **Trades ledger**, `trades-header-count` |
| `/trades` freshness + scan meta | Deployed | `trades-freshness-context` → `dashboard-freshness-ok` / `dashboard-scan-meta` |
| `/trades` filters | Deployed | `trades-active-filters`, `trades-clear-filters` |
| `/trades` ledger table + scroll | Deployed | `trades-table`, `trades-scroll-container`, `min-w-[1840px]` |
| `/trades` empty / warning panels | Deployed | `trades-ledger-empty`, `trades-ledger-empty-filtered`, `trades-review-queue`, open-position warnings unchanged |
| `/trades/new`, `/trades/[id]` | Not touched | Out of `614d53b` scope |
| Backend / contracts | Unchanged | No Prisma/cron/actions in `614d53b` |
| Mobile | CSS unchanged pattern | `tos-setups-grid` stacks; `table-container` / `trades-scroll-container` horizontal scroll |

**Logged-in smoke:** Sign in → `/setups` → compact market bar + scan chips, pipeline summary strip (remaining-after-stage labels), sidebar funnel + flat diagnostics, candidates or `setups-candidates-empty`, near-miss block or `setups-near-miss-empty`. → `/trades` → **Trades ledger** header + Log Trade, freshness strip, filter chips when active, ledger rows, filter-empty vs true-empty, review-session + warning panels, horizontal scroll on narrow viewport.

**Unstaged locally (not pushed):** `docs/design/`, `src/app/design-preview/`, `.superpowers/`

---

## Production validation — Trading OS v2 Dashboard Cockpit (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Commit | `81922d6` | `feat(dashboard): apply Trading OS cockpit visual system` |
| Push to `main` | `81922d6` | `e75f0f9..81922d6` |
| Vercel Production deploy | **Ready** | SHA `81922d6`, `2026-05-25T07:31:01Z` |
| `/api/db-health` | `{"ok":true}` | Production URL |
| `/dashboard` auth (logged out) | **307** → `/login` | Production curl |
| Market data aligned (data) | **Yes** | `ops:verify-bar-import`: bars **2026-05-25**, `delayedBackdrop: false` |
| Latest scan id (data) | **`cmpku2jyq000004l42cv873wq`** | `latestNonSmokeScan.id` |
| 0 surfaced candidates (data) | **0** | Intentional empty state path on prod |
| Compact market status | Deployed | `dashboard-freshness-ok` on `DashboardMarketStatusBar` (chip layout) |
| Decision hero | Deployed | `dashboard-decision-hero` — amber NO_TRADE surface when aligned data shows capital preservation stance |
| Scan meta strip | Deployed | `dashboard-scan-meta` chips (replaces full-width debug grid on `/dashboard` only) |
| Best setups empty | Deployed | `dashboard-best-setups-empty` — compact panel + Setups link |
| Watchlist empty | Deployed | `dashboard-watchlist-empty` |
| Diagnostics | Deployed | `dashboard-diagnostics-stack` / `dashboard-diagnostics-empty` |
| Momentum | Unchanged component | `MomentumWatchSection` still on page |
| Secondary performance | Deployed | `dashboard-performance-panel`, optional `dashboard-equity-sparkline` |
| Backend / other routes | Unchanged | No Prisma/cron/actions diff; `/setups`, `/trades*` not in commit |
| Mobile | CSS stack order | `dash-cockpit` → hero row → secondary row → panels; tables `table-container` scroll |

**Logged-in smoke:** Sign in → `/dashboard` → confirm compact aligned status bar, NO TRADE (or current) decision hero, exposure panel, scan chips with `cmpku2jyq…`, compact best-setups empty, momentum section, watchlist empty, diagnostics stack when rejection notes exist.

---

## Production validation — Dashboard Slice 1 (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Push to `main` | `f5b7eea` | `39c4dd5..f5b7eea` |
| Vercel Production deploy | **Ready** | SHA `f5b7eea`, `2026-05-25T06:44:31Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` |
| `/dashboard` auth | Redirects to `/login` | Expected — session required |
| Market data aligned (data) | **Yes** | `npm run ops:verify-bar-import`: VNINDEX/equity **2026-05-25**, `delayedBackdrop: false` |
| Latest scan id (data) | **`cmpku2jyq000004l42cv873wq`** or newer | Same probe / GHA run #26386350438 |
| 0 best setups UX | `EmptyStateWithReason` + link to `/setups` | `data-testid="dashboard-best-setups-empty"` in `f5b7eea` |
| Diagnostics | Gate 2 rejection accordion when notes present | Unchanged loader; shows when `topRejectionCategories` populated |
| Log Trade | `DashboardPageHeader` → `/trades/new` | `f5b7eea` |
| Mobile | Cockpit grid stacks; tables scroll horizontally | `dashboard-cockpit-grid` + `table-container` |

**Logged-in smoke:** Sign in at `/login`, then confirm `dashboard-freshness-ok`, `dashboard-scan-meta`, and empty Best Setups copy on production.

---

## Production validation — Setups Slice 2 (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Push to `main` | `f3a677e` | `f5b7eea..f3a677e` |
| Vercel Production deploy | **Ready** | SHA `f3a677e`, `2026-05-25T06:47:20Z` |
| `/api/db-health` | `{"ok":true}` | Production URL |
| `/setups` auth | **307** → `/login` | Expected — session required |
| `/dashboard` auth | **307** → `/login` | Unchanged post-`f3a677e` |
| Market data aligned (data) | **Yes** | `ops:verify-bar-import`: bars **2026-05-25**, `delayedBackdrop: false` |
| Latest scan id (data) | **`cmpku2jyq000004l42cv873wq`** | `latestNonSmokeScan.id` in verify probe |
| Pipeline context (code) | `data-testid="setups-pipeline-context"` | `SetupsPipelineContext` → `DashboardFreshnessStrip` + `DashboardScanRunMeta` |
| No duplicate alignment banner in overview | **Yes** | No `MarketDataAlignmentBanner` under `src/app/(dashboard)/setups/` |
| Candidate empty state | Scan id prefix, Gate 1, tradability count | `setups-candidates-empty` in `setups-candidates-async.tsx` |
| No-scan empty state | References GHA “Production bar import” | `setups-overview-no-scan-run` |
| Suspense segments | Unchanged boundaries + `SetupsPipelineContextFallback` | `setups/page.tsx`, `setups-stream-fallbacks.tsx` |
| Partial/error paths | `ErrorStateWithEvidence` testids preserved | `setups-overview-db-banner*`, `setups-candidates-partial-data` |
| Mobile | Reuses dashboard freshness/scan-meta CSS; tables use `table-container` | `globals.css` cockpit/freshness classes |

**Logged-in smoke:** Sign in, open `/setups`, confirm `setups-pipeline-context` shows aligned freshness OK strip and scan meta (`cmpku2jyq…` or newer), overview has no second alignment banner, and candidate empty copy matches Gate 1 + tradability when count is 0.

**Dashboard re-check (post-`f3a677e`):** Same data probe; `/dashboard` still redirects when logged out; Slice 1 components unchanged in `f5b7eea` files.

---

## Production validation — Trades Slice 3 (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Plan commit on `main` | `512b039` | Docs-only Trades Slice 3 plan + Setups validation |
| Feature commit | `0634571` | `feat(trades): add freshness context, header, and ledger empty states` |
| Vercel Production deploy | **Ready** | SHA `0634571`, `2026-05-25T06:55:27Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` |
| `/trades` auth (logged out) | **307** → `/login` | Production curl |
| Market data aligned (data) | **Yes** | `ops:verify-bar-import`: bars **2026-05-25**, `delayedBackdrop: false` |
| Latest scan id (data) | **`cmpku2jyq000004l42cv873wq`** | `latestNonSmokeScan.id` in verify probe |
| `TradesPageHeader` | Deployed | `data-testid="trades-page-header"`, `trades-header-count` |
| Log Trade CTA | `/trades/new` | `TradesPageHeader` primary button |
| Freshness context | Deployed | `data-testid="trades-freshness-context"` → `dashboard-freshness-ok` when aligned |
| Scan meta | Deployed | `dashboard-scan-meta` via `TradesFreshnessContext` |
| Ledger empty states | Deployed | `trades-ledger-empty` / `trades-ledger-empty-filtered` |
| Monolith + `$queryRaw` | Unchanged | No edits to health-log SQL blocks in `0634571` |
| Alignment banner (open) | Unchanged | `MarketDataAlignmentBanner` when `showBanner` still in `page.tsx` |
| Review session / filters | Unchanged | `reviewSession`, `TradeFilters` Suspense, cookie snapshot persist |
| Table / mobile | Unchanged | `trades-scroll-container`, `min-w-[1840px]`, `trades-ledger-scroll-hint` |
| Playwright contract | Updated in `614d53b` | `tests/trades-table-layout.spec.ts` expects **Trades ledger** h1 + `3 trades` |
| `/trades/new`, `/trades/[id]` | Not touched | `0634571` diff scope |

**Logged-in smoke:** Sign in → `/trades` → confirm header count matches ledger rows, aligned freshness OK strip, scan meta id prefix `cmpku2jyq…`, table loads seeded/historical trades, filter to zero rows shows `trades-ledger-empty-filtered`, review-session toggle and open-position warnings still behave.

---

## 6. Trades Slice 3 — inventory and low-risk plan

**Scope rule:** Existing routes only (`/trades`, `/trades/new`, `/trades/[id]`). No `/analytics`, `/settings`, `/setups/[id]`. No page-level REST. **Do not** extract the monolith into route segments unless a later slice proves a safe cut point.

### 6.1 Route inventory (traced)

| Route | File | Lines (approx.) | Data / actions |
|-------|------|-----------------|----------------|
| `/trades` | `src/app/(dashboard)/trades/page.tsx` | ~1955 | `prisma.trade.findMany` (user-scoped); `fetchMarketSessionSnapshot` + `analyzeMarketDataAlignment`; `loadOpenPositionMarks`; **3× `$queryRaw`** on `trade_health_logs` (checked-today, latest per trade, weekly checklist agg); bar batch via `fetchLatestTwoClosesByTradeSymbols` / `fetchBarCloseOnOrBeforeReviewBatch`; cookies `bookOperatingSnapshot`; `dynamic = "force-dynamic"` |
| `/trades/new` | `src/app/(dashboard)/trades/new/page.tsx` | ~106 | Optional `setupCandidateId` → `prisma.setupCandidate` + `setupWatchItem`; `TradeForm` → `createTrade` Server Action |
| `/trades/[id]` | `src/app/(dashboard)/trades/[id]/page.tsx` | ~816 | `prisma.trade.findFirst`; `loadTradeHealthLogsForDetailPage` (typed Prisma); `fetchMarketSessionSnapshot`; `MarketDataAlignmentBanner` when stale; `TradeForm` → `updateTrade`; `addTradeHealthCheckpoint`; `deleteTrade` |

**Colocated UI (not separate routes):** `trade-filters.tsx` (client, `useSearchParams`), `review-session-chrome.tsx`, `focus-review-workspace.tsx`, `open-position-review-cell.tsx`, `operating-snapshot-persist.tsx`, `loading.tsx`.

**Server libs (`src/lib/trades/*`):** review queue/session (`review-priority-queue`, `review-session-queue`), operating book (`book-operating-context`, `book-clusters`, `operating-posture`, `operating-trend-discipline`), position intel (`open-position-intelligence`, `position-health`, `position-state-evolution`), EOD (`eod-review-workflow`, `trade-health-review-checklist`), derived ledger (`trades-ledger-row-derived`), health logs (`trade-health-logs`).

**Server Actions:** `src/app/actions/trades.ts` — `createTrade`, `updateTrade`, `deleteTrade`, `addTradeHealthCheckpoint`, `checkTradeEntryPriceAlignment`.

### 6.2 Current UX / state gaps (vs Dashboard/Setups slices)

| Area | Today | Slice 3 target |
|------|-------|----------------|
| Market trust | `MarketDataAlignmentBanner` only when `showBanner` (stale/misaligned) | Add **`TradesFreshnessStrip`** (reuse `DashboardFreshnessStrip` + `fetchMarketFreshnessDto`) at top of `/trades`; keep banner for open-position mark warnings |
| Empty states | Legacy `.empty-state` div on ledger zero | Migrate to **`EmptyStateWithReason`** (filter vs true zero) — same copy, better evidence styling |
| Errors | `ErrorStateWithEvidence` for partial DB load (`trades-db-load-error`) | Keep; ensure health-log batch failures surface a **non-blocking** note when `$queryRaw` skips (optional one-liner, no contract change) |
| Loading | `loading.tsx` skeleton | Light refresh to match header + freshness strip layout (no behavior change) |
| `/trades/new` | No freshness context | Optional slim strip or link-back only — **defer stale `setupCandidateId` guard** to Slice 4 per `06-backend-gaps.md` §10 |
| `/trades/[id]` | Alignment banner + silent health load catch | Slice 4: loud health read failures; Slice 3 touch only if adding shared freshness strip without changing forms |

### 6.3 P0E / backend constraints (from `06-backend-gaps.md`)

- **Keep** the three `$queryRaw` blocks on `/trades` until a dedicated backend slice migrates them to `tradeHealthLog` Prisma aggregations.
- **Do not** change Server Action payloads, trade schema, or health checkpoint shape.
- **Do not** add REST routes for trades.

### 6.4 Proposed Slice 3 implementation checklist (frontend only)

1. **`TradesPageHeader`** — title, trade count, primary CTA → `/trades/new` (mirror dashboard/setups headers).
2. **`TradesFreshnessContext`** — server segment or inline block: `fetchMarketFreshnessDto` + optional latest scan meta (read-only, same as setups) at top of `/trades` **without** moving ledger logic out of `page.tsx`.
3. **Empty state** — replace ledger empty markup with `EmptyStateWithReason` + existing CTAs.
4. **`loading.tsx`** — align skeleton with header + freshness strip.
5. **CSS** — reuse `.dashboard-freshness-*` / `.dashboard-scan-meta` classes (no new design system).
6. **Tests** — extend `tests/trades-table-layout.spec.ts` only if new `data-testid`s added; keep Playwright seed path unchanged.

**Explicitly out of Slice 3:** monolith file split, Suspense segmentation of ledger, review-session refactor, P0E SQL → Prisma migration, `/trades/new` stale-candidate validation, `/trades/[id]` health timeline redesign.

### 6.5 Slice 4 preview (superseded by §7)

See **§7** for chosen slice order and acceptance criteria.

---

## 7. Trades Slice 4 — recommendation (post–Slice 3 prod validation)

**Deferred (unchanged):** P0E `$queryRaw` → Prisma on `/trades` monolith; route split; new product routes.

### Option comparison

| | **4B — `/trades/new`** | **4A — `/trades/[id]`** |
|--|------------------------|-------------------------|
| **Problem** | `setupCandidateId` from any past scan still prefills form (`06-backend-gaps.md` §10) | Health timeline uses plain empty copy; `loadTradeHealthLogsForDetailPage` **silent catch** masks DB read failures |
| **Files** | `trades/new/page.tsx` (~106 lines), optional shared warning component | `trades/[id]/page.tsx` (~816 lines), `trade-health-logs.ts` (return `readError` flag) |
| **Data contract** | Compare `candidate.scanRunId` to `getLatestDailyScanRun()?.id` — **warn first** (no hard reject until product approves) | Extend loader result with optional `readError`; no checkpoint schema change |
| **Reuse** | `StaleDataWarning` or `EmptyStateWithReason`, `getLatestDailyScanRun` | `EmptyStateWithReason`, `ErrorStateWithEvidence`, optional `TradesFreshnessContext` for OPEN trades |
| **Risk** | **Lower** — isolated page, no ledger/review-session surface | Medium — larger page but localized to header + health block |
| **E2E** | New test: stale id query shows warning, still allows submit | Extend detail smoke or unit test on loader error path |

### **Recommended sequence**

1. **Slice 4B** (`/trades/new`) — stale-candidate **warning** strip when `setupCandidateId` exists but `scanRunId !== latestNonSmokeScan.id`; keep prefill behavior unless user clears; link to `/setups` / Dashboard.
2. **Slice 4A** (`/trades/[id]`) — health timeline data states: `ErrorStateWithEvidence` on read failure (not “no checkpoints”); `EmptyStateWithReason` for true zero logs; optional P1 freshness strip for **OPEN** only; keep `addTradeHealthCheckpoint` form unchanged.

**Not in Slice 4:** monolith split, P0E migration, REST APIs, hard reject of stale candidates without explicit approval.

### Slice 4B checklist — `DONE`

- [x] Load latest non-smoke scan via `getLatestDailyScanRun()` alongside candidate lookup
- [x] Compare `candidate.scanRunId` to latest id (`resolveStaleSetupCandidateNotice`)
- [x] `data-testid="trades-new-stale-candidate-warning"` when stale; `trades-new-setup-current` when current
- [x] `data-testid="trades-new-scan-lookup-unavailable"` when latest scan lookup fails (non-blocking)
- [x] `StaleSetupCandidateWarning` — soft warn only; prefill + `createTrade` unchanged
- [x] Unit tests: `src/lib/trades/stale-setup-candidate.test.ts`
- [x] Committed & pushed (`b07b116`) — production deployed

---

## Production validation — Trades Slice 4B (2026-05-25)

| Check | Result | Evidence |
|-------|--------|----------|
| Commit scope | 5 files only | `b07b116`: `stale-setup-candidate*`, `stale-setup-candidate-warning.tsx`, `trades/new/page.tsx`, plan doc — no `.env`, no `src/app/actions/trades.ts` |
| Push to `main` | `b07b116` | `18bb425..b07b116` |
| Vercel Production deploy | **Ready** | SHA `b07b116`, `2026-05-25T07:06:14Z` |
| `/api/db-health` | `{"ok":true}` | `https://tradingbook-phi.vercel.app/api/db-health` |
| `/trades/new` auth (logged out) | **307** → `/login` | Production curl |
| Latest scan (data) | **`cmpku2jyq000004l42cv873wq`** | `ops:verify-bar-import` `latestNonSmokeScan.id` |
| `trades-new-stale-candidate-warning` | Deployed | `StaleSetupCandidateWarning` when `scanRunId !== latest` |
| `trades-new-setup-current` | Deployed | Form card `data-testid` when prefill current |
| `trades-new-scan-lookup-unavailable` | Deployed | Non-blocking panel when `getLatestDailyScanRun` fails |
| `createTrade` / Server Actions | Unchanged | No diff in `src/app/actions/trades.ts` in `b07b116` |
| `/trades`, `/trades/[id]` | Unchanged | Not in `b07b116` diff |
| Hard reject stale candidate | **No** | Warning only; form prefill preserved |
| Unit tests | **261** passed | Includes `stale-setup-candidate.test.ts` (6 cases) |

**Logged-in smoke:**

1. `/trades/new` — no query param → no warning; form empty/default.
2. `/trades/new?setupCandidateId=<id from latest scan>` — `trades-new-setup-current` on card; linked setup label; no stale warning (production has 0 surfaced candidates — use any `setup_candidates` row where `scan_run_id = cmpku2jyq…` if present, or seed locally).
3. `/trades/new?setupCandidateId=<id from older scan_run_id>` — `trades-new-stale-candidate-warning` with scan id prefixes; form still prefilled; submit still calls `createTrade`.

**SQL to find smoke ids (Neon):** latest scan `SELECT id FROM daily_scan_runs ORDER BY run_at DESC LIMIT 5`; stale candidate `SELECT id, scan_run_id FROM setup_candidates WHERE scan_run_id != '<latestId>' LIMIT 1`.

### Slice 4A checklist (after 4B)

- [ ] `loadTradeHealthLogsForDetailPage` returns `{ readError?: string }` on catch
- [ ] Detail page surfaces `ErrorStateWithEvidence` vs empty timeline
- [ ] `data-testid` on health timeline block
- [ ] Optional `TradesFreshnessContext` when `trade.status === "OPEN"`

---

## 5. Validation

```bash
npm run lint
npm test
npm run build
```

Smoke: `/dashboard`, `/setups`, `/trades` (auth redirect when logged out).
