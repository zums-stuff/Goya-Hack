// (authed)/assistant/types.ts — Tipos compartidos con /api/assistant.
export type Listing = {
  id: string;
  title: string;
  priceXlm: number;
  type: string;
  condition: string;
  videoVerified: boolean;
  seller: { displayName: string; major: string };
};

export type MarketContext = {
  avgOfferCents: number | null;
  offerCount: number;
  verdict: 'no_reference' | 'fair' | 'cheap' | 'pricey';
};

export type AssistantReply = {
  reply: string;
  listings: Listing[];
  marketContext?: MarketContext;
};
