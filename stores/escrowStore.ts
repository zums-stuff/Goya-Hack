'use client';

import { create } from 'zustand';

export interface Escrow {
  id: string;
  status: string;
  amountXlm: number;
  buyerId: string;
  sellerId: string;
  listingId: string;
  exchangeInitiatorId: string | null;
  confirmWindowExpiresAt: Date | null;
  ttlExpiresAt: Date | null;
  stellarTxHashRelease: string | null;
  stellarMemoReceipt: string | null;
  platformFeeXlm: number;
  createdAt: Date;
}

interface EscrowState {
  byId: Record<string, Escrow>;
  setEscrow: (e: Escrow) => void;
  fetchMine: () => Promise<void>;
}

export const useEscrowStore = create<EscrowState>((set) => ({
  byId: {},
  setEscrow: (e) => set((state) => ({
    byId: { ...state.byId, [e.id]: e }
  })),
  fetchMine: async () => {
    try {
      const res = await fetch('/api/escrow/my');
      if (!res.ok) throw new Error('Error al obtener escrows');
      const data = await res.json();
      
      const newById: Record<string, Escrow> = {};
      data.forEach((escrow: any) => {
        newById[escrow.id] = {
          ...escrow,
          confirmWindowExpiresAt: escrow.confirmWindowExpiresAt ? new Date(escrow.confirmWindowExpiresAt) : null,
          ttlExpiresAt: escrow.ttlExpiresAt ? new Date(escrow.ttlExpiresAt) : null,
          createdAt: new Date(escrow.createdAt),
        };
      });
      
      set({ byId: newById });
    } catch (error) {
      console.error('Error fetching escrows:', error);
    }
  }
}));
