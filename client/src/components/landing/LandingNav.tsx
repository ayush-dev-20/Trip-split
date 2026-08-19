import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/utils';
import logoDark from '@/assets/logo/tripsplit-dark-64.svg';
import logoLight from '@/assets/logo/tripsplit-light-96.svg';

const SECTIONS = [
  { href: '#scopes', label: 'How it works' },
  { href: '#settle', label: 'Settling' },
  { href: '#ai', label: 'AI' },
  { href: '#analytics', label: 'Analytics' },
  { href: '#pricing', label: 'Pricing' },
];

/** Tracks the theme the browser is actually painting, including "system". */
function useResolvedTheme() {
  const theme = useThemeStore((s) => s.theme);
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'));
    sync();
    // Only the "system" setting needs to react to the OS changing.
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [theme]);

  return isDark;
}

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isDark = useResolvedTheme();

  // Passive + rAF-throttled so scrolling never stalls on a state write.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 12);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Never leave the mobile sheet open behind a resize into desktop layout.
  useEffect(() => {
    if (!menuOpen) return;
    const media = window.matchMedia('(min-width: 768px)');
    const close = () => setMenuOpen(false);
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled || menuOpen
          ? 'border-b border-border/70 bg-background/75 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main"
      >
        <a href="#top" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img src={isDark ? logoDark : logoLight} alt="" className="h-8 w-8" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight">TripSplit</span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild className="hidden sm:inline-flex">
            <Link to="/register">Get started free</Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-border/70 md:hidden">
          <ul className="mx-auto max-w-6xl space-y-1 px-4 py-4 sm:px-6">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
            <li className="flex gap-2 pt-2 sm:hidden">
              <Button variant="outline" className="flex-1" asChild>
                <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
              </Button>
              <Button className="flex-1" asChild>
                <Link to="/register" onClick={() => setMenuOpen(false)}>Get started free</Link>
              </Button>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
