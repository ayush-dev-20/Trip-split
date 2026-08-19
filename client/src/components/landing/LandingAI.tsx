import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ScanLine, MessageSquareText, Route, Backpack, Sparkles, Bell,
  TrendingUp, Tag, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal, useInViewOnce, EASE } from './Reveal';

const ITEMS = [
  { name: 'Goan prawn curry', qty: 1, price: 640, who: ['AN'] },
  { name: 'Butter naan', qty: 4, price: 220, who: ['AN', 'RH', 'ME', 'VK'] },
  { name: 'Kingfisher beer', qty: 3, price: 540, who: ['RH', 'VK'] },
  { name: 'Tiramisu', qty: 1, price: 280, who: ['ME'] },
];

const TONE: Record<string, string> = {
  AN: 'hsl(var(--chart-1))',
  RH: 'hsl(var(--chart-2))',
  ME: 'hsl(var(--chart-3))',
  VK: 'hsl(var(--chart-5))',
};

type Stage = 'idle' | 'scanning' | 'parsed' | 'assigned';

/** Simulated receipt scan → itemisation → per-person assignment. */
function ReceiptScan() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>('idle');
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const run = () => {
    clear();
    if (reduce) {
      setStage('assigned');
      return;
    }
    setStage('scanning');
    timers.current.push(window.setTimeout(() => setStage('parsed'), 1700));
    timers.current.push(window.setTimeout(() => setStage('assigned'), 3100));
  };

  const ref = useInViewOnce<HTMLDivElement>(run);
  useEffect(() => clear, []);

  const showItems = stage === 'parsed' || stage === 'assigned';

  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium">Receipt itemisation</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={run}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Replay
        </Button>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-border bg-muted/40 p-4">
        {/* Scan sweep */}
        {stage === 'scanning' && !reduce && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16"
            style={{
              background: 'linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.22), transparent)',
              boxShadow: '0 0 24px 4px hsl(var(--primary) / 0.28)',
            }}
            initial={{ y: -64 }}
            animate={{ y: 320 }}
            transition={{ duration: 1.6, ease: 'linear' }}
            aria-hidden="true"
          />
        )}

        <div className="flex items-baseline justify-between">
          <p className="font-semibold tracking-tight">Cafe Mojo</p>
          <p className="text-xs text-muted-foreground">Anjuna · 12 Aug</p>
        </div>

        <ul className="mt-3 space-y-2" aria-live="polite">
          {ITEMS.map((item, i) => (
            <motion.li
              key={item.name}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={showItems ? { opacity: 1, y: 0 } : { opacity: 0.25, y: 0 }}
              transition={{ duration: 0.4, delay: showItems ? i * 0.1 : 0, ease: EASE }}
              className="flex items-center gap-3 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {item.name}
                {item.qty > 1 && <span className="text-muted-foreground"> ×{item.qty}</span>}
              </span>

              {/* Who claimed it */}
              <span className="flex -space-x-1.5" aria-hidden="true">
                {item.who.map((w) => (
                  <motion.span
                    key={w}
                    initial={reduce ? false : { scale: 0, opacity: 0 }}
                    animate={
                      stage === 'assigned' ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }
                    }
                    transition={{ type: 'spring', stiffness: 420, damping: 22, delay: i * 0.07 }}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-card"
                    style={{ backgroundColor: TONE[w] }}
                  >
                    {w}
                  </motion.span>
                ))}
              </span>

              <span className="w-16 shrink-0 text-right font-medium tabular-nums">
                ₹{item.price}
              </span>
            </motion.li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">₹1,680</span></div>
          <div className="flex justify-between"><span>GST 5% · service 10%</span><span className="tabular-nums">₹252</span></div>
          <div className="flex justify-between pt-1 text-sm font-semibold text-foreground">
            <span>Total</span><span className="tabular-nums">₹1,932</span>
          </div>
        </div>
      </div>

      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: stage === 'assigned' ? 1 : 0 }}
        transition={{ duration: 0.45 }}
        className="mt-3 text-xs text-muted-foreground"
      >
        Tax and service charge split proportionally to what each person actually ordered.
      </motion.p>
    </div>
  );
}

const CAPABILITIES = [
  { icon: ScanLine, title: 'Receipt scanning', body: 'Photograph a bill; title, amount, date and category fill themselves in.' },
  { icon: MessageSquareText, title: 'Natural language', body: '“dinner 1200 split with Rahul” becomes a fully-formed, split expense.' },
  { icon: Route, title: 'Trip planner', body: 'A day-by-day itinerary that streams in as it writes, then refines by conversation.' },
  { icon: Backpack, title: 'Packing lists', body: 'Generated from your destination, dates and trip length — then ticked off.' },
  { icon: Tag, title: 'Auto-categorisation', body: 'Every expense sorted into one of 20 categories as you type the title.' },
  { icon: TrendingUp, title: 'Insights & forecasts', body: 'Budget pacing, projected spend and root-cause answers for why a month ran hot.' },
  { icon: Bell, title: 'Anomaly alerts', body: 'An expense far above your normal for that category gets flagged on the spot.' },
  { icon: Sparkles, title: 'Ask anything', body: 'Chat with your own data: “how much on food this week?”, “who paid the most?”' },
];

export default function LandingAI() {
  const reduce = useReducedMotion();

  return (
    <section id="ai" className="scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Built-in intelligence</p>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            The AI isn’t the upsell. It’s the free tier.
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Receipt scanning, natural-language entry, trip planning, packing lists, chat and
            insights all work on the free plan. Pro adds line-item itemisation, multi-currency
            and export — not the basics.
          </p>
        </Reveal>

        <div className="mt-16 grid items-start gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
          <Reveal>
            <ReceiptScan />
          </Reveal>

          <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {CAPABILITIES.map((c, i) => (
              <Reveal key={c.title} delay={(i % 2) * 0.06 + Math.floor(i / 2) * 0.05}>
                <motion.div
                  whileHover={reduce ? undefined : { y: -2 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                  className="will-change-transform"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <c.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold tracking-tight">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
