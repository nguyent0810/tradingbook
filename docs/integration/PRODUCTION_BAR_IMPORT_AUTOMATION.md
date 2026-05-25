# Production Bar Import Automation

**Status:** Implemented (GitHub Actions primary path)  
**Related:** [PRODUCTION_BAR_FRESHNESS_RECOVERY.md](./PRODUCTION_BAR_FRESHNESS_RECOVERY.md), [bar-freshness-diagnostic.md](../trading/bar-freshness-diagnostic.md)

---

## Why GitHub Actions (not Vercel cron for import)

| Constraint | Implication |
|------------|-------------|
| Equity fetch ~**189 symbols × 3.2s** ≈ **10–20+ min** | Exceeds Vercel **300s** `maxDuration` |
| Requires **Python / vnstock** | Not available on the Next.js serverless runtime |
| Idempotent **upserts** | Safe to re-run the workflow |

**Vercel cron** keeps **`/api/cron/daily-scan`** only (scanner on existing DB bars). Import runs on GHA; scan is triggered **after** a successful import.

---

## Schedule

| Trigger | When (UTC) | What |
|---------|------------|------|
| **GitHub Actions** `production-bar-import.yml` | **Mon–Fri 12:30** (`30 12 * * 1-5`) | VNINDEX + equities → Neon → **daily scan** |
| **Vercel cron** `vercel.json` | **Mon–Fri 14:00** (`0 14 * * 1-5`) | **Backup** scan if GHA failed or was disabled |

VN cash session alignment: import runs after the prior session close; backup scan is ~1.5h later.

---

## Pipeline (GHA job)

1. Validate secrets: `DATABASE_URL`, `CRON_SECRET`, `DEPLOYMENT_URL`
2. `BAR_IMPORT_REQUIRE_PRODUCTION_DB=1` → host must match `neon.tech` (override: `PROD_DB_HOST_ALLOWLIST`)
3. Pre snapshot → `verify-bar-import-health.ts --json`
4. `fetch_vnindex.py` → `import-bars.ts` (upsert `index_daily_bars`)
5. `export-active-symbol-keys.ts` — **excludes smoke symbols** (`P0DEXIT`, etc.)
6. `print-expected-session-day.ts` → `--end-date` for equity fetch
7. `fetch_stock_bars.py` → `import-stock-bars.ts` (upsert `stock_daily_bars`)
8. Post snapshot + artifact upload
9. **`curl $DEPLOYMENT_URL/api/cron/daily-scan`** with `Authorization: Bearer $CRON_SECRET` (skipped if import steps fail or `skip_equity` + manual `trigger_scan: false`)

**Scan is not embedded in import code** — it stays the existing HTTP cron route so auth, logging, and scanner semantics stay one place.

---

## GitHub secrets (repository settings)

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Neon production Postgres (same as Vercel) |
| `CRON_SECRET` | Bearer token for `/api/cron/daily-scan` |
| `DEPLOYMENT_URL` | e.g. `https://tradingbook-phi.vercel.app` (no trailing path) |

**Never commit** secrets or `.env.prod.local`.

---

## Guardrails

| Guard | Implementation |
|-------|----------------|
| Production DB | `scripts/assert-production-database.ts` + `validateProductionDatabaseUrl()` |
| No smoke symbols in fetch list | `export-active-symbol-keys.ts` + `production-smoke-markers.ts` |
| Idempotent writes | Existing upsert in `import-bars.ts` / `import-stock-bars.ts` |
| Bounded runtime | GHA `timeout-minutes: 45`; vnstock `--sleep 3.2` |
| Failure logging | Step logs + `pre-import-health.json` / `post-import-health.json` artifacts |
| Exit codes | Non-zero on assert/import/curl failure; **no scan** if import fails |
| Ephemeral JSON | Runner temp only — not committed under `data/` |

---

## Monitoring evidence

After each run, artifacts include JSON with:

| Field | Source |
|-------|--------|
| `latestVnindexBarDay` | `index_daily_bars` |
| `latestEquityBarDay` | `stock_daily_bars` max |
| `expectedLatestSessionDay` | VNINDEX session helper |
| `activeSymbolsCount` | `StockSymbol.active` |
| `latestNonSmokeScan.id` | Latest non-smoke `DailyScanRun` |
| `delayedBackdrop` | Scan notes `benchmarkBackdrop` |
| `candidateCountSurfaced` | Latest scan row |

**CLI (any env):**

```bash
npx tsx scripts/verify-bar-import-health.ts --json
```

---

## Manual recovery (same as May 2026 recovery)

Load production `DATABASE_URL` into the shell (see [production-data-alignment-runbook.md](../trading/production-data-alignment-runbook.md)), then:

```bash
export BAR_IMPORT_REQUIRE_PRODUCTION_DB=1   # optional local guard

python scripts/fetch_vnindex.py
npx tsx scripts/import-bars.ts

npx tsx scripts/export-active-symbol-keys.ts
END=$(npx tsx scripts/print-expected-session-day.ts)
python scripts/fetch_stock_bars.py --symbols-file data/active-symbol-keys.json --sleep 3.2 --end-date "$END" --calendar-days 200
npx tsx scripts/import-stock-bars.ts

npx tsx scripts/verify-bar-import-health.ts --json

curl -sS -H "Authorization: Bearer $CRON_SECRET" "$DEPLOYMENT_URL/api/cron/daily-scan"
```

Or run the workflow manually: **Actions → Production bar import → Run workflow**.

---

## Rollback / disable

| Action | Effect |
|--------|--------|
| Disable workflow in GitHub **Actions** tab | Stops scheduled import + scan trigger |
| Remove `DATABASE_URL` secret | Workflow fails fast at validate step |
| Re-enable old behavior | Re-add `.github/workflows/vnindex-daily-import.yml` from git history (VNINDEX-only) |
| Vercel backup scan only | Disable GHA; keep `vercel.json` cron (bars will drift without import) |

Bar data already imported is **not** rolled back by disabling automation.

---

## Finalization (2026-05-25)

| Step | Status |
|------|--------|
| Push `173456b` + fix `1aa632a` to `main` | Done |
| GitHub secrets `DATABASE_URL`, `CRON_SECRET`, `DEPLOYMENT_URL` | Configured on `nguyent0810/tradingbook` |
| First successful manual run | [**Run #26386350438**](https://github.com/nguyent0810/tradingbook/actions/runs/26386350438) · **~21 min** · `success` |
| Local health | `npm run ops:verify-bar-import` — exit **0** (no `Select-Object` pipe) |

**Workflow fix (`1aa632a`):** `runner.temp` cannot be used in job-level `env`; ephemeral paths are set in step **Set ephemeral JSON paths** via `GITHUB_ENV`.

**Failed run (config):** [Run #26386321472](https://github.com/nguyent0810/tradingbook/actions/runs/26386321472) — missing `DATABASE_URL` / `CRON_SECRET` before secrets were added.

### Validated evidence (run #26386350438)

| Metric | Value |
|--------|-------|
| Workflow URL | https://github.com/nguyent0810/tradingbook/actions/runs/26386350438 |
| VNINDEX latest day | `2026-05-25` (close **1886.27** after re-fetch) |
| Equity max day | `2026-05-25` |
| Active symbols exported | **189** (smoke tickers excluded) |
| Scan triggered | **yes** — `scanRunId` **`cmpku2jyq000004l42cv873wq`** |
| `delayedBackdrop` | **false** |
| `benchmarkBackdrop` | `vnindexSessionDate` / `equityBarsMaxDate` = **2026-05-25** |
| Surfaced candidates | **0** (tradability/gate2 — not import failure) |
| Tradability passed | **37 / 189** |
| Artifacts | `bar-import-health-26386350438`, `scan-response-26386350438` |

**Note:** Do not pipe `ops:verify-bar-import` through `Select-Object -First N` on Windows — it can truncate stdout and return exit code `4294967295` while the script succeeded.

---

## Verification checklist

1. GHA run **green** with artifacts `bar-import-health-*` and `scan-response-*`
2. `post-import-health.json`: `latestVnindexBarDay` / `latestEquityBarDay` near current session
3. `delayedBackdrop: false` on latest non-smoke scan (after scan step)
4. `GET /api/db-health` → `{"ok":true}`
5. Dashboard alignment banner: no stale May 5–6 message (may still show mild scan-vs-EOD day mismatch)

---

## Local / read-only checks

```bash
npm run lint
npm test
npm run build

# Against DB pointed to by .env (read-only):
npm run ops:verify-bar-import
```

---

## npm scripts

| Script | Command |
|--------|---------|
| `ops:assert-prod-db` | Production host guard |
| `ops:export-active-symbols` | Write `data/active-symbol-keys.json` |
| `ops:expected-session-day` | Print `YYYY-MM-DD` for `--end-date` |
| `ops:verify-bar-import` | Monitoring JSON |

---

## Follow-up (not in this slice)

- Alerting on GHA failure (Slack/email)
- Auto-fail workflow if `latestSessionCoveragePct` &lt; threshold
- Wire freshness DTO into Dashboard FE rebuild
