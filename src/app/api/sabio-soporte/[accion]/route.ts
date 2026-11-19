import { NextRequest, NextResponse } from 'next/server';
import { ejecutarDia } from '@/lib/sabioSoporte/ejecutor';
import { EMPRESA_DEMO_ID, clienteDeServicio, diasPendientes, esAdminPlataforma, hoyLocal } from '@/lib/sabioSoporte/servidor';

// SABIO SOPORTE — acciones del Panel Maestro (solo administrador de plataforma). Procesa de a UN día por llamada: el panel repite la llamada
// para rellenar la historia, así ninguna pasa del límite de tiempo de la función. Ver lib/sabioSoporte/ejecutor.ts.
//   dia              { fecha, simular?, forzar? } → ejecuta (o simula) ese día
//   dias-pendientes  {}                           → fechas del plan que todavía no se ejecutaron
//
// force-dynamic: nunca cachear. maxDuration: un día son pocas operaciones, pero cada una consulta varias veces la base.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ accion: string }> }) {
  const { accion } = await params;
  const admin = clienteDeServicio();
  if (!admin) return NextResponse.json({ error: 'Supabase no configurado en el servidor.' }, { status: 501 });
  if (!(await esAdminPlataforma(admin, request.headers.get('authorization')?.replace('Bearer ', '')))) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

  const cuerpo = (await request.json().catch(() => ({}))) as { fecha?: string; simular?: boolean; forzar?: boolean };
  const hoy = hoyLocal();

  try {
    if (accion === 'dias-pendientes') return NextResponse.json({ hoy, pendientes: await diasPendientes(admin, EMPRESA_DEMO_ID, hoy) });
    if (accion === 'dia') {
      if (!cuerpo.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(cuerpo.fecha)) return NextResponse.json({ error: 'Falta la fecha (AAAA-MM-DD).' }, { status: 400 });
      return NextResponse.json(await ejecutarDia(admin, EMPRESA_DEMO_ID, cuerpo.fecha, { simular: cuerpo.simular, forzar: cuerpo.forzar, hoy }));
    }
    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al ejecutar Sabio Soporte.' }, { status: 500 });
  }
}
