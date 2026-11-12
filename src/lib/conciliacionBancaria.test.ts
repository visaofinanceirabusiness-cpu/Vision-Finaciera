import { describe, expect, it } from 'vitest';
import { conciliar, emparejar, estadoDeSaldos, palabrasClave, proponerOperacion, type MovBanco, type OpVisao } from './conciliacionBancaria';

const mov = (id: string, fecha: string, monto: number, descripcion = '', contraparte: string | null = null): MovBanco => ({ id, fecha, monto, descripcion, contraparte });
const op = (idOperacion: string, fecha: string, monto: number, texto = '', operacion = 'PAGO', categoria = 'Alimentación'): OpVisao => ({ idOperacion, fecha, monto, texto, operacion, categoria });

describe('emparejar', () => {
  it('une movimiento y operación con mismo importe y signo a pocos días', () => {
    expect(emparejar([mov('m1', '2026-11-10', -140)], [op('OP-1', '2026-11-09', -140)])).toEqual([{ movId: 'm1', idOperacion: 'OP-1', puntaje: 90 }]);
  });
  it('no une si el signo, el importe o la fecha no coinciden', () => {
    expect(emparejar([mov('m1', '2026-11-10', -140)], [op('OP-1', '2026-11-10', 140)])).toHaveLength(0);
    expect(emparejar([mov('m1', '2026-11-10', -140)], [op('OP-1', '2026-11-10', -141)])).toHaveLength(0);
    expect(emparejar([mov('m1', '2026-11-10', -140)], [op('OP-1', '2026-11-20', -140)])).toHaveLength(0);
  });
  it('usa cada operación una sola vez y prefiere la más cercana', () => {
    const r = emparejar([mov('m1', '2026-11-10', -50), mov('m2', '2026-11-12', -50)], [op('OP-1', '2026-11-10', -50)]);
    expect(r).toEqual([{ movId: 'm1', idOperacion: 'OP-1', puntaje: 100 }]);
  });
  it('desempata por parecido de texto', () => {
    const r = emparejar([mov('m1', '2026-11-10', -30, 'PIX ENVIADO Padaria Central')], [op('OP-1', '2026-11-10', -30, 'Farmacia'), op('OP-2', '2026-11-10', -30, 'Padaria Central')]);
    expect(r[0].idOperacion).toBe('OP-2');
  });
});

describe('conciliar', () => {
  it('separa lo emparejado, lo que falta en Visão y lo que falta en el banco', () => {
    const r = conciliar([mov('m1', '2026-11-10', -140), mov('m2', '2026-11-11', 300)], [op('OP-1', '2026-11-10', -140), op('OP-9', '2026-11-05', -20)]);
    expect(r.emparejados.map((e) => e.movId)).toEqual(['m1']);
    expect(r.sinOperacion.map((m) => m.id)).toEqual(['m2']);
    expect(r.sinBanco.map((o) => o.idOperacion)).toEqual(['OP-9']);
  });
});

describe('proponerOperacion', () => {
  const historial = [{ texto: 'Netflix assinatura', categoria: 'Ocio y Entretenimiento', operacion: 'PAGO' }];
  it('PAGO si salió plata y COBRO si entró', () => {
    expect(proponerOperacion(mov('m', '2026-11-10', -10), []).operacion).toBe('PAGO');
    expect(proponerOperacion(mov('m', '2026-11-10', 10), []).operacion).toBe('COBRO');
  });
  it('aprende la categoría de operaciones parecidas', () => {
    const p = proponerOperacion(mov('m', '2026-11-10', -45, 'NETFLIX.COM'), historial);
    expect(p.categoria).toBe('Ocio y Entretenimiento');
  });
  it('sin parecidas no inventa categoría', () => {
    expect(proponerOperacion(mov('m', '2026-11-10', -45, 'Loja XYZ'), historial).categoria).toBeNull();
  });
});

describe('estadoDeSaldos', () => {
  it('avisa cuando aprobar todo iguala los saldos', () => {
    expect(estadoDeSaldos(1000, 860, [{ monto: 140 }])).toMatchObject({ diferencia: 140, coincide: false, coincidiriaAlAprobar: true });
  });
  it('coincide cuando no hay diferencia', () => {
    expect(estadoDeSaldos(500, 500, [])).toMatchObject({ coincide: true, coincidiriaAlAprobar: false });
  });
  it('si aprobar no alcanza, queda la diferencia', () => {
    expect(estadoDeSaldos(1000, 700, [{ monto: 140 }])).toMatchObject({ coincidiriaAlAprobar: false, diferencia: 300 });
  });
});

describe('palabrasClave', () => {
  it('ignora palabras vacías, números y tildes', () => {
    expect(palabrasClave('PIX ENVIADO Padaría 12345 da Esquina')).toEqual(['padaria', 'esquina']);
  });
});
