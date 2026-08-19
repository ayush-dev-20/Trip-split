import { motion, useReducedMotion } from 'framer-motion';
import { Reveal, Counter, EASE } from './Reveal';

const CATEGORIES = [
  { label: 'Food & dining', pct: 34, tone: 'hsl(var(--chart-1))' },
  { label: 'Transport', pct: 24, tone: 'hsl(var(--chart-2))' },
  { label: 'Stay', pct: 20, tone: 'hsl(var(--chart-3))' },
  { label: 'Activities', pct: 14, tone: 'hsl(var(--chart-4))' },
  { label: 'Other', pct: 8, tone: 'hsl(var(--chart-5))' },
];

const DAILY = [
  { day: 'M', value: 42 }, { day: 'T', value: 68 }, { day: 'W', value: 35 },
  { day: 'T', value: 88 }, { day: 'F', value: 74 }, { day: 'S', value: 100 },
  { day: 'S', value: 61 },
];

const R = 58;
const C = 2 * Math.PI * R;

function Donut() {
  const reduce = useReducedMotion();
  let cursor = 0;

  return (
    <div className="relative">
      <svg viewBox="0 0 150 150" className="mx-auto h-44 w-44" role="img" aria-label="Category breakdown: food 34%, transport 24%, stay 20%, activities 14%, other 8%">
        <g transform="rotate(-90 75 75)">
          {CATEGORIES.map((c) => {
            const len = (c.pct / 100) * C;
            const offset = -cursor;
            cursor += len;
            return (
              <motion.circle
                key={c.label}
                cx="75"
                cy="75"
                r={R}
                fill="none"
                stroke={c.tone}
                strokeWidth="16"
                strokeDashoffset={offset}
                initial={reduce ? false : { strokeDasharray: `0 ${C}` }}
                whileInView={{ strokeDasharray: `${len} ${C - len}` }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: EASE }}
              />
            );
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-bold tracking-tight">
          <Counter target={48250} prefix="₹" />
        </p>
        <p className="text-xs text-muted-foreground">this trip</p>
      </div>
    </div>
  );
}

function Bars() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-40 items-end justify-between gap-2" role="img" aria-label="Daily spending across the week, peaking on Saturday">
      {DAILY.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <motion.div
              className="w-full rounded-t-md"
              style={{
                background: 'linear-gradient(to top, hsl(var(--chart-1)), hsl(var(--chart-2)))',
                transformOrigin: 'bottom',
              }}
              initial={reduce ? { height: `${d.value}%` } : { height: `${d.value}%`, scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: EASE }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

function Trend() {
  const reduce = useReducedMotion();
  const path = 'M 0 78 L 40 62 L 80 68 L 120 40 L 160 46 L 200 22 L 240 30';
  return (
    <svg viewBox="0 0 240 100" className="h-32 w-full" preserveAspectRatio="none" role="img" aria-label="Spending trend rising across six periods">
      <defs>
        <linearGradient id="ts-trend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${path} L 240 100 L 0 100 Z`}
        fill="url(#ts-trend)"
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.5 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke="hsl(var(--chart-1))"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: EASE }}
      />
    </svg>
  );
}

export default function LandingAnalytics() {
  return (
    <section id="analytics" className="scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Analytics</p>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Numbers that answer the next question.
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            A chart that tells you food cost ₹16,400 is only half an answer. Tap the category
            and TripSplit shows you the exact meals behind it.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          <Reveal>
            <div className="h-full rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold">By category</h3>
              <p className="mt-1 text-xs text-muted-foreground">Tap any slice to drill in</p>
              <div className="mt-4"><Donut /></div>
              <ul className="mt-5 space-y-2">
                {CATEGORIES.map((c) => (
                  <li key={c.label} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.tone }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.label}</span>
                    <span className="shrink-0 font-medium tabular-nums">{c.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold">Spending by day</h3>
              <p className="mt-1 text-xs text-muted-foreground">Saturday is always the problem</p>
              <div className="mt-6 flex-1"><Bars /></div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">Daily average</span>
                <span className="font-semibold tabular-nums"><Counter target={6893} prefix="₹" /></span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold">Period over period</h3>
              <p className="mt-1 text-xs text-muted-foreground">Compared with the previous six months</p>
              <div className="mt-6 flex-1"><Trend /></div>
              <ul className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                {[
                  ['Budget used', '62%', 'text-success'],
                  ['Projected total', '₹54,100', ''],
                  ['vs last month', '+18.4%', 'text-warning'],
                ].map(([label, value, tone]) => (
                  <li key={label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
            Custom date ranges, per-member contribution, budget vs actual, spending by day of
            week, Year in Review, and CSV or PDF export on Pro.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
