import { Link } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Bell, Globe, MoonStar, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal, revealParent, revealChild } from './Reveal';
import logoDark from '@/assets/logo/tripsplit-dark-64.svg';
import logoLight from '@/assets/logo/tripsplit-light-96.svg';

const PLATFORM = [
  { icon: RefreshCw, label: 'Real-time sync', sub: 'Every member, instantly' },
  { icon: Globe, label: 'Multi-currency', sub: 'Converted as you add' },
  { icon: Smartphone, label: 'Installable PWA', sub: 'Mobile and desktop' },
  { icon: MoonStar, label: 'Full dark mode', sub: 'Follows your system' },
  { icon: Bell, label: 'Notifications', sub: 'Settlements and budgets' },
];

export default function LandingFooter() {
  const reduce = useReducedMotion();
  const year = new Date().getFullYear();

  return (
    <>
      {/* Platform strip */}
      <section className="border-t border-border px-4 py-16 sm:px-6 lg:px-8" aria-label="Platform capabilities">
        <motion.ul
          variants={revealParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5"
        >
          {PLATFORM.map((p) => (
            <motion.li key={p.label} variants={revealChild} className="text-center">
              <p.icon className="mx-auto h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">{p.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.sub}</p>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-border px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <motion.div
            className="absolute left-1/2 top-0 h-[34rem] w-[52rem] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl dark:opacity-[0.2]"
            style={{ background: 'radial-gradient(circle, hsl(var(--chart-1)) 0%, transparent 68%)' }}
            animate={reduce ? undefined : { scale: [1, 1.06, 1], opacity: [0.12, 0.18, 0.12] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Your next trip is going to cost something.
            <br className="hidden sm:block" /> At least make the maths free.
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Create an account, start a trip, invite the group. No card, no trial timer, and the
            AI works from the first receipt.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild className="group h-12 px-7 text-[15px]">
              <Link to="/register">
                Get started free
                <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-7 text-[15px]">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img src={logoLight} alt="" className="h-7 w-7 dark:hidden" aria-hidden="true" />
              <img src={logoDark} alt="" className="hidden h-7 w-7 dark:block" aria-hidden="true" />
              <span className="font-bold tracking-tight">TripSplit</span>
            </div>

            <nav aria-label="Footer">
              <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <li><a href="#scopes" className="transition-colors hover:text-foreground">How it works</a></li>
                <li><a href="#ai" className="transition-colors hover:text-foreground">AI</a></li>
                <li><a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a></li>
                <li><Link to="/login" className="transition-colors hover:text-foreground">Sign in</Link></li>
                <li><Link to="/register" className="transition-colors hover:text-foreground">Get started</Link></li>
              </ul>
            </nav>
          </div>

          <p className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground sm:text-left">
            © {year} TripSplit. Split expenses, not friendships.
          </p>
        </div>
      </footer>
    </>
  );
}
