// Ajustes del proyecto que conviene tener en un solo lugar.

export const REPOSITORIO = 'https://github.com/Julian-Darkstar/AppRutas';

/**
 * Dónde se reportan errores y se proponen rutas. Por ahora, issues de GitHub;
 * si después usan un formulario (Google Forms, Tally...), basta con cambiar esto.
 */
export function urlReporte(titulo: string, cuerpo: string): string {
  const q = new URLSearchParams({ title: titulo, body: cuerpo });
  return `${REPOSITORIO}/issues/new?${q}`;
}
