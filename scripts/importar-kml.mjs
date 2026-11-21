#!/usr/bin/env node
// Importa una ruta trazada en Google My Maps.
//
// 1. En My Maps: menú ⋮ → "Exportar a KML/KMZ" → marca "Exportar a un archivo .KML".
// 2. npm run importar-kml -- mi-ruta.kml --numero 62 --nombre "Centro – Las Insurgentes"
// 3. Revisa data/rutas/62.geojson y completa origen, destino, horario, etc.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { kmlARuta } from './lib/kml.mjs';
import { PALETA_RUTAS, aJSONLegible, validarRuta } from './lib/rutas.mjs';

const CARPETA = 'data/rutas';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    numero: { type: 'string' },
    id: { type: 'string' },
    nombre: { type: 'string' },
    color: { type: 'string' },
    forzar: { type: 'boolean', default: false },
  },
});

const [archivo] = positionals;
if (!archivo || !values.numero) {
  console.error('Uso: npm run importar-kml -- <archivo.kml> --numero 62 [--nombre "Origen – Destino"] [--color "#1F63CF"] [--forzar]');
  process.exit(1);
}

const id = values.id ?? values.numero.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const destino = join(CARPETA, `${id}.geojson`);
if (existsSync(destino) && !values.forzar) {
  console.error(`Ya existe ${destino}. Usa --forzar para reemplazarlo.`);
  process.exit(1);
}

// Si no se indica color, se toma el siguiente de la paleta que nadie use todavía.
const usados = new Set(
  readdirSync(CARPETA)
    .filter((f) => f.endsWith('.geojson') && f !== `${id}.geojson`)
    .map((f) => JSON.parse(readFileSync(join(CARPETA, f), 'utf8')).ruta?.color?.toUpperCase()),
);
const libre = PALETA_RUTAS.find((c) => !usados.has(c.hex));
const color = values.color ?? (libre ?? PALETA_RUTAS[usados.size % PALETA_RUTAS.length]).hex;
if (!values.color && !libre) console.warn('⚠ Ya se usaron los 8 colores de la paleta: el color se repetirá (el número de ruta la distingue).');

const { datos, avisos } = kmlARuta(readFileSync(archivo, 'utf8'), { id, numero: values.numero, nombre: values.nombre, color });
const errores = validarRuta(datos, id);
if (errores.length) {
  console.error(`✗ ${basename(archivo)} no pasó la validación:\n  - ${errores.join('\n  - ')}`);
  process.exit(1);
}

writeFileSync(destino, aJSONLegible(datos));
const recorridos = datos.features.filter((f) => f.properties.tipo === 'recorrido');
console.log(`✓ ${destino}: ruta ${datos.ruta.numero} (${datos.ruta.tipo}), ${recorridos.map((f) => `${f.properties.sentido} ${f.geometry.coordinates.length} pts`).join(', ')}`);
for (const aviso of avisos) console.log(`  ⚠ ${aviso}`);
console.log('  Siguiente paso: completa origen, destino, horario y tarifa en el archivo.');
