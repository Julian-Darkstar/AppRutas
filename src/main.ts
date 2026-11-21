import '@fontsource-variable/atkinson-hyperlegible-next';
import './estilos/app.css';

import { buscar, crearIndice, paradaQueCoincide } from './busqueda';
import { cargarDatos } from './datos';
import { cargarEstiloBase } from './mapa/estilo-base';
import type { MapaRutas } from './mapa/mapa';
import { hashDe, leerHash } from './navegacion';
import type { DatosRutas, Parada, Ruta, Sentido, Servicio } from './tipos';
import { avisar } from './ui/aviso';
import { Hoja } from './ui/hoja';
import { icono, simboloMarca } from './ui/iconos';
import { htmlCargando, htmlDetalle, htmlError, htmlLista } from './ui/panel';

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
});

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

  if (ruta) {
    const sentido: Sentido = vista.tipo === 'ruta' && vista.sentido && ruta.sentidos.includes(vista.sentido) ? vista.sentido : ruta.sentidos[0];
    const esNueva = estado.rutaEnMapa !== ruta.id;
    contenido.innerHTML = htmlDetalle(ruta, sentido, paradasPorId);
    contenido.scrollTop = 0;
    document.title = `Ruta ${ruta.numero} · ${ruta.nombre} · AppRutas`;
    estado.aqui = null;
    mapa?.marcar(null);
    if (esNueva) {
      if (hoja.activa() && hoja.nivel !== 'media') hoja.fijar('media');
      if (document.activeElement !== buscador) $('#titulo-ruta').focus({ preventScroll: true });
    }
    estado.rutaEnMapa = ruta.id;
    mapa?.seleccionar(ruta, sentido, esNueva);
    return;
  }

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
  const objetivo = (e.target as HTMLElement).closest<HTMLElement>('[data-ruta], [data-accion], [data-sentido], [data-punto], [data-servicio]');
  if (!objetivo) return;
  const vista = leerHash(location.hash);

  if (objetivo.dataset.servicio !== undefined) {
    estado.servicio = (objetivo.dataset.servicio || null) as Servicio | null;
    mapa?.filtrarServicio(estado.servicio);
    return render();
  }

  if (objetivo.dataset.ruta) return irA(hashDe({ tipo: 'ruta', id: objetivo.dataset.ruta }));
  if (objetivo.dataset.sentido && vista.tipo === 'ruta') {
    return irA(hashDe({ tipo: 'ruta', id: vista.id, sentido: objetivo.dataset.sentido as Sentido }), true);
  }
  if (objetivo.dataset.punto) {
    const [lng, lat] = objetivo.dataset.punto.split(',').map(Number);
    return mapa?.irA([lng, lat]);
  }
  switch (objetivo.dataset.accion) {
    case 'volver':
      return irA('#/');
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
function actualizarConsulta(valor: string) {
  estado.consulta = valor;
  estado.aqui = null;
  mapa?.marcar(null);
  limpiar.hidden = !valor;
  if (leerHash(location.hash).tipo === 'ruta') irA('#/');
  else render();
}

buscador.addEventListener('input', () => actualizarConsulta(buscador.value));
buscador.addEventListener('focus', () => {
  if (hoja.activa()) hoja.fijar('max');
});
buscador.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
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
  } else if (e.key === 'Escape' && !acerca.open && leerHash(location.hash).tipo === 'ruta') {
    irA('#/');
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
    });
    const vista = leerHash(location.hash);
    const ruta = vista.tipo === 'ruta' ? porId.get(vista.id) : undefined;
    if (ruta) mapa.seleccionar(ruta, vista.tipo === 'ruta' ? vista.sentido : undefined);
    if (estado.servicio) mapa.filtrarServicio(estado.servicio);
    // Solo en desarrollo: acceso al mapa desde la consola para depurar.
    if (import.meta.env.DEV) Object.assign(window, { mapaRutas: mapa });
  } catch (error) {
    console.error(error);
    contenedorMapa.innerHTML = `<div class="mapa__error"><p><strong>No se pudo mostrar el mapa.</strong></p><p>Tu navegador no es compatible o tiene la aceleración gráfica (WebGL) desactivada. La lista de rutas sigue disponible.</p></div>`;
  }
}

iniciar();
