import "./load-env";
import { prisma } from "../src/lib/prisma";
import { runShadowAllocationReviewJob, type Cadence } from "../src/lib/paper-lab/dna/allocation-review-job";

async function main() {
  const cadence: Cadence = process.argv.includes("--quarterly") ? "quarterly" : "monthly";
  const force = process.argv.includes("--force");
  const result = await runShadowAllocationReviewJob(prisma, { cadence, force });
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(JSON.stringify(result.summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
