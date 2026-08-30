'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { obtenerProgresoGamificacion, type ProgresoGamificacion } from '@/lib/gamificacion';
import { calcularAntiguedadTexto } from '@/lib/antiguedad';

const COLORES_BASE = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Empresa = {
  id: string;
  nombre: string;
  rubro: string | null;
  logo_url: string | null;
  creado_en: string | null;
};

type PendienteRegistro = {
  tipo: 'registro';
  empresaId: string;
  idOperacion: string;
  fecha: string;
  operacion: string;
  categoria: string;
  total: number;
  historico: string | null;
};

type PendienteMovimiento = {
  tipo: 'movimiento';
  empresaId: string;
  idOperacion: string;
  fecha: string;
  lineas: number;
  total: number;
};

type Pendiente = PendienteRegistro | PendienteMovimiento;

export default function PanelMaestroPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nivelesPorEmpresa, setNivelesPorEmpresa] = useState<Record<string, ProgresoGamificacion>>({});
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [validando, setValidando] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function cargarPendientes() {
    const [{ data: registros, error: errorRegistros }, { data: movimientos, error: errorMovimientos }] =
      await Promise.all([
        supabase
          .from('registro_operaciones')
          .select('empresa_id, id_operacion, fecha, operacion, categoria, total, historico, estado')
          .or('estado.is.null,estado.neq.VALIDADO')
          .order('fecha', { ascending: false }),

        supabase
          .from('movimientos_stock')
          .select('empresa_id, id_operacion, fecha, cantidad, costo_unitario, estado')
          .or('estado.is.null,estado.neq.VALIDADO')
          .order('fecha', { ascending: false }),
      ]);

    if (errorRegistros) console.warn('No se pudieron cargar registros pendientes:', errorRegistros);
    if (errorMovimientos) console.warn('No se pudieron cargar movimientos pendientes:', errorMovimientos);

    const registrosPendientes: Pendiente[] = (registros ?? []).map((r) => ({
      tipo: 'registro',
      empresaId: r.empresa_id,
      idOperacion: r.id_operacion,
      fecha: r.fecha,
      operacion: r.operacion,
      categoria: r.categoria,
      total: Number(r.total ?? 0),
      historico: r.historico,
    }));

    // Un "movimiento de mercadería" pendiente puede tener varias
    // líneas (varios productos en la misma operación) — se agrupan
    // por id_operacion porque se validan todas juntas de un clic.
    const movimientosAgrupados = new Map<string, PendienteMovimiento>();

    for (const m of movimientos ?? []) {
      const clave = `${m.empresa_id}|${m.id_operacion}`;
      const actual = movimientosAgrupados.get(clave);

      if (actual) {
        actual.lineas += 1;
        actual.total += Number(m.cantidad ?? 0) * Number(m.costo_unitario ?? 0);
      } else {
        movimientosAgrupados.set(clave, {
          tipo: 'movimiento',
          empresaId: m.empresa_id,
          idOperacion: m.id_operacion,
          fecha: m.fecha,
          lineas: 1,
          total: Number(m.cantidad ?? 0) * Number(m.costo_unitario ?? 0),
        });
      }
    }

    setPendientes([...registrosPendientes, ...movimientosAgrupados.values()]);
  }

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      // Verificar que sea admin de plataforma
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('es_admin_plataforma')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.es_admin_plataforma) {
        router.push('/');
        return;
      }

      const { data: empresasData, error: errorEmpresas } = await supabase
        .from('empresas')
        .select('id, nombre, rubro, logo_url, creado_en')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (errorEmpresas) {
        setError('No se pudieron cargar las empresas.');
        setCargando(false);
        return;
      }

      setEmpresas(empresasData ?? []);

      const resultados = await Promise.all(
        (empresasData ?? []).map(async (empresa) => {
          try {
            const progreso = await obtenerProgresoGamificacion(empresa.id);
            return [empresa.id, progreso] as const;
          } catch (errorGamificacion) {
            console.warn(`No se pudo calcular el nivel de ${empresa.nombre}:`, errorGamificacion);
            return null;
          }
        })
      );

      setNivelesPorEmpresa(
        Object.fromEntries(resultados.filter((r): r is readonly [string, ProgresoGamificacion] => r !== null))
      );

      await cargarPendientes();
      setCargando(false);
    }

    cargar();
  }, [router]);

  async function validarRegistro(pendiente: PendienteRegistro) {
    setError('');
    setMensaje('');
    setValidando(`registro-${pendiente.idOperacion}`);

    const { error: errorValidar } = await supabase
      .from('registro_operaciones')
      .update({ estado: 'VALIDADO' })
      .eq('empresa_id', pendiente.empresaId)
      .eq('id_operacion', pendiente.idOperacion);

    if (errorValidar) {
      setError(`No se pudo validar ${pendiente.idOperacion}.`);
    } else {
      setMensaje(`${pendiente.idOperacion} validada.`);
      await cargarPendientes();
    }

    setValidando(null);
  }

  async function validarMovimiento(pendiente: PendienteMovimiento) {
    setError('');
    setMensaje('');
    setValidando(`movimiento-${pendiente.idOperacion}`);

    const [{ error: errorMovimiento }, { error: errorAutomatico }] = await Promise.all([
      supabase
        .from('movimientos_stock')
        .update({ estado: 'VALIDADO' })
        .eq('empresa_id', pendiente.empresaId)
        .eq('id_operacion', pendiente.idOperacion),

      supabase
        .from('registros_automaticos')
        .update({ estado: 'VALIDADO' })
        .eq('empresa_id', pendiente.empresaId)
        .eq('id_operacion', pendiente.idOperacion),
    ]);

    if (errorMovimiento || errorAutomatico) {
      setError(`No se pudo validar el movimiento ${pendiente.idOperacion}.`);
    } else {
      setMensaje(`Movimiento ${pendiente.idOperacion} validado.`);
      await cargarPendientes();
    }

    setValidando(null);
  }

  async function entrarAEmpresa(empresaId: string) {
    setCambiando(empresaId);
    setError('');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error: errorUpdate } = await supabase
      .from('perfiles')
      .update({ empresa_id: empresaId })
      .eq('id', userData.user.id);

    if (errorUpdate) {
      setError('No se pudo entrar a esa empresa.');
      setCambiando(null);
      return;
    }

    router.push('/');
  }

  if (cargando) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f7f9',
          color: COLORES_BASE.azul,
          fontWeight: 600,
        }}
      >
        Preparando tu reino...
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #edf4f1 0%, transparent 34%), #f5f7f9',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* HERO - MODO DIOS */}
        <section
          style={{
            background: `linear-gradient(125deg, ${COLORES_BASE.azul} 0%, ${COLORES_BASE.azul} 58%, ${COLORES_BASE.verde} 100%)`,
            color: COLORES_BASE.blanco,
            borderRadius: 28,
            padding: '34px 32px',
            marginBottom: 24,
            boxShadow: '0 18px 40px rgba(31,58,95,0.16)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              opacity: 0.75,
              marginBottom: 8,
            }}
          >
            PANEL MAESTRO · VISÃO FINANCEIRA
          </div>

          <h1 style={{ margin: 0, fontSize: 34, display: 'flex', alignItems: 'center', gap: 12 }}>
            🔱 Nivel ∞ · Dios Financiero
          </h1>

          <p style={{ margin: '10px 0 0', fontSize: 17, fontWeight: 600 }}>
            Controlás {empresas.length} {empresas.length === 1 ? 'universo empresarial' : 'universos empresariales'}. Elegí uno para descender a él.
          </p>

          <div
            style={{
              display: 'inline-block',
              marginTop: 14,
              padding: '8px 16px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.25)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ✨ Misión actual: mantener el equilibrio de todas las empresas
          </div>
        </section>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {mensaje && (
          <div
            style={{
              background: '#f0fdf4',
              color: '#166534',
              padding: '12px 16px',
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {mensaje}
          </div>
        )}

        {/* =================================================
            NOTIFICACIONES — pendientes de validar, de todas
            las empresas, sin tener que entrar a cada una
        ================================================== */}

        <NotificacionesPendientes
          pendientes={pendientes}
          empresas={empresas}
          validando={validando}
          onValidarRegistro={validarRegistro}
          onValidarMovimiento={validarMovimiento}
        />

        {/* LISTA DE EMPRESAS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          {empresas.map((empresa) => (
            <button
              key={empresa.id}
              onClick={() => entrarAEmpresa(empresa.id)}
              disabled={cambiando !== null}
              style={{
                background: COLORES_BASE.blanco,
                border: '1px solid #e5e7eb',
                borderRadius: 22,
                padding: 22,
                textAlign: 'left',
                cursor: cambiando ? 'wait' : 'pointer',
                boxShadow: '0 10px 24px rgba(31,58,95,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                opacity: cambiando && cambiando !== empresa.id ? 0.5 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: '#fbfcfd',
                    border: `2px solid ${COLORES_BASE.gris}33`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {empresa.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={empresa.logo_url}
                      alt={`Logo de ${empresa.nombre}`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                    />
                  ) : (
                    <span style={{ fontSize: 24, fontWeight: 800, color: COLORES_BASE.azul }}>
                      {empresa.nombre.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: COLORES_BASE.azul }}>
                    {empresa.nombre}
                  </div>
                  <div style={{ fontSize: 12, color: COLORES_BASE.gris, marginTop: 2 }}>
                    {empresa.rubro ?? 'Sin rubro definido'}
                  </div>
                </div>
              </div>

              {nivelesPorEmpresa[empresa.id] && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: 14,
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: COLORES_BASE.azul,
                      marginBottom: 8,
                    }}
                  >
                    <span>
                      {nivelesPorEmpresa[empresa.id].emoji} Nivel {nivelesPorEmpresa[empresa.id].nivel} ·{' '}
                      {nivelesPorEmpresa[empresa.id].nombre}
                    </span>
                    <span style={{ color: COLORES_BASE.gris, fontWeight: 600 }}>
                      {nivelesPorEmpresa[empresa.id].operaciones} op.
                    </span>
                  </div>

                  {calcularAntiguedadTexto(empresa.creado_en) && (
                    <div
                      style={{
                        fontSize: 11,
                        color: COLORES_BASE.gris,
                        fontWeight: 600,
                        marginBottom: 8,
                      }}
                    >
                      🕒 {calcularAntiguedadTexto(empresa.creado_en)} en el sistema
                    </div>
                  )}

                  <div style={{ height: 7, borderRadius: 999, background: '#e7edf1', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${nivelesPorEmpresa[empresa.id].progreso}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: COLORES_BASE.verde,
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 6, fontSize: 11, color: COLORES_BASE.gris }}>
                    {nivelesPorEmpresa[empresa.id].operacionesMax === null
                      ? 'Nivel máximo alcanzado'
                      : `Faltan ${nivelesPorEmpresa[empresa.id].faltan} operaciones para el próximo nivel`}
                  </div>
                </div>
              )}

              <div
                style={{
                  textAlign: 'center',
                  padding: '10px 0',
                  borderRadius: 12,
                  background: `${COLORES_BASE.verde}12`,
                  color: COLORES_BASE.verde,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {cambiando === empresa.id ? 'Entrando...' : 'Entrar a este universo →'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

/* ==========================================================
   NOTIFICACIONES PENDIENTES DE VALIDAR — todas las empresas
========================================================== */

function NotificacionesPendientes({
  pendientes,
  empresas,
  validando,
  onValidarRegistro,
  onValidarMovimiento,
}: {
  pendientes: Pendiente[];
  empresas: Empresa[];
  validando: string | null;
  onValidarRegistro: (p: PendienteRegistro) => void;
  onValidarMovimiento: (p: PendienteMovimiento) => void;
}) {
  const [abierta, setAbierta] = useState(true);
  const nombrePorEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));

  const porEmpresa = new Map<string, Pendiente[]>();
  for (const p of pendientes) {
    const lista = porEmpresa.get(p.empresaId) ?? [];
    lista.push(p);
    porEmpresa.set(p.empresaId, lista);
  }

  if (pendientes.length === 0) {
    return (
      <div
        style={{
          background: COLORES_BASE.blanco,
          border: '1px solid #e5e7eb',
          borderRadius: 20,
          padding: '18px 22px',
          marginBottom: 24,
          color: COLORES_BASE.gris,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        ✅ No hay nada pendiente de validar en ninguna empresa.
      </div>
    );
  }

  return (
    <div
      style={{
        background: COLORES_BASE.blanco,
        border: '1px solid #fde68a',
        borderRadius: 20,
        padding: 22,
        marginBottom: 24,
        boxShadow: '0 10px 24px rgba(217,119,6,0.08)',
      }}
    >
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800, color: COLORES_BASE.azul }}>
          🔔 Pendientes de validar
          <span
            style={{
              background: '#f59e0b',
              color: '#ffffff',
              borderRadius: 999,
              padding: '3px 10px',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {pendientes.length}
          </span>
        </span>

        <span style={{ color: COLORES_BASE.gris, fontSize: 13 }}>{abierta ? '▾ ocultar' : '▸ mostrar'}</span>
      </button>

      {abierta && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Array.from(porEmpresa.entries()).map(([empresaId, items]) => (
            <div key={empresaId}>
              <div style={{ fontSize: 13, fontWeight: 800, color: COLORES_BASE.azul, marginBottom: 8 }}>
                {nombrePorEmpresa.get(empresaId) ?? 'Empresa'}{' '}
                <span style={{ color: COLORES_BASE.gris, fontWeight: 600 }}>· {items.length} pendiente{items.length === 1 ? '' : 's'}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((p) => (
                  <div
                    key={`${p.tipo}-${p.idOperacion}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ fontSize: 13, color: COLORES_BASE.azul }}>
                      <strong>{p.idOperacion}</strong>{' '}
                      <span style={{ color: COLORES_BASE.gris }}>
                        {p.tipo === 'registro'
                          ? `· ${p.operacion} · ${p.categoria}${p.historico ? ` · ${p.historico}` : ''}`
                          : `· Movimiento de mercadería · ${p.lineas} línea${p.lineas === 1 ? '' : 's'}`}
                      </span>
                      {' — '}
                      <span style={{ fontWeight: 700 }}>R$ {p.total.toFixed(2)}</span>
                    </div>

                    <button
                      type="button"
                      disabled={validando === `${p.tipo}-${p.idOperacion}`}
                      onClick={() => (p.tipo === 'registro' ? onValidarRegistro(p) : onValidarMovimiento(p))}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: '1px solid #bbf7d0',
                        background: '#f0fdf4',
                        color: '#166534',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {validando === `${p.tipo}-${p.idOperacion}` ? '...' : 'Validado ✓'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
