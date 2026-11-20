import { NextRequest, NextResponse } from 'next/server';
import { clienteDeServicio, hoyLocal, mensajeDeError } from '@/lib/sabioSoporte/servidor';

// CIERRE ANUAL AUTOMÁTICO (Vercel Cron, ver vercel.json). El ejercicio es el año calendario y el asiento va fechado 31/12, pero se
// genera recién desde el 6/1: antes el cliente todavía puede reabrir diciembre, y el cierre no debe pisar su corrección.
// Recorre las empresas con cierre mensual activo y cierra, en orden, cada año terminado que todavía no tenga su asiento.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (secreto && request.headers.get('authorization') !== `Bearer ${secreto}`) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const admin = clienteDeServicio();
  if (!admin) return NextResponse.json({ error: 'Supabase no configurado en el servidor.' }, { status: 501 });

  const anioActual = Number(hoyLocal().slice(0, 4));
  const { data: empresas } = await admin.from('empresas').select('id').eq('cierre_mensual_activo', true);
  const resultado: Array<{ empresa: string; ejercicio: number; asientos?: number; error?: string }> = [];

  for (const e of empresas ?? []) {
    const { data: primera } = await admin.from('registro_operaciones').select('fecha').eq('empresa_id', e.id).order('fecha', { ascending: true }).limit(1).maybeSingle();
    if (!primera?.fecha) continue;
    const { data: hechos } = await admin.from('asientos_cierre').select('ejercicio').eq('empresa_id', e.id);
    // Un año sin movimientos de resultado cierra con 0 asientos: queda registrado en el log y no se reintenta todos los días.
    const { data: sinMovimiento } = await admin.from('periodos_eventos').select('periodo').eq('empresa_id', e.id).eq('accion', 'CIERRE_ANUAL');
    const cerrados = new Set([...(hechos ?? []).map((h) => h.ejercicio as number), ...(sinMovimiento ?? []).map((v) => Number(String(v.periodo).slice(0, 4)))]);
    for (let anio = Number(String(primera.fecha).slice(0, 4)); anio < anioActual; anio++) {
      if (cerrados.has(anio)) continue;
      const { data, error } = await admin.rpc('cerrar_ejercicio', { p_empresa: e.id, p_ejercicio: anio, p_usuario: null, p_forzar: false });
      if (error) {
        // Todavía no venció la reapertura de diciembre: es lo esperado hasta el 6/1, no una falla.
        if (!error.message.includes('EJERCICIO_NO_TERMINO')) resultado.push({ empresa: e.id, ejercicio: anio, error: mensajeDeError(error) });
        break;
      }
      resultado.push({ empresa: e.id, ejercicio: anio, asientos: data as number });
    }
  }
  return NextResponse.json({ ok: true, resultado });
}
