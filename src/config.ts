// Ajustes del proyecto que conviene tener en un solo lugar.

export const REPOSITORIO = 'https://github.com/Julian-Darkstar/AppRutas';

/** Buscador de lugares (Photon de komoot, datos de OpenStreetMap). */
export const URL_GEOCODIFICADOR = 'https://photon.komoot.io';
/** Municipio de Celaya y alrededores: [oeste, sur, este, norte]. Los lugares se buscan solo aquí. */
export const CAJA_CELAYA: [number, number, number, number] = [-100.98, 20.36, -100.66, 20.68];
/** Centro de Celaya [lng, lat]: los resultados cercanos salen primero. */
export const CENTRO_CELAYA: [number, number] = [-100.8157, 20.5235];

/**
 * Dónde se reportan errores y se proponen rutas. Por ahora, issues de GitHub;
 * si después usan un formulario (Google Forms, Tally...), basta con cambiar esto.
 */
export function urlReporte(titulo: string, cuerpo: string): string {
  const q = new URLSearchParams({ title: titulo, body: cuerpo });
  return `${REPOSITORIO}/issues/new?${q}`;
}
