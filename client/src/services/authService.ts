import api from './api';
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '@/types';

export const authService = {
  register: (data: RegisterPayload) =>
    api.post<{ success: boolean; data: AuthResponse }>('/auth/register', data).then((r) => r.data.data),

  login: (data: LoginPayload) =>
    api.post<{ success: boolean; data: AuthResponse }>('/auth/login', data).then((r) => r.data.data),

  refresh: (refreshToken: string) =>
    api.post<{ success: boolean; data: { accessToken: string } }>('/auth/refresh', { refreshToken }).then((r) => r.data.data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  getMe: () =>
    api.get<{ success: boolean; data: User }>('/auth/me').then((r) => r.data.data),

  updateProfile: (data: Partial<Pick<User, 'name' | 'preferredCurrency' | 'avatarUrl' | 'emailNotifications' | 'pushNotifications' | 'weeklyReport'>>) =>
    api.put<{ success: boolean; data: User }>('/auth/profile', data).then((r) => r.data.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/password', data),

  completeOnboarding: () =>
    api.post<{ success: boolean; message: string }>('/auth/onboarding').then((r) => r.data),

  googleAuth: () => {
    window.location.href = '/api/auth/google';
  },
};
