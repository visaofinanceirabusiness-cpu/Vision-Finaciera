'use client';

// PLAN DE ACCIÓN DE 30 DÍAS
//
// Feature a medida para un único cliente (Buenaventura — ver
// empresaTienePlanAccion en lib/perfilCapacidades.ts), no un producto
// general de la app. Por eso queda en español nomás (el idioma de
// Buenaventura) y sin las vueltas de i18n del resto de las
// herramientas — el día que se decida ofrecerlo a más empresas, ahí
// sí vale la pena bilingüizarlo.
//
// Regla central: un único día "DISPONIBLE" a la vez. Para pasar al
// siguiente hay que tildar TODAS las tareas (turno de Ejecución +
// turno de Cierre) del día actual y tocar "Completar el día" — recién
// ahí se desbloquea el día siguiente (ver completarDia en
// lib/planAccion.ts). Los días ya completados quedan como historial,
// de solo lectura.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { empresaTienePlanAccion } from '@/lib/perfilCapacidades';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import {
  listarDiasPlanAccion,
  listarTareasDia,
  alternarTarea,
  guardarMetricasDia,
  completarDia,
  DiaPlanAccion,
  TareaPlanAccion,
} from '@/lib/planAccion';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  fondo: '#f5f7f9',
  borde: '#e5e7eb',
  rojo: '#dc2626',
};

const NOMBRE_FASE: Record<number, string> = {
  1: 'Fase 1 — Preparación y Activación',
  2: 'Fase 2 — Primeras Ventas',
  3: 'Fase 3 — Recurrencia',
  4: 'Fase 4 — Aceleración y Cierre',
};

type Metricas = {
  ingresos_generados: string;
  ingresos_recurrentes: string;
  contactos: string;
  conversaciones: string;
  propuestas: string;
  ventas: string;
  notas: string;
};

function metricasIniciales(dia: DiaPlanAccion): Metricas {
  return {
    ingresos_generados: String(dia.ingresos_generados ?? 0),
    ingresos_recurrentes: String(dia.ingresos_recurrentes ?? 0),
    contactos: String(dia.contactos ?? 0),
    conversaciones: String(dia.conversaciones ?? 0),
    propuestas: String(dia.propuestas ?? 0),
    ventas: String(dia.ventas ?? 0),
    notas: dia.notas ?? '',
  };
}

export default function PlanAccionPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<string | null>(null);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [dias, setDias] = useState<DiaPlanAccion[]>([]);
  const [tareas, setTareas] = useState<TareaPlanAccion[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [completando, setCompletando] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);

  const simbolo = simboloMoneda(moneda);

  async function cargarTodo(empresa: string) {
    const listaDias = await listarDiasPlanAccion(empresa);
    setDias(listaDias);

    const diaActual = listaDias.find((d) => d.estado === 'DISPONIBLE');

    if (diaActual) {
      const listaTareas = await listarTareasDia(diaActual.id);
      setTareas(listaTareas);
      setMetricas(metricasIniciales(diaActual));
    } else {
      setTareas([]);
      setMetricas(null);
    }
  }

  useEffect(() => {
    async function iniciar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id || !empresaTienePlanAccion(perfil.empresa_id)) {
        setAutorizado(false);
        setCargando(false);
        return;
      }

      setAutorizado(true);
      setEmpresaId(perfil.empresa_id);

      const { data: empresa } = await supabase
        .from('empresas')
        .select('moneda')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      setMoneda(empresa?.moneda ?? null);

      try {
        await cargarTodo(perfil.empresa_id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el plan.');
      }

      setCargando(false);
    }

    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const diaActual = useMemo(() => dias.find((d) => d.estado === 'DISPONIBLE') ?? null, [dias]);
  const tareasEjecucion = useMemo(() => tareas.filter((t) => t.turno === 'EJECUCION'), [tareas]);
  const tareasCierre = useMemo(() => tareas.filter((t) => t.turno === 'CIERRE'), [tareas]);
  const todasCompletadas = tareas.length > 0 && tareas.every((t) => t.completada);
  const completados = dias.filter((d) => d.estado === 'COMPLETADO').length;

  const acumulado = useMemo(() => {
    return dias.reduce(
      (acc, d) => ({
        ingresos: acc.ingresos + Number(d.ingresos_generados ?? 0),
        recurrentes: acc.recurrentes + Number(d.ingresos_recurrentes ?? 0),
      }),
      { ingresos: 0, recurrentes: 0 }
    );
  }, [dias]);

  async function handleTocarTarea(tarea: TareaPlanAccion) {
    setTareas((prev) => prev.map((t) => (t.id === tarea.id ? { ...t, completada: !t.completada } : t)));

    try {
      await alternarTarea(tarea.id, !tarea.completada);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
      setTareas((prev) => prev.map((t) => (t.id === tarea.id ? { ...t, completada: tarea.completada } : t)));
    }
  }

  function handleCambiarMetrica(campo: keyof Metricas, valor: string) {
    setMetricas((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  async function handleGuardarMetricas() {
    if (!diaActual || !metricas) return;

    setGuardando(true);
    setError('');

    try {
      await guardarMetricasDia(diaActual.id, {
        ingresos_generados: Number(metricas.ingresos_generados) || 0,
        ingresos_recurrentes: Number(metricas.ingresos_recurrentes) || 0,
        contactos: Number(metricas.contactos) || 0,
        conversaciones: Number(metricas.conversaciones) || 0,
        propuestas: Number(metricas.propuestas) || 0,
        ventas: Number(metricas.ventas) || 0,
        notas: metricas.notas,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar los resultados.');
    } finally {
      setGuardando(false);
    }
  }

  async function handleCompletarDia() {
    if (!diaActual || !empresaId || !metricas) return;

    setCompletando(true);
    setError('');

    try {
      await guardarMetricasDia(diaActual.id, {
        ingresos_generados: Number(metricas.ingresos_generados) || 0,
        ingresos_recurrentes: Number(metricas.ingresos_recurrentes) || 0,
        contactos: Number(metricas.contactos) || 0,
        conversaciones: Number(metricas.conversaciones) || 0,
        propuestas: Number(metricas.propuestas) || 0,
        ventas: Number(metricas.ventas) || 0,
        notas: metricas.notas,
      });
      await completarDia(empresaId, diaActual.id, diaActual.dia_numero);
      await cargarTodo(empresaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar el día.');
    } finally {
      setCompletando(false);
    }
  }

  if (cargando) {
    return (
      <div style={{ ...fondo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: COLORES.gris }}>Cargando...</p>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div style={{ ...fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: COLORES.gris }}>No encontramos esta herramienta para tu empresa.</p>
        <Link href="/" style={{ color: COLORES.azul }}>← Volver</Link>
      </div>
    );
  }

  return (
    <div style={fondo}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <header style={encabezado}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <Link href="/?vista=empresa" style={volver}>← Volver a Mi Negocio</Link>
              <div style={eyebrow}>PLAN COMERCIAL</div>
              <h1 style={{ margin: 0, fontSize: 30 }}>Plan de Acción de 30 Días</h1>
              <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
                Meta: ~R$3.000 en ingresos adicionales y empezar a construir ingresos recurrentes.
              </p>
            </div>
            <AccesosHerramientas variante="oscuro" />
          </div>
        </header>

        <main style={panel}>
          {error && (
            <p style={{ color: COLORES.rojo, fontSize: 13, marginBottom: 16, background: '#fef2f2', padding: '10px 14px', borderRadius: 10 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <ResumenChip titulo="Progreso" valor={`${completados} / 30 días`} />
            <ResumenChip titulo="Ingresos acumulados" valor={`${simbolo} ${formatearNumeroEntero(acumulado.ingresos)}`} />
            <ResumenChip titulo="Recurrente mensual" valor={`${simbolo} ${formatearNumeroEntero(acumulado.recurrentes)}`} />
          </div>

          <div style={{ background: '#eef2f6', borderRadius: 999, height: 10, marginBottom: 28, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(completados / 30) * 100}%`,
                background: `linear-gradient(90deg, ${COLORES.verde}, ${COLORES.azul})`,
                height: '100%',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {diaActual && metricas ? (
            <TarjetaDia
              dia={diaActual}
              tareasEjecucion={tareasEjecucion}
              tareasCierre={tareasCierre}
              metricas={metricas}
              simbolo={simbolo}
              todasCompletadas={todasCompletadas}
              guardando={guardando}
              completando={completando}
              onTocarTarea={handleTocarTarea}
              onCambiarMetrica={handleCambiarMetrica}
              onGuardarMetricas={handleGuardarMetricas}
              onCompletarDia={handleCompletarDia}
            />
          ) : (
            <div style={{ padding: 32, textAlign: 'center', border: '1px dashed #d6dee5', borderRadius: 16, color: COLORES.gris }}>
              {completados >= 30
                ? '🎉 ¡Ciclo de 30 días completado! Revisá el resultado final en el historial.'
                : 'No hay ningún día disponible ahora mismo.'}
            </div>
          )}

          <button
            type="button"
            onClick={() => setHistorialAbierto((v) => !v)}
            style={{
              marginTop: 28,
              background: 'none',
              border: 'none',
              color: COLORES.azul,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {historialAbierto ? '▲ Ocultar historial' : `▼ Ver historial (${dias.length} días)`}
          </button>

          {historialAbierto && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dias.map((dia) => (
                <div
                  key={dia.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: dia.estado === 'DISPONIBLE' ? '#eff6ff' : '#f8fafc',
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                  }}
                >
                  <span>
                    <strong style={{ color: COLORES.azul }}>Día {dia.dia_numero}</strong> — {dia.objetivo}
                  </span>
                  <EstadoBadge estado={dia.estado} />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ResumenChip({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 16px', minWidth: 150 }}>
      <div style={{ fontSize: 11, color: COLORES.gris, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{titulo}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: COLORES.azul }}>{valor}</div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: DiaPlanAccion['estado'] }) {
  const config: Record<DiaPlanAccion['estado'], { texto: string; bg: string; color: string }> = {
    BLOQUEADO: { texto: '🔒 Bloqueado', bg: '#f1f5f9', color: COLORES.gris },
    DISPONIBLE: { texto: '▶ En curso', bg: '#eff6ff', color: '#2563eb' },
    COMPLETADO: { texto: '✅ Completado', bg: '#eaf7ee', color: '#247347' },
    NO_COMPLETADO: { texto: '🔴 No completado', bg: '#fef2f2', color: COLORES.rojo },
  };
  const c = config[estado];

  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {c.texto}
    </span>
  );
}

function TarjetaDia({
  dia,
  tareasEjecucion,
  tareasCierre,
  metricas,
  simbolo,
  todasCompletadas,
  guardando,
  completando,
  onTocarTarea,
  onCambiarMetrica,
  onGuardarMetricas,
  onCompletarDia,
}: {
  dia: DiaPlanAccion;
  tareasEjecucion: TareaPlanAccion[];
  tareasCierre: TareaPlanAccion[];
  metricas: Metricas;
  simbolo: string;
  todasCompletadas: boolean;
  guardando: boolean;
  completando: boolean;
  onTocarTarea: (tarea: TareaPlanAccion) => void;
  onCambiarMetrica: (campo: keyof Metricas, valor: string) => void;
  onGuardarMetricas: () => void;
  onCompletarDia: () => void;
}) {
  return (
    <section
      style={{
        border: `2px solid ${COLORES.azul}22`,
        borderRadius: 20,
        padding: 24,
        background: COLORES.blanco,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORES.verde, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
        {NOMBRE_FASE[dia.fase] ?? `Fase ${dia.fase}`}
      </div>
      <h2 style={{ margin: '0 0 4px', color: COLORES.azul, fontSize: 24 }}>Día {dia.dia_numero}</h2>
      <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>{dia.objetivo}</p>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: COLORES.gris }}>
        <strong>Resultado esperado:</strong> {dia.resultado_esperado}
      </p>

      <BloqueTareas titulo="🌅 Turno 08:00 — Ejecución" tareas={tareasEjecucion} onTocarTarea={onTocarTarea} />
      <BloqueTareas titulo="🌙 Turno 20:00 — Cierre y preparación" tareas={tareasCierre} onTocarTarea={onTocarTarea} />

      <div style={{ marginTop: 24, padding: 18, background: '#f8fafc', borderRadius: 14 }}>
        <p style={{ margin: '0 0 12px', fontWeight: 700, color: COLORES.azul, fontSize: 14 }}>Control del día</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
          <CampoMetrica label={`Ingresos (${simbolo})`} valor={metricas.ingresos_generados} onChange={(v) => onCambiarMetrica('ingresos_generados', v)} />
          <CampoMetrica label={`Recurrente/mes (${simbolo})`} valor={metricas.ingresos_recurrentes} onChange={(v) => onCambiarMetrica('ingresos_recurrentes', v)} />
          <CampoMetrica label="Contactos" valor={metricas.contactos} onChange={(v) => onCambiarMetrica('contactos', v)} />
          <CampoMetrica label="Conversaciones" valor={metricas.conversaciones} onChange={(v) => onCambiarMetrica('conversaciones', v)} />
          <CampoMetrica label="Propuestas" valor={metricas.propuestas} onChange={(v) => onCambiarMetrica('propuestas', v)} />
          <CampoMetrica label="Ventas" valor={metricas.ventas} onChange={(v) => onCambiarMetrica('ventas', v)} />
        </div>

        <textarea
          value={metricas.notas}
          onChange={(e) => onCambiarMetrica('notas', e.target.value)}
          placeholder="Notas del día: qué quedó pendiente, obstáculos, aprendizajes..."
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
        />

        <button
          type="button"
          onClick={onGuardarMetricas}
          disabled={guardando}
          style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: `1px solid ${COLORES.azul}`, background: COLORES.blanco, color: COLORES.azul, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          {guardando ? 'Guardando...' : 'Guardar resultados'}
        </button>
      </div>

      <button
        type="button"
        onClick={onCompletarDia}
        disabled={!todasCompletadas || completando}
        style={{
          marginTop: 20,
          width: '100%',
          padding: '14px 18px',
          borderRadius: 12,
          border: 'none',
          background: todasCompletadas ? `linear-gradient(135deg, ${COLORES.verde}, #237044)` : '#d1d5db',
          color: COLORES.blanco,
          fontWeight: 800,
          fontSize: 15,
          cursor: todasCompletadas ? 'pointer' : 'not-allowed',
        }}
      >
        {completando
          ? 'Completando...'
          : todasCompletadas
            ? '✅ Completar el día y desbloquear el siguiente'
            : 'Tildá todas las tareas para completar el día'}
      </button>
    </section>
  );
}

function BloqueTareas({
  titulo,
  tareas,
  onTocarTarea,
}: {
  titulo: string;
  tareas: TareaPlanAccion[];
  onTocarTarea: (tarea: TareaPlanAccion) => void;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13, color: COLORES.azul }}>{titulo}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tareas.map((tarea) => (
          <label
            key={tarea.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 10,
              background: tarea.completada ? '#eaf7ee' : '#f8fafc',
              cursor: 'pointer',
              fontSize: 13.5,
            }}
          >
            <input
              type="checkbox"
              checked={tarea.completada}
              onChange={() => onTocarTarea(tarea)}
              style={{ marginTop: 2, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ textDecoration: tarea.completada ? 'line-through' : 'none', color: tarea.completada ? COLORES.gris : '#1f2937' }}>
              {tarea.texto}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CampoMetrica({ label, valor, onChange }: { label: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: COLORES.gris, fontWeight: 700 }}>
      {label}
      <input
        type="number"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
      />
    </label>
  );
}

const fondo: React.CSSProperties = {
  minHeight: '100vh',
  background: COLORES.fondo,
  padding: '24px 16px 60px',
};

const encabezado: React.CSSProperties = {
  background: `linear-gradient(125deg, ${COLORES.azul} 0%, ${COLORES.azul} 60%, ${COLORES.verde} 100%)`,
  borderRadius: 24,
  padding: '26px 28px',
  color: COLORES.blanco,
  marginBottom: 20,
};

const volver: React.CSSProperties = {
  color: '#dbe5ef',
  fontSize: 13,
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: 10,
};

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  color: '#a9c6de',
  marginBottom: 4,
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 24,
  border: `1px solid ${COLORES.borde}`,
};
