// Búsqueda de lugares (geocodificación) con Photon, de komoot, sobre datos de OpenStreetMap.
// Gratis y sin clave; se consulta solo al escribir 3+ letras, con espera, y limitado a Celaya.
import { CAJA_CELAYA, CENTRO_CELAYA, URL_GEOCODIFICADOR } from './config';

export interface Lugar {
  nombre: string;
  detalle: string;
  coordenadas: [number, number];
}

interface PropiedadesPhoton {
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  locality?: string;
  city?: string;
  osm_key?: string;
  osm_value?: string;
  type?: string;
}

interface FeaturePhoton {
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: PropiedadesPhoton;
}

const CATEGORIAS: Record<string, string> = {
  hospital: 'Hospital', clinic: 'Clínica', doctors: 'Consultorio', pharmacy: 'Farmacia',
  school: 'Escuela', kindergarten: 'Kínder', college: 'Escuela', university: 'Universidad',
  mall: 'Plaza comercial', marketplace: 'Mercado', supermarket: 'Supermercado', department_store: 'Tienda',
  park: 'Parque', stadium: 'Estadio', sports_centre: 'Deportivo', place_of_worship: 'Templo',
  bus_station: 'Central de autobuses', bus_stop: 'Parada', townhall: 'Gobierno', police: 'Policía',
  bank: 'Banco', restaurant: 'Restaurante', hotel: 'Hotel', cinema: 'Cine', museum: 'Museo', library: 'Biblioteca',
  quarter: 'Colonia', suburb: 'Colonia', neighbourhood: 'Colonia', village: 'Localidad', hamlet: 'Localidad', town: 'Localidad',
};
const CALLES = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'residential', 'unclassified', 'living_street', 'service', 'pedestrian']);

/** Convierte un resultado de Photon en un lugar con nombre y detalle legibles. */
export function lugarDesdePhoton(f: FeaturePhoton): Lugar | null {
  const p = f.properties ?? {};
  const direccion = [p.street, p.housenumber].filter(Boolean).join(' ');
  const nombre = (p.name || direccion || '').trim();
  if (!nombre || f.geometry?.type !== 'Point') return null;
  // Lo que es el lugar (Hospital, Escuela…) va antes que "Dirección": Photon marca como domicilio a muchos lugares con nombre.
  const categoria =
    CATEGORIAS[p.osm_value ?? ''] ?? (CALLES.has(p.osm_value ?? '') ? 'Calle' : !p.name && p.type === 'house' ? 'Dirección' : null);
  const zona = p.district || p.locality || (p.city && !/zona urbana/i.test(p.city) ? p.city : null);
  const detalle = [categoria, p.name && direccion && direccion !== nombre ? direccion : null, zona].filter(Boolean).join(' · ');
  const [lng, lat] = f.geometry.coordinates;
  return { nombre, detalle, coordenadas: [lng, lat] };
}

/** Quita duplicados: el mismo nombre a menos de ~200 m (Photon suele dar el punto y el polígono). */
export function sinDuplicados(lugares: Lugar[]): Lugar[] {
  const salida: Lugar[] = [];
  for (const l of lugares) {
    const repetido = salida.some(
      (o) =>
        o.nombre.toLowerCase() === l.nombre.toLowerCase() &&
        Math.abs(o.coordenadas[0] - l.coordenadas[0]) < 0.002 &&
        Math.abs(o.coordenadas[1] - l.coordenadas[1]) < 0.002,
    );
    if (!repetido) salida.push(l);
  }
  return salida;
}

/** Las búsquedas que son un número de ruta ("47", "15-A", "ruta 60") no se mandan al geocodificador. */
export const esNumeroDeRuta = (consulta: string) => /^\s*(ruta\s*)?\d{1,3}(\s*-?\s*[a-z])?\s*$/i.test(consulta);

const cache = new Map<string, Lugar[]>();

export async function buscarLugares(consulta: string, senal?: AbortSignal): Promise<Lugar[]> {
  const q = consulta.trim();
  const clave = q.toLowerCase();
  if (cache.has(clave)) return cache.get(clave)!;
  const params = new URLSearchParams({
    q,
    limit: '8',
    bbox: CAJA_CELAYA.join(','),
    lon: String(CENTRO_CELAYA[0]),
    lat: String(CENTRO_CELAYA[1]),
  });
  const respuesta = await fetch(`${URL_GEOCODIFICADOR}/api/?${params}`, { signal: senal });
  if (!respuesta.ok) throw new Error(`El buscador de lugares respondió ${respuesta.status}.`);
  const datos = (await respuesta.json()) as { features: FeaturePhoton[] };
  const lugares = sinDuplicados(datos.features.map(lugarDesdePhoton).filter((l): l is Lugar => l !== null)).slice(0, 5);
  cache.set(clave, lugares);
  return lugares;
}

/** Nombre aproximado de un punto del mapa ("Calle Manuel Doblado 103"), o null si no hay red. */
export async function nombrarPunto([lng, lat]: [number, number], senal?: AbortSignal): Promise<string | null> {
  try {
    const params = new URLSearchParams({ lon: String(lng), lat: String(lat) });
    const respuesta = await fetch(`${URL_GEOCODIFICADOR}/reverse?${params}`, { signal: senal });
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as { features: FeaturePhoton[] };
    const p = datos.features[0]?.properties;
    if (!p) return null;
    return p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || null;
  } catch {
    return null;
  }
}
