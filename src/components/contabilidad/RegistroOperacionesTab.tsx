'use client';

// PESTAÑA 2 · REGISTRO DE OPERACIONES
//
// Extraído de app/contabilidad/page.tsx — mismo comportamiento, solo
// en su propio archivo (Fase 2 de mantenimiento).

import { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { eliminarOperacion } from '@/lib/motor';
import { formatearNumeroEntero } from '@/lib/moneda';
import { crearTraductor, nombreOperacionDisplay } from '@/lib/i18n';
import {
  diccionarioContabilidad,
  etiquetaRelacion,
  msgConfirmarEliminarOperacion,
  msgConfirmarEliminarYRecargar,
} from '@/app/contabilidad/i18n';
import {
  SimboloContext,
  EsFamiliarContext,
  IdiomaContext,
  OPERACIONES_EDITABLES,
  type ValoresIniciales,
  type Registro,
  construirValoresEdicion,
} from './compartido';
import { campoInput, botonSecundario, botonValidar, botonEliminar, tablaContenedor, cabeceraFila, filaStyle, vacioStyle } from './estilosCompartidos';
import { Th, Td, Estado } from './celdas';
import { CentralDeLanzamientosTab } from './CentralDeLanzamientosTab';

export function RegistroOperacionesTab() {
  const simbolo = useContext(SimboloContext);
  const esFamiliar = useContext(EsFamiliarContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioContabilidad, idioma);
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [filas, setFilas] = useState<Registro[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [validando, setValidando] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<{ idOperacion: string; valores: ValoresIniciales } | null>(null);
  const [mostrandoNuevo, setMostrandoNuevo] = useState(false);

  async function cargar(empresa: string) {
    const { data, error } = await supabase
      .from('registro_operaciones')
      .select(
        'id_operacion, fecha, operacion, categoria, forma_pago, total, historico, cliente_proveedor, estado'
      )
      .eq('empresa_id', empresa)
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

  async function handleEliminar(idOperacion: string) {
    if (!empresaId) return;

    const confirmado = window.confirm(msgConfirmarEliminarOperacion(idioma, idOperacion));

    if (!confirmado) return;

    setError('');
    setBorrando(idOperacion);

    try {
      await eliminarOperacion(empresaId, idOperacion);
      await cargar(empresaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorEliminar'));
    } finally {
      setBorrando(null);
    }
  }

  async function handleEditar(fila: Registro) {
    if (!empresaId) return;

    setError('');

    try {
      const valores = await construirValoresEdicion(empresaId, fila);
      setEditando({ idOperacion: fila.id_operacion, valores });
    } catch {
      setError(t('errorDetallesEdicion'));
    }
  }

  async function handleEliminarYRecargar(idOperacion: string) {
    if (!empresaId) return;

    const confirmado = window.confirm(msgConfirmarEliminarYRecargar(idioma, idOperacion));

    if (!confirmado) return;

    setError('');
    setBorrando(idOperacion);

    try {
      await eliminarOperacion(empresaId, idOperacion);
      await cargar(empresaId);
      setMostrandoNuevo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorEliminar'));
    } finally {
      setBorrando(null);
    }
  }

  async function handleValidar(idOperacion: string) {
    if (!empresaId) return;

    setError('');
    setValidando(idOperacion);

    try {
      const { error: errorValidar } = await supabase
        .from('registro_operaciones')
        .update({ estado: 'VALIDADO' })
        .eq('empresa_id', empresaId)
        .eq('id_operacion', idOperacion);

      if (errorValidar) {
        throw errorValidar;
      }

      await cargar(empresaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorValidar'));
    } finally {
      setValidando(null);
    }
  }

  const visibles = filas.filter((fila) =>
    [fila.id_operacion, fila.operacion, fila.categoria, fila.forma_pago, fila.historico, fila.cliente_proveedor]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

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

  if (mostrandoNuevo) {
    return (
      <CentralDeLanzamientosTab
        onCancelar={() => setMostrandoNuevo(false)}
        onGuardado={() => {
          setMostrandoNuevo(false);
          if (empresaId) cargar(empresaId);
        }}
      />
    );
  }

  return (
    <div>
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder={t('buscarOperaciones')}
        style={{ ...campoInput, maxWidth: 460, marginBottom: 18 }}
      />

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {cargando ? (
        <p>{t('cargandoRegistros')}</p>
      ) : (
        <div style={tablaContenedor}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={cabeceraFila}>
                <Th>{t('idRegistro')}</Th>
                <Th>{t('fecha')}</Th>
                <Th>{t('operacion')}</Th>
                <Th>{t('categoria')}</Th>
                <Th>{t('formaPago')}</Th>
                <Th>{t('historico')}</Th>
                <Th>{etiquetaRelacion(idioma, esFamiliar, '')}</Th>
                <Th align="right">{t('totalHeader')}</Th>
                <Th>{t('estadoHeader')}</Th>
                <Th></Th>
              </tr>
            </thead>

            <tbody>
              {visibles.map((fila) => (
                <tr key={fila.id_operacion} style={filaStyle}>
                  <Td>{fila.id_operacion}</Td>
                  <Td>{new Date(`${fila.fecha}T12:00:00`).toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR')}</Td>
                  <Td>{nombreOperacionDisplay(idioma, fila.operacion, esFamiliar)}</Td>
                  <Td>{fila.categoria}</Td>
                  <Td>{fila.forma_pago}</Td>
                  <Td style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 220 }}>
                    {fila.historico || '—'}
                  </Td>
                  <Td>{fila.cliente_proveedor || '—'}</Td>
                  <Td align="right">{simbolo} {formatearNumeroEntero(Number(fila.total))}</Td>

                  <Td>
                    <Estado estado={fila.estado} idioma={idioma} />
                  </Td>

                  <Td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {(fila.estado || 'PENDIENTE').toUpperCase() !== 'VALIDADO' && (
                        <button
                          onClick={() => handleValidar(fila.id_operacion)}
                          disabled={validando === fila.id_operacion}
                          style={botonValidar}
                          title={t('tituloValidar')}
                        >
                          {validando === fila.id_operacion ? '...' : t('validado')}
                        </button>
                      )}

                      {OPERACIONES_EDITABLES.includes(fila.operacion) ? (
                        <button
                          onClick={() => handleEditar(fila)}
                          style={botonSecundario}
                          title={t('tituloEditar')}
                        >
                          {t('editar')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEliminarYRecargar(fila.id_operacion)}
                          disabled={borrando === fila.id_operacion}
                          style={botonSecundario}
                          title={t('tituloEliminarYRecargar')}
                        >
                          {borrando === fila.id_operacion ? '...' : t('eliminarYRecargar')}
                        </button>
                      )}

                      <button
                        onClick={() => handleEliminar(fila.id_operacion)}
                        disabled={borrando === fila.id_operacion}
                        style={botonEliminar}
                        title={t('tituloEliminar')}
                      >
                        {borrando === fila.id_operacion ? '...' : t('eliminar')}
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}

              {!visibles.length && (
                <tr>
                  <td colSpan={10} style={vacioStyle}>
                    {t('sinRegistros')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

