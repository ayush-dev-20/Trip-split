-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "items" JSONB;

-- AlterTable
ALTER TABLE "ExpenseSplit" ADD COLUMN     "owedAmount" DOUBLE PRECISION;
