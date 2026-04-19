import { Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from '@/stores/authStore';

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<GuestRoute><AuthLayout /></GuestRoute>}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Onboarding */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* App Routes */}
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
  );
}
