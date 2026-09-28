// app/(authed)/map/page.tsx — Tiendas cercanas a la UNAM (mapa interactivo).
//
// Antes: SVG dibujado con zonas CDMX aproximadas y 3 tiendas fake llamadas
// "Gremium CU / Copilco / Del Valle". El usuario pidio que se quitara: no
// tenemos tiendas fisicas, asi que no tenia sentido.
//
// Ahora: mapa real con tiles de OpenStreetMap (sin API key) y un listado
// curado de tiendas reales alrededor de Ciudad Universitaria, agrupadas
// por categoria. Componente client-side en components/map/StoresMap.tsx.
import { StoresMap } from '@/components/map/StoresMap';

export default function MapPage() {
  return (
    <section className="map-view">
      <p className="eyebrow">TIENDAS CERCANAS · UNAM</p>
      <h1>Que hay cerca del campus</h1>
      <p className="subcopy">
        Cafeterias, papelerias, librerias, tiendas de electronica y
        centros de copia dentro de un radio caminable de Ciudad
        Universitaria. Para cuando tu articulo no se puede resolver
        con un trueque directo y necesitas algo extra para cerrar el
        intercambio.
      </p>

      <StoresMap />

      <p
        className="subcopy"
        style={{
          marginTop: 20,
          fontSize: 10,
          color: '#94a0b0',
          textAlign: 'center',
        }}
      >
        Mapa servido por OpenStreetMap. Para esta demo las ubicaciones
        son aproximadas (calle + colonia); produccion usaria Places
        API o Foursquare para coordenadas exactas y horarios reales.
      </p>
    </section>
  );
}
