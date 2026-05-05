import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@clerk/clerk-react';
import { useCompleteOnboarding } from '@/hooks/useAuth';
import {
  Plane, DollarSign, Users, Sparkles, ArrowRight, Check,
  Globe, MapPin, UserPlus, Link as LinkIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'THB', label: 'Thai Baht', symbol: '฿' },
];

const TOTAL_STEPS = 4;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

export default function OnboardingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const completeOnboarding = useCompleteOnboarding();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [currency, setCurrency] = useState('USD');
  const [inviteEmails, setInviteEmails] = useState('');
  const [tripChoice, setTripChoice] = useState<'create' | 'join' | null>(null);
  const [joinCode, setJoinCode] = useState('');

  // If user has already completed onboarding, redirect
  if (isLoaded && isSignedIn && user?.onboardingDone) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  function goNext() {
    setDir(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setDir(-1);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleFinish() {
    completeOnboarding.mutate(currency);
  }

  function handleSkip() {
    completeOnboarding.mutate(currency);
  }

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
          {step < TOTAL_STEPS - 1 && (
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip setup
            </button>
          )}
        </div>
        <Progress value={progressPct} className="mb-8 h-1.5" />

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <Card>
              <CardContent className="p-8">

                {/* ── Step 0: Welcome ─────────────────────────────────── */}
                {step === 0 && (
                  <div className="text-center space-y-6">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary mx-auto">
                      <Plane className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
                      </h2>
                      <p className="text-muted-foreground mt-2">
                        Let's set up your TripSplit account in 3 quick steps.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 py-2">
                      {[
                        { icon: DollarSign, label: 'Track Expenses', desc: 'Multi-currency' },
                        { icon: Users, label: 'Split Bills', desc: '4 split types' },
                        { icon: Sparkles, label: 'AI Insights', desc: 'Smart analysis' },
                      ].map(({ icon: Icon, label, desc }) => (
                        <div key={label} className="text-center p-3 rounded-xl bg-muted">
                          <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
                          <p className="text-xs font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      ))}
                    </div>

                    <Button onClick={goNext} className="w-full">
                      Get Started <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}

                {/* ── Step 1: Currency + Timezone ─────────────────────── */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mx-auto mb-4">
                        <Globe className="h-6 w-6" />
                      </div>
                      <h2 className="text-xl font-bold">Your Default Currency</h2>
                      <p className="text-muted-foreground text-sm mt-1">
                        Choose the currency you use most. You can always change this later.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => setCurrency(c.code)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left',
                            currency === c.code
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background hover:bg-muted text-foreground'
                          )}
                        >
                          <span className="text-base w-6 text-center">{c.symbol}</span>
                          <span className="truncate">{c.code}</span>
                          {currency === c.code && (
                            <Check className="h-3.5 w-3.5 ml-auto flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={goBack} className="flex-1">
                        Back
                      </Button>
                      <Button onClick={goNext} className="flex-1">
                        Continue <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Create or Join ───────────────────────────── */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mx-auto mb-4">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <h2 className="text-xl font-bold">Your First Trip</h2>
                      <p className="text-muted-foreground text-sm mt-1">
                        Create a new trip or join one a friend shared with you.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setTripChoice('create')}
                        className={cn(
                          'p-4 rounded-xl border-2 text-center transition-colors',
                          tripChoice === 'create'
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <Plane className="h-6 w-6 text-primary mx-auto mb-2" />
                        <p className="font-semibold text-sm">Create a trip</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Start fresh</p>
                      </button>
                      <button
                        onClick={() => setTripChoice('join')}
                        className={cn(
                          'p-4 rounded-xl border-2 text-center transition-colors',
                          tripChoice === 'join'
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <LinkIcon className="h-6 w-6 text-primary mx-auto mb-2" />
                        <p className="font-semibold text-sm">Join a trip</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Use invite code</p>
                      </button>
                    </div>

                    {tripChoice === 'join' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2"
                      >
                        <Label htmlFor="joinCode">Invite Code</Label>
                        <Input
                          id="joinCode"
                          placeholder="Paste invite code here…"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value)}
                        />
                      </motion.div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={goBack} className="flex-1">
                        Back
                      </Button>
                      <Button
                        onClick={goNext}
                        className="flex-1"
                        disabled={tripChoice === 'join' && !joinCode.trim()}
                      >
                        Continue <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>

                    <button
                      onClick={goNext}
                      className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                    >
                      I'll do this later →
                    </button>
                  </div>
                )}

                {/* ── Step 3: Invite Friends ────────────────────────────── */}
                {step === 3 && (
                  <div className="text-center space-y-6">
                    <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-600 mx-auto">
                      <UserPlus className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Invite Your Crew</h2>
                      <p className="text-muted-foreground text-sm mt-1">
                        Add friends by email so they can join your trips.
                      </p>
                    </div>

                    <div className="space-y-2 text-left">
                      <Label htmlFor="emails">Email addresses</Label>
                      <Input
                        id="emails"
                        placeholder="alice@example.com, bob@example.com"
                        value={inviteEmails}
                        onChange={(e) => setInviteEmails(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Separate multiple addresses with commas.
                      </p>
                    </div>

                    <Button
                      onClick={handleFinish}
                      disabled={completeOnboarding.isPending}
                      className="w-full"
                    >
                      {completeOnboarding.isPending ? 'Setting up…' : 'Go to Dashboard'}
                      {!completeOnboarding.isPending && <Check className="h-4 w-4 ml-2" />}
                    </Button>

                    <button
                      onClick={handleFinish}
                      disabled={completeOnboarding.isPending}
                      className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Skip and go to dashboard →
                    </button>
                  </div>
                )}

              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
