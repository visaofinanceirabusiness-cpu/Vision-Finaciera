// lib/alertasSabio.ts
//
// Junta, en frases cortas para que las diga Sabio, los vencimientos
// próximos o vencidos de cuotas (lib/cuotas.ts) y gastos recurrentes
// (lib/gastosRecurrentes.ts) — Sabio pasa a ser el lugar DENTRO del
// sistema donde aparece la alerta (complementa, no reemplaza, el
// aviso push del Calendário del lobby).

import { listarCuotasPendientes } from './cuotas';
import { listarRecordatoriosPendientes, saldoPendiente } from './gastosRecurrentes';
import { listarRecordatoriosIngresosPendientes, saldoPendienteCobro } from './ingresosRecurrentes';
import { fechaLocalHoy } from './fecha';

export const DIAS_ANTICIPACION = 5;

export function diasHasta(fechaIso: string, hoyIso: string): number {
  const hoy = new Date(`${hoyIso}T00:00:00`);
  const fecha = new Date(`${fechaIso}T00:00:00`);
  return Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function esPT(idioma: string | null | undefined) {
  return idioma === 'PT';
}

export async function obtenerAlertasFinancieras(
  empresaId: string,
  idioma: string | null | undefined,
  simbolo: string
): Promise<string[]> {
  const hoy = fechaLocalHoy();
  const alertas: { dias: number; texto: string }[] = [];

  const [cuotas, recordatorios, recordatoriosIngresos] = await Promise.all([
    listarCuotasPendientes(empresaId).catch(() => []),
    listarRecordatoriosPendientes(empresaId).catch(() => []),
    listarRecordatoriosIngresosPendientes(empresaId).catch(() => []),
  ]);

  for (const cuota of cuotas) {
    const dias = diasHasta(cuota.fecha_vencimiento, hoy);
    if (dias > DIAS_ANTICIPACION) continue;

    const monto = `${simbolo} ${cuota.monto.toFixed(2)}`;
    let texto: string;

    if (dias < 0) {
      texto = esPT(idioma)
        ? `⚠️ Venceu: parcela ${cuota.numero_cuota}/${cuota.total_cuotas} de ${cuota.forma_pago_nombre} (${monto})`
        : `⚠️ Venció: cuota ${cuota.numero_cuota}/${cuota.total_cuotas} de ${cuota.forma_pago_nombre} (${monto})`;
    } else if (dias === 0) {
      texto = esPT(idioma)
        ? `💳 Vence hoje: parcela ${cuota.numero_cuota}/${cuota.total_cuotas} de ${cuota.forma_pago_nombre} (${monto})`
        : `💳 Vence hoy: cuota ${cuota.numero_cuota}/${cuota.total_cuotas} de ${cuota.forma_pago_nombre} (${monto})`;
    } else {
      texto = esPT(idioma)
        ? `💳 Em ${dias} dia(s): parcela ${cuota.numero_cuota}/${cuota.total_cuotas} de ${cuota.forma_pago_nombre} (${monto})`
        : `💳 En ${dias} día(s): cuota ${cuota.numero_cuota}/${cuota.total_cuotas} de ${cuota.forma_pago_nombre} (${monto})`;
    }

    alertas.push({ dias, texto });
  }

  for (const recordatorio of recordatorios) {
    const dias = diasHasta(recordatorio.fecha_vencimiento, hoy);
    if (dias > DIAS_ANTICIPACION) continue;

    const monto = `${simbolo} ${saldoPendiente(recordatorio).toFixed(2)}`;
    let texto: string;

    if (dias < 0) {
      texto = esPT(idioma)
        ? `⚠️ Venceu: ${recordatorio.nombre} (~${monto}) — ainda não foi registrado`
        : `⚠️ Venció: ${recordatorio.nombre} (~${monto}) — todavía no lo registraste`;
    } else if (dias === 0) {
      texto = esPT(idioma) ? `🏠 Vence hoje: ${recordatorio.nombre} (~${monto})` : `🏠 Vence hoy: ${recordatorio.nombre} (~${monto})`;
    } else {
      texto = esPT(idioma)
        ? `🏠 Em ${dias} dia(s): ${recordatorio.nombre} (~${monto})`
        : `🏠 En ${dias} día(s): ${recordatorio.nombre} (~${monto})`;
    }

    alertas.push({ dias, texto });
  }

  for (const recordatorio of recordatoriosIngresos) {
    const dias = diasHasta(recordatorio.fecha_vencimiento, hoy);
    if (dias > DIAS_ANTICIPACION) continue;

    const monto = `${simbolo} ${saldoPendienteCobro(recordatorio).toFixed(2)}`;
    let texto: string;

    if (dias < 0) {
      texto = esPT(idioma)
        ? `⚠️ Venceu: ${recordatorio.nombre} (~${monto}) — ainda não foi recebido`
        : `⚠️ Venció: ${recordatorio.nombre} (~${monto}) — todavía no lo cobraste`;
    } else if (dias === 0) {
      texto = esPT(idioma) ? `💰 Vence hoje: ${recordatorio.nombre} (~${monto})` : `💰 Vence hoy: ${recordatorio.nombre} (~${monto})`;
    } else {
      texto = esPT(idioma)
        ? `💰 Em ${dias} dia(s): ${recordatorio.nombre} (~${monto})`
        : `💰 En ${dias} día(s): ${recordatorio.nombre} (~${monto})`;
    }

    alertas.push({ dias, texto });
  }

  return alertas.sort((a, b) => a.dias - b.dias).map((a) => a.texto);
}
