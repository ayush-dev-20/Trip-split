-- Add Clerk and phone fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clerkId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
CREATE INDEX IF NOT EXISTS "User_clerkId_idx" ON "User"("clerkId");
