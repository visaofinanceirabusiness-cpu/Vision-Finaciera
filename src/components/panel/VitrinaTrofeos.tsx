'use client';

// VITRINA DE TROFEOS — lobby, perfil Familia.
//
// Muestra el progreso acumulado histórico (lifetime, nunca se
// resetea) de cada categoría de trofeo — ver lib/trofeos.ts. Los
// tiers ya alcanzados se ven llenos con su medalla; los que faltan,
// apagados con el número que falta para llegar.

import { useEffect, useState } from 'react';
import { obtenerProgresoTrofeos, type ProgresoTrofeo } from '@/lib/trofeos';
import type { TipoHito } from '@/lib/gamificacion';

const EMOJI_TIER: Record<TipoHito, string> = { BRONCE: '🥉', PLATA: '🥈', ORO: '🏆' };
const ORDEN_TIER: TipoHito[] = ['BRONCE', 'PLATA', 'ORO'];

export function VitrinaTrofeos({
  empresaId,
  idioma,
  colores,
}: {
  empresaId: string;
  idioma?: string | null;
  colores: { azul: string; verde: string; acento: string; blanco: string };
}) {
  const esPT = idioma === 'PT';
  const [progreso, setProgreso] = useState<ProgresoTrofeo[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    let activo = true;
    obtenerProgresoTrofeos(empresaId)
      .then((datos) => {
        if (activo) setProgreso(datos);
      })
      .catch((errorTrofeos) => {
        console.warn('No se pudo calcular el progreso de trofeos:', errorTrofeos);
      })
      .finally(() => {
        if (activo) setCargado(true);
      });
    return () => {
      activo = false;
    };
  }, [empresaId]);

  if (!cargado || !progreso.length) return null;

  return (
    <section
      style={{
        background: colores.blanco,
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        border: '1px solid #e5e7eb',
        boxShadow: '0 10px 28px rgba(31,58,95,0.06)',
      }}
    >
      <h2 style={{ margin: '0 0 4px', color: colores.azul, fontSize: 20 }}>
        {esPT ? '🏆 Vitrine de Troféus' : '🏆 Vitrina de Trofeos'}
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6e7781' }}>
        {esPT
          ? 'Baseado no acumulado histórico da empresa — nunca reinicia.'
          : 'Basado en el acumulado histórico de la empresa — nunca se reinicia.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {progreso.map((categoria) => (
          <div key={categoria.tipo} style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{categoria.emoji}</span>
              <strong style={{ color: colores.azul, fontSize: 13 }}>
                {esPT ? categoria.nombrePT : categoria.nombre}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-around' }}>
              {ORDEN_TIER.map((tier) => {
                const alcanzado = categoria.tierActual
                  ? ORDEN_TIER.indexOf(categoria.tierActual) >= ORDEN_TIER.indexOf(tier)
                  : false;

                return (
                  <div key={tier} style={{ textAlign: 'center', opacity: alcanzado ? 1 : 0.35 }}>
                    <div style={{ fontSize: 30, filter: alcanzado ? 'none' : 'grayscale(1)' }}>{EMOJI_TIER[tier]}</div>
                    <div style={{ fontSize: 11, color: '#6e7781', fontWeight: 700 }}>{categoria.umbrales[tier]}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: '#6e7781', textAlign: 'center' }}>
              {esPT ? `${categoria.conteo} no total` : `${categoria.conteo} en total`}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
