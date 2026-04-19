import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingService } from '@/services/billingService';
import { useAuthStore } from '@/stores/authStore';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { Check, Zap, Crown, Building2, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

const plans = [
  {
    tier: 'FREE' as const,
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Zap,
    color: '',
    features: [
      '2 active trips',
      '5 members per trip',
      'Basic expense splitting',
      'Group management',
      'Equal split type',
    ],
  },
  {
    tier: 'PRO' as const,
    name: 'Pro',
    price: '$7.99',
    period: '/month',
    icon: Crown,
    color: 'border-primary ring-2 ring-primary/20',
    popular: true,
    features: [
      'Unlimited trips & members',
      'All 4 split types',
      'AI receipt scanning',
      'AI budget advisor',
      'Advanced analytics',
      'Trip score & velocity',
      'Multi-currency support',
      'Receipt uploads',
    ],
  },
  {
    tier: 'TEAM' as const,
    name: 'Team',
    price: '$19.99',
    period: '/month',
    icon: Building2,
    color: 'border-purple-500 ring-2 ring-purple-500/20',
    features: [
      'Everything in Pro',
      'AI chatbot & NLP input',
      'Trip planner & predictions',
      'Custom reports & exports',
      'Year-in-review',
      'Peer benchmarking',
      'Priority support',
      'Team analytics',
    ],
  },
];

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const currentTier = user?.tier ?? 'FREE';
  const queryClient = useQueryClient();

  const [upgradingTier, setUpgradingTier] = useState<'PRO' | 'TEAM' | null>(null);
  const [showDowngrade, setShowDowngrade] = useState(false);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: billingService.getSubscription,
  });

  const upgradeMutation = useMutation({
    mutationFn: billingService.upgrade,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      if (user) setUser({ ...user, tier: data.tier });
      toast.success(`Upgraded to ${data.tier}!`);
      setUpgradingTier(null);
    },
    onError: () => {
      toast.error('Failed to upgrade plan');
      setUpgradingTier(null);
    },
  });

  const downgradeMutation = useMutation({
    mutationFn: billingService.downgrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      if (user) setUser({ ...user, tier: 'FREE' });
      toast.success('Downgraded to Free plan');
      setShowDowngrade(false);
    },
    onError: () => {
      toast.error('Failed to downgrade plan');
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the plan that fits your travel style
        </p>
      </div>

      {/* Current Subscription */}
      {subscription && currentTier !== 'FREE' && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-xl font-bold text-primary">{subscription.tier}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDowngrade(true)}
            >
              <ArrowDown className="h-4 w-4 mr-1.5" />
              Downgrade to Free
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.tier}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className={cn('flex flex-col relative h-full', plan.color)}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}

              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center',
                    plan.tier === 'PRO' ? 'bg-primary/10 text-primary' :
                    plan.tier === 'TEAM' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' :
                    'bg-muted text-muted-foreground'
                  )}>
                    <plan.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{plan.price}</span>
                      <span className="text-xs text-muted-foreground">{plan.period}</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {currentTier === plan.tier ? (
                  <Button variant="secondary" disabled className="w-full">Current Plan</Button>
                ) : plan.tier === 'FREE' ? (
                  currentTier !== 'FREE' ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowDowngrade(true)}
                    >
                      Downgrade
                    </Button>
                  ) : (
                    <Button variant="ghost" disabled className="w-full">Free Forever</Button>
                  )
                ) : (
                  <Button
                    variant={plan.tier === 'PRO' ? 'default' : 'secondary'}
                    onClick={() => {
                      setUpgradingTier(plan.tier as 'PRO' | 'TEAM');
                      upgradeMutation.mutate(plan.tier as 'PRO' | 'TEAM');
                    }}
                    disabled={upgradeMutation.isPending}
                    className="w-full"
                  >
                    {upgradingTier === plan.tier && upgradeMutation.isPending
                      ? 'Upgrading...'
                      : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Downgrade Confirmation */}
      <ConfirmDialog
        open={showDowngrade}
        onOpenChange={setShowDowngrade}
        title="Downgrade to Free?"
        description="You'll lose access to premium features like AI, advanced analytics, multi-currency support, and unlimited trips. This takes effect immediately."
        confirmLabel="Downgrade"
        variant="destructive"
        loading={downgradeMutation.isPending}
        onConfirm={() => downgradeMutation.mutate()}
      />
    </div>
  );
}
