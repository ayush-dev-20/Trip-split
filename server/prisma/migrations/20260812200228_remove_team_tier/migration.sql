-- Remove the TEAM subscription tier, leaving FREE and PRO.
--
-- Existing TEAM subscribers move to PRO rather than FREE: they were on the
-- highest tier, and PRO is now the highest, so this preserves their access.
UPDATE "Subscription" SET "tier" = 'PRO' WHERE "tier" = 'TEAM';

-- PostgreSQL has no "ALTER TYPE ... DROP VALUE", so the enum is recreated
-- without TEAM and the column re-pointed at it. The default has to be dropped
-- first, otherwise the column can't change type.
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO');

ALTER TABLE "Subscription" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "tier" TYPE "SubscriptionTier" USING ("tier"::text::"SubscriptionTier");
ALTER TABLE "Subscription" ALTER COLUMN "tier" SET DEFAULT 'FREE';

DROP TYPE "SubscriptionTier_old";
