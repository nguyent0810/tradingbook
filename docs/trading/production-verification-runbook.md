# Production verification runbook

Short checklist after deploying scanner/cron or DB migrations. **Read-only** diagnostics unless you explicitly run seed/import/curation against production.

## Safety

- **Never commit** production `DATABASE_URL`, `CRON_SECRET`, API keys, or copied `.env` files into git.
- Prefer **temporary** env in your shell (`export DATABASE_URL=...`) or provider dashboards—not checked-in files.
- The helper script below only **reads** the database; it does not mutate scanner rules or trades.

## Manual cron trigger

After `CRON_SECRET` is set in Vercel and the project is redeployed:

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR_DEPLOYMENT_HOST/api/cron/daily-scan"
```

Expect HTTP **200** and JSON including `ok: true` and scan counters when the job succeeds. Check Vercel **Functions** logs for the same route if the response is empty or errors.

Scheduled runs use `vercel.json` (`/api/cron/daily-scan`); auth uses the same `Bearer` header when `CRON_SECRET` is configured.

## Database snapshot (read-only)

Point `DATABASE_URL` at the database you want to inspect (local, staging, or production), then:

```bash
npx tsx scripts/verify-deployment-health.ts
npx tsx scripts/verify-deployment-health.ts --json
```

Outputs:

- Fingerprinted DB host hint (from existing `describeDatabaseUrl()` — not full credentials)
- Latest `DailyScanRun` (counts, timestamps, status)
- Count of active `StockSymbol` rows
- Total `Trade` rows (all users—use only in trusted contexts)

## UI checks

- `/setups` / dashboard scan sections should reflect the latest `DailyScanRun` after a successful cron (hard refresh if cached).
- `/trades` list count should match rendered rows for your filters.
