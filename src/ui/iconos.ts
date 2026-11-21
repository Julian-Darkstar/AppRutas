// Iconos de trazo (24×24, color del texto). En línea para no pedir archivos extra.
const svg = (cuerpo: string) =>
  `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;

export const icono = {
  buscar: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  cerrar: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  atras: svg('<path d="M15 18l-6-6 6-6"/>'),
  siguiente: svg('<path d="m9 18 6-6-6-6"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
  compartir: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  reportar: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  reloj: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  frecuencia: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  tarifa: svg('<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8m0 8v1.5"/>'),
  lugar: svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  instalar: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  agregar: svg('<path d="M12 5v14M5 12h14"/>'),
};

/** Símbolo de la marca: trazo de ruta con origen (ámbar) y destino. */
export const simboloMarca = `<svg class="marca__simbolo" viewBox="12 10 40 44" aria-hidden="true" focusable="false">
  <path d="M20 46V36a6 6 0 0 1 6-6h12a6 6 0 0 0 6-6v-6" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="20" cy="46" r="6.5" fill="var(--cajeta-400)"/>
  <circle cx="44" cy="18" r="6.5" fill="currentColor"/>
  <circle cx="44" cy="18" r="2.6" fill="var(--superficie)"/>
</svg>`;
