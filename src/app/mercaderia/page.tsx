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
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { fechaLocalHoy } from '@/lib/fecha';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { SabioWidget } from '@/components/panel/SabioWidget';
import { crearTraductor, estadoDisplay } from '@/lib/i18n';
import { empresaTieneOnboardingCompleto } from '@/lib/onboarding';
import {
  diccionarioMercaderia,
  msgConfirmarEliminarProducto,
  msgYaTieneMovimientos,
  msgNoSePudoEliminar,
  contadorProductos,
  contadorMovimientos,
  frasesSabioMercaderia,
} from './i18n';

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
  fecha_alta: fechaLocalHoy(),
};

function opcionesTipo(t: (clave: any) => string) {
  return [
    { value: '', label: t('opcionSinEspecificar') },
    { value: 'INSUMO', label: t('opcionInsumo') },
    { value: 'TERMINADO', label: t('opcionTerminado') },
  ];
}

function opcionesUnidad(t: (clave: any) => string) {
  return [
    { value: '', label: t('opcionSinEspecificar') },
    { value: 'UNIDAD', label: t('opcionUnidad') },
    { value: 'KG', label: t('opcionKg') },
    { value: 'G', label: t('opcionG') },
    { value: 'L', label: t('opcionL') },
    { value: 'ML', label: t('opcionMl') },
  ];
}

export default function MercaderiaPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [moneda, setMoneda] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<string | null>(null);

  const t = crearTraductor(diccionarioMercaderia, idioma);

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
  const [editandoProductoId, setEditandoProductoId] = useState<string | null>(null);
  const [eliminandoProductoId, setEliminandoProductoId] = useState<string | null>(null);

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
      setError(t('errorEmpresa'));
      setCargando(false);
      return;
    }

    if (!(await empresaTieneOnboardingCompleto(perfil.empresa_id))) {
      router.push('/bienvenida');
      return;
    }

    setEmpresaId(perfil.empresa_id);
    setEsAdmin(Boolean(perfil.es_admin_plataforma));

    const [
      { data: productosData, error: errorProductos },
      { data: saldosData, error: errorSaldos },
      { data: movimientosData, error: errorMovimientos },
      { data: categoriasData, error: errorCategorias },
      { data: proveedoresData, error: errorProveedores },
      { data: empresaData },
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

      supabase
        .from('empresas')
        .select('moneda, idioma')
        .eq('id', perfil.empresa_id)
        .maybeSingle(),
    ]);

    if (errorProductos) console.warn('No se pudieron cargar los productos:', errorProductos);
    if (errorSaldos) console.warn('No se pudieron cargar los saldos:', errorSaldos);
    if (errorMovimientos) console.warn('No se pudieron cargar los movimientos:', errorMovimientos);
    if (errorCategorias) console.warn('No se pudieron cargar las categorías:', errorCategorias);
    if (errorProveedores) console.warn('No se pudieron cargar los proveedores:', errorProveedores);

    setMoneda(empresaData?.moneda ?? null);
    setIdioma(empresaData?.idioma ?? null);

    const saldoPorProducto = new Map(
      (saldosData ?? []).map((fila) => [fila.producto_id, Number(fila.saldo ?? 0)])
    );

    // Costo promedio ponderado perpetuo — igual al que usa el motor
    // (lib/motor.ts) al registrar una VENTA: se descuentan también las
    // SALIDAs (al costo que tenían en su momento), no solo se suman las
    // ENTRADAs. Si acá se promediara solo lo comprado, como antes, el
    // valor de inventario mostrado nunca coincidiría con el saldo real
    // de la cuenta de Stock apenas un producto tuviera compras a
    // distinto precio con ventas intercaladas.
    const costoPorProducto = new Map<string, { cantidad: number; valor: number }>();

    for (const movimiento of movimientosData ?? []) {
      if (movimiento.tipo !== 'ENTRADA' && movimiento.tipo !== 'SALIDA') {
        continue;
      }

      const actual = costoPorProducto.get(movimiento.producto_id) ?? { cantidad: 0, valor: 0 };
      const cantidad = Number(movimiento.cantidad ?? 0);
      const valor = cantidad * Number(movimiento.costo_unitario ?? 0);

      if (movimiento.tipo === 'ENTRADA') {
        actual.cantidad += cantidad;
        actual.valor += valor;
      } else {
        actual.cantidad -= cantidad;
        actual.valor -= valor;
      }

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
      fecha_alta: fechaLocalHoy(),
    });
    setError('');
    setMostrarFormulario(true);
  }

  function cancelarFormulario() {
    setMostrarFormulario(false);
    setFormulario(FORMULARIO_VACIO);
    setEditandoProductoId(null);
  }

  function abrirEditarProducto(producto: ProductoFila) {
    setFormulario({
      nombre: producto.nombre,
      categoria_producto_id: producto.categoria_producto_id ?? '',
      tipo_producto: producto.tipo_producto ?? '',
      unidad_medida: producto.unidad_medida ?? '',
      proveedor_id: producto.proveedor_id ?? '',
      fecha_alta: producto.fecha_alta ?? fechaLocalHoy(),
    });
    setEditandoProductoId(producto.id);
    setError('');
    setMostrarFormulario(true);
  }

  async function guardarProducto() {
    if (!empresaId) {
      setError(t('errorEmpresaGuardar'));
      return;
    }

    const nombreLimpio = formulario.nombre.trim();

    if (!nombreLimpio) {
      setError(t('errorNombreObligatorio'));
      return;
    }

    setGuardando(true);
    setError('');

    const categoriaElegida = categorias.find(
      (categoria) => categoria.id === formulario.categoria_producto_id
    );

    try {
      if (editandoProductoId) {
        const { error: errorUpdate } = await supabase
          .from('productos')
          .update({
            nombre: nombreLimpio,
            categoria_producto_id: categoriaElegida?.id ?? null,
            categoria: categoriaElegida?.nombre ?? null,
            proveedor_id: formulario.proveedor_id || null,
            tipo_producto: formulario.tipo_producto || null,
            unidad_medida: formulario.unidad_medida || null,
            fecha_alta: formulario.fecha_alta || null,
          })
          .eq('id', editandoProductoId);

        if (errorUpdate) {
          throw errorUpdate;
        }
      } else {
        const codigo = generarProximoCodigoProducto(productos);

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
      }

      await cargarDatos();
      cancelarFormulario();
    } catch (errorGuardar) {
      console.error('Error guardando producto:', errorGuardar);
      setError(editandoProductoId ? t('errorActualizar') : t('errorCrear'));
    } finally {
      setGuardando(false);
    }
  }

  // Un producto solo se puede borrar si nunca tuvo movimiento — si
  // ya tiene compras/ventas cargadas, borrarlo dejaría esas
  // operaciones apuntando a un producto inexistente.
  async function eliminarProducto(producto: ProductoFila) {
    if (!empresaId) return;

    const confirmado = window.confirm(msgConfirmarEliminarProducto(idioma, producto.nombre));

    if (!confirmado) return;

    setError('');
    setEliminandoProductoId(producto.id);

    try {
      const { count, error: errorConteo } = await supabase
        .from('movimientos_stock')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('producto_id', producto.id);

      if (errorConteo) {
        throw errorConteo;
      }

      if (count && count > 0) {
        setError(msgYaTieneMovimientos(idioma, producto.nombre));
        return;
      }

      const { error: errorBorrar } = await supabase.from('productos').delete().eq('id', producto.id);

      if (errorBorrar) {
        throw errorBorrar;
      }

      await cargarDatos();
    } catch (errorEliminar) {
      console.error('Error eliminando producto:', errorEliminar);
      setError(msgNoSePudoEliminar(idioma, producto.nombre));
    } finally {
      setEliminandoProductoId(null);
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
      setError(t('errorValidar'));
    } finally {
      setValidando(null);
    }
  }

  const simbolo = simboloMoneda(moneda);

  return (
    <div style={fondo}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* =================================================
            ENCABEZADO
        ================================================== */}

        <header style={encabezado}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <Link href="/?vista=empresa" style={volver}>
                {t('volver')}
              </Link>

              <div style={eyebrow}>{t('eyebrow')}</div>

              <h1 style={{ margin: 0, fontSize: 32 }}>{t('titulo')}</h1>

              <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
                {t('subtitulo')}
              </p>
            </div>

            {/* SABIO — permanente, con tips propios de Mercadería. Vive
                en el mismo panel del encabezado, entre el título y los
                accesos rápidos. */}
            <SabioWidget
              colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
              idioma={idioma}
              frases={frasesSabioMercaderia(idioma)}
            />

            <AccesosHerramientas />
          </div>
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
              {t('tabSaldo')}
            </button>

            <button
              type="button"
              onClick={() => cambiarPestana('movimientos')}
              style={tabStyle(pestana === 'movimientos')}
            >
              {t('tabMovimientos')}
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
                {pestana === 'saldo' ? t('tituloSaldo') : t('tituloMovimientos')}
              </h2>

              <p style={{ margin: '4px 0 0', color: COLORES.gris, fontSize: 12 }}>
                {pestana === 'saldo'
                  ? contadorProductos(idioma, productos.length)
                  : contadorMovimientos(idioma, movimientos.length)}
              </p>
            </div>

            {pestana === 'saldo' && (
              <button type="button" onClick={abrirNuevoProducto} style={botonNuevo}>
                {t('nuevoProducto')}
              </button>
            )}
          </div>

          {/* =================================================
              BUSCADOR
          ================================================== */}

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={pestana === 'saldo' ? t('buscarSaldo') : t('buscarMovimientos')}
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
                  <div style={formularioEyebrow}>{editandoProductoId ? t('editando') : t('nuevoRegistro')}</div>

                  <h3 style={{ margin: 0, color: COLORES.azul, fontSize: 20 }}>
                    {editandoProductoId ? t('editarProducto') : t('agregarProducto')}
                  </h3>
                </div>

                <button type="button" onClick={cancelarFormulario} style={cerrarFormulario}>
                  ×
                </button>
              </div>

              <div style={formGrid}>
                <div style={campo}>
                  <label style={label}>{t('nombre')}</label>

                  <input
                    value={formulario.nombre}
                    onChange={(e) =>
                      setFormulario((actual) => ({ ...actual, nombre: e.target.value }))
                    }
                    placeholder={t('nombrePlaceholder')}
                    style={inputFormulario}
                  />
                </div>

                <div style={campo}>
                  <label style={label}>{t('categoria')}</label>

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
                    <option value="">{t('sinCategoria')}</option>

                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={campo}>
                  <label style={label}>{t('tipoProducto')}</label>

                  <select
                    value={formulario.tipo_producto}
                    onChange={(e) =>
                      setFormulario((actual) => ({ ...actual, tipo_producto: e.target.value }))
                    }
                    style={inputFormulario}
                  >
                    {opcionesTipo(t).map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={campo}>
                  <label style={label}>{t('unidadMedida')}</label>

                  <select
                    value={formulario.unidad_medida}
                    onChange={(e) =>
                      setFormulario((actual) => ({ ...actual, unidad_medida: e.target.value }))
                    }
                    style={inputFormulario}
                  >
                    {opcionesUnidad(t).map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={campo}>
                  <label style={label}>{t('proveedor')}</label>

                  <select
                    value={formulario.proveedor_id}
                    onChange={(e) =>
                      setFormulario((actual) => ({ ...actual, proveedor_id: e.target.value }))
                    }
                    style={inputFormulario}
                  >
                    <option value="">{t('sinProveedor')}</option>

                    {proveedores.map((proveedor) => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={campo}>
                  <label style={label}>{t('fechaAlta')}</label>

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
                  {editandoProductoId ? t('codigoNoCambia') : t('codigoAutomatico')}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={cancelarFormulario}
                  style={botonSecundario}
                  disabled={guardando}
                >
                  {t('cancelar')}
                </button>

                <button
                  type="button"
                  onClick={guardarProducto}
                  style={botonGuardar}
                  disabled={guardando}
                >
                  {guardando ? t('guardando') : editandoProductoId ? t('guardarCambios') : t('crearProducto')}
                </button>
              </div>
            </section>
          )}

          {/* =================================================
              CONTENIDO DE LA PESTAÑA
          ================================================== */}

          {cargando ? (
            <div style={cargandoStyle}>{t('cargandoDatos')}</div>
          ) : pestana === 'saldo' ? (
            <>
              <SeccionProductos
                titulo={t('conSaldo')}
                esConSaldo
                emoji="🟢"
                productos={conSaldoVisibles}
                abierta={mostrarConSaldo}
                onToggle={() => setMostrarConSaldo((actual) => !actual)}
                mensajeVacio={t('sinProductosConSaldo')}
                esAdmin={esAdmin}
                simbolo={simboloMoneda(moneda)}
                onEditar={abrirEditarProducto}
                onEliminar={eliminarProducto}
                eliminandoId={eliminandoProductoId}
                idioma={idioma}
                t={t}
              />

              <div style={{ height: 14 }} />

              <SeccionProductos
                titulo={t('sinSaldo')}
                emoji="⚪"
                productos={sinSaldoVisibles}
                abierta={mostrarSinSaldo}
                onToggle={() => setMostrarSinSaldo((actual) => !actual)}
                mensajeVacio={t('sinProductosSinSaldo')}
                esAdmin={esAdmin}
                simbolo={simboloMoneda(moneda)}
                onEditar={abrirEditarProducto}
                onEliminar={eliminarProducto}
                eliminandoId={eliminandoProductoId}
                idioma={idioma}
                t={t}
              />
            </>
          ) : (
            <div style={tablaContenedorSolo}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={cabeceraFila}>
                    <Th style={anchoColumna(75)}>{t('idRegistro')}</Th>
                    <Th style={anchoColumna(70)}>{t('fecha')}</Th>
                    <Th style={anchoColumna(60)}>{t('tipo')}</Th>
                    <Th style={anchoColumna(110)}>{t('productoHeader')}</Th>
                    <Th style={anchoColumna(90)}>{t('categoriaHeader')}</Th>
                    <Th align="right" style={anchoColumna(65)}>
                      {t('cantidad')}
                    </Th>
                    <Th align="right" style={anchoColumna(75)}>
                      {t('montoUnitario')}
                    </Th>
                    <Th align="right" style={anchoColumna(70)}>
                      {t('total')}
                    </Th>
                    <Th style={anchoColumna(150)}>{t('historico')}</Th>
                    <Th style={anchoColumna(80)}>{t('estadoHeader')}</Th>
                    {esAdmin && (
                      <Th align="right" style={anchoColumna(75)}>
                        {t('validadoHeader')}
                      </Th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {movimientosVisibles.map((fila) => {
                    const validado = (fila.estado || 'PENDIENTE').toUpperCase() === 'VALIDADO';

                    return (
                      <tr key={fila.id} style={filaStyle}>
                        <Td>{fila.id_operacion || '—'}</Td>
                        <Td>
                          {new Date(`${fila.fecha}T12:00:00`).toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR')}
                        </Td>
                        <Td>{fila.tipo}</Td>

                        <Td
                          style={celdaRecortada(110)}
                          title={nombresProducto[fila.producto_id] || fila.producto_id}
                        >
                          {nombresProducto[fila.producto_id] || fila.producto_id}
                        </Td>

                        <Td style={celdaRecortada(90)} title={fila.categoria}>
                          {fila.categoria}
                        </Td>

                        <Td align="right">{fila.cantidad}</Td>
                        <Td align="right">{simbolo} {formatearNumeroEntero(Number(fila.costo_unitario))}</Td>
                        <Td align="right">
                          {simbolo} {formatearNumeroEntero(Number(fila.total ?? fila.cantidad * fila.costo_unitario))}
                        </Td>
                        <Td style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 150 }}>
                          {fila.historico || '—'}
                        </Td>

                        <Td>
                          <EstadoBadge estado={fila.estado} idioma={idioma} />
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
                                title={t('validarTitle')}
                              >
                                {validando === fila.id_operacion ? '...' : t('validadoBtn')}
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
                        {t('sinMovimientos')}
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
  esConSaldo,
  emoji,
  productos,
  abierta,
  onToggle,
  mensajeVacio,
  esAdmin,
  onEditar,
  onEliminar,
  eliminandoId,
  simbolo,
  idioma,
  t,
}: {
  titulo: string;
  esConSaldo?: boolean;
  emoji: string;
  productos: ProductoFila[];
  abierta: boolean;
  onToggle: () => void;
  mensajeVacio: string;
  esAdmin: boolean;
  onEditar: (producto: ProductoFila) => void;
  onEliminar: (producto: ProductoFila) => void;
  eliminandoId: string | null;
  simbolo: string;
  idioma: string | null;
  t: (clave: any) => string;
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

        {esConSaldo && (
          <span style={{ fontSize: 12, color: COLORES.gris, fontWeight: 600 }}>
            {totalUnidades} {t('unidades')} · {t('valorInventarioEtiqueta')} {simbolo} {formatearNumeroEntero(totalInventario)}
          </span>
        )}
      </button>

      {abierta && (
        <div style={tablaContenedor}>
          <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={cabeceraFila}>
                <Th>{t('codigoHeader')}</Th>
                <Th>{t('productoHeader')}</Th>
                <Th>{t('categoriaHeader')}</Th>
                <Th align="right">{t('saldoHeader')}</Th>
                <Th align="right">{t('costoPromedioHeader')}</Th>
                <Th align="right">{t('valorInventarioHeader')}</Th>
                <Th>{t('estadoHeader')}</Th>
                {esAdmin && <Th align="right">{t('accionesHeader')}</Th>}
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
                  <Td align="right">{simbolo} {formatearNumeroEntero(producto.costoPromedio)}</Td>
                  <Td align="right">{simbolo} {formatearNumeroEntero(producto.valorInventario)}</Td>
                  <Td>
                    {producto.saldo <= 0 ? t('sinStock') : producto.saldo <= 1 ? t('bajoStock') : t('activo')}
                  </Td>

                  {esAdmin && (
                    <Td align="right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => onEditar(producto)}
                          style={botonSecundario}
                          title={t('editarTitle')}
                        >
                          {t('editar')}
                        </button>

                        <button
                          type="button"
                          onClick={() => onEliminar(producto)}
                          disabled={eliminandoId === producto.id}
                          style={botonEliminar}
                          title={t('eliminarTitle')}
                        >
                          {eliminandoId === producto.id ? '...' : t('eliminar')}
                        </button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}

              {!productos.length && (
                <tr>
                  <td colSpan={esAdmin ? 8 : 7} style={vacioStyle}>
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

function EstadoBadge({ estado, idioma }: { estado: string | null; idioma?: string | null }) {
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
      {estadoDisplay(idioma, valor)}
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

// Fuerza a que el título de la columna salte de línea en vez de
// estirar la tabla entera solo para que un encabezado largo (ej.
// "Monto unitario") entre en una sola línea.
function anchoColumna(maxWidth: number): React.CSSProperties {
  return { whiteSpace: 'normal', maxWidth };
}

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

function Th({
  children,
  align = 'left',
  style,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        padding: '10px 10px',
        color: '#374151',
        fontSize: 12,
        textAlign: align,
        whiteSpace: 'nowrap',
        fontWeight: 800,
        ...style,
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
  title,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <td
      title={title}
      style={{
        padding: '10px 10px',
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

// Achica una celda de texto largo (producto, categoría) a un ancho
// fijo con puntos suspensivos, en vez de estirar la columna entera.
const celdaRecortada = (maxWidth: number): React.CSSProperties => ({
  maxWidth,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

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

const botonEliminar: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#b91c1c',
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
