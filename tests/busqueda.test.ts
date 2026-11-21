import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buscar, crearIndice, normalizar, paradaQueCoincide } from '../src/busqueda';
import type { DatosRutas } from '../src/tipos';
import { agruparRutas } from '../scripts/lib/rutas.mjs';

const leer = (id: string) => JSON.parse(readFileSync(`data/rutas/${id}.geojson`, 'utf8'));
const paradas = JSON.parse(readFileSync('data/paradas.geojson', 'utf8'));
const datos = agruparRutas([leer('60'), leer('61'), leer('15-a')], paradas) as DatosRutas;
const indice = crearIndice(datos.rutas, datos.paradas);
const numeros = (q: string) => buscar(indice, q).map((r) => r.numero);

describe('normalizar', () => {
  it('quita acentos, mayúsculas y signos', () => {
    expect(normalizar('  Misión de la ESPERANZA – 15-A ')).toBe('mision de la esperanza 15 a');
  });
});

describe('buscar', () => {
  it('sin texto devuelve todas las rutas en orden', () => {
    expect(numeros('')).toEqual(['15-A', '60', '61']);
  });

  it('el número exacto va primero', () => {
    expect(numeros('61')[0]).toBe('61');
    expect(numeros('ruta 60')).toEqual(['60']);
  });

  it('un número parcial encuentra varias rutas', () => {
    expect(numeros('6')).toEqual(expect.arrayContaining(['60', '61']));
  });

  it('acepta 15-A, 15a y "15 a"', () => {
    for (const q of ['15-A', '15a', '15 a']) expect(numeros(q)[0]).toBe('15-A');
  });

  it('busca por colonia, lugar y palabras clave sin importar acentos (lo propio de la ruta va primero)', () => {
    expect(numeros('pinos')[0]).toBe('60');
    expect(numeros('cetis')).toEqual(['61']);
    expect(numeros('mision esperanza')[0]).toBe('15-A');
    expect(numeros('Latino')[0]).toBe('15-A');
  });

  it('todas las palabras deben coincidir', () => {
    expect(numeros('salvador industrial')[0]).toBe('61');
    expect(numeros('pinos zzzz')).toEqual([]);
  });

  it('explica cuándo una ruta apareció solo por una de sus paradas', () => {
    const nombre = (id: string) => datos.paradas.find((p) => p.id === id)?.nombre;
    const r61 = datos.rutas.find((r) => r.id === '61')!;
    expect(paradaQueCoincide(r61, 'salvador industrial', nombre)).toBeNull();
    const conLatino = datos.rutas.find((r) => r.id === '61' && numeros('Latino').includes('61'));
    if (conLatino) expect(paradaQueCoincide(conLatino, 'Latino', nombre)).toMatch(/latino/i);
  });

  it('encuentra las rutas que pasan por una parada', () => {
    const r61 = datos.rutas.find((r) => r.id === '61')!;
    const otras = new Set(datos.rutas.filter((r) => r.id !== '61').flatMap((r) => Object.values(r.paradas).flat()));
    const id = Object.values(r61.paradas).flat().find((p) => !otras.has(p))!;
    const nombre = datos.paradas.find((p) => p.id === id)!.nombre;
    expect(numeros(nombre)).toContain('61');
  });
});
