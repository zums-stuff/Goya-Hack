// app/(authed)/marketplace/page.tsx — Browse completo con filtros del example.
import Link from 'next/link';
import { ChevronRight, Calculator, CheckCircle2, Heart } from 'lucide-react';
import { prisma } from '@/lib/db';
import { buildListingsWhere } from '@/lib/listings';
import { ListListingsQuerySchema } from '@/lib/schemas';
import { fmtXlm, mxnFromCents, xlmMxnRate, fmtMxn } from '@/lib/currency';

const VISUALS = ['visual-coral', 'visual-blue', 'visual-yellow', 'visual-purple'];

function categoryLabel(type: string) {
  const labels: Record<string, string> = {
    libros: 'LIBROS',
    calculadoras: 'CALCULADORAS',
    electronica: 'ELECTRÓNICA',
    'batas-uniformes': 'BATAS Y UNIFORMES',
    laboratorio: 'LABORATORIO',
  };
  return labels[type] ?? type.toUpperCase();
}

function initials(name: string) {
  const p = name.replace(/\./g, '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function MarketplacePage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const args = ListListingsQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
    ),
  );

  const where = args.success ? buildListingsWhere(args.data) : { status: 'active' };
  const listings = await prisma.listing.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: args.success ? args.data.limit : 50,
    include: { seller: { select: { displayName: true, major: true } } },
  });

  const rate = await xlmMxnRate();
  const fmt = (cents: number) =>
    `${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM · ≈ ${fmtMxn(mxnFromCents(cents, rate))}`;

  return (
    <section className="marketplace-view">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">MARKETPLACE · UNAM FI</p>
          <h1>Explora el marketplace</h1>
          <p className="subcopy">
            {listings.length} artículos disponibles. Filtra por carrera o tipo.
          </p>
        </div>
        <Link href="/create" className="sell-button">
          + Publicar artículo
        </Link>
      </div>

      <form method="GET" className="listing-filters" style={{ margin: '0 0 22px' }}>
        <input
          name="search"
          defaultValue={Array.isArray(sp.search) ? sp.search[0] : sp.search ?? ''}
          placeholder="Buscar…"
          className="filter-button"
          style={{ width: 220, fontSize: 11 }}
          aria-label="Buscar"
        />
        <select
          name="type"
          defaultValue={(Array.isArray(sp.type) ? sp.type[0] : sp.type ?? '')}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          <option value="libros">Libros</option>
          <option value="calculadoras">Calculadoras</option>
          <option value="electronica">Electrónica</option>
          <option value="batas-uniformes">Batas y uniformes</option>
          <option value="laboratorio">Laboratorio</option>
          <option value="otros">Otros</option>
        </select>
        <select
          name="major"
          defaultValue={(Array.isArray(sp.major) ? sp.major[0] : sp.major ?? '')}
          aria-label="Filtrar por carrera"
        >
          <option value="">Todas las carreras</option>
          <option>Ing. en Computación</option>
          <option>Ing. Eléctrica</option>
          <option>Matemáticas</option>
          <option>Física</option>
        </select>
        <label>
          <input
            type="checkbox"
            name="verifiedOnly"
            value="true"
            defaultChecked={(Array.isArray(sp.verifiedOnly) ? (sp.verifiedOnly[0] ?? '') : (sp.verifiedOnly ?? '')).toString() === 'true'}
          />
          Solo verificados
        </label>
        <button type="submit" className="sell-button" style={{ padding: '8px 12px', fontSize: 10 }}>
          Filtrar
        </button>
      </form>

      <div className="product-grid">
        {listings.map((l, i) => (
          <Link key={l.id} href={`/marketplace/${l.id}`} className="product-card">
            <div className={`product-visual ${VISUALS[i % VISUALS.length]}`}>
              {l.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={l.photoUrl} alt={l.title} />
              ) : (
                <Calculator />
              )}
              <span
                className="heart-button"
                aria-label={`Guardar ${l.title}`}
              >
                <Heart />
              </span>
              <span className="condition-tag">{l.condition}</span>
            </div>
            <div className="product-info">
              <span className="product-type">
                {categoryLabel(l.type)}
                {l.videoVerified ? (
                  <span className="verified">
                    <CheckCircle2 />
                    verificado
                  </span>
                ) : null}
              </span>
              <h3>{l.title}</h3>
              <div className="seller-line">
                <div className="mini-avatar">{initials(l.seller.displayName)}</div>
                {l.seller.displayName} · {l.seller.major}
              </div>
              <div className="price-row">
                <strong>{fmt(l.priceXlm)}</strong>
                <span className="condition-badge">
                  {l.condition === 'como-nuevo' ? 'Como nuevo' : l.condition === 'aceptable' ? 'Aceptable' : 'Bueno'}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {listings.length === 0 && (
          <div
            className="stat-card"
            style={{ gridColumn: '1 / -1', minHeight: 110, justifyContent: 'center' }}
          >
            <div>
              <span>Sin resultados</span>
              <strong>Prueba otros filtros</strong>
              <small>O publica el primero tú mismo. <Link href="/create">+ Publicar artículo</Link></small>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <Link href="/home" className="filter-button">
          Volver a Inicio <ChevronRight />
        </Link>
      </div>
    </section>
  );
}
