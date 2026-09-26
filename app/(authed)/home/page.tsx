// app/(authed)/home/page.tsx — Vista Inicio.
// Server component. Sin estado cliente: filtros via searchParams (form GET).
import Link from 'next/link';
import {
  Calculator,
  CheckCircle2,
  ChevronRight,
  Heart,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { buildListingsWhere } from '@/lib/listings';
import { ListListingsQuerySchema } from '@/lib/schemas';
import { fmtPrice } from '@/lib/format';

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

function initials(name: string) {
  const p = name.replace(/\./g, '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}

type SearchParams = Record<string, string | string[] | undefined>;

function picked<T extends string>(sp: SearchParams, key: string, fallback: T, allowed: readonly T[]) {
  const raw = sp[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export default async function HomeView(props: { searchParams: Promise<SearchParams> }) {
  const me = await tryGetUser();
  if (!me) return null; // layout ya redirige; esto contenta TS

  const sp = await props.searchParams;
  const type = picked(sp, 'type', 'Todos', ['Todos', ...['libros', 'calculadoras', 'electronica', 'batas-uniformes', 'laboratorio', 'otros']] as const);
  const major = picked(sp, 'major', 'Todas', ['Todas', 'Ing. en Computación', 'Ing. Eléctrica', 'Matemáticas', 'Física'] as const);
  const search = (Array.isArray(sp.search) ? sp.search[0] : sp.search) ?? '';
  const verifiedOnly = (sp.verifiedOnly?.toString() ?? '') === 'true';

  const args = ListListingsQuerySchema.safeParse({
    type: type === 'Todos' ? undefined : type,
    major: major === 'Todas' ? undefined : major,
    search: search || undefined,
    verifiedOnly,
    limit: 24,
  });
  const where = args.success ? buildListingsWhere(args.data) : { status: 'active' };

  const [listings, completed, active] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { seller: { select: { id: true, displayName: true, major: true } } },
    }),
    prisma.escrow.count({
      where: {
        OR: [{ buyerId: me.id }, { sellerId: me.id }],
        status: 'completed',
      },
    }),
    prisma.escrow.count({
      where: {
        OR: [{ buyerId: me.id }, { sellerId: me.id }],
        status: { in: ['awaiting-funding', 'funded', 'exchange-pending', 'exchange-confirmed', 'disputed'] },
      },
    }),
  ]);

  return (
    <section className="home-view">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">PUMATRADE · UNAM FI</p>
          <h1>
            Qué gusto verte, <span>{me.displayName.split(' ')[0]}</span>
          </h1>
          <p className="subcopy">
            Intercambia materiales universitarios con confianza. Tu dinero
            queda retenido en Stellar hasta que recibas el artículo.
          </p>
        </div>
        <Link href="/create" className="sell-button">
          + Publicar artículo
        </Link>
      </div>

      <div className="balance-grid">
        <div className="balance-card">
          <div className="balance-top">
            <span>Saldo PumaDolar</span>
            <WalletCards />
          </div>
          <div className="balance-amount">P$ {fmtPrice(me.balanceXlm)}</div>
          <div className="balance-footer">
            <span className="positive">
              <ShieldCheck />
              Wallet lista
            </span>
            <Link href="/settings">
              <span>Administrar</span> <ChevronRight />
            </Link>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <span>Compras realizadas</span>
            <strong>{completed}</strong>
            <small>Este semestre</small>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <span>Intercambios activos</span>
            <strong>{active}</strong>
            <small>Todo en orden</small>
          </div>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <h2>Marketplace universitario</h2>
          <p>{listings.length} artículos verificados de tu comunidad</p>
        </div>
        <Link href="/marketplace" className="filter-button">
          Ver todo <ChevronRight />
        </Link>
      </div>

      <form method="GET" className="listing-filters">
        <select name="major" defaultValue={major} aria-label="Filtrar por carrera">
          <option>Todas</option>
          <option>Ing. en Computación</option>
          <option>Ing. Eléctrica</option>
          <option>Matemáticas</option>
          <option>Física</option>
        </select>
        <select name="type" defaultValue={type} aria-label="Filtrar por tipo">
          <option value="Todos">Todos</option>
          <option value="libros">Libros</option>
          <option value="calculadoras">Calculadoras</option>
          <option value="electronica">Electrónica</option>
          <option value="batas-uniformes">Batas y uniformes</option>
          <option value="laboratorio">Laboratorio</option>
        </select>
        <input
          name="search"
          defaultValue={search}
          placeholder="Buscar…"
          aria-label="Buscar"
          className="filter-button"
          style={{ width: 180, fontSize: 11 }}
        />
        <label>
          <input type="checkbox" name="verifiedOnly" value="true" defaultChecked={verifiedOnly} />
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
                <strong>P$ {fmtPrice(l.priceXlm)}</strong>
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
              <small>O publica el primero tú mismo.</small>
            </div>
          </div>
        )}
      </div>

      <div className="trust-banner mt-9">
        <div className="trust-icon">
          <ShieldCheck />
        </div>
        <span>
          <strong>Intercambios protegidos por escrow Stellar</strong>
          <p>
            Tu pago queda retenido hasta que confirmes recibir el artículo.
            Después se libera al vendedor automáticamente.
          </p>
        </span>
        <Link href="/settings">
          Cómo funciona <ChevronRight />
        </Link>
      </div>
    </section>
  );
}
