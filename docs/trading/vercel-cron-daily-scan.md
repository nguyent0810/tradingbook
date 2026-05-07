# Vercel cron — daily scan (`/api/cron/daily-scan`)

## Authentication

1. In the Vercel project, add **`CRON_SECRET`** (Production environment recommended). Use a long random string.
2. Redeploy so serverless functions receive the variable.
3. Vercel Cron automatically sends **`Authorization: Bearer <CRON_SECRET>`** when invoking the scheduled route (see [Vercel Cron — securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)).
4. Manual trigger (same header):

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-prod-domain>/api/cron/daily-scan"
```

If **`CRON_SECRET`** is missing on Vercel while **`VERCEL=1`**, the route returns **500** with a configuration error — scheduled cron cannot authenticate until the secret exists.

## Stale UI vs prod DB

If the dashboard shows an **old `DailyScanRun`** date but cron logs show **200**:

- Confirm **`DATABASE_URL`** on Vercel points at the **intended** production database (not an empty or legacy instance).
- Run **`scripts/verify-deployment-health.ts`** against that URL:

```bash
# Temporarily point at prod (never commit .env with prod secrets)
set DATABASE_URL=postgresql://...
npx tsx scripts/verify-deployment-health.ts --json
```

Interpret:

- **`activeSymbolsCount` ~39** while staging has ~208 → production **`stock_symbols.active`** universe was never curated/expanded on that DB; fix data/workflows, not scanner rules.
- **`symbolCountTotal`** / **`symbolCountScanned`** matching the active universe → cron + DB alignment OK; compare **`runAt`** to UI “latest scan” source.

## Logs

Successful runs log **`[cron daily-scan] completed`** with **`scanRunId`**, symbol counters, **`databaseUrlHint`** (host/db name only), and elapsed time.

Auth failures log **`[cron daily-scan] auth_failed`** with a **`reason`** code (**never** logs tokens).
