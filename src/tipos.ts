import type { FeatureCollection, LineString, MultiLineString, Point } from 'geojson';

export type Sentido = 'ida' | 'regreso' | 'circuito';
export type TipoRuta = 'circuito' | 'ida-regreso';
export type Servicio = 'urbana' | 'suburbana';

export interface Parada {
  id: string;
  nombre: string;
  /** Cruce de calles, p. ej. "Av. Tecnológico - Irrigación". */
  ubicacion: string | null;
  coordenadas: [number, number];
}

export interface PuntoRuta {
  tipo: 'parada' | 'lugar';
  nombre: string;
  coordenadas: [number, number];
}

/** Una ruta tal como llega en public/data/rutas.json (ver scripts/lib/rutas.mjs). */
export interface Ruta {
  id: string;
  numero: string;
  nombre: string;
  color: string;
  tipo: TipoRuta;
  servicio: Servicio | null;
  origen: string | null;
  destino: string | null;
  descripcion: string | null;
  palabrasClave: string[];
  frecuencia: string | null;
  horario: string | null;
  tarifa: string | null;
  verificado: string | null;
  fuente: string | null;
  notas: string | null;
  sentidos: Sentido[];
  /** Nombre propio de un sentido cuando lo tiene (p. ej. "Circuito 3 Sur"). */
  nombresSentido: Partial<Record<Sentido, string>>;
  /** Ids de las paradas de cada sentido, en el orden del recorrido. */
  paradas: Partial<Record<Sentido, string[]>>;
  puntos: PuntoRuta[];
  /** [oeste, sur, este, norte] */
  caja: [number, number, number, number];
}

export interface PropiedadesRecorrido {
  tipo: 'recorrido';
  sentido: Sentido;
  ruta: string;
  numero: string;
  color: string;
  servicio: Servicio | null;
}

export interface PropiedadesPunto {
  tipo: 'parada' | 'lugar';
  nombre: string;
  ruta: string;
  numero: string;
  color: string;
}

export interface DatosRutas {
  version: number;
  generado: string;
  rutas: Ruta[];
  paradas: Parada[];
  geojson: FeatureCollection<LineString | MultiLineString | Point, PropiedadesRecorrido | PropiedadesPunto>;
}

/** Lo que muestra la app en cada momento; se refleja en la URL (#/ruta/61/regreso). */
export type Vista =
  | { tipo: 'lista' }
  | { tipo: 'ruta'; id: string; sentido?: Sentido }
  /** "¿Qué ruta me deja más cerca de…?" (#/destino/20.52350,-100.81570/Mercado%20Hidalgo) */
  | { tipo: 'destino'; lat: number; lng: number; nombre: string };
