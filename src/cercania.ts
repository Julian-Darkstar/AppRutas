import type { DatosRutas, Parada, Ruta, Sentido } from './tipos';

type Posicion = [number, number];

// Proyección local en metros (equirrectangular centrada en Celaya): precisa de sobra para distancias a pie.
const KX = (Math.PI / 180) * 6371000 * Math.cos((20.53 * Math.PI) / 180);
const KY = (Math.PI / 180) * 6371000;
const aMetros = ([lng, lat]: Posicion): Posicion => [lng * KX, lat * KY];
const aGrados = ([x, y]: Posicion): Posicion => [x / KX, y / KY];

/** Velocidad a pie (m/min) y factor de rodeo: las calles no van en línea recta. */
const PASO_M_MIN = 75;
const RODEO = 1.25;

export const metrosEntre = (a: Posicion, b: Posicion) => {
  const [ax, ay] = aMetros(a);
  const [bx, by] = aMetros(b);
  return Math.hypot(ax - bx, ay - by);
};

export const minutosCaminando = (metros: number) => Math.max(1, Math.round((metros * RODEO) / PASO_M_MIN));

/** Distancia de un punto a una línea y el punto de la línea más cercano. */
export function distanciaALinea(punto: Posicion, linea: Posicion[]): { metros: number; punto: Posicion } {
  const [px, py] = aMetros(punto);
  let mejor = { metros: Infinity, punto: linea[0] };
  for (let i = 0; i < linea.length - 1; i++) {
    const [ax, ay] = aMetros(linea[i]);
    const [bx, by] = aMetros(linea[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < mejor.metros) mejor = { metros: d, punto: aGrados([cx, cy]) };
  }
  return mejor;
}

export interface RutaCercana {
  ruta: Ruta;
  /** Sentido que pasa más cerca del destino. */
  sentido: Sentido;
  /** Distancia en línea recta entre el destino y el punto más cercano por donde pasa la ruta. */
  metros: number;
  punto: Posicion;
  /** Parada oficial de ese sentido más cercana al destino, si hay. */
  parada: { parada: Parada; metros: number } | null;
}

export interface ResultadoCercania {
  cercanas: RutaCercana[];
  /** true si ninguna ruta pasa dentro del radio y se muestran las más cercanas de todos modos. */
  fueraDeRadio: boolean;
}

/** Líneas de cada ruta y sentido, en posiciones [lng, lat]. */
function lineasPorRuta(datos: DatosRutas): Map<string, Map<Sentido, Posicion[][]>> {
  const mapa = new Map<string, Map<Sentido, Posicion[][]>>();
  for (const f of datos.geojson.features) {
    const p = f.properties;
    if (p.tipo !== 'recorrido') continue;
    const g = f.geometry;
    const partes = g.type === 'LineString' ? [g.coordinates as Posicion[]] : g.type === 'MultiLineString' ? (g.coordinates as Posicion[][]) : [];
    if (!mapa.has(p.ruta)) mapa.set(p.ruta, new Map());
    const porSentido = mapa.get(p.ruta)!;
    porSentido.set(p.sentido, [...(porSentido.get(p.sentido) ?? []), ...partes]);
  }
  return mapa;
}

const cache = new WeakMap<DatosRutas, Map<string, Map<Sentido, Posicion[][]>>>();

/**
 * Rutas que pasan más cerca de un destino, de la más cercana a la más lejana.
 * Si ninguna pasa dentro de `radio`, devuelve las `minimo` más cercanas y marca `fueraDeRadio`.
 */
export function rutasCercanas(
  destino: Posicion,
  datos: DatosRutas,
  { radio = 1000, minimo = 3 }: { radio?: number; minimo?: number } = {},
): ResultadoCercania {
  if (!cache.has(datos)) cache.set(datos, lineasPorRuta(datos));
  const lineas = cache.get(datos)!;
  const paradasPorId = new Map(datos.paradas.map((p) => [p.id, p]));

  const todas: RutaCercana[] = [];
  for (const ruta of datos.rutas) {
    let mejor: Omit<RutaCercana, 'parada' | 'ruta'> | null = null;
    for (const [sentido, partes] of lineas.get(ruta.id) ?? []) {
      for (const parte of partes) {
        if (parte.length < 2) continue;
        const d = distanciaALinea(destino, parte);
        if (!mejor || d.metros < mejor.metros) mejor = { sentido, metros: d.metros, punto: d.punto };
      }
    }
    if (!mejor) continue;
    let parada: RutaCercana['parada'] = null;
    for (const id of ruta.paradas?.[mejor.sentido] ?? []) {
      const p = paradasPorId.get(id);
      if (!p) continue;
      const m = metrosEntre(destino, p.coordenadas);
      if (!parada || m < parada.metros) parada = { parada: p, metros: m };
    }
    todas.push({ ruta, ...mejor, parada });
  }

  todas.sort((a, b) => a.metros - b.metros);
  const dentro = todas.filter((c) => c.metros <= radio);
  return dentro.length ? { cercanas: dentro, fueraDeRadio: false } : { cercanas: todas.slice(0, minimo), fueraDeRadio: true };
}

/** Cercanía de una ruta al destino en un sentido concreto (para la ficha de la ruta). */
export function cercaniaEnSentido(destino: Posicion, datos: DatosRutas, ruta: Ruta, sentido: Sentido): RutaCercana | null {
  if (!cache.has(datos)) cache.set(datos, lineasPorRuta(datos));
  const partes = cache.get(datos)!.get(ruta.id)?.get(sentido) ?? [];
  let mejor: { metros: number; punto: Posicion } | null = null;
  for (const parte of partes) {
    if (parte.length < 2) continue;
    const d = distanciaALinea(destino, parte);
    if (!mejor || d.metros < mejor.metros) mejor = d;
  }
  if (!mejor) return null;
  const paradasPorId = new Map(datos.paradas.map((p) => [p.id, p]));
  let parada: RutaCercana['parada'] = null;
  for (const id of ruta.paradas?.[sentido] ?? []) {
    const p = paradasPorId.get(id);
    if (!p) continue;
    const m = metrosEntre(destino, p.coordenadas);
    if (!parada || m < parada.metros) parada = { parada: p, metros: m };
  }
  return { ruta, sentido, metros: mejor.metros, punto: mejor.punto, parada };
}

/** Dónde conviene bajarse: la parada más cercana si está razonablemente cerca; si no, el punto más cercano de la ruta. */
export function puntoDeBajada(c: RutaCercana): Posicion {
  return c.parada && c.parada.metros <= Math.max(c.metros * 2, 400) ? c.parada.parada.coordenadas : c.punto;
}

/** "120 m", "1.3 km" */
export function formatoDistancia(metros: number): string {
  if (metros < 950) return `${Math.max(10, Math.round(metros / 10) * 10)} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}
