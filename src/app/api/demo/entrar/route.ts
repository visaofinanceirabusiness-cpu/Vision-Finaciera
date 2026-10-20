import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'crypto';

// ENTRADA A LA DEMO (espectadores sin registro)
// =====================================================
//
// Quien llega por el QR / código elige idioma, escribe (si quiere) cómo lo llamamos y
// entra: acá se crea un usuario propio (con su id) de tipo ESPECTADOR ligado a la
// empresa demo del código, y se devuelven sus credenciales para que el navegador
// inicie sesión. Usa la service role porque hay que crear el usuario y su perfil.
//
// El código manda: tiene fecha de inicio y de vencimiento, un tope de espectadores
// y se puede apagar (demo_accesos.activo). Vencido no se borra: queda inactivo por si
// se lo quiere reactivar. El espectador nunca puede escribir (políticas restrictivas
// en la base + corte en lib/supabase.ts).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SABIOS_VALIDOS = new Set(['activo', 'azar', 'bot', 'calendario', 'fondo', 'surfista']);

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Demo no configurada en el servidor.' }, { status: 501 });
  }

  const cuerpo = await request.json().catch(() => null);
  const codigo = String(cuerpo?.codigo ?? '').trim().toUpperCase();
  const idioma = cuerpo?.idioma;
  const apodo = String(cuerpo?.apodo ?? '').trim().slice(0, 40);
  const sabio = SABIOS_VALIDOS.has(cuerpo?.sabio) ? String(cuerpo.sabio) : null;

  if (idioma !== 'ES' && idioma !== 'PT') {
    return NextResponse.json({ error: 'Falta elegir el idioma.' }, { status: 400 });
  }

  if (!codigo) {
    return NextResponse.json({ error: 'Falta el código.', motivo: 'sin_codigo' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: acceso } = await admin
    .from('demo_accesos')
    .select('id, empresa_id, activo, activo_desde, vence_en, max_espectadores')
    .eq('codigo', codigo)
    .maybeSingle();

  const ahora = Date.now();
  const vigente =
    acceso &&
    acceso.activo &&
    new Date(acceso.activo_desde).getTime() <= ahora &&
    (!acceso.vence_en || new Date(acceso.vence_en).getTime() > ahora);

  if (!acceso || !vigente) {
    return NextResponse.json({ error: 'Este acceso no está activo.', motivo: 'inactivo' }, { status: 403 });
  }

  const { count } = await admin.from('espectadores').select('user_id', { count: 'exact', head: true }).eq('acceso_id', acceso.id);

  if ((count ?? 0) >= acceso.max_espectadores) {
    return NextResponse.json({ error: 'La demo llegó al máximo de espectadores.', motivo: 'lleno' }, { status: 429 });
  }

  const email = `espectador-${randomUUID()}@demo.visaofinanceira.app`;
  const password = randomBytes(18).toString('base64url');

  const { data: creado, error: errorUsuario } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { espectador: true },
  });

  if (errorUsuario || !creado.user) {
    return NextResponse.json({ error: 'No se pudo crear el acceso.' }, { status: 500 });
  }

  const userId = creado.user.id;

  const deshacer = async () => {
    await admin.from('espectadores').delete().eq('user_id', userId);
    await admin.from('perfiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
  };

  const { error: errorPerfil } = await admin.from('perfiles').insert({
    id: userId,
    empresa_id: acceso.empresa_id,
    nombre: apodo || `Socio ${(count ?? 0) + 1}`,
    rol: 'Cliente',
    tipo_usuario: 'ESPECTADOR',
    activo: true,
  });

  if (errorPerfil) {
    await deshacer();
    return NextResponse.json({ error: 'No se pudo crear el perfil.' }, { status: 500 });
  }

  const { error: errorEspectador } = await admin
    .from('espectadores')
    .insert({ user_id: userId, acceso_id: acceso.id, apodo: apodo || null, idioma, sabio });

  if (errorEspectador) {
    await deshacer();
    return NextResponse.json({ error: 'No se pudo registrar al espectador.' }, { status: 500 });
  }

  return NextResponse.json({ email, password, userId });
}
