import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analizarNombre, agruparTrazos, completar, construirRuta, convertirParadas, marcarDuplicados, titulo } from '../scripts/lib/imipe.mjs';
import { validarRuta } from '../scripts/lib/rutas.mjs';

const leer = (archivo: string) => JSON.parse(readFileSync(`data/fuentes/imipe-2021/${archivo}`, 'utf8').replace(/^﻿/, ''));
const fuente = leer('rutas.json');
const correcciones = leer('correcciones.json');
const grupos = agruparTrazos(fuente.features);
const rutas = grupos.map((g: { numero: string }) => construirRuta(g, correcciones));
marcarDuplicados(rutas);
const ruta = (id: string) => rutas.find((r: { id: string }) => r.id === id)!.datos;

describe('limpieza de nombres', () => {
  it('pone acentos, expande abreviaturas y respeta siglas', () => {
    expect(titulo('CELAYA MDO. HIDALGO')).toBe('Celaya Mercado Hidalgo');
    expect(titulo('S. RAFAEL/M. BLANCO')).toBe('San Rafael / M. Blanco');
    expect(titulo('PEDRO MA. ANAYA')).toBe('Pedro María Anaya');
    expect(titulo('COL. FOVISSSTE')).toBe('Col. FOVISSSTE');
    expect(titulo('SAN JUAN DE LA VEGA')).toBe('San Juan de la Vega');
    expect(titulo('FRACC. EL PUENTE')).toBe('Fracc. El Puente');
    expect(titulo('EJIDAL /L2)')).toBe('Ejidal (L2)');
  });

  it('completa nombres cortados con el sentido contrario', () => {
    expect(completar('SAN JOSE DE GT', 'SAN JOSE DE GTO')).toBe('SAN JOSE DE GTO');
    expect(completar('PTA DEL MONTE', 'PUERTA DEL M')).toBe('PTA DEL MONTE');
    expect(completar('CELAYA', 'TAMAYO')).toBeNull();
  });

  it('separa variante, extremos y calificador', () => {
    expect(analizarNombre('(A) CENTRAL - VILLAS DEL BAJIO')).toMatchObject({ variante: 'A', extremos: ['CENTRAL', 'VILLAS DEL BAJIO'] });
    expect(analizarNombre('CENTRO - NARANJOS (QUINTANAROO')).toMatchObject({ extremos: ['CENTRO', 'NARANJOS'], calificador: 'QUINTANAROO' });
    expect(analizarNombre('LATINO - CENTRAL (L1)')).toMatchObject({ extremos: ['LATINO', 'CENTRAL (L1)'], calificador: null });
  });
});

describe('importación del IMIPE', () => {
  it('agrupa los 120 trazos en 61 rutas (la 37 tiene variantes A y B)', () => {
    expect(fuente.features).toHaveLength(120);
    expect(grupos).toHaveLength(61);
    const numeros = grupos.map((g: { numero: string }) => g.numero);
    expect(numeros).toEqual(expect.arrayContaining(['37-A', '37-B', '48']));
    expect(numeros).not.toContain('37');
  });

  it('la errata "URABNO" de la ruta 48 se trata como urbana y une sus dos sentidos', () => {
    const r48 = ruta('48');
    expect(r48.ruta.servicio).toBe('urbana');
    expect(r48.features.map((f: { properties: { sentido: string } }) => f.properties.sentido).sort()).toEqual(['ida', 'regreso']);
  });

  it('detecta circuitos de una vuelta y de dos sentidos', () => {
    expect(ruta('33').ruta.tipo).toBe('circuito');
    expect(ruta('33').features.map((f: { properties: { sentido: string } }) => f.properties.sentido)).toEqual(['circuito']);
    const r60 = ruta('60');
    expect(r60.ruta.tipo).toBe('circuito');
    expect(r60.ruta.nombre).toBe('Circuito 3 (Pinos – Gobers)');
    expect(r60.features.map((f: { properties: { nombre?: string } }) => f.properties.nombre)).toEqual(['Circuito 3 Sur', 'Circuito 3 Norte']);
  });

  it('arma nombres legibles con el extremo céntrico primero', () => {
    expect(ruta('2').ruta).toMatchObject({ nombre: 'Celaya – Tamayo', origen: 'Tamayo', destino: 'Celaya', servicio: 'suburbana' });
    expect(ruta('12').ruta.nombre).toBe('Celaya – Puerta del Monte');
    expect(ruta('26').ruta.nombre).toBe('San José de Guanajuato – Puerta del Monte');
    expect(ruta('39').ruta.nombre).toBe('Centro – Naranjos (Quintana Roo)');
    expect(ruta('16').ruta.nombre).toBe('Fracc. Los Álamos – Tres Guerras');
  });

  it('marca los trazos duplicados en la fuente', () => {
    expect(ruta('30').ruta.notas).toMatch(/idéntico al de la ruta 35/);
    expect(ruta('35').ruta.notas).toMatch(/idéntico al de la ruta 30/);
    expect(ruta('47').ruta.notas).toBeNull();
  });

  it('todas las rutas importadas pasan la validación y citan la fuente', () => {
    for (const { id, datos } of rutas) {
      expect(validarRuta(datos, id)).toEqual([]);
      expect(datos.ruta.fuente).toMatch(/IMIPE/);
    }
  });

  it('convierte las paradas con ids estables y coordenadas redondeadas', () => {
    const paradas = convertirParadas(leer('paradas.json').features);
    expect(paradas.features).toHaveLength(774);
    expect(paradas.features[0].properties).toMatchObject({ id: 'p001', nombre: 'Irrigacion Estadio' });
    const [lng] = paradas.features[0].geometry.coordinates;
    expect(String(lng).split('.')[1].length).toBeLessThanOrEqual(5);
  });
});
