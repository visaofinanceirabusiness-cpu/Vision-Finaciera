'use client';

// PANEL MAESTRO → ANÁLISIS MENSUAL AUTOMÁTICO (Fase B)
//
// Seguimiento, a modo indicativo, de lo que generó (o no) el cron de
// api/analisis-mensual/generar para el mes recién cerrado — no
// bloquea nada ni es una tarea asignada al sistema, es solo para que
// el equipo vea de un vistazo a quién le llegó el análisis completo,
// a quién le tocó el mensaje motivacional (pocos movimientos) y
// quién lo tiene deshabilitado, resaltando las empresas con poca o
// ninguna actividad ese mes.
//
// Exclusivo del Desarrollador (es_admin_plataforma), mismo patrón que
// panel-maestro/auditoria.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  MINIMO_OPERACIONES_PARA_ANALISIS_COMPLETO,
  MINIMO_DIAS_CON_ACTIVIDAD_PARA_ANALISIS_COMPLETO,
} from '@/lib/analisisMensual';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Empresa = {
  id: string;
  nombre: string;
  analisis_mensual_habilitado: boolean;
  onboarding_completado: boolean;
};

type FilaEstado = {
  empresa: Empresa;
  mensajeEnviado: boolean;
  modo: 'completo' | 'motivacional' | null;
  operaciones: number;
  diasConActividad: number;
  pocaActividad: boolean;
};

// Mismo criterio que rangoMesPasado() en
// api/analisis-mensual/generar/route.ts, pero en el navegador del
// admin (no hace falta el ajuste UTC-3 a mano: ya corre en su hora
// local) — "el mes que acaba de cerrar" respecto de hoy.
function rangoMesPasado(): { desde: string; hasta: string; periodo: string; nombreMes: string } {
  const hoy = new Date();
  const primerDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDiaMesPasado = new Date(primerDiaMesActual.getTime() - 24 * 60 * 60 * 1000);
  const primerDiaMesPasado = new Date(ultimoDiaMesPasado.getFullYear(), ultimoDiaMesPasado.getMonth(), 1);

  const comoFecha = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    desde: comoFecha(primerDiaMesPasado),
    hasta: comoFecha(ultimoDiaMesPasado),
    periodo: comoFecha(primerDiaMesPasado),
    nombreMes: primerDiaMesPasado.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
  };
}

export default function AnalisisMensualPanelMaestroPage() {
  const router = useRouter();

  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filas, setFilas] = useState<FilaEstado[]>([]);
  const [rango] = useState(rangoMesPasado());

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('es_admin_plataforma')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.es_admin_plataforma) {
        router.push('/');
        return;
      }

      setAutorizado(true);

      const [{ data: empresas, error: errorEmpresas }, { data: mensajes }, { data: operaciones }] = await Promise.all([
        supabase
          .from('empresas')
          .select('id, nombre, analisis_mensual_habilitado, onboarding_completado')
          .eq('activo', true)
          .order('nombre'),
        supabase
          .from('mensajes_financieros')
          .select('empresa_id, titulo')
          .eq('periodo', rango.periodo)
          .ilike('titulo', '📊%'),
        supabase
          .from('registro_operaciones')
          .select('empresa_id, fecha')
          .gte('fecha', rango.desde)
          .lte('fecha', rango.hasta),
      ]);

      if (errorEmpresas) {
        setError(`No se pudieron cargar las empresas: ${errorEmpresas.message}`);
        setCargando(false);
        return;
      }

      const mensajePorEmpresa = new Map<string, boolean>();
      for (const m of mensajes ?? []) {
        mensajePorEmpresa.set(m.empresa_id, true);
      }

      const operacionesPorEmpresa = new Map<string, { cantidad: number; dias: Set<string> }>();
      for (const op of operaciones ?? []) {
        const actual = operacionesPorEmpresa.get(op.empresa_id) ?? { cantidad: 0, dias: new Set<string>() };
        actual.cantidad += 1;
        actual.dias.add(op.fecha);
        operacionesPorEmpresa.set(op.empresa_id, actual);
      }

      const filasArmadas: FilaEstado[] = (empresas ?? []).map((empresa) => {
        const actividad = operacionesPorEmpresa.get(empresa.id) ?? { cantidad: 0, dias: new Set<string>() };
        const operacionesCant = actividad.cantidad;
        const diasConActividad = actividad.dias.size;
        const pocaActividad =
          operacionesCant < MINIMO_OPERACIONES_PARA_ANALISIS_COMPLETO ||
          diasConActividad < MINIMO_DIAS_CON_ACTIVIDAD_PARA_ANALISIS_COMPLETO;

        return {
          empresa,
          mensajeEnviado: mensajePorEmpresa.get(empresa.id) ?? false,
          modo: mensajePorEmpresa.get(empresa.id) ? (pocaActividad ? 'motivacional' : 'completo') : null,
          operaciones: operacionesCant,
          diasConActividad,
          pocaActividad,
        };
      });

      setFilas(filasArmadas);
      setCargando(false);
    }

    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!autorizado && cargando) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</main>;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f4f7f8', padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Link href="/panel-maestro" style={{ color: COLORES.azul, fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>
          ← Volver a Panel Maestro
        </Link>

        <h1 style={{ margin: '0 0 4px', color: COLORES.azul, fontSize: 26 }}>📊 Análisis Mensual Automático</h1>
        <p style={{ margin: '0 0 6px', color: COLORES.gris, fontSize: 14 }}>
          Período: <strong style={{ color: COLORES.azul, textTransform: 'capitalize' }}>{rango.nombreMes}</strong>
        </p>
        <p style={{ margin: '0 0 24px', color: COLORES.gris, fontSize: 12.5, maxWidth: 640, lineHeight: 1.5 }}>
          A modo indicativo — no bloquea nada. El resaltado en rojo son empresas con pocos o ningún movimiento
          cargado ese mes; puede ser que falte cargar algo, o que simplemente no hubo actividad.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ background: COLORES.blanco, borderRadius: 18, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <Th>Empresa</Th>
                <Th>Estado</Th>
                <Th align="right">Operaciones</Th>
                <Th align="right">Días con actividad</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr
                  key={fila.empresa.id}
                  style={{
                    borderTop: '1px solid #f1f5f9',
                    background: fila.pocaActividad ? '#fef2f2' : 'transparent',
                  }}
                >
                  <Td>
                    <strong style={{ color: COLORES.azul }}>{fila.empresa.nombre}</strong>
                    {!fila.empresa.onboarding_completado && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: COLORES.gris }}>(onboarding sin terminar)</span>
                    )}
                  </Td>
                  <Td>
                    <EstadoBadge fila={fila} />
                  </Td>
                  <Td align="right">{fila.operaciones}</Td>
                  <Td align="right">{fila.diasConActividad}</Td>
                </tr>
              ))}

              {filas.length === 0 && !cargando && (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>
                    No hay empresas activas para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function EstadoBadge({ fila }: { fila: FilaEstado }) {
  if (!fila.empresa.analisis_mensual_habilitado) {
    return <Badge color="#6b7280" fondo="#f3f4f6">⚪ Deshabilitado por el cliente</Badge>;
  }

  if (fila.mensajeEnviado && fila.modo === 'completo') {
    return <Badge color="#166534" fondo="#dcfce7">🟢 Enviado — completo</Badge>;
  }

  if (fila.mensajeEnviado && fila.modo === 'motivacional') {
    return <Badge color="#92400e" fondo="#fef3c7">🟡 Enviado — motivacional</Badge>;
  }

  return <Badge color="#b91c1c" fondo="#fee2e2">🔴 Todavía no se generó</Badge>;
}

function Badge({ children, color, fondo }: { children: React.ReactNode; color: string; fondo: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color,
        background: fondo,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 800, color: '#374151', textAlign: align, textTransform: 'uppercase', letterSpacing: 0.4 }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '10px 14px', fontSize: 13, textAlign: align }}>
      {children}
    </td>
  );
}
