# Tactical Universe / Hot Symbol Intake PRD

## Problem statement

The core scanner pipeline is operating as designed (cron, data import, curation, tradability, Gate 1, Gate 2). However, recent audits show some market-leading symbols can be absent from evaluation not because of scanner logic, but because they are not in effective universe coverage at scan time (inactive and/or missing bars).

In fast-rotating VN market conditions, manually observed leadership names can matter before they naturally appear in the curated core set. Without a tactical intake path, the system can miss timely evaluation opportunities due to intake lag.

## Product goal

Create a tactical, user-driven symbol intake layer that:

- allows temporary inclusion of important symbols for evaluation,
- preserves the core curated universe as canonical,
- keeps tradability and Gate 2 discipline unchanged,
- improves market-awareness coverage without inflating noise.

## Design DNA

- Core curated universe remains the canonical baseline.
- Tactical universe is additive, temporary, and explainable.
- Scanner discipline remains unchanged (no Gate 2 loosening).
- No hidden auto-magic or opaque scoring behavior.
- Human-in-the-loop workflow is explicit and auditable.
- UI and reports must clearly distinguish:
  - core curated symbols,
  - tactical watch symbols.
- Product must avoid becoming a momentum-chasing toy.

## User scenarios

1. Trader notices a hot breakout candidate intraday/evening (e.g. a market leader).
2. Trader adds symbol to tactical intake.
3. System validates symbol identity and fetches/imports bars with safe throttling.
4. Next scanner run evaluates symbol through the same tradability + Gate 2 gates.
5. Outcome appears with explicit tactical labeling:
   - fails tradability,
   - fails Gate 2 (near-miss or specific terminal reason),
   - passes as A/B candidate if structure exists.

## Scope phases

### Phase 1 (MVP)

- Manual tactical symbol intake (explicit user action).
- Tactical tagging at data level and scan diagnostics level.
- Forced/priority bar fetch-import path for tactical symbols.
- Inclusion in next scan universe merge.
- Read-only outcome visibility in existing diagnostics.

### Phase 2

- Tactical universe visibility in dashboard/reporting.
- Core vs Tactical filters and badges in scan diagnostics views.
- Basic tactical lifecycle controls (expire, pause, remove).

### Deferred

- Auto-trending symbol detection.
- Social/news/API trend ingestion.
- AI ranking/recommendation for tactical intake.
- Automatic momentum scoring lane.

## Non-goals

- No loosening of tradability rules.
- No loosening/replacement of Gate 2 breakout-pullback rules.
- No replacement of curated core universe.
- No automatic setup generation from tactical-only logic.
- No hidden auto-activation of hype symbols.

## Risks

- Universe pollution from emotional symbol adds.
- Overfitting to headline momentum names.
- Increased provider/API load from tactical fetch pressure.
- Operator bias and reactive chasing behavior.
- Diagnostic confusion if tactical vs curated not clearly separated.

## Mitigation principles

- Explicit source labeling and audit trail for each tactical symbol.
- Hard tactical count cap (MVP).
- Mandatory expiration for tactical membership.
- Same tradability + Gate 2 checks as core symbols.
- Safe throttling and batch controls on data fetch.
- Clear user-facing labels: tactical does not mean valid setup.

## Recommendation

Proceed with a small, operationally safe MVP:

- tactical universe is temporary and user-visible,
- additive to core only,
- fully constrained by existing scanner rules,
- designed to improve intake coverage, not to alter strategy discipline.

## Success criteria (product-level)

- Fewer hot symbols blocked at "no bars / inactive" stage.
- Tactical symbols are evaluated within one scan cycle after intake.
- No regression in scan reliability or provider stability.
- Clear evidence when symbols fail due to rules vs due to missing data.

