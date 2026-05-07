# Market Watch UI PRD (Setup Ready vs Watch Only)

## 1. Problem

Current product surfaces emphasize strict core setup outputs. This is correct for execution discipline, but incomplete for operator awareness:

- Setup pages primarily show **core-qualified setups** only.
- Fresh Breakout Audit can already identify strong momentum names, but there is no clear product surface to monitor them.
- Users need a clear distinction between:
  - **“kèo đủ điều kiện”** (core setup-ready), and
  - **“kèo có lực nhưng chưa an toàn”** (momentum watch only).

Without this distinction, operators either ignore useful context or misinterpret watch diagnostics as entry approval.

## 2. Product goal

Create a **read-only Market Watch / Momentum Watch UI surface** that:

- keeps core scanner discipline canonical,
- improves visibility into strong names that are not core setups,
- helps user monitor these names without turning them into trade signals.

## 3. Design DNA

### Core principles

1. **Core setups are canonical**
   - “Đủ điều kiện” comes only from core scanner / Gate2 output.
2. **Momentum Watch is observational only**
   - “Có lực / theo dõi” is diagnostic context, not setup validation.
3. **Risk-first visual hierarchy**
   - Risk annotations are always visible and not hidden behind drill-down.
4. **No buy/signal language**
   - No “Buy”, “Enter”, “Signal”, “Recommended”.
5. **Two-lane mental model**
   - Lane A: **Setup Ready**
   - Lane B: **Watch Only**
6. **Avoid FOMO design**
   - No celebratory momentum badges without risk context.
7. **Explain “why not setup” clearly**
   - Watch-only rows must include deterministic explanation text.

## 4. UX structure

For existing Setup page and/or Dashboard entry point, render two separate sections:

1. **Setup Candidates / Ready Setups**
   - Source: core scanner setup candidates.
   - Label: “Đủ điều kiện”.
   - Primary CTA: **Create Trade** (existing workflow).

2. **Momentum Watch / Fresh Breakout Watch**
   - Source: Fresh Breakout Audit output.
   - Label: “Có lực / theo dõi”.
   - Watch-only CTA: **View details** / **Track**.
   - No Create Trade primary CTA.

### Momentum Watch row/card minimum fields

- `symbol`
- labels: `FRESH_BREAKOUT` / `MOMENTUM_IGNITION` / `RECLAIM_THRUST`
- risk annotations: e.g. `STOP_FAR`, `EXTENDED`, `NO_PULLBACK`, `LOW_LIQUIDITY`
- universe source: `CORE` / `TACTICAL` / `BOTH`
- latest close
- volume ratio (20D)
- extension %
- reason text: why this remains watch-only (not core setup)

### CTA rules

- Core setup rows: **Create Trade**
- Momentum watch rows: **View details** / **Track** only
- Never show Buy/Enter wording on watch-only rows

## 5. Non-goals

- No setup candidate persistence from audit lane.
- No trade recommendation engine.
- No automatic order/trade action.
- No Gate2/core scanner rule changes.
- No AI ranking layer.

## 6. Phased rollout

### Phase 1
- Read-only Market Watch block in Dashboard/Setup page from Fresh Breakout Audit output.
- Two-lane separation and disclaimers.

### Phase 2
- Row details drawer/panel:
  - full labels,
  - risks,
  - “why not setup” explanation.

### Phase 3
- Tactical intake UI tie-in to improve watch coverage curation.

### Phase 4 (later)
- Outcome tracking and learning overlays (still non-executional by default).

## 7. Success criteria (product)

- Users can clearly identify:
  - which names are valid core setups,
  - which names are watch-only momentum diagnostics.
- No accidental interpretation of watch rows as trade approval.
- Watch rows increase context quality without diluting core discipline.

---

**Status:** Docs-only proposal. No UI implementation in this phase.
