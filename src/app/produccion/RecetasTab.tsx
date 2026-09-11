'use client';

// RECETAS — CRUD dentro del módulo de Producción.
//
// Cada producto terminado tiene como máximo una receta (restricción
// en la base): "nueva" solo se ofrece para productos que todavía no
// tienen una, "editar" reemplaza el detalle de la que ya existe, y
// "eliminar" la desactiva (no la borra) para no romper el historial
// de producciones ya confirmadas con esa receta.

import { useEffect, useState } from 'react';
import {
  listarProductosTerminados,
  listarInsumosDisponibles,
  listarRecetas,
  obtenerRecetaPorProducto,
  guardarReceta,
  eliminarReceta,
  reactivarReceta,
  UNIDADES_PRODUCCION,
  type RecetaConProducto,
  type RecetaDetalleInput,
} from '@/lib/produccion';
import { crearTraductor } from '@/lib/i18n';
import { diccionarioProduccion } from './i18n';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  borde: '#d6dee5',
  rojo: '#dc2626',
};

type ProductoOpcion = { id: string; nombre: string; unidad_medida: string | null };

export function RecetasTab({ empresaId, idioma }: { empresaId: string; idioma: string | null }) {
  const t = crearTraductor(diccionarioProduccion, idioma);

  const [recetas, setRecetas] = useState<RecetaConProducto[]>([]);
  const [productosTerminados, setProductosTerminados] = useState<ProductoOpcion[]>([]);
  const [insumos, setInsumos] = useState<ProductoOpcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  // '__nueva__' = formulario en blanco; un producto_terminado_id = editando su receta; null = lista.
  const [editando, setEditando] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formRendimiento, setFormRendimiento] = useState('');
  const [formProductoId, setFormProductoId] = useState('');
  const [formDetalle, setFormDetalle] = useState<RecetaDetalleInput[]>([]);
  const [guardando, setGuardando] = useState(false);

  async function cargarTodo() {
    setCargando(true);
    try {
      const [listaRecetas, listaProductos, listaInsumos] = await Promise.all([
        listarRecetas(empresaId),
        listarProductosTerminados(empresaId),
        listarInsumosDisponibles(empresaId),
      ]);
      setRecetas(listaRecetas);
      setProductosTerminados(listaProductos);
      setInsumos(listaInsumos);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGuardarReceta'));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  function iniciarNueva() {
    setEditando('__nueva__');
    setFormNombre('');
    setFormRendimiento('');
    setFormProductoId('');
    setFormDetalle([]);
    setError('');
    setMensaje('');
  }

  async function iniciarEdicion(productoId: string, nombreActual: string, rendimientoActual: number) {
    setError('');
    setMensaje('');
    try {
      const datos = await obtenerRecetaPorProducto(empresaId, productoId);
      setEditando(productoId);
      setFormNombre(nombreActual);
      setFormRendimiento(String(rendimientoActual));
      setFormProductoId(productoId);
      setFormDetalle(
        (datos?.detalles ?? []).map((d) => ({
          insumo_id: d.insumo_id,
          cantidad: d.cantidad,
          unidad_medida: d.unidad_medida,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGuardarReceta'));
    }
  }

  function cancelar() {
    setEditando(null);
  }

  function agregarFilaInsumo() {
    if (insumos.length === 0) return;
    setFormDetalle((actual) => [
      ...actual,
      { insumo_id: insumos[0].id, cantidad: 0, unidad_medida: insumos[0].unidad_medida || 'UNIDAD' },
    ]);
  }

  function actualizarFila(indice: number, campo: keyof RecetaDetalleInput, valor: string | number) {
    setFormDetalle((actual) => actual.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila)));
  }

  function quitarFila(indice: number) {
    setFormDetalle((actual) => actual.filter((_, i) => i !== indice));
  }

  async function guardar() {
    if (!formProductoId) {
      setError(t('elegirProductoPrimero'));
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      await guardarReceta(empresaId, formProductoId, {
        nombre: formNombre,
        rendimiento: Number(formRendimiento),
        detalle: formDetalle,
      });
      setMensaje(t('mensajeRecetaGuardada'));
      setEditando(null);
      await cargarTodo();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGuardarReceta'));
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(recetaId: string) {
    if (!window.confirm(t('confirmarEliminarReceta'))) return;
    try {
      await eliminarReceta(recetaId);
      await cargarTodo();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGuardarReceta'));
    }
  }

  async function handleReactivar(recetaId: string) {
    try {
      await reactivarReceta(recetaId);
      await cargarTodo();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGuardarReceta'));
    }
  }

  const productosSinReceta = productosTerminados.filter(
    (p) => !recetas.some((r) => r.producto_terminado_id === p.id)
  );

  if (cargando) {
    return <p style={{ color: COLORES.gris, fontSize: 13 }}>{t('cargandoProduccion')}</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, color: COLORES.azul, fontSize: 20 }}>{t('recetasTitulo')}</h2>
          <p style={{ margin: '6px 0 0', color: COLORES.gris, fontSize: 13, maxWidth: 560 }}>{t('recetasSubtitulo')}</p>
        </div>

        {editando === null && (
          <button
            type="button"
            onClick={iniciarNueva}
            disabled={productosSinReceta.length === 0}
            style={{ ...botonNueva, opacity: productosSinReceta.length === 0 ? 0.5 : 1 }}
          >
            {t('nuevaReceta')}
          </button>
        )}
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {mensaje && <div style={mensajeOk}>{mensaje}</div>}

      {editando !== null ? (
        <div style={tarjetaForm}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={labelForm}>{t('productoTerminado')}</label>
              <select
                value={formProductoId}
                onChange={(e) => setFormProductoId(e.target.value)}
                style={inputForm}
                disabled={editando !== '__nueva__'}
              >
                <option value="">{t('seleccionarProducto')}</option>
                {(editando === '__nueva__' ? productosSinReceta : productosTerminados).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelForm}>{t('nombreReceta')}</label>
              <input
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder={t('nombreRecetaPlaceholder')}
                style={inputForm}
              />
            </div>

            <div>
              <label style={labelForm}>{t('rendimientoLabel')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formRendimiento}
                onChange={(e) => setFormRendimiento(e.target.value)}
                placeholder={t('rendimientoPlaceholder')}
                style={inputForm}
              />
            </div>
          </div>

          <div style={{ marginBottom: 8, fontWeight: 700, color: COLORES.azul, fontSize: 14 }}>
            {t('insumosDeLaReceta')}
          </div>

          {insumos.length === 0 ? (
            <p style={{ color: COLORES.gris, fontSize: 13 }}>{t('sinInsumosDisponibles')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {formDetalle.map((fila, indice) => (
                <div key={indice} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={fila.insumo_id}
                    onChange={(e) => actualizarFila(indice, 'insumo_id', e.target.value)}
                    style={{ ...inputForm, flex: '2 1 200px' }}
                  >
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={fila.cantidad || ''}
                    onChange={(e) => actualizarFila(indice, 'cantidad', Number(e.target.value))}
                    placeholder={t('cantidadInsumo')}
                    style={{ ...inputForm, flex: '1 1 100px' }}
                  />

                  <select
                    value={fila.unidad_medida}
                    onChange={(e) => actualizarFila(indice, 'unidad_medida', e.target.value)}
                    style={{ ...inputForm, flex: '1 1 100px' }}
                  >
                    {UNIDADES_PRODUCCION.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>

                  <button type="button" onClick={() => quitarFila(indice)} style={botonQuitar}>
                    {t('quitarInsumo')}
                  </button>
                </div>
              ))}

              <button type="button" onClick={agregarFilaInsumo} style={botonAgregar}>
                {t('agregarInsumo')}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" onClick={cancelar} style={botonCancelar}>
              {t('cancelar')}
            </button>
            <button type="button" onClick={guardar} disabled={guardando} style={botonGuardar}>
              {guardando ? t('guardandoReceta') : t('guardarReceta')}
            </button>
          </div>
        </div>
      ) : (
        <div style={tablaWrapper}>
          {recetas.length === 0 ? (
            <p style={{ padding: 20, color: COLORES.gris, fontSize: 13, textAlign: 'center' }}>{t('sinRecetas')}</p>
          ) : (
            <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={th}>{t('columnaProducto')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('columnaRendimiento')}</th>
                  <th style={th}>{t('columnaEstado')}</th>
                  <th style={th}>{t('columnaAcciones')}</th>
                </tr>
              </thead>

              <tbody>
                {recetas.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={td}>
                      <strong>{r.nombreProducto}</strong>
                      <div style={{ fontSize: 12, color: COLORES.gris }}>{r.nombre}</div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {r.rendimiento} {r.unidad_rendimiento}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: r.activo ? '#eaf7ee' : '#fef2f2',
                          color: r.activo ? '#247347' : COLORES.rojo,
                        }}
                      >
                        {r.activo ? 'OK' : t('recetaInactiva')}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => iniciarEdicion(r.producto_terminado_id, r.nombre, r.rendimiento)}
                          style={botonLink}
                        >
                          {t('accionEditar')}
                        </button>

                        {r.activo ? (
                          <button type="button" onClick={() => handleEliminar(r.id)} style={{ ...botonLink, color: COLORES.rojo }}>
                            {t('accionEliminar')}
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleReactivar(r.id)} style={{ ...botonLink, color: COLORES.verde }}>
                            {t('accionReactivar')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const labelForm: React.CSSProperties = { fontSize: 13, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 6 };

const inputForm: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${COLORES.borde}`,
  background: '#fbfcfd',
  color: '#1f2937',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

const tarjetaForm: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 20,
};

const tablaWrapper: React.CSSProperties = {
  background: COLORES.blanco,
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  overflowX: 'auto',
};

const th: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: '#374151', textAlign: 'left' };
const td: React.CSSProperties = { padding: '12px 16px', fontSize: 14, textAlign: 'left', verticalAlign: 'top' };

const botonNueva: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: COLORES.verde,
  color: COLORES.blanco,
  fontWeight: 700,
  fontSize: 13.5,
  cursor: 'pointer',
};

const botonGuardar: React.CSSProperties = { ...botonNueva, minWidth: 140 };

const botonCancelar: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: `1px solid ${COLORES.borde}`,
  background: COLORES.blanco,
  color: COLORES.gris,
  fontWeight: 700,
  fontSize: 13.5,
  cursor: 'pointer',
};

const botonAgregar: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '7px 12px',
  borderRadius: 8,
  border: `1px dashed ${COLORES.borde}`,
  background: 'transparent',
  color: COLORES.verde,
  fontWeight: 700,
  fontSize: 12.5,
  cursor: 'pointer',
};

const botonQuitar: React.CSSProperties = {
  padding: '9px 10px',
  borderRadius: 8,
  border: 'none',
  background: '#fef2f2',
  color: COLORES.rojo,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

const botonLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: COLORES.azul,
  fontWeight: 700,
  fontSize: 12.5,
  cursor: 'pointer',
};

const errorBox: React.CSSProperties = {
  marginBottom: 16,
  padding: '12px 15px',
  borderRadius: 10,
  background: '#fef2f2',
  color: '#991b1b',
  fontSize: 13,
  fontWeight: 600,
};

const mensajeOk: React.CSSProperties = {
  marginBottom: 16,
  padding: '12px 15px',
  borderRadius: 10,
  background: '#eaf7ee',
  color: '#247347',
  fontSize: 13,
  fontWeight: 600,
};
