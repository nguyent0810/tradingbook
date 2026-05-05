# Phase 6: Real Usage Protocol

## Goal

Define a practical daily operating protocol so trading behavior produces reliable, high-quality data for learning over time.

## 1) Daily Workflow

1. Check setups at session start.
2. Enter positions by either:
   - **Create Trade from Setup** when setup-driven, or
   - **Manual trade** when not linked to a setup.
3. During market hours:
   - add an optional health checkpoint if structure meaningfully changes.
4. End of day (mandatory):
   - add a health checkpoint for **all OPEN trades**.
5. Close trades when strategy rules are met (target hit, stop hit, or valid discretionary rule).
6. Confirm outcome writeback for linked setup trades after close.

## 2) Discipline Rules

- Never skip EOD checkpoint for OPEN trades.
- Never close a trade without `exitReason`.
- Never use free-text instead of dropdown reason fields when a dropdown exists.
- Do not create duplicate trades for the same setup unless intent is explicit and justified.

## 3) Data Quality Rules

- Always select the correct `entryReason`.
- Always record `healthLevel` honestly at the time of observation (no hindsight editing mindset).
- Avoid mislabeling emotional exits as disciplined exits.

## 4) Minimum Data Requirements

- Do not trust performance hints until there are at least **10 trades per setup pattern**.
- Do not compare setup patterns until there are at least **30 trades** for meaningful contrast.

## 5) Weekly Review Ritual

Review recent trades for:

- repeated `WARNING -> AT_RISK` degradation paths,
- frequent `STRUCTURE_BROKEN` exits.

Identify recurring behavior issues:

- late entries,
- poor-health entries.

## 6) What NOT To Do

- Do not optimize strategy based on 1-2 trades.
- Do not change strategy frequently due to short-term noise.
- Do not overfit to recent outcomes.

## 7) When To Unlock Next Features

- After **30-50 closed linked trades**:
  - enable entryReason-level hints.
- After **80-100 trades**:
  - consider adding an Analytics page.

