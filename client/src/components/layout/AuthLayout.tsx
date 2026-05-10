import { Outlet } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import logoDark from '@/assets/logo/tripsplit-dark-64.svg';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden text-white flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-700 to-blue-900" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.3) 0%, transparent 40%)',
        }} />

        <div className="relative flex items-center gap-3">
          <img src={logoDark} alt="TripSplit" className="h-9 w-9" />
          <span className="text-2xl font-bold tracking-tight">TripSplit</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
            Split expenses.<br />
            Not friendships.
          </h1>
          <p className="text-lg text-white/85 max-w-md leading-relaxed">
            Track, split, and settle trip expenses effortlessly with AI-powered insights and real-time collaboration.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { label: 'Smart Splits', value: '4 types' },
              { label: 'AI Features', value: '8 tools' },
              { label: 'Analytics', value: 'Real-time' },
            ].map((stat) => (
              <Card key={stat.label} className="bg-white/10 backdrop-blur-md border-white/20 text-white shadow-none">
                <CardContent className="p-4">
                  <div className="text-xl font-bold">{stat.value}</div>
                  <div className="text-xs text-white/75 mt-0.5">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} TripSplit. All rights reserved.</p>
      </div>

      {/* Right — auth form */}
      <div className="flex flex-1 items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
