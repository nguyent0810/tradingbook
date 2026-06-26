import "./load-env";
import { seedPaperAgents } from "./seed-paper-agents-lib";

async function main() {
  await seedPaperAgents();
  console.log("Paper agents seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
