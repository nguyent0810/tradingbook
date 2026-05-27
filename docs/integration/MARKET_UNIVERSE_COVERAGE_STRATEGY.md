# Market Universe Coverage Strategy (Core + Tactical)

**Scope:** Coverage universe/import workstream only  
**Status:** Strategy proposal (no runtime implementation in this slice)

---

## 1) Problem framing

Production currently ties both import and scan mostly to `StockSymbol.active = true`.  
This keeps runtime bounded, but creates blind spots when important/liquid names are inactive.

Recent audit confirms that VND/PDR are not isolated: multiple high-liquidity names are inactive and stale/no-bar under the current universe flow.

---

## 2) Strategy decision

Adopt a **two-layer universe model** and keep import/scan aligned:

1. **Core universe** — curated liquid/tradable names scanned daily by default.
2. **Tactical universe** — temporary watch symbols with expiry + reason, merged into effective universe.

This should be the canonical rule for both import and scanner evaluation.

---

## 3) Direct answers to required questions

### Should we expand `active=true` core universe?
Yes. Expand and curate core coverage so major liquid names are not excluded by default.

### Should we use tactical universe for temporary/watch symbols?
Yes. Tactical is the right mechanism for short-lived opportunities without polluting core.

### Should import include both active core and tactical symbols?
Yes. Import fetch list should be: **active core ∪ active tactical** (deduped).

### Should scanner include both active core and tactical symbols?
Yes. Scanner effective universe should be: **active core ∪ active tactical** (deduped).  
This is already the scanner intent; import should mirror it.

### Which major inactive-but-liquid symbols should be added to core?
Prioritize this audited set first:

- VND, PDR, SSI, HPG, FPT, MWG, VHM, VIC, TCB, MBB, VPB, VRE, NVL

Then continue with the top stale/inactive liquid set from:

- `docs/integration/MARKET_COVERAGE_GAP_AUDIT.md`
- `reports/market-coverage-gap-audit.json` (`topStaleLiquidInactive`)

### How do we avoid importing/scanning all 1537 symbols?
Keep strict intake controls:

- Core target cap (for example 250–400, curated by liquidity + freshness + tradability readiness)
- Tactical cap (small bounded list with expiry)
- Deterministic curation workflow (`curate-active-symbols`) and diagnostics before apply

### How do we keep import universe and scan universe aligned?
Define one shared effective-universe contract:

- Import input list must be generated from the same merge rules as scanner (`core ∪ tactical`).
- Add one diagnostics check that compares import symbol set vs scanner symbol set and fails/alerts on drift.

### How should VND/PDR/SSI/HPG/FPT/MWG/VHM/VIC/TCB/MBB/VPB be handled?
Treat as **core-candidate additions**, not ad hoc one-offs.  
They should be onboarded via curated core update, then validated with fresh import and next scan.

### Should we add a separate “Volume Explosion Watch” later?
Yes, later. Keep it separate from Best Setups.

- Best Setups should remain core Gate2 A/B validated outcomes.
- Volume Explosion Watch can be a secondary observational lane to avoid forcing non-template names into setup surfaces.

---

## 4) Proposed operating model

### Core universe (steady-state)

- Source: `StockSymbol.active = true` after curated apply
- Criteria: liquidity, fresh bars, minimum history, tradability tendency
- Cadence: periodic curation update (not every scan)

### Tactical universe (temporary)

- Source: `tactical_symbols` active + non-expired rows
- Purpose: temporary opportunity intake and watch coverage
- Constraints: expiry required, bounded count, explicit reason/source

### Effective universe

- `effective = core_active ∪ tactical_active`
- Shared for import fetch and scanner run
- Deduped by symbol

---

## 5) Implementation sequencing (proposal only)

1. **Core curation update** for known liquid inactive names (including VND/PDR set).
2. **Import alignment change** so production bar import includes tactical active symbols in addition to core active symbols.
3. **Universe parity diagnostics** (import-vs-scan universe drift check).
4. Optional later: **Volume Explosion Watch lane** as non-core diagnostic surface.

No threshold/UI changes are required for this strategy.

---

## 6) Risk controls

- Do not broaden to all symbols; keep capped curated sets.
- Keep tactical bounded and expiring to avoid universe bloat.
- Preserve scanner gate integrity (no threshold loosening in coverage slice).
- Validate with coverage metrics before and after each curation/apply cycle.

---

## 7) Recommendation

Use **combined Core + Tactical coverage** as the target architecture:

- Core for stable liquid universe quality.
- Tactical for fast temporary opportunities.
- Import and scanner both fed by the same merged universe.

This resolves VND/PDR-type misses systemically, not symbol-by-symbol.

