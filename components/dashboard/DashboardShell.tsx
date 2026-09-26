// components/dashboard/DashboardShell.tsx — Shell de la app autenticada.
//
// Replica la estructura del frontend example: sidebar + topbar + content.
// Los nav items que no tienen ruta (Asistente / Mapa) son placeholders
// visuales. Solo "Inicio" y "Cerrar sesión" están vivos.
//
// En el content renderizamos el dashboard marketplace: balance grid + 8
// listings reales del seed (sin modal detalle todavía — los cards abren
// las rutas existentes de /marketplace/[id]).
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Bell,
  Bot,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Heart,
  LogOut,
  MapPinned,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { fmtPrice } from '@/lib/format';

export type ListingForCard = {
  id: string;
  title: string;
  type: string;
  category: string;
  priceXlm: number; // centavos
  visual: string;
  sellerDisplayName: string;
  major: string;
  condition: string;
  photoUrl?: string;
};

type Counts = {
  completed: number;
  active: number;
};

type Props = {
  me: {
    id: string;
    displayName: string;
    major: string;
    balanceXlm: number; // centavos
  };
  escrowCounts: Counts;
  listings: ListingForCard[];
};

// Cycle visual classes para el ejemplo (sin imagen).
const VISUALS = ['visual-coral', 'visual-blue', 'visual-yellow', 'visual-purple'];

export function DashboardShell({ me, escrowCounts, listings }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<'Inicio' | 'Asistente IA' | 'Mapa' | 'Mi cuenta'>(
    'Inicio',
  );
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [majorFilter, setMajorFilter] = useState('Todas');

  const filtered = listings.filter(
    (l) =>
      (typeFilter === 'Todos' || l.type === typeFilter) &&
      (majorFilter === 'Todas' || l.major === majorFilter) &&
      (search === '' ||
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.sellerDisplayName.toLowerCase().includes(search.toLowerCase())),
  );

  const initials = (name: string) => {
    const parts = name.replace(/\./g, '').trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
  };

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  const nav: Array<['Inicio' | 'Asistente IA' | 'Mapa' | 'Mi cuenta', typeof Store]> = [
    ['Inicio', Store],
    ['Asistente IA', Bot],
    ['Mapa', MapPinned],
    ['Mi cuenta', UserRound],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/home" className="brand">
          <span className="brand-mark">P</span>
          <span>
            Puma<span className="brand-accent">Trade</span>
          </span>
        </Link>
        <div className="campus-pill">
          <span className="status-dot" />
          UNAM · Facultad de Ingeniería
        </div>
        <nav className="side-nav">
          {nav.map(([name, Icon]) => (
            <button
              type="button"
              key={name}
              className={`nav-item ${active === name ? 'active' : ''}`}
              onClick={() => setActive(name)}
            >
              <Icon />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <ShieldCheck />
            <span>
              <strong>Intercambios protegidos</strong>
              <span>Escrow Stellar con ventana de prueba.</span>
            </span>
          </div>
          <button type="button" className="profile-row" onClick={logout}>
            <div className="avatar">{initials(me.displayName)}</div>
            <div className="profile-copy">
              <strong>{me.displayName}</strong>
              <small>Cerrar sesión</small>
            </div>
            <LogOut />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="top-search">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca libros, calculadoras, electrónica..."
              aria-label="Buscar artículos"
            />
          </div>
          <div className="top-actions">
            <div className="balance-chip">
              <WalletCards />
              <span>P$ {fmtPrice(me.balanceXlm)}</span>
            </div>
            <button type="button" className="icon-button" aria-label="Notificaciones">
              <Bell />
              <span className="notification-dot" />
            </button>
            <div className="top-avatar">{initials(me.displayName)}</div>
          </div>
        </header>

        <div className="content-wrap">
          {active === 'Inicio' && (
            <section className="home-view">
              <div className="welcome-row">
                <div>
                  <p className="eyebrow">PUMATRADE · UNAM FI</p>
                  <h1>
                    Qué gusto verte, <span>{me.displayName.split(' ')[0]}</span>
                  </h1>
                  <p className="subcopy">
                    Intercambia materiales universitarios con confianza.
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
                  <div className="balance-amount">
                    P$ {fmtPrice(me.balanceXlm)}
                  </div>
                  <div className="balance-footer">
                    <span className="positive">
                      <ShieldCheck />
                      Wallet lista
                    </span>
                    <span>Stellar testnet</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div>
                    <span>Compras realizadas</span>
                    <strong>{escrowCounts.completed}</strong>
                    <small>Este semestre</small>
                  </div>
                </div>
                <div className="stat-card">
                  <div>
                    <span>Intercambios activos</span>
                    <strong>{escrowCounts.active}</strong>
                    <small>Todo en orden</small>
                  </div>
                </div>
              </div>

              <div className="section-heading">
                <div>
                  <h2>Marketplace universitario</h2>
                  <p>{listings.length} artículos verificados de tu comunidad</p>
                </div>
                <button type="button" className="filter-button">
                  <ChevronRight />
                  Filtros
                </button>
              </div>

              <div className="listing-filters">
                <select
                  value={majorFilter}
                  onChange={(e) => setMajorFilter(e.target.value)}
                  aria-label="Filtrar por carrera"
                >
                  <option>Todas</option>
                  <option>Ing. en Computación</option>
                  <option>Ing. Eléctrica</option>
                  <option>Matemáticas</option>
                  <option>Física</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  aria-label="Filtrar por tipo"
                >
                  <option>Todos</option>
                  <option value="libros">Libros</option>
                  <option value="calculadoras">Calculadoras</option>
                  <option value="electronica">Electrónica</option>
                  <option value="batas-uniformes">Batas y uniformes</option>
                  <option value="laboratorio">Laboratorio</option>
                </select>
                <label>
                  <input type="checkbox" /> Solo verificados
                </label>
              </div>

              <div className="product-grid">
                {filtered.map((l, i) => (
                  <Link
                    key={l.id}
                    href={`/marketplace/${l.id}`}
                    className="product-card"
                  >
                    <div className={`product-visual ${l.visual}`}>
                      {l.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.photoUrl} alt={l.title} />
                      ) : (
                        <Calculator />
                      )}
                      <button
                        type="button"
                        className="heart-button"
                        aria-label={`Guardar ${l.title}`}
                        onClick={(e) => e.preventDefault()}
                      >
                        <Heart />
                      </button>
                      <span className="condition-tag">{l.condition}</span>
                    </div>
                    <div className="product-info">
                      <span className="product-type">
                        {l.category}
                        <span className="verified">
                          <CheckCircle2 />
                          verificado
                        </span>
                      </span>
                      <h3>{l.title}</h3>
                      <div className="seller-line">
                        <div className="mini-avatar">
                          {initials(l.sellerDisplayName)}
                        </div>
                        {l.sellerDisplayName} · {l.major}
                      </div>
                      <div className="price-row">
                        <strong>P$ {fmtPrice(l.priceXlm)}</strong>
                        <span className="condition-badge">Bueno · verificado</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="trust-banner mt-9">
                <div className="trust-icon">
                  <ShieldCheck />
                </div>
                <span>
                  <strong>Intercambios protegidos por escrow Stellar</strong>
                  <p>
                    Tu pago queda retenido hasta que confirmes recibir el
                    artículo. Después se libera al vendedor automáticamente.
                  </p>
                </span>
                <button type="button">
                  Cómo funciona <ChevronRight />
                </button>
              </div>
            </section>
          )}

          {active === 'Asistente IA' && (
            <section className="assistant-view">
              <p className="eyebrow">PUMATRADE AI</p>
              <h1>Encuentra justo lo que necesitas</h1>
              <p className="subcopy">
                Describe lo que buscas y compararemos calidad, precio y
                confianza.
              </p>
              <div className="chat-panel">
                <div className="chat-head">
                  <span className="ai-avatar">
                    <Bot />
                  </span>
                  <div>
                    <strong>Asistente PumaTrade</strong>
                    <small>En línea · analiza precio y calidad</small>
                  </div>
                </div>
                <div className="chat-messages">
                  <div className="chat-bubble user-bubble">
                    Necesito una calculadora científica para mi clase de
                    circuitos.
                  </div>
                  <div className="chat-bubble ai-bubble">
                    Encontré varias opciones verificadas en tu facultad.
                    Revisa la sección Marketplace, filtrando por tipo
                    "calculadoras".
                  </div>
                </div>
                <div className="chat-composer">
                  <input
                    aria-label="Escribe tu pregunta"
                    placeholder="Ej. Busca un multímetro económico..."
                  />
                  <button aria-label="Enviar">
                    <ChevronRight />
                  </button>
                </div>
              </div>
            </section>
          )}

          {active === 'Mapa' && (
            <section className="map-view">
              <p className="eyebrow">CERCA DE TI</p>
              <h1>Tiendas físicas PumaTrade</h1>
              <p className="subcopy">
                Encuentra un punto aliado para ver artículos e intercambiar en
                persona.
              </p>
              <div className="map-layout">
                <div className="map-canvas">
                  <span className="map-area area-one">CIUDAD UNIVERSITARIA</span>
                  {[
                    { shop: 'PumaTrade CU', dist: '0.6 km', top: 34, left: 27 },
                    { shop: 'PumaTrade Copilco', dist: '1.4 km', top: 53, left: 50 },
                    { shop: 'PumaTrade Del Valle', dist: '3.2 km', top: 72, left: 73 },
                  ].map((p) => (
                    <div
                      key={p.shop}
                      className="map-pin"
                      style={{ top: `${p.top}%`, left: `${p.left}%` }}
                    >
                      <Store />
                      <span>{p.dist}</span>
                    </div>
                  ))}
                </div>
                <div className="shop-list">
                  {[
                    ['PumaTrade CU', 'A 8 min caminando'],
                    ['PumaTrade Copilco', 'A 16 min en bici'],
                    ['PumaTrade Del Valle', 'A 22 min en metro'],
                  ].map(([shop, time]) => (
                    <button type="button" className="shop-row" key={shop}>
                      <Store />
                      <span>
                        <strong>{shop}</strong>
                        <small>{time}</small>
                      </span>
                      <b>·</b>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {active === 'Mi cuenta' && (
            <section className="account-view">
              <p className="eyebrow">MI CUENTA</p>
              <h1>Tu cuenta PumaTrade</h1>
              <p className="subcopy">
                Administra tu saldo, tu perfil y tu wallet Stellar.
              </p>

              <div className="account-grid">
                <div className="balance-card">
                  <div className="balance-top">
                    <span>Saldo disponible</span>
                    <WalletCards />
                  </div>
                  <div className="balance-amount">
                    P$ {fmtPrice(me.balanceXlm)}
                  </div>
                  <div className="balance-footer">
                    <span className="positive">
                      <ShieldCheck />
                      Wallet lista
                    </span>
                    <button>
                      Actualizar <ChevronRight />
                    </button>
                  </div>
                </div>
                <div className="stat-card yellow-bg" style={{ minHeight: 145 }}>
                  <div className="stat-icon yellow-bg">
                    <Calculator />
                  </div>
                  <div>
                    <span>Intercambios del mes</span>
                    <strong>{escrowCounts.completed + escrowCounts.active}</strong>
                    <small>Ver detalle</small>
                  </div>
                </div>
              </div>

              <div className="profile-panel">
                <span className="avatar large-avatar">
                  {initials(me.displayName)}
                </span>
                <div>
                  <h2>{me.displayName}</h2>
                  <p>
                    {me.major} · UNAM · {me.id}
                  </p>
                  <span className="account-verified">
                    <ShieldCheck />
                    Sesión activa
                  </span>
                </div>
                <button type="button" className="outline-button" onClick={logout}>
                  <LogOut />
                  Cerrar sesión
                </button>
              </div>

              <div className="wallet-panel">
                <span>
                  <WalletCards />
                  <strong>{(me.id || '').slice(0, 4)}…wallet</strong>
                  <small>Dirección Stellar (placeholder hasta primer login)</small>
                </span>
                <button type="button" className="outline-button">
                  Ver en Horizon <ChevronRight />
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}