import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { construirMensajeAgradecimiento } from '@/lib/agradecimientoMensual';

// ANÁLISIS MENSUAL AUTOMÁTICO — Fase C. Corre todos los días (no solo
// el día 1, ver vercel.json): para cada empresa con
// analisis_mensual_habilitado, busca su "Análisis a fondo" (ver
// api/analisis-mensual/generar) más reciente que ya tenga 5 días o
// más, y si todavía no se le mandó el agradecimiento de ESE período,
// se lo manda. Por empresa, no por una fecha global — así Buenaventura
// y Ocaña (que recibieron el análisis a mano, antes de que existiera
// este cron) también les llega en su propio día 5, sin tratamiento
// especial.
//
// Protegido con CRON_SECRET, mismo patrón que el resto de los crons.
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const DIAS_ESPERA = 5;

export async function GET(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase no configurado en el servidor.' }, { status: 501 });
  }

  if (CRON_SECRET) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const limite = new Date(Date.now() - DIAS_ESPERA * 24 * 60 * 60 * 1000).toISOString();

  const { data: empresas, error: errorEmpresas } = await admin
    .from('empresas')
    .select('id, nombre, idioma')
    .eq('activo', true)
    .eq('analisis_mensual_habilitado', true);

  if (errorEmpresas) {
    return NextResponse.json({ error: `No se pudieron listar las empresas: ${errorEmpresas.message}` }, { status: 500 });
  }

  const resultados: Record<string, string> = {};

  for (const empresa of empresas ?? []) {
    try {
      // El análisis elegible es el más reciente que ya cumplió los 5
      // días — si hubiera uno más nuevo (menos de 5 días), se ignora
      // por ahora, le va a tocar cuando cumpla.
      const { data: analisis, error: errorAnalisis } = await admin
        .from('mensajes_financieros')
        .select('periodo')
        .eq('empresa_id', empresa.id)
        .ilike('titulo', '📊%')
        .lte('creado_en', limite)
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorAnalisis) {
        resultados[empresa.nombre] = `error consultando el análisis: ${errorAnalisis.message}`;
        continue;
      }

      if (!analisis) {
        resultados[empresa.nombre] = 'sin análisis elegible (ninguno con 5+ días, o todavía no se le mandó ninguno)';
        continue;
      }

      const { data: yaAgradecido } = await admin
        .from('mensajes_financieros')
        .select('id')
        .eq('empresa_id', empresa.id)
        .eq('periodo', analisis.periodo)
        .ilike('titulo', '🎉%')
        .maybeSingle();

      if (yaAgradecido) {
        resultados[empresa.nombre] = 'ya se le había agradecido este período';
        continue;
      }

      const mensaje = construirMensajeAgradecimiento(empresa.idioma);

      const { error: errorInsertar } = await admin.from('mensajes_financieros').insert({
        empresa_id: empresa.id,
        periodo: analisis.periodo,
        titulo: mensaje.titulo,
        texto: mensaje.texto,
        requiere_consentimiento: false,
      });

      if (errorInsertar) {
        resultados[empresa.nombre] = `error guardando el agradecimiento: ${errorInsertar.message}`;
        continue;
      }

      resultados[empresa.nombre] = 'agradecimiento enviado';
    } catch (e) {
      resultados[empresa.nombre] = `error inesperado: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({ resultados });
}
