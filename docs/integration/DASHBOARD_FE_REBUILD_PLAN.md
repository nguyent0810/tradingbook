# Dashboard FE Rebuild Plan

**Started:** 2026-05-25  
**Production assumptions:** Bars through **2026-05-25**, GHA import + scan automation active, smoke guardrails deployed.  
**Contracts:** [02-api-contract.md](./02-api-contract.md), [04-frontend-integration-map.md](./04-frontend-integration-map.md), [UI_UX_MOCKUP_AND_REBUILD_BLUEPRINT.md](./UI_UX_MOCKUP_AND_REBUILD_BLUEPRINT.md), [P1_FRESHNESS_LIFECYCLE_DTO_CONTRACT.md](./P1_FRESHNESS_LIFECYCLE_DTO_CONTRACT.md)

---

## 1. Current route inventory (no invented routes)

| Route | File | Setup detail? |
|-------|------|---------------|
| `/` | `src/app/page.tsx` | — |
| `/login` | `src/app/(auth)/login/page.tsx` | — |
| `/register` | `src/app/(auth)/register/page.tsx` | — |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | — |
| `/setups` | `src/app/(dashboard)/setups/page.tsx` | Inline details (no `/setups/[id]`) |
| `/trades` | `src/app/(dashboard)/trades/page.tsx` | — |
| `/trades/new` | `src/app/(dashboard)/trades/new/page.tsx` | — |
| `/trades/[id]` | `src/app/(dashboard)/trades/[id]/page.tsx` | Trade detail |

**Not in repo:** `/analytics`, `/settings`, `/setups/[id]` — recommend only after inventory (Blueprint §2 P2).

**HTTP product APIs:** None on pages — RSC + Server Actions only (`/api/db-health`, `/api/cron/*` are ops).

---

## 2. Shared FE inventory

| Category | Existing |
|----------|----------|
| Shell | `(dashboard)/layout.tsx`, `app-shell-nav.tsx`, `logout-button.tsx` |
| UI states | `error-state-with-evidence`, `empty-state-with-reason`, `stale-data-warning`, `loading-skeleton`, `backend-blocked-state` |
| Market | `market-data-alignment-banner`, `fetchMarketSessionSnapshot`, **`fetchMarketFreshnessDto`** (P1, not wired until Slice 1) |
| Setups display | `setups-candidate-health-strip`, `setups-trader-copy`, trading display labels |
| Data loaders | `setups-queries`, `prepareSurfacedCandidatesHealthView`, `momentum-watch.ts` |
| Loading | `dashboard/loading.tsx`, `setups/*-fallbacks.tsx` |

**No client data hooks** on dashboard/setups list — server components only.

---

## 3. Page-by-page rebuild plan

### `/dashboard` — **Slice 1 (this PR)** `DONE`

| | |
|--|--|
| **User goal** | Decide today’s stance, confirm data trust, scan top setups, exposure + watchlist at a glance |
| **Required data** | `getMarketRegimeFromDb`, `fetchMarketFreshnessDto`, `getLatestDailyScanRun`, `prepareSurfacedCandidatesHealthView`, `setupWatchItem`, user `trades`, scan `notes` |
| **Current problems** | Silent empty cards; alignment banner only when stale (no positive freshness); no scan run metadata; loading skeleton mismatches layout |
| **Proposed layout** | Header → freshness strip → error (partial) → **cockpit grid** (Today’s Action \| Exposure) → scan meta → Best Setups → Momentum → Watchlist → Diagnostics |
| **Reuse** | All existing loaders; P1 `MarketFreshnessDto`; UI state components |
| **Create** | `DashboardFreshnessStrip`, `DashboardScanRunMeta`, `DashboardPageHeader`, cockpit grid CSS |
| **Empty** | `EmptyStateWithReason` for zero candidates / watchlist / diagnostics |
| **Error** | `ErrorStateWithEvidence` (keep) |
| **Mobile** | Stack cockpit columns; horizontal scroll tables |

### `/setups` — **Slice 2** `PENDING`

| | |
|--|--|
| **User goal** | Full pipeline table, perf + near-miss panels |
| **Data** | `setups-cached-data.ts` loaders, Suspense segments |
| **Problems** | Skeleton-only fallbacks; lifecycle DB vs computed merge unclear in UI |
| **Reuse** | Suspense boundaries, cached loaders, freshness DTO in overview |

### `/trades` — **Slice 3+** `PENDING` (defer monolith split)

| | |
|--|--|
| **User goal** | Review queue, filters, EOD checkpoints |
| **Data** | `prisma.trade`, health logs (Prisma post-P0), cookies |
| **Problems** | ~1959-line page; raw SQL reduced but still dense |
| **Note** | P0E batch SQL still deferred per `06-backend-gaps.md` |

### `/trades/new`, `/trades/[id]` — **Slice 4** `PENDING`

Stale `setupCandidateId` guard; health timeline UX.

### Recommended new pages (after inventory)

| Page | Priority | Blocker |
|------|----------|---------|
| Analytics | P2 | No wired backend reads |
| Settings | P2 | No settings model |
| `/setups/[id]` | P3 | Optional; inline details may suffice |

---

## 4. Slice 1 implementation checklist

- [x] `DashboardFreshnessStrip` — P1 DTO + aligned OK state
- [x] `DashboardScanRunMeta` — run id, counts, `delayedBackdrop`
- [x] `DashboardPageHeader`
- [x] Cockpit grid + improved `loading.tsx`
- [x] `EmptyStateWithReason` on Best Setups / Watchlist / Diagnostics
- [x] Dashboard Slice 1 committed
- [ ] Setups page (Slice 2)

---

## 5. Validation

```bash
npm run lint
npm test
npm run build
```

Smoke: `/dashboard`, `/setups`, `/trades` (auth redirect when logged out).
