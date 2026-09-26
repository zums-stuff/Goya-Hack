// app/(authed)/map/page.tsx — Red de puntos aliados PumaTrade (CDMX demo).
import {
  Building2,
  ChevronRight,
  Clock,
  MapPin,
  ShieldCheck,
  Store,
} from 'lucide-react';
import Link from 'next/link';

type Shop = {
  id: string;
  name: string;
  address: string;
  hours: string;
  status: 'Abierto' | 'Por abrir';
  // Coordenadas relativas (0..100) sobre el canvas de CDMX.
  top: number;
  left: number;
  note?: string;
};

const SHOPS: Shop[] = [
  {
    id: 'cu',
    name: 'PumaTrade CU',
    address: 'Av. Universidad 3000, Coyoacán',
    hours: 'Lun–Vie · 10:00–18:00',
    status: 'Abierto',
    top: 56, // cerca del centro CU
    left: 36,
    note: 'Dentro del campus CU. Pickup en biblioteca central.',
  },
  {
    id: 'copilco',
    name: 'PumaTrade Copilco',
    address: 'Av. Federico T de la Chica 12, Copilco',
    hours: 'Lun–Sáb · 11:00–19:00',
    status: 'Abierto',
    top: 44,
    left: 31,
    note: 'A 12 min caminando de CU. Cafetería aliada.',
  },
  {
    id: 'delvalle',
    name: 'PumaTrade Del Valle',
    address: 'Av. Insurgentes Sur 1234, Del Valle',
    hours: 'Mar–Sáb · 12:00–20:00',
    status: 'Por abrir',
    top: 30,
    left: 50,
    note: 'Próxima apertura. Lista de espera activa.',
  },
];

export default function MapPage() {
  return (
    <section className="map-view">
      <p className="eyebrow">PUNTOS ALIADOS · CDMX</p>
      <h1 style={{ fontSize: 27, letterSpacing: '-1px', margin: '0 0 8px', color: '#26364c' }}>
        Encuentra un punto PumaTrade
      </h1>
      <p className="subcopy">
        Tres puntos aliados en CDMX para ver artículos e intercambiar en persona. Demo con datos
        ficticios pero direcciones reales.
      </p>

      <div className="map-layout" style={{ marginTop: 24 }}>
        {/* Mapa estilizado */}
        <div className="map-canvas" role="img" aria-label="Mapa estilizado CDMX">
          <span className="map-pin-label">CDMX · ZONA SUR</span>

          {/* Pins de tiendas */}
          {SHOPS.map((s) => (
            <div
              key={s.id}
              className="map-pin"
              style={{ top: `${s.top}%`, left: `${s.left}%` }}
            >
              <Store />
              <span>{s.name}</span>
            </div>
          ))}

          {/* Marcadores secundarios — estaciones de metro cercanas */}
          <div
            className="meta-marker"
            style={{
              position: 'absolute',
              top: '62%',
              left: '40%',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#55637b',
              opacity: 0.6,
            }}
            title="Metro Universidad"
          />
          <div
            className="meta-marker"
            style={{
              position: 'absolute',
              top: '20%',
              left: '60%',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#55637b',
              opacity: 0.6,
            }}
            title="Metro Insurgentes Sur"
          />
        </div>

        {/* Lista de tiendas */}
        <div className="shop-list">
          {SHOPS.map((s) => (
            <Link key={s.id} href={`/map#${s.id}`} className="shop-info-row">
              <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 className="w-4 h-4" />
                {s.name}
                <span
                  style={{
                    marginLeft: 'auto',
                    background: s.status === 'Abierto' ? 'var(--mint)' : 'var(--yellow)',
                    color: s.status === 'Abierto' ? '#369671' : '#a17a18',
                  }}
                >
                  {s.status === 'Abierto' ? (
                    <>
                      <ShieldCheck style={{ width: 9, height: 9, display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} />
                      Abierto
                    </>
                  ) : (
                    <>
                      <Clock style={{ width: 9, height: 9, display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} />
                      Por abrir
                    </>
                  )}
                </span>
              </strong>
              <small>
                <MapPin style={{ width: 9, height: 9, display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} />
                {s.address}
              </small>
              <small style={{ color: 'var(--muted)' }}>{s.hours}</small>
              {s.note && (
                <small style={{ color: '#7f8c9d', fontStyle: 'italic' }}>{s.note}</small>
              )}
              <div className="shop-meta">
                <ChevronRight style={{ width: 11, height: 11, color: 'var(--muted)' }} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div
        className="detail-trust"
        style={{
          marginTop: 24,
          background: 'var(--mint)',
          borderColor: '#d8f0e7',
        }}
      >
        <ShieldCheck />
        <span>
          <strong>¿Quieres un punto aliado en tu zona?</strong>
          <small>
            Necesitamos 30 estudiantes activos en la zona para abrir un
            nuevo punto. Sugiere tu campus — los más votados se abren
            primero post-MVP.
          </small>
        </span>
        <button type="button" className="outline-button" disabled>
          Sugerir mi zona
        </button>
      </div>
    </section>
  );
}
