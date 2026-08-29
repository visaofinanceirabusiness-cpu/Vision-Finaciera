'use client';

// CONTABILIDAD
//
// Junta en una sola pantalla, con pestañas (igual que Recursos Humanos
// con Clientes/Proveedores, y Mercadería con Saldo/Movimientos), las
// tres herramientas contables:
//
//   - Central de Lanzamientos: formulario para cargar operaciones.
//   - Registro de Operaciones: listado de lo ya cargado, con baja.
//   - Libro Diario: vista contable unificada (Debe/Haber) agrupada
//     por operación.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  registrarOperacion,
  eliminarOperacion,
  LineaOperacion,
} from '@/lib/motor';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

const SABIO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/SABIO.png';

const LOGO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/Vision%20financiera.jpeg';

type Pestana = 'lanzamientos' | 'registros' | 'libro';

export default function ContabilidadPage() {
  const [pestana, setPestana] = useState<Pestana>('lanzamientos');
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    async function cargarPerfil() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('es_admin_plataforma')
        .eq('id', userData.user.id)
        .maybeSingle();

      setEsAdmin(Boolean(perfil?.es_admin_plataforma));
    }

    cargarPerfil();
  }, []);

  return (
    <div style={fondo}>
      <div style={{ maxWidth: 1450, margin: '0 auto' }}>
        {/* =================================================
            ENCABEZADO
        ================================================== */}

        <header style={encabezado}>
          <Link href="/" style={volver}>
            ← Volver a Mi Negocio
          </Link>

          <div style={eyebrow}>GESTIÓN FINANCIERA</div>

          <h1 style={{ margin: 0, fontSize: 32 }}>Contabilidad</h1>

          <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
            Cargá, consultá y revisá contablemente las operaciones de tu negocio.
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
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setPestana('lanzamientos')}
              style={tabStyle(pestana === 'lanzamientos')}
            >
              🚀 Central de Lanzamientos
            </button>

            {esAdmin && (
              <button
                type="button"
                onClick={() => setPestana('registros')}
                style={tabStyle(pestana === 'registros')}
              >
                📋 Registro de Operaciones
              </button>
            )}

            <button
              type="button"
              onClick={() => setPestana('libro')}
              style={tabStyle(pestana === 'libro')}
            >
              📖 Libro Diario
            </button>
          </div>

          {pestana === 'lanzamientos' && <CentralDeLanzamientosTab />}
          {pestana === 'registros' && <RegistroOperacionesTab />}
          {pestana === 'libro' && <LibroDiarioTab />}
        </main>
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA 1 · CENTRAL DE LANZAMIENTOS
========================================================== */

type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  proveedor_id: string | null;
};

function CentralDeLanzamientosTab() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [cargandoInicial, setCargandoInicial] = useState(true);

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));

  const [operaciones, setOperaciones] = useState<string[]>([]);
  const [operacion, setOperacion] = useState('');

  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoria, setCategoria] = useState('');

  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [formaPago, setFormaPago] = useState('');

  const [historico, setHistorico] = useState('');
  const [clienteProveedor, setClienteProveedor] = useState('');

  const [contactos, setContactos] = useState<string[]>([]);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [saldoPorProducto, setSaldoPorProducto] = useState<Record<string, number>>({});
  const [nombreProveedorPorId, setNombreProveedorPorId] = useState<Record<string, string>>({});

  const [lineas, setLineas] = useState<LineaOperacion[]>([
    { producto: '', cantidad: 0, monto: 0 },
  ]);

  const [mensajeSabio, setMensajeSabio] = useState('Elegí una operación para empezar.');

  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const operacionesConProducto =
    ['COMPRA', 'VENTA', 'PERDIDA'].includes(operacion) ||
    (operacion === 'INVERSION' && formaPago === 'Mercadería');

  const etiquetaRelacion = ['INVERSION', 'PERDIDA'].includes(operacion)
    ? 'Socia'
    : operacion === 'COMPRA' || operacion === 'PAGO'
      ? 'Proveedor'
      : operacion === 'VENTA' || operacion === 'COBRO'
        ? 'Cliente'
        : 'Cliente / Proveedor';

  useEffect(() => {
    async function cargar() {
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
        setError('Tu usuario todavía no tiene una empresa asignada.');
        setCargandoInicial(false);
        return;
      }

      setEmpresaId(perfil.empresa_id);

      const { data: ops } = await supabase
        .from('operaciones')
        .select('nombre')
        .eq('empresa_id', perfil.empresa_id)
        .eq('activo', true);

      setOperaciones((ops ?? []).map((o) => o.nombre));

      const { data: prods } = await supabase
        .from('productos')
        .select('id, nombre, categoria, proveedor_id')
        .eq('empresa_id', perfil.empresa_id);

      const { data: saldos } = await supabase
        .from('saldo_stock')
        .select('producto_id, saldo')
        .eq('empresa_id', perfil.empresa_id);

      const { data: proveedoresData } = await supabase
        .from('proveedores')
        .select('id, nombre')
        .eq('empresa_id', perfil.empresa_id);

      setSaldoPorProducto(
        Object.fromEntries((saldos ?? []).map((saldo) => [saldo.producto_id, Number(saldo.saldo ?? 0)]))
      );

      setNombreProveedorPorId(
        Object.fromEntries((proveedoresData ?? []).map((proveedor) => [proveedor.id, proveedor.nombre]))
      );

      setProductos(prods ?? []);
      setCargandoInicial(false);
    }

    cargar();
  }, [router]);

  useEffect(() => {
    if (!empresaId || !operacion) {
      setCategorias([]);
      return;
    }

    async function cargarCategorias() {
      const { data, error: errorCategorias } = await supabase
        .from('matriz_operaciones')
        .select('categoria')
        .eq('empresa_id', empresaId)
        .eq('operacion', operacion);

      if (errorCategorias) {
        console.error('ERROR CARGANDO CATEGORÍAS:', errorCategorias);
        setError(`No se pudieron cargar las categorías: ${errorCategorias.message}`);
        return;
      }

      const unicas = Array.from(new Set((data ?? []).map((f) => f.categoria).filter(Boolean))) as string[];

      setCategorias(unicas);
      setCategoria('');
      setFormaPago('');
      setFormasPago([]);

      setError('');
    }

    cargarCategorias();

    setMensajeSabio(`Elegí la categoría para "${operacion}".`);
  }, [empresaId, operacion]);

  useEffect(() => {
    if (!empresaId || !operacion || !categoria) {
      setFormasPago([]);
      return;
    }

    async function cargarFormasPago() {
      const { data, error: errorFormas } = await supabase
        .from('matriz_operaciones')
        .select('forma_pago')
        .eq('empresa_id', empresaId)
        .eq('operacion', operacion)
        .eq('categoria', categoria);

      if (errorFormas) {
        console.error('ERROR CARGANDO FORMAS DE PAGO:', errorFormas);
        setError(`No se pudieron cargar las formas de pago: ${errorFormas.message}`);
        return;
      }

      const unicas = Array.from(new Set((data ?? []).map((f) => f.forma_pago).filter(Boolean))) as string[];

      setFormasPago(unicas);
      setFormaPago('');

      setError('');
    }

    cargarFormasPago();
  }, [empresaId, operacion, categoria]);

  useEffect(() => {
    if (!empresaId || !operacion) {
      setContactos([]);
      setClienteProveedor('');
      return;
    }

    async function cargarContactos() {
      const esProveedor = operacion === 'COMPRA' || operacion === 'PAGO';
      const esCliente = operacion === 'VENTA' || operacion === 'COBRO';

      if (operacion === 'INVERSION' || operacion === 'EXTRACCION' || operacion === 'PERDIDA') {
        const { data } = await supabase.from('perfiles').select('nombre').eq('empresa_id', empresaId);

        setContactos(Array.from(new Set((data ?? []).map((p) => p.nombre).filter(Boolean))));
      } else if (esProveedor || esCliente) {
        const tabla = esProveedor ? 'proveedores' : 'clientes';

        const { data } = await supabase.from(tabla).select('nombre').eq('empresa_id', empresaId);

        setContactos(Array.from(new Set((data ?? []).map((contacto) => contacto.nombre).filter(Boolean))));
      } else {
        setContactos([]);
      }

      setClienteProveedor('');
    }

    cargarContactos();
  }, [empresaId, operacion]);

  function actualizarLinea(indice: number, campo: keyof LineaOperacion, valor: string) {
    setLineas((prev) =>
      prev.map((linea, i) =>
        i === indice
          ? { ...linea, [campo]: campo === 'producto' ? valor : Number(valor) }
          : linea
      )
    );

    // Al elegir un producto en una COMPRA, completamos el Proveedor
    // con el que ese producto tiene asignado en Mercadería. Si el
    // producto no tiene proveedor cargado, dejamos el campo como
    // estaba para no bloquear la carga.
    if (campo === 'producto' && operacion === 'COMPRA' && valor) {
      const productoElegido = productos.find((p) => p.id === valor);
      const nombreProveedor = productoElegido?.proveedor_id
        ? nombreProveedorPorId[productoElegido.proveedor_id]
        : undefined;

      if (nombreProveedor) {
        setClienteProveedor(nombreProveedor);
      }
    }
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { producto: '', cantidad: 0, monto: 0 }]);
  }

  const total = lineas.reduce((s, l) => s + l.cantidad * l.monto, 0);

  const esSalidaStock = operacion === 'VENTA' || operacion === 'PERDIDA';

  const stockInsuficiente =
    esSalidaStock &&
    lineas.some((linea) => linea.producto && linea.cantidad > (saldoPorProducto[linea.producto] ?? 0));

  const lineasCompletas =
    lineas.length > 0 &&
    lineas.every((linea) => linea.producto.trim() && linea.cantidad > 0 && linea.monto > 0);

  const camposCompletos = Boolean(
    fecha &&
      operacion &&
      categoria &&
      formaPago &&
      historico.trim() &&
      clienteProveedor.trim() &&
      lineasCompletas &&
      !stockInsuficiente
  );

  async function handleRegistrar() {
    if (!empresaId) return;

    setError('');
    setGuardando(true);

    try {
      const formulario = {
        fecha: fecha.trim(),
        operacion: operacion.trim(),
        categoria: categoria.trim(),
        formaPago: formaPago.trim(),
        historico: historico.trim(),
        clienteProveedor: clienteProveedor.trim(),
        lineas: lineas.map((linea) => ({
          producto: linea.producto.trim(),
          cantidad: Number(linea.cantidad),
          monto: Number(linea.monto),
        })),
      };

      await registrarOperacion(empresaId, formulario);

      setMensajeSabio('¡Operación registrada con éxito!');

      setOperacion('');
      setCategoria('');
      setFormaPago('');
      setHistorico('');
      setClienteProveedor('');

      setLineas([{ producto: '', cantidad: 0, monto: 0 }]);
    } catch (e: unknown) {
      console.error('ERROR REGISTRANDO OPERACIÓN:', e);

      if (e instanceof Error) {
        setError(e.message);
      } else if (typeof e === 'object' && e !== null) {
        const errorSupabase = e as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

        const mensaje = [
          errorSupabase.message,
          errorSupabase.details,
          errorSupabase.hint,
          errorSupabase.code ? `Código: ${errorSupabase.code}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        setError(mensaje || 'No se pudo registrar la operación.');
      } else {
        setError('No se pudo registrar la operación.');
      }
    } finally {
      setGuardando(false);
    }
  }

  if (cargandoInicial) {
    return <p style={{ padding: 24 }}>Cargando...</p>;
  }

  return (
    <div>
      <div style={panelTitulo}>
        <div>
          <p style={eyebrowVerde}>NUEVO REGISTRO</p>

          <h2 style={{ margin: 0, color: COLORES.azul, fontSize: 21 }}>Cargá una operación</h2>
        </div>

        <span style={estadoActivo}>Sistema activo</span>
      </div>

      <div style={grid2}>
        <Campo label="Fecha">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={campoInput}
          />
        </Campo>

        <Campo label="Operación">
          <select value={operacion} onChange={(e) => setOperacion(e.target.value)} style={campoInput}>
            <option value="">Seleccionar...</option>

            {operaciones.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Categoría">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            disabled={!operacion}
            style={campoInput}
          >
            <option value="">Seleccionar...</option>

            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Forma de Pago">
          <select
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value)}
            disabled={!categoria}
            style={campoInput}
          >
            <option value="">Seleccionar...</option>

            {formasPago.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label="Histórico">
        <input
          type="text"
          value={historico}
          onChange={(e) => setHistorico(e.target.value)}
          style={campoInput}
        />
      </Campo>

      <Campo label={etiquetaRelacion}>
        <select
          value={clienteProveedor}
          onChange={(e) => setClienteProveedor(e.target.value)}
          disabled={!operacion || contactos.length === 0}
          style={campoInput}
        >
          <option value="">Seleccionar...</option>

          {contactos.map((contacto) => (
            <option key={contacto} value={contacto}>
              {contacto}
            </option>
          ))}
        </select>
      </Campo>

      {operacion && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: COLORES.azul, marginBottom: 10 }}>
            Detalle de valores
          </p>

          {lineas.map((linea, i) => (
            <div key={i} style={filaProducto}>
              {operacionesConProducto ? (
                <select
                  value={linea.producto}
                  onChange={(e) => actualizarLinea(i, 'producto', e.target.value)}
                  style={{ ...campoInput, flex: 2 }}
                >
                  <option value="">Producto...</option>

                  {productos
                    .filter((p) => (p.categoria ?? '').toUpperCase() === categoria.toUpperCase())
                    .map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={esSalidaStock && (saldoPorProducto[p.id] ?? 0) <= 0}
                      >
                        {p.nombre}
                        {esSalidaStock ? ` (stock: ${saldoPorProducto[p.id] ?? 0})` : ''}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Descripción"
                  value={linea.producto}
                  onChange={(e) => actualizarLinea(i, 'producto', e.target.value)}
                  style={{ ...campoInput, flex: 2 }}
                />
              )}

              <input
                type="number"
                placeholder="Cant."
                value={linea.cantidad || ''}
                onChange={(e) => actualizarLinea(i, 'cantidad', e.target.value)}
                style={{ ...campoInput, flex: 1 }}
              />

              <input
                type="number"
                placeholder="Monto"
                value={linea.monto || ''}
                onChange={(e) => actualizarLinea(i, 'monto', e.target.value)}
                style={{ ...campoInput, flex: 1 }}
              />
            </div>
          ))}

          <button type="button" onClick={agregarLinea} style={botonSecundario}>
            + Agregar línea
          </button>
        </div>
      )}

      <div style={totalStyle}>
        <span>Total</span>
        <span>R$ {total.toFixed(2)}</span>
      </div>

      <div style={validacionStyle}>
        <span>{camposCompletos ? '✓ Todos los campos están completos' : '⚠ Faltan campos por completar'}</span>

        <span>
          {lineas.length} renglón{lineas.length === 1 ? '' : 'es'}
        </span>
      </div>

      {stockInsuficiente && (
        <p style={{ color: '#dc2626', fontSize: 13, margin: '10px 0 0' }}>
          No se puede registrar: la cantidad solicitada supera el stock disponible.
        </p>
      )}

      <p style={{ color: COLORES.verde, fontSize: 13, margin: '14px 0 0' }}>{mensajeSabio}</p>

      {error && (
        <div
          style={{
            color: '#dc2626',
            fontSize: 13,
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}

      <div style={accionFinal}>
        <div style={marcaVision}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="Visão Financeira" style={visionLogo} />

          <span style={{ color: COLORES.azul, fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>
            Visão
            <br />
            Financeira
          </span>
        </div>

        <div style={sabioMarcaChica}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SABIO_URL} alt="Sabio" style={sabioLogoChico} />
        </div>

        <button
          onClick={handleRegistrar}
          disabled={guardando || !camposCompletos}
          style={{ ...botonPrincipal, flex: 1 }}
        >
          {guardando ? 'Registrando...' : 'Registrar Operación'}
        </button>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 6 }}>
        {label}
      </label>

      {children}
    </div>
  );
}

/* ==========================================================
   PESTAÑA 2 · REGISTRO DE OPERACIONES
========================================================== */

type Registro = {
  id: string;
  id_operacion: string;
  fecha: string;
  operacion: string;
  categoria: string;
  forma_pago: string;
  total: number;
  historico: string | null;
  cliente_proveedor: string | null;
  estado: string | null;
};

function RegistroOperacionesTab() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [filas, setFilas] = useState<Registro[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [validando, setValidando] = useState<string | null>(null);
  const [error, setError] = useState('');

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

    const confirmado = window.confirm(
      `¿Eliminar la operación ${idOperacion}?\n\n` +
        'Esto borra también todos los movimientos de stock que generó. ' +
        'No se puede deshacer.'
    );

    if (!confirmado) return;

    setError('');
    setBorrando(idOperacion);

    try {
      await eliminarOperacion(empresaId, idOperacion);
      await cargar(empresaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la operación.');
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
      setError(e instanceof Error ? e.message : 'No se pudo validar la operación.');
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

  return (
    <div>
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar operación, categoría o persona..."
        style={{ ...campoInput, maxWidth: 460, marginBottom: 18 }}
      />

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {cargando ? (
        <p>Cargando registros...</p>
      ) : (
        <div style={tablaContenedor}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={cabeceraFila}>
                <Th>ID Registro</Th>
                <Th>Fecha</Th>
                <Th>Operación</Th>
                <Th>Categoría</Th>
                <Th>Forma de pago</Th>
                <Th>Histórico</Th>
                <Th>Cliente / Proveedor</Th>
                <Th align="right">Total</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </thead>

            <tbody>
              {visibles.map((fila) => (
                <tr key={fila.id_operacion} style={filaStyle}>
                  <Td>{fila.id_operacion}</Td>
                  <Td>{new Date(`${fila.fecha}T12:00:00`).toLocaleDateString('es-AR')}</Td>
                  <Td>{fila.operacion}</Td>
                  <Td>{fila.categoria}</Td>
                  <Td>{fila.forma_pago}</Td>
                  <Td style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 220 }}>
                    {fila.historico || '—'}
                  </Td>
                  <Td>{fila.cliente_proveedor || '—'}</Td>
                  <Td align="right">R$ {Number(fila.total).toFixed(2)}</Td>

                  <Td>
                    <Estado estado={fila.estado} />
                  </Td>

                  <Td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {(fila.estado || 'PENDIENTE').toUpperCase() !== 'VALIDADO' && (
                        <button
                          onClick={() => handleValidar(fila.id_operacion)}
                          disabled={validando === fila.id_operacion}
                          style={botonValidar}
                          title="Marcar operación como validada"
                        >
                          {validando === fila.id_operacion ? '...' : 'Validado'}
                        </button>
                      )}

                      <button
                        onClick={() => handleEliminar(fila.id_operacion)}
                        disabled={borrando === fila.id_operacion}
                        style={botonEliminar}
                        title="Eliminar operación y sus movimientos de stock"
                      >
                        {borrando === fila.id_operacion ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}

              {!visibles.length && (
                <tr>
                  <td colSpan={10} style={vacioStyle}>
                    No se encontraron registros.
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

/* ==========================================================
   PESTAÑA 3 · LIBRO DIARIO
========================================================== */

type MovimientoDiario = {
  empresa_id: string;
  id_operacion: string;
  fecha: string;
  operacion: string;
  historico: string | null;
  cuenta_debito: string | null;
  cuenta_credito: string | null;
  importe: number;
  estado: string | null;
  tipo_registro: 'OPERACION' | 'AUTOMATICO';
};

type GrupoOperacion = {
  id_operacion: string;
  fecha: string;
  filas: MovimientoDiario[];
};

function LibroDiarioTab() {
  const router = useRouter();

  const [filas, setFilas] = useState<MovimientoDiario[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar(empresaId: string) {
    setError('');

    const [
      { data: operaciones, error: errorOperaciones },
      { data: automaticos, error: errorAutomaticos },
    ] = await Promise.all([
      supabase
        .from('registro_operaciones')
        .select(
          `
          empresa_id,
          id_operacion,
          fecha,
          operacion,
          historico,
          cuenta_debito,
          cuenta_credito,
          total,
          estado
          `
        )
        .eq('empresa_id', empresaId),

      supabase
        .from('registros_automaticos')
        .select(
          `
          empresa_id,
          id_operacion,
          fecha,
          tipo_registro,
          historico,
          cuenta_debito,
          cuenta_credito,
          importe,
          estado
          `
        )
        .eq('empresa_id', empresaId),
    ]);

    if (errorOperaciones) {
      setError(`No se pudieron cargar las operaciones: ${errorOperaciones.message}`);
      setFilas([]);
      return;
    }

    if (errorAutomaticos) {
      setError(`No se pudieron cargar los registros automáticos: ${errorAutomaticos.message}`);
      setFilas([]);
      return;
    }

    const filasOperacion: MovimientoDiario[] = (operaciones ?? []).map((fila) => ({
      empresa_id: fila.empresa_id,
      id_operacion: fila.id_operacion,
      fecha: fila.fecha,
      operacion: fila.operacion,
      historico: fila.historico,
      cuenta_debito: fila.cuenta_debito,
      cuenta_credito: fila.cuenta_credito,
      importe: Number(fila.total ?? 0),
      estado: fila.estado,
      tipo_registro: 'OPERACION',
    }));

    const filasAutomaticas: MovimientoDiario[] = (automaticos ?? []).map((fila) => ({
      empresa_id: fila.empresa_id,
      id_operacion: fila.id_operacion,
      fecha: fila.fecha,
      operacion: fila.tipo_registro,
      historico: fila.historico,
      cuenta_debito: fila.cuenta_debito,
      cuenta_credito: fila.cuenta_credito,
      importe: Number(fila.importe ?? 0),
      estado: fila.estado,
      tipo_registro: 'AUTOMATICO',
    }));

    const combinadas = [...filasOperacion, ...filasAutomaticas];

    combinadas.sort((a, b) => {
      const numeroA = parseInt(String(a.id_operacion).replace('OP-', ''), 10) || 0;
      const numeroB = parseInt(String(b.id_operacion).replace('OP-', ''), 10) || 0;

      if (numeroA !== numeroB) {
        return numeroB - numeroA;
      }

      if (a.tipo_registro !== b.tipo_registro) {
        return a.tipo_registro === 'OPERACION' ? -1 : 1;
      }

      return 0;
    });

    setFilas(combinadas);
  }

  useEffect(() => {
    async function iniciar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfil?.empresa_id) {
        setError('No se pudo identificar la empresa.');
        setCargando(false);
        return;
      }

      await cargar(perfil.empresa_id);
      setCargando(false);
    }

    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) {
      return filas;
    }

    return filas.filter((fila) =>
      [fila.id_operacion, fila.operacion, fila.historico, fila.cuenta_debito, fila.cuenta_credito, fila.estado, fila.tipo_registro]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(texto)
    );
  }, [filas, busqueda]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, GrupoOperacion>();

    for (const fila of visibles) {
      const existente = mapa.get(fila.id_operacion);

      if (existente) {
        existente.filas.push(fila);
      } else {
        mapa.set(fila.id_operacion, {
          id_operacion: fila.id_operacion,
          fecha: fila.fecha,
          filas: [fila],
        });
      }
    }

    return Array.from(mapa.values());
  }, [visibles]);

  const totalAsientos = visibles.length;
  const totalImportes = visibles.reduce((suma, fila) => suma + Number(fila.importe ?? 0), 0);
  const totalOperaciones = grupos.length;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar ID, cuenta, histórico..."
          style={{ ...campoInput, maxWidth: 460 }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Resumen titulo="Operaciones" valor={String(totalOperaciones)} />
          <Resumen titulo="Asientos" valor={String(totalAsientos)} />
          <Resumen titulo="Importes" valor={`R$ ${totalImportes.toFixed(2)}`} />
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {cargando ? (
        <p>Cargando Libro Diario...</p>
      ) : (
        <div>
          {!grupos.length ? (
            <div style={vacioOperacion}>No se encontraron movimientos contables.</div>
          ) : (
            grupos.map((grupo) => <GrupoOperacionCard key={grupo.id_operacion} grupo={grupo} />)
          )}
        </div>
      )}
    </div>
  );
}

function GrupoOperacionCard({ grupo }: { grupo: GrupoOperacion }) {
  const importeGrupo = grupo.filas.reduce((suma, fila) => suma + Number(fila.importe ?? 0), 0);

  return (
    <section
      style={{
        marginBottom: 16,
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          padding: '14px 18px',
          background: 'linear-gradient(90deg, #eff5f9, #f8fafc)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: COLORES.azul }}>{grupo.id_operacion}</span>

          <span style={{ fontSize: 12, color: COLORES.gris }}>
            {new Date(`${grupo.fecha}T12:00:00`).toLocaleDateString('es-AR')}
          </span>

          <span
            style={{
              padding: '5px 9px',
              borderRadius: 999,
              background: '#eaf7ee',
              color: '#247347',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {grupo.filas.length} {grupo.filas.length === 1 ? 'asiento' : 'asientos'}
          </span>
        </div>

        <div style={{ fontSize: 13, color: COLORES.gris }}>
          Importe registrado: <strong style={{ color: COLORES.azul }}>R$ {importeGrupo.toFixed(2)}</strong>
        </div>
      </div>

      <div style={tablaContenedorInterna}>
        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <Th>Tipo</Th>
              <Th>Operación</Th>
              <Th>Histórico</Th>
              <Th>Debe</Th>
              <Th>Haber</Th>
              <Th align="right">Importe</Th>
              <Th>Estado</Th>
            </tr>
          </thead>

          <tbody>
            {grupo.filas.map((fila, indice) => (
              <tr
                key={`${fila.id_operacion}-${fila.tipo_registro}-${indice}`}
                style={{ borderTop: '1px solid #edf1f4' }}
              >
                <Td>
                  <TipoRegistro tipo={fila.tipo_registro} />
                </Td>

                <Td>
                  <strong style={{ color: COLORES.azul }}>{fila.operacion}</strong>
                </Td>

                <Td>{fila.historico || '—'}</Td>

                <Td>
                  <span style={cuentaDebe}>{fila.cuenta_debito || '—'}</span>
                </Td>

                <Td>
                  <span style={cuentaHaber}>{fila.cuenta_credito || '—'}</span>
                </Td>

                <Td align="right">
                  <strong>R$ {Number(fila.importe ?? 0).toFixed(2)}</strong>
                </Td>

                <Td>
                  <Estado estado={fila.estado} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TipoRegistro({ tipo }: { tipo: 'OPERACION' | 'AUTOMATICO' }) {
  const automatico = tipo === 'AUTOMATICO';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: automatico ? '#ede9fe' : '#eaf7ee',
        color: automatico ? '#6d28d9' : '#247347',
      }}
    >
      {automatico ? 'AUTOMÁTICO' : 'OPERACIÓN'}
    </span>
  );
}

function Estado({ estado }: { estado: string | null }) {
  const valor = estado || 'PENDIENTE';
  const validado = valor.toUpperCase() === 'VALIDADO';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: validado ? '#dcfce7' : '#fef3c7',
        color: validado ? '#166534' : '#92400e',
      }}
    >
      {valor}
    </span>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 10, padding: '9px 13px', minWidth: 105 }}>
      <div style={{ fontSize: 10, color: COLORES.gris, marginBottom: 2 }}>{titulo}</div>

      <strong style={{ color: COLORES.azul, fontSize: 14 }}>{valor}</strong>
    </div>
  );
}

/* ==========================================================
   COMPONENTES COMPARTIDOS
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

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
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

function Td({
  children,
  align = 'left',
  style,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: '12px 14px',
        fontSize: 13,
        textAlign: align,
        whiteSpace: 'nowrap',
        ...style,
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

const eyebrowVerde: React.CSSProperties = {
  margin: '0 0 5px',
  color: COLORES.verde,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: 1.3,
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 26,
  boxShadow: '0 14px 36px rgba(31,58,95,0.10)',
  overflow: 'hidden',
};

const panelTitulo: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  paddingBottom: 20,
  marginBottom: 24,
  borderBottom: '1px solid #e7edf1',
  flexWrap: 'wrap',
};

const estadoActivo: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: 999,
  background: '#eaf7ee',
  color: '#247347',
  fontSize: 12,
  fontWeight: 700,
};

const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0 16px',
};

const campoInput: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid #d6dee5',
  background: '#fbfcfd',
  color: '#1f2937',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

const filaProducto: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 8,
  flexWrap: 'wrap',
};

const totalStyle: React.CSSProperties = {
  marginTop: 24,
  padding: '16px 18px',
  display: 'flex',
  justifyContent: 'space-between',
  borderRadius: 14,
  background: 'linear-gradient(90deg, #edf6f0, #f7faf8)',
  color: COLORES.azul,
  fontWeight: 700,
};

const accionFinal: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginTop: 22,
  paddingTop: 22,
  borderTop: '1px solid #e7edf1',
  flexWrap: 'wrap',
};

const marcaVision: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 145,
};

const visionLogo: React.CSSProperties = {
  width: 66,
  height: 66,
  borderRadius: 16,
  objectFit: 'contain',
  mixBlendMode: 'multiply',
  filter: 'drop-shadow(0 5px 8px rgba(31,58,95,0.13))',
};

const sabioMarcaChica: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const sabioLogoChico: React.CSSProperties = {
  width: 72,
  height: 46,
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))',
};

const botonPrincipal: React.CSSProperties = {
  minWidth: 220,
  padding: '14px 18px',
  borderRadius: 11,
  border: 'none',
  background: 'linear-gradient(135deg, #2e8b57, #237044)',
  color: COLORES.blanco,
  boxShadow: '0 8px 16px rgba(46,139,87,0.22)',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

const botonSecundario: React.CSSProperties = {
  padding: '9px 13px',
  borderRadius: 9,
  border: `1px solid ${COLORES.azul}`,
  background: '#f8fafc',
  color: COLORES.azul,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const validacionStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '10px 14px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  borderRadius: 10,
  background: '#f8fafc',
  color: COLORES.gris,
  fontSize: 12,
  fontWeight: 600,
};

const botonValidar: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #bbf7d0',
  background: '#f0fdf4',
  color: '#166534',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const botonEliminar: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#dc2626',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const tablaContenedor: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
};

const tablaContenedorInterna: React.CSSProperties = {
  overflowX: 'auto',
};

const cabeceraFila: React.CSSProperties = {
  background: '#f1f5f9',
  textAlign: 'left',
};

const filaStyle: React.CSSProperties = {
  borderTop: '1px solid #e5e7eb',
};

const vacioStyle: React.CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: COLORES.gris,
};

const vacioOperacion: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: COLORES.gris,
  border: '1px dashed #d6dee5',
  borderRadius: 14,
};

const cuentaDebe: React.CSSProperties = {
  fontWeight: 600,
  color: '#1f3a5f',
};

const cuentaHaber: React.CSSProperties = {
  fontWeight: 600,
  color: '#2e8b57',
};
