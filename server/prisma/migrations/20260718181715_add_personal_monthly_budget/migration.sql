-- AlterTable
ALTER TABLE "User" ADD COLUMN     "monthlyBudget" DOUBLE PRECISION,
ADD COLUMN     "monthlyBudgetCurrency" TEXT NOT NULL DEFAULT 'INR';
