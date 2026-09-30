'use client';

// OBJETIVOS ESCALONADOS — perfil Familia (dentro de la sección
// OBJETIVOS de Panel de Control, junto a "Primeros pasos").
//
// 3 operaciones (Pago, Cobro, Transferencia) con 3 checkpoints
// crecientes cada una, que resetean al subir de nivel — ver
// lib/objetivosEscalonados.ts para el detalle de cómo se cuenta.
//
// El festejo de cada checkpoint es "visual únicamente": se recuerda
// en localStorage (por dispositivo) para no repetirlo en cada visita,
// a diferencia de los Trofeos (lib/trofeos.ts) que sí se guardan en la
// base — acá el progreso es efímero (vuelve a cero en el próximo
// nivel), así que no vale la pena una tabla nueva solo para esto.

import { useEffect, useRef, useState } from 'react';
import {
  obtenerObjetivosEscalonados,
  type ObjetivoEscalonado,
  type TipoEscalonado,
} from '@/lib/objetivosEscalonados';
import type { TipoFestejo } from '@/lib/festejoVisual';
import { FestejoModal } from './FestejoModal';

const TIER_POR_INDICE: TipoFestejo[] = ['BRONCE', 'PLATA', 'ORO'];

function claveVisto(empresaId: string, nivel: number, tipo: TipoEscalonado, indice: number): string {
  return `escalon_visto_${empresaId}_${nivel}_${tipo}_${indice}`;
}

function yaVisto(clave: string): boolean {
  try {
    return window.localStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
}

function marcarVisto(clave: string) {
  try {
    window.localStorage.setItem(clave, '1');
  } catch {
    // localStorage bloqueado (modo privado, etc.) — el festejo puede
    // repetirse en la próxima visita, no es grave.
  }
}

export function ObjetivosEscalonados({
  empresaId,
  nivel,
  operacionesMin,
  idioma,
  colores,
}: {
  empresaId: string;
  nivel: number;
  operacionesMin: number;
  idioma?: string | null;
  colores: { azul: string; verde: string; acento: string };
}) {
  const esPT = idioma === 'PT';
  const [objetivos, setObjetivos] = useState<ObjetivoEscalonado[]>([]);
  const [festejo, setFestejo] = useState<{ tipo: TipoEscalonado; indice: number } | null>(null);
  const yaCargado = useRef(false);

  useEffect(() => {
    let activo = true;
    yaCargado.current = false;

    obtenerObjetivosEscalonados(empresaId, nivel, operacionesMin)
      .then((datos) => {
        if (!activo) return;
        setObjetivos(datos);

        // Detecta checkpoints recién cumplidos (que todavía no se
        // vieron en este dispositivo) para festejarlos, del más chico
        // al más grande — si se cargaron varios de una, se encadenan.
        if (!yaCargado.current) {
          yaCargado.current = true;

          for (const objetivo of datos) {
            for (let indice = 0; indice < objetivo.checkpointsCumplidos; indice++) {
              const clave = claveVisto(empresaId, nivel, objetivo.tipo, indice);
              if (!yaVisto(clave)) {
                setFestejo({ tipo: objetivo.tipo, indice });
                return;
              }
            }
          }
        }
      })
      .catch((errorEscalonados) => {
        console.warn('No se pudieron calcular los objetivos escalonados:', errorEscalonados);
      });

    return () => {
      activo = false;
    };
  }, [empresaId, nivel, operacionesMin]);

  function cerrarFestejo() {
    if (!festejo) return;
    marcarVisto(claveVisto(empresaId, nivel, festejo.tipo, festejo.indice));
    setFestejo(null);

    // Busca el siguiente checkpoint pendiente de festejar (mismo
    // patrón que el modal de hitos de gamificación).
    for (const objetivo of objetivos) {
      for (let indice = 0; indice < objetivo.checkpointsCumplidos; indice++) {
        const clave = claveVisto(empresaId, nivel, objetivo.tipo, indice);
        if (!yaVisto(clave)) {
          setFestejo({ tipo: objetivo.tipo, indice });
          return;
        }
      }
    }
  }

  if (!objetivos.length) return null;

  const objetivoFestejado = festejo ? objetivos.find((o) => o.tipo === festejo.tipo) : null;

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: colores.azul, marginBottom: 10 }}>
        {esPT ? '🪜 Objetivos por Etapas' : '🪜 Objetivos por Escalones'}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {objetivos.map((objetivo) => {
          const siguienteMeta = objetivo.checkpoints[objetivo.checkpointsCumplidos] ?? null;
          const completo = objetivo.checkpointsCumplidos === objetivo.checkpoints.length;

          return (
            <div
              key={objetivo.tipo}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: 16,
                background: completo ? `${colores.verde}0d` : '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{objetivo.emoji}</span>
                <strong style={{ color: colores.azul, fontSize: 13 }}>
                  {esPT ? objetivo.nombrePT : objetivo.nombre}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {objetivo.checkpoints.map((checkpoint, indice) => {
                  const cumplido = indice < objetivo.checkpointsCumplidos;
                  return (
                    <div
                      key={checkpoint}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '6px 4px',
                        borderRadius: 10,
                        background: cumplido ? colores.verde : '#f1f5f9',
                        color: cumplido ? '#fff' : '#6e7781',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {cumplido ? '✓ ' : ''}
                      {checkpoint}
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: '#6e7781' }}>
                {completo
                  ? esPT
                    ? `Completo! ${objetivo.conteo} registrados neste nível.`
                    : `¡Completo! ${objetivo.conteo} registrados este nivel.`
                  : esPT
                    ? `${objetivo.conteo} de ${siguienteMeta} para o próximo degrau.`
                    : `${objetivo.conteo} de ${siguienteMeta} para el próximo escalón.`}
              </div>
            </div>
          );
        })}
      </div>

      {festejo && objetivoFestejado && (
        <FestejoModal
          tipo={TIER_POR_INDICE[festejo.indice]}
          claveAnimacion={`${festejo.tipo}-${festejo.indice}`}
          emoji={objetivoFestejado.emoji}
          idioma={idioma}
          tituloEs={`¡Escalón cumplido!`}
          tituloPt={`Degrau cumprido!`}
          subtituloEs={`${objetivoFestejado.nombre}: llegaste a ${objetivoFestejado.checkpoints[festejo.indice]}.`}
          subtituloPt={`${objetivoFestejado.nombrePT}: você chegou a ${objetivoFestejado.checkpoints[festejo.indice]}.`}
          onCerrar={cerrarFestejo}
        />
      )}
    </div>
  );
}
