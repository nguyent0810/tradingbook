# Phase 5 Handoff: Setup Performance Hints (Guardrail-First)

## Scope

This phase adds a lightweight learning signal directly to Setup rows, without introducing analytics workflows or changing decision logic.

## 1) What Was Implemented

- Performance is aggregated by:
  - `setupType`
  - `setupTier`
- Metrics shown:
  - `tradeCount`
  - `winRate`
  - `avgR`
- Sample-size guardrail:
  - if `n < 10`, metrics are intentionally suppressed and the UI shows **Not enough data**
  - if `n >= 10`, metrics are displayed in compact inline form

## 2) UX Behavior

- Each setup row shows a muted, compact performance hint.
- Before threshold:
  - `A-tier · Not enough data` (or B-tier equivalent)
- After threshold:
  - `A-tier · 62% win · +1.2R (n=34)` (example format)
- Explicit non-goals for this phase:
  - no analytics page
  - no charts
  - no recommendation engine or auto-ranking

## 3) Data Caveats

- Hints are derived only from closed, linked trades that have `SetupOutcome` records.
- Manual trades not linked to setups are excluded by design.
- Small samples should not drive conviction; the guardrail exists to reduce false confidence.

## 4) Manual QA Checklist

- Setup pattern with **no outcomes**:
  - verify hint shows `Not enough data`
- Setup pattern with **fewer than 10 outcomes**:
  - verify hint still shows `Not enough data`
- Setup pattern with **10+ outcomes**:
  - verify hint shows win rate, avgR, and sample count
- Formatting checks:
  - winRate shown as percent
  - avgR shown with sign and `R` suffix (e.g. `+1.2R`, `-0.4R`)
  - sample count shown as `(n=...)`

## 5) Recommended Next (Later)

Only after accumulating enough real trades:

- Entry-reason-level hints (to detect higher-quality entry contexts)
- Exit-reason failure-pattern hints (to identify avoidable outcome drivers)
- Optional Analytics page (if/when lightweight inline hints are no longer sufficient)

