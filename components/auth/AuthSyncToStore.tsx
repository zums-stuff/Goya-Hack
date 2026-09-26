// components/auth/AuthSyncToStore.tsx — Componente que hidrata el authStore
// en mount del cliente (lee /api/auth/me y guarda en Zustand).
// Lo usamos en /home y /escrow/* para que las páginas tengan user.id sin
// refetch en cada componente cliente.
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

type Me = {
  id: string;
  email: string;
  displayName: string;
  major: string;
  pollarWalletId: string;
  balanceXlm: number;
};

export function AuthSyncToStore({ initialMe }: { initialMe: Me | null }) {
  const setUser = useAuthStore((s) => s.setUser);
  useEffect(() => {
    setUser(initialMe);
  }, [setUser, initialMe]);
  return null;
}
