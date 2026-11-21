// Convierte las capas del SIG municipal del IMIPE Celaya (2021) al formato de AppRutas.
// Ver data/fuentes/imipe-2021/LEEME.md.
import { metrosEntre } from './kml.mjs';
import { redondear } from './rutas.mjs';

export const FUENTE_IMIPE = 'IMIPE Celaya · SIG municipal (feb 2021)';
export const VERIFICADO_IMIPE = '2021-02';

const ABREVIATURAS = {
  'MDO.': 'Mercado', MDO: 'Mercado', 'PTA.': 'Puerta', PTA: 'Puerta', 'STA.': 'Santa', STA: 'Santa',
  'GTO.': 'Guanajuato', GTO: 'Guanajuato', 'MA.': 'María', 'TECN.': 'Tecnológico',
  COL: 'Col.', 'COL.': 'Col.', FRACC: 'Fracc.', 'FRACC.': 'Fracc.', 'CD.': 'Cd.', 'MOL.': 'Mol.',
};
const PALABRAS = {
  ALAMOS: 'Álamos', ARREGUIN: 'Arreguín', BAJIO: 'Bajío', ELIAS: 'Elías', FOVISTE: 'FOVISSSTE', IRRIGACION: 'Irrigación',
  JOSE: 'José', MARIA: 'María', MARTIN: 'Martín', QUINTANAROO: 'Quintana Roo', REVOLUCION: 'Revolución', TENERIA: 'Tenería',
};
const SIGLAS = new Set(['CBTIS', 'FOVISSSTE', 'IMSS', 'IVEG', 'L1', 'L2']);
const MINUSCULAS = new Set(['DE', 'DEL', 'EL', 'EN', 'LA', 'LAS', 'LOS', 'Y']);
const CENTRAL = /^(CELAYA|CENTRO|CENTRAL)\b/;

/** "CELAYA MDO. HIDALGO" → "Celaya Mercado Hidalgo"; "S. RAFAEL/M. BLANCO" → "San Rafael / M. Blanco". */
export function titulo(texto) {
  let t = texto.trim().replace(/\/L(\d)\)/g, '(L$1)').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ');
  const abiertos = (t.match(/\(/g) ?? []).length - (t.match(/\)/g) ?? []).length;
  if (abiertos > 0) t += ')'.repeat(abiertos);
  const tokens = t.split(' ');
  return tokens
    .map((token, i) => {
      const [, abre, palabra, cierra] = token.match(/^(\(?)(.*?)(\)?)$/);
      const siguiente = tokens[i + 1];
      let r;
      if (palabra === 'S.' && siguiente && /^[A-Z]/.test(siguiente)) r = 'San';
      else if (ABREVIATURAS[palabra]) r = ABREVIATURAS[palabra];
      else if (PALABRAS[palabra]) r = PALABRAS[palabra];
      else if (SIGLAS.has(palabra)) r = palabra;
      // "Col. Las Flores", "Fracc. El Puente": tras estas abreviaturas el artículo es parte del nombre propio.
      else if (i > 0 && !abre && MINUSCULAS.has(palabra) && !/^(COL|FRACC)\.?$/.test(tokens[i - 1])) r = palabra.toLowerCase();
      else r = palabra.charAt(0) + palabra.slice(1).toLowerCase();
      return abre + r + cierra;
    })
    .join(' ');
}

/** Clave para comparar nombres: sin signos y, opcionalmente, con abreviaturas expandidas. */
function clave(texto, expandir) {
  const t = expandir ? texto.split(/\s+/).map((p) => (ABREVIATURAS[p] ?? p).toUpperCase()).join(' ') : texto;
  return t.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Completa un nombre cortado con el del sentido contrario: "SAN JOSE DE GT" + "SAN JOSE DE GTO" → el segundo.
 * Devuelve null si los dos nombres no son versiones del mismo.
 */
export function completar(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  for (const expandir of [false, true]) {
    const ka = clave(a, expandir);
    const kb = clave(b, expandir);
    if (ka.startsWith(kb)) return a;
    if (kb.startsWith(ka)) return b;
  }
  return null;
}

/** "(A) CENTRAL - VILLAS DEL BAJIO" → { variante: 'A', extremos: ['CENTRAL', 'VILLAS DEL BAJIO'], calificador: null } */
export function analizarNombre(crudo) {
  let resto = crudo.trim();
  const variante = resto.match(/^\(([A-Z])\)\s*/)?.[1] ?? null;
  if (variante) resto = resto.replace(/^\([A-Z]\)\s*/, '');
  // Un paréntesis al final que no es L1/L2 califica a toda la ruta: "CENTRO - NARANJOS (QUINTANAROO".
  let calificador = null;
  const m = resto.match(/\s*\(([A-Z ]+)\)?$/);
  if (m && !/^L\d$/.test(m[1].trim()) && /-/.test(resto.slice(0, m.index))) {
    calificador = m[1].trim();
    resto = resto.slice(0, m.index);
  }
  const trozos = resto.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
  return { variante, extremos: trozos.length === 2 ? trozos : null, calificador, texto: resto };
}

function limpiarLinea(coordenadas) {
  const salida = [];
  for (const [lng, lat] of coordenadas) {
    const p = [redondear(lng), redondear(lat)];
    const ultimo = salida.at(-1);
    if (!ultimo || ultimo[0] !== p[0] || ultimo[1] !== p[1]) salida.push(p);
  }
  return salida;
}

const esCerrado = (c) => metrosEntre(c[0], c.at(-1)) < 80;

/** Agrupa los 120 trazos por ruta (número + variante A/B). */
export function agruparTrazos(features) {
  const grupos = new Map();
  for (const f of features) {
    const p = f.properties;
    const { variante } = analizarNombre(p.nombre_rut ?? '');
    const numero = variante ? `${p.num_ruta}-${variante}` : String(p.num_ruta);
    if (!grupos.has(numero)) grupos.set(numero, { numero, servicio: null, trazos: [] });
    const g = grupos.get(numero);
    // "URABNO" es una errata de URBANO en la fuente.
    const servicio = /^SUB/i.test(p.tipo_ruta) ? 'suburbana' : 'urbana';
    g.servicio ??= servicio;
    g.trazos.push({ sentido: String(p.Sentido).toLowerCase() === 'regreso' ? 'regreso' : 'ida', nombre: p.nombre_rut, coords: limpiarLinea(f.geometry.coordinates) });
  }
  return [...grupos.values()];
}

function extremoFinal(crudo, correcciones) {
  if (!crudo) return null;
  const c = correcciones.extremos?.[crudo];
  if (c) return c.nombre;
  return titulo(crudo);
}

/**
 * Arma el archivo de ruta de AppRutas para un grupo de trazos.
 * @returns {{ id: string, datos: any, avisos: string[] }}
 */
export function construirRuta(grupo, correcciones = {}, color = '#1F63CF') {
  const avisos = [];
  const id = grupo.numero.toLowerCase();
  const ida = grupo.trazos.find((t) => t.sentido === 'ida');
  const regreso = grupo.trazos.find((t) => t.sentido === 'regreso');
  const todos = [ida, regreso].filter(Boolean);
  const cerrados = todos.every((t) => esCerrado(t.coords));

  let tipo;
  let recorridos;
  let nombre;
  let origen = null;
  let destino = null;
  const palabrasClave = [];

  if (cerrados) {
    tipo = 'circuito';
    if (todos.length === 1) {
      recorridos = [{ sentido: 'circuito', coords: todos[0].coords }];
    } else {
      recorridos = todos.map((t) => ({ sentido: t.sentido, coords: t.coords, nombre: titulo(analizarNombre(t.nombre).texto) }));
    }
    nombre = titulo(analizarNombre(todos[0].nombre).texto.replace(/\s+(NORTE|SUR|ORIENTE|PONIENTE)$/, ''));
  } else {
    tipo = 'ida-regreso';
    recorridos = todos.map((t) => ({ sentido: t.sentido, coords: t.coords }));
    const a = analizarNombre(ida?.nombre ?? '');
    const b = analizarNombre(regreso?.nombre ?? '');
    // Ida: A → B. Regreso: B → A. Cada extremo se completa con su pareja del otro sentido.
    const [a1, b1] = a.extremos ?? (b.extremos ? [b.extremos[1], b.extremos[0]] : [null, null]);
    const [b2, a2] = b.extremos ?? [null, null];
    const crudoOrigen = completar(a1, a2) ?? a1 ?? a2;
    const crudoDestino = completar(b1, b2) ?? b1 ?? b2;
    origen = extremoFinal(crudoOrigen, correcciones);
    destino = extremoFinal(crudoDestino, correcciones);
    if (!a.extremos && !b.extremos) avisos.push(`No se pudo separar el nombre «${ida?.nombre ?? regreso?.nombre}» en dos extremos.`);
    // El nombre pone primero el extremo céntrico (Celaya, Centro, Central): "Celaya – Tamayo".
    const centricoAlFinal = crudoDestino && CENTRAL.test(crudoDestino) && !(crudoOrigen && CENTRAL.test(crudoOrigen));
    const [primero, segundo] = centricoAlFinal ? [destino, origen] : [origen, destino];
    nombre = [primero, segundo].filter(Boolean).join(' – ');
    const calificador = a.calificador ?? b.calificador;
    if (calificador) nombre += ` (${titulo(calificador)})`;
    palabrasClave.push(...[origen, destino].filter(Boolean));
  }

  const ajuste = correcciones.rutas?.[id] ?? {};
  const ruta = {
    id,
    numero: grupo.numero,
    nombre: ajuste.nombre ?? nombre,
    color,
    tipo,
    servicio: grupo.servicio,
    origen: ajuste.origen !== undefined ? ajuste.origen : origen,
    destino: ajuste.destino !== undefined ? ajuste.destino : destino,
    descripcion: ajuste.descripcion ?? null,
    palabrasClave: [...new Set([...palabrasClave, ...(ajuste.palabrasClave ?? [])])],
    frecuencia: null,
    horario: null,
    tarifa: null,
    verificado: VERIFICADO_IMIPE,
    fuente: FUENTE_IMIPE,
    notas: ajuste.notas ?? null,
  };
  if (!ruta.nombre) {
    ruta.nombre = `Ruta ${grupo.numero}`;
    avisos.push('Sin nombre utilizable en la fuente.');
  }

  const features = recorridos.map((r) => ({
    type: 'Feature',
    properties: { tipo: 'recorrido', sentido: r.sentido, ...(r.nombre ? { nombre: r.nombre } : {}) },
    geometry: { type: 'LineString', coordinates: r.coords },
  }));
  return { id, datos: { type: 'FeatureCollection', ruta, features }, avisos };
}

/** Señala rutas cuyo trazo es idéntico al de otra (posible error de captura en la fuente). */
export function marcarDuplicados(rutas) {
  const porTrazo = new Map();
  for (const { id, datos } of rutas) {
    for (const f of datos.features) {
      const k = JSON.stringify(f.geometry.coordinates);
      if (!porTrazo.has(k)) porTrazo.set(k, new Set());
      porTrazo.get(k).add(id);
    }
  }
  for (const { id, datos } of rutas) {
    const otras = new Set();
    for (const f of datos.features) for (const o of porTrazo.get(JSON.stringify(f.geometry.coordinates))) if (o !== id) otras.add(o);
    if (!otras.size) continue;
    const lista = [...otras].map((o) => o.toUpperCase()).join(', ');
    const nota = `En la fuente oficial su trazo es idéntico al de la ruta ${lista}: puede ser un error de captura.`;
    datos.ruta.notas = datos.ruta.notas ? `${datos.ruta.notas} ${nota}` : nota;
  }
}

/** Paradas oficiales → FeatureCollection de AppRutas con id estable por posición en la fuente. */
export function convertirParadas(features) {
  const ancho = String(features.length).length;
  return {
    type: 'FeatureCollection',
    features: features.map((f, i) => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties ?? {};
      return {
        type: 'Feature',
        properties: {
          id: `p${String(i + 1).padStart(ancho, '0')}`,
          nombre: String(p.Nom_Parada ?? '').trim() || 'Parada sin nombre',
          ubicacion: String(p['Ubicación'] ?? p.Ubicacion ?? '').trim() || null,
        },
        geometry: { type: 'Point', coordinates: [redondear(lng), redondear(lat)] },
      };
    }),
  };
}
