# Design Engineering Playbook

**Status:** ACTIVE — single source of truth for design-engineering practice across the app.
**Supersedes:** `DESIGN.md`, `UI_BLUEPRINT.md`, `UI_DNA_DESIGN_SYSTEM.md`, `REFACTOR_PLAN.md`, `TRADING_DASHBOARD_PRD.md` (archived under `docs/archive/` — their concrete page inventories described a `/trades` ledger IA that no longer exists; their principle-level guidance is carried forward below, not discarded).
**Does not replace:** [`TRADING_OS_V2_VISUAL_SPEC.md`](./TRADING_OS_V2_VISUAL_SPEC.md) (color/type/surface tokens — still canonical) or [`DASHBOARD_DECISION_COCKPIT_UX_SPEC.md`](./DASHBOARD_DECISION_COCKPIT_UX_SPEC.md) (Dashboard IA — still canonical). This document is the layer above both: the rules that apply everywhere, plus the state/motion/a11y/performance guidance neither of those specs formalizes.

---

## 1. Philosophy (ported from archived docs, still valid)

- **Decision-first, not data-first.** Show what changes the trader's action *now*; push rationale and diagnostics behind progressive disclosure (`<details>`, collapsible sections). A trader should identify stance and next action in under 5-10 seconds under fatigue. *(from `TRADING_DASHBOARD_PRD.md`, `DASHBOARD_DECISION_COCKPIT_UX_SPEC.md`)*
- **Serious fintech, not consumer SaaS.** No mascots, no gamification (streaks/badges/confetti), no "delight for its own sake." Copy is short and operational ("Log trade", "Wait for pullback"), never cute. *(from `DESIGN.md`)*
- **Numeric honesty.** Tabular/monospace numbers, right-aligned, consistent currency formatting. Charts are minimal — no chartjunk, no decorative gradients behind metrics. *(from `DESIGN.md`, `TRADING_OS_V2_VISUAL_SPEC.md`)*
- **Strict decision hierarchy.** Market → Setups → Health → Risk → Execution. A higher layer blocking action is never overridden by lower-layer optimism in the UI. *(from `TRADING_DASHBOARD_PRD.md`)*
- **One primary message per card; main row vs. details.** Main rows carry decision essentials only (status + core numbers); anything needing more than ~8 words of explanation moves to a details/expansion panel. *(from `UI_DNA_DESIGN_SYSTEM.md`)*
- **No modal abuse.** Prefer inline expansion over modals for row-level context; reserve modals for destructive confirmation or genuine cross-page interruption. *(from `UI_DNA_DESIGN_SYSTEM.md`)*

## 2. Token contract

`src/app/tokens.css` is the **single source of truth** for color, spacing, radius, typography, shadow, and transition-duration values. Any new UI must reference these tokens, never introduce a parallel literal.

**Known, tracked exception:** `--cd-*` (defined in `globals.css`, backing `.cd-auth`/`.cd-landing`/shell surfaces) is a **second, largely-independent token set** — not just aliasing, but distinct literal values for background/surface/text/radius/motion-duration (e.g. `--cd-bg:#060a14` vs. `--bg-primary:#09090b`; `--cd-radius:14px` vs. `--radius-lg:12px`). The consistency-pass batches derived every value that was an **exact** match (`--cd-long/short/pnl-pos/pnl-neg`, all seven `--cd-space-*`, `--cd-elev-1`) as `var()` references into `tokens.css` — that pattern is the target for the rest. Confirmed genuinely divergent and left as-is (do not silently merge — each is a visual decision for separate review, not a token rename):
  - Surfaces/text/semantic colors: `--cd-bg`, `--cd-bg-accent`, `--cd-surface`, `--cd-surface-raised`, `--cd-border`, `--cd-text`, `--cd-text-muted`, `--cd-text-dim`, `--cd-danger`, `--cd-warning`, `--cd-success`, `--cd-neutral`
  - Radius: `--cd-radius-sm` (8px vs. `--radius-sm` 6px), `--cd-radius-md` (10px vs. `--radius-md` 8px), `--cd-radius` (14px vs. `--radius-lg` 12px), `--cd-radius-lg` (18px vs. `--radius-xl` 16px) — none match
  - Elevation: `--cd-elev-2`/`--cd-elev-3` match `--shadow-md`/`--shadow-lg`'s blur/spread exactly but use a different alpha (0.35/0.45 vs. 0.28/0.38)
  - Motion: `--cd-motion-fast/base/slow` and `--cd-ease` are bare duration/easing values used compositionally (`transition: x var(--cd-motion-fast) var(--cd-ease)`), while `tokens.css`'s `--transition-fast`/`--transition-base` are full duration+easing shorthands — structurally different shapes, not a simple value swap

Do not add a third parallel scale. If a surface needs a value `tokens.css` doesn't have, add it to `tokens.css` (or, if truly `.cd-*`-surface-specific and intentionally divergent, add it to the `--cd-*` block deriving from a `tokens.css` var wherever the values happen to match).

## 3. Component consistency

- `src/components/ui/*` (`Button`, `Badge`, `Card`, `Input`, `Select`, `FormField`, `DenseTable`, `ChartFrame`/`ChartPlot`, `LoadingSkeleton`, `EmptyStateWithReason`, error/stale-data/backend-blocked states, `PriceWithUnit`, `RetryActionPanel`) is the shared primitive library. **Domain-specific wrappers (Paper Lab, Setups, Auth) must render these primitives underneath, not reimplement their own badge/card/button from scratch.** Where a domain surface needs different visual treatment than the primitive currently offers, extend the primitive (a new variant/tone) rather than forking it.
- If a domain component currently forks a primitive (e.g. Paper Lab's own `StatusPill`/`ActionBadge`/`ValidationBadge`, or Auth's own raw `<button>`), treat that as tracked debt to consolidate, not a pattern to repeat for new work.
- Before writing a new component, grep `src/components/ui/` first. A three-way fork of the same concept (this repo has had Badge, Card, and Button each forked 2-4x historically) is the single most common form of drift here — the 2026-07 UI overhaul consolidated the worst of it once; don't recreate it.

## 4. Loading, empty, and error states

- Loading, empty, and error states are first-class designs, reviewed with the same care as the "happy path" — never an afterthought bolted on last.
- Skeletons must match the shape of the content they precede (same column/row structure) so nothing jumps when real data arrives. Reuse `src/components/ui/loading-skeleton.tsx`; don't hand-roll a local skeleton per component.
- Empty states explain **what will appear and how** ("No battles yet — agents compete once you start a session"), not just "No data." A bare em-dash (`—`) is acceptable only for a single missing *field* inside an otherwise-populated row — never as a substitute for a section-level empty state.
- Stale, disconnected, or error states must be visually unambiguous — this is a money tool; silent ambiguity about whether data is current is unacceptable. Use the existing `stale-data`/`backend-blocked` primitives rather than inventing new copy patterns per surface.
- Every distinct part of the app (Dashboard, Setups, Arena/Paper Lab, Auth) should use the *same* empty-state component (`EmptyStateWithReason`) for section-level blanks. Today Arena/Paper Lab is the one surface still using an ad hoc pattern — this is tracked debt, not the intended standard.

## 5. Motion and micro-interactions

Distilled from `emilkowalski/skills`' animation-review practice, Linear's "motion should be nearly invisible" philosophy, and Shopify Polaris' "motion helps understand the outcome of an action" principle — filtered for a dark, dense, no-nonsense trading tool (not a marketing site):

- Animate only `transform` and `opacity`. Never animate layout-triggering properties (`width`, `height`, `top`, `left`) — jank on a data-dense screen erodes trust fast.
- Every animation must have a reason tied to a state change (open/close, success/error, value update) — "looks nice" is not sufic justification, especially on elements the trader sees dozens of times per session.
- High-frequency elements (price ticks, row updates, live P&L) get **zero or minimal** motion. Save any motion budget for rare, first-run, or genuinely state-changing moments.
- Keep durations under ~200-300ms. A speed-obsessed tool should never *feel* slower than it is because of gratuitous transition time.
- Use ease-out for entrances; asymmetric timing for opposite actions (e.g. a dismiss can be faster than an appear) — never symmetric durations applied blindly to both directions.
- In-flight animations retarget from their current state rather than restarting from a keyframe — data updates continuously; a restart-on-every-update animation reads as broken, not lively.
- Respect `prefers-reduced-motion` (this repo already has 14 CSS fallback blocks plus `useReducedMotion()` hooks — keep that discipline for all new motion) and gate hover-only effects behind `(hover: hover)` so touch devices don't get stuck mid-transition.

## 6. Accessibility

- WCAG 2.2 AA is the floor: visible focus states, full keyboard operability, correct ARIA on custom dense components (tables, tickers, command palettes).
- **Open item, not resolved:** axe-core's `color-contrast` rule was disabled during the 2026-07 overhaul's automated audit (headless-rendering fidelity issue) and only spot-checked manually against token-defined pairs — it has not been exhaustively verified. Do not assume contrast is fully verified; re-enable and re-audit before claiming this is closed.
- Never convey state through color alone — pair with label text or an icon that has a text equivalent (the existing `HEALTHY`/`WARNING`/`AT_RISK`/`DEAD` and `PASS`/`WARNING`/`FAIL` badge patterns already do this correctly; keep doing it for new state badges).
- No nested focusable controls (a `<button>` inside a `role="button"` container) — this was a real, confirmed WCAG 4.1.2 violation found in Arena during the last audit. Keep interactive elements as siblings, not ancestor/descendant.

## 7. Performance-conscious UI engineering

- Profile real interactions — scrolling a large table, a live data update — not just synthetic Lighthouse scores.
- Ship incrementally; don't block a batch of improvements on achieving a "perfect" end state first.
- Speed is a design decision, not only an engineering one: optimistic UI and caching make the tool *feel* instant, which matters as much as raw load time for a decision-under-fatigue tool.
- Treat an unused CSS token or an orphaned component as debt to remove, the same way a compiler warning gets fixed — the 2026-07 overhaul's biggest single fix was deleting ~9,000 lines of dead/duplicate CSS and 69 dead files; don't let that regrow silently.

## 8. Iconography

- Icons are functional, not decorative: inline SVGs with `aria-hidden="true"` paired with adjacent text, matching the existing pattern in Auth forms and Arena award cards. No icon-only status indicators without a text/label equivalent nearby (see §6).
- Keep stroke weight and sizing consistent with the existing inline-SVG icons already in the codebase (Auth error/spinner icons) rather than introducing an icon library or font for one new surface.

## 9. Layout composition

For new page-level layout, reuse the shared shell/grid/panel primitives in `src/components/trading-os-v3/layout/` (used by Setups) rather than hand-rolling a new grid system per surface. See `TRADING_OS_V2_VISUAL_SPEC.md` §3-4 for the approved per-page layout rules (Dashboard, Setups) and `DASHBOARD_DECISION_COCKPIT_UX_SPEC.md` for the current Dashboard IA in full.

## 10. Known, tracked debt (do not silently claim these are resolved)

- `--cd-*` token set duplicates rather than fully derives from `tokens.css` (§2).
- Paper Lab's `StatusPill`/`ActionBadge`/`ValidationBadge` fork the shared `Badge` concept instead of rendering it (§3).
- Auth's submit buttons (`login-form.tsx`, `register-form.tsx`) bypass the shared `Button` component with a raw `<button>` (§3).
- Arena/Paper Lab uses an ad hoc empty-state convention instead of `EmptyStateWithReason` (§4).
- `Panel`/`Card` is independently implemented three times (`ui/card.tsx`, `paper-lab/ui/PaperLabPanel.tsx`, `trading-os-v3/layout/v3-panel.tsx`) — directionally should converge, but is high-effort/high-risk and deliberately deferred rather than forced into a small batch.
- axe-core `color-contrast` auditing is disabled/unverified (§6).
- `.cd-auth-btn:hover` uses `--cd-auth-btn-hover-legacy` (`#5cf0ff`), a bright cyan that looks like a spot the 2026-07 cyan→indigo migration missed (the button's resting state already uses `--cd-cyan`/`--accent-hover`). Extracted verbatim into a named token rather than silently changed to indigo — reconciling it is a visual decision (does hover need a color shift at all, or should the glow alone carry the affordance?) that needs explicit review, not a mechanical token-extraction call.
- `src/app/v3-layout-foundation.css` hardcodes its entire color palette (`#e9edf6`, `#040507`, `#dbe7f8`, `#9eb0c9`, `#eef6ff`, `#2dd4bf`, `#8fc8ff`, `#c5d4e8`, `#8fa0bc`, plus a dozen-plus `rgba(102,128,159,…)` border/background variants) with zero local custom-property layer — this is a distinct "V3 slate-blue" palette, not a token-contract violation with an obvious 1:1 fix like `setups-workstation.css` had. Tokenizing it properly (introducing a `--tosv3-*` scoped set, deduping the repeated-but-inconsistent-alpha border colors) is a larger, its-own-review pass, not a mechanical extraction — deliberately out of scope for the consistency-pass batches.
