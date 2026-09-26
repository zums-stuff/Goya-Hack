// lib/seed-data.ts — Módulo compartido por prisma/seed.ts (CLI) y
// /api/reset-demo (runtime serverless). Datos puros, sin dependencias de
// runtime Node (ni fs, ni process — válido para ambos mundos).
//
// ⚠️ El primer login real del seed (§9.4 / §13.3) reemplaza el placeholder
// `G_PLACEHOLDER_...` con la wallet real que Pollar devuelve. El bind es
// one-shot (wallet binding rule de §9.4 / §12.1).
//
// Emails: PRD §1 dice `@unam.mx` (perfiles de diseño) — los seed users reales
// del demo entran con `mail.tm`. Usamos los mail.tm en el sembrado para que
// /api/auth/sync encuentre el user pre-creado (mismo email) en el login.
// Saldos: PRD §1 — cada usuario tiene un monto específico (no uniforme).

export type SeedUser = {
  id: string;
  email: string;
  displayName: string;
  major: string;
  bio: string;
  /** centavos de XLM (PRD §1: 1,250 / 2,000 / 800 / 500 / 1,800) */
  balanceXlm: number;
  /** placeholder; se reemplaza al primer login con el G-address real */
  pollarWalletId: string;
};

export type SeedListing = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  /** centavos */
  priceXlm: number;
  type: string;
  /** JSON serializado */
  majors: string;
  condition: string;
  photoUrl: string;
  videoVerified: boolean;
};

export type SeedOffer = {
  id: string;
  listingId: string;
  offererId: string;
  type: 'saldo-only' | 'barter' | 'hybrid';
  /** JSON array [{title, estimatedValueXlm}] (centavos) */
  offeredItems: string | null;
  /** centavos */
  xlmAmount: number | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'completed' | 'rejected' | 'withdrawn';
};

// ─── Users (PRD §1 + §8) ─────────────────────────────────────────────────
export const seedUsers: SeedUser[] = [
  {
    id: 'usr_maria',
    email: 'maria.pumatrade+seed1@mail.tm',
    displayName: 'María R.',
    major: 'Ing. en Computación',
    bio: 'Vendo cosas que ya no uso — calculadora en 5º semestre.',
    balanceXlm: 125_000, // 1,250 XLM
    pollarWalletId: 'G_PLACEHOLDER_usrma',
  },
  {
    id: 'usr_juan',
    email: 'juan.pumatrade+seed1@mail.tm',
    displayName: 'Juan P.',
    major: 'Ing. Eléctrica',
    bio: 'Compro componentes electrónicos. Trueques bienvenidos.',
    balanceXlm: 200_000, // 2,000 XLM
    pollarWalletId: 'G_PLACEHOLDER_usrph',
  },
  {
    id: 'usr_andrea',
    email: 'andrea.pumatrade+seed1@mail.tm',
    displayName: 'Andrea L.',
    major: 'Matemáticas',
    bio: 'Libros de cálculo y física. Trueque puro.',
    balanceXlm: 80_000, // 800 XLM
    pollarWalletId: 'G_PLACEHOLDER_usris',
  },
  {
    id: 'usr_pablo',
    email: 'pablo.pumatrade+seed1@mail.tm',
    displayName: 'Pablo M.',
    major: 'Física',
    bio: 'Nuevo ingreso. Empiezo a vender lo de los semestres anteriores.',
    balanceXlm: 50_000, // 500 XLM
    pollarWalletId: 'G_PLACEHOLDER_usrcv',
  },
  {
    id: 'usr_sofia',
    email: 'sofia.pumatrade+seed1@mail.tm',
    displayName: 'Sofía C.',
    major: 'Ing. en Computación',
    bio: 'Laptop y componentes high-end.',
    balanceXlm: 180_000, // 1,800 XLM
    pollarWalletId: 'G_PLACEHOLDER_usrmf',
  },
];

// ─── Listings (PRD §1 + §8, 10 listings) ──────────────────────────────────
export const seedListings: SeedListing[] = [
  // María — 3
  {
    id: 'lst_ti89',
    sellerId: 'usr_maria',
    title: 'Calculadora TI-89 Titanium',
    description: 'Calculadora gráfica con todas las pilas. Usada 2 semestres. Funciona perfecto.',
    priceXlm: 80_000,
    type: 'calculadoras',
    majors: JSON.stringify(['Ing. en Computación', 'Ing. Eléctrica', 'Ing. Mecánica', 'Matemáticas']),
    condition: 'bueno',
    photoUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400',
    videoVerified: true,
  },
  {
    id: 'lst_fluke',
    sellerId: 'usr_maria',
    title: 'Multímetro Fluke 117',
    description: 'Multímetro digital True RMS. Sin calibrar nuevo. Accesorios incluidos.',
    priceXlm: 120_000,
    type: 'laboratorio',
    majors: JSON.stringify(['Ing. Eléctrica', 'Física']),
    condition: 'como-nuevo',
    photoUrl: 'https://images.unsplash.com/photo-1581092160562-3aa2d2d6d3a4?w=400',
    videoVerified: true,
  },
  {
    id: 'lst_bata_m',
    sellerId: 'usr_maria',
    title: 'Bata blanca talla M',
    description: 'Bata de laboratorio talla M. Sin manchas, cierre OK.',
    priceXlm: 25_000,
    type: 'batas-uniformes',
    majors: JSON.stringify(['Ing. en Computación', 'Biología', 'Química']),
    condition: 'bueno',
    photoUrl: 'https://images.unsplash.com/photo-1581093588401-40c6e7b3d33d?w=400',
    videoVerified: true,
  },
  // Juan — 2
  {
    id: 'lst_arduino',
    sellerId: 'usr_juan',
    title: 'Arduino Mega 2560',
    description: 'Placa original, sin uso. Cable USB incluido.',
    priceXlm: 45_000,
    type: 'electronica',
    majors: JSON.stringify(['Ing. en Computación', 'Ing. Eléctrica', 'Ing. Mecánica']),
    condition: 'como-nuevo',
    photoUrl: 'https://images.unsplash.com/photo-1553406830-20962573d636?w=400',
    videoVerified: true,
  },
  {
    id: 'lst_sadiku',
    sellerId: 'usr_juan',
    title: 'Sadiku — Elementos de electromagnetismo',
    description: '3ra edición. Algunas notas a lápiz.',
    priceXlm: 30_000,
    type: 'libros',
    majors: JSON.stringify(['Ing. Eléctrica', 'Física']),
    condition: 'aceptable',
    photoUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400',
    videoVerified: true,
  },
  // Andrea — 2
  {
    id: 'lst_spivak',
    sellerId: 'usr_andrea',
    title: 'Cálculo de Spivak (3ra ed.)',
    description: 'Edición en español. Sin marcas.',
    priceXlm: 60_000,
    type: 'libros',
    majors: JSON.stringify(['Matemáticas', 'Ing. en Computación']),
    condition: 'como-nuevo',
    photoUrl: 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?w=400',
    videoVerified: true,
  },
  {
    id: 'lst_bata_ch',
    sellerId: 'usr_andrea',
    title: 'Bata blanca talla CH',
    description: 'Talla chica, color blanco. Pocas marcas.',
    priceXlm: 20_000,
    type: 'batas-uniformes',
    majors: JSON.stringify(['Biología', 'Química']),
    condition: 'bueno',
    photoUrl: 'https://images.unsplash.com/photo-1581093588401-fb6cefa9d2cf?w=400',
    videoVerified: true,
  },
  // Pablo — 1
  {
    id: 'lst_tipler',
    sellerId: 'usr_pablo',
    title: 'Tipler — Física Moderna',
    description: 'Libro base de física moderna. Usado un semestre.',
    priceXlm: 35_000,
    type: 'libros',
    majors: JSON.stringify(['Física', 'Ing. Eléctrica']),
    condition: 'bueno',
    photoUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400',
    videoVerified: true,
  },
  // Sofía — 2
  {
    id: 'lst_thinkpad',
    sellerId: 'usr_sofia',
    title: 'Laptop ThinkPad X1 Carbon (i7, 16GB, 2021)',
    description: 'ThinkPad X1 Carbon Gen 9. i7-1165G7, 16GB RAM, 512GB SSD. Batería OK.',
    priceXlm: 850_000,
    type: 'electronica',
    majors: JSON.stringify(['Ing. en Computación', 'Ing. Eléctrica', 'Otra']),
    condition: 'bueno',
    photoUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400',
    videoVerified: true,
  },
  {
    id: 'lst_rpi4',
    sellerId: 'usr_sofia',
    title: 'Raspberry Pi 4 Model B 8GB',
    description: 'RPi 4 con caja, disipadores y fuente oficial.',
    priceXlm: 110_000,
    type: 'electronica',
    majors: JSON.stringify(['Ing. en Computación', 'Ing. Eléctrica', 'Ing. Mecánica']),
    condition: 'como-nuevo',
    photoUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400',
    videoVerified: true,
  },
];

// ─── Offers (PRD §3 — 4 ofertas en el tablero inicial del demo) ────────────
// Caso "María vende TI-89 / Juan ofertante principal".
export const seedOffers: SeedOffer[] = [
  {
    id: 'ofr_pablo_balance',
    listingId: 'lst_ti89',
    offererId: 'usr_pablo',
    type: 'saldo-only',
    offeredItems: null,
    xlmAmount: 75_000, // 750 XLM
    message: 'Me sirve pero no tengo qué ofrecerte a cambio, solo saldo.',
    status: 'pending',
  },
  {
    id: 'ofr_juan_hybrid',
    listingId: 'lst_ti89',
    offererId: 'usr_juan',
    type: 'hybrid',
    offeredItems: JSON.stringify([
      { title: 'Arduino Mega 2560', estimatedValueXlm: 45_000 },
    ]),
    xlmAmount: 30_000, // 300 XLM (total: 750 XLM = 80% del precio)
    message: 'Te ofrezco el Arduino + 300 XLM. Llegamos почти.',
    status: 'pending',
  },
  {
    id: 'ofr_andrea_pure_barter',
    listingId: 'lst_ti89',
    offererId: 'usr_andrea',
    type: 'barter',
    offeredItems: JSON.stringify([
      { title: 'Cálculo de Spivak (3ra ed.)', estimatedValueXlm: 60_000 },
    ]),
    xlmAmount: null,
    message: 'Mi Spivak por tu TI-89 — falta diferencia, ¿aceptas?',
    status: 'pending',
  },
  {
    id: 'ofr_juan_balance_laptop',
    listingId: 'lst_thinkpad',
    offererId: 'usr_juan',
    type: 'saldo-only',
    offeredItems: null,
    xlmAmount: 600_000, // 6,000 XLM (70% del precio)
    message: 'Por ahora no me alcanza para el total pero arranco con 6k.',
    status: 'pending',
  },
];
