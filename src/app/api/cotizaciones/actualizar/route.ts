import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lo dispara un Vercel Cron Job (ver vercel.json) una vez por día.
// Trae USD/ARS (Bitso, mercado real de Argentina) y USD/BRL (PTAX del
// Banco Central do Brasil, oficial y sin límite de cuota — Bitso no
// opera en Brasil, así que no tiene ese par) y calcula ARS/BRL
// cruzando las dos. Guarda las tres en cotizaciones_moneda con
// service_role.
//
// Cada par se resuelve y se guarda de forma INDEPENDIENTE: si uno
// falla (ej. la fuente externa está caída), no se pierde el que sí
// funcionó — antes, con Promise.all, un solo error tiraba abajo toda
// la corrida y no quedaba guardado nada, ni siquiera el par que había
// respondido bien (así se quedó vacía la tabla varios días cuando
// AwesomeAPI devolvió "QuotaExceeded").
//
// Protegido con CRON_SECRET, mismo patrón que
// /api/calendario/verificar-recordatorios.
//
// force-dynamic: evita que Next.js cachee este GET como contenido
// estático y sirva la misma respuesta del build para siempre en vez
// de correr la consulta real en cada invocación del cron (ver el
// mismo fix en resumen-diario/route.ts).
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// Argentina y Brasil están las dos en UTC-3 (sin horario de verano
// vigente) — se resta ese offset para que la fecha guardada sea la
// del día local, no la de UTC (que a la madrugada ya es "mañana").
function fechaLocalHoy(): string {
  const local = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

async function obtenerUsdArs(): Promise<number> {
  const respuesta = await fetch('https://bitso.com/api/v3/ticker/?book=usd_ars', { cache: 'no-store' });
  const datos = await respuesta.json();

  const valor = Number(datos?.payload?.last);

  if (!respuesta.ok || !datos?.success || !valor) {
    throw new Error(`No se pudo obtener USD/ARS de Bitso: ${JSON.stringify(datos)}`);
  }

  return valor;
}

// AwesomeAPI (usada antes acá) tiene una cuota gratuita compartida
// entre todos sus usuarios que se agota fácil desde una IP de la nube
// — Frankfurter (mirror del Banco Central Europeo, sin clave ni
// límite de uso normal) es más confiable para un cron diario.
async function obtenerUsdBrl(): Promise<number> {
  const respuesta = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL', { cache: 'no-store' });
  const datos = await respuesta.json();

  const valor = Number(datos?.rates?.BRL);

  if (!respuesta.ok || !valor) {
    throw new Error(`No se pudo obtener USD/BRL de Frankfurter: ${JSON.stringify(datos)}`);
  }

  return valor;
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
  const fecha = fechaLocalHoy();
  const errores: string[] = [];

  const [usdArsResultado, usdBrlResultado] = await Promise.allSettled([obtenerUsdArs(), obtenerUsdBrl()]);

  const usdArs = usdArsResultado.status === 'fulfilled' ? usdArsResultado.value : null;
  if (usdArsResultado.status === 'rejected') {
    errores.push(usdArsResultado.reason instanceof Error ? usdArsResultado.reason.message : String(usdArsResultado.reason));
  }

  const usdBrl = usdBrlResultado.status === 'fulfilled' ? usdBrlResultado.value : null;
  if (usdBrlResultado.status === 'rejected') {
    errores.push(usdBrlResultado.reason instanceof Error ? usdBrlResultado.reason.message : String(usdBrlResultado.reason));
  }

  const filas: { fecha: string; par: string; valor: number; fuente: string }[] = [];

  if (usdArs) filas.push({ fecha, par: 'USD_ARS', valor: usdArs, fuente: 'bitso' });
  if (usdBrl) filas.push({ fecha, par: 'USD_BRL', valor: usdBrl, fuente: 'frankfurter' });
  if (usdArs && usdBrl) filas.push({ fecha, par: 'ARS_BRL', valor: usdBrl / usdArs, fuente: 'calculado' });

  if (filas.length > 0) {
    const { error } = await admin.from('cotizaciones_moneda').upsert(filas, { onConflict: 'fecha,par' });

    if (error) {
      errores.push(error.message);
    }
  }

  if (errores.length > 0) {
    console.error('Error actualizando cotizaciones:', errores);
  }

  if (filas.length === 0) {
    return NextResponse.json({ error: errores.join(' | ') }, { status: 500 });
  }

  return NextResponse.json({ fecha, guardados: filas.map((f) => f.par), errores: errores.length > 0 ? errores : undefined });
}
