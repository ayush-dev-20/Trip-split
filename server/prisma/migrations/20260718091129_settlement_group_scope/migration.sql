-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "tripId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Settlement_groupId_idx" ON "Settlement"("groupId");

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
