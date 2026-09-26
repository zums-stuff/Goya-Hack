// app/(authed)/map/page.tsx — Red de puntos aliados PumaTrade (CDMX demo).
// Dibuja el mapa como SVG con zonas CDMX reales y 3 tiendas posicionadas
// por coords aproximadas.
import Link from 'next/link';
import {
  Building2,
  ChevronRight,
  Clock,
  MapPin,
  ShieldCheck,
  Store,
} from 'lucide-react';

type Zone = {
  id: string;
  name: string;
  // Polygon coords en viewBox 0 0 800 480.
  points: string;
};

type Shop = {
  id: string;
  name: string;
  address: string;
  hours: string;
  status: 'Abierto' | 'Por abrir';
  zone: string;
  // Coordenadas en viewBox 0 0 800 480.
  cx: number;
  cy: number;
  note?: string;
};

const ZONES: Zone[] = [
  // Cinco zonas CDMX aproximadas: Polanco, Roma, Condesa, Coyoacán, Del Valle.
  { id: 'polanco', name: 'POLANCO', points: '120,30 260,30 280,90 220,130 130,110 90,80' },
  { id: 'roma', name: 'ROMA', points: '260,160 360,150 380,250 350,310 270,310 260,220' },
  { id: 'condesa', name: 'CONDESA', points: '210,210 260,210 260,290 200,290 195,235' },
  { id: 'coyaucan', name: 'COYOACÁN', points: '370,330 470,310 500,400 380,420 350,360' },
  { id: 'delvalle', name: 'DEL VALLE', points: '440,210 520,200 540,280 460,290 440,250' },
  { id: 'copilco', name: 'COPILCO', points: '300,290 380,290 380,340 290,340' },
];

const SHOPS: Shop[] = [
  {
    id: 'cu',
    name: 'PumaTrade CU',
    address: 'Av. Universidad 3000, Coyoacán',
    hours: 'Lun–Vie · 10:00–18:00',
    status: 'Abierto',
    zone: 'COYOACÁN',
    cx: 420,
    cy: 380,
    note: 'Dentro del campus CU. Pickup en biblioteca central.',
  },
  {
    id: 'copilco',
    name: 'PumaTrade Copilco',
    address: 'Av. Federico T de la Chica 12, Copilco',
    hours: 'Lun–Sáb · 11:00–19:00',
    status: 'Abierto',
    zone: 'COPILCO',
    cx: 320,
    cy: 310,
    note: '12 min caminando de CU. Cafetería aliada.',
  },
  {
    id: 'delvalle',
    name: 'PumaTrade Del Valle',
    address: 'Av. Insurgentes Sur 1234, Del Valle',
    hours: 'Mar–Sáb · 12:00–20:00',
    status: 'Por abrir',
    zone: 'DEL VALLE',
    cx: 480,
    cy: 245,
    note: 'Próxima apertura. Lista de espera activa.',
  },
];

export default function MapPage() {
  return (
    <section className="map-view">
      <p className="eyebrow">PUNTOS ALIADOS · CDMX</p>
      <h1 style={{ fontSize: 27, letterSpacing: '-1px', margin: '0 0 8px', color: '#26364c' }}>
        Red de pickup points PumaTrade
      </h1>
      <p className="subcopy">
        Mapa de CDMX con 3 puntos aliados. Los púlsares marcan tiendas
        físicas donde puedes ver un artículo antes de aceptar el escrow.
      </p>

      <div className="map-layout" style={{ marginTop: 24 }}>
        {/* Mapa SVG */}
        <div className="map-canvas" role="img" aria-label="Mapa CDMX">
          <svg
            viewBox="0 0 800 480"
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            role="presentation"
          >
            {/* Fondo de la ciudad (verdoso sobre beige) */}
            <defs>
              <pattern
                id="streets"
                width="50"
                height="50"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="1.5"
                />
              </pattern>
              <linearGradient id="citybg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e9f5f0" />
                <stop offset="1" stopColor="#f5f7ed" />
              </linearGradient>
              <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                <feOffset dx="0" dy="2" result="offsetblur" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.35" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width="800" height="480" fill="url(#citybg)" />
            <rect width="800" height="480" fill="url(#streets)" />

            {/* Zonas CDMX (rectángulos orgánicos) */}
            {ZONES.map((z) => (
              <g key={z.id}>
                <polygon
                  points={z.points}
                  fill="rgba(190, 215, 235, 0.45)"
                  stroke="rgba(150, 175, 195, 0.8)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  filter="url(#softShadow)"
                />
                <text
                  x={centroid(z.points).x}
                  y={centroid(z.points).y}
                  fontSize="9"
                  fontWeight="800"
                  textAnchor="middle"
                  fill="#5a7488"
                  letterSpacing="1.1"
                >
                  {z.name}
                </text>
              </g>
            ))}

            {/* Corredores visuales (calles principales) */}
            <line
              x1="80"
              y1="220"
              x2="720"
              y2="260"
              stroke="#a8c4d8"
              strokeWidth="2.5"
              opacity="0.7"
            />
            <line
              x1="380"
              y1="60"
              x2="420"
              y2="460"
              stroke="#a8c4d8"
              strokeWidth="2.5"
              opacity="0.55"
            />

            {/* Pins de tiendas */}
            {SHOPS.map((s) => (
              <g key={s.id} transform={`translate(${s.cx}, ${s.cy})`}>
                <circle
                  r="22"
                  fill="rgba(238, 112, 93, 0.18)"
                />
                <circle
                  r="11"
                  fill="#ee705d"
                  stroke="#fff"
                  strokeWidth="2"
                  filter="url(#softShadow)"
                />
                <path
                  d="M -8 8 L 0 16 L 8 8 Z"
                  fill="#ee705d"
                  stroke="#fff"
                  strokeWidth="1.5"
                  filter="url(#softShadow)"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="900"
                  fill="#fff"
                  fontFamily="sans-serif"
                >
                  P
                </text>
                <text
                  x="0"
                  y="34"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="800"
                  fill="#26364c"
                  style={{ paintOrder: 'stroke' }}
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinejoin="round"
                >
                  {shortName(s.name)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Lista lateral */}
        <div className="shop-list">
          {SHOPS.map((s) => (
            <Link key={s.id} href={`#${s.id}`} className="shop-info-row">
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
                      <ShieldCheck
                        style={{
                          width: 9,
                          height: 9,
                          display: 'inline',
                          marginRight: 3,
                          verticalAlign: 'text-bottom',
                        }}
                      />
                      Abierto
                    </>
                  ) : (
                    <>
                      <Clock
                        style={{
                          width: 9,
                          height: 9,
                          display: 'inline',
                          marginRight: 3,
                          verticalAlign: 'text-bottom',
                        }}
                      />
                      Por abrir
                    </>
                  )}
                </span>
              </strong>
              <small>
                <MapPin
                  style={{
                    width: 9,
                    height: 9,
                    display: 'inline',
                    marginRight: 3,
                    verticalAlign: 'text-bottom',
                  }}
                />
                {s.address}
              </small>
              <small style={{ color: 'var(--muted)' }}>{s.hours}</small>
              {s.note && (
                <small style={{ color: '#7f8c9d', fontStyle: 'italic' }}>{s.note}</small>
              )}
              <div className="shop-meta">
                <ChevronRight
                  style={{ width: 11, height: 11, color: 'var(--muted)' }}
                />
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
            Sugiere tu campus — los más votados se abren primero post-MVP.
          </small>
        </span>
        <button type="button" className="outline-button" disabled>
          Sugerir mi zona
        </button>
      </div>

      <p
        className="subcopy"
        style={{ marginTop: 20, fontSize: 10, color: '#94a0b0', textAlign: 'center' }}
      >
        Mapa dibujado como SVG estilizado — las coordenadas son
        aproximadas para fines de demo. Producción usaría Mapbox tiles o
        Google Maps embebido.
      </p>
    </section>
  );
}

function centroid(points: string): { x: number; y: number } {
  const pairs = points.trim().split(/\s+/).map((p) => p.split(',').map(Number));
  const x =
    pairs.reduce((a, pair) => a + (pair[0] ?? 0), 0) / Math.max(pairs.length, 1);
  const y =
    pairs.reduce((a, pair) => a + (pair[1] ?? 0), 0) / Math.max(pairs.length, 1);
  return { x, y };
}

function shortName(name: string): string {
  return name.replace(/PumaTrade\s+/, '');
}
