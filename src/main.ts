import '@fontsource-variable/atkinson-hyperlegible-next';
import './estilos/app.css';

import { buscar, crearIndice, paradaQueCoincide } from './busqueda';
import { cercaniaEnSentido, puntoDeBajada, rutasCercanas, type ResultadoCercania } from './cercania';
import { cargarDatos } from './datos';
import { cargarEstiloBase } from './mapa/estilo-base';
import type { MapaRutas } from './mapa/mapa';
import { buscarLugares, esNumeroDeRuta, nombrarPunto } from './lugares';
import { NOMBRE_PUNTO, hashDe, leerHash } from './navegacion';
import type { DatosRutas, Parada, Ruta, Sentido, Servicio } from './tipos';
import { avisar } from './ui/aviso';
import { Hoja } from './ui/hoja';
import { icono, simboloMarca } from './ui/iconos';
import { RUTAS_DESTINO_INICIALES, htmlCargando, htmlDestino, htmlDetalle, htmlError, htmlLista, type EstadoLugares } from './ui/panel';

interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const panel = $('#panel');
const contenido = $('#contenido');
const buscador = $<HTMLInputElement>('#buscar');
const limpiar = $<HTMLButtonElement>('#limpiar');
const contenedorMapa = $('#mapa');
const acerca = $<HTMLDialogElement>('#acerca');

$('#marca-simbolo').innerHTML = simboloMarca;
$('#icono-buscar').innerHTML = icono.buscar;
limpiar.innerHTML = icono.cerrar;
$('#btn-acerca').innerHTML = icono.info;

const estado = {
  consulta: '',
  aqui: null as { ids: string[]; lugar: [number, number] } | null,
  rutaEnMapa: null as string | null,
  servicio: null as Servicio | null,
  instalar: null as EventoInstalar | null,
  lugares: null as EstadoLugares | null,
  /** Último destino buscado ("¿qué ruta me deja cerca de…?") y sus rutas más cercanas. */
  destino: null as { lat: number; lng: number; nombre: string; hash: string; resultado: ResultadoCercania } | null,
  /** La ruta abierta viene de la vista de destino: su ficha dice dónde bajarse. */
  rutaDesdeDestino: false,
  /** Coordenadas del último destino encuadrado en el mapa. */
  encuadreDestino: '',
  /** En la vista de destino se pidió ver también las rutas más lejanas. */
  destinoTodas: false,
};

let datos: DatosRutas | null = null;
let indice: ReturnType<typeof crearIndice> = [];
let porId = new Map<string, Ruta>();
let paradasPorId = new Map<string, Parada>();
let conteo: Record<Servicio, number> = { urbana: 0, suburbana: 0 };
let mapa: MapaRutas | null = null;

const hoja = new Hoja(panel, $('#panel-fijo'), $<HTMLButtonElement>('.panel__asa'), () => {
  // Al cambiar el alto de la hoja, se vuelve a encuadrar la ruta elegida.
  const vista = leerHash(location.hash);
  const ruta = vista.tipo === 'ruta' ? porId.get(vista.id) : undefined;
  if (ruta && hoja.nivel !== 'max') setTimeout(() => mapa?.encuadrar(ruta.caja), 320);
  if (vista.tipo === 'destino' && estado.destino && hoja.nivel !== 'max') setTimeout(() => encuadrarDestino(), 320);
});

/** Puntos para encuadrar un destino: el lugar y por dónde pasan las rutas más cercanas. */
function encuadrarDestino() {
  const d = estado.destino;
  if (!d || !mapa) return;
  mapa.encuadrarPuntos([[d.lng, d.lat], ...d.resultado.cercanas.slice(0, 4).map((c) => c.punto)], 16);
  estado.encuadreDestino = `${d.lat},${d.lng}`;
}

/** Marcador, rutas resaltadas y encuadre de la vista de destino. */
function mostrarDestinoEnMapa(forzarEncuadre = false) {
  const d = estado.destino;
  if (!d || !mapa) return;
  mapa.marcar(null);
  mapa.seleccionar(null);
  mapa.caminata(null, null);
  mapa.marcarDestino([d.lng, d.lat]);
  // Se resaltan las rutas que están en la lista, no todas (en el centro pasan casi 50).
  const enLista = estado.destinoTodas ? d.resultado.cercanas : d.resultado.cercanas.slice(0, RUTAS_DESTINO_INICIALES);
  mapa.destacar(enLista.map((c) => c.ruta.id));
  if (forzarEncuadre || estado.encuadreDestino !== `${d.lat},${d.lng}`) encuadrarDestino();
}

function limpiarDestinoDelMapa() {
  mapa?.marcarDestino(null);
  mapa?.destacar(null);
  mapa?.caminata(null, null);
}

/** Espacio del mapa tapado por la interfaz, para encuadrar las rutas en la parte visible. */
function relleno() {
  const alto = contenedorMapa.clientHeight || innerHeight;
  // Margen amplio para que los nombres de paradas en las orillas no queden cortados.
  if (!hoja.activa()) return { top: 60, right: 100, bottom: 60, left: 100 };
  const arriba = 64;
  const abajo = Math.min(hoja.altoVisible() + 24, Math.max(alto - arriba - 140, 24));
  return { top: arriba, right: 28, bottom: abajo, left: 28 };
}

function irA(hash: string, reemplazar = false): void {
  if (location.hash === hash) return render();
  if (reemplazar) {
    history.replaceState(null, '', hash);
    render();
  } else location.hash = hash;
}

function render(): void {
  if (!datos) return;
  const vista = leerHash(location.hash);
  const ruta = vista.tipo === 'ruta' ? porId.get(vista.id) : undefined;

  if (vista.tipo === 'ruta' && !ruta) {
    avisar('Esa ruta no existe o cambió de nombre.');
    return irA('#/', true);
  }

  if (vista.tipo === 'destino') {
    const hash = hashDe(vista);
    if (estado.destino?.hash !== hash) {
      if (!estado.destino || estado.destino.lat !== vista.lat || estado.destino.lng !== vista.lng) estado.destinoTodas = false;
      estado.destino = { lat: vista.lat, lng: vista.lng, nombre: vista.nombre, hash, resultado: rutasCercanas([vista.lng, vista.lat], datos) };
    }
    const venia = estado.rutaEnMapa !== null || estado.aqui !== null;
    contenido.innerHTML = htmlDestino(estado.destino.nombre, estado.destino.resultado, estado.destinoTodas);
    contenido.scrollTop = 0;
    document.title = `Rutas cerca de ${estado.destino.nombre} · AppRutas`;
    estado.aqui = null;
    estado.rutaEnMapa = null;
    estado.rutaDesdeDestino = false;
    if (hoja.activa() && hoja.nivel !== 'media') hoja.fijar('media');
    // Al volver de la ficha de una ruta, el mapa regresa a la vista del destino.
    mostrarDestinoEnMapa(venia);
    return;
  }

  if (ruta) {
    const contexto = estado.rutaDesdeDestino && estado.destino ? estado.destino : null;
    const sentidoPedido = vista.tipo === 'ruta' && vista.sentido && ruta.sentidos.includes(vista.sentido) ? vista.sentido : null;
    const sentidoCercano = contexto?.resultado.cercanas.find((c) => c.ruta.id === ruta.id)?.sentido;
    const sentido: Sentido = sentidoPedido ?? (sentidoCercano && ruta.sentidos.includes(sentidoCercano) ? sentidoCercano : ruta.sentidos[0]);
    const esNueva = estado.rutaEnMapa !== ruta.id;
    const cercana = contexto ? cercaniaEnSentido([contexto.lng, contexto.lat], datos, ruta, sentido) : null;
    contenido.innerHTML = htmlDetalle(ruta, sentido, paradasPorId, contexto ? { nombre: contexto.nombre, hash: contexto.hash, cercana } : null);
    contenido.scrollTop = 0;
    document.title = `Ruta ${ruta.numero} · ${ruta.nombre} · AppRutas`;
    estado.aqui = null;
    mapa?.marcar(null);
    if (esNueva) {
      if (hoja.activa() && hoja.nivel !== 'media') hoja.fijar('media');
      if (document.activeElement !== buscador) $('#titulo-ruta').focus({ preventScroll: true });
    }
    estado.rutaEnMapa = ruta.id;
    mapa?.destacar(null);
    if (contexto && cercana) {
      const destino: [number, number] = [contexto.lng, contexto.lat];
      mapa?.marcarDestino(destino);
      mapa?.caminata(puntoDeBajada(cercana), destino);
      mapa?.seleccionar(ruta, sentido, false);
      if (esNueva) {
        const [o, s, e, n] = ruta.caja;
        mapa?.encuadrar([Math.min(o, contexto.lng), Math.min(s, contexto.lat), Math.max(e, contexto.lng), Math.max(n, contexto.lat)]);
      }
    } else {
      mapa?.marcarDestino(null);
      mapa?.caminata(null, null);
      mapa?.seleccionar(ruta, sentido, esNueva);
    }
    return;
  }

  // Lista: se olvida el destino.
  if (estado.destino) {
    estado.destino = null;
    estado.encuadreDestino = '';
    limpiarDestinoDelMapa();
  }
  estado.rutaDesdeDestino = false;

  const rutas = estado.aqui
    ? estado.aqui.ids.map((id) => porId.get(id)!).filter(Boolean)
    : buscar(indice, estado.consulta).filter((r) => !estado.servicio || r.servicio === estado.servicio);
  contenido.innerHTML = htmlLista({
    rutas,
    total: datos.rutas.length,
    consulta: estado.consulta,
    aqui: Boolean(estado.aqui),
    servicio: estado.servicio,
    conteo,
    instalable: Boolean(estado.instalar),
    motivo: (r) => paradaQueCoincide(r, estado.consulta, (id) => paradasPorId.get(id)?.nombre),
    lugares: estado.consulta ? estado.lugares : null,
  });
  document.title = 'AppRutas · Rutas de camión en Celaya';
  if (estado.rutaEnMapa) {
    estado.rutaEnMapa = null;
    mapa?.seleccionar(null);
    if (!estado.aqui) mapa?.verTodas();
  }
}

async function compartir(ruta: Ruta) {
  const url = location.href;
  const texto = `Ruta ${ruta.numero} (${ruta.nombre}): mira su recorrido en AppRutas`;
  try {
    if (navigator.share) await navigator.share({ title: `Ruta ${ruta.numero} · AppRutas`, text: texto, url });
    else {
      await navigator.clipboard.writeText(url);
      avisar('Enlace copiado');
    }
  } catch (error) {
    if ((error as DOMException).name !== 'AbortError') avisar('No se pudo compartir el enlace');
  }
}

// ── Eventos del panel ──────────────────────────────────────────────
contenido.addEventListener('click', async (e) => {
  const objetivo = (e.target as HTMLElement).closest<HTMLElement>('[data-ruta], [data-accion], [data-sentido], [data-punto], [data-servicio], [data-lugar]');
  if (!objetivo) return;
  const vista = leerHash(location.hash);

  if (objetivo.dataset.servicio !== undefined) {
    estado.servicio = (objetivo.dataset.servicio || null) as Servicio | null;
    mapa?.filtrarServicio(estado.servicio);
    return render();
  }

  if (objetivo.dataset.lugar) {
    const [lat, lng] = objetivo.dataset.lugar.split(',').map(Number);
    return elegirDestino(lat, lng, objetivo.dataset.nombre || NOMBRE_PUNTO);
  }
  if (objetivo.dataset.ruta) {
    estado.rutaDesdeDestino = vista.tipo === 'destino';
    return irA(hashDe({ tipo: 'ruta', id: objetivo.dataset.ruta }));
  }
  if (objetivo.dataset.sentido && vista.tipo === 'ruta') {
    return irA(hashDe({ tipo: 'ruta', id: vista.id, sentido: objetivo.dataset.sentido as Sentido }), true);
  }
  if (objetivo.dataset.punto) {
    const [lng, lat] = objetivo.dataset.punto.split(',').map(Number);
    return mapa?.irA([lng, lat]);
  }
  switch (objetivo.dataset.accion) {
    case 'volver':
      return irA(estado.rutaDesdeDestino && estado.destino ? estado.destino.hash : '#/');
    case 'cerrar-destino':
      return irA('#/');
    case 'destino-todas':
      estado.destinoTodas = true;
      return render();
    case 'ver-todas':
      estado.aqui = null;
      mapa?.marcar(null);
      mapa?.verTodas();
      return render();
    case 'compartir':
      if (vista.tipo === 'ruta' && porId.has(vista.id)) await compartir(porId.get(vista.id)!);
      return;
    case 'instalar':
      if (!estado.instalar) return;
      await estado.instalar.prompt();
      estado.instalar = null;
      return render();
    case 'reintentar':
      return iniciar();
  }
});

// ── Búsqueda ───────────────────────────────────────────────────────
let esperaLugares: number | undefined;
let peticionLugares: AbortController | null = null;

/** Busca lugares (con espera breve y cancelando la petición anterior) si la búsqueda no es un número de ruta. */
function pedirLugares(consulta: string) {
  clearTimeout(esperaLugares);
  peticionLugares?.abort();
  const q = consulta.trim();
  if (q.length < 3 || esNumeroDeRuta(q)) {
    estado.lugares = null;
    return;
  }
  estado.lugares = { estado: 'cargando', resultados: estado.lugares?.resultados ?? [] };
  esperaLugares = window.setTimeout(async () => {
    const peticion = (peticionLugares = new AbortController());
    try {
      const resultados = await buscarLugares(q, peticion.signal);
      if (estado.consulta.trim() !== q) return;
      estado.lugares = { estado: 'listo', resultados };
    } catch (error) {
      if ((error as DOMException).name === 'AbortError' || estado.consulta.trim() !== q) return;
      estado.lugares = { estado: 'error', resultados: [] };
    }
    if (leerHash(location.hash).tipo === 'lista') render();
  }, 350);
}

/** Abre "¿qué ruta me deja cerca de…?" para un lugar. */
function elegirDestino(lat: number, lng: number, nombre: string) {
  estado.consulta = buscador.value = '';
  estado.lugares = null;
  limpiar.hidden = true;
  buscador.blur();
  irA(hashDe({ tipo: 'destino', lat, lng, nombre }));
}

function actualizarConsulta(valor: string) {
  estado.consulta = valor;
  estado.aqui = null;
  mapa?.marcar(null);
  limpiar.hidden = !valor;
  pedirLugares(valor);
  if (leerHash(location.hash).tipo !== 'lista') irA('#/');
  else render();
}

buscador.addEventListener('input', () => actualizarConsulta(buscador.value));
buscador.addEventListener('focus', () => {
  if (hoja.activa()) hoja.fijar('max');
});
buscador.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    // "47" abre la ruta; "hospital general" abre el primer lugar encontrado.
    const lugar = !esNumeroDeRuta(buscador.value) ? estado.lugares?.resultados[0] : undefined;
    if (lugar) return elegirDestino(lugar.coordenadas[1], lugar.coordenadas[0], lugar.nombre);
    const [primera] = buscar(indice, buscador.value);
    if (primera) {
      buscador.blur();
      irA(hashDe({ tipo: 'ruta', id: primera.id }));
    }
  } else if (e.key === 'Escape' && buscador.value) {
    e.stopPropagation();
    buscador.value = '';
    actualizarConsulta('');
  }
});
limpiar.addEventListener('click', () => {
  buscador.value = '';
  actualizarConsulta('');
  buscador.focus();
});

document.addEventListener('keydown', (e) => {
  const escribiendo = (e.target as HTMLElement).closest('input, textarea, [contenteditable]');
  if (e.key === '/' && !escribiendo && !acerca.open) {
    e.preventDefault();
    buscador.focus();
  } else if (e.key === 'Escape' && !acerca.open) {
    const vista = leerHash(location.hash);
    if (vista.tipo === 'ruta') irA(estado.rutaDesdeDestino && estado.destino ? estado.destino.hash : '#/');
    else if (vista.tipo === 'destino') irA('#/');
  }
});

addEventListener('hashchange', render);

// ── Acerca de ──────────────────────────────────────────────────────
$('#btn-acerca').addEventListener('click', () => acerca.showModal());
acerca.addEventListener('click', (e) => {
  // Clic fuera del contenido (en el fondo) o en el botón de cerrar.
  if (e.target === acerca || (e.target as HTMLElement).closest('[data-accion="cerrar-acerca"]')) acerca.close();
});

// ── Instalación como app ───────────────────────────────────────────
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  estado.instalar = e as EventoInstalar;
  if (leerHash(location.hash).tipo === 'lista') render();
});
addEventListener('appinstalled', () => {
  estado.instalar = null;
  avisar('¡Listo! AppRutas quedó instalada');
});

// ── Arranque ───────────────────────────────────────────────────────
const promesaEstilo = cargarEstiloBase();

async function iniciar() {
  contenido.innerHTML = htmlCargando();
  try {
    datos = await cargarDatos();
  } catch (error) {
    contenido.innerHTML = htmlError(navigator.onLine ? (error as Error).message : 'Parece que no tienes conexión a internet.');
    return;
  }
  const paradas = datos.paradas ?? [];
  indice = crearIndice(datos.rutas, paradas);
  porId = new Map(datos.rutas.map((r) => [r.id, r]));
  paradasPorId = new Map(paradas.map((p) => [p.id, p]));
  conteo = {
    urbana: datos.rutas.filter((r) => r.servicio !== 'suburbana').length,
    suburbana: datos.rutas.filter((r) => r.servicio === 'suburbana').length,
  };
  render();

  if (mapa) return;
  try {
    // MapLibre (~1 MB) se descarga aparte para que la lista aparezca de inmediato.
    const [{ MapaRutas }, estilo] = await Promise.all([import('./mapa/mapa'), promesaEstilo]);
    mapa = new MapaRutas({
      contenedor: contenedorMapa,
      estilo,
      datos,
      relleno,
      alTocarRutas: (ids, lugar) => {
        const actual = leerHash(location.hash);
        if (ids.length === 1) {
          if (actual.tipo === 'destino') estado.rutaDesdeDestino = true;
          if (actual.tipo !== 'ruta' || actual.id !== ids[0]) irA(hashDe({ tipo: 'ruta', id: ids[0] }));
          return;
        }
        estado.aqui = { ids, lugar };
        estado.consulta = buscador.value = '';
        limpiar.hidden = true;
        mapa?.marcar(lugar);
        if (hoja.activa() && hoja.nivel === 'min') hoja.fijar('media');
        if (actual.tipo === 'ruta') irA('#/');
        else render();
      },
      alTocarVacio: async (lugar) => {
        // En la ficha de una ruta, tocar fuera de las líneas no cambia de vista.
        if (leerHash(location.hash).tipo === 'ruta') return;
        const [lng, lat] = lugar;
        elegirDestino(lat, lng, NOMBRE_PUNTO);
        // Con internet, el punto toma el nombre de la calle más cercana.
        const nombre = await nombrarPunto(lugar);
        const ahora = leerHash(location.hash);
        if (!nombre || ahora.tipo !== 'destino' || ahora.nombre !== NOMBRE_PUNTO) return;
        if (Math.abs(ahora.lat - lat) > 1e-4 || Math.abs(ahora.lng - lng) > 1e-4) return;
        history.replaceState(null, '', hashDe({ ...ahora, nombre: `Cerca de ${nombre}` }));
        render();
      },
    });
    const vista = leerHash(location.hash);
    const ruta = vista.tipo === 'ruta' ? porId.get(vista.id) : undefined;
    if (ruta) mapa.seleccionar(ruta, vista.tipo === 'ruta' ? vista.sentido : undefined);
    if (vista.tipo === 'destino') mostrarDestinoEnMapa(true);
    if (estado.servicio) mapa.filtrarServicio(estado.servicio);
    // Solo en desarrollo: acceso al mapa desde la consola para depurar.
    if (import.meta.env.DEV) Object.assign(window, { mapaRutas: mapa });
  } catch (error) {
    console.error(error);
    contenedorMapa.innerHTML = `<div class="mapa__error"><p><strong>No se pudo mostrar el mapa.</strong></p><p>Tu navegador no es compatible o tiene la aceleración gráfica (WebGL) desactivada. La lista de rutas sigue disponible.</p></div>`;
  }
}

iniciar();
