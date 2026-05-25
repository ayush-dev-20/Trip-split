-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "tripId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Expense_paidById_tripId_idx" ON "Expense"("paidById", "tripId");
