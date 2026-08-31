'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Persona = {
  id: string;
  empresa_id: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  creado_en: string;
  codigo: string | null;
  fecha_alta: string | null;
};

type TipoRecurso = 'clientes' | 'proveedores';

type Formulario = {
  nombre: string;
  telefono: string;
  direccion: string;
  fecha_alta: string;
};

const FORMULARIO_VACIO: Formulario = {
  nombre: '',
  telefono: '',
  direccion: '',
  fecha_alta: new Date().toISOString().split('T')[0],
};

// ==========================================================
// ETIQUETAS — "Clientes"/"Proveedores" es el vocabulario normal de
// un negocio, pero no tiene sentido para el perfil Familiar (nadie
// habla de "proveedores" para las compras del supermercado). Ahí se
// usan palabras más cercanas a la idea real: quién te paga (fuente
// de ingreso) y a quién le pagás (destino de pago). El resto de los
// perfiles no cambia.
// ==========================================================

type Etiquetas = {
  emoji: string;
  plural: string;
  singular: string;
  femenino: boolean;
};

function obtenerEtiquetas(tipo: TipoRecurso, esFamiliar: boolean): Etiquetas {
  if (esFamiliar) {
    return tipo === 'clientes'
      ? { emoji: '💰', plural: 'Fuentes de ingreso', singular: 'fuente de ingreso', femenino: true }
      : { emoji: '🏪', plural: 'Destinos de pago', singular: 'destino de pago', femenino: false };
  }

  return tipo === 'clientes'
    ? { emoji: '👥', plural: 'Clientes', singular: 'cliente', femenino: false }
    : { emoji: '🏢', plural: 'Proveedores', singular: 'proveedor', femenino: false };
}

export default function RecursosHumanosPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [esFamiliar, setEsFamiliar] = useState(false);

  const [clientes, setClientes] = useState<Persona[]>([]);
  const [proveedores, setProveedores] = useState<Persona[]>([]);

  const [pestana, setPestana] = useState<TipoRecurso>('clientes');

  const [busqueda, setBusqueda] = useState('');

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);

  const [error, setError] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setError('');

    const { data: userData, error: errorUsuario } = await supabase.auth.getUser();

    if (errorUsuario || !userData.user) {
      router.push('/login');
      return;
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from('perfiles')
      .select('empresa_id')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (errorPerfil || !perfil?.empresa_id) {
      setError('No se pudo identificar la empresa del usuario.');
      setCargando(false);
      return;
    }

    setEmpresaId(perfil.empresa_id);

    const [
      { data: clientesData, error: clientesError },
      { data: proveedoresData, error: proveedoresError },
      { data: empresaData },
    ] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, empresa_id, nombre, telefono, direccion, creado_en, codigo, fecha_alta')
        .eq('empresa_id', perfil.empresa_id),

      supabase
        .from('proveedores')
        .select('id, empresa_id, nombre, telefono, direccion, creado_en, codigo, fecha_alta')
        .eq('empresa_id', perfil.empresa_id),

      supabase
        .from('empresas')
        .select('perfil_empresa_id, perfiles_empresa(codigo)')
        .eq('id', perfil.empresa_id)
        .maybeSingle(),
    ]);

    if (clientesError) {
      console.warn('No se pudieron cargar los clientes:', clientesError);
    }

    if (proveedoresError) {
      console.warn('No se pudieron cargar los proveedores:', proveedoresError);
    }

    const perfilCodigo = (empresaData as unknown as { perfiles_empresa?: { codigo: string } | null } | null)
      ?.perfiles_empresa?.codigo;

    setEsFamiliar(perfilCodigo === 'FAMILIAR');

    setClientes(ordenarPersonas((clientesData ?? []) as Persona[]));
    setProveedores(ordenarPersonas((proveedoresData ?? []) as Persona[]));

    setCargando(false);
  }

  const registrosActuales = pestana === 'clientes' ? clientes : proveedores;
  const etiquetas = obtenerEtiquetas(pestana, esFamiliar);

  const registrosVisibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) {
      return registrosActuales;
    }

    return registrosActuales.filter((persona) =>
      [persona.codigo, persona.nombre, persona.telefono, persona.direccion, persona.fecha_alta]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termino)
    );
  }, [registrosActuales, busqueda]);

  function cambiarPestana(nuevaPestana: TipoRecurso) {
    setPestana(nuevaPestana);
    setBusqueda('');
    cancelarFormulario();
  }

  function abrirNuevo() {
    setEditandoId(null);

    setFormulario({
      ...FORMULARIO_VACIO,
      fecha_alta: new Date().toISOString().split('T')[0],
    });

    setError('');
    setMostrarFormulario(true);
  }

  function abrirEdicion(persona: Persona) {
    setEditandoId(persona.id);

    setFormulario({
      nombre: persona.nombre ?? '',
      telefono: persona.telefono ?? '',
      direccion: persona.direccion ?? '',
      fecha_alta: persona.fecha_alta ?? new Date().toISOString().split('T')[0],
    });

    setError('');
    setMostrarFormulario(true);
  }

  function cancelarFormulario() {
    setMostrarFormulario(false);
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
  }

  async function guardarRegistro() {
    if (!empresaId) {
      setError('No se pudo identificar la empresa.');
      return;
    }

    const nombreLimpio = formulario.nombre.trim();

    if (!nombreLimpio) {
      setError('El nombre es obligatorio.');
      return;
    }

    setGuardando(true);
    setError('');

    const tabla = pestana === 'clientes' ? 'clientes' : 'proveedores';

    try {
      if (editandoId) {
        const { error: errorUpdate } = await supabase
          .from(tabla)
          .update({
            nombre: nombreLimpio,
            telefono: formulario.telefono.trim() || null,
            direccion: formulario.direccion.trim() || null,
            fecha_alta: formulario.fecha_alta || null,
          })
          .eq('id', editandoId)
          .eq('empresa_id', empresaId);

        if (errorUpdate) {
          throw errorUpdate;
        }
      } else {
        const registros = pestana === 'clientes' ? clientes : proveedores;
        const codigo = generarProximoCodigo(registros, pestana);

        const { error: errorInsert } = await supabase.from(tabla).insert({
          empresa_id: empresaId,
          nombre: nombreLimpio,
          telefono: formulario.telefono.trim() || null,
          direccion: formulario.direccion.trim() || null,
          codigo,
          fecha_alta: formulario.fecha_alta || null,
        });

        if (errorInsert) {
          throw errorInsert;
        }
      }

      await cargarDatos();
      cancelarFormulario();
    } catch (errorGuardar) {
      console.error('Error guardando registro:', errorGuardar);

      setError(editandoId ? 'No se pudo actualizar el registro.' : 'No se pudo crear el registro.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={fondo}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* =================================================
            ENCABEZADO
        ================================================== */}

        <header style={encabezado}>
          <Link href="/" style={volver}>
            ← Volver a Mi Negocio
          </Link>

          <div style={eyebrow}>GESTIÓN FINANCIERA</div>

          <h1 style={{ margin: 0, fontSize: 32 }}>Recursos Humanos</h1>

          <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
            {esFamiliar
              ? 'Administrá quién te paga y a quién le pagás.'
              : 'Administrá clientes y proveedores de tu negocio.'}
          </p>
        </header>

        {/* =================================================
            CONTENIDO
        ================================================== */}

        <main style={panel}>
          {/* =================================================
              PESTAÑAS
          ================================================== */}

          <div
            style={{
              display: 'flex',
              gap: 10,
              borderBottom: '1px solid #e5e7eb',
              marginBottom: 22,
            }}
          >
            <button type="button" onClick={() => cambiarPestana('clientes')} style={tabStyle(pestana === 'clientes')}>
              {obtenerEtiquetas('clientes', esFamiliar).emoji} {obtenerEtiquetas('clientes', esFamiliar).plural}
            </button>

            <button
              type="button"
              onClick={() => cambiarPestana('proveedores')}
              style={tabStyle(pestana === 'proveedores')}
            >
              {obtenerEtiquetas('proveedores', esFamiliar).emoji} {obtenerEtiquetas('proveedores', esFamiliar).plural}
            </button>
          </div>

          {/* =================================================
              BARRA SUPERIOR
          ================================================== */}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: COLORES.azul, fontSize: 21 }}>{etiquetas.plural}</h2>

              <p style={{ margin: '4px 0 0', color: COLORES.gris, fontSize: 12 }}>
                {registrosActuales.length} {registrosActuales.length === 1 ? 'registro' : 'registros'}
              </p>
            </div>

            <button type="button" onClick={abrirNuevo} style={botonNuevo}>
              + {etiquetas.femenino ? 'Nueva' : 'Nuevo'} {etiquetas.singular}
            </button>
          </div>

          {/* =================================================
              BUSCADOR
          ================================================== */}

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código, nombre, teléfono o dirección..."
            style={inputBusqueda}
          />

          {/* =================================================
              MENSAJE DE ERROR
          ================================================== */}

          {error && <div style={errorStyle}>{error}</div>}

          {/* =================================================
              FORMULARIO
          ================================================== */}

          {mostrarFormulario && (
            <section style={formularioPanel}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div>
                  <div style={formularioEyebrow}>{editandoId ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO'}</div>

                  <h3 style={{ margin: 0, color: COLORES.azul, fontSize: 20 }}>
                    {editandoId ? `Editar ${etiquetas.singular}` : `Agregar ${etiquetas.singular}`}
                  </h3>
                </div>

                <button type="button" onClick={cancelarFormulario} style={cerrarFormulario}>
                  ×
                </button>
              </div>

              <div style={formGrid}>
                <div style={campo}>
                  <label style={label}>Nombre *</label>

                  <input
                    value={formulario.nombre}
                    onChange={(e) => setFormulario((actual) => ({ ...actual, nombre: e.target.value }))}
                    placeholder="Nombre o razón social"
                    style={inputFormulario}
                  />
                </div>

                <div style={campo}>
                  <label style={label}>Teléfono</label>

                  <input
                    value={formulario.telefono}
                    onChange={(e) => setFormulario((actual) => ({ ...actual, telefono: e.target.value }))}
                    placeholder="Teléfono"
                    style={inputFormulario}
                  />
                </div>

                <div style={{ ...campo, gridColumn: 'span 2' }}>
                  <label style={label}>Dirección</label>

                  <input
                    value={formulario.direccion}
                    onChange={(e) => setFormulario((actual) => ({ ...actual, direccion: e.target.value }))}
                    placeholder="Dirección"
                    style={inputFormulario}
                  />
                </div>

                <div style={campo}>
                  <label style={label}>Fecha de alta</label>

                  <input
                    type="date"
                    value={formulario.fecha_alta}
                    onChange={(e) => setFormulario((actual) => ({ ...actual, fecha_alta: e.target.value }))}
                    style={inputFormulario}
                  />
                </div>

                {!editandoId && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      color: COLORES.gris,
                      fontSize: 12,
                      paddingBottom: 12,
                    }}
                  >
                    El código se genera automáticamente.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={cancelarFormulario} style={botonSecundario} disabled={guardando}>
                  Cancelar
                </button>

                <button type="button" onClick={guardarRegistro} style={botonGuardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear registro'}
                </button>
              </div>
            </section>
          )}

          {/* =================================================
              TABLA
          ================================================== */}

          {cargando ? (
            <div style={cargandoStyle}>Cargando registros...</div>
          ) : (
            <div style={tablaContenedor}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={cabeceraFila}>
                    <Th> Código </Th>
                    <Th> Nombre </Th>
                    <Th> Teléfono </Th>
                    <Th> Dirección </Th>
                    <Th> Fecha alta </Th>
                    <Th align="right"> Acciones </Th>
                  </tr>
                </thead>

                <tbody>
                  {registrosVisibles.map((persona) => (
                    <tr key={persona.id} style={filaStyle}>
                      <Td>
                        <strong style={{ color: COLORES.azul }}>{persona.codigo || '—'}</strong>
                      </Td>

                      <Td>{persona.nombre}</Td>

                      <Td>{persona.telefono || '—'}</Td>

                      <Td>{persona.direccion || '—'}</Td>

                      <Td>{formatearFecha(persona.fecha_alta)}</Td>

                      <Td align="right">
                        <button type="button" onClick={() => abrirEdicion(persona)} style={botonEditar}>
                          Editar
                        </button>
                      </Td>
                    </tr>
                  ))}

                  {!registrosVisibles.length && (
                    <tr>
                      <td colSpan={6} style={vacioStyle}>
                        {busqueda.trim()
                          ? 'No se encontraron registros con esa búsqueda.'
                          : `Todavía no hay ${etiquetas.plural.toLowerCase()} ${etiquetas.femenino ? 'registradas' : 'registrados'}.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ==========================================================
   ORDENAMIENTO
========================================================== */

function ordenarPersonas(registros: Persona[]): Persona[] {
  return registros.slice().sort((a, b) => {
    const numeroA = extraerNumeroCodigo(a.codigo);
    const numeroB = extraerNumeroCodigo(b.codigo);

    if (numeroA !== numeroB) {
      return numeroA - numeroB;
    }

    return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
  });
}

/* ==========================================================
   GENERACIÓN DE CÓDIGO
========================================================== */

function generarProximoCodigo(registros: Persona[], tipo: TipoRecurso): string {
  let maximo = 0;

  for (const registro of registros) {
    const numero = extraerNumeroCodigo(registro.codigo);

    if (numero > maximo) {
      maximo = numero;
    }
  }

  const siguiente = maximo + 1;
  const numeroFormateado = String(siguiente).padStart(5, '0');

  return tipo === 'clientes' ? `CLI-${numeroFormateado}` : `PROVE-${numeroFormateado}`;
}

function extraerNumeroCodigo(codigo: string | null): number {
  if (!codigo) {
    return 0;
  }

  const coincidencia = codigo.match(/\d+/);

  if (!coincidencia) {
    return 0;
  }

  return Number(coincidencia[0]);
}

/* ==========================================================
   FECHA
========================================================== */

function formatearFecha(fecha: string | null): string {
  if (!fecha) {
    return '—';
  }

  const partes = fecha.split('-');

  if (partes.length !== 3) {
    return fecha;
  }

  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR');
}

/* ==========================================================
   TAB
========================================================== */

function tabStyle(activa: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    padding: '12px 18px',
    color: activa ? COLORES.verde : COLORES.gris,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    borderBottom: activa ? `3px solid ${COLORES.verde}` : '3px solid transparent',
    marginBottom: -1,
  };
}

/* ==========================================================
   TABLA
========================================================== */

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      style={{
        padding: '12px 14px',
        color: '#374151',
        fontSize: 12,
        textAlign: align,
        whiteSpace: 'nowrap',
        fontWeight: 800,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td
      style={{
        padding: '12px 14px',
        fontSize: 13,
        textAlign: align,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  );
}

/* ==========================================================
   ESTILOS
========================================================== */

const fondo: React.CSSProperties = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top left, #e7f1ed 0%, transparent 34%), #f4f7f8',
  padding: '28px 24px 48px',
};

const encabezado: React.CSSProperties = {
  background: 'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
  borderRadius: 24,
  padding: '28px 34px',
  color: COLORES.blanco,
  marginBottom: 24,
  boxShadow: '0 18px 40px rgba(20,42,71,0.16)',
};

const volver: React.CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: 18,
};

const eyebrow: React.CSSProperties = {
  color: '#86efac',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.4,
  marginBottom: 8,
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 26,
  boxShadow: '0 14px 36px rgba(31,58,95,0.10)',
  overflow: 'hidden',
};

const inputBusqueda: React.CSSProperties = {
  width: '100%',
  maxWidth: 500,
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid #d6dee5',
  background: '#fbfcfd',
  marginBottom: 18,
  boxSizing: 'border-box',
};

const botonNuevo: React.CSSProperties = {
  background: COLORES.verde,
  color: COLORES.blanco,
  border: 'none',
  borderRadius: 12,
  padding: '11px 16px',
  cursor: 'pointer',
  fontWeight: 800,
  boxShadow: '0 8px 20px rgba(46,139,87,0.20)',
};

const formularioPanel: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 20,
  marginBottom: 20,
};

const formularioEyebrow: React.CSSProperties = {
  color: COLORES.verde,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1.3,
  marginBottom: 5,
};

const cerrarFormulario: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: COLORES.blanco,
  color: COLORES.gris,
  fontSize: 22,
  cursor: 'pointer',
  lineHeight: 1,
};

const formGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
};

const campo: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLORES.azul,
  marginBottom: 6,
};

const inputFormulario: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid #d6dee5',
  background: COLORES.blanco,
  color: COLORES.azul,
  fontSize: 13,
};

const botonSecundario: React.CSSProperties = {
  background: COLORES.blanco,
  color: COLORES.azul,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '10px 16px',
  cursor: 'pointer',
  fontWeight: 700,
};

const botonGuardar: React.CSSProperties = {
  background: COLORES.azul,
  color: COLORES.blanco,
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  cursor: 'pointer',
  fontWeight: 800,
};

const botonEditar: React.CSSProperties = {
  background: '#eef3f7',
  color: COLORES.azul,
  border: '1px solid #d5dde5',
  borderRadius: 8,
  padding: '7px 11px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
};

const errorStyle: React.CSSProperties = {
  background: '#fef2f2',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 12,
  padding: '11px 14px',
  marginBottom: 18,
  fontSize: 13,
};

const cargandoStyle: React.CSSProperties = {
  padding: 30,
  textAlign: 'center',
  color: COLORES.gris,
};

const tablaContenedor: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
};

const cabeceraFila: React.CSSProperties = {
  background: '#f1f5f9',
  textAlign: 'left',
};

const filaStyle: React.CSSProperties = {
  borderTop: '1px solid #e5e7eb',
};

const vacioStyle: React.CSSProperties = {
  padding: 30,
  textAlign: 'center',
  color: COLORES.gris,
};
