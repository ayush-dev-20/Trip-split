import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Map,
  Users,
  BarChart3,
  Sparkles,
  Settings,
  Plus,
  Wallet,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useThemeStore } from '@/stores/themeStore';
import logoDark64 from '@/assets/logo/tripsplit-dark-64.svg';
import logoLight96 from '@/assets/logo/tripsplit-light-96.svg';

const PRIMARY_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/trips',     label: 'Trips',     icon: Map },
  { to: '/groups',    label: 'Groups',    icon: Users },
  { to: '/expenses',  label: 'Daily Expenses',  icon: Wallet },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const SECONDARY_NAV = [
  { to: '/ai', label: 'AI Assistant', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)();
  const isDark = resolvedTheme === 'dark';
  const iconSrc = isDark ? logoDark64 : logoLight96;

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Logo */}
      <div className="flex items-center h-16 px-5 border-b">
        <NavLink to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <img src={iconSrc} alt="TripSplit" className="h-7 w-7" />
          <span className="text-base font-bold tracking-tight">TripSplit</span>
        </NavLink>
      </div>

      {/* Primary CTA */}
      <div className="px-3 pt-4">
        <Button asChild className="w-full justify-start gap-2 shadow-sm">
          <NavLink to="/trips/new" onClick={onClose}>
            <Plus className="h-4 w-4" /> New Trip
          </NavLink>
        </Button>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-0.5">
          {PRIMARY_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 mb-2 px-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            More
          </p>
        </div>
        <nav className="space-y-0.5">
          {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 border-r flex-col">
        <SidebarContent onClose={onClose} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <SheetContent side="left" className="p-0 w-72 border-r-0">
          <SidebarContent onClose={onClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
