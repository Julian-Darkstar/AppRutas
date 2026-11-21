import type { Parada, Ruta } from './tipos';

/** Minúsculas, sin acentos ni signos: "Misión 15-A" → "mision 15 a". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const compacto = (texto: string) => normalizar(texto).replace(/ /g, '');

interface Indexada {
  ruta: Ruta;
  numero: string;
  principal: string;
  todo: string;
}

/**
 * Prepara las rutas una sola vez para buscar rápido en cada tecla. Incluye los nombres de sus paradas:
 * buscar "Estadio" encuentra las rutas que paran ahí.
 */
export function crearIndice(rutas: Ruta[], paradas: Parada[] = []): Indexada[] {
  const nombreParada = new Map(paradas.map((p) => [p.id, p.nombre]));
  return rutas.map((ruta) => {
    const principal = normalizar([ruta.nombre, ruta.origen, ruta.destino].filter(Boolean).join(' '));
    const idsParadas = new Set(Object.values(ruta.paradas ?? {}).flat());
    const extra = normalizar(
      [
        ruta.descripcion ?? '',
        ruta.servicio ?? '',
        ...ruta.palabrasClave,
        ...ruta.puntos.map((p) => p.nombre),
        ...Object.values(ruta.nombresSentido ?? {}),
        ...[...idsParadas].map((id) => nombreParada.get(id) ?? ''),
      ].join(' '),
    );
    const numero = compacto(ruta.numero);
    return { ruta, numero, principal, todo: `ruta ${normalizar(ruta.numero)} ${numero} ${principal} ${extra}` };
  });
}

/**
 * Si la ruta coincide con la búsqueda solo por una de sus paradas, devuelve el nombre de esa parada
 * (para mostrar "Para en: …" y que se entienda por qué apareció).
 */
export function paradaQueCoincide(ruta: Ruta, consulta: string, nombreParada: (id: string) => string | undefined): string | null {
  const palabras = normalizar(consulta).split(' ').filter(Boolean);
  if (!palabras.length) return null;
  const propio = normalizar([ruta.numero, ruta.nombre, ruta.origen, ruta.destino, ruta.descripcion, ...ruta.palabrasClave].filter(Boolean).join(' '));
  if (palabras.every((p) => propio.includes(p))) return null;
  for (const id of new Set(Object.values(ruta.paradas ?? {}).flat())) {
    const nombre = nombreParada(id);
    if (nombre && palabras.every((p) => normalizar(nombre).includes(p))) return nombre;
  }
  return null;
}

/**
 * Busca por número, nombre, origen/destino, palabras clave y lugares.
 * Todas las palabras de la búsqueda deben aparecer; el número exacto va primero.
 */
export function buscar(indice: Indexada[], consulta: string): Ruta[] {
  const q = normalizar(consulta);
  if (!q) return indice.map((i) => i.ruta);
  const palabras = q.split(' ');
  const qCompacta = q.replace(/ /g, '');

  const puntuadas: { ruta: Ruta; puntos: number }[] = [];
  for (const item of indice) {
    const coincide = palabras.every((p) => item.todo.includes(p)) || item.numero === qCompacta;
    if (!coincide) continue;
    let puntos = 0;
    if (item.numero === qCompacta) puntos += 100;
    else if (item.numero.startsWith(qCompacta)) puntos += 60;
    if (palabras.every((p) => item.principal.includes(p))) puntos += 20;
    puntos += palabras.filter((p) => new RegExp(`\\b${p}`).test(item.principal)).length * 5;
    puntuadas.push({ ruta: item.ruta, puntos });
  }
  return puntuadas.sort((a, b) => b.puntos - a.puntos).map((p) => p.ruta);
}
