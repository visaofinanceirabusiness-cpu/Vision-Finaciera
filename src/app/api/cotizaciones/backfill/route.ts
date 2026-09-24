import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Backfill ÚNICO de historial de cotizaciones — el cron diario
// (/api/cotizaciones/actualizar) recién empezó a correr hace unos
// días, así que el gráfico de Panel de Controle no tenía suficiente
// historial para analizar una tendencia. Esta ruta trae los últimos
// N días de USD/BRL y USD/ARS de Frankfurter (mirror del Banco
// Central Europeo, con historial completo y sin límite de uso) y
// completa cotizaciones_moneda — sin pisar ningún día que el cron ya
// haya guardado con su fuente real (Bitso para USD/ARS, más precisa
// para el mercado argentino que la referencia de Frankfurter).
//
// Se borra a mano después de usarse una vez — no la dispara ningún
// cron. Protegida con BACKFILL_SECRET (variable de entorno separada
// de CRON_SECRET, de un solo uso).
//
// force-dynamic: evita que Next.js cachee este GET como contenido
// estático (mismo bug encontrado y corregido en resumen-diario/route.ts).
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKFILL_SECRET = process.env.BACKFILL_SECRET;

async function obtenerSerieFrankfurter(desde: string, hasta: string, symbol: string): Promise<Record<string, number>> {
  const respuesta = await fetch(`https://api.frankfurter.dev/v1/${desde}..${hasta}?base=USD&symbols=${symbol}`, {
    cache: 'no-store',
  });
  const datos = await respuesta.json();

  if (!respuesta.ok || !datos?.rates) {
    throw new Error(`No se pudo obtener el historial de USD/${symbol}: ${JSON.stringify(datos)}`);
  }

  const serie: Record<string, number> = {};
  for (const [fecha, valores] of Object.entries(datos.rates as Record<string, Record<string, number>>)) {
    const valor = valores?.[symbol];
    if (valor) serie[fecha] = valor;
  }

  return serie;
}

export async function GET(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase no configurado en el servidor.' }, { status: 501 });
  }

  if (!BACKFILL_SECRET) {
    return NextResponse.json({ error: 'BACKFILL_SECRET no configurado.' }, { status: 501 });
  }

  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== BACKFILL_SECRET) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const dias = Math.min(Number(request.nextUrl.searchParams.get('dias')) || 90, 365);

  const hoy = new Date();
  const inicio = new Date(hoy);
  inicio.setUTCDate(inicio.getUTCDate() - dias);

  const hasta = hoy.toISOString().slice(0, 10);
  const desde = inicio.toISOString().slice(0, 10);

  const errores: string[] = [];
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Días que el cron real ya cargó — no se pisan, se completan solo
  // los que faltan.
  const { data: yaCargados } = await admin
    .from('cotizaciones_moneda')
    .select('fecha, par')
    .gte('fecha', desde);

  const yaCargadosSet = new Set((yaCargados ?? []).map((f) => `${f.fecha}|${f.par}`));

  const [brlResultado, arsResultado] = await Promise.allSettled([
    obtenerSerieFrankfurter(desde, hasta, 'BRL'),
    obtenerSerieFrankfurter(desde, hasta, 'ARS'),
  ]);

  const serieBrl = brlResultado.status === 'fulfilled' ? brlResultado.value : null;
  if (brlResultado.status === 'rejected') {
    errores.push(brlResultado.reason instanceof Error ? brlResultado.reason.message : String(brlResultado.reason));
  }

  const serieArs = arsResultado.status === 'fulfilled' ? arsResultado.value : null;
  if (arsResultado.status === 'rejected') {
    errores.push(arsResultado.reason instanceof Error ? arsResultado.reason.message : String(arsResultado.reason));
  }

  const filas: { fecha: string; par: string; valor: number; fuente: string }[] = [];
  const fechas = new Set([...(serieBrl ? Object.keys(serieBrl) : []), ...(serieArs ? Object.keys(serieArs) : [])]);

  for (const fecha of fechas) {
    const usdBrl = serieBrl?.[fecha];
    const usdArs = serieArs?.[fecha];

    if (usdBrl && !yaCargadosSet.has(`${fecha}|USD_BRL`)) {
      filas.push({ fecha, par: 'USD_BRL', valor: usdBrl, fuente: 'frankfurter_backfill' });
    }
    if (usdArs && !yaCargadosSet.has(`${fecha}|USD_ARS`)) {
      filas.push({ fecha, par: 'USD_ARS', valor: usdArs, fuente: 'frankfurter_backfill' });
    }
    if (usdBrl && usdArs && !yaCargadosSet.has(`${fecha}|ARS_BRL`)) {
      filas.push({ fecha, par: 'ARS_BRL', valor: usdBrl / usdArs, fuente: 'frankfurter_backfill' });
    }
  }

  if (filas.length > 0) {
    const { error } = await admin.from('cotizaciones_moneda').upsert(filas, { onConflict: 'fecha,par', ignoreDuplicates: true });

    if (error) {
      errores.push(error.message);
    }
  }

  return NextResponse.json({
    desde,
    hasta,
    filasInsertadas: filas.length,
    errores: errores.length > 0 ? errores : undefined,
  });
}
