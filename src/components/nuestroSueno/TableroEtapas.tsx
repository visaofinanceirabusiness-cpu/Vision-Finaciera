'use client';

// TABLERO DE ETAPAS — Nuestro Sueño (fase 2)
//
// El camino gamificado del proyecto: 8 etapas fijas (ver
// ETAPAS_SUENO en lib/nuestroSueno.ts) que la pareja va marcando
// completas a medida que avanza. Cualquiera de los dos puede
// marcar/desmarcar cualquier etapa — no hay un orden forzado en la
// base, aunque la UI las muestra en el orden lógico del catálogo.

import { useEffect, useState } from 'react';
import { ETAPAS_SUENO, listarEtapas, marcarEtapa, type SuenoEtapa } from '@/lib/nuestroSueno';

export function TableroEtapas({
  parejaId,
  perfilId,
  esPT,
  colorAcento,
}: {
  parejaId: string;
  perfilId: string;
  esPT: boolean;
  colorAcento: string;
}) {
  const [etapas, setEtapas] = useState<Record<string, SuenoEtapa>>({});
  const [cargando, setCargando] = useState(true);
  const [marcando, setMarcando] = useState<string | null>(null);

  useEffect(() => {
    listarEtapas(parejaId)
      .then(setEtapas)
      .finally(() => setCargando(false));
  }, [parejaId]);

  async function alternar(clave: string) {
    const yaCompletada = etapas[clave]?.completada ?? false;
    setMarcando(clave);
    try {
      await marcarEtapa(parejaId, perfilId, clave, !yaCompletada);
      const actualizadas = await listarEtapas(parejaId);
      setEtapas(actualizadas);
    } finally {
      setMarcando(null);
    }
  }

  if (cargando) return null;

  const completas = ETAPAS_SUENO.filter((e) => etapas[e.clave]?.completada).length;
  const progreso = Math.round((completas / ETAPAS_SUENO.length) * 100);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: colorAcento }}>
          {completas}/{ETAPAS_SUENO.length} {esPT ? 'etapas' : 'etapas'}
        </span>
        <span style={{ fontSize: 14, color: '#6e7781' }}>{progreso}%</span>
      </div>

      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progreso}%`, background: colorAcento, transition: 'width 0.3s' }} />
      </div>

      <div style={{ display: 'flex', overflowX: 'auto', gap: 4, paddingBottom: 8 }}>
        {ETAPAS_SUENO.map((etapa, indice) => {
          const completada = etapas[etapa.clave]?.completada ?? false;
          return (
            <div key={etapa.clave} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => alternar(etapa.clave)}
                disabled={marcando === etapa.clave}
                title={etapa.etiqueta}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  width: 84,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: marcando === etapa.clave ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    background: completada ? colorAcento : '#f1f5f9',
                    border: completada ? 'none' : '2px solid #cbd5e1',
                  }}
                >
                  {etapa.emoji}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    textAlign: 'center',
                    color: completada ? colorAcento : '#6e7781',
                    fontWeight: completada ? 700 : 400,
                    lineHeight: 1.2,
                  }}
                >
                  {etapa.etiqueta}
                </span>
              </button>
              {indice < ETAPAS_SUENO.length - 1 && (
                <div style={{ width: 20, height: 2, background: completada ? colorAcento : '#e5e7eb', flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
