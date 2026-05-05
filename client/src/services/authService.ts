import api from './api';
import type { User } from '@/types';

export const authService = {
  // Fetch our DB user profile (called after Clerk auth succeeds)
  getMe: () =>
    api.get<{ success: boolean; data: User }>('/auth/me').then((r) => r.data.data),

  // Update profile fields stored in our DB
  updateProfile: (
    data: Partial<
      Pick<User, 'name' | 'preferredCurrency' | 'avatarUrl' | 'emailNotifications' | 'pushNotifications' | 'weeklyReport'>
    >
  ) =>
    api.put<{ success: boolean; data: User }>('/auth/profile', data).then((r) => r.data.data),

  // Mark onboarding done + optionally save currency preference
  completeOnboarding: (preferredCurrency?: string) =>
    api
      .put<{ success: boolean; data: User }>('/auth/onboarding', { preferredCurrency })
      .then((r) => r.data.data),
};
