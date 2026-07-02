import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../../shared/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      setUser: (user, token) => set({ user, token, error: null }),
      clearAuth: () => set({ user: null, token: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'offlinedrop_auth',
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);
