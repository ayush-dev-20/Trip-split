import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, SubscriptionTier } from '@/types';

interface AuthState {
  user: User | null;
  /** true while the /auth/me request is in-flight after a Clerk sign-in */
  isFetchingUser: boolean;

  setUser: (user: User) => void;
  clearUser: () => void;
  setFetchingUser: (v: boolean) => void;
  tier: () => SubscriptionTier;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isFetchingUser: false,

      setUser: (user) => set({ user, isFetchingUser: false }),

      clearUser: () => set({ user: null, isFetchingUser: false }),

      setFetchingUser: (v) => set({ isFetchingUser: v }),

      tier: () => get().user?.tier ?? 'FREE',
    }),
    {
      name: 'tripsplit-user',
      // only persist the user profile; loading flag resets on page load
      partialize: (state) => ({ user: state.user }),
    }
  )
);
