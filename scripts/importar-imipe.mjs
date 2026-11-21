#!/usr/bin/env node
// Importa las rutas y paradas oficiales del IMIPE Celaya (ver data/fuentes/imipe-2021/LEEME.md).
//
//   npm run importar-imipe              # crea las rutas que falten y actualiza las que vienen del IMIPE
//   npm run importar-imipe -- --forzar  # también reemplaza rutas trazadas por el equipo con el mismo número
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { FUENTE_IMIPE, agruparTrazos, construirRuta, convertirParadas, marcarDuplicados } from './lib/imipe.mjs';
import { PALETA_RUTAS, aJSONLegible, compararNumero, validarRuta } from './lib/rutas.mjs';

const { values } = parseArgs({
  options: {
    fuente: { type: 'string', default: 'data/fuentes/imipe-2021' },
    forzar: { type: 'boolean', default: false },
  },
});

const leer = (archivo) => JSON.parse(readFileSync(join(values.fuente, archivo), 'utf8').replace(/^﻿/, ''));
const rutasFuente = leer('rutas.json');
const paradasFuente = leer('paradas.json');
const correcciones = existsSync(join(values.fuente, 'correcciones.json')) ? leer('correcciones.json') : {};

const grupos = agruparTrazos(rutasFuente.features).sort((a, b) => compararNumero(a.numero, b.numero));
const rutas = grupos.map((g, i) => {
  const archivo = join('data/rutas', `${g.numero.toLowerCase()}.geojson`);
  // Una ruta que ya existe conserva su color: el color sigue a la ruta.
  const previo = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : null;
  const color = previo?.ruta?.color ?? PALETA_RUTAS[i % PALETA_RUTAS.length].hex;
  return { ...construirRuta(g, correcciones, color), archivo, previo };
});
marcarDuplicados(rutas);

let escritas = 0;
const omitidas = [];
const problemas = [];
for (const { id, datos, avisos, archivo, previo } of rutas) {
  const errores = validarRuta(datos, id);
  if (errores.length) {
    problemas.push(`${id}: ${errores.join(' ')}`);
    continue;
  }
  if (previo && previo.ruta?.fuente !== FUENTE_IMIPE && !values.forzar) {
    omitidas.push(`${id} (${previo.ruta?.fuente ?? 'sin fuente'})`);
    continue;
  }
  writeFileSync(archivo, aJSONLegible(datos));
  escritas++;
  for (const aviso of avisos) console.log(`  ⚠ ${id}: ${aviso}`);
}

writeFileSync('data/paradas.geojson', aJSONLegible(convertirParadas(paradasFuente.features)));

if (problemas.length) {
  console.error(`✗ Rutas con errores (no se escribieron):\n  - ${problemas.join('\n  - ')}`);
  process.exitCode = 1;
}
const urbanas = rutas.filter((r) => r.datos.ruta.servicio === 'urbana').length;
console.log(`✓ ${escritas} rutas escritas en data/rutas/ (${urbanas} urbanas, ${rutas.length - urbanas} suburbanas en la fuente)`);
console.log(`✓ ${paradasFuente.features.length} paradas en data/paradas.geojson`);
if (omitidas.length) console.log(`  Se respetaron rutas del equipo con el mismo número: ${omitidas.join(', ')}. Usa --forzar para reemplazarlas.`);
