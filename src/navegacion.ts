import type { Sentido, Vista } from './tipos';

const SENTIDOS: Sentido[] = ['ida', 'regreso', 'circuito'];
export const NOMBRE_PUNTO = 'Punto en el mapa';

/**
 * "#/ruta/61/regreso" → { tipo: 'ruta', id: '61', sentido: 'regreso' }
 * "#/destino/20.52350,-100.81570/Mercado%20Hidalgo" → { tipo: 'destino', lat, lng, nombre }
 */
export function leerHash(hash: string): Vista {
  const crudas = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let partes: string[];
  try {
    partes = crudas.map(decodeURIComponent);
  } catch {
    return { tipo: 'lista' };
  }
  if (partes[0] === 'ruta' && partes[1]) {
    const sentido = SENTIDOS.find((s) => s === partes[2]);
    return sentido ? { tipo: 'ruta', id: partes[1], sentido } : { tipo: 'ruta', id: partes[1] };
  }
  if (partes[0] === 'destino' && partes[1]) {
    const [lat, lng] = partes[1].split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { tipo: 'destino', lat, lng, nombre: partes.slice(2).join('/').trim() || NOMBRE_PUNTO };
    }
  }
  return { tipo: 'lista' };
}

export function hashDe(vista: Vista): string {
  if (vista.tipo === 'lista') return '#/';
  if (vista.tipo === 'destino') return `#/destino/${vista.lat.toFixed(5)},${vista.lng.toFixed(5)}/${encodeURIComponent(vista.nombre)}`;
  const base = `#/ruta/${encodeURIComponent(vista.id)}`;
  return vista.sentido && vista.sentido !== 'ida' && vista.sentido !== 'circuito' ? `${base}/${vista.sentido}` : base;
}
