import { Outlet } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import logoDark from '@/assets/logo/tripsplit-dark-64.svg';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <img src={logoDark} alt="TripSplit" className="h-9 w-9" />
          <span className="text-2xl font-bold tracking-tight">TripSplit</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Split expenses.<br />
            Not friendships.
          </h1>
          <p className="text-lg text-white/80 max-w-md">
            Track, split, and settle trip expenses effortlessly with AI-powered insights and real-time collaboration.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { label: 'Smart Splits', value: '4 types' },
              { label: 'AI Features', value: '8 tools' },
              { label: 'Analytics', value: 'Real-time' },
            ].map((stat) => (
              <Card key={stat.label} className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <p className="text-sm text-white/50">© {new Date().getFullYear()} TripSplit. All rights reserved.</p>
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
