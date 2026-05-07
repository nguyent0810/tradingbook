/**
 * Seeds a dedicated Playwright user and exactly two trades for `/trades` layout tests.
 *
 * Requires DATABASE_URL (see scripts/load-env.ts).
 *
 *   npx tsx scripts/playwright-seed-trades-layout.ts
 */
import "./load-env";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const EMAIL =
  process.env.PLAYWRIGHT_TRADES_LAYOUT_EMAIL?.trim().toLowerCase() ||
  "e2e-trades-layout@example.test";
const PASSWORD =
  process.env.PLAYWRIGHT_TRADES_LAYOUT_PASSWORD || "PlaywrightTradesLayout!99";

async function main(): Promise<void> {
  const hashed = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      password: hashed,
      name: "Playwright trades layout",
    },
    update: { password: hashed },
  });

  await prisma.trade.deleteMany({ where: { userId: user.id } });

  await prisma.trade.createMany({
    data: [
      {
        userId: user.id,
        symbol: "E2EOPEN",
        direction: "LONG",
        status: "OPEN",
        playbook: "BREAKOUT_PULLBACK",
        entryDate: new Date("2024-06-01T12:00:00.000Z"),
        entryPrice: 25_000,
        quantity: 100,
        stopLoss: 24_000,
        takeProfit: 27_000,
      },
      {
        userId: user.id,
        symbol: "E2ECLS",
        direction: "SHORT",
        status: "CLOSED",
        playbook: "BREAKOUT_PULLBACK",
        entryDate: new Date("2024-05-01T12:00:00.000Z"),
        exitDate: new Date("2024-05-15T12:00:00.000Z"),
        entryPrice: 30_000,
        exitPrice: 28_500,
        quantity: 50,
        realizedPnl: 75_000,
      },
    ],
  });

  console.log(
    `[playwright-seed-trades-layout] ready user=${EMAIL} trades=2`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
