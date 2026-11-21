// Reglas compartidas para los datos de rutas: validación, redondeo y agregado.
// Lo usan scripts/compilar-datos.mjs, scripts/importar-kml.mjs y las pruebas.

/**
 * Paleta de colores para rutas, en orden FIJO de asignación.
 * Validada para daltonismo (protanopia/deuteranopia) y contraste:
 *  - Los 3 primeros se distinguen entre sí aunque se crucen en el mapa.
 *  - Todos llevan número blanco legible encima (contraste >= 4.9:1).
 *  - A partir de la ruta 9 los colores se repiten: por eso el NÚMERO de la ruta
 *    siempre se muestra junto al color (insignia y etiquetas sobre la línea).
 */
export const PALETA_RUTAS = [
  { nombre: 'Azul', hex: '#1F63CF' },
  { nombre: 'Naranja', hex: '#C24A0A' },
  { nombre: 'Magenta', hex: '#B4197C' },
  { nombre: 'Oliva', hex: '#6F6A10' },
  { nombre: 'Violeta', hex: '#7342C8' },
  { nombre: 'Ocre', hex: '#9A5B00' },
  { nombre: 'Verde', hex: '#0B7F50' },
  { nombre: 'Rojo', hex: '#D1263A' },
];

/** Caja aproximada de Celaya y alrededores. Sirve para detectar lat/lng invertidos. */
export const AREA_SERVICIO = { oeste: -101.1, sur: 20.35, este: -100.55, norte: 20.75 };

export const TIPOS_RUTA = ['circuito', 'ida-regreso'];
export const SENTIDOS = ['ida', 'regreso', 'circuito'];
export const SERVICIOS = ['urbana', 'suburbana'];
/** Distancia máxima entre una parada y el trazo para considerar que la ruta pasa por ella. */
export const RADIO_PARADA_M = 30;
const TIPOS_PUNTO = ['parada', 'lugar'];

const esTexto = (v) => typeof v === 'string' && v.trim().length > 0;
const esTextoOpcional = (v) => v === null || v === undefined || typeof v === 'string';

/** Redondea a 5 decimales (~1 m), suficiente para un recorrido de camión. */
export const redondear = (n, decimales = 5) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

/** Devuelve las posiciones [lng, lat] de una geometría LineString, MultiLineString o Point. */
export function posiciones(geometria) {
  switch (geometria?.type) {
    case 'Point':
      return [geometria.coordinates];
    case 'LineString':
      return geometria.coordinates;
    case 'MultiLineString':
      return geometria.coordinates.flat();
    default:
      return [];
  }
}

/** Caja envolvente [oeste, sur, este, norte] de una lista de features. */
export function cajaEnvolvente(features) {
  let [o, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features) {
    for (const [lng, lat] of posiciones(f.geometry)) {
      o = Math.min(o, lng);
      s = Math.min(s, lat);
      e = Math.max(e, lng);
      n = Math.max(n, lat);
    }
  }
  return [o, s, e, n].map((v) => redondear(v));
}

/**
 * Valida un archivo de ruta (FeatureCollection con el miembro "ruta").
 * @param {any} datos  contenido del archivo ya parseado
 * @param {string} [idEsperado]  nombre del archivo sin extensión
 * @returns {string[]} lista de errores legibles (vacía si todo está bien)
 */
export function validarRuta(datos, idEsperado) {
  const errores = [];
  const err = (m) => errores.push(m);

  if (datos?.type !== 'FeatureCollection') err('"type" debe ser "FeatureCollection".');
  const r = datos?.ruta;
  if (!r || typeof r !== 'object') {
    err('Falta el objeto "ruta" con la información de la ruta.');
    return errores;
  }

  if (!esTexto(r.id) || !/^[a-z0-9-]+$/.test(r.id)) err('"ruta.id" debe usar solo minúsculas, números y guiones (ej. "15-a").');
  else if (idEsperado && r.id !== idEsperado) err(`"ruta.id" es "${r.id}" pero el archivo se llama "${idEsperado}.geojson"; deben coincidir.`);
  if (!esTexto(r.numero)) err('"ruta.numero" es obligatorio (ej. "60" o "15-A").');
  if (!esTexto(r.nombre)) err('"ruta.nombre" es obligatorio (ej. "Pinos – Gobers").');
  if (typeof r.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(r.color)) err('"ruta.color" debe ser un color hexadecimal como "#1F63CF".');
  if (!TIPOS_RUTA.includes(r.tipo)) err(`"ruta.tipo" debe ser uno de: ${TIPOS_RUTA.join(', ')}.`);
  if (r.servicio != null && !SERVICIOS.includes(r.servicio)) err(`"ruta.servicio" debe ser uno de: ${SERVICIOS.join(', ')} (o null).`);
  for (const campo of ['origen', 'destino', 'descripcion', 'frecuencia', 'horario', 'tarifa', 'fuente', 'notas']) {
    if (!esTextoOpcional(r[campo])) err(`"ruta.${campo}" debe ser texto o null.`);
  }
  if (r.verificado != null && !/^\d{4}(-\d{2}){0,2}$/.test(r.verificado)) err('"ruta.verificado" debe tener formato AAAA, AAAA-MM o AAAA-MM-DD.');
  if (r.palabrasClave != null && (!Array.isArray(r.palabrasClave) || !r.palabrasClave.every(esTexto))) {
    err('"ruta.palabrasClave" debe ser una lista de textos.');
  }

  const features = Array.isArray(datos.features) ? datos.features : [];
  if (!Array.isArray(datos.features)) err('"features" debe ser una lista.');

  const sentidosVistos = new Set();
  features.forEach((f, i) => {
    const donde = `features[${i}]`;
    const p = f?.properties ?? {};
    const g = f?.geometry;
    if (f?.type !== 'Feature') err(`${donde}: "type" debe ser "Feature".`);

    if (p.tipo === 'recorrido') {
      if (g?.type !== 'LineString' && g?.type !== 'MultiLineString') err(`${donde}: un recorrido debe ser LineString o MultiLineString.`);
      else if (posiciones(g).length < 2) err(`${donde}: el recorrido necesita al menos 2 puntos.`);
      if (!SENTIDOS.includes(p.sentido)) err(`${donde}: "sentido" debe ser uno de: ${SENTIDOS.join(', ')}.`);
      else {
        if (sentidosVistos.has(p.sentido)) err(`${donde}: el sentido "${p.sentido}" está repetido; une los tramos en un MultiLineString.`);
        sentidosVistos.add(p.sentido);
        if (r.tipo === 'ida-regreso' && p.sentido === 'circuito') err(`${donde}: una ruta "ida-regreso" usa sentidos "ida" y "regreso".`);
      }
      if (p.nombre != null && !esTexto(p.nombre)) err(`${donde}: "nombre" del recorrido debe ser texto.`);
    } else if (TIPOS_PUNTO.includes(p.tipo)) {
      if (g?.type !== 'Point') err(`${donde}: una ${p.tipo} debe ser Point.`);
      if (!esTexto(p.nombre)) err(`${donde}: la ${p.tipo} necesita "nombre".`);
    } else {
      err(`${donde}: "properties.tipo" debe ser "recorrido", "parada" o "lugar".`);
    }

    for (const pos of posiciones(g)) {
      const [lng, lat] = pos;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        err(`${donde}: coordenada inválida ${JSON.stringify(pos)}.`);
        break;
      }
      const { oeste, sur, este, norte } = AREA_SERVICIO;
      if (lng < oeste || lng > este || lat < sur || lat > norte) {
        err(`${donde}: la coordenada [${lng}, ${lat}] está fuera de Celaya (¿lat y lng invertidos?).`);
        break;
      }
    }
  });

  if (!features.some((f) => f?.properties?.tipo === 'recorrido')) err('La ruta necesita al menos un "recorrido".');
  if (r.tipo === 'circuito' && sentidosVistos.size) {
    const unico = sentidosVistos.size === 1 && sentidosVistos.has('circuito');
    const doble = sentidosVistos.size === 2 && sentidosVistos.has('ida') && sentidosVistos.has('regreso');
    if (!unico && !doble) err('Un circuito lleva un recorrido "circuito", o dos ("ida" y "regreso") si da la vuelta en ambos sentidos.');
  }
  return errores;
}

/** Valida data/paradas.geojson: puntos con id único y nombre. */
export function validarParadas(datos) {
  if (datos?.type !== 'FeatureCollection' || !Array.isArray(datos.features)) return ['data/paradas.geojson debe ser un FeatureCollection.'];
  const errores = [];
  const ids = new Set();
  const { oeste, sur, este, norte } = AREA_SERVICIO;
  datos.features.forEach((f, i) => {
    const p = f?.properties ?? {};
    const donde = `paradas[${i}]`;
    if (!esTexto(p.id) || !/^[a-z0-9-]+$/.test(p.id)) errores.push(`${donde}: "id" debe usar minúsculas, números y guiones.`);
    else if (ids.has(p.id)) errores.push(`${donde}: el id "${p.id}" está repetido.`);
    else ids.add(p.id);
    if (!esTexto(p.nombre)) errores.push(`${donde}: falta "nombre".`);
    if (!esTextoOpcional(p.ubicacion)) errores.push(`${donde}: "ubicacion" debe ser texto o null.`);
    if (f?.geometry?.type !== 'Point') errores.push(`${donde}: debe ser Point.`);
    else {
      const [lng, lat] = f.geometry.coordinates;
      if (!(lng >= oeste && lng <= este && lat >= sur && lat <= norte)) errores.push(`${donde}: [${lng}, ${lat}] está fuera de Celaya (¿lat y lng invertidos?).`);
    }
  });
  return errores;
}

// Proyección local en metros (equirrectangular centrada en Celaya): suficiente para distancias de calle.
const KX = (Math.PI / 180) * 6371000 * Math.cos((20.53 * Math.PI) / 180);
const KY = (Math.PI / 180) * 6371000;
const aMetros = ([lng, lat]) => [lng * KX, lat * KY];

/**
 * Ids de las paradas a menos de `radio` metros de la línea, en el orden en que el camión las recorre.
 * @param {number[][]} linea  posiciones [lng, lat]
 * @param {{ id: string, coordenadas: number[] }[]} paradas
 */
export function paradasCercanas(linea, paradas, radio = RADIO_PARADA_M) {
  const pts = linea.map(aMetros);
  if (pts.length < 2) return [];
  let [minx, miny, maxx, maxy] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    minx = Math.min(minx, x);
    miny = Math.min(miny, y);
    maxx = Math.max(maxx, x);
    maxy = Math.max(maxy, y);
  }
  const acumulado = [0];
  for (let i = 1; i < pts.length; i++) acumulado.push(acumulado[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));

  const encontradas = [];
  for (const parada of paradas) {
    const [px, py] = aMetros(parada.coordenadas);
    if (px < minx - radio || px > maxx + radio || py < miny - radio || py > maxy + radio) continue;
    let mejor = Infinity;
    let posicion = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const dx = pts[i + 1][0] - ax;
      const dy = pts[i + 1][1] - ay;
      const L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d < mejor) {
        mejor = d;
        posicion = acumulado[i] + t * Math.sqrt(L);
      }
    }
    if (mejor <= radio) encontradas.push({ id: parada.id, posicion });
  }
  return encontradas.sort((a, b) => a.posicion - b.posicion).map((p) => p.id);
}

/** Orden natural por número de ruta: 2, 10, 15-A, 60, 61... */
export const compararNumero = (a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });

/**
 * Junta las rutas validadas en el archivo que consume la app y les asocia las paradas cercanas.
 * @param {any[]} rutas  archivos de ruta ya validados
 * @param {any} [paradasFC]  data/paradas.geojson ya validado (opcional)
 */
export function agruparRutas(rutas, paradasFC = null) {
  const paradas = (paradasFC?.features ?? []).map((f) => ({
    id: f.properties.id,
    nombre: f.properties.nombre,
    ubicacion: f.properties.ubicacion ?? null,
    coordenadas: f.geometry.coordinates,
  }));
  const usadas = new Set();
  const ordenadas = [...rutas].sort((a, b) => compararNumero(a.ruta.numero, b.ruta.numero));
  const features = [];
  const indice = ordenadas.map(({ ruta, features: fs }) => {
    const recorridos = fs.filter((f) => f.properties.tipo === 'recorrido');
    const puntos = fs.filter((f) => f.properties.tipo !== 'recorrido');
    for (const f of fs) {
      features.push({
        type: 'Feature',
        properties: { ...f.properties, ruta: ruta.id, numero: ruta.numero, color: ruta.color, servicio: ruta.servicio ?? null },
        geometry: f.geometry,
      });
    }
    /** @type {Record<string, string[]>} */
    const paradasRuta = {};
    /** @type {Record<string, string>} */
    const nombresSentido = {};
    for (const f of recorridos) {
      const ids = paradasCercanas(posiciones(f.geometry), paradas);
      paradasRuta[f.properties.sentido] = ids;
      for (const id of ids) usadas.add(id);
      if (f.properties.nombre) nombresSentido[f.properties.sentido] = f.properties.nombre;
    }
    return {
      id: ruta.id,
      numero: ruta.numero,
      nombre: ruta.nombre,
      color: ruta.color,
      tipo: ruta.tipo,
      servicio: ruta.servicio ?? null,
      origen: ruta.origen ?? null,
      destino: ruta.destino ?? null,
      descripcion: ruta.descripcion ?? null,
      palabrasClave: ruta.palabrasClave ?? [],
      frecuencia: ruta.frecuencia ?? null,
      horario: ruta.horario ?? null,
      tarifa: ruta.tarifa ?? null,
      verificado: ruta.verificado ?? null,
      fuente: ruta.fuente ?? null,
      notas: ruta.notas ?? null,
      sentidos: recorridos.map((f) => f.properties.sentido),
      nombresSentido,
      paradas: paradasRuta,
      puntos: puntos.map((f) => ({ tipo: f.properties.tipo, nombre: f.properties.nombre, coordenadas: f.geometry.coordinates })),
      caja: cajaEnvolvente(recorridos),
    };
  });
  return {
    version: 2,
    rutas: indice,
    // Solo las paradas por las que pasa alguna ruta.
    paradas: paradas.filter((p) => usadas.has(p.id)),
    geojson: { type: 'FeatureCollection', features },
  };
}

/**
 * JSON con sangría, pero con cada coordenada en una sola línea: archivos
 * legibles y diffs de git que muestran exactamente qué punto cambió.
 */
export function aJSONLegible(objeto) {
  return (
    JSON.stringify(objeto, null, 2).replace(
      /\[\s+(-?\d+(?:\.\d+)?),\s+(-?\d+(?:\.\d+)?)\s+\]/g,
      '[$1, $2]',
    ) + '\n'
  );
}
