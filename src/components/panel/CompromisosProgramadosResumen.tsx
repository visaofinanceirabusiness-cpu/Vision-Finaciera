'use client';

// COMPROMISOS PROGRAMADOS — resumen de solo lectura, debajo de la
// composición de Activo y Pasivo del Panel de Control. Muestra lo que
// las plantillas recurrentes van a generar en los próximos 12 meses
// (ver lib/compromisosProgramados.ts). NO suma al balance: cada mes se
// reconoce recién en su período.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listarIngresosRecurrentes } from '@/lib/ingresosRecurrentes';
import { listarGastosRecurrentes } from '@/lib/gastosRecurrentes';
import { proyectarCompromisos, totalesProgramados, MESES_HORIZONTE, type MesProgramado } from '@/lib/compromisosProgramados';
import { fechaLocalHoy } from '@/lib/fecha';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

export function CompromisosProgramadosResumen({
  empresaId,
  idioma,
  simbolo,
  colores,
}: {
  empresaId: string;
  idioma: string;
  simbolo: string;
  colores: Colores;
}) {
  const esPT = idioma === 'PT';
  const [meses, setMeses] = useState<MesProgramado[] | null>(null);

  useEffect(() => {
    let vigente = true;

    Promise.all([listarIngresosRecurrentes(empresaId), listarGastosRecurrentes(empresaId)])
      .then(([ingresos, gastos]) => {
        if (vigente) setMeses(proyectarCompromisos(ingresos, gastos, fechaLocalHoy()));
      })
      .catch((e) => console.warn('No se pudieron cargar los compromisos programados:', e));

    return () => {
      vigente = false;
    };
  }, [empresaId]);

  if (!meses) return null;

  const totales = totalesProgramados(meses);

  if (totales.porCobrar === 0 && totales.porPagar === 0) return null;

  const formatear = (valor: number) => `${simbolo} ${valor.toLocaleString(esPT ? 'pt-BR' : 'es-AR', { maximumFractionDigits: 0 })}`;

  return (
    <div style={{ marginTop: 16, border: '1px dashed #cbd5e1', borderRadius: 18, padding: '16px 20px', background: '#fbfcfd' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde, marginBottom: 4 }}>
        {esPT ? 'COMPROMISSOS PROGRAMADOS' : 'COMPROMISOS PROGRAMADOS'}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#6e7781', lineHeight: 1.5 }}>
        {esPT
          ? `Próximos ${MESES_HORIZONTE} meses (sem contar o mês atual). Ficam fora do balanço: cada mês é reconhecido no seu período.`
          : `Próximos ${MESES_HORIZONTE} meses (sin contar el mes en curso). Quedan fuera del balance: cada mes se reconoce en su período.`}
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#6e7781' }}>
            {esPT ? 'A RECEBER (ATIVO)' : 'POR COBRAR (ACTIVO)'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{formatear(totales.porCobrar)}</div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#6e7781' }}>
            {esPT ? 'A PAGAR (PASSIVO)' : 'POR PAGAR (PASIVO)'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#c2410c' }}>{formatear(totales.porPagar)}</div>
        </div>

        <Link href="/finanzas" style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: colores.azul }}>
          {esPT ? 'Gerenciar em Finanças → Compromissos' : 'Gestionar en Finanzas → Compromisos'}
        </Link>
      </div>
    </div>
  );
}
