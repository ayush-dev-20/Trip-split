import { useRef } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Check, Sparkles, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal, EASE } from './Reveal';
import { cn } from '@/lib/utils';

/** Low-contrast aurora wash. Pure transform/opacity so it never repaints layout. */
function Aurora() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute -top-[28rem] left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl dark:opacity-[0.22]"
        style={{ background: 'radial-gradient(circle, hsl(var(--chart-1)) 0%, transparent 68%)' }}
        animate={reduce ? undefined : { x: ['-52%', '-46%', '-52%'], y: [0, 26, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-40 top-24 h-[34rem] w-[34rem] rounded-full opacity-[0.12] blur-3xl dark:opacity-[0.18]"
        style={{ background: 'radial-gradient(circle, hsl(var(--chart-2)) 0%, transparent 68%)' }}
        animate={reduce ? undefined : { x: [0, -30, 0], y: [0, 22, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -left-40 top-72 h-[30rem] w-[30rem] rounded-full opacity-[0.10] blur-3xl dark:opacity-[0.16]"
        style={{ background: 'radial-gradient(circle, hsl(var(--chart-3)) 0%, transparent 68%)' }}
        animate={reduce ? undefined : { x: [0, 34, 0], y: [0, -18, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Hairline grid, fades out before it reaches the copy */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 30%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 30%, transparent 78%)',
        }}
      />
    </div>
  );
}

const MEMBERS = [
  { initials: 'AN', name: 'Ananya', amount: 3100, owed: true, tone: 'hsl(var(--chart-1))' },
  { initials: 'RH', name: 'Rahul', amount: -1610, owed: false, tone: 'hsl(var(--chart-2))' },
  { initials: 'ME', name: 'Meera', amount: 1610, owed: true, tone: 'hsl(var(--chart-3))' },
  { initials: 'VK', name: 'Vikram', amount: -3100, owed: false, tone: 'hsl(var(--chart-5))' },
];

/** Abstracted product surface: live balances + the burn-rate meter. */
function HeroVisual() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [28, -28]);

  return (
    <motion.div ref={ref} style={{ y }} className="relative mx-auto w-full max-w-2xl will-change-transform">
      <div className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-2xl shadow-primary/5 backdrop-blur-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Active trip</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">Goa, 6 days</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            Live
          </span>
        </div>

        <ul className="mt-5 space-y-2.5">
          {MEMBERS.map((m, i) => (
            <motion.li
              key={m.name}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.09, duration: 0.5, ease: EASE }}
              className="flex items-center gap-3"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: m.tone }}
                aria-hidden="true"
              >
                {m.initials}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</span>
              <span
                className={cn(
                  'shrink-0 text-sm font-semibold tabular-nums',
                  m.owed ? 'text-success' : 'text-destructive',
                )}
              >
                {m.owed ? '+' : '−'}₹{Math.abs(m.amount).toLocaleString('en-IN')}
              </span>
            </motion.li>
          ))}
        </ul>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.55, ease: EASE }}
          className="mt-5 flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.06] px-3.5 py-3"
        >
          <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm">
            <span className="font-semibold">5 debts simplified to 2 payments.</span>{' '}
            <span className="text-muted-foreground">Rahul and Vikram settle once each.</span>
          </p>
        </motion.div>
      </div>

      {/* Burn-rate meter, offset to read as a second surface */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.6, ease: EASE }}
        className="mx-auto -mt-4 w-[86%] rounded-2xl border border-border/80 bg-card/95 p-4 shadow-xl backdrop-blur-sm sm:w-[80%]"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Safe to spend</p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" /> Under pace
          </span>
        </div>
        <p className="mt-1.5 text-2xl font-bold tracking-tight">
          ₹4,600<span className="text-base font-medium text-muted-foreground">/day</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--chart-3))] to-[hsl(var(--chart-1))]"
            initial={reduce ? { width: '62%' } : { width: 0 }}
            animate={{ width: '62%' }}
            transition={{ delay: 1.25, duration: 1.1, ease: EASE }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">₹27,600 left across 4 remaining days</p>
      </motion.div>
    </motion.div>
  );
}

export default function LandingHero({ authSlot }: { authSlot: React.ReactNode }) {
  return (
    <section id="top" className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8 lg:pb-28">
      <Aurora />

      <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[1.05fr_minmax(0,26rem)] lg:gap-16">
        {/* Pitch */}
        <div className="max-w-2xl">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              AI receipt scanning &amp; trip planning — free on every plan
            </span>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              Never ask{' '}
              <span className="bg-gradient-to-br from-[hsl(var(--chart-1))] to-[hsl(var(--chart-2))] bg-clip-text text-transparent">
                “who owes what”
              </span>{' '}
              again.
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              TripSplit tracks trips, households and personal spending in one place — then
              collapses every tangled IOU into the fewest payments possible. Scan a receipt,
              split it by line item, settle over UPI in a tap.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="group h-12 px-6 text-[15px]">
                <Link to="/register">
                  Get started free
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 px-6 text-[15px]">
                <a href="#settle">See how settling works</a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {['No card required', 'Free plan forever', 'Works offline as a PWA'].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Auth form — the reason someone is on /login or /register */}
        <Reveal delay={0.1} className="lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/5 sm:p-7">
            {authSlot}
          </div>
        </Reveal>
      </div>

      <div className="mx-auto mt-20 max-w-6xl lg:mt-24">
        <HeroVisual />
      </div>
    </section>
  );
}
