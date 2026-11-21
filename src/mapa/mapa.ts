import 'maplibre-gl/dist/maplibre-gl.css';
import urlTrabajador from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { AttributionControl, GeolocateControl, Map as MapaLibre, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
  LngLatBoundsLike,
  PaddingOptions,
  PointLike,
  StyleSpecification,
} from 'maplibre-gl';
import type { DatosRutas, Ruta, Sentido, Servicio } from '../tipos';
import { FUENTE_ETIQUETAS } from './estilo-base';
import { agregarFlecha, agregarPastilla } from './imagenes';

// Vite copia el worker de MapLibre como archivo aparte; hay que decirle dónde quedó.
setWorkerUrl(urlTrabajador);

export interface OpcionesMapa {
  contenedor: HTMLElement;
  estilo: StyleSpecification;
  datos: DatosRutas;
  /** Espacio que tapa la interfaz (panel lateral u hoja inferior) para encuadrar bien. */
  relleno: () => PaddingOptions;
  alTocarRutas: (ids: string[], lugar: [number, number]) => void;
  /** Toque en una zona sin rutas: "¿qué ruta me deja cerca de aquí?". */
  alTocarVacio?: (lugar: [number, number]) => void;
}

type Caja = [number, number, number, number];

const LIMITES: LngLatBoundsLike = [
  [-101.15, 20.3],
  [-100.5, 20.8],
];
const CAPAS_TOCABLES = ['rutas-linea', 'ruta-opuesto', 'rutas-numeros'];
const NINGUNO: ExpressionSpecification = ['==', ['get', 'tipo'], '__ninguno__'];
const ES_RECORRIDO: ExpressionSpecification = ['==', ['get', 'tipo'], 'recorrido'];

const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esEscritorio = () => matchMedia('(min-width: 900px)').matches;

export function cajaDe(rutas: Ruta[]): Caja {
  return rutas.reduce<Caja>(
    (c, r) => [Math.min(c[0], r.caja[0]), Math.min(c[1], r.caja[1]), Math.max(c[2], r.caja[2]), Math.max(c[3], r.caja[3])],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

const aLimites = (c: Caja): LngLatBoundsLike => [
  [c[0], c[1]],
  [c[2], c[3]],
];

/** Vista general: la ciudad (rutas urbanas); las suburbanas llegan a comunidades a 20 km. */
function cajaGeneral(rutas: Ruta[], servicio: Servicio | null = null): Caja {
  const filtradas = servicio ? rutas.filter((r) => r.servicio === servicio) : rutas.filter((r) => r.servicio !== 'suburbana');
  return cajaDe(filtradas.length ? filtradas : rutas);
}

/** Ancho de línea que crece con el zoom; `enfasis` decide qué rutas van más gruesas. */
function anchoPorZoom(enfasis: ExpressionSpecification, normal: number[], grueso: number[]): DataDrivenPropertyValueSpecification<number> {
  const zooms = [11, 13, 15, 17];
  return ['interpolate', ['linear'], ['zoom'], ...zooms.flatMap((z, i) => [z, ['case', enfasis, grueso[i], normal[i]]])] as ExpressionSpecification;
}

export class MapaRutas {
  readonly mapa: MapaLibre;
  private seleccion: { id: string; sentido: Sentido; color: string; paradas: string[] } | null = null;
  private resaltada: string | null = null;
  private servicio: Servicio | null = null;
  /** Rutas resaltadas a la vez (las que dejan cerca de un destino). */
  private destacadas: string[] | null = null;
  private marcador: Marker | null = null;
  private marcadorDestino: Marker | null = null;
  private readonly listo: Promise<void>;

  constructor(private readonly opciones: OpcionesMapa) {
    this.mapa = new MapaLibre({
      container: opciones.contenedor,
      style: opciones.estilo,
      bounds: aLimites(cajaGeneral(opciones.datos.rutas)),
      fitBoundsOptions: { padding: opciones.relleno() },
      maxBounds: LIMITES,
      minZoom: 10,
      maxZoom: 18.5,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 120,
    });
    this.mapa.touchZoomRotate.disableRotation();
    this.mapa.keyboard.disableRotation();
    this.agregarControles();

    // Las insignias de cada color se dibujan la primera vez que el mapa las pide.
    this.mapa.setMissingStyleImageResolver((id) => {
      if (id.startsWith('pastilla-')) agregarPastilla(this.mapa, id);
    });
    this.listo = new Promise((resolver) => {
      this.mapa.once('load', () => {
        this.agregarCapas();
        resolver();
      });
    });
    this.escucharInteraccion();
  }

  private agregarControles() {
    // En celular la hoja inferior tapa la esquina de abajo: los créditos van arriba.
    const escritorio = esEscritorio();
    this.mapa.addControl(new AttributionControl({ compact: true }), escritorio ? 'bottom-right' : 'top-left');
    if (escritorio) this.mapa.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    this.mapa.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        fitBoundsOptions: { maxZoom: 15.5 },
      }),
      'top-right',
    );
  }

  private agregarCapas() {
    const m = this.mapa;
    agregarFlecha(m);
    m.addSource('rutas', { type: 'geojson', data: this.opciones.datos.geojson, tolerance: 0.3 });

    // Las líneas van debajo de los nombres de calles; números, flechas y paradas, encima de todo.
    const debajoDeEtiquetas = m.getStyle().layers.find((capa) => capa.type === 'symbol')?.id;
    const lineas = { 'line-join': 'round', 'line-cap': 'round' } as const;

    m.addLayer({ id: 'rutas-borde', type: 'line', source: 'rutas', filter: ES_RECORRIDO, layout: lineas, paint: { 'line-color': '#FFFFFF' } }, debajoDeEtiquetas);
    m.addLayer({ id: 'rutas-linea', type: 'line', source: 'rutas', filter: ES_RECORRIDO, layout: lineas, paint: { 'line-color': ['get', 'color'] } }, debajoDeEtiquetas);
    m.addLayer(
      {
        id: 'ruta-opuesto',
        type: 'line',
        source: 'rutas',
        filter: NINGUNO,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 3, 17, 5],
          'line-dasharray': [1.5, 1.5],
          'line-opacity': 0.75,
        },
      },
      debajoDeEtiquetas,
    );
    m.addLayer({
      id: 'rutas-flechas',
      type: 'symbol',
      source: 'rutas',
      filter: NINGUNO,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12, 60, 16, 110],
        'icon-image': 'flecha',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.55, 14, 0.8, 17, 1.2],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-rotation-alignment': 'map',
        'icon-keep-upright': false,
      },
    });
    // Paradas oficiales: se muestran solo las del sentido elegido.
    m.addSource('paradas', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: this.opciones.datos.paradas.map((p) => ({
          type: 'Feature',
          properties: { id: p.id, nombre: p.nombre },
          geometry: { type: 'Point', coordinates: p.coordenadas },
        })),
      },
    });
    m.addLayer({
      id: 'paradas-circulo',
      type: 'circle',
      source: 'paradas',
      filter: NINGUNO,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 13, 3.5, 16, 6],
        'circle-color': '#FFFFFF',
        'circle-stroke-color': '#16232A',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 15, 2.5],
      },
    });
    m.addLayer({
      id: 'rutas-numeros',
      type: 'symbol',
      source: 'rutas',
      filter: ES_RECORRIDO,
      minzoom: 11.5,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 280,
        'text-field': ['get', 'numero'],
        'text-font': FUENTE_ETIQUETAS,
        'text-size': 12,
        'text-rotation-alignment': 'viewport',
        'text-pitch-alignment': 'viewport',
        'icon-image': ['concat', 'pastilla-', ['slice', ['get', 'color'], 1]],
        'icon-text-fit': 'both',
        'icon-rotation-alignment': 'viewport',
        'icon-pitch-alignment': 'viewport',
        'text-padding': 6,
      },
      paint: { 'text-color': '#FFFFFF' },
    });
    m.addLayer({
      id: 'puntos-circulo',
      type: 'circle',
      source: 'rutas',
      filter: NINGUNO,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 7],
        'circle-color': ['case', ['==', ['get', 'tipo'], 'parada'], '#FFFFFF', '#16232A'],
        'circle-stroke-color': ['case', ['==', ['get', 'tipo'], 'parada'], ['get', 'color'], '#FFFFFF'],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 15, 3],
      },
    });
    m.addLayer({
      id: 'puntos-nombre',
      type: 'symbol',
      source: 'rutas',
      filter: NINGUNO,
      minzoom: 12.5,
      layout: {
        'text-field': ['get', 'nombre'],
        'text-font': FUENTE_ETIQUETAS,
        'text-size': 12,
        'text-anchor': 'top',
        'text-offset': [0, 0.9],
        'text-max-width': 11,
        'text-optional': true,
      },
      paint: { 'text-color': '#16232A', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 },
    });
    m.addLayer({
      id: 'paradas-nombre',
      type: 'symbol',
      source: 'paradas',
      filter: NINGUNO,
      minzoom: 15,
      layout: {
        'text-field': ['get', 'nombre'],
        'text-font': FUENTE_ETIQUETAS,
        'text-size': 11,
        'text-anchor': 'left',
        'text-offset': [0.8, 0],
        'text-max-width': 9,
        'text-optional': true,
      },
      paint: { 'text-color': '#4A5960', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.4 },
    });
    // Tramo a pie desde donde te bajas hasta el destino.
    m.addSource('caminata', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    m.addLayer({
      id: 'caminata-linea',
      type: 'line',
      source: 'caminata',
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#0F4C5C', 'line-width': 3, 'line-dasharray': [0.1, 2] },
    });
    m.addLayer({
      id: 'caminata-bajada',
      type: 'circle',
      source: 'caminata',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 7, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#0F4C5C', 'circle-stroke-width': 3 },
    });
    this.pintar();
  }

  /** Aplica selección y resaltado a las capas (solo cambia filtros y pinturas, no los datos). */
  private pintar() {
    const m = this.mapa;
    if (!m.getLayer('rutas-linea')) return;
    const hay = this.seleccion !== null;
    const sel: ExpressionSpecification = ['==', ['get', 'ruta'], this.seleccion?.id ?? ''];
    const sentidoActivo: ExpressionSpecification = ['==', ['get', 'sentido'], this.seleccion?.sentido ?? ''];
    const destacadas = !hay && this.destacadas?.length ? this.destacadas : null;
    const enfasis: ExpressionSpecification = hay
      ? sel
      : destacadas
        ? ['in', ['get', 'ruta'], ['literal', destacadas]]
        : ['==', ['get', 'ruta'], this.resaltada ?? ''];

    // Filtro urbanas/suburbanas: la ruta elegida se ve siempre.
    const delServicio: ExpressionSpecification = this.servicio ? ['==', ['get', 'servicio'], this.servicio] : ['literal', true];
    const visible: ExpressionSpecification = hay ? ['any', sel, delServicio] : destacadas ? ['any', enfasis, delServicio] : delServicio;

    // De la ruta elegida se dibuja fuerte solo el sentido activo; el otro, punteado.
    const filtroLineas: FilterSpecification = hay ? ['all', ES_RECORRIDO, visible, ['any', ['!', sel], sentidoActivo]] : ['all', ES_RECORRIDO, visible];
    m.setFilter('rutas-borde', filtroLineas);
    m.setFilter('rutas-linea', filtroLineas);
    m.setFilter('ruta-opuesto', hay ? ['all', ES_RECORRIDO, sel, ['!', sentidoActivo]] : NINGUNO);
    m.setFilter('rutas-flechas', hay ? ['all', ES_RECORRIDO, sel, sentidoActivo] : NINGUNO);
    m.setFilter('puntos-circulo', hay ? ['all', ['!=', ['get', 'tipo'], 'recorrido'], sel] : NINGUNO);
    m.setFilter('puntos-nombre', hay ? ['all', ['!=', ['get', 'tipo'], 'recorrido'], sel] : NINGUNO);
    const paradas: FilterSpecification = this.seleccion?.paradas.length ? ['in', ['get', 'id'], ['literal', this.seleccion.paradas]] : NINGUNO;
    m.setFilter('paradas-circulo', paradas);
    m.setFilter('paradas-nombre', paradas);
    if (this.seleccion) m.setPaintProperty('paradas-circulo', 'circle-stroke-color', this.seleccion.color);

    // Con 60+ rutas la vista general usa líneas finas y translúcidas para no saturar.
    const grueso = destacadas ? [3, 4.5, 6.5, 10] : [4, 6, 9, 13];
    const bordeGrueso = destacadas ? [5.5, 7.5, 10.5, 15] : [7, 10, 14, 19];
    m.setPaintProperty('rutas-linea', 'line-width', anchoPorZoom(enfasis, [1.4, 2.4, 4, 7], grueso));
    m.setPaintProperty('rutas-borde', 'line-width', anchoPorZoom(enfasis, [2.8, 4.2, 6.5, 11], bordeGrueso));
    m.setPaintProperty('rutas-linea', 'line-opacity', hay || destacadas ? ['case', enfasis, 1, 0.12] : ['case', enfasis, 1, 0.8]);
    m.setPaintProperty('rutas-borde', 'line-opacity', hay || destacadas ? ['case', enfasis, 1, 0.25] : ['case', enfasis, 1, 0.7]);
    m.setLayoutProperty('rutas-linea', 'line-sort-key', ['case', enfasis, 2, 1]);
    m.setLayoutProperty('rutas-borde', 'line-sort-key', ['case', enfasis, 2, 1]);

    // Números: en la vista general aparecen al acercarse; con una ruta elegida, solo los suyos.
    m.setFilter('rutas-numeros', hay || destacadas ? ['all', ES_RECORRIDO, enfasis] : ['all', ES_RECORRIDO, visible]);
    m.setLayerZoomRange('rutas-numeros', hay || destacadas ? 11.5 : 13.5, 24);
    m.setLayoutProperty('rutas-numeros', 'symbol-sort-key', ['case', enfasis, 0, 1]);
  }

  private escucharInteraccion() {
    const m = this.mapa;
    const alrededor = (p: { x: number; y: number }, r: number): [PointLike, PointLike] => [
      [p.x - r, p.y - r],
      [p.x + r, p.y + r],
    ];
    const rutasEn = (p: { x: number; y: number }, r: number) =>
      m.getLayer('rutas-linea')
        ? [...new Set(m.queryRenderedFeatures(alrededor(p, r), { layers: CAPAS_TOCABLES }).map((f) => String(f.properties.ruta)))]
        : [];

    m.on('mousemove', (e) => {
      const [id = null] = rutasEn(e.point, 6);
      m.getCanvas().style.cursor = id ? 'pointer' : '';
      if (id !== this.resaltada) {
        this.resaltada = id;
        this.pintar();
      }
    });
    m.on('mouseout', () => {
      if (this.resaltada === null) return;
      this.resaltada = null;
      this.pintar();
    });
    m.on('click', (e) => {
      const ids = rutasEn(e.point, 12);
      const lugar: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (ids.length) this.opciones.alTocarRutas(ids, lugar);
      else this.opciones.alTocarVacio?.(lugar);
    });
  }

  async seleccionar(ruta: Ruta | null, sentido?: Sentido, encuadrar = true) {
    await this.listo;
    if (ruta) {
      const activo = sentido ?? ruta.sentidos[0];
      this.seleccion = { id: ruta.id, sentido: activo, color: ruta.color, paradas: ruta.paradas?.[activo] ?? [] };
    } else {
      this.seleccion = null;
    }
    this.resaltada = null;
    this.pintar();
    if (ruta && encuadrar) this.encuadrar(ruta.caja);
  }

  /** Muestra solo las rutas urbanas o suburbanas (null: todas). */
  async filtrarServicio(servicio: Servicio | null) {
    await this.listo;
    if (servicio === this.servicio) return;
    this.servicio = servicio;
    this.pintar();
    if (!this.seleccion) this.verTodas();
  }

  encuadrar(caja: Caja, maxZoom = 15.5) {
    this.mapa.fitBounds(aLimites(caja), { padding: this.opciones.relleno(), maxZoom, duration: sinMovimiento() ? 0 : 650 });
  }

  verTodas() {
    this.encuadrar(cajaGeneral(this.opciones.datos.rutas, this.servicio));
  }

  irA([lng, lat]: [number, number]) {
    this.encuadrar([lng - 0.003, lat - 0.002, lng + 0.003, lat + 0.002], 16);
  }

  /** Marca el punto donde se tocó el mapa mientras se muestran "las rutas que pasan por aquí". */
  marcar(lugar: [number, number] | null) {
    this.marcador?.remove();
    this.marcador = null;
    if (!lugar) return;
    const elemento = document.createElement('div');
    elemento.className = 'marcador-toque';
    this.marcador = new Marker({ element: elemento }).setLngLat(lugar).addTo(this.mapa);
  }

  /** Resalta varias rutas a la vez (null: ninguna). La ruta elegida, si hay, tiene prioridad. */
  async destacar(ids: string[] | null) {
    await this.listo;
    this.destacadas = ids?.length ? ids : null;
    this.pintar();
  }

  /** Marcador del destino buscado (null lo quita). */
  marcarDestino(lugar: [number, number] | null) {
    this.marcadorDestino?.remove();
    this.marcadorDestino = null;
    if (!lugar) return;
    const elemento = document.createElement('div');
    elemento.className = 'marcador-destino';
    elemento.setAttribute('aria-hidden', 'true');
    // MapLibre mueve el contenedor con `transform`; la forma girada del pin va en un hijo.
    elemento.innerHTML = '<span class="marcador-destino__pin"></span>';
    this.marcadorDestino = new Marker({ element: elemento, anchor: 'bottom' }).setLngLat(lugar).addTo(this.mapa);
  }

  /** Línea punteada del tramo a pie: desde donde te bajas hasta el destino (null la quita). */
  async caminata(desde: [number, number] | null, hasta: [number, number] | null) {
    await this.listo;
    const fuente = this.mapa.getSource('caminata') as { setData(d: unknown): void } | undefined;
    const features = desde && hasta
      ? [
          { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [desde, hasta] } },
          { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: desde } },
        ]
      : [];
    fuente?.setData({ type: 'FeatureCollection', features });
  }

  /** Encuadra un conjunto de puntos [lng, lat]. */
  encuadrarPuntos(puntos: [number, number][], maxZoom = 16) {
    if (!puntos.length) return;
    const lngs = puntos.map((p) => p[0]);
    const lats = puntos.map((p) => p[1]);
    const margen = 0.0015;
    this.encuadrar([Math.min(...lngs) - margen, Math.min(...lats) - margen, Math.max(...lngs) + margen, Math.max(...lats) + margen], maxZoom);
  }

  redimensionar() {
    this.mapa.resize();
  }
}
