import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Repeat, Smartphone, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal, useInViewOnce, EASE } from './Reveal';
import { cn } from '@/lib/utils';

const NODES = {
  AN: { x: 76, y: 62, label: 'Ananya', tone: 'hsl(var(--chart-1))' },
  RH: { x: 344, y: 62, label: 'Rahul', tone: 'hsl(var(--chart-2))' },
  ME: { x: 344, y: 238, label: 'Meera', tone: 'hsl(var(--chart-3))' },
  VK: { x: 76, y: 238, label: 'Vikram', tone: 'hsl(var(--chart-5))' },
} as const;

type NodeId = keyof typeof NODES;

/** Five real IOUs. Nets: Ananya +3,100 · Meera +1,610 · Rahul −1,610 · Vikram −3,100. */
const TANGLED: { from: NodeId; to: NodeId; amount: number; bow: number }[] = [
  { from: 'RH', to: 'AN', amount: 980, bow: -26 },
  { from: 'RH', to: 'ME', amount: 630, bow: 22 },
  { from: 'VK', to: 'AN', amount: 1880, bow: -22 },
  { from: 'VK', to: 'ME', amount: 1220, bow: 26 },
  { from: 'ME', to: 'AN', amount: 240, bow: 40 },
];

/** The same debts, netted down. Two transfers, nobody chases anyone. */
const SIMPLIFIED: { from: NodeId; to: NodeId; amount: number; bow: number }[] = [
  { from: 'RH', to: 'ME', amount: 1610, bow: 0 },
  { from: 'VK', to: 'AN', amount: 3100, bow: 0 },
];

const R = 26;

/** Curved path between two nodes, trimmed so it starts/ends at the circle edge. */
function edgePath(from: NodeId, to: NodeId, bow: number) {
  const a = NODES[from];
  const b = NODES[to];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const start = { x: a.x + ux * R, y: a.y + uy * R };
  const end = { x: b.x - ux * (R + 7), y: b.y - uy * (R + 7) };
  // Control point pushed perpendicular to the line by `bow`
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const ctrl = { x: mid.x - uy * bow, y: mid.y + ux * bow };
  return `M ${start.x} ${start.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`;
}

function labelPoint(from: NodeId, to: NodeId, bow: number) {
  const a = NODES[from];
  const b = NODES[to];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return { x: mid.x - (dy / len) * (bow * 0.55), y: mid.y + (dx / len) * (bow * 0.55) };
}

function DebtGraph() {
  const reduce = useReducedMotion();
  const [simplified, setSimplified] = useState(false);
  const edges = simplified ? SIMPLIFIED : TANGLED;

  // Play the collapse once, shortly after the diagram is actually looked at.
  const ref = useInViewOnce<HTMLDivElement>(() => {
    if (reduce) {
      setSimplified(true);
      return;
    }
    window.setTimeout(() => setSimplified(true), 1400);
  });

  return (
    <div ref={ref}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                simplified ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {simplified ? '2 payments' : '5 separate debts'}
            </span>
            <span className="text-xs text-muted-foreground">
              {simplified ? 'Everyone settles once' : 'Everyone owes someone'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setSimplified((s) => !s)}
          >
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            {simplified ? 'Show the mess' : 'Simplify'}
          </Button>
        </div>

        <svg
          viewBox="0 0 420 300"
          className="mt-4 h-auto w-full"
          role="img"
          aria-label={
            simplified
              ? 'Simplified: Rahul pays Meera ₹1,610 and Vikram pays Ananya ₹3,100.'
              : 'Tangled: five separate debts between four people.'
          }
        >
          <defs>
            <marker id="ts-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>

          <AnimatePresence mode="wait">
            <motion.g
              key={simplified ? 'simple' : 'tangled'}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {edges.map((e, i) => {
                const p = labelPoint(e.from, e.to, e.bow);
                return (
                  <g
                    key={`${e.from}-${e.to}`}
                    className={simplified ? 'text-primary' : 'text-muted-foreground'}
                  >
                    <motion.path
                      d={edgePath(e.from, e.to, e.bow)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={simplified ? 2.4 : 1.5}
                      strokeOpacity={simplified ? 0.9 : 0.45}
                      markerEnd="url(#ts-arrow)"
                      initial={reduce ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
                    />
                    <text
                      x={p.x}
                      y={p.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={cn(
                        'font-semibold',
                        simplified ? 'fill-primary' : 'fill-muted-foreground',
                      )}
                      style={{ fontSize: simplified ? 13 : 10.5 }}
                    >
                      ₹{e.amount.toLocaleString('en-IN')}
                    </text>
                  </g>
                );
              })}
            </motion.g>
          </AnimatePresence>

          {(Object.keys(NODES) as NodeId[]).map((id) => {
            const n = NODES[id];
            return (
              <g key={id}>
                <circle cx={n.x} cy={n.y} r={R} fill={n.tone} />
                <text
                  x={n.x}
                  y={n.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  {id}
                </text>
                <text
                  x={n.x}
                  y={n.y + R + 15}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: 11 }}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Zap,
    title: 'Debt simplification',
    body: 'If Ananya owes Rahul and Rahul owes Meera, Ananya just pays Meera. The graph collapses to the minimum number of transfers, automatically.',
  },
  {
    icon: Users,
    title: '“Who pays next”',
    body: 'The member furthest behind gets surfaced before the next round, so the group self-corrects instead of settling up at the end.',
  },
  {
    icon: Smartphone,
    title: 'Settle over UPI',
    body: 'Deep-link straight into any UPI app on mobile, or scan a QR on desktop. Paid a different amount? Log what actually moved — the remainder stays tracked.',
  },
];

export default function LandingSettlement() {
  const reduce = useReducedMotion();

  return (
    <section id="settle" className="scroll-mt-20 border-y border-border bg-muted/25 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Settlement intelligence</p>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Five debts. Two payments. Zero group-chat maths.
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            A shared trip produces a web of small IOUs that nobody wants to untangle at 1am.
            TripSplit nets the whole graph down to the fewest transfers that clear it.
          </p>
        </Reveal>

        <div className="mt-16 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
          <Reveal>
            <DebtGraph />
          </Reveal>

          <ul className="space-y-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08} as="li">
                <motion.div
                  whileHover={reduce ? undefined : { x: 3 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                  className="flex gap-4 will-change-transform"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
