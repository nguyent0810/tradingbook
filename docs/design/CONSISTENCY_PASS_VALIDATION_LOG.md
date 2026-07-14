# Design Playbook + Consistency Pass — Validation Log

Exact commands and results, run on branch `design/playbook-and-consistency-pass` (base: `main` @ `2189987`, which already includes the `perf/query-batching-bundle-css` work). Each batch (0–10, see `docs/design/PLAYBOOK.md` and the commit history on this branch) was gated individually; this is the final consolidated pass across all of them together.

## 1. Lint

```
npm run lint
```
Final result: **22 problems (0 errors, 22 warnings)**. Baseline (`main`) was 23 problems (1 error, 22 warnings) — Batch 1 fixed the one pre-existing `prefer-const` error (`src/lib/scanner/early-entry/calibration.ts:157`); the 22 warnings are unchanged and pre-existing, unrelated to this work.

## 2. TypeScript

```
npx tsc --noEmit
```
Final result: **31 distinct errors** (`grep -c "error TS"`), identical count and content to the `main` baseline — all in pre-existing `*.test.ts(x)` fixture-shape mismatches, none in files this pass touched. Zero new errors introduced across all 10 batches.

## 3. Vitest

```
npx vitest run
```
Final result: **795/795 passing, 121 files** — identical to the `main` baseline. No tests added, removed, or modified; this pass touched CSS, docs, dead-code removal, and presentation-only component changes, no test-covered business logic.

## 4. Production build

```
npx next build
```
Final result: clean compile, all routes generated successfully, matching baseline route count and the intermediate check after Batches 0–5.

## 5. Playwright (full suite, final, `--workers=1`)

**50 passed, 6 failed.** The 6 failures are identical in name and error content to the pre-existing baseline, confirmed via an A/B comparison against the unmodified branch base before any of this pass's batches existed (see below) — not a regression:

| Spec | Failure |
|---|---|
| `paper-lab-arena.spec.ts:33` | battle replay tab summary — depends on seeded battle data not present locally |
| `paper-lab-arena.spec.ts:52` | agent portfolio cards — depends on seeded agent data |
| `paper-lab-arena.spec.ts:57` | open positions R column tooltip — depends on seeded position data |
| `paper-lab-arena.spec.ts:82` | agent details drawer — depends on seeded agent data |
| `paper-lab-arena.spec.ts:116` | battle tab screenshot — depends on seeded battle data |
| `accessibility-authenticated.spec.ts:19` | paper-lab axe-core — pre-existing, unrelated to token/component changes in this pass |

**Note on parallel-worker flakiness:** an initial full-suite run with default worker concurrency showed up to 17 failures, which looked like a regression. A/B testing the same test files against the unmodified branch base (`git stash`), then re-running with this pass's changes restored and both a warm cache and `--workers=1`, isolated the cause to local dev-server/DB contention under parallel workers — not this pass's changes. All batches from that point on were verified with `--workers=1` for reliable signal, consistent with the flakiness the original UI overhaul engagement documented (`UI_OVERHAUL_VALIDATION_LOG.md` §5 note on `auth.setup`).

## 6. Manual / live-browser verification

Beyond the automated lanes, batches that touched visually-live surfaces (Auth, Arena, Paper Lab) were additionally verified in a real authenticated browser session:

- **Batch 4/6/7 (token de-dup)**: computed-style checks confirmed every derived `var()` reference resolves to the exact same value as the literal it replaced.
- **Batch 5 (inline styles → classes)**: caught a real regression during verification — a plain Tailwind utility class lost to an unlayered, plain-CSS-imported class of equal specificity (`.cd-auth-error`'s `color` winning over a `text-[var(--cd-text-dim)]` utility). Fixed with the `!important` modifier on every converted class in this batch, confirmed via computed-style re-check.
- **Batch 8 (Auth Button)**: confirmed `className` is exactly `cd-auth-btn` with no extra `.btn` base class leaked in, and computed padding/font-size/border-radius/background match the pre-existing values exactly, on both `/login` and `/register`.
- **Batch 9 (Arena empty state)**: confirmed the new compact `EmptyStateWithReason` renders with no border/background and small token-driven text sizing appropriate to its slot (the seeded local data didn't naturally trigger an empty debate camp, so this was verified via an injected DOM element using the exact same CSS classes).
- **Batch 10 (Paper Lab badges)**: confirmed the DOM is byte-identical before/after — same tag, same class list, zero children, no `cd-badge` base class or decorative dot leaked in — for `StatusPill`, `ActionBadge`, and `ValidationBadge`.

No console errors observed in any of the above sessions.

## 7. Summary

Zero regressions across lint, TypeScript, Vitest, production build, and Playwright (once parallel-worker contention was isolated as environmental, not code-caused). One real cross-batch bug was found and fixed during verification itself (Batch 5's cascade-layer specificity issue), rather than shipped and discovered later — the live-browser verification step earned its cost.
