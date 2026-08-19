import { motion, useReducedMotion } from 'framer-motion';
import { Plane, Home, Wallet, ArrowRight } from 'lucide-react';
import { Reveal, Counter, revealParent, revealChild } from './Reveal';

/**
 * Capability metrics rather than invented user counts — every figure here is
 * true of the product as built.
 */
const METRICS = [
  { value: 3, label: 'Expense scopes', sub: 'Trip · Group · Personal' },
  { value: 4, label: 'Split types', sub: 'Equal, %, exact, shares' },
  { value: 13, label: 'AI capabilities', sub: 'All free, no card' },
  { value: 20, label: 'Categories', sub: 'Auto-assigned by AI' },
];

const SCOPES = [
  {
    id: 'trip',
    icon: Plane,
    tone: 'hsl(var(--chart-1))',
    kicker: 'For travel',
    title: 'Trips',
    body:
      'A week in Goa with five people and forty receipts. Track it day by day, watch the burn rate, and land home already settled.',
    points: ['Day-by-day itinerary checkpoints', 'Burn-rate budget with pace tracking', 'Group chat, polls and a shared feed'],
  },
  {
    id: 'group',
    icon: Home,
    tone: 'hsl(var(--chart-2))',
    kicker: 'For the long haul',
    title: 'Groups',
    body:
      'Flatmates, family, the weekend football crew. Ongoing circles where the bills never really stop — so the balance never resets.',
    points: ['Rolling balances that never expire', 'Recurring rent, bills and subscriptions', 'Real-time sync across every member'],
  },
  {
    id: 'personal',
    icon: Wallet,
    tone: 'hsl(var(--chart-3))',
    kicker: 'Just for you',
    title: 'Personal',
    body:
      'Your own spending, private by default and completely separate from any group. Monthly budgets, recurring costs, and honest analytics.',
    points: ['Monthly budget with live status', 'Calendar view with daily totals', 'Category drill-down to the exact expense'],
  },
];

export default function LandingScopes() {
  const reduce = useReducedMotion();

  return (
    <>
      {/* Metrics strip */}
      <section className="border-y border-border bg-muted/30 px-4 py-12 sm:px-6 lg:px-8" aria-label="Product at a glance">
        <motion.ul
          variants={revealParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:gap-6 lg:grid-cols-4"
        >
          {METRICS.map((m) => (
            <motion.li key={m.label} variants={revealChild} className="text-center">
              <p className="text-3xl font-bold tracking-tight sm:text-4xl">
                <Counter target={m.value} />
              </p>
              <p className="mt-1.5 text-sm font-medium">{m.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{m.sub}</p>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      {/* Three scopes */}
      <section id="scopes" className="scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">One app, three lives</p>
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Most apps make you pick one.
            </h2>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Your holiday, your flat, and your own coffee habit are not the same ledger — but
              they shouldn’t need three different apps either. TripSplit keeps them separate
              where it matters and together where it helps.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {SCOPES.map((scope, i) => (
              <Reveal key={scope.id} delay={i * 0.09}>
                <motion.article
                  whileHover={reduce ? undefined : { y: -4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                  className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-7 will-change-transform"
                >
                  {/* Tinted wash that warms on hover */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-[0.07] transition-opacity duration-500 group-hover:opacity-[0.14]"
                    style={{ background: `radial-gradient(ellipse at top, ${scope.tone}, transparent 70%)` }}
                    aria-hidden="true"
                  />
                  <div
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `color-mix(in srgb, ${scope.tone} 14%, transparent)` }}
                  >
                    <scope.icon className="h-5 w-5" style={{ color: scope.tone }} aria-hidden="true" />
                  </div>

                  <p className="relative mt-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {scope.kicker}
                  </p>
                  <h3 className="relative mt-1.5 text-xl font-semibold tracking-tight">{scope.title}</h3>
                  <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground">{scope.body}</p>

                  <ul className="relative mt-5 space-y-2.5 border-t border-border pt-5">
                    {scope.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm">
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: scope.tone }} aria-hidden="true" />
                        <span className="text-muted-foreground">{p}</span>
                      </li>
                    ))}
                  </ul>
                </motion.article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
