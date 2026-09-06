import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { avatarPorDefecto } from '@/lib/avatares';
import { inicializarEmpresaDesdePerfil } from '@/lib/perfiles';

// ALTA AUTOMÁTICA DE EMPRESAS
// =====================================================
//
// Corre lo mismo que hoy hace un admin al tocar "Aprobar ✓" en Panel
// Maestro → Notificações (mismos pasos, mismo orden), pero sin
// depender de que haya un admin con sesión abierta mirando la
// pantalla en ese momento — así el emprendedor no espera a que
// alguien lo vea.
//
// Se activa/desactiva desde el interruptor "Alta automática" en
// Notificações (configuracion_plataforma.alta_automatica_activa): es
// una válvula de caudal — con poco volumen de altas conviene que sea
// instantáneo, pero si el volumen se dispara se puede volver a
// Manual para no perder el control de cuántas empresas se dan de
// alta por hora.
//
// Usa la service role key porque tiene que poder crear la empresa,
// su plan de cuentas completo y vincular el usuario — cosas que la
// key pública no puede hacer sin una sesión de admin.
//
// No pide un token de sesión: justo después de /crear-cuenta el
// usuario todavía no confirmó su email, así que no tiene una sesión
// válida para mandar. La seguridad acá pasa por otro lado — este
// endpoint no hace nada salvo que el interruptor global "Alta
// automática" esté prendido, y solo actúa sobre EL id de solicitud
// puntual que se le pasa (un UUID no adivinable), haciendo
// exactamente lo que esa solicitud ya pedía. No hay nada que un
// llamador arbitrario pueda forzar que no fuera a pasar solo con
// tener el id (que ya sale en la respuesta del insert del propio
// usuario).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Alta automática no configurada en el servidor.' }, { status: 501 });
  }

  const { solicitud_id: solicitudId } = await request.json();

  if (!solicitudId) {
    return NextResponse.json({ error: 'Falta solicitud_id.' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: config } = await admin
    .from('configuracion_plataforma')
    .select('alta_automatica_activa')
    .eq('id', true)
    .maybeSingle();

  if (!config?.alta_automatica_activa) {
    return NextResponse.json({ aprobada: false, motivo: 'alta_automatica_desactivada' });
  }

  const { data: solicitud, error: errorSolicitud } = await admin
    .from('solicitudes_alta')
    .select('*')
    .eq('id', solicitudId)
    .maybeSingle();

  if (errorSolicitud || !solicitud) {
    return NextResponse.json({ error: 'No se encontró esa solicitud.' }, { status: 404 });
  }

  if (solicitud.estado !== 'PENDIENTE') {
    return NextResponse.json({ aprobada: false, motivo: 'ya_resuelta' });
  }

  try {
    const { data: existeNombre, error: errorNombreDuplicado } = await admin.rpc('existe_nombre_empresa', {
      p_nombre: solicitud.nombre_empresa,
      p_excluir_solicitud_id: solicitud.id,
    });

    if (errorNombreDuplicado) {
      throw new Error(errorNombreDuplicado.message);
    }

    // No se rechaza la solicitud automáticamente por esto — queda
    // pendiente para que un admin la revise a mano en Notificações
    // (puede ser un duplicado real, o dos personas anotando la misma
    // empresa familiar).
    if (existeNombre) {
      return NextResponse.json({ aprobada: false, motivo: 'nombre_duplicado' });
    }

    const { data: nuevaEmpresa, error: errorEmpresa } = await admin
      .from('empresas')
      .insert({
        nombre: solicitud.nombre_empresa,
        rubro: solicitud.rubro,
        telefono: solicitud.telefono,
        email: solicitud.email,
        moneda: solicitud.moneda,
        idioma: solicitud.idioma,
        logo_url: avatarPorDefecto(solicitud.sexo),
        onboarding_completado: false,
        // El alta automática siempre arranca en modo Automático — es
        // la misma idea que la de este interruptor: privilegiar
        // velocidad. Un admin lo puede pasar a Manual después desde
        // la tarjeta de la empresa en Panel Maestro.
        validacion_automatica: true,
      })
      .select('id, numero_cliente')
      .single();

    if (errorEmpresa || !nuevaEmpresa) {
      throw new Error(errorEmpresa?.message ?? 'No se pudo crear la empresa.');
    }

    const { error: errorPerfilEmpresa } = await admin
      .from('empresas')
      .update({ perfil_empresa_id: solicitud.perfil_empresa_id })
      .eq('id', nuevaEmpresa.id);

    if (errorPerfilEmpresa) {
      throw new Error(errorPerfilEmpresa.message);
    }

    if ((solicitud.componentes_mixto ?? []).length > 0) {
      const { error: errorComponentes } = await admin
        .from('empresa_mixto_componentes')
        .insert(solicitud.componentes_mixto.map((componente: string) => ({ empresa_id: nuevaEmpresa.id, componente })));

      if (errorComponentes) {
        throw new Error(errorComponentes.message);
      }
    }

    await inicializarEmpresaDesdePerfil(
      nuevaEmpresa.id,
      solicitud.perfil_empresa_id,
      solicitud.idioma,
      solicitud.moneda,
      admin
    );

    const { error: errorVincular } = await admin.rpc('vincular_usuario_a_empresa', {
      p_email: solicitud.email,
      p_empresa_id: nuevaEmpresa.id,
      p_rol: 'Cliente',
      p_nombre: solicitud.nombre,
    });

    if (errorVincular) {
      throw new Error(errorVincular.message);
    }

    const { error: errorCerrarSolicitud } = await admin
      .from('solicitudes_alta')
      .update({ estado: 'APROBADA', empresa_id: nuevaEmpresa.id, resuelto_en: new Date().toISOString() })
      .eq('id', solicitud.id);

    if (errorCerrarSolicitud) {
      throw new Error(errorCerrarSolicitud.message);
    }

    return NextResponse.json({ aprobada: true, numero_cliente: nuevaEmpresa.numero_cliente });
  } catch (errorAprobar) {
    console.error('Error en alta automática de', solicitud.nombre_empresa, errorAprobar);

    return NextResponse.json(
      { error: errorAprobar instanceof Error ? errorAprobar.message : 'Error desconocido en el alta automática.' },
      { status: 500 }
    );
  }
}
