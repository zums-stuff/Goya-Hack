// lib/schemas.ts — Validación Zod de TODOS los inputs de API + tipos derivados.
// Regla: cada route importa su schema de aquí y hace schema.parse() una sola vez.

import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────
export const ListingTypeSchema = z.enum([
  'libros',
  'calculadoras',
  'electronica',
  'batas-uniformes',
  'laboratorio',
  'otros',
]);
export type ListingType = z.infer<typeof ListingTypeSchema>;

export const MajorSchema = z.enum([
  'Ing. en Computación',
  'Ing. Eléctrica',
  'Ing. Mecánica',
  'Matemáticas',
  'Física',
  'Química',
  'Biología',
  'Otra',
]);
export type Major = z.infer<typeof MajorSchema>;

export const ConditionSchema = z.enum(['nuevo', 'como-nuevo', 'bueno', 'aceptable']);
export const OfferTypeSchema = z.enum(['saldo-only', 'barter', 'hybrid']);
export const DisputeReasonSchema = z.enum([
  'item-damaged',
  'exchange-never-happened',
  'item-different',
]);

// ─── Listings ────────────────────────────────────────────────────────────
export const CreateListingSchema = z.object({
  title: z.string().min(5).max(80),
  description: z.string().min(20).max(500),
  priceXlm: z.number().int().positive().max(50_000_000), // max 500k XLM
  type: ListingTypeSchema,
  majors: z.array(MajorSchema).min(1),
  condition: ConditionSchema,
  photoUrl: z.string().url(),
  videoVerified: z.boolean(),
});
export type CreateListingInput = z.infer<typeof CreateListingSchema>;

export const ListListingsQuerySchema = z.object({
  type: ListingTypeSchema.optional(),
  major: MajorSchema.optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  search: z.string().max(80).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// ─── Offers ──────────────────────────────────────────────────────────────
// Schema + refine semántico: barter NO debe traer xlmAmount (cierra M1 de §12.7).
export const CreateOfferSchema = z
  .object({
    listingId: z.string().min(1),
    type: OfferTypeSchema,
    offeredItems: z
      .array(
        z.object({
          title: z.string().min(1).max(80),
          estimatedValueXlm: z.number().int().positive(), // centavos
        }),
      )
      .optional(),
    xlmAmount: z.number().int().min(0).optional(), // centavos
    message: z.string().max(280).optional(),
  })
  .refine(
    (d) => {
      if (d.type === 'barter') return d.xlmAmount === undefined;
      if (d.type === 'saldo-only') return typeof d.xlmAmount === 'number' && d.xlmAmount > 0;
      if (d.type === 'hybrid')
        return typeof d.xlmAmount === 'number' && d.xlmAmount > 0;
      return true;
    },
    {
      message:
        'Reglas semánticas: barter NO debe traer xlmAmount; saldo-only/hybrid requieren xlmAmount > 0',
    },
  )
  .refine(
    (d) => (d.type === 'barter' || d.type === 'hybrid') ? Array.isArray(d.offeredItems) && d.offeredItems.length >= 1 : true,
    { message: 'barter e hybrid requieren al menos 1 offeredItems' },
  );
export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;

export const UpdateOfferSchema = z.object({
  status: z.enum(['withdrawn', 'rejected']),
});

// ─── Escrow transitions ───────────────────────────────────────────────────
export const RecordExchangeSchema = z.object({ escrowId: z.string().min(1) });
export const ConfirmExchangeSchema = z.object({ escrowId: z.string().min(1) });
export const AcceptSchema = z.object({ escrowId: z.string().min(1) });
export const CancelSchema = z.object({ escrowId: z.string().min(1) });
export const AcceptOfferSchema = z.object({ offerId: z.string().min(1) });
export const FundSchema = z.object({ escrowId: z.string().min(1) });

// ─── Dispute (multipart — el file se valida aparte en lib/evidence-storage) ──
export const DisputeFormSchema = z.object({
  escrowId: z.string().min(1),
  reason: DisputeReasonSchema,
  description: z.string().min(10).max(500),
});

// ─── Chat (Message) ─────────────────────────────────────────────────────
export const MessageScopeSchema = z.enum(['listing', 'escrow']);
export type MessageScope = z.infer<typeof MessageScopeSchema>;

export const SendMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

// ─── Auth (dev only) ──────────────────────────────────────────────────────
export const DevLoginSchema = z.object({
  email: z.string().email(),
});
export const AuthSyncSchema = z.object({
  pollarWalletId: z.string().regex(/^G[A-Z0-9]{55}$/),
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
});

// ─── Price alert (PRD §5) ─────────────────────────────────────────────────
export const PriceAlertSchema = z.object({
  title: z.string().min(1).max(80),
  type: ListingTypeSchema,
  price: z.number().int().positive(), // centavos
});
