# Dashboard Foreign evidence — production verification

**Status:** Verified on production Command Deck (commit lineage includes `1993ee6`; deployment SHA `9b1547a` at last check).  
**Scope:** Read-only UI verification — no DB/schema/scanner/workflow changes.

---

## Current production UI target

Production `/dashboard` renders **Command Deck** (`CommandDeckDashboard`), not the legacy Trading OS v3 `EvidenceLayer` shell.

| Target | Selector / surface |
|--------|-------------------|
| **Use (production)** | `data-testid="command-deck-evidence"` — **Session Evidence** grid |
| **Do not expect on `/dashboard`** | `data-testid="dashboard-v3-evidence-layer"` — legacy V3 collapsed chips + expand panel |

Foreign flow evidence appears as rows inside **Session Evidence** (and mirrored as compact stats on the Command Deck bar when chips exist).

---

## Expected evidence rows

When `market_context_daily` is available for the session:

| Label | Value pattern | Notes |
|-------|---------------|-------|
| `Foreign 1D` | `{signed}B/T ₫ net` | Always when market context OK |
| `Foreign cov.` | `{ok}/{total} OK ({pct}%)` | Coverage from OK symbol rows |
| `Foreign 5D` | `{signed}B/T ₫ net` | Only after ≥5 forward OK sessions |
| `Foreign 10D` | `{signed}B/T ₫ net` | Only after ≥10 forward OK sessions |

**Do not hard-code exact VND amounts in automated checks** unless using deterministic fixtures — assert label presence and value shape (e.g. `/₫ net/`, `/OK \(\d+%\)/`).

Existing non-foreign evidence rows must remain visible:

- Scanner diagnostics  
- Data freshness  
- Market blockers  
- Technical evidence  

---

## Example production snapshot (reference only)

Observed on production after Phase 1B foreign evidence wiring:

- `Foreign 1D`: `+7.59B ₫ net`
- `Foreign cov.`: `184/229 OK (80%)`
- `Foreign 5D`: `−7.55T ₫ net`
- `Foreign 10D`: `−5.20T ₫ net`

5D/10D were null until enough forward sessions accumulated; they are now present in current production.

---

## Automated checks

| Layer | File | What it asserts |
|-------|------|-----------------|
| View-model mapping | `src/lib/dashboard/map-dashboard-v3-view-model.test.ts` | Foreign chips → V3 `evidence[]`; 5D/10D conditional |
| Command Deck mapping | `src/components/command-deck/map-dashboard-v3-to-command-deck.test.ts` | Foreign rows pass through Session Evidence + command bar stats |
| Playwright smoke | `tests/dashboard-command-deck.spec.ts` | `/dashboard` loads Command Deck; `command-deck-evidence` shows Foreign 1D/cov.; legacy V3 layer absent |

### Run targeted tests

```bash
npx vitest run src/lib/dashboard/map-dashboard-v3-view-model.test.ts src/components/command-deck/map-dashboard-v3-to-command-deck.test.ts

npx playwright test tests/dashboard-command-deck.spec.ts --project=chromium-dashboard-smoke
```

Playwright requires auth setup (`tests/playwright/auth.setup.ts`) and a running app (`PLAYWRIGHT_BASE_URL` or local `npm run dev`).

---

## Legacy V3 EvidenceLayer

`src/components/trading-os-v3/sections/evidence-layer.tsx` (`dashboard-v3-evidence-layer`) remains in the repo for diagnostics/preview paths but is **not mounted** on the current production `/dashboard` route. Verification must target Command Deck Session Evidence instead of collapsed chip / expand-panel UX.

---

## Out of scope for this runbook

- DB migrations, foreign import, `build-market-context`, or GHA workflows  
- Production data mutation  
- Gate/scanner/rankScore logic changes  

See `docs/trading/market-context-phase1a.md` for the data pipeline that feeds foreign evidence.
