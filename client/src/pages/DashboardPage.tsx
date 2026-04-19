import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useTrips } from '@/hooks/useTrips';
import { useGroups } from '@/hooks/useGroups';
import { useOverallBalances } from '@/hooks/useSettlements';
import { useSyncTripStatuses } from '@/hooks/useTrips';
import { useMyExpenses } from '@/hooks/useExpenses';
import { useAuthStore } from '@/stores/authStore';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import {
  Map, Users, DollarSign, TrendingUp, Plus, ArrowRight,
  Plane, Calendar, MapPin, BookOpen, ChevronLeft, ChevronRight,
  UserPlus, Receipt, CheckCircle2, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const guideSteps = [
  {
    icon: Plane,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    step: '01',
    title: 'Create a Trip',
    description:
      'Kick things off by creating a trip — give it a name, set a destination, pick your travel dates, and optionally add a budget. You can do this with or without a group.',
    tip: 'e.g. "Bali Adventure · 12–20 Mar" with a $2,000 budget',
    action: { label: 'Create a Trip', href: '/trips/new' },
  },
  {
    icon: UserPlus,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
    step: '02',
    title: 'Invite Your Crew',
    description:
      'Share the trip invite code or link with friends to add them as members. You can also create a Group to keep the same crew across multiple trips.',
    tip: 'Groups are optional but handy for recurring travel buddies',
    action: { label: 'Manage Groups', href: '/groups' },
  },
  {
    icon: Receipt,
    color: 'bg-green-100 dark:bg-green-900/30 text-green-600',
    step: '03',
    title: 'Log Expenses',
    description:
      'Add expenses as they happen — dinner, hotels, transport. Pick who paid and choose a split type: equal, percentage, exact amounts, or shares.',
    tip: 'Pro users can scan receipts with AI for instant logging',
    action: { label: 'View Trips', href: '/trips' },
  },
  {
    icon: CheckCircle2,
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
    step: '04',
    title: 'Settle Up',
    description:
      'When the trip wraps up, TripSplit calculates who owes what with the fewest transfers possible. Mark payments as done and everyone is square!',
    tip: 'Works with Venmo, PayPal, bank transfer, or just cash',
    action: { label: 'View Trips', href: '/trips' },
  },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: tripsData, isLoading: tripsLoading } = useTrips();
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const { data: overallBalances } = useOverallBalances();
  const { data: myExpenses } = useMyExpenses();
  const syncStatuses = useSyncTripStatuses();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  // Sync trip statuses based on current date once when the dashboard mounts
  useEffect(() => {
    syncStatuses.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (tripsLoading || groupsLoading) return <PageLoader />;

  const trips = tripsData?.trips ?? [];
  const activeTrips = trips.filter((t) => t.status === 'ACTIVE' || t.status === 'UPCOMING');
  // Use the API-computed personal total (sum of user's split amounts across all trips)
  const totalSpent = myExpenses?.totalSpent ?? 0;

  // Use the most common currency from trips, or user's preference
  const primaryCurrency = trips[0]?.budgetCurrency || user?.preferredCurrency || 'USD';

  const stats = [
    { label: 'Active Trips', value: activeTrips.length, icon: Map, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Groups', value: groups?.length ?? 0, icon: Users, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Total Spent', value: `${primaryCurrency} ${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
    { label: 'Total Trips', value: trips.length, icon: TrendingUp, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
  ];

  const current = guideSteps[guideStep];
  const StepIcon = current.icon;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's happening with your trips
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setGuideStep(0); setGuideOpen(true); }} className="flex-1 sm:flex-none">
            <BookOpen className="h-4 w-4 mr-2" /> Quick Guide
          </Button>
          <Button asChild className="flex-1 sm:flex-none">
            <Link to="/trips/new">
              <Plus className="h-4 w-4 mr-2" /> New Trip
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Guide Dialog */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Quick Guide</DialogTitle>
          </DialogHeader>

          {/* Progress bar */}
          <div className="flex gap-1 p-4 pb-0">
            {guideSteps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-300',
                  i <= guideStep ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={guideStep}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.2 }}
              className="p-6 space-y-5"
            >
              {/* Step icon + number */}
              <div className="flex items-center gap-4">
                <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center shrink-0', current.color)}>
                  <StepIcon className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
                    Step {current.step} of {guideSteps.length}
                  </p>
                  <h2 className="text-xl font-bold">{current.title}</h2>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {current.description}
              </p>

              {/* Tip */}
              <div className="rounded-lg bg-muted px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  💡 {current.tip}
                </p>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGuideStep((s) => s - 1)}
                  disabled={guideStep === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>

                <div className="flex items-center gap-2">
                  {guideStep < guideSteps.length - 1 ? (
                    <Button size="sm" onClick={() => setGuideStep((s) => s + 1)}>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button size="sm" asChild onClick={() => setGuideOpen(false)}>
                      <Link to={current.action.href}>{current.action.label}</Link>
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="h-full">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center h-10 w-10 rounded-xl shrink-0 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold truncate">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Balance Summary — who I owe / who owes me */}
      {overallBalances && (overallBalances.iOwe.length > 0 || overallBalances.owedToMe.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* I Owe */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-red-200 dark:border-red-900/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
                  <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                  You Owe
                  <Badge variant="secondary" className="ml-auto bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    {overallBalances.iOwe.length} {overallBalances.iOwe.length === 1 ? 'person' : 'people'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {overallBalances.iOwe.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">You're all clear! 🎉</p>
                ) : (
                  overallBalances.iOwe.map((entry) => (
                    <Link
                      key={entry.user.id}
                      to={entry.trips.length === 1 ? `/trips/${entry.trips[0].id}/settlements` : `/trips/${entry.trips[0].id}/settlements`}
                      className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={entry.user.avatarUrl} />
                        <AvatarFallback className="text-xs bg-muted">
                          {entry.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.user.name}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {entry.trips.map((t) => (
                            <span key={t.id} className="text-xs text-muted-foreground truncate">{t.name}</span>
                          ))}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400 shrink-0">
                        {user?.preferredCurrency ?? 'USD'} {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Owed To Me */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-green-200 dark:border-green-900/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-green-600 dark:text-green-400">
                  <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <ArrowDownLeft className="h-4 w-4" />
                  </span>
                  Owed to You
                  <Badge variant="secondary" className="ml-auto bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    {overallBalances.owedToMe.length} {overallBalances.owedToMe.length === 1 ? 'person' : 'people'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {overallBalances.owedToMe.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">Nobody owes you right now</p>
                ) : (
                  overallBalances.owedToMe.map((entry) => (
                    <Link
                      key={entry.user.id}
                      to={entry.trips.length === 1 ? `/trips/${entry.trips[0].id}/settlements` : `/trips/${entry.trips[0].id}/settlements`}
                      className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={entry.user.avatarUrl} />
                        <AvatarFallback className="text-xs bg-muted">
                          {entry.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.user.name}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {entry.trips.map((t) => (
                            <span key={t.id} className="text-xs text-muted-foreground truncate">{t.name}</span>
                          ))}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400 shrink-0">
                        {user?.preferredCurrency ?? 'USD'} {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Active Trips */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upcoming & Active Trips</h2>
          <Button variant="link" asChild className="text-primary p-0 h-auto">
            <Link to="/trips" className="flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {activeTrips.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Plane className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No active trips yet</p>
              <Button asChild className="mt-4">
                <Link to="/trips/new">
                  <Plus className="h-4 w-4 mr-2" /> Create Your First Trip
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeTrips.slice(0, 6).map((trip, i) => (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/trips/${trip.id}`}>
                  <Card className="hover:shadow-md transition-shadow group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                          <Map className="h-5 w-5" />
                        </div>
                        <Badge variant="secondary" className={trip.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}>
                          {trip.status}
                        </Badge>
                      </div>
                      <h3 className="font-semibold truncate">{trip.name}</h3>
                      {trip.destination && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5" /> {trip.destination}
                        </p>
                      )}
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {trip._count?.members ?? 0} members
                        </span>
                        {trip.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Groups */}
      {groups && groups.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Groups</h2>
            <Button variant="link" asChild className="text-primary p-0 h-auto">
              <Link to="/groups" className="flex items-center gap-1">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.slice(0, 3).map((group) => (
              <Link key={group.id} to={`/groups/${group.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{group.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {group._count?.members ?? 0} members · {group._count?.trips ?? 0} trips
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
