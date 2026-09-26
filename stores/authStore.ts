// stores/authStore.ts — Zustand store para el usuario actual.
// El servidor es la fuente de verdad (cookie HMAC → DB); el cliente
// hace fetch a /api/auth/me en mount y lo cachea aquí.
'use client';

import { create } from 'zustand';

export type AuthSnapshot = {
  user: {
    id: string;
    email: string;
    displayName: string;
    major: string;
    pollarWalletId: string;
    balanceXlm: number;
  } | null;
};

type Actions = {
  setUser: (user: AuthSnapshot['user']) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthSnapshot & Actions>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));
