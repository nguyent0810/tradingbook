-- AlterTable
ALTER TABLE "index_daily_bars" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'vnstock:VCI';

-- AlterTable
ALTER TABLE "index_daily_bars" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "index_daily_bars" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "index_daily_bars" ALTER COLUMN "updatedAt" SET NOT NULL;
