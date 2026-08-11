-- AlterTable
ALTER TABLE "Note" RENAME CONSTRAINT "TripNote_pkey" TO "Note_pkey";

-- CreateTable
CREATE TABLE "PackingItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "isPacked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackingItem_tripId_idx" ON "PackingItem"("tripId");

-- CreateIndex
CREATE INDEX "PackingItem_tripId_category_idx" ON "PackingItem"("tripId", "category");

-- RenameForeignKey
ALTER TABLE "Note" RENAME CONSTRAINT "TripNote_tripId_fkey" TO "Note_tripId_fkey";

-- RenameForeignKey
ALTER TABLE "Note" RENAME CONSTRAINT "TripNote_userId_fkey" TO "Note_userId_fkey";

-- AddForeignKey
ALTER TABLE "PackingItem" ADD CONSTRAINT "PackingItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "TripNote_tripId_idx" RENAME TO "Note_tripId_idx";
