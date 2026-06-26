# Paper Trading Lab — Operations Runbook

## Overview

The AI Paper Trading Arena (`/paper-lab`) runs virtual agent portfolios at **500M VND** each. No real orders are placed.

## Daily workflow

1. GitHub Actions imports EOD bars (existing).
2. `/api/cron/daily-scan` runs Gate 1/2 scanner.
3. `/api/cron/paper-lab-daily` (15 min after backup scan):
   - Builds market context bundles
   - Runs mock/rule agents (LLM optional via `OPENAI_API_KEY`)
   - Validates and simulates fills
   - Mark-to-market + SL/TP detection
   - Performance, rankings, CIO recommendations

## Manual commands

```bash
npm run seed:paper-agents
npm run paper-lab:daily
```

## API ops

- `GET /api/paper-lab/ops` — last run status
- `POST /api/paper-lab/run-agents` — manual daily job (authenticated)
- `POST /api/paper-lab/reset-simulation` — reset all portfolios (admin)

## Environment

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Bearer auth for cron routes on Vercel |
| `PAPER_LAB_LLM_ENABLED` | Default off — set `true` only to enable optional LLM |
| `OPENAI_API_KEY` | Optional LLM (requires `PAPER_LAB_LLM_ENABLED=true`) |
| `ZENMUX_API_KEY` | Optional ZenMux LLM provider |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |

See **[PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md)** for full deploy checklist, cron order, and zero-LLM mode.

## Migration

```bash
npx prisma migrate deploy
npm run seed:paper-agents
```

## Routes

- Arena UI: `/paper-lab`
- Personal journal: `/trades/journal` (legacy `/trades` redirects)
