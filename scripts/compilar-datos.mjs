#!/usr/bin/env node
// Valida data/rutas/*.geojson y genera public/data/rutas.json, el único
// archivo de datos que descarga la app. Corre solo antes de `dev` y `build`.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agruparRutas, validarParadas, validarRuta } from './lib/rutas.mjs';

const ENTRADA = 'data/rutas';
const PARADAS = 'data/paradas.geojson';
const SALIDA = 'public/data/rutas.json';

const archivos = readdirSync(ENTRADA).filter((f) => f.endsWith('.geojson')).sort();
const rutas = [];
const problemas = [];

for (const archivo of archivos) {
  const id = archivo.replace(/\.geojson$/, '');
  let datos;
  try {
    datos = JSON.parse(readFileSync(join(ENTRADA, archivo), 'utf8'));
  } catch (e) {
    problemas.push(`${archivo}: no es JSON válido (${e.message}).`);
    continue;
  }
  const errores = validarRuta(datos, id);
  if (errores.length) problemas.push(...errores.map((e) => `${archivo}: ${e}`));
  else rutas.push(datos);
}

const repetidos = (campo) => {
  const vistos = new Map();
  for (const r of rutas) {
    const valor = r.ruta[campo].toLowerCase();
    if (vistos.has(valor)) problemas.push(`El ${campo} "${r.ruta[campo]}" se repite en las rutas ${vistos.get(valor)} y ${r.ruta.id}.`);
    vistos.set(valor, r.ruta.id);
  }
};
repetidos('numero');

let paradas = null;
if (existsSync(PARADAS)) {
  try {
    paradas = JSON.parse(readFileSync(PARADAS, 'utf8'));
    problemas.push(...validarParadas(paradas).map((e) => `paradas.geojson: ${e}`));
  } catch (e) {
    problemas.push(`paradas.geojson: no es JSON válido (${e.message}).`);
  }
}

if (problemas.length) {
  console.error(`✗ Hay errores en los datos de rutas:\n  - ${problemas.join('\n  - ')}`);
  process.exit(1);
}

const salida = { ...agruparRutas(rutas, paradas), generado: new Date().toISOString() };
mkdirSync('public/data', { recursive: true });
writeFileSync(SALIDA, JSON.stringify(salida));
const kb = (Buffer.byteLength(JSON.stringify(salida)) / 1024).toFixed(1);
console.log(`✓ ${rutas.length} rutas y ${salida.paradas.length} paradas → ${SALIDA} (${kb} KB)`);
