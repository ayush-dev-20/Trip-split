import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Shared easing — a soft "engineered" out-expo rather than a bouncy default. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Fades + lifts its children once, the first time they scroll into view.
 * Collapses to a plain fade-free render when the user prefers reduced motion.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'header';
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </MotionTag>
  );
}

/** Parent for staggered lists — pair with `revealChild`. */
export const revealParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export const revealChild: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/**
 * Fires `onEnter` once when the element first becomes visible. Used to start
 * the micro-interactions (receipt scan, debt collapse) only when they're seen.
 */
export function useInViewOnce<T extends HTMLElement>(
  onEnter: () => void,
  threshold = 0.35,
) {
  const ref = useRef<T>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || fired.current) return;
        fired.current = true;
        observer.disconnect();
        onEnter();
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // onEnter is intentionally not a dep — this must fire exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  return ref;
}

/**
 * Counts from 0 to `target` when scrolled into view, on rAF so it never
 * triggers layout. Jumps straight to the value under reduced motion.
 */
export function Counter({
  target,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1500,
  className,
}: {
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  const frame = useRef<number | undefined>(undefined);

  const ref = useInViewOnce<HTMLSpanElement>(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutCubic — quick to read, settles gently
      setValue(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  });

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {value.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
