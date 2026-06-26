import { prisma } from "@/lib/prisma";
import { runLabAnalyticsDailyJob } from "@/lib/lab/jobs/run-lab-analytics-daily";

async function main() {
  const result = await runLabAnalyticsDailyJob(prisma);
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  process.exit(result.ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
