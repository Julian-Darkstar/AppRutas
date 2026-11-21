import type { Map as MapaLibre } from 'maplibre-gl';

const PR = 2; // se dibuja al doble de resolución para pantallas nítidas

function lienzo(ancho: number, alto: number) {
  const canvas = document.createElement('canvas');
  canvas.width = ancho * PR;
  canvas.height = alto * PR;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(PR, PR);
  return { ctx, datos: () => ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

function rectanguloRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Chevrón blanco que va dentro de la línea de la ruta seleccionada e indica el sentido. */
export function agregarFlecha(mapa: MapaLibre) {
  if (mapa.hasImage('flecha')) return;
  const { ctx, datos } = lienzo(12, 12);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(4, 2.5);
  ctx.lineTo(8, 6);
  ctx.lineTo(4, 9.5);
  ctx.stroke();
  mapa.addImage('flecha', datos(), { pixelRatio: PR });
}

/**
 * Insignia redondeada del color de la ruta con borde blanco, estirable para
 * que quepa el número ("60", "15-A"). Se crea al vuelo para cualquier color.
 */
export function agregarPastilla(mapa: MapaLibre, id: string) {
  const hex = id.replace('pastilla-', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex) || mapa.hasImage(id)) return;
  const [w, h, r, borde] = [28, 22, 7, 2];
  const { ctx, datos } = lienzo(w, h);
  ctx.fillStyle = '#FFFFFF';
  rectanguloRedondeado(ctx, 0, 0, w, h, r);
  ctx.fill();
  ctx.fillStyle = `#${hex}`;
  rectanguloRedondeado(ctx, borde, borde, w - borde * 2, h - borde * 2, r - borde);
  ctx.fill();
  const px = (v: number) => v * PR;
  mapa.addImage(id, datos(), {
    pixelRatio: PR,
    stretchX: [[px(r), px(w - r)]],
    stretchY: [[px(r), px(h - r)]],
    content: [px(6), px(4), px(w - 6), px(h - 4)],
  });
}
