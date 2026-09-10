-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "razorpaySubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");
