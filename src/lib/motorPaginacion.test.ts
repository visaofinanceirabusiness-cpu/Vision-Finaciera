import { describe, expect, it } from 'vitest';
import { traerTodo } from './motor';

const paginaDe = (total: number) => async (desde: number, hasta: number) => ({
  data: Array.from({ length: Math.max(0, Math.min(hasta + 1, total) - desde) }, (_, i) => desde + i),
  error: null,
});

describe('traerTodo', () => {
  it('junta todas las páginas aunque pasen de 1000 filas', async () => {
    expect(await traerTodo(paginaDe(2500))).toHaveLength(2500);
  });

  it('con exactamente 1000 filas pide una página más y termina', async () => {
    let llamadas = 0;
    const filas = await traerTodo(async (d, h) => {
      llamadas += 1;
      return paginaDe(1000)(d, h);
    });
    expect(filas).toHaveLength(1000);
    expect(llamadas).toBe(2);
  });

  it('sin filas devuelve una lista vacía', async () => {
    expect(await traerTodo(paginaDe(0))).toEqual([]);
  });

  it('propaga el error de la base', async () => {
    await expect(traerTodo(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toEqual({ message: 'boom' });
  });
});
