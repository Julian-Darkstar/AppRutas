// Convierte un KML exportado de Google My Maps al formato de ruta de AppRutas.
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { redondear } from './rutas.mjs';

const PALABRAS_REGRESO = /retorno|regreso|vuelta/i;
const PALABRAS_PARADA = /inicio|terminal|base|parada|fin\b|final/i;

/** Distancia aproximada en metros entre dos puntos [lng, lat] (suficiente a escala de ciudad). */
export function metrosEntre([lng1, lat1], [lng2, lat2]) {
  const rad = Math.PI / 180;
  const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.hypot(x, y) * 6371000;
}

/** Quita la altitud, redondea y elimina puntos repetidos seguidos. */
function limpiarLinea(coordenadas) {
  const salida = [];
  for (const [lng, lat] of coordenadas) {
    const punto = [redondear(lng), redondear(lat)];
    const anterior = salida.at(-1);
    if (!anterior || anterior[0] !== punto[0] || anterior[1] !== punto[1]) salida.push(punto);
  }
  return salida;
}

/**
 * @param {string} textoKml  contenido del archivo .kml
 * @param {{ id: string, numero: string, nombre?: string, color: string }} opciones
 * @returns {{ datos: any, avisos: string[] }}
 */
export function kmlARuta(textoKml, { id, numero, nombre, color }) {
  const avisos = [];
  const documento = new DOMParser().parseFromString(textoKml, 'text/xml');
  const geojson = kml(documento);

  const lineas = [];
  const puntos = [];
  for (const f of geojson.features) {
    const titulo = (f.properties?.name ?? '').trim();
    if (f.geometry?.type === 'LineString') lineas.push({ titulo, coords: limpiarLinea(f.geometry.coordinates) });
    else if (f.geometry?.type === 'Point') {
      const [lng, lat] = f.geometry.coordinates;
      puntos.push({ titulo, coords: [redondear(lng), redondear(lat)] });
    } else if (f.geometry) avisos.push(`Se ignoró "${titulo}" (geometría ${f.geometry.type}).`);
  }
  if (!lineas.length) throw new Error('El KML no tiene ninguna línea (LineString). ¿Exportaste la capa correcta?');

  // Un solo trazo que termina donde empieza = circuito.
  const esCircuito = lineas.length === 1 && metrosEntre(lineas[0].coords[0], lineas[0].coords.at(-1)) < 80;
  const recorridos = [];
  if (esCircuito) {
    recorridos.push({ sentido: 'circuito', coords: lineas[0].coords });
  } else {
    for (const linea of lineas) {
      const sentido = PALABRAS_REGRESO.test(linea.titulo) ? 'regreso' : 'ida';
      if (recorridos.some((r) => r.sentido === sentido)) {
        avisos.push(`Hay más de un trazo de "${sentido}"; se usó el primero y se ignoró "${linea.titulo}".`);
        continue;
      }
      recorridos.push({ sentido, coords: linea.coords });
    }
    if (recorridos.length === 1) avisos.push('Solo hay un sentido trazado. Si la ruta regresa por otras calles, traza también el regreso.');
    recorridos.sort((a, b) => (a.sentido === 'ida' ? -1 : 1) - (b.sentido === 'ida' ? -1 : 1));
  }

  const features = [
    ...recorridos.map((r) => ({
      type: 'Feature',
      properties: { tipo: 'recorrido', sentido: r.sentido },
      geometry: { type: 'LineString', coordinates: r.coords },
    })),
    ...puntos.map((p) => ({
      type: 'Feature',
      properties: { tipo: PALABRAS_PARADA.test(p.titulo) ? 'parada' : 'lugar', nombre: p.titulo || 'Sin nombre' },
      geometry: { type: 'Point', coordinates: p.coords },
    })),
  ];

  const tituloDocumento = documento.getElementsByTagName('name')[0]?.textContent?.trim() ?? '';
  const datos = {
    type: 'FeatureCollection',
    ruta: {
      id,
      numero,
      nombre: nombre || tituloDocumento || `Ruta ${numero}`,
      color,
      tipo: esCircuito ? 'circuito' : 'ida-regreso',
      origen: null,
      destino: null,
      descripcion: null,
      palabrasClave: [],
      frecuencia: null,
      horario: null,
      tarifa: null,
      verificado: null,
      fuente: 'Importada desde Google My Maps (KML)',
      notas: null,
    },
    features,
  };
  return { datos, avisos };
}
