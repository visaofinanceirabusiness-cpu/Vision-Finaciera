'use client';

// MERCADERÍA
//
// Junta en una sola pantalla, con pestañas (igual que Recursos Humanos
// con Clientes/Proveedores), las dos herramientas de stock:
//
//   - Saldo Mercadería: catálogo de productos con su saldo, costo
//     promedio y valor de inventario. Desde acá también se dan de alta
//     productos nuevos (igual que se hace con clientes/proveedores).
//   - Movimientos de Mercadería: el historial de entradas y salidas
//     generado por las operaciones. Desde acá también se valida cada
//     movimiento, lo que valida a la vez el registro automático (CMV)
//     que esa operación generó en el Libro Diario.

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

type Pestana = 'saldo' | 'movimientos';

type Categoria = {
  id: string;
  codigo: string;
  nombre: string;
};

type Proveedor = {
  id: string;
  nombre: string;
};

type ProductoCrudo = {
  id: string;
  nombre: string;
  codigo: string | null;
  categoria: string | null;
  categoria_producto_id: string | null;
  proveedor_id: string | null;
  tipo_producto: string | null;
  unidad_medida: string | null;
  fecha_alta: string | null;
};

type ProductoFila = ProductoCrudo & {
  saldo: number;
  costoPromedio: number;
  valorInventario: number;
};

type Movimiento = {
  id: string;
  id_operacion: string | null;
  fecha: string;
  tipo: string;
  categoria: string;
  producto_id: string;
  cantidad: number;
  costo_unitario: number;
  total: number | null;
  historico: string | null;
  estado: string | null;
};

type Formulario = {
  nombre: string;
  categoria_producto_id: string;
  tipo_producto: string;
  unidad_medida: string;
  proveedor_id: string;
  fecha_alta: string;
};

const FORMULARIO_VACIO: Formulario = {
  nombre: '',
  categoria_producto_id: '',
  tipo_producto: '',
  unidad_medida: '',
  proveedor_id: '',
  fecha_alta: new Date().toISOString().split('T')[0],
};

const OPCIONES_TIPO = [
  { value: '', label: 'Sin especificar' },
  { value: 'INSUMO', label: 'Insumo' },
  { value: 'TERMINADO', label: 'Terminado' },
];

const OPCIONES_UNIDAD = [
  { value: '', label: 'Sin especificar' },
  { value: 'UNIDAD', label: 'Unidad' },
  { value: 'KG', label: 'Kg' },
  { value: 'G', label: 'G' },
  { value: 'L', label: 'L' },
  { value: 'ML', label: 'Ml' },
];

export default function MercaderiaPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);

  const [productos, setProductos] = useState<ProductoFila[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [nombresProducto, setNombresProducto] = useState<Record<string, string>>({});
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  const [pestana, setPestana] = useState<Pestana>('saldo');
  const [busqueda, setBusqueda] = useState('');

  const [mostrarConSaldo, setMostrarConSaldo] = useState(true);
  const [mostrarSinSaldo, setMostrarSinSaldo] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [validando, setValidando] = useState<string | null>(null);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
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
      .select('empresa_id, es_admin_plataforma')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (errorPerfil || !perfil?.empresa_id) {
      setError('No se pudo identificar la empresa del usuario.');
      setCargando(false);
      return;
    }

    setEmpresaId(perfil.empresa_id);
    setEsAdmin(Boolean(perfil.es_admin_plataforma));

    const [
      { data: productosData, error: errorProductos },
      { data: saldosData, error: errorSaldos },
      { data: entradasData, error: errorEntradas },
      { data: movimientosData, error: errorMovimientos },
      { data: categoriasData, error: errorCategorias },
      { data: proveedoresData, error: errorProveedores },
    ] = await Promise.all([
      supabase
        .from('productos')
        .select(
          'id, nombre, codigo, categoria, categoria_producto_id, proveedor_id, tipo_producto, unidad_medida, fecha_alta'
        )
        .eq('empresa_id', perfil.empresa_id),

      supabase
        .from('saldo_stock')
        .select('producto_id, saldo')
        .eq('empresa_id', perfil.empresa_id),

      supabase
        .from('movimientos_stock')
        .select('producto_id, cantidad, costo_unitario')
        .eq('empresa_id', perfil.empresa_id)
        .eq('tipo', 'ENTRADA'),

      supabase
        .from('movimientos_stock')
        .select(
          'id, id_operacion, fecha, tipo, categoria, producto_id, cantidad, costo_unitario, total, historico, estado'
        )
        .eq('empresa_id', perfil.empresa_id),

      supabase
        .from('categorias_productos')
        .select('id, codigo, nombre')
        .eq('empresa_id', perfil.empresa_id)
        .eq('activo', true),

      supabase
        .from('proveedores')
        .select('id, nombre')
        .eq('empresa_id', perfil.empresa_id),
    ]);

    if (errorProductos) console.warn('No se pudieron cargar los productos:', errorProductos);
    if (errorSaldos) console.warn('No se pudieron cargar los saldos:', errorSaldos);
    if (errorEntradas) console.warn('No se pudieron cargar las entradas:', errorEntradas);
    if (errorMovimientos) console.warn('No se pudieron cargar los movimientos:', errorMovimientos);
    if (errorCategorias) console.warn('No se pudieron cargar las categorías:', errorCategorias);
    if (errorProveedores) console.warn('No se pudieron cargar los proveedores:', errorProveedores);

    const saldoPorProducto = new Map(
      (saldosData ?? []).map((fila) => [fila.producto_id, Number(fila.saldo ?? 0)])
    );

    const costoPorProducto = new Map<string, { cantidad: number; valor: number }>();

    for (const movimiento of entradasData ?? []) {
      const actual = costoPorProducto.get(movimiento.producto_id) ?? { cantidad: 0, valor: 0 };
      const cantidad = Number(movimiento.cantidad ?? 0);
      actual.cantidad += cantidad;
      actual.valor += cantidad * Number(movimiento.costo_unitario ?? 0);
      costoPorProducto.set(movimiento.producto_id, actual);
    }

    const productosCombinados: ProductoFila[] = ((productosData ?? []) as ProductoCrudo[]).map(
      (producto) => {
        const costo = costoPorProducto.get(producto.id);
        const costoPromedio = costo && costo.cantidad > 0 ? costo.valor / costo.cantidad : 0;
        const saldo = saldoPorProducto.get(producto.id) ?? 0;

        return {
          ...producto,
          saldo,
          costoPromedio,
          valorInventario: saldo * costoPromedio,
        };
      }
    );

    productosCombinados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

    setProductos(productosCombinados);
    setMovimientos((movimientosData ?? []) as Movimiento[]);
    setNombresProducto(
      Object.fromEntries(productosCombinados.map((producto) => [producto.id, producto.nombre]))
    );
    setCategorias((categoriasData ?? []) as Categoria[]);
    setProveedores((proveedoresData ?? []) as Proveedor[]);

    setCargando(false);
  }

  const productosConSaldo = useMemo(
    () => productos.filter((producto) => producto.saldo > 0),
    [productos]
  );

  const productosSinSaldo = useMemo(
    () => productos.filter((producto) => producto.saldo <= 0),
    [productos]
  );

  function filtrarPorBusqueda(lista: ProductoFila[]) {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) {
      return lista;
    }

    return lista.filter((producto) =>
      [producto.codigo, producto.nombre, producto.categoria]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termino)
    );
  }

  const conSaldoVisibles = useMemo(
    () => filtrarPorBusqueda(productosConSaldo),
    [productosConSaldo, busqueda]
  );

  const sinSaldoVisibles = useMemo(
    () => filtrarPorBusqueda(productosSinSaldo),
    [productosSinSaldo, busqueda]
  );

  const movimientosVisibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    const ordenados = movimientos.slice().sort((a, b) => {
      const numeroA = extraerNumero(a.id_operacion);
      const numeroB = extraerNumero(b.id_operacion);

      if (numeroA !== numeroB) {
        return numeroB - numeroA;
      }

      return String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''));
    });

    if (!termino) {
      return ordenados;
    }

    return ordenados.filter((fila) =>
      [fila.id_operacion, fila.tipo, fila.categoria, fila.historico, nombresProducto[fila.producto_id]]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termino)
    );
  }, [movimientos, busqueda, nombresProducto]);

  function cambiarPestana(nueva: Pestana) {
    setPestana(nueva);
    setBusqueda('');
    cancelarFormulario();
  }

  function abrirNuevoProducto() {
    setFormulario({
      ...FORMULARIO_VACIO,
      fecha_alta: new Date().toISOString().split('T')[0],
    });
    setError('');
    setMostrarFormulario(true);
  }

  function cancelarFormulario() {
    setMostrarFormulario(false);
    setFormulario(FORMULARIO_VACIO);
  }

  async function guardarProducto() {
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

    const categoriaElegida = categorias.find(
      (categoria) => categoria.id === formulario.categoria_producto_id
    );

    const codigo = generarProximoCodigoProducto(productos);

    try {
      const { error: errorInsert } = await supabase.from('productos').insert({
        empresa_id: empresaId,
        nombre: nombreLimpio,
        codigo,
        categoria_producto_id: categoriaElegida?.id ?? null,
        categoria: categoriaElegida?.nombre ?? null,
        proveedor_id: formulario.proveedor_id || null,
        tipo_producto: formulario.tipo_producto || null,
        unidad_medida: formulario.unidad_medida || null,
        fecha_alta: formulario.fecha_alta || null,
      });

      if (errorInsert) {
        throw errorInsert;
      }

      await cargarDatos();
      cancelarFormulario();
    } catch (errorGuardar) {
      console.error('Error creando producto:', errorGuardar);
      setError('No se pudo crear el producto.');
    } finally {
      setGuardando(false);
    }
  }

  // Valida a la vez el movimiento de mercadería y el registro
  // automático (CMV) que esa operación generó en el Libro Diario,
  // así los dos quedan sincronizados con un solo clic.
  async function validarMovimiento(idOperacion: string) {
    if (!empresaId) return;

    setError('');
    setValidando(idOperacion);

    try {
      const [{ error: errorMovimiento }, { error: errorAutomatico }] = await Promise.all([
        supabase
          .from('movimientos_stock')
          .update({ estado: 'VALIDADO' })
          .eq('empresa_id', empresaId)
          .eq('id_operacion', idOperacion),

        supabase
          .from('registros_automaticos')
          .update({ estado: 'VALIDADO' })
          .eq('empresa_id', empresaId)
          .eq('id_operacion', idOperacion),
      ]);

      if (errorMovimiento) throw errorMovimiento;
      if (errorAutomatico) throw errorAutomatico;

      await cargarDatos();
    } catch (errorValidar) {
      console.error('Error validando movimiento:', errorValidar);
      setError('No se pudo validar el movimiento.');
    } finally {
      setValidando(null);
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

          <h1 style={{ margin: 0, fontSize: 32 }}>Mercadería</h1>

          <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
            Administrá el saldo de tus productos y consultá los movimientos de mercadería.
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
            <button type="button" onClick={() => cambiarPestana('saldo')} style={tabStyle(pestana === 'saldo')}>
              📦 Saldo Mercadería
            </button>

            <button
              type="button"
              onClick={() => cambiarPestana('movimientos')}
              style={tabStyle(pestana === 'movimientos')}
            >
              🔁 Movimientos de Mercadería
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
              <h2 style={{ margin: 0, color: COLORES.azul, fontSize: 21 }}>
                {pestana === 'saldo' ? 'Saldo Mercadería' : 'Movimientos de Mercadería'}
              </h2>

              <p style={{ margin: '4px 0 0', color: COLORES.gris, fontSize: 12 }}>
                {pestana === 'saldo'
                  ? `${productos.length} ${productos.length === 1 ? 'producto' : 'productos'}`
                  : `${movimientos.length} ${movimientos.length === 1 ? 'movimiento' : 'movimientos'}`}
              </p>
            </div>

            {pestana === 'saldo' && (
              <button type="button" onClick={abrirNuevoProducto} style={botonNuevo}>
                + Nuevo producto
              </button>
            )}
          </div>

          {/* =================================================
              BUSCADOR
          ================================================== */}

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={
              pestana === 'saldo'
                ? 'Buscar código, nombre o categoría...'
                : 'Buscar ID, producto, tipo o categoría...'
            }
            style={inputBusqueda}
          />

          {/* =================================================
              MENSAJE DE ERROR
          ================================================== */}

          {error && <div style={errorStyle}>{error}</div>}

          {/* =================================================
              FORMULARIO NUEVO PRODUCTO
          ================================================== */}

          {pestana === 'saldo' && mostrarFormulario && (
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
                  <div style={formularioEyebrow}>NUEVO REGISTRO</div>

                  <h3 style={{ margin: 0, color: COLORES.azul, fontSize: 20 }}>Agregar producto</h3>
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
                    onChange={(e) =>
                      setFormulario((actual) => ({ ...actual, nombre: e.target.value }))
                    }
                    placeholder="Nombre del producto"
                    style={inputFormulario}
                  />
                </div>

                <div style={campo}>
                  <label style={label}>Categoría</label>

                  <select
                    value={formulario.categoria_producto_id}
                    onChange={(e) =>
                      setFormulario((actual) => ({
                        ...actual,
                        categoria_producto_id: e.target.value,
                      }))
                    }
                    style={inputFormulario}
                  >
                    <option value="">Sin categoría</option>

                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={campo}>
                  <label style={label}>Tipo de producto</label>

                  <select
                    value={formulario.tipo_producto}
                    onChange={(e) =>
                      setFormulario((actual) => ({ ...actual, tipo_producto: e.target.value }))
                    }
                    style={inputFormulario}
                  >
                    {OPCIONES_TIPO.map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={campo}>
                  <label style={label}>Unidad de medida</label>

                  <select
                    value={formulario.unidad_medida}
                    onChange={(e) =>
                      setFormulario((actual) => ({ ...actual, unidad_medida: e.target.value }))
                    }
                    style={inputFormulario}
                  >
                    {OPCIONES_UNIDAD.map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={campo}>
                  <label style={label}>Proveedor</label>

                  <select
                    value={formulario.proveedor_id}
                    onChange={(e) =>
                      setFormulario((actual) => ({ ...actual, proveedor_id: e.target.value }))
                    }
                    style={inputFormulario}
                  >
                    <option value="">Sin proveedor</option>

                    {proveedores.map((proveedor) => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={campo}>
                  <label style={label}>Fecha de alta</label>

                  <input
                    type="date"
                    value={formulario.fecha_alta}
                    onChange={(e) =>
                      setFormulario((actual) => ({ ...actual, fecha_alta: e.target.value }))
                    }
                    style={inputFormulario}
                  />
                </div>

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
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={cancelarFormulario}
                  style={botonSecundario}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={guardarProducto}
                  style={botonGuardar}
                  disabled={guardando}
                >
                  {guardando ? 'Guardando...' : 'Crear producto'}
                </button>
              </div>
            </section>
          )}

          {/* =================================================
              CONTENIDO DE LA PESTAÑA
          ================================================== */}

          {cargando ? (
            <div style={cargandoStyle}>Cargando datos...</div>
          ) : pestana === 'saldo' ? (
            <>
              <SeccionProductos
                titulo="Con saldo"
                emoji="🟢"
                productos={conSaldoVisibles}
                abierta={mostrarConSaldo}
                onToggle={() => setMostrarConSaldo((actual) => !actual)}
                mensajeVacio="No hay productos con saldo disponible."
              />

              <div style={{ height: 14 }} />

              <SeccionProductos
                titulo="Sin saldo"
                emoji="⚪"
                productos={sinSaldoVisibles}
                abierta={mostrarSinSaldo}
                onToggle={() => setMostrarSinSaldo((actual) => !actual)}
                mensajeVacio="No hay productos sin saldo."
              />
            </>
          ) : (
            <div style={tablaContenedorSolo}>
              <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={cabeceraFila}>
                    <Th>ID Registro</Th>
                    <Th>Fecha</Th>
                    <Th>Tipo</Th>
                    <Th>Producto</Th>
                    <Th>Categoría</Th>
                    <Th align="right">Cantidad</Th>
                    <Th align="right">Monto unitario</Th>
                    <Th align="right">Total</Th>
                    <Th>Histórico</Th>
                    <Th>Estado</Th>
                    {esAdmin && <Th align="right">Validado</Th>}
                  </tr>
                </thead>

                <tbody>
                  {movimientosVisibles.map((fila) => {
                    const validado = (fila.estado || 'PENDIENTE').toUpperCase() === 'VALIDADO';

                    return (
                      <tr key={fila.id} style={filaStyle}>
                        <Td>{fila.id_operacion || '—'}</Td>
                        <Td>{new Date(`${fila.fecha}T12:00:00`).toLocaleDateString('es-AR')}</Td>
                        <Td>{fila.tipo}</Td>
                        <Td>{nombresProducto[fila.producto_id] || fila.producto_id}</Td>
                        <Td>{fila.categoria}</Td>
                        <Td align="right">{fila.cantidad}</Td>
                        <Td align="right">R$ {Number(fila.costo_unitario).toFixed(2)}</Td>
                        <Td align="right">
                          R$ {Number(fila.total ?? fila.cantidad * fila.costo_unitario).toFixed(2)}
                        </Td>
                        <Td style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 220 }}>
                          {fila.historico || '—'}
                        </Td>

                        <Td>
                          <EstadoBadge estado={fila.estado} />
                        </Td>

                        {esAdmin && (
                          <Td align="right">
                            {validado ? (
                              <span style={{ fontSize: 12, color: COLORES.gris }}>—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => fila.id_operacion && validarMovimiento(fila.id_operacion)}
                                disabled={!fila.id_operacion || validando === fila.id_operacion}
                                style={botonValidar}
                                title="Validar este movimiento y el registro automático que generó en el Libro Diario"
                              >
                                {validando === fila.id_operacion ? '...' : 'Validado'}
                              </button>
                            )}
                          </Td>
                        )}
                      </tr>
                    );
                  })}

                  {!movimientosVisibles.length && (
                    <tr>
                      <td colSpan={esAdmin ? 11 : 10} style={vacioStyle}>
                        No se encontraron movimientos.
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
   SECCIÓN DE PRODUCTOS (desplegable)
========================================================== */

function SeccionProductos({
  titulo,
  emoji,
  productos,
  abierta,
  onToggle,
  mensajeVacio,
}: {
  titulo: string;
  emoji: string;
  productos: ProductoFila[];
  abierta: boolean;
  onToggle: () => void;
  mensajeVacio: string;
}) {
  const totalUnidades = productos.reduce((total, producto) => total + producto.saldo, 0);
  const totalInventario = productos.reduce((total, producto) => total + producto.valorInventario, 0);

  return (
    <div style={seccionContenedor}>
      <button type="button" onClick={onToggle} style={seccionCabecera}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{abierta ? '▾' : '▸'}</span>
          <span>
            {emoji} {titulo}
          </span>
          <span style={contadorPastilla}>{productos.length}</span>
        </span>

        {titulo === 'Con saldo' && (
          <span style={{ fontSize: 12, color: COLORES.gris, fontWeight: 600 }}>
            {totalUnidades} unidades · Valor inventario: R$ {totalInventario.toFixed(2)}
          </span>
        )}
      </button>

      {abierta && (
        <div style={tablaContenedor}>
          <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={cabeceraFila}>
                <Th>Código</Th>
                <Th>Producto</Th>
                <Th>Categoría</Th>
                <Th align="right">Saldo</Th>
                <Th align="right">Costo promedio</Th>
                <Th align="right">Valor inventario</Th>
                <Th>Estado</Th>
              </tr>
            </thead>

            <tbody>
              {productos.map((producto) => (
                <tr key={producto.id} style={filaStyle}>
                  <Td>
                    <strong style={{ color: COLORES.azul }}>{producto.codigo || '—'}</strong>
                  </Td>
                  <Td>{producto.nombre}</Td>
                  <Td>{producto.categoria || '—'}</Td>
                  <Td align="right">
                    <span
                      style={{
                        fontWeight: 700,
                        color: producto.saldo <= 0 ? '#dc2626' : COLORES.verde,
                      }}
                    >
                      {producto.saldo}
                    </span>
                  </Td>
                  <Td align="right">R$ {producto.costoPromedio.toFixed(2)}</Td>
                  <Td align="right">R$ {producto.valorInventario.toFixed(2)}</Td>
                  <Td>
                    {producto.saldo <= 0 ? 'Sin stock' : producto.saldo <= 1 ? 'Bajo stock' : 'Activo'}
                  </Td>
                </tr>
              ))}

              {!productos.length && (
                <tr>
                  <td colSpan={7} style={vacioStyle}>
                    {mensajeVacio}
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
   GENERACIÓN DE CÓDIGO DE PRODUCTO
========================================================== */

function generarProximoCodigoProducto(productos: ProductoFila[]): string {
  let maximo = 0;

  for (const producto of productos) {
    const coincidencia = producto.codigo?.match(/^PROD-(\d+)$/);

    if (coincidencia) {
      const numero = Number(coincidencia[1]);

      if (numero > maximo) {
        maximo = numero;
      }
    }
  }

  const numeroFormateado = String(maximo + 1).padStart(5, '0');

  return `PROD-${numeroFormateado}`;
}

/* ==========================================================
   ESTADO (pastilla)
========================================================== */

function EstadoBadge({ estado }: { estado: string | null }) {
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

/* ==========================================================
   OBTENER NÚMERO DE OPERACIÓN
========================================================== */

function extraerNumero(valor: string | null): number {
  if (!valor) {
    return -1;
  }

  const coincidencia = valor.match(/\d+/);

  return coincidencia ? Number(coincidencia[0]) : -1;
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

const seccionContenedor: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  overflow: 'hidden',
};

const seccionCabecera: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '13px 16px',
  background: '#f1f5f9',
  border: 'none',
  cursor: 'pointer',
  color: COLORES.azul,
  fontWeight: 800,
  fontSize: 14,
  textAlign: 'left',
};

const contadorPastilla: React.CSSProperties = {
  background: COLORES.blanco,
  border: '1px solid #d6dee5',
  borderRadius: 999,
  padding: '1px 9px',
  fontSize: 11,
  fontWeight: 700,
  color: COLORES.gris,
};

const tablaContenedor: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderTop: 'none',
  borderRadius: '0 0 14px 14px',
};

const tablaContenedorSolo: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
};

const cabeceraFila: React.CSSProperties = {
  background: '#f8fafc',
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
