import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from '@clerk/clerk-react';
import { registerClerkGetToken } from '@/lib/clerkHelper';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';

// Layouts
import AppLayout from '@/components/layout/AppLayout';
import AuthLayout from '@/components/layout/AuthLayout';

// Auth Pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import OnboardingPage from '@/pages/auth/OnboardingPage';

// App Pages
import DashboardPage from '@/pages/DashboardPage';
import TripsPage from '@/pages/trips/TripsPage';
import TripDetailPage from '@/pages/trips/TripDetailPage';
import CreateTripPage from '@/pages/trips/CreateTripPage';
import EditTripPage from '@/pages/trips/EditTripPage';
import GroupsPage from '@/pages/groups/GroupsPage';
import GroupDetailPage from '@/pages/groups/GroupDetailPage';
import ExpensesPage from '@/pages/expenses/ExpensesPage';
import CreateExpensePage from '@/pages/expenses/CreateExpensePage';
import ExpenseDetailPage from '@/pages/expenses/ExpenseDetailPage';
import SettlementsPage from '@/pages/settlements/SettlementsPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import AIAssistantPage from '@/pages/ai/AIAssistantPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import BillingPage from '@/pages/settings/BillingPage';
import NotFoundPage from '@/pages/NotFoundPage';
import NotesPage from '@/pages/trips/NotesPage';

// ──────────────────────────────────
// Auth Sync — keeps Clerk + DB user in sync on every session change
// ──────────────────────────────────

function AuthSync() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { setUser, clearUser, setFetchingUser } = useAuthStore();

  // Register Clerk's getToken so the axios interceptor can use it outside React
  useEffect(() => {
    registerClerkGetToken(() => getToken());
  }, [getToken]);

  // Sync our DB user whenever Clerk session state changes
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      setFetchingUser(true);
      authService
        .getMe()
        .then(setUser)
        .catch(() => clearUser());
    } else {
      clearUser();
    }
  }, [isSignedIn, isLoaded, setUser, clearUser, setFetchingUser]);

  return null;
}

// ──────────────────────────────────
// Route Guards
// ──────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const user = useAuthStore((s) => s.user);
  const isFetchingUser = useAuthStore((s) => s.isFetchingUser);

  // Clerk still initialising, DB user fetch in-flight, or signed in but user not yet loaded
  if (!isLoaded || isFetchingUser || (isSignedIn && !user)) return null;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  // Onboarding gate: signed in but hasn't finished setup
  if (!user?.onboardingDone) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ──────────────────────────────────
// App Router
// ──────────────────────────────────

export default function App() {
  return (
    <>
      <AuthSync />

      <Routes>
        {/* Auth Routes — only for signed-out users */}
        <Route element={<GuestRoute><AuthLayout /></GuestRoute>}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Onboarding — signed-in but not yet onboarded */}
        <Route
          path="/onboarding"
          element={
            <OnboardingPage />
          }
        />

        {/* App Routes — fully authenticated */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Trips */}
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/new" element={<CreateTripPage />} />
          <Route path="/trips/:tripId" element={<TripDetailPage />} />
          <Route path="/trips/:tripId/edit" element={<EditTripPage />} />

          {/* Groups */}
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />

          {/* Expenses (trip-scoped) */}
          <Route path="/trips/:tripId/expenses" element={<ExpensesPage />} />
          <Route path="/trips/:tripId/expenses/new" element={<CreateExpensePage />} />
          <Route path="/trips/:tripId/expenses/:expenseId" element={<ExpenseDetailPage />} />

          {/* Settlements */}
          <Route path="/trips/:tripId/settlements" element={<SettlementsPage />} />

          {/* Notes */}
          <Route path="/trips/:tripId/notes" element={<NotesPage />} />

          {/* Analytics */}
          <Route path="/analytics" element={<AnalyticsPage />} />

          {/* AI */}
          <Route path="/ai" element={<AIAssistantPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/billing" element={<BillingPage />} />
        </Route>

        {/* Redirects & 404 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
