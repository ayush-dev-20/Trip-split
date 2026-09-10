import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { billingService } from '@/services/billingService';
import { loadRazorpayScript } from '@/lib/razorpay';
import { useAuthStore } from '@/stores/authStore';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import { Check, Minus, ArrowDown, Loader2, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

// Feature list/copy mirrors LandingPricing exactly, so the plan someone
// picks on the marketing page reads identically here. Tier-gating logic
// itself lives in server/src/config/plans.ts — this is presentation only.
const plans = [
  {
    tier: 'FREE' as const,
    name: 'Free',
    price: '₹0',
    period: 'forever',
    tagline: 'Everything you need to stop arguing about money.',
    highlighted: false,
    features: [
      ['2 active trips', true],
      ['5 members per trip', true],
      ['All 4 split types', true],
      ['Debt simplification & UPI settling', true],
      ['AI receipt scanning & natural language', true],
      ['AI trip planner, packing lists & chat', true],
      ['Spending insights & anomaly alerts', true],
      ['Receipt line-item itemisation', false],
      ['Multi-currency conversion', false],
      ['Advanced analytics & all charts', false],
      ['CSV / PDF export', false],
    ],
  },
  {
    tier: 'PRO' as const,
    name: 'Pro',
    price: '₹69',
    period: '/month',
    tagline: 'For people whose group chat never stops planning.',
    highlighted: true,
    features: [
      ['Unlimited active trips', true],
      ['Unlimited members per trip', true],
      ['All 4 split types', true],
      ['Debt simplification & UPI settling', true],
      ['AI receipt scanning & natural language', true],
      ['AI trip planner, packing lists & chat', true],
      ['Spending insights & anomaly alerts', true],
      ['Receipt line-item itemisation', true],
      ['Multi-currency conversion', true],
      ['Advanced analytics & all charts', true],
      ['CSV / PDF export, Year in Review & priority support', true],
    ],
  },
] as const;

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const currentTier = user?.tier ?? 'FREE';
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();

  const [upgradingTier, setUpgradingTier] = useState<'PRO' | null>(null);
  const [showDowngrade, setShowDowngrade] = useState(false);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: billingService.getSubscription,
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: billingService.verifyPayment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      if (user) setUser({ ...user, tier: data.tier });
      toast.success(`Upgraded to ${data.tier}!`);
      setUpgradingTier(null);
    },
    onError: () => {
      toast.error('Payment verification failed. If you were charged, please contact support.');
      setUpgradingTier(null);
    },
  });

  /**
   * Full Razorpay Standard Checkout flow for a RECURRING subscription: create
   * a server-authoritative subscription (the Plan/price is never taken from
   * the client), open the modal against that subscription_id, then verify
   * the first payment's signature server-side before the tier is upgraded.
   * Later renewals happen automatically on Razorpay's schedule and reach us
   * via the /webhooks/razorpay handler, not through this flow again.
   */
  const handleUpgrade = async (tier: 'PRO') => {
    setUpgradingTier(tier);
    try {
      await loadRazorpayScript();
      const order = await billingService.createSubscription(tier);

      if (!window.Razorpay) {
        throw new Error('Razorpay checkout failed to load');
      }

      const razorpay = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID as string,
        name: 'TripSplit',
        description: `TripSplit ${tier} — Monthly`,
        subscription_id: order.subscriptionId,
        prefill: { name: user?.name, email: user?.email },
        handler: (response) => {
          verifyPaymentMutation.mutate({
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        modal: {
          // Fires when the user closes the modal without paying — not an error.
          ondismiss: () => setUpgradingTier(null),
        },
      });

      razorpay.on('payment.failed', (response) => {
        toast.error(response.error?.description || 'Payment failed. Please try again.');
        setUpgradingTier(null);
      });

      razorpay.open();
    } catch {
      toast.error('Unable to start checkout. Please try again.');
      setUpgradingTier(null);
    }
  };

  // "Cancel" schedules cancellation at the end of the current billing cycle —
  // access (and tier) is kept until then, not revoked immediately. The tier
  // itself only flips to FREE once the period actually ends (via webhook).
  const downgradeMutation = useMutation({
    mutationFn: billingService.downgrade,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      if (user) setUser({ ...user, tier: data.tier });
      toast.success(
        data.cancelAtPeriodEnd
          ? "Subscription cancelled — you'll keep Pro access until the end of your billing period."
          : 'Downgraded to Free plan'
      );
      setShowDowngrade(false);
    },
    onError: () => {
      toast.error('Failed to cancel subscription');
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Plans & Billing"
        description="Choose the plan that fits your travel style"
        back="/settings"
      />

      {/* Current Subscription */}
      {subscription && currentTier !== 'FREE' && (
        <Card className="bg-gradient-to-br from-primary/5 to-info/5 border-primary/20">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Current plan</p>
                <p className="text-lg font-bold">{subscription.tier}</p>
                {subscription.status === 'PAST_DUE' && (
                  <p className="text-xs text-destructive mt-0.5">
                    Payment issue — we're retrying automatically. Update your payment method if this continues.
                  </p>
                )}
                {subscription.currentPeriodEnd && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {subscription.cancelAtPeriodEnd ? 'Cancels on ' : 'Renews on '}
                    {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
            {subscription.cancelAtPeriodEnd ? (
              <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 rounded-md border border-border">
                Cancellation scheduled
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowDowngrade(true)}>
                <ArrowDown className="h-4 w-4" /> Cancel Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Cards — visual treatment matches components/landing/LandingPricing.tsx */}
      <div className="mx-auto mt-4 grid max-w-4xl gap-6 lg:grid-cols-2">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.tier}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5 }}
            whileHover={reduce ? undefined : { y: -4 }}
            className={cn(
              'relative flex h-full flex-col rounded-2xl border p-7 will-change-transform',
              plan.highlighted
                ? 'border-primary bg-card shadow-xl shadow-primary/10 ring-1 ring-primary/25'
                : 'border-border bg-card',
            )}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Most popular
              </span>
            )}

            <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{plan.tagline}</p>

            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.period}</span>
            </p>

            {currentTier === plan.tier ? (
              <Button variant="outline" disabled className="mt-6 h-11 w-full">Current Plan</Button>
            ) : plan.tier === 'FREE' ? (
              currentTier !== 'FREE' ? (
                <Button
                  variant="outline"
                  className="mt-6 h-11 w-full"
                  disabled={subscription?.cancelAtPeriodEnd}
                  onClick={() => setShowDowngrade(true)}
                >
                  {subscription?.cancelAtPeriodEnd ? 'Cancellation scheduled' : 'Cancel Subscription'}
                </Button>
              ) : (
                <Button variant="ghost" disabled className="mt-6 h-11 w-full">Free Forever</Button>
              )
            ) : (
              <Button
                variant={plan.highlighted ? 'default' : 'outline'}
                onClick={() => handleUpgrade(plan.tier as 'PRO')}
                disabled={upgradingTier !== null}
                className="mt-6 h-11 w-full"
              >
                {upgradingTier === plan.tier && <Loader2 className="h-4 w-4 animate-spin" />}
                {upgradingTier === plan.tier ? 'Upgrading…' : `Upgrade to ${plan.name}`}
              </Button>
            )}

            <ul className="mt-7 space-y-3 border-t border-border pt-6">
              {plan.features.map(([label, included]) => (
                <li key={label} className="flex items-start gap-2.5 text-sm">
                  {included ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                  )}
                  <span className={cn(included ? 'text-foreground/80' : 'text-muted-foreground/60 line-through')}>
                    {label}
                  </span>
                  <span className="sr-only">{included ? 'included' : 'not included'}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      <ConfirmDialog
        open={showDowngrade}
        onOpenChange={setShowDowngrade}
        title="Cancel your Pro subscription?"
        description={
          subscription?.currentPeriodEnd
            ? `You'll keep Pro access until ${format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')} — no further payments after that. You can resubscribe anytime.`
            : "You'll lose access to premium features like AI, advanced analytics, multi-currency support, and unlimited trips."
        }
        confirmLabel="Cancel Subscription"
        variant="destructive"
        loading={downgradeMutation.isPending}
        onConfirm={() => downgradeMutation.mutate()}
      />
    </div>
  );
}
