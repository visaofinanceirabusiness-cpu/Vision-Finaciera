'use client';

// VITRINA DE TROFEOS — lobby, perfil Familia.
//
// Muestra el progreso acumulado histórico (lifetime, nunca se
// resetea) de cada tipo de trofeo — ver lib/trofeos.ts y
// lib/trofeosRangos.ts. Cada tipo tiene una escalera de títulos (del
// original al Diamante) con sus 3 medallas; la tarjeta muestra el título en
// curso, cambia de fondo y de borde con cada título, y debajo la escalera
// completa: los títulos ya completados se ven llenos, los que faltan, apagados.

import { useEffect, useState } from 'react';
import { obtenerProgresoTrofeos, type ProgresoTrofeo } from '@/lib/trofeos';
import { EMOJI_MEDALLA, NOMBRE_MEDALLA, ORDEN_TIER } from '@/lib/trofeosRangos';

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
          ? 'Baseado no acumulado histórico da empresa — nunca reinicia. Cada título tem suas 3 medalhas.'
          : 'Basado en el acumulado histórico de la empresa — nunca se reinicia. Cada título tiene sus 3 medallas.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {progreso.map(({ familia, conteo, progreso: p }) => {
          const estilo = p.rango.estilo;

          return (
            <div
              key={familia.tipo}
              style={{
                background: estilo.fondo,
                border: `2px solid ${estilo.borde}`,
                boxShadow: estilo.sombra,
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 26 }}>{familia.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', color: estilo.acento, fontSize: 15, lineHeight: 1.2 }}>
                    {esPT ? p.rango.nombrePT : p.rango.nombre}
                  </strong>
                  <span style={{ fontSize: 11, color: '#6e7781' }}>
                    {p.rango.indice === 0
                      ? esPT ? 'Primeiro título' : 'Primer título'
                      : esPT ? `Título ${p.rango.indice} de 5` : `Título ${p.rango.indice} de 5`}
                  </span>
                </div>
                <span style={{ fontSize: 26 }}>{p.rango.emblema}</span>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-around' }}>
                {ORDEN_TIER.map((tier, i) => {
                  const alcanzado = i < p.medallas;

                  return (
                    <div key={tier} style={{ textAlign: 'center', opacity: alcanzado ? 1 : 0.4 }}>
                      <div style={{ fontSize: 30, filter: alcanzado ? 'none' : 'grayscale(1)' }}>{EMOJI_MEDALLA[tier]}</div>
                      <div style={{ fontSize: 11, color: '#4b5563', fontWeight: 700 }}>{p.rango.umbrales[tier]}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${p.porcentaje}%`, height: '100%', background: estilo.borde, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#4b5563', textAlign: 'center', fontWeight: 600 }}>
                  {p.siguiente
                    ? esPT
                      ? `Faltam ${p.siguiente.faltan} para ${EMOJI_MEDALLA[p.siguiente.tier]} ${NOMBRE_MEDALLA[p.siguiente.tier].pt}`
                      : `Faltan ${p.siguiente.faltan} para ${EMOJI_MEDALLA[p.siguiente.tier]} ${NOMBRE_MEDALLA[p.siguiente.tier].es}`
                    : esPT
                      ? '👑 Título máximo conquistado'
                      : '👑 Título máximo conquistado'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                {familia.rangos.map((r) => {
                  const completo = p.titulosCompletos.includes(r.indice);
                  const enCurso = !p.completo && r.indice === p.rango.indice;

                  return (
                    <span
                      key={r.indice}
                      title={`${esPT ? r.nombrePT : r.nombre}${completo ? ' ✓' : ''}`}
                      style={{
                        fontSize: 18,
                        opacity: completo ? 1 : enCurso ? 0.75 : 0.25,
                        filter: completo || enCurso ? 'none' : 'grayscale(1)',
                        outline: enCurso ? `2px solid ${estilo.borde}` : 'none',
                        outlineOffset: 2,
                        borderRadius: 6,
                      }}
                    >
                      {r.emblema}
                    </span>
                  );
                })}
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: '#6e7781', textAlign: 'center' }}>
                {esPT ? `${conteo} no total` : `${conteo} en total`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
