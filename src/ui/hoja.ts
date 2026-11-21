// Hoja inferior arrastrable (solo en celular), al estilo de las apps de mapas:
// "min" deja ver casi todo el mapa, "media" reparte, "max" muestra la lista completa.
export type Nivel = 'min' | 'media' | 'max';

const ESCRITORIO = matchMedia('(min-width: 900px)');
const UMBRAL_ARRASTRE = 6;

export class Hoja {
  nivel: Nivel = 'media';

  constructor(
    private readonly panel: HTMLElement,
    private readonly zonaArrastre: HTMLElement,
    private readonly asa: HTMLButtonElement,
    private readonly alCambiar: (nivel: Nivel) => void,
  ) {
    this.escucharArrastre();
    this.asa.addEventListener('click', () => this.fijar(this.nivel === 'max' ? 'media' : 'max'));
    ESCRITORIO.addEventListener('change', () => this.fijar(this.nivel, false));
    addEventListener('resize', () => this.fijar(this.nivel, false));
    this.fijar(this.nivel, false);
  }

  activa(): boolean {
    return !ESCRITORIO.matches;
  }

  private alturas(): Record<Nivel, number> {
    const alto = innerHeight;
    const max = alto - 56;
    const min = Math.min(this.zonaArrastre.offsetHeight + 8, max);
    const media = Math.min(Math.max(Math.round(alto * 0.46), min + 120), max);
    return { min, media, max };
  }

  /** Alto de la hoja que tapa el mapa (0 en escritorio). */
  altoVisible(): number {
    return this.activa() ? this.alturas()[this.nivel] : 0;
  }

  fijar(nivel: Nivel, animar = true) {
    const cambio = nivel !== this.nivel;
    this.nivel = nivel;
    if (!this.activa()) {
      this.panel.style.removeProperty('--hoja-max');
      this.panel.style.removeProperty('--hoja-desplazamiento');
      this.panel.style.removeProperty('--hoja-oculto');
      return;
    }
    const alturas = this.alturas();
    this.aplicar(alturas[nivel], alturas.max, animar);
    this.asa.setAttribute('aria-expanded', String(nivel === 'max'));
    this.asa.setAttribute('aria-label', nivel === 'max' ? 'Reducir el panel' : 'Expandir el panel');
    if (cambio) this.alCambiar(nivel);
  }

  private aplicar(visible: number, max: number, animar: boolean) {
    this.panel.classList.toggle('panel--sin-animacion', !animar);
    this.panel.style.setProperty('--hoja-max', `${max}px`);
    this.panel.style.setProperty('--hoja-desplazamiento', `${max - visible}px`);
    // Relleno inferior = parte oculta, para poder desplazar la lista hasta el final.
    this.panel.style.setProperty('--hoja-oculto', `${max - visible}px`);
  }

  private escucharArrastre() {
    let inicioY = 0;
    let inicioVisible = 0;
    let ultimoY = 0;
    let ultimoT = 0;
    let velocidad = 0;
    let arrastrando = false;
    let puntero: number | null = null;

    this.zonaArrastre.addEventListener('pointerdown', (e) => {
      if (!this.activa() || (e.target as HTMLElement).closest('input, a, button:not(.panel__asa)')) return;
      puntero = e.pointerId;
      inicioY = ultimoY = e.clientY;
      ultimoT = e.timeStamp;
      inicioVisible = this.altoVisible();
      velocidad = 0;
    });

    this.zonaArrastre.addEventListener('pointermove', (e) => {
      if (e.pointerId !== puntero) return;
      if (!arrastrando && Math.abs(e.clientY - inicioY) < UMBRAL_ARRASTRE) return;
      if (!arrastrando) {
        arrastrando = true;
        this.zonaArrastre.setPointerCapture(e.pointerId);
      }
      const { min, max } = this.alturas();
      const visible = Math.min(Math.max(inicioVisible - (e.clientY - inicioY), min), max);
      const dt = Math.max(e.timeStamp - ultimoT, 1);
      velocidad = (ultimoY - e.clientY) / dt; // px/ms, positivo = hacia arriba
      ultimoY = e.clientY;
      ultimoT = e.timeStamp;
      this.panel.classList.add('panel--arrastrando');
      this.panel.style.setProperty('--hoja-desplazamiento', `${max - visible}px`);
    });

    const soltar = (e: PointerEvent) => {
      if (e.pointerId !== puntero) return;
      puntero = null;
      this.panel.classList.remove('panel--arrastrando');
      if (!arrastrando) return;
      arrastrando = false;
      // Evita que el "click" que sigue al arrastre active la asa.
      const cancelarClick = (ev: Event) => ev.stopPropagation();
      this.zonaArrastre.addEventListener('click', cancelarClick, { capture: true, once: true });
      setTimeout(() => this.zonaArrastre.removeEventListener('click', cancelarClick, { capture: true }), 0);

      const alturas = this.alturas();
      const actual = inicioVisible - (e.clientY - inicioY);
      const niveles: Nivel[] = ['min', 'media', 'max'];
      let destino: Nivel;
      if (Math.abs(velocidad) > 0.5) {
        // Un gesto rápido avanza un nivel en esa dirección.
        const i = niveles.indexOf(this.nivelMasCercano(inicioVisible, alturas));
        destino = niveles[Math.min(Math.max(i + (velocidad > 0 ? 1 : -1), 0), 2)];
      } else {
        destino = this.nivelMasCercano(actual, alturas);
      }
      this.fijar(destino);
    };
    this.zonaArrastre.addEventListener('pointerup', soltar);
    this.zonaArrastre.addEventListener('pointercancel', soltar);
  }

  private nivelMasCercano(visible: number, alturas: Record<Nivel, number>): Nivel {
    return (Object.keys(alturas) as Nivel[]).reduce((a, b) => (Math.abs(alturas[b] - visible) < Math.abs(alturas[a] - visible) ? b : a));
  }
}
