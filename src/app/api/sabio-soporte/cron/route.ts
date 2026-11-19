import { NextRequest, NextResponse } from 'next/server';
import { ejecutarDia } from '@/lib/sabioSoporte/ejecutor';
import { EMPRESA_DEMO_ID, clienteDeServicio, diasPendientes, hoyLocal } from '@/lib/sabioSoporte/servidor';

// SABIO SOPORTE — disparo automático diario (Vercel Cron, ver vercel.json). Protegido con CRON_SECRET como los demás crons.
// Solo corre si Sabio Soporte está ACTIVO y no PAUSADO. Ejecuta el día de hoy y, si en los últimos días quedó alguno sin ejecutar
// (la función no corrió, estuvo pausado), lo recupera: nunca más de 3 días por corrida, en orden.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (secreto && request.headers.get('authorization') !== `Bearer ${secreto}`) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const admin = clienteDeServicio();
  if (!admin) return NextResponse.json({ error: 'Supabase no configurado en el servidor.' }, { status: 501 });

  const { data: fila } = await admin.from('sabio_soporte_config').select('activo, pausado').eq('empresa_id', EMPRESA_DEMO_ID).maybeSingle();
  if (!fila?.activo || fila.pausado) return NextResponse.json({ ejecutado: false, motivo: !fila?.activo ? 'inactivo' : 'pausado' });

  const hoy = hoyLocal();
  const pendientes = (await diasPendientes(admin, EMPRESA_DEMO_ID, hoy)).slice(-3);
  const resultados = [];
  for (const fecha of pendientes) {
    try {
      resultados.push(await ejecutarDia(admin, EMPRESA_DEMO_ID, fecha, { hoy }));
    } catch (e) {
      resultados.push({ fecha, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ ejecutado: true, hoy, resultados: resultados.map((r) => ('error' in r ? r : { fecha: r.fecha, ok: r.ok, errores: r.errores, omitido: r.omitido })) });
}
