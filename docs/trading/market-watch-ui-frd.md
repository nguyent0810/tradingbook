# Market Watch UI FRD (Setup Ready vs Momentum Watch)

## 1. Functional objective

Define a UI layer that renders two clearly separated lanes:

1. **Core Setup Candidates (Đủ điều kiện)**
2. **Momentum Watch / Fresh Breakout Audit (Có lực / theo dõi)**

The second lane is read-only and observational. It must not create setups or trades.

## 2. Data sources

### 2.1 Core lane
- Latest `DailyScanRun` + `setup_candidates` pipeline outputs (existing core scanner path).
- Existing setup quality/tier semantics remain unchanged.

### 2.2 Momentum Watch lane
- Fresh Breakout Audit helper/runtime logic in `src/lib/scanner/fresh-breakout-audit.ts`.
- Same diagnostics and grouping semantics as CLI path.

### 2.3 Universe labels
- Tactical merge source labels from tactical universe logic:
  - `CORE`
  - `TACTICAL`
  - `BOTH`

## 3. Runtime design (MVP)

- Prefer server-side helper route (or server component loader) that reuses audit helper logic.
- Do not persist Momentum Watch rows for MVP unless explicitly approved later.
- Compute read-only rows at request time from latest available bars + expected session.

### Guardrail
- No `SetupCandidate` inserts from this flow.
- No mutation of scanner state.

## 4. Display contract

Momentum Watch rows expose existing group semantics:

- `ACTIONABLE_WATCH`
- `EXTENDED_WATCH_ONLY`
- `AVOID_RISK`
- `COVERAGE_TRADABILITY_BLOCKED`

### Default display

- Show by default:
  - `ACTIONABLE_WATCH`
  - optionally `EXTENDED_WATCH_ONLY`
- Hide by default:
  - `AVOID_RISK`
  - `COVERAGE_TRADABILITY_BLOCKED`
  - expose via “show more/filter” control.

### Minimum row payload (UI contract)

- `symbol`
- `universeSource`
- `labels[]`
- `riskAnnotations[]`
- `latestClose`
- `volumeRatio20`
- `breakoutExtensionPct`
- `whyNotCoreSetup` (deterministic explanation string)
- `group`

## 5. Safety rules

1. Momentum Watch must always show disclaimer:
   - **“Watch only — not a validated setup”**
2. If `riskAnnotations` contains `STOP_FAR` or `EXTENDED`, render visible risk emphasis.
3. Disable/hide **Create Trade** CTA for watch-only rows.
4. Do not present watch rows with setup-tier visuals that imply qualification parity.

## 6. Performance requirements

- Cap output to top N rows (default e.g. 10–20).
- Reuse existing audit ranking/filtering logic; avoid duplicate ranking implementations.
- Avoid unbounded scans on page load:
  - evaluate once per request with hard cap,
  - consider short server-side cache if latency increases.

## 7. Acceptance criteria

1. User can clearly distinguish:
   - valid setup (core lane),
   - momentum watch-only (secondary lane).
2. No setup candidates are created by momentum watch lane.
3. No trading CTA on watch-only rows.
4. Core scanner behavior and outputs remain unchanged.
5. Watch lane includes visible risks and “why not setup” explanation.

## 8. Out of scope (this phase)

- UI-driven rule changes to Gate2.
- Trade recommendation or execution actions from watch lane.
- AI ranking/score overlays.
- Backfilled persistence model for watch rows.

---

**Status:** Docs-only functional spec. No UI implementation in this phase.
