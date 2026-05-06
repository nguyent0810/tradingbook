# FRD: Trades Page — Position & Health (Technical)

**Document type:** Functional / Technical Requirements  
**Companion:** `trade-page-position-health-prd.md`  
**Status:** Draft — design before implementation  

---

## 1. Data Sources

| Source | Use |
|--------|-----|
| **`Trade`** | `userId`, `symbol`, `direction`, `status`, `entryPrice`, `quantity`, `exitPrice`, `realizedPnl`, `stopLoss`, `takeProfit`, `entryDate`, `exitDate`, `setupId`, … |
| **`StockSymbol`** | Resolve ticker string → `symbolId` for bar lookups |
| **`StockDailyBar`** | Latest row per symbol by **`date` DESC** (session date); **`close`** as live mark |
| **`TradeHealthLog`** (table `trade_health_logs`) | EOD checkpoint timestamps and health levels for OPEN trades |
| **`IndexDailyBar`** (`symbol = VNINDEX`) | **Single source of truth** for **expected latest completed session date** (stale-bar benchmark) |

**Stale data — locked rule**

1. Load **`expectedSessionDate`** = calendar date of the latest **`IndexDailyBar`** row for **`VNINDEX`** (UTC date component as stored — same convention as scanner `getExpectedLatestSessionFromIndexBars`).
2. For each symbol’s latest equity bar date **`barDate`**:
   - If **`barDate` < `expectedSessionDate`** → **Stale data** warning for that position’s live mark.
   - If **`barDate` == `expectedSessionDate`** → not stale (assuming bars align to completed session).
3. **If no `VNINDEX` row exists:** Do **not** silently skip staleness. Show a **single deterministic banner** on Trades (and detail when loading live marks): *“Cannot evaluate bar freshness — import or refresh **VNINDEX** daily bars.”* Treat live-close-derived metrics as **unverified** (still render numbers with adjacent warning, or muted per PRD — implementation chooses one pattern but **no** “assume fresh” fallback).

**There is no alternate fallback benchmark** (no generic “maybe stale”, no server clock “today”).

---

## 2. Derived Calculations

Notation:

- \(E\) = `entryPrice` (must be > 0 for division).
- \(Q\) = `quantity` (must be finite and > 0 for **currency** P&L).
- \(C\) = latest daily **`close`** from `StockDailyBar`.
- \(S\) = `stopLoss` (nullable).
- \(T\) = `takeProfit` (nullable).

### 2.1 Unrealized P&L (currency)

**LONG**

\[
\text{unrealizedPnl} = (C - E) \times Q
\]

**SHORT**

\[
\text{unrealizedPnl} = (E - C) \times Q
\]

**Missing quantity fallback:** If \(Q\) is null, not finite, or \(\leq 0\): **`unrealizedPnl` = null** (display **`—`**). Still compute **`unrealizedPnlPct`** when \(E\) valid and \(C\) valid.

### 2.2 Unrealized P&L (%)

**LONG**

\[
\text{unrealizedPnlPct} = \frac{C - E}{E} \times 100
\]

**SHORT**

\[
\text{unrealizedPnlPct} = \frac{E - C}{E} \times 100
\]

If \(E \leq 0\) or \(C\) unavailable: **null** → **`—`**.

### 2.3 Position aging (`holdingDays`)

Derived display only — **not persisted**.

Let \(D_{\text{entry}}\) = UTC calendar-day anchor for **`entryDate`** (UTC midnight of that calendar day). Let \(D_{\text{end}}\) be the **end anchor** for the trade’s status (below). Whole **UTC calendar days**:

\[
\text{holdingDays} = \max\left(0,\ \left\lfloor \frac{D_{\text{end}} - D_{\text{entry}}}{1\ \text{day}} \right\rfloor\right)
\]

**End anchor \(D_{\text{end}}\) by status** (server **“now”** at render time for live statuses):

| Status | \(D_{\text{end}}\) | Notes |
|--------|-------------------|--------|
| **OPEN** | UTC calendar day of **now** | Days since entry through today. |
| **PLANNED** | UTC calendar day of **now** | Same as OPEN — planned rows age from entry for continuity. |
| **CLOSED** | UTC calendar day of **`exitDate`** | **Holding period** while the trade was open (entry → exit). If **`exitDate`** is null / unusable → **`holdingDays`** is undefined → display **`—`**. |
| **CANCELLED** | *(omit)* | Do **not** compute or emphasize **`holdingDays`** for product UX: **trades table** shows **`—`** (no meaningful aging); **trade detail** subtitle does **not** append “Held **N** days”. |

**Display**

- **Trades table:** column **Hold / Days** — **`holdingDays`** per status rules above; **`—`** when undefined (**CLOSED** without **`exitDate`**, **CANCELLED**).
- **Trade detail:** subtitle **“Held **N** days”** only when **`holdingDays`** is defined (**OPEN**, **PLANNED**, **CLOSED** with **`exitDate`**); omit for **CANCELLED**.

### 2.4 R multiple (open, vs stop — Phase 2)

Defined **only** when `stopLoss` is present and valid and direction is consistent:

**Validity**

- \(S\) finite; **LONG** requires \(S < E\); **SHORT** requires \(S > E\).
- Otherwise: stop is **invalid** for template geometry → **R = null**, **`distanceToStop` = null**, **near-stop hint disabled**. UX MUST show explicit copy (Phase 3 carries rule; Phase 2 preview optional):

  - **LONG:** *“Invalid stop: for a long, stop loss must be **strictly below** entry price.”*
  - **SHORT:** *“Invalid stop: for a short, stop loss must be **strictly above** entry price.”*

  Do **not** silently show **`—`** without accessible explanation when `stopLoss` is populated but invalid (tooltip or secondary line acceptable).

**Risk per share (R-unit)**

**LONG:** \(r = E - S\)  
**SHORT:** \(r = S - E\)

If \(r \leq 0\): **R = null**.

**Open R at latest close \(C\)**

**LONG**

\[
R = \frac{C - E}{r}
\]

**SHORT**

\[
R = \frac{E - C}{r}
\]

(Optional cap for UI: clamp display string to 2 decimals; do not persist.)

### 2.5 Distance to stop (Phase 2)

**Price delta** (signed: positive = favorable for the position vs stop)

**LONG:** \(\Delta_{\text{stop}} = C - S\)  
**SHORT:** \(\Delta_{\text{stop}} = S - C\)

**Percent of entry** (optional second line)

\[
\text{distStopPct} = \frac{\Delta_{\text{stop}}}{E} \times 100
\]

If \(S\) missing or invalid: **null** → **`—`**.

### 2.6 Distance to take profit (Phase 2)

**LONG:** \(\Delta_{\text{tp}} = T - C\)  
**SHORT:** \(\Delta_{\text{tp}} = C - T\)

**Percent of entry**

\[
\text{distTpPct} = \frac{\Delta_{\text{tp}}}{E} \times 100
\]

If \(T\) missing: **null** → **`—`**.

### 2.7 Realized P&L (CLOSED)

Use existing stored **`realizedPnl`** (and **`exitPrice`**) — **no overwrite** from derived live metrics.

---

## 3. Table Behavior — Columns (Target)

**Column order (left → right)** MUST reflect PRD **UI hierarchy**: place **EOD / stale / risk hint** columns (or a compact **Discipline** column) **before** **P&L**.

| Column | Content |
|--------|--------|
| **Symbol** | `Trade.symbol` |
| **Direction** | LONG / SHORT |
| **Status** | PLANNED / OPEN / CLOSED / CANCELLED |
| **Hold / Days** | **`holdingDays`** (§2.3): **OPEN**/**PLANNED** → entry→now; **CLOSED** → entry→**`exitDate`** or **`—`**; **CANCELLED** → **`—`** (omitted semantically) |
| **Entry Price** | Formatted entry |
| **Latest / Exit Price** | OPEN: latest close + session date; CLOSED: exit; PLANNED/CANCELLED: per PRD (typically **`—`** or N/A) |
| **Quantity** | `quantity` |
| **EOD Status** | Derived: checkpoint today / needs check / N/A for non-OPEN |
| **Stale / Risk strip** | Optional combined column or split: **Stale** badge + Phase 3 **risk hint** text (when shipped); Phase 1 at minimum **Stale** + **EOD** |
| **P&L** | OPEN: **Unrealized** (amount + %), **visually tertiary**; CLOSED: **Realized** (stored); PLANNED/CANCELLED: **`—`** unless product extends |
| **R** | OPEN: derived open R (Phase 2); CLOSED: optional realized R if already stored (`rMultiple`) — FRD: prefer **stored** `rMultiple` for CLOSED when present, else **`—`** |

**Phase 1 note:** Until Phase 2 ships, **R** column may be hidden or show **`—`** for all OPEN rows.

---

## 4. Rendering Rules

### Visual hierarchy (mandatory)

Matches PRD §3 **UI hierarchy**:

1. Render **EOD**, **stale (VNINDEX benchmark)**, and **risk hints** with **stronger** visual weight than unrealized P&L.
2. **`holdingDays`** sits with structural context (near entry / latest price), **above** P&L emphasis.
3. **Unrealized P&L**: subdued typography; never primary accent unless paired with “all clear” discipline state (product-defined optional subtlety).

### OPEN

- Show **derived** metrics (holding days, latest close, unrealized P&L / %, stale warning, Phase 2 R & distances).
- P&L column label context: **Unrealized** (sub-label or chip).

### CLOSED

- Show **stored** realized P&L (and exit price).
- Show **`holdingDays`** as **entry → `exitDate`** when **`exitDate`** is present; otherwise **`—`** (§2.3).
- Label: **Realized**.
- Do **not** show unrealized metrics.

### PLANNED / CANCELLED

- No live mark requirement in MVP unless PRD extends; default **`—`** for unrealized block.
- EOD Status **`—`** or **N/A**.
- **`holdingDays`:** **PLANNED** shows entry→now (§2.3). **CANCELLED** — omit from detail subtitle; table cell **`—`**.

### Missing data

- Display **`—`** for numeric fields; short muted helper text where useful (“No latest close”).
- **Never throw** from derived math; try/catch around batched SQL if tables absent.

---

## 5. Edge Cases

| Case | Behavior |
|------|----------|
| No row in `StockDailyBar` for symbol | Latest price **`—`**; unrealized **`—`**; optional **“No latest close”** |
| No **`VNINDEX`** row in `IndexDailyBar` | Cannot compute **`expectedSessionDate`** → global banner per §1; **no** substitute benchmark |
| Stale bar (`barDate` < expected session) | Warning badge / text; still show numbers with caveat |
| No `stopLoss` | R, distance to stop **`—`**; Phase 3 hint **Missing stop** for OPEN |
| No `takeProfit` | Distance to TP **`—`** |
| Bad `stopLoss` vs entry | R null; show **explicit invalid-stop message** (§2.4); suppress near-stop hint |
| Quantity missing / invalid | P&L amount **`—`**; show **%** if \(E,C\) OK |
| Invalid trade state | Render row if DB returns it; derived fields defensive null |
| **CLOSED** missing **`exitDate`** | **`holdingDays`** **`—`** |
| **CANCELLED** | **`holdingDays`** not shown in detail subtitle; table **`—`** |

---

## 6. Risk Hint Logic (Deterministic, Phase 3)

Hints are **ordered priority** (first match wins) or **multi-badge** — product picks one; default **single primary hint**.

**Inputs:** `status`, `direction`, `entryPrice`, `stopLoss`, latest `close` \(C\), risk unit \(r\) (§2.4), `trade_health_logs` for today’s window (local **calendar day** vs **UTC** — lock one in implementation ticket; recommend **user/session TZ** or **UTC with label**).

**Preconditions**

- Compute **near stop** only if stop is **valid** (LONG \(S < E\), SHORT \(S > E\)) and **not breached**. If stop invalid but numeric, surface **invalid stop** message (§2.4) instead of near-stop / breached math.

| Priority | Condition | Hint |
|----------|-----------|------|
| — | `status !== OPEN` | (no OPEN hints) |
| 1 | No checkpoint logged today | **Needs EOD check** |
| 2 | `stopLoss` null or blank | **Missing stop** |
| 3 | LONG and \(S \geq E\) OR SHORT and \(S \leq E\) (stop populated) | **Invalid stop** + explicit copy from §2.4 |
| 4 | LONG and \(C < S\) | **Stop breached** |
| 5 | SHORT and \(C > S\) | **Stop breached** |
| 6 | LONG and \(0 < C - S \leq 0.3\,r\) | **Near stop** |
| 7 | SHORT and \(0 < S - C \leq 0.3\,r\) | **Near stop** |

Where \(r\) is **risk per share** (§2.4): LONG \(r = E - S\); SHORT \(r = S - E\) (only defined when stop valid and \(r > 0\)).

**Near-stop threshold (locked):** \(\theta = 0.3\) applied as **\(0.3 \times r\)** price distance from stop — **not** a percent of entry.

**Stale bar:** Separate **“Stale data”** warning (VNINDEX benchmark §1); may stack as secondary line under primary hint without overriding breach/missing-stop precedence.

---

## 7. Performance Constraints

- **No N+1** latest-bar queries: one batched query for **distinct symbols** among rows on screen (OPEN first).
- **No heavy joins per row** on initial table paint; optional secondary batch for health checkpoints (already batched by trade IDs).
- Pagination / virtual scrolling — **future** if trade count grows; Phase 1 assumes modest cardinality.

---

## 8. Migration / Compatibility

- **No schema change required** for derived MVP metrics.
- **No breaking changes** to existing `Trade` rows or enums.
- Existing **`realizedPnl`**, **`exitPrice`**, **`rMultiple`** remain source of truth for closed performance.
- **`trade_health_logs`** remains append-only; hints read-only.

---

## Recommended Phase 1 implementation plan

1. **Count vs rows:** Wire tests / QA checklist; fix server render path so failures in supplemental queries never drop tbody (pattern: isolate optional queries in try/catch).
2. **Batch latest bars:** `DISTINCT ON (symbol_id)` or equivalent single round-trip per FRD §7.
3. Implement §2.1–2.3 + latest bar date display + **VNINDEX-only** stale rule (§1).
4. Column order + headers per §3–§4 (**discipline before P&L**); **Unrealized / Realized** labels.
5. Copy review against PRD **Design DNA** + invalid-stop strings (§2.4).

---

## Approval gate

**Do NOT proceed to implementation until this FRD and the companion PRD (`trade-page-position-health-prd.md`) are reviewed and approved.**
