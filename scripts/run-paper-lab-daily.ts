import "./load-env";
import { prisma } from "../src/lib/prisma";
import { runPaperLabDailyJob } from "../src/lib/paper-lab/jobs/run-paper-lab-daily-job";

async function main() {
  const result = await runPaperLabDailyJob(prisma);
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(JSON.stringify(result.summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
