import { formatoDistancia, minutosCaminando, type RutaCercana, type ResultadoCercania } from '../cercania';
import { urlReporte } from '../config';
import type { Lugar } from '../lugares';
import type { Parada, Ruta, Sentido, Servicio } from '../tipos';
import { icono } from './iconos';

export interface EstadoLugares {
  estado: 'cargando' | 'listo' | 'error';
  resultados: Lugar[];
}

/** Ruta abierta desde la vista de destino: la ficha dice dónde bajarse. */
export interface ContextoDestino {
  nombre: string;
  hash: string;
  cercana: RutaCercana | null;
}

const esc = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const colorSeguro = (hex: string) => (/^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#5E6B72');
const estiloRuta = (ruta: Ruta) => `style="--color-ruta: ${colorSeguro(ruta.color)}"`;
const insignia = (ruta: Ruta, clase = '') => `<span class="insignia ${clase}" ${estiloRuta(ruta)}>${esc(ruta.numero)}</span>`;

export const nombreTipo = (ruta: Ruta) => (ruta.tipo === 'circuito' ? 'Circuito' : 'Ida y regreso');
const NOMBRE_SERVICIO: Record<Servicio, string> = { urbana: 'Urbana', suburbana: 'Suburbana' };
const TITULO_SERVICIO: Record<Servicio, string> = { urbana: 'Rutas urbanas', suburbana: 'Rutas suburbanas' };
const meta = (ruta: Ruta) => [ruta.servicio ? NOMBRE_SERVICIO[ruta.servicio] : null, nombreTipo(ruta)].filter(Boolean).join(' · ');

/** "2023-03" → "mar 2023" */
export function fechaCorta(valor: string | null): string | null {
  if (!valor) return null;
  const [anio, mes] = valor.split('-').map(Number);
  if (!mes) return String(anio);
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }).replace('.', '');
}

export function etiquetaSentido(ruta: Ruta, sentido: Sentido): string {
  const propio = ruta.nombresSentido?.[sentido];
  if (propio) return propio;
  if (sentido === 'ida') return ruta.destino ? `Hacia ${ruta.destino}` : 'Ida';
  if (sentido === 'regreso') return ruta.origen ? `Hacia ${ruta.origen}` : 'Regreso';
  return 'Circuito';
}

export function htmlCargando(): string {
  const fila = '<li class="ruta-item ruta-item--cargando"><span class="insignia"></span><span class="ruta-item__texto"><span></span><span></span></span></li>';
  return `<div class="lista" aria-busy="true"><p class="sr-only">Cargando rutas…</p><ul class="rutas">${fila.repeat(4)}</ul></div>`;
}

export function htmlError(mensaje: string): string {
  return `<div class="vacio" role="alert">
    <p class="vacio__titulo">No se pudieron cargar las rutas</p>
    <p>${esc(mensaje)}</p>
    <button class="boton boton--secundario" data-accion="reintentar">Reintentar</button>
  </div>`;
}

const itemRuta = (r: Ruta, motivo: string | null = null) => `<li><button class="ruta-item" data-ruta="${esc(r.id)}" ${estiloRuta(r)}>
    ${insignia(r)}
    <span class="ruta-item__texto">
      <span class="ruta-item__nombre">${esc(r.nombre)}</span>
      <span class="ruta-item__meta">${motivo ? `Para en: <strong>${esc(motivo)}</strong>` : esc(meta(r))}</span>
    </span>
    ${icono.siguiente}
  </button></li>`;

interface OpcionesLista {
  rutas: Ruta[];
  total: number;
  consulta: string;
  aqui: boolean;
  servicio: Servicio | null;
  conteo: Record<Servicio, number>;
  instalable: boolean;
  /** Por qué apareció una ruta en la búsqueda, si fue por una de sus paradas. */
  motivo?: (ruta: Ruta) => string | null;
  /** Lugares encontrados para la búsqueda (null: la búsqueda no es de lugares). */
  lugares?: EstadoLugares | null;
}

function seccionLugares(lugares: EstadoLugares | null | undefined): string {
  if (!lugares) return '';
  if (lugares.estado === 'cargando' && !lugares.resultados.length) {
    return `<div class="lista__encabezado"><h2 class="titulo-seccion">Lugares</h2><span class="contador">Buscando…</span></div>`;
  }
  if (lugares.estado === 'error') {
    return `<p class="lugares-aviso">No se pudo buscar lugares (¿sin internet?). Las rutas sí funcionan sin conexión.</p>`;
  }
  if (!lugares.resultados.length) return '';
  return `<div class="lista__encabezado"><h2 class="titulo-seccion">Lugares</h2><span class="contador">¿Qué ruta te deja cerca?</span></div>
    <ul class="rutas">${lugares.resultados
      .map(
        (l) => `<li><button class="lugar-item" data-lugar="${l.coordenadas[1]},${l.coordenadas[0]}" data-nombre="${esc(l.nombre)}">
          <span class="lugar-item__icono">${icono.lugar}</span>
          <span class="ruta-item__texto">
            <span class="ruta-item__nombre">${esc(l.nombre)}</span>
            ${l.detalle ? `<span class="ruta-item__meta">${esc(l.detalle)}</span>` : ''}
          </span>
          ${icono.siguiente}
        </button></li>`,
      )
      .join('')}</ul>`;
}

function filtros(servicio: Servicio | null, conteo: Record<Servicio, number>, total: number): string {
  const opciones: [Servicio | '', string, number][] = [
    ['', 'Todas', total],
    ['urbana', 'Urbanas', conteo.urbana],
    ['suburbana', 'Suburbanas', conteo.suburbana],
  ];
  return `<div class="filtros" role="group" aria-label="Tipo de servicio">
    ${opciones
      .map(
        ([valor, texto, n]) =>
          `<button class="filtro" type="button" data-servicio="${valor}" aria-pressed="${(servicio ?? '') === valor}">${texto} <span class="filtro__n">${n}</span></button>`,
      )
      .join('')}
  </div>`;
}

export function htmlLista({ rutas, total, consulta, aqui, servicio, conteo, instalable, motivo, lugares }: OpcionesLista): string {
  let encabezado: string;
  if (aqui) {
    encabezado = `<h2 class="titulo-seccion">Pasan por aquí</h2>
      <button class="boton-texto" data-accion="ver-todas">Ver todas</button>`;
  } else if (consulta) {
    encabezado = rutas.length || !lugares?.resultados.length
      ? `<h2 class="titulo-seccion">${lugares ? 'Rutas' : 'Resultados'}</h2><span class="contador">${rutas.length} de ${total}</span>`
      : '';
  } else {
    encabezado = `<h2 class="titulo-seccion">${servicio ? TITULO_SERVICIO[servicio] : 'Rutas de Celaya'}</h2><span class="contador">${rutas.length} ${rutas.length === 1 ? 'ruta' : 'rutas'}</span>`;
  }

  // Sin búsqueda ni filtro, la lista se separa en urbanas y suburbanas.
  const agrupar = !aqui && !consulta && !servicio;
  let cuerpo: string;
  if (agrupar) {
    const grupos: [string, Ruta[]][] = [
      ['Urbanas', rutas.filter((r) => r.servicio !== 'suburbana')],
      ['Suburbanas', rutas.filter((r) => r.servicio === 'suburbana')],
    ];
    cuerpo = grupos
      .filter(([, lista]) => lista.length)
      .map(([titulo, lista]) => `<h3 class="subtitulo-lista">${titulo}</h3><ul class="rutas">${lista.map((r) => itemRuta(r)).join('')}</ul>`)
      .join('');
  } else {
    cuerpo = `<ul class="rutas">${rutas.map((r) => itemRuta(r, consulta && motivo ? motivo(r) : null)).join('')}</ul>`;
  }

  const hayLugares = Boolean(lugares?.resultados.length) || lugares?.estado === 'cargando';
  const vacio = !rutas.length && !hayLugares
    ? `<div class="vacio">
        <p class="vacio__titulo">No encontramos “${esc(consulta)}”</p>
        <p>Prueba con el número de la ruta (por ejemplo, <strong>47</strong>), una colonia, una calle o un lugar como una escuela o un hospital.</p>
      </div>`
    : '';

  const propuesta = urlReporte('Nueva ruta: ', 'Número de ruta:\nDe dónde a dónde va:\nCalles o lugares por donde pasa:\n');

  return `<div class="lista">
    ${aqui ? '' : filtros(servicio, conteo, total)}
    ${consulta ? seccionLugares(lugares) : ''}
    ${encabezado ? `<div class="lista__encabezado">${encabezado}</div>` : ''}
    ${aqui ? '<p class="lista__ayuda">Toca una para ver su recorrido.</p>' : ''}
    ${cuerpo}
    ${vacio}
    <aside class="tarjeta-ayuda">
      <p><strong>¿Falta tu ruta o cambió su recorrido?</strong> Los trazos oficiales son de 2021. Si conoces un cambio, ayúdanos a corregirlo.</p>
      <a class="boton boton--secundario" href="${esc(propuesta)}" target="_blank" rel="noopener">${icono.agregar} Proponer una ruta</a>
    </aside>
    ${instalable ? `<button class="boton boton--fantasma boton--ancho" data-accion="instalar">${icono.instalar} Instalar AppRutas en tu teléfono</button>` : ''}
  </div>`;
}

function dato(simbolo: string, titulo: string, valor: string | null): string {
  return `<div class="dato">
    <dt>${simbolo}<span>${titulo}</span></dt>
    <dd${valor ? '' : ' class="dato--pendiente"'}>${valor ? esc(valor) : 'Por confirmar'}</dd>
  </div>`;
}

function seccionParadas(ruta: Ruta, sentido: Sentido, paradasPorId: Map<string, Parada>): string {
  const lista = (ruta.paradas?.[sentido] ?? []).map((id) => paradasPorId.get(id)).filter((p): p is Parada => Boolean(p));
  if (!lista.length) return '';
  return `<details class="seccion paradas"${lista.length <= 12 ? ' open' : ''}>
    <summary class="paradas__resumen">
      <span class="titulo-seccion">Paradas en este sentido</span>
      <span class="contador">${lista.length}</span>
    </summary>
    <ol class="paradas__lista">${lista
      .map(
        (p) => `<li><button class="parada" data-punto="${p.coordenadas.join(',')}">
          <span class="parada__marca"></span>
          <span class="parada__texto"><span class="parada__nombre">${esc(p.nombre)}</span>${p.ubicacion && p.ubicacion !== p.nombre ? `<span class="parada__ubicacion">${esc(p.ubicacion)}</span>` : ''}</span>
        </button></li>`,
      )
      .join('')}</ol>
    <p class="paradas__nota">Paradas oficiales a menos de 30 m del recorrido; algunas pueden ser del sentido contrario.</p>
  </details>`;
}

export function htmlDetalle(ruta: Ruta, sentido: Sentido, paradasPorId: Map<string, Parada>, destino: ContextoDestino | null = null): string {
  const dosSentidos = ruta.sentidos.length > 1;
  const selector = dosSentidos
    ? `<div class="sentidos" role="group" aria-label="Sentido del recorrido">
        ${ruta.sentidos
          .map(
            (s) =>
              `<button class="sentidos__opcion" data-sentido="${s}" aria-pressed="${s === sentido}">${esc(etiquetaSentido(ruta, s))}</button>`,
          )
          .join('')}
      </div>
      <p class="leyenda">
        <span class="leyenda__item"><span class="leyenda__linea"></span>${esc(etiquetaSentido(ruta, sentido))}</span>
        <span class="leyenda__item"><span class="leyenda__linea leyenda__linea--punteada"></span>Sentido contrario</span>
      </p>`
    : '';

  const lugares = ruta.puntos.length
    ? `<section class="seccion">
        <h3 class="titulo-seccion">Puntos de referencia</h3>
        <ul class="lugares">${ruta.puntos
          .map(
            (p) => `<li><button class="lugar" data-punto="${p.coordenadas.join(',')}">
              <span class="lugar__marca lugar__marca--${p.tipo}"></span>${esc(p.nombre)}
            </button></li>`,
          )
          .join('')}</ul>
      </section>`
    : '';

  const notas = ruta.notas ? `<p class="nota">${icono.info}<span>${esc(ruta.notas)}</span></p>` : '';
  const verificado = fechaCorta(ruta.verificado);
  const fuente = ruta.fuente ? `Fuente: ${ruta.fuente}.` : verificado ? `Trazado en ${verificado}.` : '';
  const reporte = urlReporte(
    `Error en la ruta ${ruta.numero}`,
    `Ruta: ${ruta.numero} – ${ruta.nombre}\n¿Qué está mal? (calle, sentido, parada, horario...):\n`,
  );

  const volver = destino ? `Rutas cerca de ${destino.nombre}` : 'Todas las rutas';
  let aviso = '';
  if (destino?.cercana) {
    const c = destino.cercana;
    const bajada = c.parada && c.parada.metros <= Math.max(c.metros * 2, 400)
      ? `Bájate en <strong>${esc(c.parada.parada.nombre)}</strong>, a ${formatoDistancia(c.parada.metros)} (≈ ${minutosCaminando(c.parada.metros)} min a pie).`
      : `La ruta pasa a ${formatoDistancia(c.metros)} (≈ ${minutosCaminando(c.metros)} min a pie).`;
    aviso = `<p class="nota nota--destino">${icono.lugar}<span>Para llegar a <strong>${esc(destino.nombre)}</strong>: ${bajada}</span></p>`;
  }

  return `<article class="detalle" ${estiloRuta(ruta)} aria-labelledby="titulo-ruta">
    <button class="boton-texto detalle__volver" data-accion="volver"><span class="detalle__volver-texto">${icono.atras}${esc(volver)}</span></button>
    <header class="detalle__cabecera">
      ${insignia(ruta, 'insignia--grande')}
      <div>
        <p class="detalle__sobretitulo">Ruta ${esc(ruta.numero)} · ${esc(meta(ruta))}</p>
        <h2 class="detalle__titulo" id="titulo-ruta" tabindex="-1">${esc(ruta.nombre)}</h2>
      </div>
    </header>
    ${aviso}
    ${selector}
    ${ruta.descripcion ? `<p class="detalle__descripcion">${esc(ruta.descripcion)}</p>` : ''}
    ${notas}
    <dl class="datos">
      ${dato(icono.frecuencia, 'Frecuencia', ruta.frecuencia)}
      ${dato(icono.reloj, 'Horario', ruta.horario)}
      ${dato(icono.tarifa, 'Tarifa', ruta.tarifa)}
    </dl>
    ${seccionParadas(ruta, sentido, paradasPorId)}
    ${lugares}
    <div class="acciones">
      <button class="boton boton--primario" data-accion="compartir">${icono.compartir}Compartir</button>
      <a class="boton boton--secundario" href="${esc(reporte)}" target="_blank" rel="noopener">${icono.reportar}Reportar error</a>
    </div>
    <p class="detalle__fuente">Recorrido aproximado. ${esc(fuente)} Puede haber cambiado: si notas algo distinto, avísanos.</p>
  </article>`;
}

/** Cuántas rutas se muestran (y resaltan) de entrada en la vista de destino. */
export const RUTAS_DESTINO_INICIALES = 12;

/** "¿Qué ruta me deja más cerca de…?": rutas ordenadas por la distancia a la que pasan del destino. */
export function htmlDestino(nombre: string, { cercanas, fueraDeRadio }: ResultadoCercania, mostrarTodas = false): string {
  const visibles = mostrarTodas ? cercanas : cercanas.slice(0, RUTAS_DESTINO_INICIALES);
  const ocultas = cercanas.length - visibles.length;
  const items = visibles
    .map((c) => {
      const pasa = `Pasa a ${formatoDistancia(c.metros)} · ≈ ${minutosCaminando(c.metros)} min a pie`;
      const parada = c.parada && c.parada.metros <= Math.max(c.metros * 2, 400)
        ? `<span class="ruta-item__meta">Bájate en: <strong>${esc(c.parada.parada.nombre)}</strong> (${formatoDistancia(c.parada.metros)})</span>`
        : '';
      return `<li><button class="ruta-item" data-ruta="${esc(c.ruta.id)}" data-sentido-destino="${c.sentido}" ${estiloRuta(c.ruta)}>
        ${insignia(c.ruta)}
        <span class="ruta-item__texto">
          <span class="ruta-item__nombre">${esc(c.ruta.nombre)}</span>
          <span class="ruta-item__meta">${pasa}</span>
          ${parada}
        </span>
        ${icono.siguiente}
      </button></li>`;
    })
    .join('');
  const aviso = fueraDeRadio && cercanas.length
    ? `<p class="nota">${icono.info}<span>Ninguna ruta pasa a menos de 1 km de este lugar. Estas son las más cercanas.</span></p>`
    : '';
  return `<div class="destino">
    <div class="destino__barra">
      <button class="boton-texto" data-accion="cerrar-destino">${icono.atras}Todas las rutas</button>
    </div>
    <header class="destino__cabecera">
      <span class="destino__icono">${icono.lugar}</span>
      <div>
        <p class="detalle__sobretitulo">Rutas que te dejan cerca de</p>
        <h2 class="detalle__titulo" id="titulo-destino" tabindex="-1">${esc(nombre)}</h2>
      </div>
    </header>
    ${aviso}
    <div class="lista__encabezado"><h2 class="titulo-seccion">${fueraDeRadio ? 'Las más cercanas' : 'Pasan cerca'}</h2><span class="contador">${cercanas.length} ${cercanas.length === 1 ? 'ruta' : 'rutas'}</span></div>
    <ul class="rutas">${items}</ul>
    ${ocultas > 0 ? `<button class="boton boton--fantasma boton--ancho" data-accion="destino-todas">Ver las otras ${ocultas} rutas (más lejos)</button>` : ''}
    <p class="detalle__fuente">Distancia en línea recta hasta donde pasa la ruta; caminando puede ser un poco más. Toca una ruta para ver su recorrido.</p>
  </div>`;
}
