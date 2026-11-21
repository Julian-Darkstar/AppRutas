#!/usr/bin/env node
// Genera los PNG de la PWA a partir de los SVG de marca/ (requiere ImageMagick con librsvg).
// Solo hace falta correrlo si cambia el logo; los PNG se guardan en el repositorio.
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';

const png = (svg, tam, salida) =>
  execFileSync('magick', ['-background', 'none', '-density', '1200', svg, '-resize', `${tam}x${tam}`, `PNG32:${salida}`]);

png('marca/icono-app.svg', 192, 'public/icons/icon-192.png');
png('marca/icono-app.svg', 512, 'public/icons/icon-512.png');
png('marca/icono-maskable.svg', 512, 'public/icons/icon-maskable-512.png');
png('marca/icono-maskable.svg', 180, 'public/icons/apple-touch-icon.png');
png('marca/icono-app.svg', 48, 'public/icons/favicon-48.png');
execFileSync('magick', ['-background', 'none', '-density', '1200', 'marca/icono-app.svg', '-define', 'icon:auto-resize=48,32,16', 'public/favicon.ico']);
copyFileSync('marca/icono-app.svg', 'public/favicon.svg');
console.log('✓ Iconos generados en public/icons y public/favicon.*');
