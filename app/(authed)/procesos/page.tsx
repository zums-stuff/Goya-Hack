// app/(authed)/procesos/page.tsx — Mis procesos (escrows donde soy parte).
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  Coins,
  Hourglass,
  ShieldAlert,
  WalletCards,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { tryGetUser } from '@/lib/auth';
import { fmtXlm, mxnFromCents, xlmMxnRate, fmtMxn } from '@/lib/currency';
// fmtPrice se reemplaza por format con MXN (lib/currency.ts).

const STATUS_LABEL: Record<string, { label: string; tone: 'pending' | 'funded' | 'success' | 'alert' | 'muted'; icon: React.ReactNode }> = {
  'awaiting-funding': {
    label: 'Esperando tu fondeo',
    tone: 'pending',
    icon: <Hourglass />,
  },
  funded: { label: 'Fondeado · coordinando encuentro', tone: 'pending', icon: <Coins /> },
  'exchange-pending': {
    label: 'Una parte registró el intercambio',
    tone: 'alert',
    icon: <ArrowRightLeft />,
  },
  'exchange-confirmed': {
    label: 'Ambas partes confirmaron',
    tone: 'alert',
    icon: <CheckCircle2 />,
  },
  disputed: { label: 'En disputa · revisando admin', tone: 'alert', icon: <ShieldAlert /> },
  completed: { label: 'Completado', tone: 'success', icon: <CheckCircle2 /> },
  released: { label: 'Liberado', tone: 'success', icon: <CheckCircle2 /> },
  'auto-released': {
    label: 'Liberado (auto)',
    tone: 'success',
    icon: <CheckCircle2 />,
  },
  refunded: { label: 'Reembolsado', tone: 'muted', icon: <ArrowLeft /> },
};

export default async function ProcesosPage(props: {
  searchParams: Promise<{ from?: string }>;
}) {
  const me = await tryGetUser();
  if (!me) redirect('/');

  const sp = await props.searchParams;
  const justRecovery = sp.from === 'escrow_missing';

  const escrows = await prisma.escrow.findMany({
    where: { OR: [{ buyerId: me.id }, { sellerId: me.id }] },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      buyer: { select: { id: true, displayName: true } },
      seller: { select: { id: true, displayName: true } },
      listing: { select: { id: true, title: true, priceXlm: true } },
    },
  });
  type EscrowRow = (typeof escrows)[number];

  // Agrupo por estado activo.
  const groups = new Map<
    string,
    { meta: (typeof STATUS_LABEL)[string]; items: EscrowRow[] }
  >();
  for (const e of escrows) {
    const m = STATUS_LABEL[e.status] ?? {
      label: e.status,
      tone: 'muted' as const,
      icon: <ArrowLeft />,
    };
    if (!groups.has(e.status)) groups.set(e.status, { meta: m, items: [] });
    groups.get(e.status)!.items.push(e);
  }

  const rate = await xlmMxnRate();
  const fmt = (cents: number) =>
    `${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM · ≈ ${fmtMxn(mxnFromCents(cents, rate))}`;

  return (
    <section style={{ maxWidth: 920 }}>
      <Link href="/home" className="back-button" style={{ marginBottom: 14 }}>
        <ArrowLeft />
        Volver
      </Link>

      <p className="eyebrow">PROCESOS · PUMATRADE</p>
      <h1 style={{ fontSize: 29, letterSpacing: '-1px', margin: '0 0 8px', color: '#26364c' }}>
        Tus intercambios en curso
      </h1>
      <p className="subcopy">
        Cada escrow donde participas como comprador o vendedor. Pulsa
        cualquiera para ver las acciones disponibles (fondear, confirmar
        intercambio, aceptar, reportar, ver recibo).
      </p>

      {justRecovery && (
        <div
          className="detail-trust"
          style={{
            background: 'var(--yellow)',
            borderColor: '#e9d279',
            color: '#7a5b14',
            marginTop: 18,
          }}
        >
          <AlertCircle />
          <span>
            <strong>Te trajimos de vuelta al inbox</strong>
            <small>
              El escrow que intentaste abrir ya no existe (quizá se cerró o
              se reinició la base). Aquí tienes los procesos activos que
              aún esperan acción tuya.
            </small>
          </span>
        </div>
      )}

      {escrows.length === 0 && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <strong>Sin procesos todavía</strong>
          Acepta una oferta o haz la tuya desde el marketplace. Cuando
          empieces un intercambio aparecerá aquí con el botón "Fondear",
          "Confirmar intercambio" o "Aceptar artículo" según el estado.
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {[...groups.entries()].map(([status, group]) => {
          const toneClass =
            group.meta.tone === 'success'
              ? 'verified'
              : group.meta.tone === 'alert'
                ? 'warning-text'
                : 'ai-price-signal market';
          return (
            <div key={status}>
              <div className="section-heading" style={{ marginBottom: 10 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 4 }}>
                    {group.items.length} {group.items.length === 1 ? 'proceso' : 'procesos'}
                  </p>
                </div>
                <span className={toneClass} style={{ marginTop: 0 }}>
                  {group.meta.icon}
                  {group.meta.label}
                </span>
              </div>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {group.items.map((e) => {
                  const iAmBuyer = e.buyerId === me.id;
                  const counterparty = iAmBuyer ? e.seller.displayName : e.buyer.displayName;
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/escrow/${e.id}`}
                        className="offer-card recommended"
                        style={{ display: 'block', padding: 14 }}
                      >
                        <div className="offer-top">
                          <span className="offer-kind">
                            {iAmBuyer ? 'COMPRADOR' : 'VENDEDOR'} · {counterparty.toUpperCase()}
                          </span>
                          <span className="offer-total">
                            {fmt(e.amountXlm)}
                          </span>
                        </div>
                        <strong
                          style={{
                            display: 'block',
                            fontSize: 12,
                            marginTop: 8,
                            color: 'var(--ink)',
                          }}
                        >
                          {e.listing.title}
                        </strong>
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
                          <span
                            className="ai-price-signal market"
                            style={{ marginTop: 0 }}
                          >
                            <WalletCards />
                            {iAmBuyer
                              ? 'Tu pago retenido'
                              : 'Esperando pago del comprador'}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              color: '#94a0b0',
                              marginLeft: 'auto',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {e.id.slice(0, 8)}… <ChevronRight style={{ width: 10, height: 10, display: 'inline' }} />
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
