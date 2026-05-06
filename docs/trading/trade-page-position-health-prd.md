# PRD: Trades Page → Position Awareness + Discipline Surface

**Document type:** Product Requirements  
**Status:** Draft — design before implementation  
**Scope:** Position management UX on `/trades` and related trade detail flows  

---

## 1. Problem Statement

- The **Trades** page behaves primarily as a **static ledger**: rows list historical and open trades without framing them as **positions to steward**.
- Operators lack **at-a-glance position awareness**: how the market last valued the symbol versus entry, and whether discipline checkpoints are current.
- Without a deliberate surface for **risk and health**, users default to **profit-first** reactions (chasing unrealized P&L) instead of **structure-first** decisions (stops, checkpoints, plan adherence).
- A **row visibility inconsistency** has been observed where the header trade count does not match visibly rendered rows—undermining trust in the page as a management tool.

---

## 2. Product Goal

Transform the Trades experience into:

### **“Position Awareness + Discipline Surface”**

A minimal, deterministic workspace where the user can:

- See **open positions** with **derived** live marks (from existing daily bars), **without** treating those marks as new entry signals.
- See **discipline state** (EOD checkpoint posture, health trajectory) adjacent to position economics.
- Answer: **“What should I do today?”** — hold, reduce risk, exit, or complete housekeeping — **not** “what’s my score?”

### Explicitly **NOT**

- An **analytics dashboard** (no portfolio charts, win-rate walls, or exploration-first layouts).
- An **AI / recommendation engine** (no model-driven trade suggestions).
- A replacement for the **scanner** or **setup** lifecycle (scanner rules stay separate).

---

## 3. Design DNA (Critical)

### Core principles

| Principle | Meaning |
|-----------|--------|
| **Health-first, not profit-first** | Risk visibility (stop proximity, checkpoint gaps, health degradation) **outranks** highlighting unrealized gain. Color and hierarchy favor **structural integrity** over celebration of green P&L. |
| **Derived, not stored** | Live metrics (unrealized P&L, R vs stop, distances) are **computed at read time** from `Trade`, `StockDailyBar`, and `TradeHealthLog`. **No persistence** of unrealized P&L or intraday “marks” on `Trade` for MVP phases described here. |
| **Action-oriented, not data-dump** | Every surfaced number maps to a **next action or explicit non-action**: e.g. “Needs EOD check”, “No latest bar — refresh data”, “Stop undefined — define plan”. Avoid orphan metrics. |
| **Low cognitive load** | Few columns, clear labels (**Unrealized** vs **Realized**), progressive disclosure on detail. No simultaneous display of redundant variants (e.g. five P&L definitions). |
| **Consistency with existing system** | Reuse **healthLevel**, **EOD checkpoint** discipline, setup linkage, and playbook lock (`BREAKOUT_PULLBACK`). Do not invent parallel health taxonomies without migration rationale. |
| **No false signal** | **Near-miss** lists and **live P&L** are **diagnostic / positional context only** — never badges as “buy”, “add”, or “conviction”. Scanner remains the gate for new setups. |
| **Deterministic logic only** | All hints and labels are **rule-based** from stored fields and latest bar. **No ML**, clustering, or probabilistic scores. |

### UI hierarchy (mandatory)

**Risk and health must visually outrank P&L.** Implementation MUST follow this **ordering rule** everywhere Trades list and trade detail show economics together:

1. **Primary band (most prominent):** Discipline + risk posture — EOD checkpoint status / needs check, **stale data** warning (when applicable), Phase 3 **risk hints** (missing stop, invalid stop, breached, near stop), and **health** trajectory cues tied to existing checkpoints.
2. **Secondary:** Structural position context — entry vs latest close, **holding age** (`holdingDays`), latest bar date, distances to stop / TP when shipped (Phase 2).
3. **Tertiary (visually subdued):** **Unrealized P&L** — smaller type weight, neutral placement (e.g. right-aligned ledger column without hero color unless paired with risk context); never the first scanned element in a row or card.

Unrealized gain must **not** use celebratory emphasis ahead of unresolved discipline or risk gaps.

---

## 4. User Scenarios

1. **Morning / post-market review** — User opens Trades, filters or scans **OPEN** positions; **first** sees checkpoint / stale / risk posture (per hierarchy), then **holding age**, latest close vs entry, then unrealized metrics.
2. **Hold vs reduce vs exit** — User uses **health timeline**, **distance-to-stop** (when available), and **risk hints** to decide whether the thesis is intact—not whether green/red “feels good”.
3. **Discipline audit** — User verifies **checkpoint streak**, missing stops, or stale data warnings **without** exporting spreadsheets.
4. **Closed trade review** — User sees **realized** economics, **`holdingDays`** as **holding period** (**entry → exit** when **`exitDate`** exists), and preserved history; no fake “live” metrics on **CLOSED** rows. **CANCELLED** trades do not surface **`holdingDays`** in the detail subtitle.

---

## 5. Feature Scope (Phased)

### Phase 1 (MVP)

- **Fix** trades table **row visibility / count parity** (header count must equal rendered rows for the same query + filters).
- Apply **UI hierarchy** (§3): risk/health/discipline **before** unrealized P&L prominence.
- Show **latest daily close** per open symbol (from `StockDailyBar`).
- Show **unrealized P&L** (amount when quantity valid) and **unrealized %** (visually tertiary).
- Show **latest bar date** (session date; timezone rules per FRD).
- Show **position aging**: **`holdingDays`** per status — **OPEN** / **PLANNED**: **`entryDate` → now**; **CLOSED**: **`entryDate` → `exitDate`** (or **`—`** if exit missing); **CANCELLED**: omitted from detail subtitle; table **`—`** (FRD §2.3).
- **Stale data warning** using **VNINDEX latest session only** as benchmark (FRD §1 — no ambiguous fallback).

### Phase 2

- **Current R multiple** (open risk unit vs latest close — derived from `stopLoss` when present).
- **Distance to stop** and **distance to take profit** (price and/or % — FRD defines).
- **Position Health** summary card on **trade detail** (ties entry, live mark, stop/TP distances, checkpoint status).

### Phase 3

- Deterministic **risk hints** (single-line, non-modal):
  - Stop **breached** (LONG/SHORT per FRD).
  - **Near stop** — within **0.3R** of the stop (θ = **0.3 × r**, \(r\) = risk unit per share; FRD §6).
  - **Missing stop** on OPEN trade.
  - **Invalid stop vs entry** — explicit copy explaining LONG requires stop **below** entry and SHORT requires stop **above** entry (FRD §2.4 / §6).
  - **No EOD checkpoint** today for OPEN trade.

### Phase 4 (Later)

- **Portfolio exposure** (aggregated notional / simple sums — still not an analytics product).
- **Aggregated open risk** (e.g. sum of risk-at-stop in R or currency — derived).

---

## 6. Non-goals

- No dedicated **analytics** page or chart-first dashboard.
- No **strategy optimization** UI or parameter sweeps.
- No **automated trading** or order routing.
- No **scanner Gate 2 / tradability** rule changes driven by this surface.
- No **ML / AI** suggestions, sentiment, or rankings.

---

## 7. Success Metrics (Qualitative + Lightweight)

- Users report they can complete a **daily open-position review** without leaving Trades + detail.
- **Zero** unexplained **count vs row** mismatches in QA.
- Support burden drops for “I don’t know if I logged today’s check” class confusion.

---

## Recommended Phase 1 implementation plan

1. **Reproduce and eliminate** count vs visible row mismatch (query vs filters vs client hydration vs error boundaries — root cause doc in ticket).
2. **Batch-fetch** latest bar per distinct symbol for OPEN trades (single query pattern per FRD).
3. Implement **unrealized P&L / %** and **latest bar date** per FRD formulas.
4. Add **stale bar** rule + copy — **VNINDEX-only** benchmark (FRD §1); message when index missing.
5. **UX copy pass**: hierarchy audit (risk/health above P&L); Unrealized / Realized labels; invalid-stop explanation; no “signal” language.
6. **QA matrix**: OPEN / CLOSED / PLANNED / **CANCELLED** (`holdingDays` omit); LONG / SHORT; missing bar / stale bar / missing qty / missing stop / invalid stop / **holdingDays** (incl. CLOSED without **`exitDate`**).

---

## Approval gate

**Do NOT proceed to implementation until this PRD and the companion FRD (`trade-page-position-health-frd.md`) are reviewed and approved.**

Stakeholders should explicitly sign off on **Design DNA**, **phasing**, and **non-goals** before engineering estimates or build.
