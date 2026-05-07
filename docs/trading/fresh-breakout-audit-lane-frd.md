# Secondary Fresh Breakout Audit Lane — FRD

## 1. Functional objective

Deliver a **read-only audit lane** that evaluates listed equities against **explicit momentum / fresh-breakout diagnostics** independent of core Gate 2 Tier A/B surfacing. Outputs are **CLI reports and/or JSON** suitable for operators and research—**not** persisted setup candidates and **not** tied to cron setup creation.

This FRD defines **what** to measure and **how** to label it; it does **not** implement code.

## 2. Data sources

| Source | Use |
| --- | --- |
| **`StockDailyBar`** | OHLCV series per symbol; primary input for rolling highs, MAs, volume ratios, extension metrics. |
| **`StockSymbol`** | Symbol identity, `active` (core curation flag), existence checks. |
| **VNINDEX session alignment** | Latest completed session from **`IndexDailyBar`** / existing `getExpectedLatestSessionFromIndexBars` semantics—same **session alignment** discipline as scanner audits (avoid clock skew). |
| **Tactical universe metadata** | Where available: tactical rows / merge labels so each audited symbol-day can show **`CORE`**, **`TACTICAL`**, or **`BOTH`** (overlap between curated active set and tactical intake). If merge metadata is only available at scan time in JSON today, the CLI should reconstruct using the same rules as production merge (`core active ∪ tactical active`). |

Optional future enrichment (not MVP-blocking):

- Corporate actions / splits—only if already modeled elsewhere.
- Sector/index relatives—explicitly out of MVP unless already trivially available.

## 3. Initial audit conditions (diagnostic signals)

All conditions below are **candidates for inclusion** in the audit payload. They are **not** combined into a single “score”; each may contribute flags and labels. Thresholds (N-day, volume multiples) are **parameters** documented in the CLI contract—not silently tuned.

### 3.1 Price / structure

- **Close above prior N-day high** (configurable N; default proposal: 20 trading sessions, aligned to calendar bars present in DB).
- **Distance above breakout / range anchor** — e.g. fractional extension above the detected range high or last breakout level used by diagnostics (distinct from core Gate 2 caps).
- **Close vs MA20 / MA50** — signed distance or ratio; supports **reclaim thrust** labeling.

### 3.2 Participation

- **Volume ratio** vs **median or average** of prior 20 sessions (evaluation bar excluded from baseline where appropriate—mirror core semantics for consistency).
- Optional: **traded value** proxy using existing **traded value / VND** helpers if consistent with tradability utilities.

### 3.3 Volatility (if available)

- **ATR or rolling volatility** — only if already computed or trivially derivable from daily bars in-repo without new statistical packages; otherwise **omit in MVP** and note “future enhancement.”

### 3.4 Liquidity / data quality

- **Tradability pass/fail** — reuse existing **`evaluateTradability`** (or equivalent read-only evaluation) for the symbol at `expectedLatestSession`; emit **pass/fail + reasons** as diagnostic fields.
- **Stale data** — latest bar date ≠ expected session (mirror core staleness messaging).
- **Bar count / gaps** — surface insufficient history or excessive calendar gaps using existing tradability constants where applicable.

### 3.5 Relationship to core Gate 2 (read-only shadow)

- Optionally attach **core Gate 2 outcome** (`evaluateBreakoutPullbackCandidate`) **for explanation only**: quality A/B/INVALID + terminal category/reason. This clarifies “why not core” without altering Gate 2 code paths.

## 4. Classification labels

Labels are **diagnostic tags** (multi-assign allowed). Examples:

| Label | Intent |
| --- | --- |
| **`FRESH_BREAKOUT`** | Recent decisive close through prior range high (definition parameterized). |
| **`MOMENTUM_IGNITION`** | Strong participation + thrust leg; may overlap fresh breakout. |
| **`RECLAIM_THRUST`** | Sharp favorable move vs MA20/MA50 after weakness or reclaim pattern (rules TBD in implementation spec). |
| **`EXTENDED_NO_PULLBACK`** | Extended above anchor; lacks pullback structure relative to core template expectations. |
| **`FAILED_BREAKOUT_RISK`** | Fragile structure: e.g. close back under key level, poor holding—surfaced as risk even if momentum occurred earlier. |

Implementation note: labels must be **derivable from deterministic rules**; no ML classification in MVP.

## 5. Risk annotations

Each candidate row MUST include zero or more **risk annotation codes** with human-readable expansion:

| Code | Meaning |
| --- | --- |
| **`extended_from_breakout`** | Price stretched vs anchor; chase-sensitive. |
| **`no_pullback_box`** | No disciplined pullback zone interaction as core defines it. |
| **`stop_distance_high`** | Impulse structure implies wide or ambiguous stop placement under swing logic. |
| **`below_liquidity_or_value_threshold`** | Tradability failed or marginal on liquidity/value floors. |
| **`stale_data`** | Bars not aligned to latest index session. |
| **`weak_ma_structure`** | Trend filters unfavorable (e.g. below MA50 or MA20 \< MA50—mirror messaging style without copying Gate 2 verbatim). |
| **`false_breakout_risk`** | Evidence of failed hold / reversal vulnerability on recent bars. |

Risk annotations are mandatory when triggers apply; “clean” rows should still carry at least one contextual warning if any momentum pattern fired (default pessimistic framing).

## 6. Output format

### MVP

- **CLI** entrypoint (future): `npx tsx scripts/<audit-script>.ts` with flags for symbol list, `--sessions`, `--prod-local`-style DB targeting—exact naming TBD at implementation.
- **Human-readable report** (stdout or markdown file path)—sections per symbol-day or aggregated summary tables.
- **Machine-readable JSON** optional artifact (e.g. under `reports/`), schema versioned with `generatedAt`, `expectedLatestSession`, `symbols[]`, `rows[]`.

### Explicit exclusions

- **No UI** in MVP.
- **No `SetupCandidate` persistence** and no foreign keys implying setup lifecycle.
- **No writes** to production trading tables beyond normal audit logging expectations (read-heavy).

### JSON row sketch (illustrative)

```json
{
  "symbol": "GEX",
  "date": "2026-05-06",
  "universeSource": "TACTICAL",
  "labels": ["EXTENDED_NO_PULLBACK", "MOMENTUM_IGNITION"],
  "riskAnnotations": ["extended_from_breakout", "no_pullback_box"],
  "tradability": { "passed": true, "reasons": [] },
  "metrics": {
    "close": 29.35,
    "prior20High": 28.5,
    "volumeRatioVsMedian20": 1.8,
    "distanceAbovePrior20HighFrac": 0.03
  },
  "coreGate2Shadow": {
    "quality": "INVALID",
    "terminalCategory": "breakout_recency",
    "terminalReasonPreview": "..."
  },
  "whyNotCoreSetup": "Short deterministic explanation string."
}
```

## 7. Integration with tactical universe

- Audit input universe MUST support **`StockSymbol.active`** core members **and** active tactical symbols (same effective merge semantics as daily scan).
- Each row emits **`universeSource`**: `CORE` | `TACTICAL` | `BOTH` when symbol is both tactically active and core-active.
- Tactical-only symbols (e.g. historical GEX/GEE style intake) MUST appear when included in merge inputs—no silent exclusion.

## 8. Evaluation / learning plan

- Store **historical JSON runs** (gitignored or ops bucket—policy TBD) for later comparison.
- Periodically compare:
  - secondary lane membership vs subsequent core Tier A/B appearances,
  - drawdown periods after `FAILED_BREAKOUT_RISK` flags,
  - outcomes conditional on tradability pass/fail.
- **Do not** promote secondary lane rows to official setups without product gate and Gate 2 ownership review.

## 9. Recommended MVP sequence

1. **Docs / research** — finalize thresholds and label definitions from small symbol samples (this PRD/FRD + implementation notes).
2. **CLI audit script** — read-only Prisma access; parameterized diagnostics; shadow core Gate 2 optional.
3. **Report output** — markdown + JSON; review with ops.
4. **Optional UI** — only after evidence that operators use CLI output and labels stabilize.

## 10. Non-functional requirements

- **Deterministic**: same inputs → same outputs (no randomness).
- **Safe secrets handling**: never print credentials; DB URL fingerprint only if consistent with existing scripts policy.
- **Performance**: batch symbols with sane limits; suitable for nightly or ad-hoc runs—not hot-path online API unless later approved.

## 11. Out of scope (implementation guardrails)

- Modifying **`evaluateBreakoutPullbackCandidate`** or tradability thresholds for core scan.
- Creating **`SetupCandidate`** rows from this lane.
- Automating trades or alerts (future consideration only).

---

**Document status:** Proposal — implementation deferred pending approval.
