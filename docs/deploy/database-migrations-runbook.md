# Production database migrations (runbook)

## Why migrations are not in `npm run build`

Vercel (and similar CI) builds should **not** depend on live database connectivity. Network blips, Neon compute wake-up, pooler vs direct endpoint quirks, or missing secrets during a preview build can turn **`prisma migrate deploy`** into a flaky **`P1001`** during `next build`.

The app build pipeline runs:

```bash
npm run build   # prisma generate && next build
```

Apply schema changes to production **in a separate, deliberate step** after you trust the deployment artifact.

## Apply pending migrations

From a machine or job that has **`DATABASE_URL`** (and on Neon, preferably **`DIRECT_URL`** for CLI — see `prisma.config.ts`) configured for the **target** database:

```bash
npm run db:migrate:deploy
```

Equivalent:

```bash
npx prisma migrate deploy
```

Run this **before** or **right after** promoting a release that depends on new migrations — never assume the Vercel build ran migrate.

## Neon notes

- Use the **direct** connection string for CLI migrate when the pooled URL misbehaves; `prisma.config.ts` prefers **`DIRECT_URL`** when set.
- If the database was idle, add **`connect_timeout`** (e.g. `30`) to the URL if connections time out on first wake.

## Optional CI patterns

- **GitHub Actions**: workflow step on `main` with secrets `DATABASE_URL` / `DIRECT_URL`, running `npm run db:migrate:deploy` before or after deploy.
- **Manual**: run locally against production URL after merge (restricted access; audit logs).

Do **not** remove migration files from the repo; they remain the source of truth for what `migrate deploy` applies.
