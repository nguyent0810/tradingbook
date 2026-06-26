# AI Investment Lab — Production Runbook (Phase 2)

Paper-only virtual research platform. **No real broker execution.** Default mode uses **rule/mock agents only** — LLM is optional.

---

## Deploy commands

```bash
# 1. Apply migrations (Production / Preview)
npx prisma migrate deploy

# 2. Seed paper agents (first run only, idempotent)
npm run seed:paper-agents

# 3. Verify build (no LLM keys required)
PAPER_LAB_LLM_ENABLED=false npm run build

# 4. Post-deploy smoke (manual, with CRON_SECRET)
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "$DEPLOYMENT_URL/api/cron/paper-lab-daily"

curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "$DEPLOYMENT_URL/api/cron/lab-analytics-daily"
```

Local first-run:

```bash
npx prisma migrate deploy   # or: npx prisma db push
npm run seed:paper-agents
npm run paper-lab:daily
npm run lab-analytics:daily
npm run paper-lab:validate
```

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection |
| `CRON_SECRET` | **Yes on Vercel** | — | Bearer auth for `/api/cron/*` |
| `PAPER_LAB_LLM_ENABLED` | No | `false` (implicit) | Must be `true` to allow LLM calls |
| `OPENAI_API_KEY` | No | — | OpenAI provider (only if LLM enabled) |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model id when using OpenAI |
| `ZENMUX_API_KEY` | No | — | Optional ZenMux provider (only if LLM enabled) |
| `PAPER_LAB_ALLOW_RESET` | No | unset | Set `true` to allow reset in production |
| `PAPER_LAB_RESET_TOKEN` | No | — | Value for `x-paper-lab-confirm-reset` header |

**Zero-LLM production (recommended):**

```env
PAPER_LAB_LLM_ENABLED=false
# Do NOT set OPENAI_API_KEY or ZENMUX_API_KEY
CRON_SECRET=<long-random-string>
DATABASE_URL=<postgres-url>
```

**Optional LLM later:**

```env
PAPER_LAB_LLM_ENABLED=true
OPENAI_API_KEY=sk-...
# or ZENMUX_API_KEY=...
```

---

## Cron order (Vercel)

Configured in `vercel.json`:

| Schedule (UTC, Mon–Fri) | Route | Purpose |
|-------------------------|-------|---------|
| `0 14 * * 1-5` | `/api/cron/daily-scan` | Gate 1/2 scanner |
| `15 14 * * 1-5` | `/api/cron/paper-lab-daily` | Regime → rule agents → engine → NAV/rankings |
| `45 14 * * 1-5` | `/api/cron/lab-analytics-daily` | Battles, calibration, DNA, CIO v2, replay bundles |

**Dependency:** `lab-analytics-daily` expects `paper-lab-daily` to have created decisions for the session. Both use the latest **VNINDEX** bar date as `sessionDate`.

Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when `CRON_SECRET` is set.

---

## First-run checklist

- [ ] `DATABASE_URL` set in Vercel Production
- [ ] `CRON_SECRET` set in Vercel Production (redeploy after adding)
- [ ] `npx prisma migrate deploy` succeeded in build or release step
- [ ] `npm run seed:paper-agents` executed once against production DB
- [ ] VNINDEX + stock daily bars imported (existing bar import workflow)
- [ ] `/api/cron/daily-scan` has run at least once
- [ ] Manual trigger: `paper-lab-daily` then `lab-analytics-daily`
- [ ] `/paper-lab` shows **Rule Agents Active · LLM Disabled**
- [ ] `npm run paper-lab:validate` passes (or check ops page)

---

## Zero-LLM mode

- Daily jobs use **mock/rule agents** from `src/lib/paper-lab/agents/mock-rule-agents.ts`
- `PAPER_LAB_LLM_ENABLED` must **not** be `true` (default)
- No `fetch()` to OpenAI/ZenMux when disabled
- UI banner: **Rule Agents Active · LLM Disabled**
- Analytics job (CIO v2, calibration, DNA) is **deterministic** — no LLM

To enable LLM later: set `PAPER_LAB_LLM_ENABLED=true` + provider key, redeploy, wire agents through `createLlmStructuredAgent` in experiment router.

---

## Idempotency & safety

| Guard | Behavior |
|-------|----------|
| Agent decisions | Skipped if agent already has decisions for session |
| Order execution | Skipped if decision already has linked order |
| Rankings / performance | Upsert per `(agentId, sessionDate)` |
| Arena battles | Upsert per `(sessionDate, symbol)` |
| Analytics job | Skips if `lab-analytics-daily` already logged for session (use `force` in script to override) |
| Reset | Blocked in production unless `PAPER_LAB_ALLOW_RESET=true` or confirm header |
| Stale data | Warns if VNINDEX >3d old; fails on Vercel if >7d old |
| Empty agents | Jobs fail fast with clear error if not seeded |

---

## Rollback plan

1. **Disable crons:** Remove or comment paper-lab / lab-analytics entries in `vercel.json`, redeploy.
2. **Schema rollback:** Do not revert migrations in production without DBA review. Phase 2 tables are additive.
3. **UI rollback:** Redeploy previous Vercel deployment from dashboard.
4. **Data reset (non-prod only):** `POST /api/paper-lab/reset-simulation` (blocked in prod by default).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Cron 500 "CRON_SECRET not configured" | Missing secret on Vercel | Add `CRON_SECRET`, redeploy |
| "No VNINDEX session" | No index bars | Run bar import + daily-scan |
| "No paper agents seeded" | Missing seed | `npm run seed:paper-agents` |
| Arena shows mock data | DB empty or tables missing | Migrate + seed + run daily jobs |
| Analytics skipped | Already ran for session | Expected; use force in dev script |
| Stale data error on Vercel | Bars not imported >7d | Fix bar import pipeline |
| Reset 403 in production | Safety guard | Use `PAPER_LAB_ALLOW_RESET` only if intentional |

**Ops endpoints:**

- `GET /api/paper-lab/ops` — Phase 1 ops summary
- `GET /api/lab/telemetry/summary` — Phase 2 telemetry
- `GET /paper-lab/ops` — Ops dashboard UI

---

## Vercel deployment steps

1. Merge Phase 2 branch to `main`.
2. Vercel → Project → Settings → Environment Variables:
   - `DATABASE_URL`
   - `CRON_SECRET`
   - `PAPER_LAB_LLM_ENABLED=false` (explicit recommended)
3. Deploy (build runs `prisma generate && next build`).
4. Run once against production DB (from CI or local with prod `DATABASE_URL`):
   ```bash
   npx prisma migrate deploy
   npm run seed:paper-agents
   ```
5. Trigger crons manually (see Deploy commands) or wait for schedule.
6. Verify `/paper-lab`, `/paper-lab/battles`, `/paper-lab/ops`.
7. Confirm banner: **Rule Agents Active · LLM Disabled**.

---

## Related docs

- Phase 1 ops: [`RUNBOOK.md`](./RUNBOOK.md)
- Bar import / scan: `docs/trading/vercel-cron-daily-scan.md`
