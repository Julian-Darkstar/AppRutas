import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cercaniaEnSentido,
  distanciaALinea,
  formatoDistancia,
  metrosEntre,
  minutosCaminando,
  puntoDeBajada,
  rutasCercanas,
} from '../src/cercania';
import type { DatosRutas } from '../src/tipos';
import { agruparRutas } from '../scripts/lib/rutas.mjs';

const rutasArchivo = readdirSync('data/rutas')
  .filter((f) => f.endsWith('.geojson'))
  .map((f) => JSON.parse(readFileSync(`data/rutas/${f}`, 'utf8')));
const paradas = JSON.parse(readFileSync('data/paradas.geojson', 'utf8'));
const datos = agruparRutas(rutasArchivo, paradas) as unknown as DatosRutas;

describe('geometría', () => {
  it('mide la distancia de un punto a una línea y el punto más cercano', () => {
    // Línea oeste-este; el punto queda ~111 m al norte de su mitad (0.001° de latitud).
    const { metros, punto } = distanciaALinea([-100.815, 20.521], [[-100.82, 20.52], [-100.81, 20.52]]);
    expect(metros).toBeGreaterThan(105);
    expect(metros).toBeLessThan(115);
    expect(punto[0]).toBeCloseTo(-100.815, 5);
    expect(punto[1]).toBeCloseTo(20.52, 5);
  });

  it('formatea distancias y estima minutos a pie', () => {
    expect(formatoDistancia(4)).toBe('10 m');
    expect(formatoDistancia(123)).toBe('120 m');
    expect(formatoDistancia(1340)).toBe('1.3 km');
    expect(minutosCaminando(0)).toBe(1);
    expect(minutosCaminando(600)).toBe(10);
  });
});

describe('rutas que te dejan cerca', () => {
  const estadio = datos.paradas.find((p) => p.nombre === 'Estadio')!;

  it('junto a una parada, las rutas que paran ahí pasan a pocos metros y salen ordenadas', () => {
    const { cercanas, fueraDeRadio } = rutasCercanas(estadio.coordenadas, datos);
    expect(fueraDeRadio).toBe(false);
    expect(cercanas.length).toBeGreaterThan(3);
    expect(cercanas[0].metros).toBeLessThan(40);
    for (let i = 1; i < cercanas.length; i++) expect(cercanas[i].metros).toBeGreaterThanOrEqual(cercanas[i - 1].metros);
    expect(cercanas.every((c) => c.metros <= 1000)).toBe(true);
    const queParan = datos.rutas.filter((r) => Object.values(r.paradas).flat().includes(estadio.id)).map((r) => r.id);
    expect(queParan).toContain(cercanas[0].ruta.id);
  });

  it('da la parada del mismo sentido más cercana al destino', () => {
    const [primera] = rutasCercanas(estadio.coordenadas, datos).cercanas;
    expect(primera.parada).not.toBeNull();
    expect(datos.rutas.find((r) => r.id === primera.ruta.id)!.paradas[primera.sentido]).toContain(primera.parada!.parada.id);
    expect(metrosEntre(puntoDeBajada(primera), estadio.coordenadas)).toBeLessThan(400);
  });

  it('lejos de todo, avisa y muestra las más cercanas', () => {
    const { cercanas, fueraDeRadio } = rutasCercanas([-100.97, 20.37], datos);
    expect(fueraDeRadio).toBe(true);
    expect(cercanas).toHaveLength(3);
    expect(cercanas[0].metros).toBeGreaterThan(1000);
  });

  it('la cercanía por sentido coincide con la del sentido más cercano', () => {
    const [primera] = rutasCercanas(estadio.coordenadas, datos).cercanas;
    const enSentido = cercaniaEnSentido(estadio.coordenadas, datos, primera.ruta, primera.sentido)!;
    expect(enSentido.metros).toBeCloseTo(primera.metros, 6);
    expect(enSentido.parada?.parada.id).toBe(primera.parada?.parada.id);
  });
});
