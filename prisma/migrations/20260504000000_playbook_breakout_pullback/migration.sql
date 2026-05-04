-- CreateEnum
CREATE TYPE "Playbook" AS ENUM ('BREAKOUT_PULLBACK');

-- AlterTable
ALTER TABLE "trades" ADD COLUMN "playbook" "Playbook" NOT NULL DEFAULT 'BREAKOUT_PULLBACK';

-- AlterTable
ALTER TABLE "trades" DROP COLUMN "strategy";
