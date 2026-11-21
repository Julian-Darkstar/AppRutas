import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETA_RUTAS, aJSONLegible, agruparRutas, paradasCercanas, validarParadas, validarRuta } from '../scripts/lib/rutas.mjs';
import { kmlARuta } from '../scripts/lib/kml.mjs';

const leer = (archivo: string) => JSON.parse(readFileSync(`data/rutas/${archivo}`, 'utf8'));

const rutaMinima = () => ({
  type: 'FeatureCollection',
  ruta: { id: '99', numero: '99', nombre: 'Prueba', color: '#1F63CF', tipo: 'ida-regreso' },
  features: [
    {
      type: 'Feature',
      properties: { tipo: 'recorrido', sentido: 'ida' },
      geometry: { type: 'LineString', coordinates: [[-100.81, 20.52], [-100.8, 20.53]] },
    },
  ],
});

describe('datos de rutas del repositorio', () => {
  for (const archivo of readdirSync('data/rutas').filter((f) => f.endsWith('.geojson'))) {
    it(`${archivo} es válido y está bien formateado`, () => {
      const texto = readFileSync(`data/rutas/${archivo}`, 'utf8');
      const datos = JSON.parse(texto);
      expect(validarRuta(datos, archivo.replace('.geojson', ''))).toEqual([]);
      expect(aJSONLegible(datos)).toBe(texto);
    });
  }
});

describe('validarRuta', () => {
  it('acepta una ruta mínima', () => {
    expect(validarRuta(rutaMinima(), '99')).toEqual([]);
  });

  it('detecta latitud y longitud invertidas', () => {
    const r = rutaMinima();
    r.features[0].geometry.coordinates = [[20.52, -100.81], [20.53, -100.8]];
    expect(validarRuta(r, '99').join()).toMatch(/invertidos/);
  });

  it('exige que el id coincida con el nombre del archivo', () => {
    expect(validarRuta(rutaMinima(), '98').join()).toMatch(/deben coincidir/);
  });

  it('un circuito lleva un recorrido "circuito" o dos (ida y regreso); colores y servicio se validan', () => {
    const r = rutaMinima();
    r.ruta.tipo = 'circuito';
    r.ruta.color = 'azul';
    (r.ruta as Record<string, unknown>).servicio = 'foránea';
    const errores = validarRuta(r, '99').join(' ');
    expect(errores).toMatch(/Un circuito lleva un recorrido/);
    expect(errores).toMatch(/hexadecimal/);
    expect(errores).toMatch(/"ruta.servicio"/);

    const doble = rutaMinima();
    doble.ruta.tipo = 'circuito';
    const vuelta = structuredClone(doble.features[0]);
    vuelta.properties.sentido = 'regreso';
    doble.features.push(vuelta);
    expect(validarRuta(doble, '99')).toEqual([]);
  });

  it('exige al menos un recorrido', () => {
    const r = rutaMinima();
    r.features = [];
    expect(validarRuta(r, '99').join()).toMatch(/al menos un "recorrido"/);
  });
});

describe('agruparRutas', () => {
  it('ordena por número natural y calcula la caja de cada ruta', () => {
    const { rutas, geojson } = agruparRutas([leer('61.geojson'), leer('60.geojson'), leer('15-a.geojson')]);
    expect(rutas.map((r: { numero: string }) => r.numero)).toEqual(['15-A', '60', '61']);
    const r61 = rutas.find((r: { id: string }) => r.id === '61')!;
    expect(r61.sentidos).toEqual(['ida', 'regreso']);
    const [o, s, e, n] = r61.caja;
    expect(o).toBeLessThan(e);
    expect(s).toBeLessThan(n);
    expect(geojson.features.every((f: { properties: { ruta: string; color: string } }) => f.properties.ruta && f.properties.color)).toBe(true);
  });
});

describe('paleta de rutas', () => {
  it('tiene 8 colores hexadecimales distintos', () => {
    const hex = PALETA_RUTAS.map((c: { hex: string }) => c.hex);
    expect(new Set(hex).size).toBe(8);
    expect(hex.every((h: string) => /^#[0-9A-F]{6}$/.test(h))).toBe(true);
  });
});

describe('importar KML de Google My Maps', () => {
  const kml = (archivo: string) => readFileSync(`data/kml-original/${archivo}`, 'utf8');

  it('reconoce un circuito (la línea termina donde empieza)', () => {
    const { datos } = kmlARuta(kml('ruta-60.kml'), { id: '60', numero: '60', color: '#1F63CF' });
    expect(datos.ruta.tipo).toBe('circuito');
    expect(datos.features.filter((f: any) => f.properties.tipo === 'recorrido').map((f: any) => f.properties.sentido)).toEqual(['circuito']);
  });

  it('separa ida y regreso, y distingue paradas de lugares', () => {
    const { datos, avisos } = kmlARuta(kml('ruta-61.kml'), { id: '61', numero: '61', color: '#C24A0A' });
    expect(datos.features.filter((f: any) => f.properties.tipo === 'recorrido').map((f: any) => f.properties.sentido)).toEqual(['ida', 'regreso']);
    expect(datos.features.filter((f: any) => f.properties.tipo === 'parada')).toHaveLength(1);
    expect(datos.features.filter((f: any) => f.properties.tipo === 'lugar')).toHaveLength(1);
    expect(avisos).toEqual([]);
    expect(validarRuta(datos, '61')).toEqual([]);
  });

  it('avisa cuando solo hay un sentido trazado', () => {
    const { avisos } = kmlARuta(kml('ruta-15a.kml'), { id: '15-a', numero: '15-A', color: '#B4197C' });
    expect(avisos.join()).toMatch(/Solo hay un sentido/);
  });

  it('quita la altitud y redondea a 5 decimales', () => {
    const { datos } = kmlARuta(kml('ruta-61.kml'), { id: '61', numero: '61', color: '#C24A0A' });
    const [primera] = datos.features[0].geometry.coordinates;
    expect(primera).toHaveLength(2);
    expect(String(primera[0]).split('.')[1].length).toBeLessThanOrEqual(5);
  });
});

describe('paradas', () => {
  const paradas = JSON.parse(readFileSync('data/paradas.geojson', 'utf8'));

  it('data/paradas.geojson es válido y está bien formateado', () => {
    expect(validarParadas(paradas)).toEqual([]);
    expect(aJSONLegible(paradas)).toBe(readFileSync('data/paradas.geojson', 'utf8'));
  });

  it('detecta ids repetidos y coordenadas invertidas', () => {
    const malas = structuredClone(paradas);
    malas.features[1].properties.id = malas.features[0].properties.id;
    malas.features[2].geometry.coordinates = [20.52, -100.81];
    const errores = validarParadas(malas).join(' ');
    expect(errores).toMatch(/repetido/);
    expect(errores).toMatch(/invertidos/);
  });

  it('asocia solo las paradas cercanas y las ordena a lo largo del recorrido', () => {
    // Línea recta de oeste a este (~1 km); 0.0001° de latitud ≈ 11 m.
    const linea = [[-100.82, 20.52], [-100.81, 20.52]];
    const puntos = [
      { id: 'lejos', coordenadas: [-100.815, 20.5205] }, // ~55 m al norte
      { id: 'final', coordenadas: [-100.8105, 20.5201] },
      { id: 'inicio', coordenadas: [-100.8195, 20.5199] },
      { id: 'medio', coordenadas: [-100.815, 20.52015] }, // ~17 m
    ];
    expect(paradasCercanas(linea, puntos)).toEqual(['inicio', 'medio', 'final']);
  });

  it('agruparRutas guarda las paradas de cada sentido y solo publica las usadas', () => {
    const { rutas, paradas: usadas } = agruparRutas([leer('61.geojson'), leer('60.geojson')], paradas);
    const r60 = rutas.find((r: { id: string }) => r.id === '60')!;
    expect(r60.tipo).toBe('circuito');
    expect(r60.nombresSentido).toEqual({ ida: 'Circuito 3 Sur', regreso: 'Circuito 3 Norte' });
    expect(r60.paradas.ida.length).toBeGreaterThan(10);
    const ids = new Set(usadas.map((p: { id: string }) => p.id));
    for (const r of rutas) for (const lista of Object.values(r.paradas) as string[][]) for (const id of lista) expect(ids.has(id)).toBe(true);
    expect(usadas.length).toBeLessThan(paradas.features.length);
  });
});
