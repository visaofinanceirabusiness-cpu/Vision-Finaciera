import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { openFinanceActivo, type ProveedorOpenFinance } from '@/lib/openFinance/proveedor';
import { pluggy } from '@/lib/openFinance/pluggy';
import { bancoDeNombre } from '@/lib/openFinance/bancos';

// OPEN FINANCE — servidor (ver lib/openFinance/proveedor.ts). ARMADO PERO NO ACTIVO: mientras OPEN_FINANCE_ACTIVO no sea '1' todas las
// acciones responden «no activado» y no se llama a ningún banco ni agregador. Las credenciales del agregador viven solo acá.
//
// Acciones (POST):
//   estado               → { activo }
//   token                → token de corta vida para abrir el widget de conexión del agregador
//   registrar-conexion   → { conexionExternaId }: guarda la conexión y sus cuentas después de que la persona autorizó en su banco
//   sincronizar          → trae saldos y movimientos nuevos de todas las conexiones de la empresa (últimos 90 días)
//
// force-dynamic: nunca cachear respuestas con datos bancarios.
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const proveedor: ProveedorOpenFinance = pluggy;

function respuesta(cuerpo: Record<string, unknown>, status = 200) {
  return NextResponse.json(cuerpo, { status });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ accion: string }> }) {
  const { accion } = await params;

  if (accion === 'estado') return respuesta({ activo: openFinanceActivo() });
  if (!openFinanceActivo()) return respuesta({ activo: false, error: 'Open Finance todavía no está activado.' }, 503);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return respuesta({ error: 'Supabase no configurado en el servidor.' }, 501);

  const jwt = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!jwt) return respuesta({ error: 'No autorizado.' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: usuario } = await admin.auth.getUser(jwt);
  if (!usuario.user) return respuesta({ error: 'Token inválido.' }, 401);

  const { data: perfil } = await admin.from('perfiles').select('empresa_id, tipo_usuario').eq('id', usuario.user.id).maybeSingle();
  if (!perfil?.empresa_id) return respuesta({ error: 'No se pudo identificar tu empresa.' }, 400);
  // Conectar un banco y aprobar movimientos es de quien administra: ni el espectador ni el asistente.
  if (perfil.tipo_usuario === 'ESPECTADOR' || perfil.tipo_usuario === 'ASISTENTE') return respuesta({ error: 'No tenés permiso para esta acción.' }, 403);
  const empresaId = perfil.empresa_id as string;

  const cuerpo = (await request.json().catch(() => ({}))) as { conexionExternaId?: string };

  try {
    if (accion === 'token') {
      return respuesta({ activo: true, ...(await proveedor.crearTokenDeConexion(empresaId, cuerpo.conexionExternaId)) });
    }

    if (accion === 'registrar-conexion') {
      if (!cuerpo.conexionExternaId) return respuesta({ error: 'Falta la conexión.' }, 400);
      const conexion = await proveedor.obtenerConexion(cuerpo.conexionExternaId);
      const banco = bancoDeNombre(conexion.bancoNombre);
      const { data: guardada, error } = await admin
        .from('bancos_conexiones')
        .upsert(
          { empresa_id: empresaId, proveedor: proveedor.nombre, conexion_externa_id: conexion.conexionExternaId, banco_codigo: banco?.codigo ?? 'otro', banco_nombre: banco?.nombre ?? conexion.bancoNombre, estado: conexion.estado, consentimiento_vence: conexion.consentimientoVence },
          { onConflict: 'empresa_id,proveedor,conexion_externa_id' }
        )
        .select('id')
        .single();
      if (error) throw error;
      for (const c of await proveedor.listarCuentas(conexion.conexionExternaId)) {
        await admin.from('bancos_cuentas').upsert(
          { empresa_id: empresaId, conexion_id: guardada.id, cuenta_externa_id: c.cuentaExternaId, nombre: c.nombre, numero_mascara: c.numeroMascara, moneda: c.moneda, saldo_banco: c.saldo, saldo_actualizado_en: new Date().toISOString() },
          { onConflict: 'conexion_id,cuenta_externa_id' }
        );
      }
      return respuesta({ activo: true, ok: true });
    }

    if (accion === 'sincronizar') {
      const hasta = new Date().toISOString().slice(0, 10);
      const desdeFecha = new Date();
      desdeFecha.setUTCDate(desdeFecha.getUTCDate() - 90);
      const desde = desdeFecha.toISOString().slice(0, 10);

      const { data: conexiones } = await admin.from('bancos_conexiones').select('id, conexion_externa_id').eq('empresa_id', empresaId).neq('estado', 'DESCONECTADA');
      let nuevos = 0;
      for (const cx of conexiones ?? []) {
        const info = await proveedor.obtenerConexion(cx.conexion_externa_id as string);
        await admin.from('bancos_conexiones').update({ estado: info.estado, consentimiento_vence: info.consentimientoVence, ultima_sincronizacion: new Date().toISOString() }).eq('id', cx.id);

        const { data: cuentas } = await admin.from('bancos_cuentas').select('id, cuenta_externa_id').eq('conexion_id', cx.id);
        const externas = new Map((await proveedor.listarCuentas(cx.conexion_externa_id as string)).map((c) => [c.cuentaExternaId, c]));
        for (const cuenta of cuentas ?? []) {
          const externa = externas.get(cuenta.cuenta_externa_id as string);
          if (externa) await admin.from('bancos_cuentas').update({ saldo_banco: externa.saldo, saldo_actualizado_en: new Date().toISOString() }).eq('id', cuenta.id);

          const movs = await proveedor.listarMovimientos(cuenta.cuenta_externa_id as string, desde, hasta);
          if (movs.length === 0) continue;
          // ignoreDuplicates: un movimiento ya traído conserva su estado (conciliado, aprobado o ignorado); solo entran los nuevos.
          const { data: insertados } = await admin
            .from('bancos_movimientos')
            .upsert(
              movs.map((m) => ({ empresa_id: empresaId, cuenta_banco_id: cuenta.id, id_externo: m.idExterno, fecha: m.fecha, monto: m.monto, descripcion: m.descripcion, contraparte: m.contraparte })),
              { onConflict: 'cuenta_banco_id,id_externo', ignoreDuplicates: true }
            )
            .select('id');
          nuevos += insertados?.length ?? 0;
        }
      }
      return respuesta({ activo: true, ok: true, nuevos });
    }

    return respuesta({ error: 'Acción desconocida.' }, 404);
  } catch (e) {
    return respuesta({ error: e instanceof Error ? e.message : 'Error al hablar con el proveedor.' }, 502);
  }
}
