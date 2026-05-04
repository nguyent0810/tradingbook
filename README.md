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

## 🏗️ Vercel Deployment Instructions

Deploying this app is completely automated toward Vercel logic.

1. Create a new project in Vercel and link your GitHub repository.
2. In the Vercel Environment Variables UI, add exactly two variables:
   - `DATABASE_URL` (Pointing to your production/Neon Postgres DB)
   - `SESSION_SECRET` (Secure random string)
3. **Build Command Verification:** Our `package.json` relies on `"build": "prisma migrate deploy && next build"`. This strictly ensures that Prisma pushes physical database migrations safely *before* Next.js static generation binds to the Prisma Client. You do not need a custom build command.
4. Deploy!

### Database Caveats / Notes
- **Custom Prisma Output:** The Prisma generator creates its client inside `src/generated/prisma`. If you run into a `PrismaClientValidationError` in the local development environment, it is highly likely that Next.js aggressively cached the stale Prisma client in its `.next` folder. Stop the server, run `npx prisma generate` and `rm -rf .next`, then restart `npm run dev`.
- **Formatting Constraints:** Vietnam Market P&L involves incredibly large integers (millions/billions). We strictly map rendering outputs using `formatVND(value, compact: boolean)` to preserve layout flexbox boundaries.

## 🚦 Known Phase 1 Limitations
- **Partial Exits:** Currently, tracking multiple exits from the same position (scaling out) requires separate individual trade entries. Advanced fractional trade batching will be addressed in a future phase.
- **R-Multiples**: Risk-adjusted returns algorithms (R-multiples) are scheduled for Phase 3 logic.
