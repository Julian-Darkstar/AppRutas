import { describe, expect, it } from 'vitest';
import { hashDe, leerHash } from '../src/navegacion';

describe('navegación por URL', () => {
  it('lee la lista y las rutas', () => {
    expect(leerHash('')).toEqual({ tipo: 'lista' });
    expect(leerHash('#/')).toEqual({ tipo: 'lista' });
    expect(leerHash('#/ruta/60')).toEqual({ tipo: 'ruta', id: '60' });
    expect(leerHash('#/ruta/61/regreso')).toEqual({ tipo: 'ruta', id: '61', sentido: 'regreso' });
  });

  it('ignora sentidos desconocidos y rutas incompletas', () => {
    expect(leerHash('#/ruta/61/hacia-arriba')).toEqual({ tipo: 'ruta', id: '61' });
    expect(leerHash('#/ruta')).toEqual({ tipo: 'lista' });
  });

  it('genera URLs cortas (la ida es el sentido por omisión)', () => {
    expect(hashDe({ tipo: 'lista' })).toBe('#/');
    expect(hashDe({ tipo: 'ruta', id: '15-a' })).toBe('#/ruta/15-a');
    expect(hashDe({ tipo: 'ruta', id: '61', sentido: 'ida' })).toBe('#/ruta/61');
    expect(hashDe({ tipo: 'ruta', id: '61', sentido: 'regreso' })).toBe('#/ruta/61/regreso');
  });

  it('ida y vuelta: leerHash(hashDe(v)) conserva la vista', () => {
    const vista = { tipo: 'ruta', id: '61', sentido: 'regreso' } as const;
    expect(leerHash(hashDe(vista))).toEqual(vista);
  });
});
