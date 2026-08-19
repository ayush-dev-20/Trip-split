import { useEffect } from 'react';
import { Outlet } from 'react-router';
import LandingNav from '@/components/landing/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import LandingScopes from '@/components/landing/LandingScopes';
import LandingSettlement from '@/components/landing/LandingSettlement';
import LandingAI from '@/components/landing/LandingAI';
import LandingPlanning from '@/components/landing/LandingPlanning';
import LandingAnalytics from '@/components/landing/LandingAnalytics';
import LandingPricing from '@/components/landing/LandingPricing';
import LandingFooter from '@/components/landing/LandingFooter';

/**
 * Public shell for /login and /register: the full marketing page, with the auth
 * form itself docked in the hero so signing in is never more than a glance away.
 * `<Outlet />` renders LoginPage or RegisterPage depending on the route.
 */
export default function AuthLayout() {
  // Smooth anchor scrolling, but only while this page is mounted and only for
  // users who haven't asked for reduced motion.
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const root = document.documentElement;
    root.classList.add('scroll-smooth');
    return () => root.classList.remove('scroll-smooth');
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground antialiased">
      <a
        href="#auth-form"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to sign in
      </a>

      <LandingNav />

      <main>
        <LandingHero
          authSlot={
            <div id="auth-form" className="scroll-mt-24">
              <Outlet />
            </div>
          }
        />
        <LandingScopes />
        <LandingSettlement />
        <LandingAI />
        <LandingPlanning />
        <LandingAnalytics />
        <LandingPricing />
      </main>

      <LandingFooter />
    </div>
  );
}
