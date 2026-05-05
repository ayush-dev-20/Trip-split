import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useClerk } from '@clerk/clerk-react';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';

/**
 * Update our DB profile (name, currency, timezone).
 * Clerk manages the actual auth session — this only touches our DB.
 */
export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (user) => setUser(user),
  });
}

/**
 * Mark onboarding complete in our DB then navigate to dashboard.
 */
export function useCompleteOnboarding() {
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (preferredCurrency?: string) =>
      authService.completeOnboarding(preferredCurrency),
    onSuccess: (user) => {
      setUser(user);
      navigate('/dashboard');
    },
  });
}

/**
 * Sign the user out of Clerk and clear local state.
 */
export function useLogout() {
  const { signOut } = useClerk();
  const clearUser = useAuthStore((s) => s.clearUser);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return {
    logout: async () => {
      clearUser();
      queryClient.clear();
      await signOut();
      navigate('/login');
    },
  };
}
