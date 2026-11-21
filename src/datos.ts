import type { DatosRutas } from './tipos';

/** Descarga public/data/rutas.json (generado por scripts/compilar-datos.mjs). */
export async function cargarDatos(): Promise<DatosRutas> {
  const respuesta = await fetch(new URL('data/rutas.json', document.baseURI));
  if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`);
  return (await respuesta.json()) as DatosRutas;
}
