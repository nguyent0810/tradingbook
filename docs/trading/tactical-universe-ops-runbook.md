# Tactical Universe Ops Runbook

Operator-only workflow for tactical symbol intake and verification (no UI required).

This runbook assumes:

- tactical schema/read path and scanner merge read path are already deployed,
- scanner/tradability/Gate2 rules remain unchanged,
- secrets are loaded via shell env (`DATABASE_URL`, optional `CRON_SECRET`) and never committed.

## 1) Add tactical symbols (example: GEX/GEE)

```bash
npx tsx scripts/add-tactical-symbols.ts GEX GEE --source=manual --expires-days=14 --note="hot breakout watch"
```

Behavior:

- Normalizes symbols (`trim + uppercase`).
- Validates each symbol exists in `stock_symbols`.
- If missing, skips unless `--create-missing` is explicitly set.
- Upserts ACTIVE tactical row with:
  - `status=ACTIVE`
  - `activeForScanner=true`
  - `expiresAt=now + expires-days`
  - `source`, `reasonNote`

Optional:

```bash
npx tsx scripts/add-tactical-symbols.ts GEX --create-missing
```

(`--create-missing` creates `stock_symbols` row as `active=false` to avoid changing core curation semantics.)

## 2) List tactical symbols

```bash
npx tsx scripts/list-tactical-symbols.ts
npx tsx scripts/list-tactical-symbols.ts --active
npx tsx scripts/list-tactical-symbols.ts --active --json
```

Fields shown:

- `symbol`
- `status`
- `activeForScanner`
- `expiresAt`
- `importedBarsAt`
- `lastEvaluatedAt`
- `source`

## 3) Export tactical symbols for bar fetch

```bash
npx tsx scripts/export-tactical-symbols.ts --active-only --output data/tactical-symbols.json
```

Use JSON output with existing Python fetch script:

```bash
python scripts/fetch_stock_bars.py --symbols-file data/tactical-symbols.json --output data/tactical-stock-bars.json --sleep 3.5 --calendar-days 220
```

Then import:

```bash
npx tsx scripts/import-stock-bars.ts data/tactical-stock-bars.json
```

Optional line-format export (for manual inspection only):

```bash
npx tsx scripts/export-tactical-symbols.ts --active-only --lines --output data/tactical-symbols.txt
```

## 4) Trigger scan

Local/CLI scanner path:

```bash
npx tsx scripts/run-daily-scanner.ts
```

Or production cron endpoint:

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://tradingbook-phi.vercel.app/api/cron/daily-scan"
```

## 5) Verify tactical evaluation happened

Check tactical rows:

```bash
npx tsx scripts/list-tactical-symbols.ts --active --json
```

Confirm `lastEvaluatedAt` updates for included tactical symbols.

Check scan/tradability/Gate2 outcomes:

```bash
npx tsx scripts/verify-deployment-health.ts --json
npx tsx scripts/gate2-audit.ts
npx tsx scripts/scanner-near-miss.ts --json
```

For hot-symbol-specific status:

```bash
# Existing report/artifact workflows in docs/trading/hot-symbol-coverage-audit.md
```

## 6) Operational notes

- Tactical symbols do **not** bypass tradability.
- Tactical symbols do **not** bypass Gate2.
- Expired rows are retained (no hard delete) and excluded by active tactical filter.
- Keep provider fetch conservative (`--sleep` >= safe baseline, batched symbols).
- Do not expose `DATABASE_URL` / `CRON_SECRET` in logs or committed files.
