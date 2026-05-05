import { Menu, Bell, Sun, Moon, Monitor, LogOut, User as UserIcon, BarChart3 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useLogout } from '@/hooks/useAuth';
import { NavLink } from 'react-router';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import logoDark64 from '@/assets/logo/tripsplit-dark-64.svg';
import logoLight96 from '@/assets/logo/tripsplit-light-96.svg';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme, resolvedTheme } = useThemeStore();
  const { unreadCount, togglePanel } = useNotificationStore();
  const { logout } = useLogout();

  const themeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const ThemeIcon = themeIcon;
  const isDark = resolvedTheme() === 'dark';
  const iconSrc = isDark ? logoDark64 : logoLight96;

  return (
    <header className="sticky top-0 z-30 h-14 lg:h-16 bg-background/90 backdrop-blur-md border-b">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">

        {/* ── Left side ── */}
        <div className="flex items-center gap-2">
          {/* Hamburger — mobile only. With bottom nav handling primary navigation,
              this opens the sheet sidebar which gives access to Analytics. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden -ml-2 h-9 w-9"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* App logo + name — mobile only */}
          <NavLink to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <img src={iconSrc} alt="TripSplit" className="h-6 w-6" />
            <span className="font-bold text-base tracking-tight">TripSplit</span>
          </NavLink>
        </div>

        {/* Desktop spacer so right-side controls stay right-aligned */}
        <div className="hidden lg:block" />

        {/* ── Right side ── */}
        <div className="flex items-center gap-0.5 lg:gap-1">

          {/* Analytics shortcut — mobile only, visible since Analytics is not in bottom nav */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            asChild
          >
            <NavLink to="/analytics" aria-label="Analytics">
              {({ isActive }) => (
                <BarChart3 className={`h-[18px] w-[18px] ${isActive ? 'text-primary' : ''}`} />
              )}
            </NavLink>
          </Button>

          {/* Theme toggle — desktop always, mobile inside profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden lg:flex h-9 w-9">
                <ThemeIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {[
                { value: 'light' as const, icon: Sun, label: 'Light' },
                { value: 'dark' as const, icon: Moon, label: 'Dark' },
                { value: 'system' as const, icon: Monitor, label: 'System' },
              ].map(({ value, icon: Icon, label }) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setTheme(value)}
                  className={theme === value ? 'bg-accent' : ''}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications bell */}
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePanel}
            className="relative h-9 w-9"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px] lg:h-5 lg:w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-1.5 h-9">
                <Avatar className="h-7 w-7 lg:h-8 lg:w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:block text-sm font-medium max-w-[120px] truncate">
                  {user?.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-medium leading-snug">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to="/settings" className="flex items-center gap-2.5 cursor-pointer">
                  <UserIcon className="h-4 w-4" /> Profile & Settings
                </NavLink>
              </DropdownMenuItem>

              {/* Theme toggle — mobile only (desktop has dedicated button) */}
              <div className="lg:hidden">
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Theme</DropdownMenuLabel>
                {[
                  { value: 'light' as const, icon: Sun, label: 'Light' },
                  { value: 'dark' as const, icon: Moon, label: 'Dark' },
                  { value: 'system' as const, icon: Monitor, label: 'System' },
                ].map(({ value, icon: Icon, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => setTheme(value)}
                    className={theme === value ? 'bg-accent' : ''}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </DropdownMenuItem>
                ))}
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
