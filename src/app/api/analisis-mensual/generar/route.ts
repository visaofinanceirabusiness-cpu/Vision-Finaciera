import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { construirAnalisisMensual, type OperacionDelMes } from '@/lib/analisisMensual';

// Lo dispara un Vercel Cron Job (ver vercel.json) el día 1 de cada
// mes. Para cada empresa activa, con onboarding completo y con
// analisis_mensual_habilitado = true (ver toggle en Panel de
// Controle → Apariencia... pendiente Fase A/B, hoy se prende/apaga
// solo desde Supabase), arma el "Análisis a fondo" del mes que
// acaba de cerrar (ver lib/analisisMensual.ts) y lo deja como mensaje
// en mensajes_financieros — mismo mecanismo que ya se usaba a mano.
//
// Protegido con CRON_SECRET (mismo patrón que
// api/plan-accion/resumen-diario).
//
// force-dynamic: ver el comentario idéntico en
// api/plan-accion/resumen-diario/route.ts — sin esto Next.js cachea
// la respuesta del build y el cron ejecuta siempre lo mismo.
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// Igual que en api/cotizaciones/actualizar/route.ts y
// api/plan-accion/resumen-diario/route.ts: el server de Vercel corre
// en UTC, no en la hora local de Argentina/Brasil (UTC-3) — se resta
// el offset a mano para no quedar adelantado cerca de la medianoche.
function ahoraLocal(): Date {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

// El cron corre el día 1 — "el mes que acaba de cerrar" es siempre el
// mes calendario anterior al de hoy. Al operar siempre desde el día 1
// no hay casos borde de "el mes no tiene ese día" (ver sumarMeses en
// lib/cuotas.ts para ese problema en otro contexto).
function rangoMesPasado(): { desde: string; hasta: string; primerDiaMesPasado: Date } {
  const hoy = ahoraLocal();
  const primerDiaMesActual = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const ultimoDiaMesPasado = new Date(primerDiaMesActual.getTime() - 24 * 60 * 60 * 1000);
  const primerDiaMesPasado = new Date(Date.UTC(ultimoDiaMesPasado.getUTCFullYear(), ultimoDiaMesPasado.getUTCMonth(), 1));

  return {
    desde: primerDiaMesPasado.toISOString().slice(0, 10),
    hasta: ultimoDiaMesPasado.toISOString().slice(0, 10),
    primerDiaMesPasado,
  };
}

function nombreMes(fecha: Date, idioma: string | null): string {
  const texto = fecha.toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  // "septiembre de 2026" / "setembro de 2026" — ya viene bien del
  // propio Intl, no hace falta tocar nada más.
  return texto;
}

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
  const { desde, hasta, primerDiaMesPasado } = rangoMesPasado();
  const periodo = desde;

  const { data: empresas, error: errorEmpresas } = await admin
    .from('empresas')
    .select('id, nombre, idioma, moneda')
    .eq('activo', true)
    .eq('onboarding_completado', true)
    .eq('analisis_mensual_habilitado', true);

  if (errorEmpresas) {
    return NextResponse.json({ error: `No se pudieron listar las empresas: ${errorEmpresas.message}` }, { status: 500 });
  }

  const resultados: Record<string, string> = {};

  for (const empresa of empresas ?? []) {
    try {
      // Idempotencia: si el cron se reintenta o se dispara dos veces
      // el mismo día, no duplica el mensaje del mismo período.
      const { data: yaExiste } = await admin
        .from('mensajes_financieros')
        .select('id')
        .eq('empresa_id', empresa.id)
        .eq('periodo', periodo)
        .ilike('titulo', '📊%')
        .maybeSingle();

      if (yaExiste) {
        resultados[empresa.nombre] = 'ya existía un análisis para este período, no se duplicó';
        continue;
      }

      const [{ data: operaciones, error: errorOperaciones }, { data: categorias, error: errorCategorias }] = await Promise.all([
        admin
          .from('registro_operaciones')
          .select('operacion, categoria, total, fecha')
          .eq('empresa_id', empresa.id)
          .gte('fecha', desde)
          .lte('fecha', hasta),
        admin.from('categorias_operacion').select('operacion, nombre, tipo').eq('empresa_id', empresa.id),
      ]);

      if (errorOperaciones) {
        resultados[empresa.nombre] = `error consultando operaciones: ${errorOperaciones.message}`;
        continue;
      }

      if (errorCategorias) {
        resultados[empresa.nombre] = `error consultando categorías: ${errorCategorias.message}`;
        continue;
      }

      // El tipo real de la categoría (INGRESO/GASTO/COSTO/ACTIVO/
      // PASIVO/PATRIMONIO) es lo que decide si una operación cuenta
      // como resultado del mes — ver el comentario grande en
      // lib/analisisMensual.ts sobre por qué no alcanza con mirar el
      // nombre de la operación (COBRO/PAGO también liquidan Cuentas a
      // Cobrar/Pagar o compran bienes, que son Activo/Pasivo).
      const tipoPorOperacionCategoria = new Map((categorias ?? []).map((c) => [`${c.operacion}|${c.nombre}`, c.tipo]));

      // Supabase devuelve las columnas numeric como string — sin este
      // Number(), la suma de totales en construirAnalisisMensual sería
      // concatenación de texto, no aritmética.
      const operacionesDelMes: OperacionDelMes[] = (operaciones ?? []).map((o) => ({
        operacion: o.operacion,
        categoria: o.categoria,
        tipo: tipoPorOperacionCategoria.get(`${o.operacion}|${o.categoria}`) ?? '',
        total: Number(o.total),
        fecha: o.fecha,
      }));

      const analisis = construirAnalisisMensual(operacionesDelMes, {
        idioma: empresa.idioma,
        moneda: empresa.moneda,
        mesNombre: nombreMes(primerDiaMesPasado, empresa.idioma),
      });

      const { error: errorInsertar } = await admin.from('mensajes_financieros').insert({
        empresa_id: empresa.id,
        periodo,
        titulo: analisis.titulo,
        texto: analisis.texto,
        requiere_consentimiento: false,
      });

      if (errorInsertar) {
        resultados[empresa.nombre] = `error guardando el mensaje: ${errorInsertar.message}`;
        continue;
      }

      resultados[empresa.nombre] = `enviado — modo ${analisis.modo}`;
    } catch (e) {
      resultados[empresa.nombre] = `error inesperado: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({ periodo, resultados });
}
