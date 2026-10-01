'use client';

// Extraído de app/contabilidad/page.tsx — mismo comportamiento, solo
// en su propio archivo (Fase 2 de mantenimiento).

import { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatearNumeroEntero } from '@/lib/moneda';
import { crearTraductor, nombreOperacionDisplay } from '@/lib/i18n';
import { iconoOperacion } from '@/lib/iconosJuego';
import { diccionarioContabilidad } from '@/app/contabilidad/i18n';
import {
  SimboloContext,
  EsFamiliarContext,
  IdiomaContext,
  COLORES,
  OPERACIONES_EDITABLES,
  type ValoresIniciales,
  type Registro,
  construirValoresEdicion,
} from './compartido';
import { vacioOperacion } from './estilosCompartidos';
import { CentralDeLanzamientosTab } from './CentralDeLanzamientosTab';

/* ==========================================================
   PESTAÑA 4 · EDITAR REGISTROS
   Versión "cliente" de Registro de Operaciones: mismos datos, en
   formato de tarjetas tipo Mini-Juego en vez de tabla, sin baja ni
   validación — solo elegir un registro reciente y corregirlo. Ve la
   misma pestaña cualquier usuario (no solo esAdmin); el listado
   crudo con baja sigue siendo exclusivo del admin.
========================================================== */

const DIAS_VENTANA_EDITAR_REGISTROS = 7;

function fechaHaceNDias(dias: number): string {
  const hoy = new Date();
  hoy.setDate(hoy.getDate() - dias);
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export function EditarRegistrosTab() {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const esFamiliar = useContext(EsFamiliarContext);
  const t = crearTraductor(diccionarioContabilidad, idioma);
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [filas, setFilas] = useState<Registro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<{ idOperacion: string; valores: ValoresIniciales } | null>(null);

  async function cargar(empresa: string) {
    const { data, error } = await supabase
      .from('registro_operaciones')
      .select(
        'id_operacion, fecha, operacion, categoria, forma_pago, total, historico, cliente_proveedor, estado'
      )
      .eq('empresa_id', empresa)
      .gte('fecha', fechaHaceNDias(DIAS_VENTANA_EDITAR_REGISTROS))
      .order('id_operacion', { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setFilas((data ?? []) as Registro[]);
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

      if (!perfil?.empresa_id) {
        setCargando(false);
        return;
      }

      setEmpresaId(perfil.empresa_id);
      await cargar(perfil.empresa_id);
      setCargando(false);
    }

    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleTocar(fila: Registro) {
    if (!empresaId || !OPERACIONES_EDITABLES.includes(fila.operacion)) return;

    setError('');

    try {
      const valores = await construirValoresEdicion(empresaId, fila);
      setEditando({ idOperacion: fila.id_operacion, valores });
    } catch {
      setError(t('errorDetallesEdicion'));
    }
  }

  if (editando) {
    return (
      <CentralDeLanzamientosTab
        idOperacionEditar={editando.idOperacion}
        valoresIniciales={editando.valores}
        onCancelar={() => setEditando(null)}
        onGuardado={() => {
          setEditando(null);
          if (empresaId) cargar(empresaId);
        }}
      />
    );
  }

  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 800, color: COLORES.azul }}>
        {t('tituloEditarRegistros')}
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: COLORES.gris }}>
        {t('subtituloEditarRegistros')}
      </p>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {cargando ? (
        <p>{t('cargandoEditarRegistros')}</p>
      ) : filas.length === 0 ? (
        <div style={vacioOperacion}>🎲 {t('sinRegistrosRecientes')}</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          {filas.map((fila) => {
            const editable = OPERACIONES_EDITABLES.includes(fila.operacion);

            return (
              <button
                key={fila.id_operacion}
                type="button"
                onClick={() => handleTocar(fila)}
                disabled={!editable}
                title={editable ? t('tocarParaEditar') : t('noEditableExplicacion')}
                style={{
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 16,
                  borderRadius: 20,
                  border: editable ? `1px solid ${COLORES.azul}22` : '1px solid #e5e7eb',
                  background: editable ? COLORES.blanco : '#f8fafc',
                  boxShadow: editable ? '0 6px 16px rgba(31,58,95,0.08)' : 'none',
                  cursor: editable ? 'pointer' : 'not-allowed',
                  opacity: editable ? 1 : 0.65,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 22,
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#eff5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {iconoOperacion(fila.operacion)}
                    </span>
                    <span style={{ fontWeight: 800, color: COLORES.azul, fontSize: 14 }}>
                      {nombreOperacionDisplay(idioma, fila.operacion, esFamiliar)}
                    </span>
                  </span>

                  {!editable && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: COLORES.gris,
                        background: '#e5e7eb',
                        borderRadius: 999,
                        padding: '3px 8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('noEditableEtiqueta')}
                    </span>
                  )}
                </div>

                <span style={{ fontSize: 20, fontWeight: 800, color: COLORES.verde }}>
                  {simbolo} {formatearNumeroEntero(Number(fila.total))}
                </span>

                <span style={{ fontSize: 12, color: COLORES.gris }}>
                  {new Date(`${fila.fecha}T12:00:00`).toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR')}
                  {' · '}
                  {fila.categoria}
                  {' · '}
                  {fila.forma_pago}
                </span>

                {fila.cliente_proveedor && (
                  <span style={{ fontSize: 12, color: COLORES.gris }}>👤 {fila.cliente_proveedor}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

