import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal, EASE } from './Reveal';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    tagline: 'Everything you need to stop arguing about money.',
    cta: 'Create a free account',
    href: '/register',
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
    name: 'Pro',
    price: '₹69',
    period: '/month',
    tagline: 'For people whose group chat never stops planning.',
    cta: 'Go Pro',
    href: '/register',
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

const FAQS = [
  {
    q: 'Can other people see my personal expenses?',
    a: 'No. Personal expenses live in their own scope — they are never part of a trip or group ledger, never visible to other members, and are excluded from every shared balance and analytic. A group expense you paid for is tracked separately, because that money is coming back to you.',
  },
  {
    q: 'Do my friends need an account to be on a trip?',
    a: 'Yes — each member signs in so balances stay attached to a real person and settle correctly. Joining takes seconds: share the trip’s invite code, they create a free account, and they are in. The free plan covers up to 5 members per trip.',
  },
  {
    q: 'What happens if we spend in different currencies?',
    a: 'Every expense is converted to the trip’s base currency at the time it is added, so the running total is always meaningful. The original amount and currency are preserved on the expense. Multi-currency conversion is a Pro feature.',
  },
  {
    q: 'How does settling over UPI work?',
    a: 'Open a settlement and TripSplit builds the UPI request for you: on mobile it deep-links straight into your UPI app with the amount pre-filled, and on desktop it renders a QR code to scan. If you end up paying a different amount, log what actually moved — the remainder stays tracked as outstanding.',
  },
  {
    q: 'Can I cancel Pro whenever I want?',
    a: 'Yes. Downgrade at any time and you drop back to the free plan with no penalty — your trips, expenses and history stay exactly where they are. You keep read access to everything you have already recorded.',
  },
];

function FaqItem({ q, a, open, onToggle, id }: {
  q: string; a: string; open: boolean; onToggle: () => void; id: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="border-b border-border">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="flex w-full items-center justify-between gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[15px] font-medium">{q}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-button`}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPricing() {
  const reduce = useReducedMotion();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section id="pricing" className="scroll-mt-20 border-t border-border bg-muted/25 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Pricing</p>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            ₹69 a month. Less than one round of coffee.
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            The AI is free on both plans. Pro is for scale and depth — unlimited trips,
            line-item itemisation, multi-currency and export.
          </p>
        </Reveal>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 lg:grid-cols-2">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.08}>
              <motion.div
                whileHover={reduce ? undefined : { y: -4 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
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

                <Button
                  asChild
                  size="lg"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  className="mt-6 h-11"
                >
                  <Link to={plan.href}>{plan.cta}</Link>
                </Button>

                <ul className="mt-7 space-y-3 border-t border-border pt-6">
                  {plan.features.map(([label, included]) => (
                    <li key={label as string} className="flex items-start gap-2.5 text-sm">
                      {included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      ) : (
                        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                      )}
                      <span className={cn(included ? 'text-foreground' : 'text-muted-foreground/60 line-through')}>
                        {label}
                      </span>
                      <span className="sr-only">{included ? 'included' : 'not included'}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </Reveal>
          ))}
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-24 max-w-3xl">
          <Reveal className="text-center">
            <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              Questions people actually ask
            </h2>
          </Reveal>
          <Reveal delay={0.06} className="mt-10">
            <div className="border-t border-border">
              {FAQS.map((f, i) => (
                <FaqItem
                  key={f.q}
                  id={`faq-${i}`}
                  q={f.q}
                  a={f.a}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
