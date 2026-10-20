import { describe, expect, it } from 'vitest';
import { armarInforme, armarParticipacion, eventosACsv, formatoDuracion, type EspectadorDemo, type EventoDemo } from './demoInforme';

const esp = (id: string, nombre: string, idioma = 'PT'): EspectadorDemo => ({ user_id: id, nombre, idioma, sabio: null, creado_en: '2026-10-26T12:00:00Z' });
const ev = (id: string, hora: string, tipo: string, ruta: string, detalle: string | null = null): EventoDemo => ({ user_id: id, ruta, tipo, detalle, creado_en: `2026-10-26T12:${hora}Z` });

const ahora = new Date('2026-10-26T12:10:30Z').getTime();

describe('informe de la demo', () => {
  const espectadores = [esp('a', 'Ana'), esp('b', 'Beto', 'ES'), esp('c', 'Carla')];
  const eventos = [
    ev('a', '10:00', 'VISTA', '/'),
    ev('a', '10:20', 'CLICK', '/', 'Jogar'),
    ev('a', '10:25', 'VISTA', '/informes'),
    ev('a', '10:28', 'LATIDO', '/informes'),
    ev('b', '05:00', 'VISTA', '/'),
    ev('b', '05:10', 'BLOQUEADO', '/'),
  ];
  const r = armarInforme(espectadores, eventos, ahora);

  it('cuenta quién está en línea y dónde', () => {
    expect(r.total).toBe(3);
    expect(r.enLinea).toBe(1);
    expect(r.dondeEstan).toEqual({ '/informes': 1 });
  });

  it('suma el tiempo en cada pantalla', () => {
    const ana = r.filas.find((f) => f.user_id === 'a')!;
    expect(ana.segundosPorRuta['/']).toBe(25);
    expect(ana.segundosPorRuta['/informes']).toBe(3 + 2);
  });

  it('cuenta clicks, bloqueos y botones más tocados', () => {
    expect(r.clicks).toBe(1);
    expect(r.bloqueos).toBe(1);
    expect(r.botones[0]).toEqual({ texto: 'Jogar', veces: 1, personas: 1 });
  });

  it('el que entró y no hizo nada queda sin actividad', () => {
    const carla = r.filas.find((f) => f.user_id === 'c')!;
    expect(carla.eventos).toBe(0);
    expect(carla.enLinea).toBe(false);
  });

  it('separa por idioma y exporta a CSV sin latidos', () => {
    expect(r.porIdioma).toEqual({ PT: 2, ES: 1 });
    const csv = eventosACsv(espectadores, eventos);
    expect(csv.split('\n')).toHaveLength(1 + 5);
    expect(csv).toContain('Ana');
  });

  it('formatea duraciones', () => {
    expect(formatoDuracion(45)).toBe('45 s');
    expect(formatoDuracion(125)).toBe('2 min 5 s');
  });

  it('cuenta la participación en calendario, noticias y cotizaciones', () => {
    const r = armarParticipacion([
      ev('a', '00:00', 'CALENDARIO', '/', 'creó evento: Reunión'),
      ev('a', '00:10', 'CALENDARIO', '/', 'editó evento: Reunión'),
      ev('b', '00:20', 'BLOQUEADO', '/', 'intentó eliminar evento'),
      ev('a', '00:30', 'CLICK', '/panel-de-control', 'Noticias › Dólar sube'),
      ev('b', '00:40', 'CLICK', '/panel-de-control', 'Noticias › Dólar sube'),
      ev('b', '00:50', 'CAMBIO', '/panel-de-control', 'Cotizaciones › Mês'),
    ]);
    expect(r.calendario).toMatchObject({ creados: 1, editados: 1, intentosBorrar: 1, personas: 1 });
    expect(r.noticias).toEqual([{ texto: 'Dólar sube', veces: 2, personas: 2 }]);
    expect(r.cotizaciones).toEqual([{ texto: 'Mês', veces: 1, personas: 1 }]);
  });
});
