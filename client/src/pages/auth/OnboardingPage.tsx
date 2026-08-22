import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@clerk/clerk-react';
import { useCompleteOnboarding } from '@/hooks/useAuth';
import {
  Plane, Home, Wallet, Sparkles, ArrowRight, Check,
  Globe, MapPin, UserPlus, Link as LinkIcon,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
// Reused from the marketing shell so onboarding feels like a continuation of
// the landing page rather than a different product — same easing, same motion.
import { Reveal, EASE } from '@/components/landing/Reveal';
import logoDark from '@/assets/logo/tripsplit-dark-64.svg';
import logoLight from '@/assets/logo/tripsplit-light-96.svg';

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

// Same three-scope concept as components/landing/LandingScopes.tsx, condensed
// to icon + one line — a first-touch explainer for what "scope" means here.
const SCOPES = [
  { icon: Plane, tone: 'hsl(var(--chart-1))', title: 'Trips', body: 'Shared travel, split with the group.' },
  { icon: Home, tone: 'hsl(var(--chart-2))', title: 'Groups', body: 'Flatmates, family — an ongoing tab.' },
  { icon: Wallet, tone: 'hsl(var(--chart-3))', title: 'Personal', body: 'Your own spending, always private.' },
];

const TOTAL_STEPS = 4;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -32 : 32, opacity: 0 }),
};

/** Low-contrast ambient wash, echoing LandingHero's Aurora but static and contained. */
function OnboardingAurora() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl dark:opacity-[0.2]"
        style={{ background: 'radial-gradient(circle, hsl(var(--chart-1)) 0%, transparent 68%)' }}
        animate={reduce ? undefined : { x: ['-52%', '-46%', '-52%'] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-32 bottom-0 h-[26rem] w-[26rem] rounded-full opacity-[0.10] blur-3xl dark:opacity-[0.15]"
        style={{ background: 'radial-gradient(circle, hsl(var(--chart-2)) 0%, transparent 68%)' }}
        animate={reduce ? undefined : { y: [0, -20, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export default function OnboardingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { resolvedTheme } = useThemeStore();
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
  const isDark = resolvedTheme() === 'dark';

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background p-6 text-foreground">
      <OnboardingAurora />

      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center py-10">
        {/* Brand mark */}
        <Reveal className="mb-8 flex items-center justify-center gap-2.5">
          <img src={isDark ? logoDark : logoLight} alt="" className="h-8 w-8" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight">TripSplit</span>
        </Reveal>

        {/* Step indicator */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
          {step < TOTAL_STEPS - 1 && (
            <button
              onClick={handleSkip}
              className="rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            transition={{ duration: 0.32, ease: EASE }}
          >
            <div className="rounded-2xl border border-border bg-card p-7 shadow-xl shadow-primary/5 sm:p-9">

              {/* ── Step 0: Welcome ─────────────────────────────────── */}
              {step === 0 && (
                <div className="space-y-7 text-center">
                  <div>
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Plane className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-[1.75rem]">
                      Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
                    </h2>
                    <p className="mt-2.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                      TripSplit keeps trips, groups and personal spending in one place.
                      Three quick steps and you're set up.
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    AI receipt scanning &amp; trip planning — free, no card
                  </span>

                  <ul className="grid grid-cols-3 gap-2.5 text-left">
                    {SCOPES.map((s) => (
                      <li
                        key={s.title}
                        className="rounded-xl border border-border bg-background/60 p-3.5"
                      >
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `color-mix(in srgb, ${s.tone} 14%, transparent)` }}
                        >
                          <s.icon className="h-4 w-4" style={{ color: s.tone }} aria-hidden="true" />
                        </span>
                        <p className="mt-2.5 text-sm font-semibold tracking-tight">{s.title}</p>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{s.body}</p>
                      </li>
                    ))}
                  </ul>

                  <Button onClick={goNext} className="h-11 w-full text-[15px]">
                    Get started <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}

              {/* ── Step 1: Currency ─────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Globe className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">Your default currency</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Every expense converts to this automatically. Change it anytime in Settings.
                    </p>
                  </div>

                  <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => setCurrency(c.code)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                          currency === c.code
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background text-foreground hover:bg-muted',
                        )}
                      >
                        <span className="w-6 text-center text-base">{c.symbol}</span>
                        <span className="truncate">{c.code}</span>
                        {currency === c.code && <Check className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={goBack} className="h-11 flex-1">Back</Button>
                    <Button onClick={goNext} className="h-11 flex-1">
                      Continue <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Create or Join ───────────────────────────── */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <MapPin className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">Your first trip</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Create one, or join a friend's with their invite code.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTripChoice('create')}
                      className={cn(
                        'rounded-xl border-2 p-4 text-center transition-colors',
                        tripChoice === 'create'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50',
                      )}
                    >
                      <Plane className="mx-auto mb-2 h-6 w-6 text-primary" aria-hidden="true" />
                      <p className="text-sm font-semibold">Create a trip</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Start fresh</p>
                    </button>
                    <button
                      onClick={() => setTripChoice('join')}
                      className={cn(
                        'rounded-xl border-2 p-4 text-center transition-colors',
                        tripChoice === 'join'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50',
                      )}
                    >
                      <LinkIcon className="mx-auto mb-2 h-6 w-6 text-primary" aria-hidden="true" />
                      <p className="text-sm font-semibold">Join a trip</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Use invite code</p>
                    </button>
                  </div>

                  {tripChoice === 'join' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="space-y-2"
                    >
                      <Label htmlFor="joinCode">Invite code</Label>
                      <Input
                        id="joinCode"
                        placeholder="Paste invite code here…"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                      />
                    </motion.div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={goBack} className="h-11 flex-1">Back</Button>
                    <Button
                      onClick={goNext}
                      className="h-11 flex-1"
                      disabled={tripChoice === 'join' && !joinCode.trim()}
                    >
                      Continue <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <button
                    onClick={goNext}
                    className="w-full rounded-md text-center text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    I'll do this later →
                  </button>
                </div>
              )}

              {/* ── Step 3: Invite Friends ────────────────────────────── */}
              {step === 3 && (
                <div className="space-y-6 text-center">
                  <div>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
                      <UserPlus className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">Invite your crew</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
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
                      Separate multiple addresses with commas. Free plan covers 5 members per trip.
                    </p>
                  </div>

                  <Button
                    onClick={handleFinish}
                    disabled={completeOnboarding.isPending}
                    className="h-11 w-full"
                  >
                    {completeOnboarding.isPending ? 'Setting up…' : 'Go to dashboard'}
                    {!completeOnboarding.isPending && <Check className="ml-1 h-4 w-4" aria-hidden="true" />}
                  </Button>

                  <button
                    onClick={handleFinish}
                    disabled={completeOnboarding.isPending}
                    className="w-full rounded-md text-center text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Skip and go to dashboard →
                  </button>
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
