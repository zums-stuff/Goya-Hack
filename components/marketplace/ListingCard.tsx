// components/marketplace/ListingCard.tsx — Tarjeta Wallapop-style con foto.
//
// Foto, título, precio (XLM grande), condición, vendedor. Sin sombras
// pesadas ni rounded extremos — hairline border + rounded-2xl.

import type { SeedListing } from '@/lib/seed-data';
import { fmtXlmShort } from '@/lib/format';

function fmtCondition(c: string): string {
  switch (c) {
    case 'como-nuevo':
      return 'Como nuevo';
    case 'bueno':
      return 'Bueno';
    case 'aceptable':
      return 'Aceptable';
    default:
      return c;
  }
}

export function ListingCard({
  listing,
  sellerName,
}: {
  listing: SeedListing;
  sellerName: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white transition hover:border-black/30">
      {/* Foto */}
      <div className="relative aspect-square w-full bg-[#F1F1F1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.photoUrl}
          alt={listing.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span className="absolute left-2 top-2 rounded bg-[#FFE600] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
          {fmtCondition(listing.condition)}
        </span>
      </div>

      {/* Cuerpo */}
      <div className="p-3">
        <p className="text-2xl font-extrabold leading-tight">
          {fmtXlmShort(listing.priceXlm)}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-black/80">
          {listing.title}
        </p>
        <p className="mt-2 text-xs text-black/50">
          Vendido por <span className="font-medium text-black/70">{sellerName}</span>
        </p>
      </div>
    </div>
  );
}