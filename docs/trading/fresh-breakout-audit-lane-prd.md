# Secondary Fresh Breakout Audit Lane — PRD

## 1. Problem statement

The core breakout-pullback scanner is intentionally disciplined: it looks for a **fresh** close-through of a defined range, **digestion**, then **interaction with a pullback zone** under liquidity, extension, and depth constraints. That design correctly filters many marginal setups.

In Vietnam equities (and similar tape regimes), **market leaders often continue higher without a clean retest**: momentum ignition and straight-line continuation after a spike are common. Recent retrospectives (e.g. GEX/GEE) show that:

- The core template **did** detect qualifying breakout **recency** on earlier sessions.
- Names **never reached Tier A/B** because **later gates** failed—chiefly **`pullback_zone_interaction`** and **`breakout_not_holding`**.
- On **latest** bars, many leaders fall back to **`breakout_recency`** INVALID because the impulse aged **outside the fixed lookback window**, even while trend (MA structure) still looks strong.

Operators therefore lack **first-class visibility** into “what the scanner is intentionally **not** trading”—fresh momentum and continuation leaders—without weakening core discipline or pretending those names are validated setups.

## 2. Product goal

Introduce a **secondary, offline diagnostic lane** (watchlist-first) that:

1. **Surfaces** names exhibiting **fresh breakout**, **momentum ignition**, **trend reclaim thrust**, and **extended-but-still-strong** behavior—as defined by explicit audit rules (not Gate 2).
2. **Explains**, per symbol and session, **why each row is not a core setup** (mapping to familiar Gate2-style narratives where helpful—e.g. no pullback box interaction, extension, recency expiry—without changing Gate 2).
3. **Preserves** the core scanner as the **only** path for official Tier A/B setup semantics and any future persisted candidates tied to that pipeline.

This lane answers: “**Which leaders is the core playbook skipping by design, and why?**”

## 3. Design DNA

| Principle | Implication |
| --- | --- |
| **Not a trade signal** | Copy and UI must never imply “buy,” “entry,” or “approval.” Language is audit/diagnostic/watchlist only. |
| **Watchlist / diagnostic first** | MVP ships as CLI/reports and JSON artifacts—no product dependency on this lane for trading workflows. |
| **Core scanner is canonical** | Tier A/B, cron semantics, and setup persistence remain owned exclusively by the existing pipeline. |
| **No dilution of discipline** | This lane does **not** relax Gate 2 or bypass tradability for core outputs. |
| **Mandatory risk framing** | Every emitted row carries structured **risk warnings** (see below). Omitting warnings is a defect. |

### Required risk warning themes (always surface where applicable)

- **Extended** above anchor (breakout level / range / MA).
- **No pullback** / **no pullback box**—straight continuation risk.
- **Stop logically far** or poorly anchored under this template (high participation uncertainty).
- **False breakout / failed reclaim risk** when structure is fragile.

Warnings are informational; they do not replace position sizing or execution policy.

## 4. Candidate types (conceptual)

The lane should classify observations into **non-exclusive diagnostic buckets** (a symbol-day may match multiple patterns):

1. **Fresh breakout above range high** — decisive close through a prior N-day high with context (volume/structure).
2. **Breakout continuation without pullback** — upside persists after a breakout session without the digestion/pullback path the core template requires.
3. **Reclaim thrust** — rapid reclaim / thrust vs MA20 and/or MA50 after disruption (trend repair impulse).
4. **Volume expansion leader** — unusual participation vs trailing median/average on breakout or continuation days.
5. **Extended momentum watch** — trend and participation still supportive but **far from** pullback entry discipline; typically overlaps “why core skips.”

Each type must link to **human-readable explanation** and **risk annotations**.

## 5. User scenarios

1. **Rally context** — User observes a broad market or sector rally and asks: “Which leaders is the **core scanner intentionally not entering**?” The lane lists diagnostic candidates with reasons and risks.
2. **Pullback monitoring** — User treats the lane as a **watch pool**: names to revisit when price delivers a retest or when core Gate 2 might eventually align—without pretending today’s row is a setup.
3. **Learning over time** — User compares secondary lane membership vs eventual core candidates (or realized outcomes) to build intuition about when continuation dominates vs when pullback templates work—still **not** using secondary rows as official setups.

## 6. Non-goals

- **No** loosening or branching of **core** Gate 2 rules for production scan outputs.
- **No** `SetupCandidate` creation from this lane in MVP (and no persistence that implies official setup status).
- **No** AI ranking, scoring leaderboards, or “best pick” automation.
- **No** order routing, broker integration, or trade automation.
- **No** mandatory UI in MVP (CLI/report only).

## 7. Success metrics (qualitative for MVP)

- Operators can answer, from one report run: **why** a hot leader is absent from core Tier A/B **without** misreading INVALID as “broken scanner.”
- Reports consistently show **risk warnings** and **universe source** (core/tactical) where available.
- No increase in mistaken belief that secondary lane rows are endorsed setups (validated via internal review / copy checks).

## 8. References

- GEX/GEE breakout retrospective: `docs/trading/gex-gee-breakout-retrospective.md`
- Tactical universe PRD (universe labeling, no Gate loosening): `docs/trading/tactical-universe-prd.md`

---

**Document status:** Proposal — implementation deferred until FRD alignment and MVP sequencing approval.
