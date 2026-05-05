import { useState } from 'react';
import { Outlet } from 'react-router';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Bottom-nav height is 4rem (h-16). Add equivalent bottom padding on mobile
            so the last card never hides behind the nav bar. Desktop uses its own padding. */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 lg:py-8 pb-24 lg:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation — hidden at lg: and above */}
      <BottomNav />

      <PWAInstallPrompt />
    </div>
  );
}
