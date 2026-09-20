import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lo dispara un Vercel Cron Job (ver vercel.json) una vez por día.
// Trae USD/ARS (Bitso, mercado real de Argentina) y USD/BRL
// (AwesomeAPI, cotización oficial de Brasil — Bitso no opera en
// Brasil, así que no tiene ese par) y calcula ARS/BRL cruzando las
// dos. Guarda las tres en cotizaciones_moneda con service_role.
//
// Protegido con CRON_SECRET, mismo patrón que
// /api/calendario/verificar-recordatorios.

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

async function obtenerUsdBrl(): Promise<number> {
  const respuesta = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL', { cache: 'no-store' });
  const datos = await respuesta.json();

  const valor = Number(datos?.USDBRL?.bid);

  if (!respuesta.ok || !valor) {
    throw new Error(`No se pudo obtener USD/BRL de AwesomeAPI: ${JSON.stringify(datos)}`);
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

  try {
    const [usdArs, usdBrl] = await Promise.all([obtenerUsdArs(), obtenerUsdBrl()]);
    const arsBrl = usdBrl / usdArs;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const fecha = fechaLocalHoy();

    const filas = [
      { fecha, par: 'USD_ARS', valor: usdArs, fuente: 'bitso' },
      { fecha, par: 'USD_BRL', valor: usdBrl, fuente: 'awesomeapi' },
      { fecha, par: 'ARS_BRL', valor: arsBrl, fuente: 'calculado' },
    ];

    const { error } = await admin.from('cotizaciones_moneda').upsert(filas, { onConflict: 'fecha,par' });

    if (error) {
      throw error;
    }

    return NextResponse.json({ fecha, usdArs, usdBrl, arsBrl });
  } catch (error) {
    console.error('Error actualizando cotizaciones:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido actualizando cotizaciones.' },
      { status: 500 }
    );
  }
}
