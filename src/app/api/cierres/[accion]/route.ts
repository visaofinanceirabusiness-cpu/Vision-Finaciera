import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clienteDeServicio, mensajeDeError } from '@/lib/sabioSoporte/servidor';

// CIERRE MENSUAL — habilitar / mantener / volver a bloquear un mes cerrado. Solo el CLIENTE de la empresa (nunca el desarrollador
// en nombre de él: el desarrollador solo puede reabrir fuera de plazo). Las funciones SQL periodo_* solo las ejecuta service_role,
// por eso la clave se verifica acá y no se puede saltear llamando a la base directo.
//   habilitar { periodo: 'AAAA-MM-01', clave }  → abre el mes ~3 min
//   latido    {}                                → extiende lo abierto mientras la app siga abierta
//   bloquear  { periodo? }                      → vuelve a cerrar (todo lo abierto por este usuario si no se indica)
export const dynamic = 'force-dynamic';

const TTL_SEGUNDOS = 180;
const MAX_INTENTOS = 5;

export async function POST(request: NextRequest, { params }: { params: Promise<{ accion: string }> }) {
  const { accion } = await params;
  const admin = clienteDeServicio();
  if (!admin) return NextResponse.json({ error: 'Supabase no configurado en el servidor.' }, { status: 501 });

  // sendBeacon (al cerrar la pestaña) no puede mandar cabeceras: el token viaja también en el cuerpo.
  const cuerpo = (await request.json().catch(() => ({}))) as { periodo?: string; clave?: string; token?: string };
  const jwt = request.headers.get('authorization')?.replace('Bearer ', '') || cuerpo.token;
  if (!jwt) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const { data: sesion } = await admin.auth.getUser(jwt);
  const usuario = sesion.user;
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const { data: perfil } = await admin.from('perfiles').select('empresa_id, tipo_usuario, es_admin_plataforma').eq('id', usuario.id).maybeSingle();
  if (!perfil?.empresa_id) return NextResponse.json({ error: 'Sin empresa.' }, { status: 403 });
  const esDev = Boolean(perfil.es_admin_plataforma);
  if (perfil.tipo_usuario !== 'CLIENTE' && !esDev) return NextResponse.json({ error: 'Solo el cliente puede habilitar períodos.' }, { status: 403 });
  const empresaId = perfil.empresa_id as string;

  try {
    if (accion === 'latido') {
      const { data } = await admin.rpc('periodo_latido', { p_empresa: empresaId, p_usuario: usuario.id, p_segundos: TTL_SEGUNDOS });
      return NextResponse.json({ abiertos: data ?? 0 });
    }
    if (accion === 'bloquear') {
      const periodo = cuerpo.periodo && /^\d{4}-\d{2}-\d{2}$/.test(cuerpo.periodo) ? cuerpo.periodo : null;
      const { data } = await admin.rpc('periodo_bloquear', { p_empresa: empresaId, p_usuario: usuario.id, p_periodo: periodo, p_motivo: periodo ? 'MANUAL' : 'APP_CERRADA_O_MANUAL' });
      return NextResponse.json({ bloqueados: data ?? 0 });
    }
    if (accion === 'habilitar') {
      if (!cuerpo.periodo || !/^\d{4}-\d{2}-\d{2}$/.test(cuerpo.periodo) || (!esDev && !cuerpo.clave)) return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });

      // El desarrollador es el único cliente de su propia empresa (la demo): no se le pide contraseña. Los clientes reales, siempre.
      if (!esDev) {
        const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { count } = await admin.from('periodos_eventos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('usuario_id', usuario.id).eq('accion', 'CLAVE_ERRADA').gte('creado_en', desde);
        if ((count ?? 0) >= MAX_INTENTOS) return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en 15 minutos.' }, { status: 429 });

        // Cliente descartable: no toca ni reemplaza la sesión del usuario.
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error: errClave } = await anon.auth.signInWithPassword({ email: usuario.email as string, password: cuerpo.clave as string });
        if (errClave) {
          await admin.from('periodos_eventos').insert({ empresa_id: empresaId, periodo: cuerpo.periodo, accion: 'CLAVE_ERRADA', usuario_id: usuario.id });
          return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
        }

      }

      const { data, error } = await admin.rpc('periodo_habilitar', { p_empresa: empresaId, p_periodo: cuerpo.periodo, p_usuario: usuario.id, p_es_dev: esDev, p_segundos: TTL_SEGUNDOS });
      if (error) {
        if (error.message.includes('PLAZO_VENCIDO')) return NextResponse.json({ error: 'PLAZO_VENCIDO' }, { status: 409 });
        throw error;
      }
      return NextResponse.json({ estado: data });
    }
    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: mensajeDeError(e) }, { status: 500 });
  }
}
