# UI Implementation Readiness Plan

This document establishes the risk review, route control rules, component classification boundaries, and validation requirements for the trading intelligence application's UI/UX rebuild, based on [docs/integration/UI_UX_MOCKUP_AND_REBUILD_BLUEPRINT.md](./UI_UX_MOCKUP_AND_REBUILD_BLUEPRINT.md).

---

## Section 1 — Blueprint Risk Review

We have reviewed the proposed visual designs and structural recommendations in the blueprint. The following risk grid defines the architectural and system stability concerns:

| Risk | Where In Blueprint | Why It Is Risky | Required Decision |
|---|---|---|---|
| **Analytics page creation and styling** | Section 2 & Section 3 (Analytics page) | There is no backend read path or query loader wired in `src/app`. Implementing visual charts in a new page forces mock data usage and violates the "No Mock Data" rule. | **DEFER** all analytics view development. Build a simple `BackendBlockedState` component to placeholder the route without data execution. |
| **Settings / Data & Risk page creation** | Section 2 & Section 3 (Settings page) | No database model exists to store settings or timezone parameters. Any settings UI built now will be ephemeral (cookie/session only), diverging from future database sync goals. | **DEFER** settings page creation. Do not build new routes. |
| **AppShell structure and routing changes** | Section 5 (Layout components) | Modifying layout routes and global session checks risks breaking user auth redirects (`getSession()` redirect to `/login`). | **RESTRICT** AppShell changes to visual CSS adjustments (colors, layout primitive spacing, fonts) without modifying layouts' logical redirects. |
| **DataFreshnessBanner integration** | Section 5 (Layout components) | The freshness calculations are currently scattered and lack a unified data structure. Building the banner now forces layout files to query dates ad-hoc or use mock variables. | **DEFER** building this banner until Phase 0/1 backend freshness DTO is completed. |
| **trade_health_logs Prisma promotion** | Section 7 (Backend-blocked table) | Modifying migrations and pushing schemas risks locking PostgreSQL tables or causing typed query mismatch errors on active routes. | **ISOLATE** Prisma model promotion to the Backend Contract Track. Ensure database migration runs and succeeds before any UI checkpoint code touches it. |
| **SetupOutcome exit health fix** | Section 7 (Exit health logic) | Changing the trades close mutation pipeline (`writeSetupOutcomeFromTrade`) affects trade lifecycle transitions. Risks breaking the `CLOSED` trade logic. | **ISOLATE** exit health fix to Backend Contract Track. Verify setup outcome integration with backend tests. |
| **Monolithic `/trades` page refactor** | Section 1 (Current Route inventory) | The current `/trades/page.tsx` is 1959 lines of logic handling complex hooks, search parameters, and clusters. Splitting this file immediately will likely introduce regressions in filters or postures. | **DEFER** the splitting of `/trades/page.tsx`. Only apply CSS class selectors and design tokens to style existing structures. |
| **Building new UI components without data** | Section 5 (Trading / Journal / Analytics) | Building components like `TradeRiskMeter` or `LearningLoopSummary` before their backend fields exist will force developer assumptions on DTO keys. | **DEFER** or **DESIGN_ONLY** components that lack backend backing (e.g. dynamic risk capacity fields). |

---

## Section 2 — Route Approval Matrix

Every page/route must be approved explicitly under the contract boundaries. 

| Route | Current Exists? | Blueprint Recommendation | Can Build Now? | Reason | Route Classification |
|---|---|---|---|---|---|
| `/` | Yes | Keep (Styling Polish) | **Yes** | Static layout only; no data structures. | `CURRENT_ROUTE` |
| `/login` | Yes | Keep (Styling Polish) | **Yes** | Auth logic works; needs styling class updates. | `CURRENT_ROUTE` |
| `/register` | Yes | Keep (Styling Polish) | **Yes** | Auth logic works; needs styling class updates. | `CURRENT_ROUTE` |
| `/dashboard` | Yes | Rebuild | **No** (Visual Only) | Safe for visual shell updates; defer stance/allocation logic updates. | `CURRENT_ROUTE` |
| `/setups` | Yes | Rebuild | **No** (Visual Only) | Safe for visual shell updates; defer lifecycle status change logic. | `CURRENT_ROUTE` |
| `/trades` | Yes | Rebuild | **No** (Visual Only) | Monolithic file; restrict to design system CSS updates. Defer component split. | `CURRENT_ROUTE` |
| `/trades/new` | Yes | Rebuild | **No** (Visual Only) | Limit to visual updates. Defer stale candidate validations. | `CURRENT_ROUTE` |
| `/trades/[id]` | Yes | Rebuild | **No** (Visual Only) | Defer timeline/checkpoint form updates until SQL is promoted to Prisma. | `CURRENT_ROUTE` |
| `/analytics` | No | Prototype Only | **No** | Blocked by missing backend read path. Do not create new routes. | `BACKEND_BLOCKED` |
| `/settings` | No | Prototype Only | **No** | Blocked by settings database schema. Do not create new routes. | `BACKEND_BLOCKED` |

---

## Section 3 — Component Build Matrix

Proposed components are mapped to their technical constraints to prevent mixed-domain implementations:

| Component | Exists Now? | Needed For First Slice? | Backend Dependency | Build Decision | Component Classification |
|---|---|---|---|---|---|
| `AppShell` | Yes | Yes | None | `BUILD_NOW` (visual styling adjustments) | `EXISTS_NOW` |
| `TopBar` | Yes | Yes | None | `BUILD_NOW` (visual styling adjustments) | `EXISTS_NOW` |
| `Sidebar` | Yes | Yes | None | `BUILD_NOW` (visual styling adjustments) | `EXISTS_NOW` |
| `PageHeader` | Yes | Yes | None | `BUILD_NOW` (visual styling adjustments) | `EXISTS_NOW` |
| `DataFreshnessBanner` | No | No | Gap 5 (freshness DTO) | `DEFER` | `NEW_COMPONENT_REQUIRES_BACKEND` |
| `CommandPanel` | No | No | Gap 12 (observability) | `DEFER` | `NEW_COMPONENT_REQUIRES_BACKEND` |
| `SetupCard` | Yes (row details) | No | None | `DEFER` | `EXISTS_NOW` |
| `SetupPipelineTable` | Yes (setups list) | No | None | `DEFER` | `EXISTS_NOW` |
| `TradeHealthBadge` | Yes (as text pill) | Yes | None | `BUILD_NOW` (convert to design tokens) | `EXISTS_NOW` |
| `TradeRiskMeter` | No | No | Gap 6 (Risk budget DB) | `BACKEND_BLOCKED` | `NEW_COMPONENT_REQUIRES_BACKEND` |
| `PositionReviewCard` | No | No | None | `DEFER` | `NEW_COMPONENT_SAFE` |
| `CandidateScoreCard` | Yes (inline) | No | None | `DEFER` | `EXISTS_NOW` |
| `MomentumWatchCard` | Yes (section) | No | None | `DEFER` | `EXISTS_NOW` |
| `PriceWithUnit` | No | Yes | None | `BUILD_NOW` (pure formatting filter helper) | `NEW_COMPONENT_SAFE` |
| `MarketFreshnessStatus`| No | No | Gap 5 (freshness DTO) | `DEFER` | `NEW_COMPONENT_REQUIRES_BACKEND` |
| `ScanRunStatus` | Yes | No | None | `DEFER` | `EXISTS_NOW` |
| `TradeTimeline` | Yes | No | Gap 1 (Prisma health model) | `DEFER` | `EXISTS_NOW` |
| `HealthCheckpointList` | Yes | No | Gap 1 (Prisma health model) | `DEFER` | `EXISTS_NOW` |
| `HealthCheckpointForm` | Yes | No | Gap 1 (Prisma health model) | `DEFER` | `EXISTS_NOW` |
| `ExitOutcomePanel` | Yes (writeback) | No | Gap 3 (Exit health level) | `DEFER` | `EXISTS_NOW` |
| `LearningLoopSummary` | No | No | Gap 3 (Exit health level) | `DEFER` | `NEW_COMPONENT_REQUIRES_BACKEND` |
| `EquityCurvePanel` | No | No | Gap 8 (Analytics read path) | `REMOVE_FROM_FIRST_SLICE` | `DO_NOT_BUILD_YET` |
| `PerformanceMetricCard` | No | No | Gap 8 (Analytics read path) | `REMOVE_FROM_FIRST_SLICE` | `DO_NOT_BUILD_YET` |
| `PlaybookPerformanceTable`| No | No | Gap 8 (Analytics read path) | `REMOVE_FROM_FIRST_SLICE` | `DO_NOT_BUILD_YET` |
| `DrawdownPanel` | No | No | Gap 8 (Analytics read path) | `REMOVE_FROM_FIRST_SLICE` | `DO_NOT_BUILD_YET` |
| `MistakePatternPanel` | No | No | Gap 8 (Analytics read path) | `REMOVE_FROM_FIRST_SLICE` | `DO_NOT_BUILD_YET` |
| `LoadingSkeleton` | No | Yes | None | `BUILD_NOW` | `NEW_COMPONENT_SAFE` |
| `EmptyStateWithReason` | No | Yes | None | `BUILD_NOW` | `NEW_COMPONENT_SAFE` |
| `ErrorStateWithEvidence`| No | Yes | None | `BUILD_NOW` | `NEW_COMPONENT_SAFE` |
| `BackendBlockedState` | No | Yes | None | `BUILD_NOW` | `NEW_COMPONENT_SAFE` |
| `StaleDataWarning` | No | Yes | None | `BUILD_NOW` | `NEW_COMPONENT_SAFE` |
| `RetryActionPanel` | No | Yes | None | `BUILD_NOW` | `NEW_COMPONENT_SAFE` |

---

## Section 4 — Backend vs Frontend Split

### Backend Contract Track
Includes only tasks modifying Prisma schemas, migrations, Server Action business logic, and API data loaders:
1. Promote `trade_health_logs` raw SQL table to first-class Prisma model in `schema.prisma`.
2. Fix `SetupOutcome.healthLevelAtExit` assignment inside trade closing logic.
3. Establish canonical Server Action DTO formats (avoiding REST vs RPC divergence).
4. Implement timezone-aware boundaries for "reviewed today" tags.
5. Create explicit market-data freshness DTO.

### Frontend Design Track
Includes only styling definitions, layout design rules, custom variables, and static presentation components. No routes may be added, and no existing data loading logic may be refactored:
1. Declare visual CSS variables (theme, color system, grid sizes) in `src/app/globals.css`.
2. Implement design tokens on existing component classes (badges, tables, borders).
3. Rebuild AppShell styling layout containers.
4. Implement pure presentation components: `LoadingSkeleton`, `EmptyStateWithReason`, `ErrorStateWithEvidence`, `BackendBlockedState`, `StaleDataWarning`, `RetryActionPanel`.
5. Implement number unit formatters: `PriceWithUnit`.

---

## Section 5 — Recommended First Implementation Slice

### Phase 1A — Design System Foundation Only

This slice builds the static design system foundations, variables, and feedback states without changing backend data loads, Prisma structures, or routing contracts.

| Item | File Likely Touched | Risk | Validation |
|---|---|---|---|
| **Design System CSS Variables & Tokens** | `src/app/globals.css` | Styling regressions across tables or input fields if margins/borders are misaligned. | Visual smoke review of existing `/dashboard`, `/trades`, `/setups` pages. |
| **PriceWithUnit helper** | `src/components/ui/price-with-unit.tsx` | Float display rounding mismatches. | Unit testing of float formatting (`42.50` -> `42.50 k ₫`). |
| **State Components** (`LoadingSkeleton`, `EmptyStateWithReason`, `ErrorStateWithEvidence`, `BackendBlockedState`, `StaleDataWarning`, `RetryActionPanel`) | `src/components/ui/state-components.tsx` | Layout breaking if imported inside standard cards or tables. | Create static test mocks on the marketing `/` landing route for visual inspection. |

---

## Section 6 — Stop Conditions

The developer must stop work immediately if any of the following boundaries are crossed:

1. **Stop** if a backend model field is missing from `schema.prisma` or if a database query requires a schema change.
2. **Stop** if route creation is requested (no new directories under `src/app/` like `/settings` or `/analytics`).
3. **Stop** if a database migration (`prisma migrate`) or db push is triggered during this slice.
4. **Stop** if a component requires mock data structures to be compiled or run.
5. **Stop** if changes to `/trades/page.tsx` exceed layout/class adjustments or try to split the monolithic logic.
6. **Stop** if visual changes modify query logic, parameters, or session cookie states.

---

## Section 7 — Validation Plan

Validation must be executed without altering data flows.

### 1. Build Verification
* **Typecheck Command:** Run command to verify typescript compilation:
  ```powershell
  npx tsc --noEmit
  ```
* **Lint Command:** Verify code format rules match guidelines:
  ```powershell
  npm run lint
  ```

### 2. Manual Visual Smoke Checks
* Open the `/` landing page and test static styling imports.
* Inspect `/dashboard` to verify that existing data displays with the new slate-black styles and outfits fonts.
* Inspect `/trades` page and confirm table spacing handles density metrics without clipping text.
* Check `/trades/new` to verify that input borders align with the updated design parameters.
