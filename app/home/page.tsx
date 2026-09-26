// app/home/page.tsx — Dashboard autenticado.
//
// Misma arquitectura del frontend example: sidebar + topbar + content
// con vistas Inicio / Asistente IA / Mapa / Mi cuenta. Los datos reales
// (user, escrows, listings) se cargan en el server y se pasan al cliente.
import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { seedUsers } from '@/lib/seed-data';
import {
  DashboardShell,
  type ListingForCard,
} from '@/components/dashboard/DashboardShell';

const VISUALS = ['visual-coral', 'visual-blue', 'visual-yellow', 'visual-purple'];

function categoryLabel(type: string): string {
  const labels: Record<string, string> = {
    libros: 'LIBROS',
    calculadoras: 'CALCULADORAS',
    electronica: 'ELECTRÓNICA',
    'batas-uniformes': 'BATAS Y UNIFORMES',
    laboratorio: 'LABORATORIO',
  };
  return labels[type] ?? type.toUpperCase();
}

export default async function HomeDashboardPage() {
  const user = await tryGetUser();
  if (!user) redirect('/');

  // Listings reales del seed (10). Los visual-coral/-blue/etc. los elige
  // el cliente por índice en DashboardShell.
  const realListings = await prisma.listing.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      seller: { select: { id: true, displayName: true, major: true } },
    },
  });

  // Filtra para mostrar solo los 5 seeds que existen en DB (por si la DB
  // tiene listings de otros sellers); igualmente aplica el visual cycle.
  const knownSellerIds = new Set(seedUsers.map((u) => u.id));
  const listings: ListingForCard[] = realListings
    .filter((l) => knownSellerIds.has(l.sellerId) || knownSellerIds.size === 0)
    .slice(0, 8)
    .map((l, i) => ({
      id: l.id,
      title: l.title,
      type: l.type,
      category: categoryLabel(l.type),
      priceXlm: l.priceXlm,
      visual: VISUALS[i % VISUALS.length] ?? VISUALS[0]!,
      sellerDisplayName: l.seller.displayName,
      major: l.seller.major,
      condition: 'Bueno',
      photoUrl: l.photoUrl ?? undefined,
    }));

  const [completed, active] = await Promise.all([
    prisma.escrow.count({ where: { OR: [{ buyerId: user.id }, { sellerId: user.id }], status: 'completed' } }),
    prisma.escrow.count({ where: { OR: [{ buyerId: user.id }, { sellerId: user.id }], status: { in: ['awaiting-funding', 'funded', 'exchange-pending', 'exchange-confirmed', 'disputed'] } } }),
  ]);

  return (
    <DashboardShell
      me={{
        id: user.id,
        displayName: user.displayName,
        major: user.major,
        balanceXlm: user.balanceXlm,
      }}
      escrowCounts={{ completed, active }}
      listings={listings}
    />
  );
}
