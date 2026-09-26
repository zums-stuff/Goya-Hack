// app/marketplace/page.tsx — Browse con filtros.
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { buildListingsWhere } from '@/lib/listings';
import { ListListingsQuerySchema } from '@/lib/schemas';
import type { Listing } from '@/generated/prisma/client';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function MarketplacePage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const args = ListListingsQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
    ),
  );

  const where = args.success ? buildListingsWhere(args.data) : { status: 'active' };
  const listings: Array<Listing & { seller: { displayName: string; major: string } }> =
    (await prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: args.success ? args.data.limit : 50,
      include: { seller: { select: { displayName: true, major: true } } },
    })) as Array<Listing & { seller: { displayName: string; major: string } }>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <Link href="/create" className="bg-green-600 text-white px-4 py-2 rounded">Publicar</Link>
      </header>

      {/* Filters — UI minimalista para el MVP; los filtros funcionan via searchParams */}
      <form className="flex gap-2 flex-wrap items-end" method="GET">
        <label className="text-sm">
          Buscar:{' '}
          <input
            name="search"
            className="border rounded px-2 py-1"
            defaultValue={sp.search?.toString()}
          />
        </label>
        <label className="text-sm">
          Tipo:{' '}
          <select name="type" className="border rounded px-2 py-1" defaultValue={sp.type?.toString()}>
            <option value="">—</option>
            <option value="libros">Libros</option>
            <option value="calculadoras">Calculadoras</option>
            <option value="electronica">Electrónica</option>
            <option value="batas-uniformes">Batas</option>
            <option value="laboratorio">Laboratorio</option>
            <option value="otros">Otros</option>
          </select>
        </label>
        <label className="text-sm flex items-center gap-1">
          <input
            name="verifiedOnly"
            type="checkbox"
            value="true"
            defaultChecked={sp.verifiedOnly?.toString() === 'true'}
          />
          Verificados
        </label>
        <button className="bg-blue-600 text-white px-3 py-1 rounded">Filtrar</button>
      </form>

      <ul className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {listings.map((l: Listing & { seller: { displayName: string; major: string } }) => (
          <li key={l.id} className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            <Link href={`/marketplace/${l.id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.photoUrl}
                alt={l.title}
                className="w-full aspect-square object-cover"
              />
              <div className="p-3">
                <div className="font-medium line-clamp-1">{l.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {l.seller.displayName} · {l.seller.major}
                </div>
                <div className="text-base font-mono mt-1">
                  {(l.priceXlm / 100).toFixed(2)} XLM
                </div>
                {l.videoVerified && (
                  <span className="inline-block text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mt-1">
                    ✓ video
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {listings.length === 0 && (
        <p className="text-gray-500 text-center py-10">
          No hay listings con esos filtros. Prueba otros.
        </p>
      )}
    </main>
  );
}
