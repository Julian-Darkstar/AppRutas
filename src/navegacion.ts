import type { Sentido, Vista } from './tipos';

const SENTIDOS: Sentido[] = ['ida', 'regreso', 'circuito'];

/** "#/ruta/61/regreso" → { tipo: 'ruta', id: '61', sentido: 'regreso' } */
export function leerHash(hash: string): Vista {
  const partes = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (partes[0] === 'ruta' && partes[1]) {
    const sentido = SENTIDOS.find((s) => s === partes[2]);
    return sentido ? { tipo: 'ruta', id: partes[1], sentido } : { tipo: 'ruta', id: partes[1] };
  }
  return { tipo: 'lista' };
}

export function hashDe(vista: Vista): string {
  if (vista.tipo === 'lista') return '#/';
  const base = `#/ruta/${encodeURIComponent(vista.id)}`;
  return vista.sentido && vista.sentido !== 'ida' && vista.sentido !== 'circuito' ? `${base}/${vista.sentido}` : base;
}
