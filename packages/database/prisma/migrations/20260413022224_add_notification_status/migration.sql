/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `notifications` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "blockedSeasons" TEXT[],
ADD COLUMN     "checkinCutoffTime" TEXT NOT NULL DEFAULT '12:00',
ADD COLUMN     "maxAdvanceDays" INTEGER NOT NULL DEFAULT 365,
ADD COLUMN     "minAdvanceDays" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_idempotencyKey_key" ON "notifications"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notifications_idempotencyKey_idx" ON "notifications"("idempotencyKey");
