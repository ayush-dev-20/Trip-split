import { motion, useReducedMotion } from 'framer-motion';
import { Check, MapPin, Luggage, CalendarClock, Vote, MessagesSquare } from 'lucide-react';
import { Reveal, revealParent, revealChild } from './Reveal';
import { cn } from '@/lib/utils';

const ITINERARY = [
  { day: 'Day 1', title: 'Anjuna sunset market', cost: 800, done: true },
  { day: 'Day 1', title: 'Seafood shack, Vagator', cost: 1900, done: true },
  { day: 'Day 2', title: 'Dudhsagar falls day trip', cost: 2400, done: false },
  { day: 'Day 3', title: 'Old Goa churches walk', cost: 350, done: false },
];

const PACKING = [
  { cat: 'Essentials', items: [['Passport / ID', true], ['UPI + one card', true], ['Power bank', false]] },
  { cat: 'Beach', items: [['Reef-safe SPF 50', true], ['Quick-dry towel', false], ['Flip-flops', false]] },
] as const;

export default function LandingPlanning() {
  const reduce = useReducedMotion();

  return (
    <section className="border-y border-border bg-muted/25 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Before you leave</p>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            The trip starts long before the first expense.
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Plan the days, pack the bag, decide as a group — then watch the plan turn into
            real spending you can compare against.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          {/* Itinerary */}
          <Reveal>
            <div className="h-full rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Itinerary checkpoints</h3>
              </div>
              <motion.ul
                variants={revealParent}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="mt-5 space-y-2.5"
              >
                {ITINERARY.map((c) => (
                  <motion.li
                    key={c.title}
                    variants={revealChild}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3.5 py-3"
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                        c.done ? 'border-success bg-success text-white' : 'border-border text-transparent',
                      )}
                      aria-hidden="true"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-medium', c.done && 'text-muted-foreground line-through')}>
                        {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.day}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">₹{c.cost.toLocaleString('en-IN')}</span>
                  </motion.li>
                ))}
              </motion.ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Estimated ₹5,450 across 3 days · 2 of 4 visited
              </p>
            </div>
          </Reveal>

          {/* Packing */}
          <Reveal delay={0.08}>
            <div className="h-full rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <Luggage className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold">AI packing list</h3>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {PACKING.map((group) => (
                  <div key={group.cat} className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.cat}</p>
                    <ul className="mt-3 space-y-2">
                      {group.items.map(([label, done]) => (
                        <li key={label as string} className="flex items-center gap-2.5 text-sm">
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              done ? 'border-primary bg-primary text-white' : 'border-border',
                            )}
                            aria-hidden="true"
                          >
                            {done && <Check className="h-3 w-3" />}
                          </span>
                          <span className={cn(done && 'text-muted-foreground line-through')}>{label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={reduce ? { width: '50%' } : { width: 0 }}
                  whileInView={{ width: '50%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">3 of 6 packed · generated for Goa in August</p>
            </div>
          </Reveal>
        </div>

        <motion.ul
          variants={revealParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-6 grid gap-4 sm:grid-cols-3"
        >
          {[
            { icon: CalendarClock, title: 'Trip lifecycle', body: 'Upcoming → active → completed → archived, with the right view at each stage.' },
            { icon: Vote, title: 'Polls', body: 'Settle “which beach?” in the app instead of 60 unread messages.' },
            { icon: MessagesSquare, title: 'Chat & feed', body: 'Conversation attached to the trip, not scattered across three threads.' },
          ].map((f) => (
            <motion.li
              key={f.title}
              variants={revealChild}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <f.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
