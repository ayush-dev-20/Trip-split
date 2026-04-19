import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Map,
  Users,
  BarChart3,
  Sparkles,
  Settings,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useThemeStore } from '@/stores/themeStore';
import logoDark64 from '@/assets/logo/tripsplit-dark-64.svg';
import logoLight96 from '@/assets/logo/tripsplit-light-96.svg';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/trips', label: 'Trips', icon: Map },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/ai', label: 'AI Assistant', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// TODO: Add this tab in 2.0 version.
// { to: '/settings/billing', label: 'Plans', icon: CreditCard },

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)();
  const isDark = resolvedTheme === 'dark';

  // Icon-only logo, swaps for light/dark mode
  const iconSrc = isDark ? logoDark64 : logoLight96;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-16 px-6">
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <img src={iconSrc} alt="TripSplit icon" className="h-8 w-8" />
          <span className="text-lg font-bold">TripSplit</span>
        </NavLink>
      </div>

      <Separator />

      {/* Nav */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <Separator />

      {/* TODO: Add this section in 2.0 version. */}
      {/* <div className="p-4">
        <div className="rounded-lg bg-gradient-to-r from-primary/10 to-purple-500/10 p-3">
          <p className="text-xs font-medium text-primary">Upgrade to Pro</p>
          <p className="text-xs text-muted-foreground mt-1">
            Unlock AI insights, unlimited trips & more
          </p>
        </div>
      </div> */}
    </div>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r bg-card flex-col">
        <SidebarContent onClose={onClose} />
      </aside>

      {/* Mobile sidebar using Sheet */}
      <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent onClose={onClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
