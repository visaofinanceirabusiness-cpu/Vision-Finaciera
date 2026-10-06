// Al editar el monto de una plantilla que devenga mes a mes, los meses ya
// devengados quedan con el monto viejo (ver lib/devengoAjuste.ts). Esto le
// ofrece a la persona aplicar el nuevo monto a esos meses, uno por uno.

import { ajustarMontoDevengado, buscarMesesAjustables, type LadoAjuste } from '@/lib/devengoAjuste';
import { formatearPeriodo } from '@/lib/fecha';

export async function ofrecerAjustarMesesDevengados(
  empresaId: string,
  lado: LadoAjuste,
  plantillaId: string,
  nuevoMonto: number,
  idioma: string,
  simbolo: string
): Promise<number> {
  const esPT = idioma === 'PT';
  const meses = await buscarMesesAjustables(empresaId, lado, plantillaId, nuevoMonto);
  let ajustados = 0;

  for (const mes of meses) {
    const nombreMes = formatearPeriodo(mes.periodo, esPT);
    const aceptar = window.confirm(
      esPT
        ? `${nombreMes} já foi reconhecido em ${simbolo} ${mes.montoDevengado}. Aplicar o novo valor (${simbolo} ${nuevoMonto}) também a esse mês?`
        : `${nombreMes} ya se reconoció en ${simbolo} ${mes.montoDevengado}. ¿Aplicar el nuevo monto (${simbolo} ${nuevoMonto}) también a ese mes?`
    );

    if (aceptar) {
      await ajustarMontoDevengado(empresaId, lado, mes.id, nuevoMonto);
      ajustados += 1;
    }
  }

  return ajustados;
}
