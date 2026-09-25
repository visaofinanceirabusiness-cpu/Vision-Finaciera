import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Acepta un código de invitación de "Nuestro Sueño" (ver
// lib/nuestroSueno.ts) y vincula las dos empresas. Va por acá y no
// por el cliente directo porque la empresa que se une todavía no
// tiene RLS para leer la fila del otro lado — recién puede verla una
// vez que ya es empresa_b_id, y para llegar a eso primero hay que
// leerla por código.
//
// force-dynamic: mismo motivo que el resto de las rutas de servidor
// de este proyecto — sin esto Next.js puede cachear la respuesta.
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase no configurado en el servidor.' }, { status: 501 });
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: usuario, error: errorUsuario } = await admin.auth.getUser(token);
  if (errorUsuario || !usuario.user) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }

  const { data: perfil } = await admin
    .from('perfiles')
    .select('empresa_id')
    .eq('id', usuario.user.id)
    .maybeSingle();

  if (!perfil?.empresa_id) {
    return NextResponse.json({ error: 'No se pudo identificar tu empresa.' }, { status: 400 });
  }

  const { codigo } = await request.json();
  const codigoLimpio = String(codigo ?? '').trim().toUpperCase();

  if (!codigoLimpio) {
    return NextResponse.json({ error: 'Falta el código.' }, { status: 400 });
  }

  const { data: invitacion, error: errorInvitacion } = await admin
    .from('sueno_parejas')
    .select('id, empresa_a_id, empresa_b_id, estado, expira_en')
    .eq('codigo', codigoLimpio)
    .maybeSingle();

  if (errorInvitacion) {
    return NextResponse.json({ error: errorInvitacion.message }, { status: 500 });
  }

  if (!invitacion) {
    return NextResponse.json({ error: 'Código inválido.' }, { status: 404 });
  }

  if (invitacion.estado !== 'PENDIENTE' || invitacion.empresa_b_id) {
    return NextResponse.json({ error: 'Este código ya fue usado.' }, { status: 409 });
  }

  if (new Date(invitacion.expira_en) < new Date()) {
    return NextResponse.json({ error: 'Este código venció. Pedí uno nuevo.' }, { status: 409 });
  }

  if (invitacion.empresa_a_id === perfil.empresa_id) {
    return NextResponse.json({ error: 'No podés unirte a tu propia invitación.' }, { status: 400 });
  }

  // "Por única vez": ninguna de las dos empresas puede tener ya otro
  // vínculo VINCULADA activo (ni como lado A ni como lado B) — la
  // migración lo refuerza con índices únicos parciales, esto solo da
  // un mensaje claro en vez de un error de constraint.
  const { data: vinculosExistentes } = await admin
    .from('sueno_parejas')
    .select('id')
    .eq('estado', 'VINCULADA')
    .or(`empresa_a_id.eq.${perfil.empresa_id},empresa_b_id.eq.${perfil.empresa_id}`)
    .limit(1);

  if (vinculosExistentes && vinculosExistentes.length > 0) {
    return NextResponse.json({ error: 'Tu empresa ya tiene un vínculo de Nuestro Sueño activo.' }, { status: 409 });
  }

  const { error: errorUpdate } = await admin
    .from('sueno_parejas')
    .update({ empresa_b_id: perfil.empresa_id, estado: 'VINCULADA', vinculado_en: new Date().toISOString() })
    .eq('id', invitacion.id)
    .eq('estado', 'PENDIENTE');

  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, parejaId: invitacion.id });
}
