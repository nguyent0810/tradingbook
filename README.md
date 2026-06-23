# TradeLog (Vietnam Market Edition)

A high-performance trading journal designed explicitly for the Vietnam stock market, built with Next.js 14, TailwindCSS, and Prisma.

## Phase 1 Overview
This project is currently functionally complete up to Phase 1, which includes:
- Secure authentication system (JWT via jose implementation).
- Complete Trade Form logging with symbol, entries, exits, limits, and dynamic strategy tracking.
- Real-time performance dashboard featuring Equity Curves, Profit Factor, Expectancy, and Strategy breakdowns.
- Localized Vietnam Market formatting (`₫`) for maximum visual clarity across high-integer financial data.

## 🚀 Environment Variable Requirements
Before starting, create a `.env` file in the root based on `.env.example` (or use the following):

```env
# Database Configuration
# Local environment uses local PostgreSQL
DATABASE_URL="postgresql://postgres:secret@localhost:5432/trading?schema=public"

# Vercel / Production environment uses Neon or similar hosted DB
# DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"

# JWT Authentication Secret (Must be 32+ characters)
SESSION_SECRET="your-ultra-secure-32-character-jwt-secret-key"
```

## 💻 Local Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Initialize Database**
   Ensure your local PostgreSQL service is running, then run:
   ```bash
   npx prisma migrate dev
   ```
   *Note: This strictly executes Prisma's versioned workflow against your local DB and safely synchronizes the schema locally.*

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to begin.

## VNINDEX daily import (GitHub Actions)

Production VNINDEX bars are loaded **outside Vercel**: a workflow runs **Python (vnstock)** on GitHub-hosted runners, then **`import-bars.ts`** writes to Postgres using **`DATABASE_URL`**.

### Manual trigger

1. Open the repo on GitHub → **Actions**.
2. Select **VNINDEX daily import**.
3. Click **Run workflow** → choose branch (usually `main`) → **Run workflow**.

Logs appear under the run’s steps; the import step prints a **`=== import-bars summary ===`** block (imported count, skipped breakdown, date range, latest close).

### Scheduled runs

The workflow uses a **UTC cron** (weekdays). To change the schedule, edit **`.github/workflows/vnindex-daily-import.yml`** → `on.schedule.cron`. GitHub only supports UTC; adjust if Vietnam market close + data lag require a different time.

### Required secret

| Secret           | Description                                      |
|------------------|--------------------------------------------------|
| **`DATABASE_URL`** | Production Postgres URL (e.g. Neon), same as Vercel DB. **Do not** echo it in workflow logs. |

Add it under **Settings → Secrets and variables → Actions**. The workflow never prints `DATABASE_URL`.

### Notes

- Fetch output is written only to the runner temp directory — **not** `data/vnindex.json` in the repo (that path stays gitignored for local runs).
- To run the same steps locally: `python scripts/fetch_vnindex.py` then `npx tsx scripts/import-bars.ts` (see `scripts/`).

## Tradability filter (scanner) & expected session

The **tradability** layer (`src/lib/scanner/`) compares each stock’s latest daily bar to an **expected last EOD session** date. **Do not** use the server’s current calendar date (`new Date()`): Vietnam **holidays**, **weekends**, and **import lag** would incorrectly mark data as stale.

- Use **`getExpectedLatestSessionFromIndexBars(prisma)`** so the expected date comes from the **latest `IndexDailyBar` for `VNINDEX`**, i.e. the same session your daily index import just wrote.
- After **`import-bars`** (or equivalent) has run, that index date is the single source of truth for “last market close in the database.”

Run unit tests: `npm test` (Vitest).

## Local UI verification (`/setups`)

Do **not** mark `/setups` manual QA as **pass** until all of the following are done (after optional demo seed: `npx tsx scripts/seed-demo-setup-candidate.ts`):

1. **Diagnostics:** Click **each** diagnostics bucket row and confirm it **expands** (native disclosure). Expanded content must show **What it means**, **Wait for**, **Symbols in this bucket**, and **Show more / Show fewer** when the symbol list exceeds the initial cap.
2. **Surfaced candidates table:** Confirm the **first candidate data row** (symbol, quality, numeric columns) is **fully readable** with **no overlap** from the table header. If anything looks clipped or hidden under the header, treat as **fail**.
3. **Position sizing:** Scroll as needed and confirm the sizing block **below** the candidate remains visible and usable.
4. **Evidence:** Keep **at least one screenshot** with a diagnostics row **expanded**, and **one screenshot** of the surfaced candidates table showing the candidate row clearly.

## 🏗️ Vercel Deployment Instructions

Deploying this app is completely automated toward Vercel logic.

1. Create a new project in Vercel and link your GitHub repository.
2. In the Vercel Environment Variables UI, add these variables:
   - `DATABASE_URL` (Pointing to your production/Neon Postgres DB)
   - `SESSION_SECRET` (Secure random string)
   - `EARLY_ENTRY_V1_ENABLED` = `true` (optional — enables **research-only** Early Entry metadata on the RS radar; does not affect Gate 2 or trade decisions)
3. **Build Command Verification:** Our `package.json` relies on `"build": "prisma migrate deploy && next build"`. This strictly ensures that Prisma pushes physical database migrations safely *before* Next.js static generation binds to the Prisma Client. You do not need a custom build command.
4. Deploy!

### Database Caveats / Notes
- **Custom Prisma Output:** The Prisma generator creates its client inside `src/generated/prisma`. If you run into a `PrismaClientValidationError` in the local development environment, it is highly likely that Next.js aggressively cached the stale Prisma client in its `.next` folder. Stop the server, run `npx prisma generate` and `rm -rf .next`, then restart `npm run dev`.
- **Formatting Constraints:** Vietnam Market P&L involves incredibly large integers (millions/billions). We strictly map rendering outputs using `formatVND(value, compact: boolean)` to preserve layout flexbox boundaries.

## 🚦 Known Phase 1 Limitations
- **Partial Exits:** Currently, tracking multiple exits from the same position (scaling out) requires separate individual trade entries. Advanced fractional trade batching will be addressed in a future phase.
- **R-Multiples**: Risk-adjusted returns algorithms (R-multiples) are scheduled for Phase 3 logic.
