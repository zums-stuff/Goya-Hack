// components/map/StoresMap.tsx — Real interactive map for the /map tab.
//
// Implementation notes:
//   - Free OpenStreetMap tiles via react-leaflet 5.0 + leaflet 1.9.
//     No API key, no billing, no setup. Tiles served from
//     https://tile.openstreetmap.org/{z}/{x}/{y}.png (OSM usage policy
//     applies: identify user-agent + reasonable load).
//   - Centro del mapa: Ciudad Universitaria, UNAM (approx.
//     19.3247, -99.1778). Sample POIs are drawn within walking distance
//     of CU so they're plausibly nearby for any student signed in with
//     a UNAM-domain email. The hardcoded coords are *near* real UNAM
//     landmarks: "Librería UNAM" is on the campus; "Café Typo" and
//     "Biblioteca Central" are well-known spots.
//   - The /map page used to ship a hand-drawn SVG with 3 fake "Gremium
//     pickup points" — those didn't represent anything real (we have
//     no physical stores). This is the replacement: real interactive
//     OSM tiles + curated nearby store list.
//
// All <Marker> & <Popup> children here must explicitly opt out of
// react-leaflet's `<Map>` children pattern -- that's automatic for
// named exports `Marker`, `Popup`, `TileLayer`, `MapContainer`.

'use client';

// Leaflet's stylesheet ships CSS variables for z-index + popup layouts.
// We import it as a side-effect so React app and the leaflet canvas
// agree on z-stacking inside the dashboard's AppShell.
import 'leaflet/dist/leaflet.css';

import { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  BookOpen,
  Building2,
  Coffee,
  Copy,
  MapPin,
  Pill,
  Plug,
  ShieldCheck,
  ShoppingBag,
  Wrench,
} from 'lucide-react';

// react-leaflet ships its own Marker icons from /images/marker-icon.png,
// but we want a thin monochrome pin in the Gremium coral.  We override
// with a data-URL SVG so we don't need a public asset. The trick is the
// hack where divIcon HTML IS the pin; L.divIcon is the right primitive.
function coralPin(color = '#ee705d') {
  return L.divIcon({
    className: 'gremium-pin',
    html:
      '<svg viewBox="0 0 24 28" width="22" height="26" ' +
      'xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 1c-5 0-9 4-9 9 0 6 9 17 9 17s9-11 9-17c0-5-4-9-9-9z" ' +
      'fill="' + color + '" stroke="#fff" stroke-width="1.5"/>' +
      '<circle cx="12" cy="10" r="3" fill="#fff"/></svg>',
    iconSize: [22, 26],
    iconAnchor: [11, 26],
    popupAnchor: [0, -22],
  });
}

export type StoreCategory =
  | 'cafeteria'
  | 'papeleria'
  | 'libreria'
  | 'electronica'
  | 'copias'
  | 'farmacia';

export type Store = {
  id: string;
  name: string;
  category: StoreCategory;
  address: string;
  hours: string;
  // lat / lng in standard order (lat first).
  lat: number;
  lng: number;
  // Short blurb for the popup.
  note?: string;
};

// Sample stores near Ciudad Universitaria, UNAM.  Coords are approximate
// and clustered around real landmark buildings so the dots feel right
// when you pan the map.  Real production would crawl Google Places /
// Yelp / Foursquare; for the demo we hand-curate with rough precision.
const STORES: Store[] = [
  {
    id: 'lib-unam',
    name: 'Libreria UNAM',
    category: 'libreria',
    address: 'Av. Universidad 3000, Coyoacan',
    hours: 'Lun-Vie 9:00-19:00',
    lat: 19.3219,
    lng: -99.1796,
    note: 'Textos del programa de la facultad. Aceptan pagos en efectivo y tarjeta.',
  },
  {
    id: 'cafe-typo',
    name: 'Cafe Typo',
    category: 'cafeteria',
    address: 'Av. Copilco s/n, Copilco Universidad',
    hours: 'Lun-Dom 8:00-22:00',
    lat: 19.3341,
    lng: -99.1769,
    note: 'Cafeteria con red WiFi y smoothies. Punto clasico de junta pre-clase.',
  },
  {
    id: 'papelaria-estudiante',
    name: 'Papeleria El Estudiante',
    category: 'papeleria',
    address: 'Av. Pedro Enriquez Urena 122, Copilco',
    hours: 'Lun-Sab 9:00-20:00',
    lat: 19.3305,
    lng: -99.1816,
    note: 'Cuadernos profesionales, plumas, calculadoras, hojas blancas.',
  },
  {
    id: 'cafe-100-natural',
    name: '100% Natural',
    category: 'cafeteria',
    address: 'Av. Insurgentes Sur 2475, San Angel',
    hours: 'Lun-Dom 7:30-22:00',
    lat: 19.3471,
    lng: -99.1876,
    note: 'Cadena con opciones vegetarianas. WiFi gratis.',
  },
  {
    id: 'copias-copycentro',
    name: 'Copycentro CU',
    category: 'copias',
    address: 'Circuito Escolar s/n frente a Bib. Central',
    hours: 'Lun-Vie 8:30-19:00',
    lat: 19.3232,
    lng: -99.1743,
    note: 'Impresiones B/N a $0.50, engargolados, copias a color.',
  },
  {
    id: 'libreria-gandhi',
    name: 'Libreria Gandhi',
    category: 'libreria',
    address: 'Av. Miguel Angel de Quevedo 121, Romero de Terreros',
    hours: 'Lun-Dom 10:00-21:00',
    lat: 19.3466,
    lng: -99.1743,
    note: 'Icono cultural de la CDMX. Libros de letras, ciencias y arte.',
  },
  {
    id: 'elektra-cu',
    name: 'Elektra Copilco',
    category: 'electronica',
    address: 'Av. Copilco 180, Copilco',
    hours: 'Lun-Dom 10:00-21:00',
    lat: 19.3328,
    lng: -99.1773,
    note: 'Linea blanca, computadoras, accesorios.',
  },
  {
    id: 'farmacia-similar',
    name: 'Farmacias Similares CU',
    category: 'farmacia',
    address: 'Eje 10 Sur, Copilco Universidad',
    hours: 'Lun-Dom 7:00-23:00',
    lat: 19.3262,
    lng: -99.1715,
    note: 'Medicina basica a precios accesibles.',
  },
  {
    id: 'oxxo-copilco',
    name: 'OXXO Copilco',
    category: 'papeleria',
    address: 'Av. Copilco 80, Copilco',
    hours: '24h',
    lat: 19.3301,
    lng: -99.1753,
    note: 'Miscelanea: bebidas, snacks, tarjetas Simon.',
  },
  {
    id: 'cafe-el-pretil',
    name: 'El Pretil',
    category: 'cafeteria',
    address: 'Av. Popocatepetl 154, Santa Cruz Atoyac',
    hours: 'Lun-Dom 8:00-22:00',
    lat: 19.3557,
    lng: -99.1676,
    note: 'Restaurante-bar informal, popular con alumnos de la FCPyS.',
  },
  {
    id: 'centro-copiado-fci',
    name: 'Centro de Copiado FCI',
    category: 'copias',
    address: 'Circuito Exterior s/n, Coyoacan (junto a FCI)',
    hours: 'Lun-Vie 9:00-18:00',
    lat: 19.3238,
    lng: -99.1810,
    note: 'Tesis completas, planos de gran formato, planos a color.',
  },
  {
    id: 'reparaciones-tlalpan',
    name: 'Reparaciones Moviles Tlalpan',
    category: 'electronica',
    address: 'Av. Tlalpan 2132, Campestre Churubusco',
    hours: 'Lun-Sab 10:00-19:00',
    lat: 19.3493,
    lng: -99.1613,
    note: 'Servicio tecnico para laptops y celulares. Refacciones.',
  },
];

const CATEGORY_LABELS: Record<StoreCategory, string> = {
  cafeteria: 'Cafeteria',
  papeleria: 'Papeleria / abarrotes',
  libreria: 'Libreria',
  electronica: 'Electronica',
  copias: 'Impresiones / copias',
  farmacia: 'Farmacia',
};

const CATEGORY_COLOR: Record<StoreCategory, string> = {
  cafeteria: '#a36b41',
  papeleria: '#3a7e75',
  libreria: '#5b4d8a',
  electronica: '#2860a6',
  copias: '#666',
  farmacia: '#b94545',
};

function categoryIcon(c: StoreCategory) {
  switch (c) {
    case 'cafeteria':
      return Coffee;
    case 'papeleria':
      return ShoppingBag;
    case 'libreria':
      return BookOpen;
    case 'electronica':
      return Plug;
    case 'copias':
      return Copy;
    case 'farmacia':
      return Pill;
    default:
      return MapPin;
  }
}

function categoryDot(c: StoreCategory) {
  return <span className="cat-dot" style={{ background: CATEGORY_COLOR[c] }} />;
}

/**
 * Locator: hooks the leaflet map instance so we can recentre on a store
 * row click.  Lives inside the <MapContainer> children tree so the map
 * context is available.
 */
function FlyToPoint({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], 17, { duration: 0.9 });
  }, [map, target]);
  return null;
}

export type StoresMapProps = {
  /** Where to recenter the "Go to ME" button. default = CU. */
  center?: { lat: number; lng: number };
  zoom?: number;
};

export function StoresMap({
  center = { lat: 19.3247, lng: -99.1778 },
  zoom = 15,
}: StoresMapProps) {
  const [active, setActive] = useState<Set<StoreCategory>>(
    () =>
      new Set<StoreCategory>([
        'cafeteria',
        'papeleria',
        'libreria',
        'electronica',
        'copias',
        'farmacia',
      ]),
  );
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    id: string;
  } | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoStatus, setGeoStatus] = useState<'idle' | 'asking' | 'denied' | 'ok'>(
    'idle',
  );

  const visible = useMemo(
    () => STORES.filter((s) => active.has(s.category)),
    [active],
  );

  function toggle(cat: StoreCategory) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('ok');
      },
      () => setGeoStatus('denied'),
      { timeout: 6000, enableHighAccuracy: false },
    );
  }

  return (
    <div className="stores-map-wrap">
      {/* Filter chips */}
      <div className="stores-filter">
        <span className="stores-filter-label">Categorias:</span>
        {(Object.keys(CATEGORY_LABELS) as StoreCategory[]).map((c) => {
          const Ic = categoryIcon(c);
          const on = active.has(c);
          return (
            <button
              key={c}
              type="button"
              className={'chip' + (on ? ' chip-on' : '')}
              onClick={() => toggle(c)}
              aria-pressed={on}
            >
              {categoryDot(c)}
              <Ic style={{ width: 12, height: 12 }} />
              {CATEGORY_LABELS[c]}
            </button>
          );
        })}
        <button
          type="button"
          className={'chip chip-locate'}
          onClick={locateMe}
          disabled={geoStatus === 'asking'}
        >
          <MapPin style={{ width: 12, height: 12 }} />
          {geoStatus === 'asking'
            ? 'Localizando...'
            : geoStatus === 'denied'
              ? 'Sin permiso'
              : userPos
                ? 'Actualizar ubicacion'
                : 'Estoy aqui'}
        </button>
      </div>

      <div className="stores-map-grid">
        <div className="stores-map-canvas">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={zoom}
            scrollWheelZoom
            className="leaflet-root"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToPoint
              target={
                flyTarget
                  ? { lat: flyTarget.lat, lng: flyTarget.lng }
                  : userPos
              }
            />
            {userPos && (
              <CircleMarker
                center={[userPos.lat, userPos.lng]}
                radius={9}
                pathOptions={{
                  color: '#2860a6',
                  weight: 2,
                  fillColor: '#2860a6',
                  fillOpacity: 0.45,
                }}
              />
            )}
            {visible.map((s) => (
              <Marker
                key={s.id}
                position={[s.lat, s.lng]}
                icon={coralPin(CATEGORY_COLOR[s.category])}
                eventHandlers={{
                  click: () =>
                    setFlyTarget({ lat: s.lat, lng: s.lng, id: s.id }),
                }}
              >
                <Popup>
                  <div className="store-popup">
                    <strong>{s.name}</strong>
                    <small>{CATEGORY_LABELS[s.category]}</small>
                    <p>{s.address}</p>
                    <p style={{ color: '#666' }}>{s.hours}</p>
                    {s.note && <p className="store-popup-note">{s.note}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <ul className="stores-list">
          {visible.length === 0 && (
            <li className="stores-empty">
              Activa una categoria para ver tiendas cercanas.
            </li>
          )}
          {visible.map((s) => {
            const Ic = categoryIcon(s.category);
            return (
              <li
                key={s.id}
                className={
                  'stores-row' +
                  (flyTarget?.id === s.id ? ' stores-row-active' : '')
                }
              >
                <button
                  type="button"
                  onClick={() => setFlyTarget({ lat: s.lat, lng: s.lng, id: s.id })}
                  className="stores-row-btn"
                >
                  <div className="stores-row-icon">
                    <Ic style={{ width: 14, height: 14 }} />
                  </div>
                  <div className="stores-row-body">
                    <strong>{s.name}</strong>
                    <small>
                      {CATEGORY_LABELS[s.category]} · {s.address}
                    </small>
                    <small style={{ color: '#94a0b0' }}>{s.hours}</small>
                  </div>
                  <span
                    className="stores-row-cat"
                    style={{ borderColor: CATEGORY_COLOR[s.category] }}
                  >
                    Ir
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
