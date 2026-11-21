import { describe, expect, it } from 'vitest';
import { esNumeroDeRuta, lugarDesdePhoton, sinDuplicados } from '../src/lugares';

const feature = (properties: Record<string, string>, coordinates: [number, number] = [-100.81, 20.52]) => ({
  geometry: { type: 'Point' as const, coordinates },
  properties,
});

describe('resultados de Photon', () => {
  it('nombra lugares con su categoría y zona', () => {
    expect(lugarDesdePhoton(feature({ name: 'Hospital General Celaya', osm_value: 'hospital', district: 'Casa Blanca' }))).toEqual({
      nombre: 'Hospital General Celaya',
      detalle: 'Hospital · Casa Blanca',
      coordenadas: [-100.81, 20.52],
    });
  });

  it('un lugar con nombre conserva su categoría aunque Photon lo marque como domicilio', () => {
    const l = lugarDesdePhoton(feature({ name: 'Hospital General Celaya', type: 'house', osm_value: 'hospital', street: 'Calle Juan B. Castelazo' }));
    expect(l?.detalle).toBe('Hospital · Calle Juan B. Castelazo');
  });

  it('usa calle y número cuando no hay nombre', () => {
    const l = lugarDesdePhoton(feature({ street: 'Calle Manuel Doblado', housenumber: '103', type: 'house', osm_value: 'house' }));
    expect(l?.nombre).toBe('Calle Manuel Doblado 103');
    expect(l?.detalle).toBe('Dirección');
  });

  it('marca calles y colonias, y omite «Zona Urbana de Celaya»', () => {
    expect(lugarDesdePhoton(feature({ name: 'Avenida Tecnológico', osm_value: 'primary', district: 'Deportiva' }))?.detalle).toBe('Calle · Deportiva');
    expect(lugarDesdePhoton(feature({ name: 'Las Insurgentes', osm_value: 'quarter', city: 'Celaya' }))?.detalle).toBe('Colonia · Celaya');
    expect(lugarDesdePhoton(feature({ name: 'Parque Xochipilli', osm_value: 'park', city: 'Zona Urbana de Celaya' }))?.detalle).toBe('Parque');
  });

  it('descarta resultados sin nombre ni dirección', () => {
    expect(lugarDesdePhoton(feature({ osm_value: 'yes' }))).toBeNull();
  });

  it('quita duplicados cercanos con el mismo nombre', () => {
    const a = lugarDesdePhoton(feature({ name: 'Central de Autobuses de Celaya', osm_value: 'bus_station' }, [-100.8, 20.53]))!;
    const b = lugarDesdePhoton(feature({ name: 'Central de Autobuses de Celaya', osm_value: 'bus_station' }, [-100.8005, 20.5302]))!;
    const c = lugarDesdePhoton(feature({ name: 'Central de Autobuses Cortazar', osm_value: 'bus_station' }, [-100.96, 20.48]))!;
    expect(sinDuplicados([a, b, c]).map((l) => l.nombre)).toEqual(['Central de Autobuses de Celaya', 'Central de Autobuses Cortazar']);
  });
});

describe('búsquedas que son números de ruta', () => {
  it('no manda números de ruta al buscador de lugares', () => {
    for (const q of ['47', '15-A', '15a', 'ruta 60', ' 61 ']) expect(esNumeroDeRuta(q)).toBe(true);
    for (const q of ['hospital', 'cetis 115', 'calle 5 de mayo']) expect(esNumeroDeRuta(q)).toBe(false);
  });
});
