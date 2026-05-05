import { NavLink } from 'react-router';
import { LayoutDashboard, Plane, Users, Sparkles, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/trips', icon: Plane, label: 'Trips' },
  { to: '/groups', icon: Users, label: 'Groups' },
  { to: '/ai', icon: Sparkles, label: 'AI' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t bg-background/95 backdrop-blur-md pb-safe">
      <div className="flex items-stretch justify-around h-16">
        {TABS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200',
                    isActive ? 'bg-primary/15' : ''
                  )}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.25 : 1.75} />
                </div>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
