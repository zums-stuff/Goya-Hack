// components/auth/WalletHeader.tsx — Wallet nativa de Pollar para el header del home.
// Muestra el botón de wallet (dirección abreviada → dropdown con saldo, send,
// historial, sesiones y logout) en vez de un saldo renderizado a mano.
'use client';

import { WalletButton } from '@pollar/react';

export function WalletHeader() {
  return <WalletButton />;
}