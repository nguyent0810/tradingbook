/**
 * Check production Paper Lab for odd-lot quantities (not divisible by 100).
 * Usage: load .env.prod.local then `npx tsx scripts/check-odd-lots-prod.ts`
 */
import "./load-env";
import { prisma } from "@/lib/prisma";

async function main() {
  const positions = await prisma.paperPosition.findMany({
    where: { quantity: { gt: 0 } },
    select: { id: true, symbol: true, quantity: true, status: true },
  });
  const orders = await prisma.paperOrder.findMany({
    select: { id: true, quantity: true, status: true, symbol: true },
  });
  const trades = await prisma.paperTrade.findMany({
    select: { id: true, quantity: true },
  });

  const oddPositions = positions.filter((p) => p.quantity % 100 !== 0);
  const oddOrders = orders.filter((o) => o.quantity % 100 !== 0);
  const oddTrades = trades.filter((t) => t.quantity % 100 !== 0);

  console.log(
    JSON.stringify(
      {
        oddPositions,
        oddOrders,
        oddTrades,
        totals: {
          positions: positions.length,
          orders: orders.length,
          trades: trades.length,
        },
        hasOddLots:
          oddPositions.length > 0 || oddOrders.length > 0 || oddTrades.length > 0,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
