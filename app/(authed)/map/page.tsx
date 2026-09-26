// app/(authed)/map/page.tsx — Placeholder UI para "Mapa" del sidebar.
import { MapPinned, Store } from 'lucide-react';

const SHOPS = [
  { shop: 'PumaTrade CU', dist: '0.6 km', top: 34, left: 27, time: '8 min caminando' },
  { shop: 'PumaTrade Copilco', dist: '1.4 km', top: 53, left: 50, time: '16 min en bici' },
  { shop: 'PumaTrade Del Valle', dist: '3.2 km', top: 72, left: 73, time: '22 min en metro' },
];

export default function MapPage() {
  return (
    <section className="map-view">
      <p className="eyebrow">CERCA DE TI · UNAM</p>
      <h1 style={{ fontSize: 29, letterSpacing: '-1px', margin: '0 0 8px', color: '#26364c' }}>
        Puntos aliados PumaTrade
      </h1>
      <p className="subcopy">
        Encuentra un punto aliado para ver artículos e intercambiar en
        persona. Demo con 3 ubicaciones ficticias en CDMX.
      </p>

      <div className="map-layout">
        <div className="map-canvas">
          <span className="map-area area-one">CIUDAD UNIVERSITARIA</span>
          {SHOPS.map((p) => (
            <div
              key={p.shop}
              className="map-pin"
              style={{ top: `${p.top}%`, left: `${p.left}%` }}
            >
              <Store />
              <span>{p.shop}</span>
            </div>
          ))}
        </div>
        <div className="shop-list">
          {SHOPS.map((p) => (
            <button type="button" className="shop-row" key={p.shop}>
              <MapPinned />
              <span>
                <strong>{p.shop}</strong>
                <small>{p.time}</small>
              </span>
              <b>{p.dist}</b>
            </button>
          ))}
        </div>
      </div>

      <p
        className="subcopy"
        style={{ marginTop: 24, fontSize: 11, color: '#94a0b0' }}
      >
        La red de puntos aliados se habilita en producción con KYC ligero
        (datos del local + verificación QR por parte del administrador del
        marketplace).
      </p>
    </section>
  );
}
