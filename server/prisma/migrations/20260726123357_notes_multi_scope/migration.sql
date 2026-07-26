-- Rename the table (preserves all existing rows)
ALTER TABLE "TripNote" RENAME TO "Note";

-- Add the new nullable groupId column
ALTER TABLE "Note" ADD COLUMN "groupId" TEXT;

-- tripId is no longer required (personal notes have neither)
ALTER TABLE "Note" ALTER COLUMN "tripId" DROP NOT NULL;

-- New index to support personal-note queries (WHERE tripId IS NULL AND groupId IS NULL AND userId = ?)
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- New index + FK for groupId
CREATE INDEX "Note_groupId_idx" ON "Note"("groupId");
ALTER TABLE "Note" ADD CONSTRAINT "Note_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
