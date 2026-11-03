import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { obtenerIndicadores } from '@/lib/contabilidad';
import { generarCodigoFamilia, resumirPersona, type EstadoFamilia, type InvitacionFamilia, type PersonaFamilia } from '@/lib/familiaUnida';

// FAMILIA UNIDA — vínculos y consolidado (ver lib/familiaUnida.ts).
//
// Va por el servidor con service_role porque la base aísla cada empresa con RLS: una persona no puede leer los datos de la otra,
// y no queremos abrir esa lectura. Acá se verifica a quién se le puede mostrar qué, y SOLO se devuelven totales y categorías
// (lo que obtenerIndicadores ya calcula para el Panel de Control), nunca operaciones sueltas. Nada se copia ni se guarda.
//
// force-dynamic: sin esto Next.js puede cachear la respuesta y mostrar datos de otra persona o de otro momento.
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Contexto = { admin: SupabaseClient; userId: string; empresaId: string; tipoUsuario: string | null; moneda: string | null; esFamiliar: boolean; nombre: string };

function error(mensaje: string, status: number) {
  return NextResponse.json({ error: mensaje }, { status });
}

async function contexto(request: NextRequest): Promise<Contexto | NextResponse> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return error('Supabase no configurado en el servidor.', 501);
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return error('No autorizado.', 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: usuario, error: errorUsuario } = await admin.auth.getUser(token);
  if (errorUsuario || !usuario.user) return error('Token inválido.', 401);

  const { data: perfil } = await admin.from('perfiles').select('empresa_id, tipo_usuario').eq('id', usuario.user.id).maybeSingle();
  if (!perfil?.empresa_id) return error('No se pudo identificar tu empresa.', 400);

  const { data: empresa } = await admin.from('empresas').select('nombre, moneda, perfiles_empresa(codigo)').eq('id', perfil.empresa_id).maybeSingle();
  const rel = empresa?.perfiles_empresa as { codigo: string }[] | { codigo: string } | null | undefined;
  const codigo = Array.isArray(rel) ? rel[0]?.codigo : rel?.codigo;

  return {
    admin,
    userId: usuario.user.id,
    empresaId: perfil.empresa_id as string,
    tipoUsuario: (perfil.tipo_usuario as string | null) ?? null,
    moneda: (empresa?.moneda as string | null) ?? null,
    esFamiliar: codigo === 'FAMILIAR',
    nombre: (empresa?.nombre as string) ?? '',
  };
}

// Solo quien administra su cuenta vincula o desvincula: ni el espectador ni el asistente.
function puedeGestionar(c: Contexto): boolean {
  return c.esFamiliar && c.tipoUsuario !== 'ESPECTADOR' && c.tipoUsuario !== 'ASISTENTE';
}

async function miFamilia(c: Contexto): Promise<string | null> {
  const { data } = await c.admin.from('familia_miembros').select('grupo_id').eq('empresa_id', c.empresaId).eq('estado', 'ACTIVO').maybeSingle();
  return (data?.grupo_id as string | undefined) ?? null;
}

async function invitacionPendiente(c: Contexto, grupoId: string | null): Promise<InvitacionFamilia | null> {
  if (!grupoId) return null;
  const { data } = await c.admin
    .from('familia_invitaciones')
    .select('codigo, expira_en')
    .eq('grupo_id', grupoId)
    .eq('empresa_origen_id', c.empresaId)
    .eq('estado', 'PENDIENTE')
    .gt('expira_en', new Date().toISOString())
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { codigo: data.codigo as string, expiraEn: data.expira_en as string } : null;
}

async function auditar(c: Contexto, tipo: string, detalle: Record<string, unknown>) {
  try {
    await c.admin.from('auditoria_eventos').insert({ actor_id: c.userId, empresa_id: c.empresaId, tipo_evento: tipo, detalle });
  } catch {
    /* la auditoría nunca debe frenar la acción */
  }
}

export async function GET(request: NextRequest) {
  const c = await contexto(request);
  if (c instanceof NextResponse) return c;
  if (!c.esFamiliar) return error('Família Unida es para perfiles de Finanzas Personales.', 403);

  const periodo = new URL(request.url).searchParams.get('periodo') || 'TODOS';
  if (periodo !== 'TODOS' && !/^\d{4}-\d{2}$/.test(periodo)) return error('Período inválido.', 400);

  const grupoId = await miFamilia(c);
  const invitacion = await invitacionPendiente(c, grupoId);
  if (!grupoId) {
    const estado: EstadoFamilia = { estado: 'SIN_FAMILIA', invitacion };
    return NextResponse.json(estado);
  }

  const { data: miembros } = await c.admin.from('familia_miembros').select('empresa_id').eq('grupo_id', grupoId).eq('estado', 'ACTIVO');
  const ids = (miembros ?? []).map((m) => m.empresa_id as string);
  const { data: empresas } = await c.admin.from('empresas').select('id, nombre, moneda').in('id', ids);

  const omitidas: string[] = [];
  const personas: PersonaFamilia[] = [];
  await Promise.all(
    (empresas ?? []).map(async (e) => {
      try {
        const ind = await obtenerIndicadores(e.id as string, periodo, c.admin);
        personas.push(resumirPersona(e.id as string, e.nombre as string, e.id === c.empresaId, ind));
      } catch (err) {
        console.warn('Família Unida: no se pudo calcular una persona:', err);
        omitidas.push(e.nombre as string);
      }
    })
  );
  // Siempre en el mismo orden: primero yo, después el resto por nombre.
  personas.sort((a, b) => Number(b.esYo) - Number(a.esYo) || a.nombre.localeCompare(b.nombre));

  const estado: EstadoFamilia = { estado: 'ACTIVA', periodo, moneda: c.moneda, personas, invitacion, omitidas };
  return NextResponse.json(estado);
}

export async function POST(request: NextRequest) {
  const c = await contexto(request);
  if (c instanceof NextResponse) return c;
  if (!puedeGestionar(c)) return error('Solo quien administra una cuenta de Finanzas Personales puede vincular o desvincular perfiles.', 403);

  const cuerpo = await request.json().catch(() => ({}));
  const accion = String(cuerpo.accion ?? '');

  if (accion === 'invitar') {
    let grupoId = await miFamilia(c);
    if (!grupoId) {
      const { data: grupo, error: errorGrupo } = await c.admin.from('familia_grupos').insert({ creado_por_empresa_id: c.empresaId }).select('id').single();
      if (errorGrupo || !grupo) return error(errorGrupo?.message ?? 'No se pudo crear la familia.', 500);
      grupoId = grupo.id as string;
      const { error: errorMiembro } = await c.admin.from('familia_miembros').insert({ grupo_id: grupoId, empresa_id: c.empresaId });
      if (errorMiembro) return error(errorMiembro.message, 409);
    }
    // Un código a la vez: el anterior queda cancelado.
    await c.admin.from('familia_invitaciones').update({ estado: 'CANCELADA' }).eq('grupo_id', grupoId).eq('empresa_origen_id', c.empresaId).eq('estado', 'PENDIENTE');
    const codigo = generarCodigoFamilia();
    const { data: inv, error: errorInv } = await c.admin.from('familia_invitaciones').insert({ grupo_id: grupoId, empresa_origen_id: c.empresaId, codigo }).select('codigo, expira_en').single();
    if (errorInv || !inv) return error(errorInv?.message ?? 'No se pudo crear la invitación.', 500);
    await auditar(c, 'familia_invitacion_creada', { grupo_id: grupoId });
    return NextResponse.json({ ok: true, invitacion: { codigo: inv.codigo, expiraEn: inv.expira_en } });
  }

  if (accion === 'cancelar') {
    const grupoId = await miFamilia(c);
    if (grupoId) await c.admin.from('familia_invitaciones').update({ estado: 'CANCELADA' }).eq('grupo_id', grupoId).eq('empresa_origen_id', c.empresaId).eq('estado', 'PENDIENTE');
    return NextResponse.json({ ok: true });
  }

  if (accion === 'unirse') {
    const codigo = String(cuerpo.codigo ?? '').trim().toUpperCase();
    if (!codigo) return error('Falta el código.', 400);

    const { data: inv } = await c.admin.from('familia_invitaciones').select('id, grupo_id, empresa_origen_id, estado, expira_en').eq('codigo', codigo).maybeSingle();
    if (!inv) return error('Código inválido.', 404);
    if (inv.estado !== 'PENDIENTE') return error('Este código ya fue usado o cancelado.', 409);
    if (new Date(inv.expira_en as string) < new Date()) return error('Este código venció. Pedí uno nuevo.', 409);
    if (inv.empresa_origen_id === c.empresaId) return error('No podés unirte a tu propia invitación.', 400);

    if (await miFamilia(c)) return error('Ya estás en una familia. Primero salí de esa para unirte a otra.', 409);

    // Quien invitó tiene que seguir en la familia, y las dos personas con la misma moneda (si no, sumar no tendría sentido).
    const { data: origen } = await c.admin.from('familia_miembros').select('id').eq('grupo_id', inv.grupo_id).eq('empresa_id', inv.empresa_origen_id).eq('estado', 'ACTIVO').maybeSingle();
    if (!origen) return error('Quien te invitó ya no está en esa familia.', 409);
    const { data: empresaOrigen } = await c.admin.from('empresas').select('moneda, perfiles_empresa(codigo)').eq('id', inv.empresa_origen_id).maybeSingle();
    const rel = empresaOrigen?.perfiles_empresa as { codigo: string }[] | { codigo: string } | null | undefined;
    const codigoOrigen = Array.isArray(rel) ? rel[0]?.codigo : rel?.codigo;
    if (codigoOrigen !== 'FAMILIAR') return error('Solo se pueden unir perfiles de Finanzas Personales.', 409);
    if ((empresaOrigen?.moneda ?? null) !== c.moneda) return error('Las dos personas tienen que usar la misma moneda para poder sumar sus finanzas.', 409);

    const { error: errorMiembro } = await c.admin.from('familia_miembros').insert({ grupo_id: inv.grupo_id, empresa_id: c.empresaId });
    if (errorMiembro) return error('No se pudo unir a la familia (¿ya estás en otra?).', 409);
    await c.admin.from('familia_invitaciones').update({ estado: 'ACEPTADA', aceptada_por_empresa_id: c.empresaId }).eq('id', inv.id).eq('estado', 'PENDIENTE');
    await auditar(c, 'familia_union_aceptada', { grupo_id: inv.grupo_id });
    return NextResponse.json({ ok: true });
  }

  if (accion === 'salir') {
    const grupoId = await miFamilia(c);
    if (!grupoId) return NextResponse.json({ ok: true });
    await c.admin.from('familia_miembros').update({ estado: 'DESVINCULADO', desvinculado_en: new Date().toISOString() }).eq('grupo_id', grupoId).eq('empresa_id', c.empresaId).eq('estado', 'ACTIVO');
    await c.admin.from('familia_invitaciones').update({ estado: 'CANCELADA' }).eq('grupo_id', grupoId).eq('empresa_origen_id', c.empresaId).eq('estado', 'PENDIENTE');
    await auditar(c, 'familia_desvinculacion', { grupo_id: grupoId });
    return NextResponse.json({ ok: true });
  }

  return error('Acción desconocida.', 400);
}
