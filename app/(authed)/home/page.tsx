// app/(authed)/home/page.tsx — Vista Inicio.
// Server component. Sin estado cliente: filtros via searchParams (form GET).
import Link from 'next/link';
import {
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  HandHeart,
  Heart,
  ShieldCheck,
  WalletCards,
  X,
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

  const [listings, completed, active, myOffers] = await Promise.all([
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
    prisma.offer.findMany({
      where: { offererId: me.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        listing: {
          select: { id: true, title: true, priceXlm: true, type: true, status: true },
        },
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

      {myOffers.length > 0 && (
        <section className="section-block" style={{ marginTop: 36 }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">ACTIVIDAD · MIS OFERTAS</p>
              <h2>Tus ofertas recientes</h2>
              <p>Las últimas {myOffers.length} que enviaste. Pulsa para ver el listing.</p>
            </div>
          </div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {myOffers.map((o) => {
              const offerTotal =
                (o.xlmAmount ?? 0) +
                (o.offeredItems
                  ? (JSON.parse(o.offeredItems) as Array<{ estimatedValueXlm: number }>).reduce(
                      (a, it) => a + it.estimatedValueXlm,
                      0,
                    )
                  : 0);
              const statusTone =
                o.status === 'pending'
                  ? 'ai-price-signal market'
                  : o.status === 'completed'
                    ? 'ai-price-signal cheap'
                    : o.status === 'rejected' || o.status === 'withdrawn'
                      ? 'ai-price-signal pricey'
                      : 'ai-price-signal market';
              const statusIcon =
                o.status === 'pending'
                  ? <HandHeart />
                  : o.status === 'completed'
                    ? <Check />
                    : o.status === 'rejected' || o.status === 'withdrawn'
                      ? <X />
                      : <HandHeart />;
              return (
                <li key={o.id}>
                  <Link href={`/marketplace/${o.listingId}`} className="offer-card" style={{ display: 'block', padding: 14 }}>
                    <div className="offer-top">
                      <span className={`type-badge ${o.type}`}>
                        {o.type === 'saldo-only' ? 'Solo saldo' : o.type === 'hybrid' ? 'Híbrida' : 'Trueque puro'}
                      </span>
                      {(o.xlmAmount ?? 0) > 0 && (
                        <span className="offer-total">
                          P$ {fmtPrice(offerTotal)}
                        </span>
                      )}
                    </div>
                    <strong style={{ display: 'block', fontSize: 12, marginTop: 8 }}>
                      {o.listing.title}
                    </strong>
                    <p style={{ fontSize: 10, color: '#7f8c9d', marginTop: 4, lineHeight: 1.45 }}>
                      {o.message || <em style={{ opacity: 0.6 }}>(sin mensaje)</em>}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      <span className={statusTone} style={{ marginTop: 0 }}>
                        {statusIcon}
                        {o.status === 'pending'
                          ? 'Esperando respuesta'
                          : o.status === 'completed' || o.status === 'accepted'
                            ? 'Aceptada'
                            : o.status === 'rejected'
                              ? 'Rechazada'
                              : o.status === 'withdrawn'
                                ? 'Retirada'
                                : o.status}
                      </span>
                      <span style={{ fontSize: 9, color: '#94a0b0', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                        ↗ Ver listing
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}
