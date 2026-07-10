# Dashboard Decision Cockpit — UX Spec

**Status:** IMPLEMENTED on `/dashboard` (UI overhaul engagement, reviewed and approved for implementation).
**Date:** 2026-05-25 (proposed) · sign-off below dated at implementation.
**Audience:** Product + FE rebuild
**Related:** [TRADING_OS_V2_VISUAL_SPEC.md](./TRADING_OS_V2_VISUAL_SPEC.md), [DASHBOARD_FE_REBUILD_PLAN.md](../integration/DASHBOARD_FE_REBUILD_PLAN.md), [06-backend-gaps.md](../integration/06-backend-gaps.md)

## Implementation sign-off

Reviewed against the shipped codebase before implementation. Findings that justified proceeding:

- **Data dependencies were already real.** `buildDecisionCockpitDto()` (`src/lib/dashboard/decision-cockpit-dto.ts`) already computed every field this spec's blocks need — verdict, evidence, opportunity board, setup quality ladder, risk guardrail + budget headroom, tomorrow's plan, actionable diagnostics — but nothing on the live route assembled or rendered them. The component family that reads this DTO (`src/components/dashboard/dashboard-*.tsx`) already existed too, fully built, just never wired into a route.
- **The fields this spec itself flagged as "mock/gap" (§10) are correctly absent from the shipped DTO**: no breadth %, no numeric confidence % (only a `high`/`medium`/`low` band, via `computeConfidenceBand`), no fabricated "NEUTRAL" badge.
- **DC-1 (canonical Gate 1 source)** is resolved: `resolveCanonicalGate1()` picks the scan run's `gate1Level` when a scan exists, else the live regime — a single source for both verdict and evidence, as this spec required.
- **NORMAL → TRADE** vocabulary mapping is implemented via `mapDecisionLevelToUxVerdict()`.

Implementation promoted the existing `dashboard-*` panel family into a single assembler, `src/components/dashboard/dashboard-decision-cockpit.tsx`, wired from `src/app/(dashboard)/dashboard/page.tsx`, replacing the previously-live `command-deck` "cyber" dashboard (now retired). One net-new component was added to close a real gap: `dashboard-opportunity-candidates.tsx`, which renders `opportunity.mode === "candidates"` (Tier A/B surfaced setups) — no existing component covered that case, only the near-miss path.

Verified via `npm run lint`, `npx tsc --noEmit`, `npm test` (789/789 passing), `npx next build`, and live browser verification of a real authenticated session (verdict, evidence, opportunity board, risk rail, setup quality ladder, tomorrow's plan, and both collapsed secondary sections all render with real data, zero console errors).

---

## 0. Problem statement

The current `/dashboard` (Trading OS v2 cockpit, commit `81922d6` + polish) is **visually coherent** but still behaves like a **scanner summary page**:

- The trader must infer “what to do today” from several panels (decision hero, exposure, best setups, momentum, watchlist, diagnostics).
- **Near-miss context** exists in scan notes but is **not on the dashboard** (only `/setups`).
- **Diagnostics** are informative for engineers, weakly prioritized for **next action**.
- **Setup quality** is split across `quality` (A/B), `lifecycleSortLabel` (READY/WATCHING), `healthLevel`, and momentum groups — not one **ladder** the trader can trust.
- Verdict vocabulary uses `NORMAL` internally while traders think **TRADE / PROBE / NO_TRADE**.

**Product goal:** Answer within **10 seconds**:

1. Should I trade today?
2. If yes, what should I trade and why?
3. If no, what risk is the system protecting me from, and what should I watch next?

---

## 1. Information architecture (proposed)

Single vertical narrative — **verdict → evidence → opportunities → guardrails → tomorrow**. Secondary analytics demoted.

| Block | Purpose | Answers question |
|-------|---------|------------------|
| **A. Trust strip** | Data + scan validity | “Can I trust this page?” |
| **B. Today’s Verdict** | NO_TRADE / PROBE / TRADE + rationale + caps | Q1 |
| **C. Evidence Stack** | 5–7 chips linking verdict to scanner/regime facts | Q1 + Q3 (why) |
| **D. Opportunity Board** | Tier A/B actions OR near-miss + watch path | Q2 or Q3 (what’s next) |
| **E. Setup Quality Ladder** | Unified stage per symbol (max 5–8 rows) | Q2 (why this name) |
| **F. Risk Guardrail** | Behavior rules tied to verdict | Q1 + Q3 (what risk) |
| **G. Tomorrow’s Plan** | Watch symbols, triggers, avoid rules | Q3 |
| **H. Book snapshot** (collapsed by default) | Closed-trade P&L curve | Historical context only |

**Remove or demote on dashboard:**

- **Momentum Watch** as a full-width primary section → link to Setups tail or fold top 3 rows into Opportunity Board “extended context”.
- **Diagnostics** as a flat rejection list → rewrite as **Actionable blockers** (see §6).
- **Performance panel** in hero row → §H footer.

**Scan meta:** Fold into Trust strip + Evidence (not a standalone row competing with verdict).

---

## 2. Dashboard block layout (desktop)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Header: Decision Cockpit · Log Trade · session sync line                │
├─────────────────────────────────────────────────────────────────────────┤
│ A. Trust strip: VNINDEX date · Gate 1 · aligned/stale · scan age · run id │
├─────────────────────────────────────────────────────────────────────────┤
│ B. Today's Verdict (full width, stance-colored left rail)               │
│    headline · one sentence · confidence band · max book % · per-trade % │
├─────────────────────────────────────────────────────────────────────────┤
│ C. Evidence Stack (horizontal chips, tap/expand for detail)             │
├──────────────────────────────┬──────────────────────────────────────────┤
│ D. Opportunity Board (8/12)   │ F. Risk Guardrail (4/12)                 │
│  - Tier A/B cards OR          │  - caps · no-chase · stop distance       │
│  - Near-miss queue OR         │  - preservation copy when NO_TRADE       │
│  - empty + “what must change” │                                          │
├──────────────────────────────┴──────────────────────────────────────────┤
│ E. Setup Quality Ladder (compact table, same symbols as D)              │
├─────────────────────────────────────────────────────────────────────────┤
│ G. Tomorrow's Plan (bullets: watch · trigger · avoid · posture)         │
├─────────────────────────────────────────────────────────────────────────┤
│ H. Book snapshot (collapsible): equity sparkline + closed stats         │
└─────────────────────────────────────────────────────────────────────────┘
```

Mobile: A→B→C stacked; D and F stack; E full width; G; H collapsed.

---

## 3. Today’s Verdict (Block B)

### 3.1 Verdict levels (UX vocabulary)

Map persisted scanner levels to trader-facing labels:

| Persisted (`DailyTradingDecision.level`) | UX label | Meaning |
|------------------------------------------|----------|---------|
| `NO_TRADE` | **NO TRADE** | Do not initiate new swing risk today |
| `PROBE` | **PROBE** | Only reduced-size, selective new risk |
| `NORMAL` | **TRADE** | Normal disciplined new risk allowed (rename in UI only) |

**Source:** `scanNotes.decision` if present, else `computeDailyTradingDecision()` (`src/lib/scanner/trading-decision.ts`). Persisted on `DailyScanRun.notes.decision` at scan time.

**Known inconsistency (fix in implementation):** Dashboard fallback uses `regime.level` from `getMarketRegimeFromDb()` while Setups uses `latestScan.gate1Level`. Spec requires **one canonical Gate 1 source** for verdict + evidence (recommend: scan run’s `gate1Level` when scan exists, else live regime).

### 3.2 Copy templates (use `decision.explanation` when present)

**NO TRADE — Gate 1 FAIL**

> **NO TRADE** — Market backdrop is unfavorable.  
> One line: `{decision.explanation}`  
> Max book: **0%** · Per trade: **none**  
> Evidence: Gate 1 **Fail** · Surfaced **0** · Protecting against weak index trend.

**NO TRADE — Gate 1 PASS, zero setups**

> **NO TRADE** — Backdrop is supportive but the scanner found no Tier A/B setups.  
> One line: `{decision.explanation}`  
> Max book: **0%** · Per trade: **none**  
> Evidence: Gate 1 **Pass** · Tier A **{countA}** · Tier B **{countB}** · Surfaced **{surfaced}**.

**PROBE — Gate 1 WARNING + Tier A**

> **PROBE** — Mixed market; only small, selective exposure.  
> One line: `{decision.explanation}`  
> Max book: **{decision.allocation}** · Per trade: **10–15%** (static guidance today)  
> Evidence: Gate 1 **Warning** · Tier A **{countA}** available.

**TRADE — Gate 1 PASS + A or B**

> **TRADE** — Supportive backdrop with qualified setups.  
> One line: `{decision.explanation}`  
> Max book: **{decision.allocation}** · Per trade: **10–20%** (static guidance today)  
> Evidence: Gate 1 **Pass** · Tier A **{countA}** · Tier B **{countB}**.

### 3.3 Confidence / evidence strength

| Display | Provenance | Notes |
|---------|------------|-------|
| Verdict level | Real (persisted or computed) | — |
| `decision.explanation` | Real (persisted string) | — |
| “Confidence” band (High / Medium / Low) | **Derived proxy** | **Not stored today.** Proposed rule: High = aligned freshness + scan &lt;24h + Gate1 PASS + surfaced&gt;0; Low = stale flags or no scan; else Medium |
| Numeric confidence % | **Mock / gap** | Do not show until backend defines score |

### 3.4 Max risk / size guidance

| Field | Provenance |
|-------|------------|
| `decision.allocation` (e.g. `50-70%`) | Real (rules in `trading-decision.ts`) |
| Per-trade % band | **Static interpretation** (`page.tsx`: PROBE → `10-15%`, else `10-20%`) |
| Open notional | **Derived** from user `trades` (`entryPrice × quantity`, OPEN only) |
| Allocation cap vs equity | **Gap** unless `TRADING_ACCOUNT_EQUITY_VND` set — then derived % = notional / equity |
| Stop-distance / R-multiple caps | **Gap** — not computed server-side for dashboard |

---

## 4. Evidence Stack (Block C)

Compact chips (always visible). Each chip: **label · value · provenance tooltip**.

| Chip | Value source | Provenance |
|------|--------------|------------|
| Gate 1 | `displayGate1ScanLevel(gate1Level)` | Real — `DailyScanRun.gate1Level` or `getMarketRegimeFromDb().level` (unify) |
| VNINDEX | Close + date | Real — `getMarketRegimeFromDb().latestBar` |
| Tier A count | `latestScan.candidateCountA` | Real — scan run row |
| Tier B count | `latestScan.candidateCountB` | Real — scan run row |
| Surfaced | `latestScan.candidateCountSurfaced` | Real — persisted at scan |
| Tradable universe | `latestScan.universeScannedCount` or notes | Real if present on run/notes |
| Data aligned | `MarketFreshnessDto` stale flags empty | Derived from snapshot + alignment |
| Scan age | `latestScan.runAt` vs now | Derived |
| Delayed backdrop | `scanNotes.benchmarkBackdrop.delayedBackdrop` | Real when in notes |

**Do not show on Evidence Stack without backend:**

- “Breadth % setups healthy” (appears in old design mockup only — **mock**)
- Generic “Trend: Bullish” without tying to Gate 1 reason strings

---

## 5. Opportunity Board (Block D)

### 5.1 When surfaced candidates exist (`topSetups` / health view)

Show **max 5** cards (not wide 8-column table). Each card:

| Card field | Source | Provenance |
|------------|--------|------------|
| Symbol | `symbolKey` | Real |
| Tier | `quality` A/B | Real (`displayScanQualityTier`) |
| Ladder stage | Unified mapper (§7) | Derived |
| Why | Top 2 of `reasons[]` + `healthFlagSummary` | Real + derived copy |
| Entry zone | `pullbackZoneLow/High` | Real |
| Stop | `stopLevel` | Real |
| Health | `healthLevel`, `healthScoreLabel` | Derived (`evaluateWatchHealth`) |
| Action | Link | **Real route:** `/trades/new?setupCandidateId={id}` when `lifecycleSortLabel===READY` and health not DEAD; else “Watch on Setups” → `/setups` |

### 5.2 When zero surfaced (typical prod)

Use **`scanNotes.closestToValidSymbols`** (same as Setups near-miss):

| Field | Provenance |
|-------|------------|
| Symbol list (top 5–8) | Real — persisted at scan, sorted by pipeline depth |
| Terminal category / status | Real — `terminalCategory`, `ClosestExecutionStatus` |
| “What must change” | **Derived** — `rejectionBucketTraderGuide(category).waitFor` OR closest row `terminalReasonPreview` |
| Distance to zone | **Derived** — `computeDistanceToPullbackZoneFrac` (exists in scanner libs) |

**Empty if:** no scan → point to ops/import; scan exists but no closest rows → “No near-miss ranking in this run.”

### 5.3 Watchlist supplement

`setupWatchItem` (NEW/WATCHING/READY) fills gaps when near-miss empty but manual watches exist — same query as today’s `DashboardWatchlistPanel`.

---

## 6. Diagnostics rewrite plan

### 6.1 Current state audit (`DashboardDiagnosticsStack`)

| Question | Finding |
|----------|---------|
| Are counts real? | **Yes** — `topRejectionCategories` aggregated in `buildGate2ScanDiagnosticsSummary` at scan time, stored on `DailyScanRun.notes` |
| Are sample symbols real? | **Yes** — `rejectionSymbolsByCategory[category]` capped at **25** per bucket at persist time |
| Do reasons map to scanner rules? | **Yes** — keys are `TerminalCategory` strings; labels/guides in `setups-trader-copy.ts` are **static interpretation** of those keys |
| Are they actionable? | **Partially** — `waitFor` text is useful but equal weight per bucket; no severity ordering on dashboard (top 5 by count only) |
| Should they move? | **Yes** — off main dashboard narrative; into **Opportunity Board empty state** + **Tomorrow’s Plan “avoid”** + Setups sidebar |

### 6.2 Proposed: “Actionable blockers” (replaces Diagnostics on dashboard)

Group by **trader impact**, not raw category count:

| Group | Severity | Source | Example copy |
|-------|----------|--------|--------------|
| **Market off** | Block | Gate 1 FAIL | “Index trend filter failed — no new swings.” |
| **Structure broken** | Block | Categories in `STRUCTURE_BROKEN_CATEGORIES` | “Breakout failed to hold — do not force entry.” |
| **Timing / zone** | Wait | `pullback_zone_interaction`, `digestion`, etc. | “Wait for retest into pullback box.” |
| **Extension / chase** | Avoid | `extension_cap`, health `CHASE` | “Extended — no chase entries.” |
| **Liquidity / data** | Info | `volume_ratio`, `stale_or_session_mismatch` | “Thin participation or stale session.” |

Sort within group by `CATEGORY_STAGE_RANK` (already in `gate2-scan-diagnostics.ts`) then count.

Show **max 3 blockers** on dashboard; link “All pipeline diagnostics → `/setups`”.

### 6.3 Remove from dashboard

- Long sample symbol lists (keep 3 symbols max per blocker line)
- Duplicate of near-miss table (near-miss is opportunity-focused; blockers are market-wide)

---

## 7. Setup Quality Ladder (Block E)

### 7.1 Target ladder (product language)

| Stage | Trader meaning |
|-------|----------------|
| **Tier A** | Tradeable now — full size within verdict cap |
| **Tier B** | Tradeable at reduced size |
| **Watch** | Close — wait for zone / confirmation |
| **Extended** | Good stock, bad entry timing (extended) |
| **Invalid** | Rule broken — do not trade |
| **Avoid** | Risk too high (health / momentum) |

### 7.2 Mapping from **existing** data (no new scanner rules)

| Ladder stage | Conditions (evaluate in order) | Provenance |
|--------------|--------------------------------|------------|
| **Invalid** | `ClosestExecutionStatus === INVALID` OR `healthLevel === DEAD` OR DB `lifecycleStatus === INVALID` | Real + derived |
| **Avoid** | `healthLevel === AT_RISK` OR momentum group `AVOID_RISK` | Derived |
| **Extended** | Health flags `EXTENDED` / `TOO_EXTENDED` / `CHASE` OR momentum `EXTENDED_WATCH_ONLY` | Derived |
| **Tier A** | `quality === A` AND `lifecycleSortLabel === READY` AND `healthLevel === HEALTHY` | Real + derived |
| **Tier B** | `quality === B` AND READY AND health not DEAD/AT_RISK | Real + derived |
| **Watch** | `lifecycleSortLabel === WATCHING` OR `ClosestExecutionStatus === WAIT` OR DB WATCHING/NEW | Real + derived |

**Conflicts:** DB lifecycle vs computed READY — surface `setup-lifecycle-dto` warning when wired (P1 foundation exists, not unified on dashboard).

### 7.3 Gap

- No single persisted `ladderStage` field — FE must compute per row (acceptable for Phase 1 if rules documented).
- **Needs product decision:** Whether Tier B + WARNING health downgrades to Watch or Avoid.

---

## 8. Risk Guardrail (Block F)

| Rule | Today | Provenance |
|------|-------|------------|
| Max book allocation | `decision.allocation` | Real |
| Per-trade sizing band | Static strings in page | Static interpretation |
| No new entries when NO_TRADE | Implied by verdict | Derived |
| No-chase | Health flags + `extension_cap` blocker | Derived |
| Stop distance | `stopLevel` on candidates — show “risk per share” only if entry zone known | Derived, not portfolio R |
| Open exposure vs cap | Notional sum / optional equity | Derived / gap |
| Capital preservation copy | `stanceLabel` in exposure panel | Static interpretation |

**Do not invent** “Configure stop” CTA unless route exists (trades ledger already has real warnings).

---

## 9. Tomorrow’s Plan (Block G)

Built from **real + derived** inputs; no LLM narrative.

| Section | Content source |
|---------|----------------|
| **Watch** | Top 5 symbols: surfaced READY/WATCHING + `closestToValidSymbols` + watchlist NEW/WATCHING |
| **Trigger** | Per symbol: “Enter when …” from `waitFor` for dominant rejection category OR “close in pullback zone [{low}–{high}]” |
| **Avoid** | Verdict-level: NO_TRADE → chase/extended blockers; PROBE → oversizing; list top 2 `extension_cap` / `volume_ratio` counts |
| **Risk posture** | `formatDecisionLevelForDisplay` + `decision.allocation` one line |

**Gap:** No persisted “tomorrow plan” object — computed view model `buildTomorrowPlanDto(scan, regime, notes, watchlist)` recommended (server-only, no schema change).

---

## 10. Data provenance table (dashboard fields)

| UI concept | Provenance class | Source (traced) |
|----------|------------------|-----------------|
| Gate 1 level (verdict input) | Real | `getMarketRegimeFromDb` / `DailyScanRun.gate1Level` (**unclear which is canonical today**) |
| VNINDEX close/date | Real | `index_daily_bar` via regime loader |
| Verdict level + explanation | Real | `notes.decision` or `computeDailyTradingDecision` |
| Allocation % string | Real | `decision.allocation` |
| Per-trade % guidance | Static interpretation | `dashboard/page.tsx` |
| Surfaced / A / B counts | Real | `DailyScanRun` columns |
| Scan run id / time | Real | `getLatestDailyScanRun` |
| Freshness aligned/stale | Derived | `buildMarketFreshnessDto` |
| Delayed backdrop | Real | `notes.benchmarkBackdrop` |
| Candidate rows (top 5) | Real | `setup_candidates` + `prepareSurfacedCandidatesHealthView` |
| Health score/level/flags | Derived | `evaluateWatchHealth` |
| READY vs WATCHING | Derived | Close in pullback zone |
| Rejection bucket counts | Real | `notes.topRejectionCategories` |
| Rejection sample symbols | Real | `notes.rejectionSymbolsByCategory` |
| Near-miss symbols | Real | `notes.closestToValidSymbols` |
| Watchlist items | Real | `setup_watch_items` |
| Momentum rows | Real | `getMomentumWatchRowsForPhase1` (separate audit track) |
| Closed P&L / win rate | Derived | `computeAdvancedMetrics(trades)` |
| Equity sparkline | Derived | `computeEquityCurve(trades)` |
| Breadth % healthy | **Mock** | Not in production loaders |
| Confidence % | **Mock / gap** | Not implemented |
| “NEUTRAL” badge | **Mock** | Not in `DailyTradingDecision` enum |
| Portfolio R / stop enforcement | **Gap** | Not server-computed |

---

## 11. Backend / data gaps (to unlock full cockpit)

Prioritize after UX approval:

| ID | Gap | Unlocks |
|----|-----|---------|
| DC-1 | Canonical Gate 1 for verdict: scan vs live regime | Consistent verdict + evidence |
| DC-2 | `buildDecisionCockpitDto()` server aggregator | One RSC loader, testable mapping |
| DC-3 | Unified `ladderStage` on surfaced + closest rows | Setup Quality Ladder without FE duplication |
| DC-4 | `confidenceBand` + inputs documented | Evidence strength without fake % |
| DC-5 | Risk budget API: equity, open risk VND, cap headroom | Real exposure meter vs notional only |
| DC-6 | `buildTomorrowPlanDto()` | Tomorrow’s Plan block |
| DC-7 | Blocker groups with severity in scan notes | Better diagnostics without UI-only sorts |
| DC-8 | Wire P1 `setup-lifecycle-dto` everywhere | Resolve DB vs computed READY conflicts |
| DC-9 | Near-miss on dashboard via shared component with Setups | Q3 when zero surfaced |
| DC-10 | Rename NORMAL → TRADE in persisted notes (optional migration) | Vocabulary alignment |

Existing [06-backend-gaps.md](../integration/06-backend-gaps.md) items **P1 #4–6, P2 #8–9** still apply.

---

## 12. Implementation phases (post-review)

1. **Spec approval** — this document + mockup sign-off  
2. **DTO layer** — DC-1, DC-2, DC-6 (no Prisma schema required for v1)  
3. **Dashboard FE** — reorder blocks; no new routes  
4. **Diagnostics migration** — dashboard slim stack; Setups keeps full funnel  
5. **Playwright** — verdict testids, ladder rows, near-miss empty paths  

**Explicitly out of scope until requested:** chart embeds, `/analytics` route, scanner rule changes, new Server Actions.

---

## 13. Acceptance criteria (review checklist)

- [ ] Trader can answer Q1–Q3 from Blocks B–G without opening Setups  
- [ ] Every visible metric has a provenance class from §10  
- [ ] Zero-candidate prod path shows near-miss + “what must change”  
- [ ] NO_TRADE uses preservation tone (amber), not error red  
- [ ] NORMAL displayed as **TRADE**  
- [ ] Diagnostics demoted; blockers ≤3 with severity  
- [ ] No mock breadth/confidence % in production build  
- [ ] Mobile: verdict + evidence + opportunity stack in &lt;2 scrolls  

---

## Appendix A — Current vs proposed (quick diff)

| Current panel | Proposed fate |
|---------------|---------------|
| `DashboardMarketStatusBar` | Expand → Trust strip |
| `DashboardDecisionHero` | Upgrade → Today’s Verdict |
| `DashboardExposurePanel` | Merge into Verdict + Risk Guardrail |
| `DashboardScanMetaStrip` | Fold into Trust + Evidence |
| `DashboardPerformancePanel` | Demote → Book snapshot |
| `DashboardBestSetupsPanel` | Replace → Opportunity Board cards |
| `MomentumWatchSection` | Demote / link out |
| `DashboardWatchlistPanel` | Merge into Opportunity + Tomorrow |
| `DashboardDiagnosticsStack` | Replace → Actionable blockers (3) + Setups link |
