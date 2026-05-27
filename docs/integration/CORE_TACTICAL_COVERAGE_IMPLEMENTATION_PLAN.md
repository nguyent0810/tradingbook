# Smart Large Slice Plan — Combined Core + Tactical Coverage Implementation

## Scope

Coverage universe/import only. No UI changes, no scanner threshold changes, no fake data, no manual setup inserts.

## 1) Core universe curation

1. Use `MARKET_COVERAGE_GAP_AUDIT` output to build a candidate list of inactive-but-liquid symbols.
2. Prioritize activation set including (if still justified by latest diagnostics):
   - `VND, PDR, SSI, HPG, FPT, MWG, VHM, VIC, TCB, MBB, VPB`
3. Keep bounded universe size (do not activate all 1537):
   - apply curation constraints (min bar history, liquidity proxy, recency/freshness checks).
4. Prepare dry-run curation report first; require explicit approval before applying active-flag changes.

## 2) Tactical universe alignment

1. Confirm current tactical model and code path:
   - active tactical rows with expiry are already supported.
2. Ensure tactical active symbols are included in **import universe generation**.
3. Ensure tactical active symbols are included in scanner effective universe (already expected; verify parity tests).

## 3) Import/scanner universe alignment

1. Define one canonical merged universe contract:
   - `effective = active core ∪ active tactical` (dedup by symbol).
2. Update export/import symbol generation so import uses this merged list.
3. Keep scanner merged universe logic aligned with the same rules.
4. Add diagnostics guard to detect drift between import symbol set and scanner symbol set.

## 4) Production recovery flow (post-approval)

1. Import bars for newly included symbols (core + tactical additions only).
2. Trigger daily scan.
3. Re-run symbol diagnostics for key names (at minimum VND/PDR and prioritized majors).
4. Verify Best Setups and Momentum Watch behavior based on real scan outputs.

## 5) Rollback plan

1. Core rollback:
   - deactivate recently added core symbols via curation rollback list.
2. Tactical rollback:
   - expire or deactivate tactical entries.
3. Code rollback:
   - revert coverage implementation commit(s) if universe expansion causes unacceptable runtime/noise.

## 6) Implementation boundaries

- No production data updates in planning phase.
- No import execution in planning phase.
- No migrations unless proven required and separately approved.

## 7) Implementation status (this branch)

- Added shared effective-universe loader for reuse by scanner + import export.
- Wired production import symbol export to merged effective universe (`core ∪ tactical`).
- Wired scanner runtime to the shared effective-universe loader.
- Extended diagnostics outputs with explicit coverage-matrix fields:
  - in core / in tactical / effective source / included in import / included in scan.
- Added unit tests for effective-universe merge contract and export symbol key generation.
