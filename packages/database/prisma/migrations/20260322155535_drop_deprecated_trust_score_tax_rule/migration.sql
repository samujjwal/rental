/*
  Warnings:

  - You are about to drop the `tax_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trust_scores` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "trust_scores" DROP CONSTRAINT "trust_scores_userId_fkey";

-- DropTable
DROP TABLE "tax_rules";

-- DropTable
DROP TABLE "trust_scores";
