# P1 — Market Freshness + Setup Lifecycle DTO Contract

**Status:** Foundation implemented (helpers + tests). **UI not wired** — Dashboard / Setups rebuild not started.  
**Date:** 2026-05-25  
**Related:** `06-backend-gaps.md` §4–5, `BACKEND_P0_HEALTH_LOGS_PLAN.md` (P0 closure)

---

## 1. Market freshness DTO

**Module:** `src/lib/market/market-freshness-dto.ts`

```ts
type MarketFreshnessDto = {
  benchmarkDate: string | null;   // UTC YYYY-MM-DD (VNINDEX EOD)
  equityMaxDate: string | null;   // UTC YYYY-MM-DD (max stock_daily_bars.date)
  scanRunAt: string | null;       // ISO-8601 runAt or null
  delayedBackdrop: boolean;
  staleFlags: Array<{
    code: string;
    severity: "info" | "warning" | "error";
    message: string;
  }>;
};
```

### Sources (no invented data)

| Field | Source | Null when |
|-------|--------|-----------|
| `benchmarkDate` | `fetchMarketSessionSnapshot` → VNINDEX `index_daily_bars` | No index rows |
| `equityMaxDate` | `stock_daily_bars` aggregate max `date` | No equity bars |
| `scanRunAt` | Latest `daily_scan_runs.runAt` | No scan runs |
| `delayedBackdrop` | `isBenchmarkStaleVsEquity` OR alignment issues OR optional `notes.benchmarkBackdrop.delayedBackdrop` | — |
| `staleFlags` | `analyzeMarketDataAlignment` issue codes | Empty when aligned |

### Preserved behavior

- Same rules as `analyzeMarketDataAlignment` + `MarketDataAlignmentBanner` copy semantics.
- Existing pages keep calling `fetchMarketSessionSnapshot` + `analyzeMarketDataAlignment` until a UI slice adopts `fetchMarketFreshnessDto`.

### API

- `buildMarketFreshnessDto({ snapshot, alignment?, delayedBackdropFromScanNotes? })`
- `fetchMarketFreshnessDto(prisma, options?)` — read-only loader

---

## 2. Setup lifecycle DTO

**Module:** `src/lib/setup-lifecycle/setup-lifecycle-dto.ts`

```ts
type SetupLifecycleDto = {
  status: string;
  label: string;
  sortRank: number;
  source: "db" | "computed" | "fallback";
  warning?: string;
};
```

### Three semantics (documented, not merged)

| Source | Origin | Label helper | Used today on |
|--------|--------|--------------|---------------|
| **db** | `SetupWatchItem.lifecycleStatus` / `SetupLifecycleStatus` enum | `displaySetupLifecycleStatus` | Watchlist-oriented surfaces |
| **computed** | Surfaced candidate `lifecycleSortLabel` (close in pullback zone) | `displayCandidateLifecycleSortLabel` | Dashboard top setups, setups candidates strip |
| **fallback** | Unknown string | `displaySetupLifecycleStatus` + warning | Rare parse edges |

**Important:** DB `READY` (“At entry zone”) and computed `READY` (same label text) can **diverge** from DB `WATCHING` when price is in zone — `normalizeSetupLifecycleWithWatchContext` surfaces a `warning` only; **does not change** `prepareSurfacedCandidatesHealthView` or page rendering.

### Normalizers

| Function | Input |
|----------|--------|
| `normalizeSetupLifecycleFromDb` | `SetupLifecycleStatus` |
| `normalizeSetupLifecycleFromSurfacedSortLabel` | `"READY" \| "WATCHING"` |
| `normalizeSetupLifecycleFromCloseInZone` | close + zone bounds (same rule as health view) |
| `normalizeSetupLifecycleWithWatchContext` | computed label + optional DB status |

**DB enum behavior:** unchanged — no migrations, no FSM changes.

---

## 3. Adoption status

| Consumer | Freshness DTO | Lifecycle DTO |
|----------|---------------|---------------|
| `dashboard/page.tsx` | Not wired | Not wired |
| `setups/*` | Not wired | Not wired |
| `trades/page.tsx` | Not wired | Not wired |
| Phase 2 UI rebuild | Planned consumer | Planned consumer |

---

## 4. Tests

| File | Coverage |
|------|----------|
| `src/lib/market/market-freshness-dto.test.ts` | Aligned / stale / missing scan / delayed backdrop |
| `src/lib/setup-lifecycle/setup-lifecycle-dto.test.ts` | DB, computed, zone rule, watch conflict warning |
| `src/lib/market/market-data-freshness-report.test.ts` | Legacy alignment report (unchanged) |

---

## 5. Read-only verification

```bash
npx tsx -e "import './scripts/load-env'; ..."
# Or production (read-only):
SMOKE_DATABASE=production npx tsx scripts/p1-dto-read-smoke.ts  # if added
```

Helpers are safe to call without writes; only pass `delayedBackdropFromScanNotes` from parsed scan notes when mirroring setups overview.
