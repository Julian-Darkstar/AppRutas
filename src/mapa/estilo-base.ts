import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';

/**
 * Mapa base: OpenFreeMap "Positron" (gratis, sin clave de API, datos de
 * OpenStreetMap) ajustado a la paleta de AppRutas: tierra color papel, calles
 * blancas y agua/parques suaves, para que las rutas sean lo que resalte.
 */
export const URL_ESTILO = 'https://tiles.openfreemap.org/styles/positron';
export const FUENTE_ETIQUETAS = ['Noto Sans Bold'];

const PAPEL = '#F4F1EA';

const PINTURA: Record<string, Record<string, unknown>> = {
  background: { 'background-color': PAPEL },
  park: { 'fill-color': '#E2EAD8' },
  landcover_wood: { 'fill-color': '#DCE5D3' },
  landuse_residential: { 'fill-color': '#EFEBE3' },
  water: { 'fill-color': '#BFD7DD' },
  waterway: { 'line-color': '#B3CFD6' },
  building: { 'fill-color': '#E7E2D8', 'fill-outline-color': '#DCD5C8' },
  highway_minor: { 'line-color': '#FFFFFF' },
  highway_path: { 'line-color': '#F7F4EE' },
  highway_major_casing: { 'line-color': '#DDD6C9' },
  highway_major_inner: { 'line-color': '#FFFFFF' },
  highway_motorway_casing: { 'line-color': '#D6CFC1' },
  'highway-name-minor': { 'text-color': '#6B7378' },
  'highway-name-major': { 'text-color': '#5C6569' },
  label_other: { 'text-color': '#5F676B' },
  label_village: { 'text-color': '#3E474C' },
  label_town: { 'text-color': '#3E474C' },
  label_city: { 'text-color': '#2A3338' },
};

// Escudos de carreteras de EE. UU.: no aplican en México.
const OCULTAR = new Set(['highway-shield-us-interstate', 'road_shield_us']);

// Nombres en español primero (Positron usa el nombre en inglés si existe).
const NOMBRE_ES: ExpressionSpecification = ['coalesce', ['get', 'name:es'], ['get', 'name']];

const usaNombreIngles = (valor: unknown): boolean => JSON.stringify(valor ?? null).includes('"name_en"');

// El filtro original compara "ref_length" sin revisar que exista y llena la consola de avisos.
const CAPAS_CON_REF = new Set(['highway-shield-non-us']);

export function adaptarEstilo(estilo: StyleSpecification): StyleSpecification {
  const capas = estilo.layers
    .filter((capa) => !OCULTAR.has(capa.id))
    .map((capa) => {
      const pintura = PINTURA[capa.id];
      const copia = { ...capa } as typeof capa & { paint?: Record<string, unknown>; layout?: Record<string, unknown>; filter?: unknown };
      if (pintura) copia.paint = { ...(copia.paint ?? {}), ...pintura };
      if (CAPAS_CON_REF.has(capa.id) && Array.isArray(copia.filter) && copia.filter[0] === 'all') {
        copia.filter = ['all', ['has', 'ref_length'], ...copia.filter.slice(1)];
      }
      if (copia.type === 'symbol' && usaNombreIngles(copia.layout?.['text-field'])) {
        copia.layout = { ...copia.layout, 'text-field': NOMBRE_ES };
      }
      return copia as typeof capa;
    });
  return { ...estilo, layers: capas };
}

/** Estilo mínimo para cuando no hay internet ni copia guardada: las rutas se siguen viendo. */
export const ESTILO_SIN_CONEXION: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': PAPEL } }],
};

export async function cargarEstiloBase(): Promise<StyleSpecification> {
  try {
    const respuesta = await fetch(URL_ESTILO);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return adaptarEstilo((await respuesta.json()) as StyleSpecification);
  } catch (error) {
    console.warn('No se pudo cargar el mapa base; se muestran solo las rutas.', error);
    return ESTILO_SIN_CONEXION;
  }
}
