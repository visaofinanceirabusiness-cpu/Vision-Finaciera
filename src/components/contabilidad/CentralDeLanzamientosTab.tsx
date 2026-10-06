'use client';

// PESTAÑA 1 · CENTRAL DE LANZAMIENTOS
//
// Extraído de app/contabilidad/page.tsx — mismo comportamiento, solo
// en su propio archivo (Fase 2 de mantenimiento).

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { obtenerFormasPagoOperacion } from '@/lib/formasPagoOperacion';
import {
  registrarOperacion,
  editarOperacion,
  generarMatrizOperaciones,
  type LineaOperacion,
} from '@/lib/motor';
import { crearCuentaParaMedioPago, crearFormaPago, crearPasivo, habilitarLiquidacionCuentaCobrar } from '@/lib/categorias';
import { convertirCantidad, opcionesUnidadCarga } from '@/lib/produccion';
import { formatearNumeroEntero } from '@/lib/moneda';
import { fechaLocalHoy } from '@/lib/fecha';
import { crearTraductor, nombreOperacionDisplay } from '@/lib/i18n';
import { empresaManejaMercaderia } from '@/lib/perfilCapacidades';
import { empresaTieneOnboardingCompleto, marcarOnboardingCompleto } from '@/lib/onboarding';
import { armarMensajeComprobante, buscarTelefonoCliente, empresaTieneTelefonoValido, enlaceWhatsapp } from '@/lib/whatsapp';
import { crearOUsarClientePorTelefono } from '@/lib/clientes';
import { saldoDeFormaDePago, saldoDeCategoria, saldoEnTransferencia, saldosDeCategorias } from '@/lib/saldoCuenta';
import { crearCuotasPasivo } from '@/lib/cuotas';
import { crearCuotasCobro } from '@/lib/cuotasCobro';
import { registrarPagoParcial, type RecordatorioGastoRecurrente } from '@/lib/gastosRecurrentes';
import { buscarProductoPorCodigoBarras } from '@/lib/codigoBarras';
import { EscanerCodigoBarras } from '@/components/panel/EscanerCodigoBarras';
import { MiniJuego } from '@/components/panel/MiniJuego';
import {
  diccionarioContabilidad,
  etiquetaRelacion,
  msgEditandoOperacion,
  msgElegirOperacion,
  msgElegirCategoria,
  msgElegirFormaPago,
  msgCompletarHistorico,
  msgCompletarRelacion,
  msgCompletarSocio,
  msgCompletarDetalle,
  msgListoParaRegistrar,
  msgOperacionActualizada,
  msgOperacionRegistrada,
  msgErrorCategorias,
  msgErrorFormasPago,
  msgSaldoMedioInsuficiente,
  tituloOperacion,
  stockDisponible,
  contadorRenglones,
  pasosTutorial,
  msgTutorialPaso,
  agruparCategoriasPorRubro,
} from '@/app/contabilidad/i18n';
import { SimboloContext, EsFamiliarContext, IdiomaContext, COLORES, type ValoresIniciales, type LineaFormulario } from './compartido';
import {
  volver,
  eyebrowVerde,
  panel,
  panelTitulo,
  estadoActivo,
  grid2,
  campoInput,
  filaProducto,
  botonEliminarLinea,
  totalStyle,
  accionFinal,
  marcaVision,
  visionLogo,
  sabioMarcaChica,
  sabioLogoChico,
  botonPrincipal,
  botonSecundario,
  validacionStyle,
} from './estilosCompartidos';

const NUEVO_CLIENTE_OPCION = '__nuevo_cliente__';
const OPCION_CREAR_CUENTA_NUEVA = '__crear_cuenta_nueva__';
const SABIO_URL = '/sabio/sabio-bot.webp';

const LOGO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/Vision%20financiera.jpeg';

type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  proveedor_id: string | null;
  tipo_producto: string | null;
  unidad_medida: string | null;
};

export function CentralDeLanzamientosTab({
  idOperacionEditar,
  valoresIniciales,
  recordatorioGastoRecurrente,
  onGuardado,
  onCancelar,
}: {
  idOperacionEditar?: string;
  valoresIniciales?: ValoresIniciales;
  // Cuando se llega desde "Registrar" en Mis Vencimientos — al
  // guardar con éxito, se resta el monto cargado del saldo pendiente
  // de este recordatorio (ver handleRegistrar y registrarPagoParcial).
  recordatorioGastoRecurrente?: RecordatorioGastoRecurrente;
  onGuardado?: () => void;
  onCancelar?: () => void;
} = {}) {
  const simbolo = useContext(SimboloContext);
  const esFamiliar = useContext(EsFamiliarContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioContabilidad, idioma);
  const router = useRouter();
  const modoEdicion = Boolean(idOperacionEditar);

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [comprobanteWhatsapp, setComprobanteWhatsapp] = useState<{ cliente: string; enlace: string } | null>(null);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);

  // Tutorial guiado (Fase 3 del onboarding): activo siempre para una
  // empresa nueva (onboarding_completado = false) y opcionalmente
  // para cualquier otra que entre con ?tutorial=1 desde el mensaje de
  // invitación. "Voluntario" es lo que distingue a una empresa que ya
  // operaba (puede cancelar) de una nueva (no puede: onCancelar no se
  // le pasa a este tab desde ContabilidadPage).
  const [modoTutorial, setModoTutorial] = useState(false);
  const [tutorialVoluntario, setTutorialVoluntario] = useState(false);
  const [operacionesTutorial, setOperacionesTutorial] = useState<string[]>([]);
  const [manejaMercaderiaEmpresa, setManejaMercaderiaEmpresa] = useState(false);
  const [esFamiliarEmpresa, setEsFamiliarEmpresa] = useState(false);
  const [ofrecerTutorialVoluntario, setOfrecerTutorialVoluntario] = useState(false);

  const [fecha, setFecha] = useState(() => valoresIniciales?.fecha ?? fechaLocalHoy());

  const [operaciones, setOperaciones] = useState<string[]>([]);
  const [operacion, setOperacion] = useState(valoresIniciales?.operacion ?? '');

  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoria, setCategoria] = useState(valoresIniciales?.categoria ?? '');

  // Si la categoría elegida mueve stock (según la Matriz de Operações)
  // o no — una Venta/Compra/Pérdida de una categoría de servicio
  // (ej. "Clases", "Masoterapia") no tiene productos ni cantidad, se
  // carga igual que una Inversión: categoría + descripción + monto.
  const [stockPorCategoria, setStockPorCategoria] = useState<Record<string, string>>({});

  // Rubro contable (Activo/Pasivo/Patrimonio/Ingreso/Gasto) de cada
  // cuenta, según el primer dígito de su código — se usa para agrupar
  // el selector de Categoría con un separador por rubro (ver
  // agruparCategoriasPorRubro más abajo).
  const [rubroPorCuenta, setRubroPorCuenta] = useState<Record<string, string>>({});

  // Formas de pago (por nombre) habilitadas para Compra o Pago — ver
  // el comentario en cargarDatosOperativos sobre cómo esto distingue
  // una Cuenta por Cobrar de un medio financiero real.
  const [formasPagoUsablesParaGasto, setFormasPagoUsablesParaGasto] = useState<Set<string>>(new Set());

  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [saldosPorCategoria, setSaldosPorCategoria] = useState<Record<string, number>>({});
  const [formaPago, setFormaPago] = useState(valoresIniciales?.formaPago ?? '');
  const [saldoOrigen, setSaldoOrigen] = useState<{ cuenta: string; saldo: number } | null>(null);
  const [saldoDestino, setSaldoDestino] = useState<{ cuenta: string; saldo: number } | null>(null);

  // Compra/Pago a crédito en cuotas — solo tiene sentido cuando la
  // forma de pago elegida es un Pasivo (rubro '2', ver rubroPorCuenta
  // más arriba). El asiento sigue siendo uno solo por el total; las
  // cuotas son un cronograma aparte con recordatorio en el
  // Calendário del lobby (ver lib/cuotas.ts).
  const [enCuotas, setEnCuotas] = useState(false);
  const [cantidadCuotas, setCantidadCuotas] = useState('2');

  // "+ Crear cuenta nueva" desde el propio selector de forma de pago
  // — evita tener que ir a Configurações para dar de alta una cuenta
  // a cobrar (Venta/Cobro) o a pagar (Compra/Pago) que todavía no
  // existe. Simple a propósito: solo pide el nombre, y la habilita
  // automáticamente nada más que para el par de operaciones que
  // corresponda (eso es lo que hace que el sistema la reconozca como
  // "Cuenta por Cobrar"/Pasivo más adelante).
  const [creandoCuentaNueva, setCreandoCuentaNueva] = useState(false);
  const [nombreCuentaNueva, setNombreCuentaNueva] = useState('');
  const [guardandoCuentaNueva, setGuardandoCuentaNueva] = useState(false);

  const [historico, setHistorico] = useState(valoresIniciales?.historico ?? '');
  const [clienteProveedor, setClienteProveedor] = useState(valoresIniciales?.clienteProveedor ?? '');
  const [socio, setSocio] = useState(valoresIniciales?.socio ?? '');

  const [contactos, setContactos] = useState<string[]>([]);
  const [sociosIngreso, setSociosIngreso] = useState<string[]>([]);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombreProveedorPorId, setNombreProveedorPorId] = useState<Record<string, string>>({});

  // Movimientos de stock (ENTRADA/SALIDA) de todos los productos, para
  // calcular cuánto había disponible A LA FECHA elegida en el
  // formulario — no el stock de hoy. Si se mostrara el stock de hoy,
  // una Venta con fecha atrasada podía parecer válida (ej. "estoque:
  // 205") usando unidades de una Compra que en esa fecha vieja todavía
  // no existía, aunque el registro final la vaya a rechazar.
  const [movimientosStock, setMovimientosStock] = useState<
    { producto_id: string; tipo: string; cantidad: number; fecha: string }[]
  >([]);

  // Saldo actual de cada cuenta financiera (Efectivo, Banco, Pix...) y
  // a qué cuenta corresponde cada forma de pago — para poder bloquear
  // un Pago/Compra/Extracción/Transferencia que dejaría esa cuenta en
  // negativo, igual que ya se bloquea una Venta sin stock suficiente.
  const [saldoPorCuentaFinanciera, setSaldoPorCuentaFinanciera] = useState<Record<string, number>>({});
  const [cuentaPorFormaPago, setCuentaPorFormaPago] = useState<Record<string, string>>({});
  const [naturalezaPorCuentaFinanciera, setNaturalezaPorCuentaFinanciera] = useState<Record<string, string>>({});

  const [lineas, setLineas] = useState<LineaFormulario[]>(
    valoresIniciales?.lineas ?? [{ producto: '', cantidad: 0, monto: 0, unidadCarga: '' }]
  );
  const [escaneandoVenta, setEscaneandoVenta] = useState(false);
  const [errorEscaneo, setErrorEscaneo] = useState('');

  // Al editar, las 3 combos encadenados (categoría → forma de pago →
  // contacto) recién arman sus listas después de un fetch — sin esto,
  // ese primer fetch los pisaría con '' antes de que el usuario llegue
  // a verlos precargados. Cada ref se "consume" una sola vez.
  const hidratarCategoria = useRef(Boolean(valoresIniciales));
  const hidratarFormaPago = useRef(Boolean(valoresIniciales));
  const hidratarContacto = useRef(Boolean(valoresIniciales));

  const [mensajeSabio, setMensajeSabio] = useState(
    modoEdicion ? msgEditandoOperacion(idioma, idOperacionEditar!) : msgElegirOperacion(idioma)
  );

  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // La categoría elegida es la que define si esta Compra/Venta/Pérdida
  // mueve stock o no (mismo flag que ya usa el motor para decidir si
  // genera movimientos_stock) — no la operación en sí. Una Venta de
  // "Masoterapia" es tan válida como una Venta de "Ropa", pero no
  // tiene producto ni cantidad.
  const categoriaEsProducto = Boolean(categoria) && stockPorCategoria[categoria] === 'SI';

  const operacionesConProducto =
    (['COMPRA', 'VENTA', 'PERDIDA'].includes(operacion) && categoriaEsProducto) ||
    (operacion === 'INVERSION' && formaPago === 'Mercadería');

  // Pago, Inversión, Extracción y Transferencia no tienen "cantidad"
  // ni un histórico separado que aporte algo — confunden más de lo
  // que ayudan. Se simplifica a: categoría + monto (+ a quién, salvo
  // en Transferencia). Una Compra/Venta/Pérdida de una categoría de
  // servicio (sin stock) se simplifica exactamente igual.
  const formularioSimple =
    ['PAGO', 'INVERSION', 'EXTRACCION', 'TRANSFERENCIA', 'COBRO'].includes(operacion) ||
    (['COMPRA', 'VENTA', 'PERDIDA'].includes(operacion) && Boolean(categoria) && !categoriaEsProducto);

  // Transferencia es un movimiento entre cuentas propias (ej. de
  // Cuenta Bancaria a Plazo Fijo) — no hay un tercero involucrado,
  // así que no corresponde pedir Cliente/Proveedor/Socio acá.
  const esTransferencia = operacion === 'TRANSFERENCIA';

  // "En cuotas" aplica en dos casos simétricos: Compra/Pago con una
  // forma de pago que sea un Pasivo (rubro '2' — genera una deuda), o
  // Venta/Cobro con una forma de pago que sea una Cuenta por Cobrar
  // (rubro '1' pero NO habilitada para Compra/Pago — un Activo real
  // como Caja/Banco sí lo está, por eso los distingue; ver
  // formasPagoUsablesParaGasto). Pagar en efectivo o transferir no
  // genera ni una deuda ni un cobro pendiente que tenga sentido
  // parcelar.
  const esCuentaPorCobrar =
    Boolean(formaPago) && rubroPorCuenta[formaPago] === '1' && !formasPagoUsablesParaGasto.has(formaPago);

  const puedeEnCuotas =
    ((operacion === 'COMPRA' || operacion === 'PAGO') && Boolean(formaPago) && rubroPorCuenta[formaPago] === '2') ||
    ((operacion === 'VENTA' || operacion === 'COBRO') && esCuentaPorCobrar);

  useEffect(() => {
    if (!puedeEnCuotas) {
      setEnCuotas(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeEnCuotas]);

  // "+ Crear cuenta a cobrar/a pagar nueva" en el selector de forma
  // de pago: solo tiene sentido en Venta/Cobro (cuenta a cobrar) o
  // Compra/Pago (cuenta a pagar) — en Transferencia/Inversión/
  // Extracción no aplica ninguna de las dos.
  const tipoCuentaNueva: 'ACTIVO' | 'PASIVO' | null =
    operacion === 'VENTA' || operacion === 'COBRO' ? 'ACTIVO' : operacion === 'COMPRA' || operacion === 'PAGO' ? 'PASIVO' : null;

  async function handleCrearCuentaNueva() {
    if (!empresaId || !tipoCuentaNueva || !nombreCuentaNueva.trim() || !operacion || !categoria) return;

    setGuardandoCuentaNueva(true);
    setError('');

    try {
      const nombre = nombreCuentaNueva.trim();

      if (tipoCuentaNueva === 'ACTIVO') {
        // Cuenta a cobrar: mismo camino que "Formas de Pago" en
        // Configurações para una cuenta Activa nueva — cuelga de
        // CONTENEDOR_MEDIO_PAGO y se habilita para Venta/Cobro.
        const cuentaId = await crearCuentaParaMedioPago(empresaId, nombre, 'ACTIVO');
        await crearFormaPago(empresaId, nombre, cuentaId, ['VENTA', 'COBRO']);

        // Y también para COBRARLA después (ver
        // habilitarLiquidacionCuentaCobrar) — sin esto, la única forma
        // de "cobrarla" sería seguir aumentándola en vez de cancelarla.
        await habilitarLiquidacionCuentaCobrar(empresaId, cuentaId, nombre);
      } else {
        // Cuenta a pagar (Pasivo): crearCuentaParaMedioPago siempre
        // cuelga de CONTENEDOR_MEDIO_PAGO, que es de Activo — para un
        // Pasivo hay que usar crearPasivo, que busca el contenedor de
        // Pasivo real (mirando una deuda ya existente, ej. "Tarjeta")
        // y de paso habilita la forma de pago para Compra/Pago.
        await crearPasivo(empresaId, nombre);
      }

      await generarMatrizOperaciones(empresaId);

      // Recién generada la matriz, hay que releer tanto la lista de
      // formas de pago del combo (filtrada por operación + categoría
      // actual, igual que el efecto que la carga al elegir categoría)
      // como rubroPorCuenta/formasPagoUsablesParaGasto (los que
      // deciden si es "Cuenta por Cobrar"/Pasivo) — si no, quedaría
      // creada pero invisible o sin habilitar "En cuotas" hasta
      // recargar la página.
      const unicas = await obtenerFormasPagoOperacion(empresaId, operacion, categoria, nombre);
      setFormasPago(unicas);
      setFormaPago(nombre);

      await cargarDatosOperativos(empresaId);

      setCreandoCuentaNueva(false);
      setNombreCuentaNueva('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('errorRegistrar'));
    } finally {
      setGuardandoCuentaNueva(false);
    }
  }

  // Al editar una operación que ya tenía un cronograma de cuotas,
  // hay que precargarlo — si no, guardar la edición sin tildar "en
  // cuotas" de nuevo borraría el cronograma existente sin recrearlo
  // (ver limpiarOperacion en lib/motor, que lo limpia siempre).
  useEffect(() => {
    if (!empresaId || !modoEdicion || !idOperacionEditar) return;

    Promise.all([
      supabase
        .from('cuotas_pasivo')
        .select('total_cuotas')
        .eq('empresa_id', empresaId)
        .eq('id_operacion', idOperacionEditar)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('cuotas_cobro')
        .select('total_cuotas')
        .eq('empresa_id', empresaId)
        .eq('id_operacion', idOperacionEditar)
        .limit(1)
        .maybeSingle(),
    ]).then(([{ data: cuotaPasivo }, { data: cuotaCobro }]) => {
      const existente = cuotaPasivo ?? cuotaCobro;
      if (existente) {
        setEnCuotas(true);
        setCantidadCuotas(String(existente.total_cuotas));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, modoEdicion, idOperacionEditar]);

  useEffect(() => {
    if (formularioSimple) {
      setLineas((prev) => (prev.some((l) => l.cantidad !== 1) ? prev.map((l) => ({ ...l, cantidad: 1 })) : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formularioSimple]);

  // Al cambiar de categoría, "producto" puede haber quedado con el id
  // de un producto de la categoría anterior (o viceversa, un texto
  // libre) — se limpia para no arrastrar un valor que ya no aplica al
  // tipo de campo (select de producto vs. descripción libre) que
  // corresponde a la nueva categoría. No se aplica en el primer
  // render (al editar, ahí es donde llegan las líneas ya cargadas).
  const primerRenderCategoria = useRef(true);

  useEffect(() => {
    if (primerRenderCategoria.current) {
      primerRenderCategoria.current = false;
      return;
    }
    // formularioSimple no depende de la categoría en la mayoría de las
    // operaciones (PAGO/INVERSION/EXTRACCION/TRANSFERENCIA son
    // siempre simples), así que este efecto puede disparar sin que el
    // de arriba se vuelva a ejecutar — si no arrancara ya en 1 acá,
    // "cantidad > 0" nunca se cumple en el formulario simplificado y
    // el total queda pegado en 0 pase lo que pase con el monto.
    setLineas([{ producto: '', cantidad: formularioSimple ? 1 : 0, monto: 0, unidadCarga: '' }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria]);

  const etiquetaRelacionActual = etiquetaRelacion(idioma, esFamiliar, operacion);

  // El botón "Hacer el tutorial guiado" para empresas que ya operan
  // (voluntario, con salida) — arma la misma secuencia de 3 pasos que
  // el onboarding obligatorio, pero sin tocar onboarding_completado.
  //
  // El progreso SIEMPRE arranca en 0: no se mira el historial de
  // registro_operaciones para decidir qué pasos están "hechos", porque
  // una empresa que ya opera (o una nueva que ya probó el tutorial una
  // vez) puede tener de sobra Ventas/Compras/etc. de antes — mirar el
  // historial completo las contaba como parte de ESTE intento y
  // saltaba directo al final con solo cargar la primera operación.
  function activarTutorialVoluntario() {
    if (!empresaId) return;

    setOperacionesTutorial(pasosTutorial(esFamiliarEmpresa, manejaMercaderiaEmpresa));
    setTutorialVoluntario(true);
    setModoTutorial(true);
    setOfrecerTutorialVoluntario(false);
  }

  // Stock disponible por producto y saldo de cada cuenta financiera —
  // se usan para bloquear una Venta sin stock o un Pago/Compra que
  // dejaría una cuenta en negativo. Se separó del resto de la carga
  // inicial (que solo corre una vez, al montar) para poder volver a
  // pedirlos después de cada operación registrada: sin esto, quedaban
  // pegados en lo que había AL ENTRAR a la pantalla — una Compra que
  // recién le da stock a un producto no se reflejaba hasta recargar
  // la página entera, así que la Venta de eso mismo, en la misma
  // sesión, seguía viendo "stock: 0".
  async function cargarDatosOperativos(empresaIdActual: string) {
    const { data: prods } = await supabase
      .from('productos')
      .select('id, nombre, categoria, proveedor_id, tipo_producto, unidad_medida')
      .eq('empresa_id', empresaIdActual);

    const { data: movimientos } = await supabase
      .from('movimientos_stock')
      .select('producto_id, tipo, cantidad, fecha')
      .eq('empresa_id', empresaIdActual)
      .in('tipo', ['ENTRADA', 'SALIDA']);

    const { data: proveedoresData } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('empresa_id', empresaIdActual);

    setMovimientosStock(
      (movimientos ?? []).map((m) => ({
        producto_id: m.producto_id,
        tipo: m.tipo,
        cantidad: Number(m.cantidad ?? 0),
        fecha: m.fecha,
      }))
    );

    setNombreProveedorPorId(
      Object.fromEntries((proveedoresData ?? []).map((proveedor) => [proveedor.id, proveedor.nombre]))
    );

    setProductos(prods ?? []);

    // Saldo actual de cada cuenta financiera (Efectivo, Banco, Pix...)
    // — para poder bloquear un Pago/Compra/Extracción/Transferencia
    // que dejaría esa cuenta en negativo.
    const [
      { data: formasPagoData },
      { data: formaPagoCuentasData },
      { data: cuentasData },
      { data: operacionesParaSaldo },
      { data: automaticosParaSaldo },
      { data: formasPagoParaGasto },
      { data: categoriasOperacionData },
      { data: categoriasOperacionCuentasData },
    ] = await Promise.all([
      supabase.from('formas_pago').select('id, nombre').eq('empresa_id', empresaIdActual),
      supabase.from('forma_pago_cuentas').select('forma_pago_id, cuenta_id').eq('empresa_id', empresaIdActual).eq('activo', true),
      supabase.from('plan_cuentas').select('id, nombre, naturaleza, codigo').eq('empresa_id', empresaIdActual),
      supabase.from('registro_operaciones').select('cuenta_debito, cuenta_credito, total').eq('empresa_id', empresaIdActual),
      supabase.from('registros_automaticos').select('cuenta_debito, cuenta_credito, importe').eq('empresa_id', empresaIdActual),
      // Formas de pago habilitadas para Compra/Pago — una forma de
      // pago de Activo que NO está acá (ej. "Cuentas a Cobrar",
      // habilitada solo para Venta/Cobro) es una cuenta por cobrar,
      // no un medio financiero de verdad (Caja/Banco). Mismo criterio
      // que separa un Pasivo (habilitado solo para Compra/Pago) de
      // cualquier otra cuenta.
      supabase
        .from('matriz_operaciones')
        .select('forma_pago')
        .eq('empresa_id', empresaIdActual)
        .in('operacion', ['COMPRA', 'PAGO']),
      // Ver el mismo comentario más abajo sobre cuentaPorFormaPagoNombre
      // — hace falta para resolver el rubro de una Categoría cuya
      // etiqueta no coincide con el nombre de la cuenta que tiene
      // detrás (ej. un Pasivo personalizado como "Préstamos Santander"
      // detrás de la categoría genérica "Préstamos Personales").
      supabase.from('categorias_operacion').select('id, nombre').eq('empresa_id', empresaIdActual),
      supabase
        .from('categorias_operacion_cuentas')
        .select('categoria_operacion_id, cuenta_id')
        .eq('empresa_id', empresaIdActual)
        .eq('activo', true),
    ]);

    const nombreCuentaPorId = new Map((cuentasData ?? []).map((c) => [c.id, c.nombre]));
    const naturalezaPorNombre = new Map((cuentasData ?? []).map((c) => [c.nombre, c.naturaleza]));
    const cuentaIdPorFormaPagoId = new Map((formaPagoCuentasData ?? []).map((f) => [f.forma_pago_id, f.cuenta_id]));

    const cuentaPorFormaPagoNombre: Record<string, string> = {};
    for (const fp of formasPagoData ?? []) {
      const cuentaId = cuentaIdPorFormaPagoId.get(fp.id);
      const cuentaNombre = cuentaId ? nombreCuentaPorId.get(cuentaId) : undefined;
      if (cuentaNombre) {
        cuentaPorFormaPagoNombre[fp.nombre] = cuentaNombre;
      }
    }

    const saldoPorCuenta: Record<string, number> = {};

    function acumularSaldo(cuenta: string | null | undefined, importe: number, esDebito: boolean) {
      if (!cuenta) return;
      const naturaleza = naturalezaPorNombre.get(cuenta);
      const signo = naturaleza === 'ACREEDORA' ? (esDebito ? -1 : 1) : esDebito ? 1 : -1;
      saldoPorCuenta[cuenta] = (saldoPorCuenta[cuenta] ?? 0) + importe * signo;
    }

    for (const fila of operacionesParaSaldo ?? []) {
      acumularSaldo(fila.cuenta_debito, Number(fila.total ?? 0), true);
      acumularSaldo(fila.cuenta_credito, Number(fila.total ?? 0), false);
    }

    for (const fila of automaticosParaSaldo ?? []) {
      acumularSaldo(fila.cuenta_debito, Number(fila.importe ?? 0), true);
      acumularSaldo(fila.cuenta_credito, Number(fila.importe ?? 0), false);
    }

    setCuentaPorFormaPago(cuentaPorFormaPagoNombre);
    setSaldoPorCuentaFinanciera(saldoPorCuenta);
    setNaturalezaPorCuentaFinanciera(Object.fromEntries(naturalezaPorNombre));

    // El primer dígito del código del plan de cuentas es el rubro
    // (1=Activo, 2=Pasivo, 3=Patrimonio, 4=Ingreso, 5=Costo,
    // 6=Gasto) — mismo criterio que ya usa el plan de cuentas maestro.
    const digitoPorCuenta = new Map(
      (cuentasData ?? []).filter((c) => c.codigo).map((c) => [c.nombre, String(c.codigo).charAt(0)])
    );

    const rubroPorNombre: Record<string, string> = Object.fromEntries(digitoPorCuenta);

    // En Transferencia, el selector muestra la etiqueta de la forma de
    // pago (formas_pago.nombre) y no necesariamente el nombre de la
    // cuenta contable detrás — si no coinciden (ej. una forma de pago
    // vieja con un nombre distinto al de su cuenta), esa etiqueta
    // quedaba sin rubro asignado y cae en "Otras". Se agrega también
    // el rubro de la cuenta real detrás de cada forma de pago, indexado
    // por la etiqueta que el usuario ve.
    for (const [formaPagoNombre, cuentaNombre] of Object.entries(cuentaPorFormaPagoNombre)) {
      const digito = digitoPorCuenta.get(cuentaNombre);
      if (digito) {
        rubroPorNombre[formaPagoNombre] = digito;
      }
    }

    // Mismo caso que arriba, pero del lado de Categoría: una categoría
    // de Pasivo personalizada (ej. "Préstamos Personales" apuntando a
    // una cuenta que el usuario renombró a "Préstamos Santander") tenía
    // una etiqueta distinta a la de su cuenta y quedaba sin rubro,
    // agrupada en "Otras" en vez de "Pasivo".
    const cuentaIdPorCategoriaId = new Map(
      (categoriasOperacionCuentasData ?? []).map((c) => [c.categoria_operacion_id, c.cuenta_id])
    );

    for (const categoria of categoriasOperacionData ?? []) {
      const cuentaId = cuentaIdPorCategoriaId.get(categoria.id);
      const cuentaNombre = cuentaId ? nombreCuentaPorId.get(cuentaId) : undefined;
      const digito = cuentaNombre ? digitoPorCuenta.get(cuentaNombre) : undefined;
      if (digito) {
        rubroPorNombre[categoria.nombre] = digito;
      }
    }

    setRubroPorCuenta(rubroPorNombre);
    setFormasPagoUsablesParaGasto(new Set((formasPagoParaGasto ?? []).map((f) => f.forma_pago)));
  }

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
        setError(t('errorSinEmpresa'));
        setCargandoInicial(false);
        return;
      }

      setEmpresaId(perfil.empresa_id);

      const [onboardingCompleto, manejaMercaderia, empresaPerfil] = await Promise.all([
        empresaTieneOnboardingCompleto(perfil.empresa_id),
        empresaManejaMercaderia(perfil.empresa_id),
        supabase
          .from('empresas')
          .select('nombre, perfiles_empresa(codigo)')
          .eq('id', perfil.empresa_id)
          .maybeSingle(),
      ]);

      setNombreEmpresa(
        (empresaPerfil.data as unknown as { nombre?: string } | null)?.nombre ?? ''
      );

      // No se usa el "esFamiliar" del contexto acá: ese lo carga
      // ContabilidadPage con su propia consulta async, en paralelo a
      // este efecto — cuando este efecto arranca (montaje del tab),
      // ese fetch todavía no resolvió y el contexto trae el valor
      // inicial (false), sin importar que se actualice después: este
      // efecto corre una sola vez y ya quedó con ese valor stale en
      // el closure. Por eso se resuelve acá de nuevo, con datos
      // frescos, en vez de confiar en el contexto para esta cuenta.
      const empresaEsFamiliar =
        (empresaPerfil.data as unknown as { perfiles_empresa?: { codigo: string } | null } | null)
          ?.perfiles_empresa?.codigo === 'FAMILIAR';

      setManejaMercaderiaEmpresa(manejaMercaderia);
      setEsFamiliarEmpresa(empresaEsFamiliar);

      const tutorialPedidoPorUrl =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('tutorial') === '1';
      const quiereTutorial = !onboardingCompleto || tutorialPedidoPorUrl;

      if (!modoEdicion && onboardingCompleto && !tutorialPedidoPorUrl) {
        // Empresa ya operativa, entrando normalmente (sin pedir el
        // tutorial por URL): se le ofrece la opción de hacerlo de
        // nuevo/por primera vez de forma voluntaria, con un botón
        // discreto — nunca se le fuerza.
        setOfrecerTutorialVoluntario(true);
      }

      if (quiereTutorial && !modoEdicion) {
        setOperacionesTutorial(pasosTutorial(empresaEsFamiliar, manejaMercaderia));
        setTutorialVoluntario(onboardingCompleto);
        setModoTutorial(true);
      }

      const { data: ops } = await supabase
        .from('operaciones')
        .select('nombre')
        .eq('empresa_id', perfil.empresa_id)
        .eq('activo', true);

      setOperaciones((ops ?? []).map((o) => o.nombre));

      await cargarDatosOperativos(perfil.empresa_id);

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
        .select('categoria, stock')
        .eq('empresa_id', empresaId)
        .eq('operacion', operacion);

      if (errorCategorias) {
        console.error('ERROR CARGANDO CATEGORÍAS:', errorCategorias);
        setError(msgErrorCategorias(idioma, errorCategorias.message));
        return;
      }

      const unicas = Array.from(new Set((data ?? []).map((f) => f.categoria).filter(Boolean))) as string[];

      setCategorias(unicas);
      setStockPorCategoria(Object.fromEntries((data ?? []).map((f) => [f.categoria, f.stock])));

      if (hidratarCategoria.current) {
        hidratarCategoria.current = false;
        setCategoria(valoresIniciales?.categoria ?? '');
        // No se resetea Forma de Pago acá: al editar, ese trabajo lo
        // hace (con la misma bandera) el efecto de abajo. Si se
        // reseteara igual acá, una carrera entre los dos fetches
        // async podía pisar la Forma de Pago ya hidratada — quedaba
        // vacía y sin opciones para elegir, igual que el bug que ya
        // se había resuelto para clienteProveedor con hidratarContacto.
      } else {
        // Si hay una única categoría posible (ej. Aporte/Retiro), no
        // tiene sentido pedirla: se preselecciona sola, igual que hace
        // Sabio Bot en la misma situación.
        setCategoria(unicas.length === 1 ? unicas[0] : '');
        setFormaPago('');
        setFormasPago([]);
      }

      setError('');
    }

    cargarCategorias();

    setMensajeSabio(msgElegirCategoria(idioma, operacion, esFamiliar));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, operacion]);

  useEffect(() => {
    if (!empresaId || !operacion || !categoria) {
      setFormasPago([]);
      return;
    }

    async function cargarFormasPago() {
      let unicas: string[];
      try {
        unicas = await obtenerFormasPagoOperacion(empresaId as string, operacion, categoria, valoresIniciales?.formaPago);
      } catch (errorFormas) {
        console.error('ERROR CARGANDO FORMAS DE PAGO:', errorFormas);
        setError(msgErrorFormasPago(idioma, (errorFormas as { message?: string }).message ?? ''));
        return;
      }

      setFormasPago(unicas);

      if (hidratarFormaPago.current) {
        hidratarFormaPago.current = false;
        setFormaPago(valoresIniciales?.formaPago ?? '');
      } else {
        setFormaPago('');
        setMensajeSabio(msgElegirFormaPago(idioma));
      }

      setError('');
    }

    cargarFormasPago();
  }, [empresaId, operacion, categoria]);

  // Saldo de las categorías que son una deuda (al pagar) o algo por cobrar (al
  // cobrar), al lado de cada opción de la lista — igual que en el mini juego y
  // en Sabio Bot (ver saldosDeCategorias).
  useEffect(() => {
    if (!empresaId || !operacion || categorias.length === 0) {
      setSaldosPorCategoria({});
      return;
    }

    let cancelado = false;

    saldosDeCategorias(empresaId, operacion, categorias, fecha)
      .then((saldos) => {
        if (!cancelado) setSaldosPorCategoria(saldos);
      })
      .catch(() => {
        if (!cancelado) setSaldosPorCategoria({});
      });

    return () => {
      cancelado = true;
    };
  }, [empresaId, operacion, categorias, fecha]);

  // Saldo en vivo de la cuenta detrás de la Categoría (o "Hacia
  // Cuenta" en Transferencia) — para CUALQUIER operación, siempre que
  // resuelva a una cuenta de Activo o Pasivo (lo demás lo filtra
  // saldoDeCategoria/saldoDeFormaDePago, que devuelven null para
  // Ingreso/Gasto/Costo/Patrimonio o para un Plazo Fijo/Inversión que
  // no tiene forma de pago detrás). En Transferencia el "Hacia" es una
  // forma de pago, no una categoría de verdad, por eso ese caso usa
  // saldoDeFormaDePago igual que el origen.
  useEffect(() => {
    if (!empresaId || !categoria) {
      setSaldoDestino(null);
      return;
    }

    let cancelado = false;

    const promesa = esTransferencia
      ? saldoEnTransferencia(empresaId, categoria, fecha)
      : saldoDeCategoria(empresaId, categoria, operacion, fecha);

    promesa.then((resultado) => {
      if (!cancelado) setSaldoDestino(resultado);
    });

    return () => {
      cancelado = true;
    };
  }, [empresaId, esTransferencia, categoria, operacion, fecha]);

  // Saldo en vivo de la cuenta detrás de la forma de pago — para
  // CUALQUIER operación (mismo criterio que arriba: si no es una
  // cuenta de Activo/Pasivo, simplemente no devuelve nada que mostrar).
  useEffect(() => {
    if (!empresaId || !formaPago) {
      setSaldoOrigen(null);
      return;
    }

    let cancelado = false;

    const promesa = esTransferencia
      ? saldoEnTransferencia(empresaId, formaPago, fecha)
      : saldoDeFormaDePago(empresaId, formaPago, fecha);

    promesa.then((resultado) => {
      if (!cancelado) setSaldoOrigen(resultado);
    });

    return () => {
      cancelado = true;
    };
  }, [empresaId, esTransferencia, formaPago, fecha]);

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
        const { data } = await supabase
          .from('socios')
          .select('nombre')
          .eq('empresa_id', empresaId)
          .eq('activo', true);

        setContactos(Array.from(new Set((data ?? []).map((s) => s.nombre).filter(Boolean))));
      } else if (esProveedor || esCliente) {
        const tabla = esProveedor ? 'proveedores' : 'clientes';

        const { data } = await supabase.from(tabla).select('nombre').eq('empresa_id', empresaId);

        setContactos(Array.from(new Set((data ?? []).map((contacto) => contacto.nombre).filter(Boolean))));
      } else {
        setContactos([]);
      }

      if (hidratarContacto.current) {
        hidratarContacto.current = false;
        setClienteProveedor(valoresIniciales?.clienteProveedor ?? '');
      } else {
        setClienteProveedor('');
      }
    }

    cargarContactos();
  }, [empresaId, operacion]);

  // Socio/a que generó el ingreso — solo aplica a Cobro en perfil
  // Familia. Es un dato aparte de la Fuente de ingreso: la fuente es
  // quién pagó (empleador, cliente), el socio es quién de la familia
  // lo cobró. Se resuelve en el mismo efecto que "contactos" (no en
  // uno propio) porque ambos leen la misma bandera hidratarContacto,
  // y dos efectos async separados podrían resolverla en cualquier
  // orden y pisarse entre sí al editar una operación existente.
  useEffect(() => {
    if (!empresaId || operacion !== 'COBRO' || !esFamiliar) {
      setSociosIngreso([]);
      setSocio('');
      return;
    }

    async function cargarSociosIngreso() {
      const { data } = await supabase
        .from('socios')
        .select('nombre')
        .eq('empresa_id', empresaId)
        .eq('activo', true);

      setSociosIngreso(Array.from(new Set((data ?? []).map((s) => s.nombre).filter(Boolean))));
      setSocio(valoresIniciales?.socio ?? '');
    }

    cargarSociosIngreso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, operacion, esFamiliar]);

  function actualizarLinea(indice: number, campo: keyof LineaOperacion, valor: string) {
    setLineas((prev) =>
      prev.map((linea, i) =>
        i === indice
          ? {
              ...linea,
              [campo]: campo === 'producto' ? valor : Number(valor),
              // La unidad de carga arranca siempre en la unidad
              // general del producto — el operador puede después
              // pasarla a la alternativa de compra (Kilogramo,
              // Mililitro, Centímetro) si le resulta más cómodo.
              ...(campo === 'producto'
                ? { unidadCarga: productos.find((p) => p.id === valor)?.unidad_medida ?? '' }
                : {}),
            }
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

  function actualizarUnidadCarga(indice: number, unidad: string) {
    setLineas((prev) => prev.map((linea, i) => (i === indice ? { ...linea, unidadCarga: unidad } : linea)));
  }

  function agregarLinea() {
    setLineas((prev) => [
      ...prev,
      { producto: '', cantidad: formularioSimple ? 1 : 0, monto: 0, unidadCarga: '' },
    ]);
  }

  // Escaneo con la cámara — busca el producto por su código de barras
  // (cargado en Mercadería) y agrega/incrementa la línea sola, sin
  // tener que buscarlo en el desplegable. Si ya está en la lista, solo
  // suma +1 a la cantidad (útil para varias unidades del mismo
  // producto en una venta con mucho movimiento).
  async function manejarEscaneoLinea(codigo: string) {
    setEscaneandoVenta(false);
    setErrorEscaneo('');

    if (!empresaId) return;

    try {
      const producto = await buscarProductoPorCodigoBarras(empresaId, codigo);

      if (!producto) {
        setErrorEscaneo(
          idioma === 'PT'
            ? 'Código não encontrado — cadastre o produto em Mercadoria primeiro.'
            : 'Código no encontrado — dalo de alta en Mercadería primero.'
        );
        return;
      }

      const productoCompleto = productos.find((p) => p.id === producto.id);

      if (categoria && (productoCompleto?.categoria ?? '').toUpperCase() !== categoria.toUpperCase()) {
        setErrorEscaneo(
          idioma === 'PT'
            ? `"${producto.nombre}" é de outra categoria — não é da categoria escolhida agora.`
            : `"${producto.nombre}" es de otra categoría — no corresponde a la categoría elegida ahora.`
        );
        return;
      }

      setLineas((prev) => {
        const yaExiste = prev.some((l) => l.producto === producto.id);

        if (yaExiste) {
          return prev.map((l) => (l.producto === producto.id ? { ...l, cantidad: (l.cantidad || 0) + 1 } : l));
        }

        const nuevaLinea = {
          producto: producto.id,
          cantidad: 1,
          monto: 0,
          unidadCarga: productoCompleto?.unidad_medida ?? '',
        };

        // Si la primera línea todavía está vacía, la usa en vez de
        // agregar una nueva — así escanear el primer producto no deja
        // una fila en blanco arriba.
        if (prev.length === 1 && !prev[0].producto) {
          return [nuevaLinea];
        }

        return [...prev, nuevaLinea];
      });
    } catch (e) {
      console.error('Error buscando el producto escaneado:', e);
      setErrorEscaneo(idioma === 'PT' ? 'Erro ao buscar o produto.' : 'Error buscando el producto.');
    }
  }

  function eliminarLinea(indice: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== indice) : prev));
  }

  // En cualquier línea con producto real (Compra, Venta, Pérdida —
  // todo lo que usa el selector de producto en vez de texto libre),
  // lo natural es tipear lo que se pagó o cobró en TOTAL por esa
  // línea, no un precio por unidad — así que ese monto no se
  // multiplica por la cantidad, ni acá ni al registrar la operación
  // (ver handleRegistrar). El precio por unidad se sigue calculando
  // internamente (total ÷ cantidad) antes de llamar al motor, así la
  // validación de "no vender por debajo del costo" sigue funcionando
  // igual que siempre.
  const montoEsTotalDeLinea = operacionesConProducto;

  const total = lineas.reduce(
    (s, linea) => s + (montoEsTotalDeLinea ? Number(linea.monto) : linea.cantidad * linea.monto),
    0
  );

  const esSalidaStock = (operacion === 'VENTA' || operacion === 'PERDIDA') && categoriaEsProducto;

  // Stock disponible por producto A LA FECHA elegida (no el de hoy):
  // suma ENTRADA y resta SALIDA de todos los movimientos con fecha <=
  // la del formulario, igual que hace la validación real en el motor.
  const saldoPorProductoAFecha = useMemo(() => {
    const saldos: Record<string, number> = {};

    for (const movimiento of movimientosStock) {
      if (movimiento.fecha > fecha) continue;

      const signo = movimiento.tipo === 'ENTRADA' ? 1 : -1;
      saldos[movimiento.producto_id] = (saldos[movimiento.producto_id] ?? 0) + signo * movimiento.cantidad;
    }

    return saldos;
  }, [movimientosStock, fecha]);

  const stockInsuficiente =
    esSalidaStock &&
    lineas.some((linea) => linea.producto && linea.cantidad > (saldoPorProductoAFecha[linea.producto] ?? 0));

  // Pago, Compra, Extracción y Transferencia le "sacan" plata a un
  // medio de pago (Efectivo, Banco, Pix...). Si ese medio es una
  // cuenta de Activo (naturaleza DEUDORA — plata real que se tiene),
  // no puede quedar en negativo: eso es imposible en la vida real,
  // igual que vender stock que no existe. Si el medio es una cuenta
  // de Pasivo (ej. una tarjeta de crédito), no se bloquea — ahí ir
  // "para abajo" es justamente lo esperado (se está usando crédito).
  const OPERACIONES_QUE_RESTAN_MEDIO = ['PAGO', 'COMPRA', 'EXTRACCION', 'TRANSFERENCIA'];

  const cuentaMedioActual = cuentaPorFormaPago[formaPago];
  const naturalezaMedioActual = cuentaMedioActual ? naturalezaPorCuentaFinanciera[cuentaMedioActual] : undefined;

  // Al editar, el saldo cargado ya tiene descontado el monto VIEJO de
  // esta misma operación (porque se trajo de todo registro_operaciones,
  // incluida ella). Si no se lo devolviéramos, se compararía contra un
  // saldo más bajo del real y podría bloquear una edición válida.
  const totalOriginalMismaCuenta =
    modoEdicion &&
    valoresIniciales &&
    OPERACIONES_QUE_RESTAN_MEDIO.includes(valoresIniciales.operacion) &&
    cuentaPorFormaPago[valoresIniciales.formaPago] === cuentaMedioActual
      ? valoresIniciales.lineas.reduce((s, l) => s + l.cantidad * l.monto, 0)
      : 0;

  const saldoMedioActual = cuentaMedioActual
    ? (saldoPorCuentaFinanciera[cuentaMedioActual] ?? 0) + totalOriginalMismaCuenta
    : 0;

  const saldoMedioInsuficiente =
    OPERACIONES_QUE_RESTAN_MEDIO.includes(operacion) &&
    Boolean(cuentaMedioActual) &&
    naturalezaMedioActual === 'DEUDORA' &&
    total > 0 &&
    saldoMedioActual - total < 0;

  const lineasCompletas =
    lineas.length > 0 &&
    lineas.every((linea) => linea.producto.trim() && linea.cantidad > 0 && linea.monto > 0);

  const requiereSocio = esFamiliar && operacion === 'COBRO';

  const camposCompletos = Boolean(
    fecha &&
      operacion &&
      categoria &&
      formaPago &&
      // En Venta el histórico se numera solo (ver más abajo) y su
      // input queda oculto — nunca debe bloquear el registro.
      (formularioSimple || operacion === 'VENTA' || historico.trim()) &&
      // Para el perfil Familiar, "destino de pago"/"fuente de
      // ingreso" ya no es obligatorio: la categoría (que además ahora
      // viene precargada de fábrica) alcanza para describir el
      // movimiento — no hace falta además nombrar una contraparte.
      (esTransferencia || esFamiliar || clienteProveedor.trim()) &&
      (!requiereSocio || socio.trim()) &&
      lineasCompletas &&
      !stockInsuficiente &&
      !saldoMedioInsuficiente
  );

  // Guía paso a paso de "Sabio" (mensaje verde) una vez que ya se
  // eligió operación, categoría y forma de pago: en ese punto el
  // siguiente campo a completar depende de qué pide cada operación
  // (Nota Fiscal, cliente/proveedor, socio, o directo el detalle), así
  // que se recalcula acá en un solo lugar en vez de un mensaje fijo.
  // No corre en modo edición (ahí el mensaje es "Editando la
  // operación X") ni mientras no haya operación/categoría/forma de
  // pago elegidos (esos pasos ya tienen su propio mensaje puesto en
  // los efectos de arriba).
  useEffect(() => {
    if (modoEdicion || !operacion || !categoria || !formaPago) {
      return;
    }

    if (!formularioSimple && operacion !== 'VENTA' && !historico.trim()) {
      setMensajeSabio(msgCompletarHistorico(idioma));
      return;
    }

    if (!esTransferencia && !esFamiliar && !clienteProveedor.trim()) {
      setMensajeSabio(msgCompletarRelacion(idioma, etiquetaRelacionActual));
      return;
    }

    if (requiereSocio && !socio.trim()) {
      setMensajeSabio(msgCompletarSocio(idioma));
      return;
    }

    if (!lineasCompletas) {
      setMensajeSabio(msgCompletarDetalle(idioma));
      return;
    }

    if (!stockInsuficiente && !saldoMedioInsuficiente) {
      setMensajeSabio(msgListoParaRegistrar(idioma));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modoEdicion,
    operacion,
    categoria,
    formaPago,
    formularioSimple,
    historico,
    esTransferencia,
    esFamiliar,
    clienteProveedor,
    requiereSocio,
    socio,
    lineasCompletas,
    stockInsuficiente,
    saldoMedioInsuficiente,
  ]);

  async function handleRegistrar() {
    if (!empresaId) return;

    setError('');
    setGuardando(true);

    try {
      // Cuando la categoría maneja stock, el <select> de producto
      // guarda el id (uuid) en linea.producto, no el nombre — hay que
      // resolverlo contra `productos` para armar una descripción
      // legible (ej. para el detalle del comprobante de WhatsApp).
      const nombreDeLinea = (valor: string) =>
        (operacionesConProducto ? productos.find((p) => p.id === valor)?.nombre : null) ?? valor;

      const formulario = {
        fecha: fecha.trim(),
        operacion: operacion.trim(),
        categoria: categoria.trim(),
        formaPago: formaPago.trim(),
        // En Venta el input de histórico queda oculto (se numera solo
        // más abajo, con el id_operacion) — igual conviene armar acá
        // una descripción a partir de los productos/categoría, porque
        // se usa como "detalle" del comprobante de WhatsApp.
        historico:
          operacion === 'VENTA'
            ? lineas.map((l) => nombreDeLinea(l.producto.trim())).filter(Boolean).join(' / ') || categoria.trim()
            : formularioSimple
              ? historico.trim() || lineas.map((l) => nombreDeLinea(l.producto.trim())).filter(Boolean).join(' / ') || categoria.trim()
              : historico.trim(),
        clienteProveedor: clienteProveedor.trim(),
        socio: requiereSocio ? socio.trim() : '',
        lineas: lineas.map((linea) => {
          const productoElegido = productos.find((p) => p.id === linea.producto.trim());
          const unidadGeneral = productoElegido?.unidad_medida ?? '';
          const cantidad = Number(linea.cantidad);
          const monto = Number(linea.monto);

          // Si el operador tipeó la cantidad en la unidad de compra
          // (ej. Kilogramo) en vez de la unidad general del producto
          // (ej. Gramo), se convierte acá antes de registrar — el
          // stock y la receta siempre quedan en la unidad general.
          const cantidadEnUnidadGeneral =
            linea.unidadCarga && unidadGeneral && linea.unidadCarga !== unidadGeneral
              ? convertirCantidad(cantidad, linea.unidadCarga, unidadGeneral)
              : cantidad;

          // registrarOperacion siempre calcula el total de la línea
          // como cantidad × monto, asumiendo que monto es un costo o
          // precio por unidad de stock. Acá lo que se tipeó en Monto
          // es el TOTAL pagado/cobrado por esa línea — se despeja el
          // valor por unidad de stock para que cantidad × monto vuelva
          // a dar ese mismo total (y la validación de costo de motor.ts,
          // que compara ese valor por unidad contra el costo, siga
          // funcionando igual que siempre).
          const montoParaMotor = montoEsTotalDeLinea
            ? (cantidadEnUnidadGeneral > 0 ? monto / cantidadEnUnidadGeneral : 0)
            : monto;

          return {
            producto: linea.producto.trim(),
            cantidad: cantidadEnUnidadGeneral,
            monto: montoParaMotor,
          };
        }),
      };

      if (modoEdicion && idOperacionEditar) {
        const resultadoEdicion = await editarOperacion(empresaId, idOperacionEditar, formulario);

        // editarOperacion borra y vuelve a generar la operación bajo
        // el mismo id_operacion — eso ya se llevó puesto el cronograma
        // de cuotas viejo (ver limpiarOperacion en lib/motor), así que
        // si seguía marcada "en cuotas" hay que rearmarlo de cero.
        if (puedeEnCuotas && enCuotas) {
          const cantidad = Number(cantidadCuotas);

          if (Number.isInteger(cantidad) && cantidad >= 1) {
            if (esCuentaPorCobrar) {
              await crearCuotasCobro(empresaId, idioma, {
                idOperacion: idOperacionEditar,
                formaPagoNombre: formulario.formaPago,
                total: resultadoEdicion.total,
                cantidadCuotas: cantidad,
                fechaVenta: formulario.fecha,
              });
            } else {
              await crearCuotasPasivo(empresaId, idioma, {
                idOperacion: idOperacionEditar,
                formaPagoNombre: formulario.formaPago,
                total: resultadoEdicion.total,
                cantidadCuotas: cantidad,
                fechaCompra: formulario.fecha,
              });
            }
          }
        }

        setMensajeSabio(msgOperacionActualizada(idioma));
        onGuardado?.();
        return;
      }

      const resultado = await registrarOperacion(empresaId, formulario);

      if (recordatorioGastoRecurrente) {
        try {
          await registrarPagoParcial(empresaId, recordatorioGastoRecurrente, resultado.idOperacion, resultado.total, formulario.fecha);
        } catch (errorRecordatorio) {
          console.warn('No se pudo actualizar el saldo del gasto recurrente:', errorRecordatorio);
        }
      }

      if (puedeEnCuotas && enCuotas) {
        const cantidad = Number(cantidadCuotas);

        if (Number.isInteger(cantidad) && cantidad >= 1) {
          if (esCuentaPorCobrar) {
            await crearCuotasCobro(empresaId, idioma, {
              idOperacion: resultado.idOperacion,
              formaPagoNombre: formulario.formaPago,
              total: resultado.total,
              cantidadCuotas: cantidad,
              fechaVenta: formulario.fecha,
            });
          } else {
            await crearCuotasPasivo(empresaId, idioma, {
              idOperacion: resultado.idOperacion,
              formaPagoNombre: formulario.formaPago,
              total: resultado.total,
              cantidadCuotas: cantidad,
              fechaCompra: formulario.fecha,
            });
          }
        }
      }

      // En Venta, el histórico pasa a ser el número de comprobante
      // (el id_operacion recién asignado) en vez del texto/producto
      // que se haya usado para armar la operación — ver el aviso en
      // el formulario más abajo. formulario.historico (la descripción
      // original) se sigue usando tal cual para el "detalle" del
      // mensaje de WhatsApp, no se pierde.
      if (formulario.operacion === 'VENTA') {
        try {
          await supabase
            .from('registro_operaciones')
            .update({ historico: resultado.idOperacion })
            .eq('empresa_id', empresaId)
            .eq('id_operacion', resultado.idOperacion);
        } catch (errorNumerar) {
          console.warn('No se pudo numerar el comprobante:', errorNumerar);
        }
      }

      // Sin esto, el stock y los saldos de cuentas financieras que se
      // ven en pantalla quedaban pegados en lo que había al entrar a
      // la pestaña — una Compra que le da stock a un producto no se
      // reflejaba hasta recargar la página entera, así que vender ese
      // mismo producto en la misma sesión seguía viendo "stock: 0".
      await cargarDatosOperativos(empresaId);

      setMensajeSabio(msgOperacionRegistrada(idioma));

      // Comprobante por WhatsApp: solo tiene sentido en Venta/Cobro
      // (hay un cliente real elegido de RH, no un texto libre — ver el
      // <select> de "contactos" más abajo) y solo si ese cliente tiene
      // teléfono cargado. No es automático: se abre WhatsApp con el
      // mensaje ya armado y el emprendedor toca Enviar — no hay
      // integración de WhatsApp Business API (ver lib/whatsapp.ts).
      setComprobanteWhatsapp(null);

      if (
        (formulario.operacion === 'VENTA' || formulario.operacion === 'COBRO') &&
        formulario.clienteProveedor
      ) {
        try {
          const telefono = await buscarTelefonoCliente(empresaId, formulario.clienteProveedor);

          if (empresaTieneTelefonoValido(telefono)) {
            const mensaje = armarMensajeComprobante({
              idioma,
              nombreEmpresa: nombreEmpresa || (idioma === 'PT' ? 'Meu Negócio' : 'Mi Negocio'),
              numeroComprobante: resultado.idOperacion,
              fecha: formulario.fecha,
              cliente: formulario.clienteProveedor,
              detalle: formulario.historico,
              formaPago: formulario.formaPago,
              total: resultado.total,
              simboloMoneda: simbolo,
            });

            setComprobanteWhatsapp({
              cliente: formulario.clienteProveedor,
              enlace: enlaceWhatsapp(telefono as string, mensaje),
            });
          }
        } catch (errorWhatsapp) {
          console.warn('No se pudo preparar el comprobante por WhatsApp:', errorWhatsapp);
        }
      }

      setOperacion('');
      setCategoria('');
      setFormaPago('');
      setHistorico('');
      setClienteProveedor('');
      setSocio('');
      setEnCuotas(false);
      setCantidadCuotas('2');

      setLineas([{ producto: '', cantidad: 0, monto: 0, unidadCarga: '' }]);
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

        setError(mensaje || t('errorRegistrar'));
      } else {
        setError(t('errorRegistrar'));
      }
    } finally {
      setGuardando(false);
    }
  }

  if (cargandoInicial) {
    return <p style={{ padding: 24 }}>{t('cargando')}</p>;
  }

  // El tutorial guiado (Fase 3 del onboarding) ya no se muestra como
  // un modal encima del formulario de Central de Lançamentos: se
  // reemplaza por completo con el Mini-Juego, mismo motor
  // (registrarOperacion) pero como tarjetas en vez de formulario —
  // le pareció mejor método para las primeras operaciones que
  // cualquier empresa nueva tiene que cargar. Acá simplemente NO se
  // renderiza nada de lo que sigue mientras dure.
  const enTutorial = !modoEdicion && modoTutorial;

  if (enTutorial && empresaId) {
    return (
      <MiniJuego
        empresaId={empresaId}
        idioma={idioma ?? 'ES'}
        esFamiliar={esFamiliar}
        simbolo={simbolo}
        colores={{ azul: COLORES.azul, verde: COLORES.verde, acento: COLORES.gris, blanco: COLORES.blanco }}
        tutorial={{
          operaciones: operacionesTutorial,
          mensaje: (paso) => msgTutorialPaso(idioma, paso, operacionesTutorial[paso] ?? ''),
        }}
        onCompletadoTutorial={async () => {
          if (!tutorialVoluntario) {
            await marcarOnboardingCompleto(empresaId);
          }
          setModoTutorial(false);
          router.push('/panel-de-control?tutorial=1');
        }}
        onCerrar={async () => {
          if (tutorialVoluntario) {
            setModoTutorial(false);
            setOfrecerTutorialVoluntario(true);
          } else {
            await supabase.auth.signOut();
            router.push('/login');
          }
        }}
      />
    );
  }

  return (
    <div>
      <div style={panelTitulo}>
        <div>
          <p style={eyebrowVerde}>{modoEdicion ? t('editandoOperacion') : t('nuevoRegistro')}</p>

          <h2 style={{ margin: 0, color: COLORES.azul, fontSize: 21 }}>
            {modoEdicion ? tituloOperacion(idioma, idOperacionEditar!) : t('cargaOperacion')}
          </h2>
        </div>

        <span style={estadoActivo}>{t('sistemaActivo')}</span>
      </div>

      {ofrecerTutorialVoluntario && !modoTutorial && (
        <button
          type="button"
          onClick={activarTutorialVoluntario}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: '#f0fdf4',
            border: '1px dashed #86efac',
            borderRadius: 12,
            padding: '10px 14px',
            color: '#166534',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 18,
          }}
        >
          {t('ofrecerTutorial')}
        </button>
      )}

      {modoEdicion && (
        <p style={{ fontSize: 12.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '9px 12px', marginBottom: 16 }}>
          {t('avisoEdicion')}
        </p>
      )}

      <div style={grid2}>
        <Campo label={t('labelFecha')}>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={campoInput}
          />
        </Campo>

        <Campo label={t('labelOperacion')}>
          <select value={operacion} onChange={(e) => setOperacion(e.target.value)} style={campoInput}>
            <option value="">{t('seleccionar')}</option>

            {operaciones.map((op) => (
              <option key={op} value={op}>
                {nombreOperacionDisplay(idioma, op, esFamiliar)}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label={esTransferencia ? t('labelHaciaCuenta') : t('labelCategoria')}>
          {categorias.length === 1 ? (
            <span
              style={{
                ...campoInput,
                display: 'flex',
                alignItems: 'center',
                color: COLORES.gris,
                background: '#f1f5f9',
              }}
            >
              {categorias[0]}
            </span>
          ) : (
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              disabled={!operacion}
              style={campoInput}
            >
              <option value="">{t('seleccionar')}</option>

              {agruparCategoriasPorRubro(categorias, rubroPorCuenta, idioma).map((grupo) => (
                <optgroup key={grupo.rubro} label={grupo.rubro}>
                  {grupo.categorias.map((c) => (
                    <option key={c} value={c}>
                      {c in saldosPorCategoria ? `${c} — ${simbolo} ${formatearNumeroEntero(saldosPorCategoria[c])}` : c}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}

          {saldoDestino && <TextoSaldo idioma={idioma} simbolo={simbolo} fecha={fecha} saldo={saldoDestino} />}
        </Campo>

        <Campo label={esTransferencia ? t('labelDesdeCuenta') : t('labelFormaPago')}>
          <select
            value={formaPago}
            onChange={(e) => {
              if (e.target.value === OPCION_CREAR_CUENTA_NUEVA) {
                setCreandoCuentaNueva(true);
                return;
              }
              setFormaPago(e.target.value);
            }}
            disabled={!categoria}
            style={campoInput}
          >
            <option value="">{t('seleccionar')}</option>

            {agruparCategoriasPorRubro(formasPago, rubroPorCuenta, idioma).map((grupo) => (
              <optgroup key={grupo.rubro} label={grupo.rubro}>
                {grupo.categorias.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </optgroup>
            ))}

            {tipoCuentaNueva && !modoEdicion && (
              <option value={OPCION_CREAR_CUENTA_NUEVA}>
                {tipoCuentaNueva === 'ACTIVO' ? t('opcionCrearCuentaCobrar') : t('opcionCrearCuentaPagar')}
              </option>
            )}
          </select>

          {creandoCuentaNueva && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                autoFocus
                style={{ ...campoInput, flex: '1 1 180px' }}
                placeholder={t('placeholderNombreCuentaNueva')}
                value={nombreCuentaNueva}
                onChange={(e) => setNombreCuentaNueva(e.target.value)}
              />
              <button
                type="button"
                disabled={!nombreCuentaNueva.trim() || guardandoCuentaNueva}
                onClick={handleCrearCuentaNueva}
                style={{
                  border: 'none',
                  background: COLORES.verde,
                  color: '#fff',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: guardandoCuentaNueva ? 'default' : 'pointer',
                  opacity: guardandoCuentaNueva ? 0.6 : 1,
                }}
              >
                {t('botonCrearCuenta')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreandoCuentaNueva(false);
                  setNombreCuentaNueva('');
                }}
                style={{ border: 'none', background: 'transparent', color: '#6e7781', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                {t('cancelar')}
              </button>
            </div>
          )}

          {saldoOrigen && <TextoSaldo idioma={idioma} simbolo={simbolo} fecha={fecha} saldo={saldoOrigen} />}
        </Campo>
      </div>

      {puedeEnCuotas && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: COLORES.azul, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={enCuotas} onChange={(e) => setEnCuotas(e.target.checked)} />
            {t('labelEnCuotas')}
          </label>

          {enCuotas && (
            <input
              type="number"
              min={1}
              step={1}
              value={cantidadCuotas}
              onChange={(e) => setCantidadCuotas(e.target.value)}
              style={{ ...campoInput, width: 90 }}
            />
          )}
        </div>
      )}

      {esTransferencia && (
        <p style={{ fontSize: 12.5, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '9px 12px', marginBottom: 16 }}>
          {t('avisoTransferencia')}
        </p>
      )}

      {/*
        En Venta, el histórico deja de ser texto libre: se completa
        solo con el número de comprobante (el id_operacion que ya se
        usa como hilo conductor de toda la operación) apenas se
        guarda — ver handleRegistrar. Acá solo se muestra un aviso, no
        un input editable.
      */}
      {operacion === 'VENTA' ? (
        <p style={{ fontSize: 12.5, color: '#6b7280', margin: '0 0 16px' }}>
          {idioma === 'PT'
            ? 'Um número de comprovante sequencial é atribuído automaticamente ao salvar.'
            : 'Se asigna automáticamente un número de comprobante secuencial al guardar.'}
        </p>
      ) : (
        !formularioSimple && (
          <Campo label={t('labelHistorico')}>
            <input
              type="text"
              value={historico}
              onChange={(e) => setHistorico(e.target.value)}
              placeholder={t('placeholderHistorico')}
              style={campoInput}
            />
          </Campo>
        )
      )}

      {/*
        Para Familia no se pide Cliente/Proveedor ("Fuente de ingreso"
        en un Cobro, "Destino de pago" en un Pago): la categoría
        elegida (que sale del plan de cuentas del perfil, ej. "Uber",
        "Alquiler") ya identifica de dónde viene o a dónde va la
        plata. Pedirlo de nuevo acá es información redundante que
        además no tiene sentido completar en el día a día familiar.
      */}
      {!esTransferencia && !esFamiliar && (
        <Campo label={etiquetaRelacionActual}>
          <select
            value={clienteProveedor}
            onChange={(e) => {
              if (e.target.value === NUEVO_CLIENTE_OPCION) {
                setModalNuevoCliente(true);
                return;
              }
              setClienteProveedor(e.target.value);
            }}
            disabled={!operacion || (contactos.length === 0 && operacion !== 'VENTA')}
            style={campoInput}
          >
            <option value="">{t('seleccionar')}</option>

            {contactos.map((contacto) => (
              <option key={contacto} value={contacto}>
                {contacto}
              </option>
            ))}

            {operacion === 'VENTA' && (
              <option value={NUEVO_CLIENTE_OPCION}>
                {idioma === 'PT' ? '➕ Novo cliente...' : '➕ Nuevo cliente...'}
              </option>
            )}
          </select>
        </Campo>
      )}

      {modalNuevoCliente && empresaId && (
        <ModalNuevoCliente
          idioma={idioma}
          onCancelar={() => setModalNuevoCliente(false)}
          onCreado={(cliente) => {
            setContactos((prev) => (prev.includes(cliente.nombre) ? prev : [...prev, cliente.nombre]));
            setClienteProveedor(cliente.nombre);
            setModalNuevoCliente(false);

            if (cliente.yaExistia) {
              setMensajeSabio(
                idioma === 'PT'
                  ? `Já existe um cliente com esse telefone: ${cliente.nombre}. Foi selecionado.`
                  : `Ya existe un cliente con ese teléfono: ${cliente.nombre}. Se seleccionó.`
              );
            }
          }}
          empresaId={empresaId}
        />
      )}

      {requiereSocio && (
        <Campo label={t('labelSocio')}>
          <select
            value={socio}
            onChange={(e) => setSocio(e.target.value)}
            disabled={sociosIngreso.length === 0}
            style={campoInput}
          >
            <option value="">{t('seleccionar')}</option>

            {sociosIngreso.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </Campo>
      )}

      {operacion && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: COLORES.azul, marginBottom: 10 }}>
            {t('detalleValores')}
          </p>

          {lineas.map((linea, i) => (
            <div key={i} style={filaProducto}>
              {operacionesConProducto ? (
                <select
                  value={linea.producto}
                  onChange={(e) => actualizarLinea(i, 'producto', e.target.value)}
                  style={{ ...campoInput, flex: 2 }}
                >
                  <option value="">{t('productoPlaceholder')}</option>

                  {productos
                    .filter((p) => (p.categoria ?? '').toUpperCase() === categoria.toUpperCase())
                    .map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={esSalidaStock && (saldoPorProductoAFecha[p.id] ?? 0) <= 0}
                      >
                        {p.nombre}
                        {esSalidaStock ? stockDisponible(idioma, saldoPorProductoAFecha[p.id] ?? 0) : ''}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={t('descripcionPlaceholder')}
                  value={linea.producto}
                  onChange={(e) => actualizarLinea(i, 'producto', e.target.value)}
                  style={{ ...campoInput, flex: 2 }}
                />
              )}

              {!formularioSimple && (
                <input
                  type="number"
                  placeholder={t('cantidadPlaceholder')}
                  value={linea.cantidad || ''}
                  onChange={(e) => actualizarLinea(i, 'cantidad', e.target.value)}
                  style={{ ...campoInput, flex: 1 }}
                />
              )}

              {!formularioSimple &&
                (() => {
                  const productoElegido = productos.find((p) => p.id === linea.producto);

                  if (operacion !== 'COMPRA' || productoElegido?.tipo_producto !== 'INSUMO') {
                    return null;
                  }

                  const opciones = opcionesUnidadCarga(productoElegido.unidad_medida);

                  if (opciones.length === 0) {
                    return null;
                  }

                  if (opciones.length === 1) {
                    return (
                      <span
                        style={{
                          ...campoInput,
                          flex: '0 0 auto',
                          display: 'flex',
                          alignItems: 'center',
                          color: COLORES.gris,
                          background: '#f1f5f9',
                        }}
                      >
                        {opciones[0]}
                      </span>
                    );
                  }

                  return (
                    <select
                      value={linea.unidadCarga || opciones[0]}
                      onChange={(e) => actualizarUnidadCarga(i, e.target.value)}
                      style={{ ...campoInput, flex: '0 0 auto', width: 110 }}
                    >
                      {opciones.map((unidad) => (
                        <option key={unidad} value={unidad}>
                          {unidad}
                        </option>
                      ))}
                    </select>
                  );
                })()}

              <input
                type="number"
                placeholder={montoEsTotalDeLinea ? t('montoTotalPlaceholder') : t('montoPlaceholder')}
                value={linea.monto || ''}
                onChange={(e) => actualizarLinea(i, 'monto', e.target.value)}
                style={{ ...campoInput, flex: 1 }}
              />

              {lineas.length > 1 && (
                <button
                  type="button"
                  onClick={() => eliminarLinea(i)}
                  title={t('eliminarLinea')}
                  style={botonEliminarLinea}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={agregarLinea} style={botonSecundario}>
              {t('agregarLinea')}
            </button>

            {operacionesConProducto && (
              <button
                type="button"
                onClick={() => {
                  setErrorEscaneo('');
                  setEscaneandoVenta(true);
                }}
                style={botonSecundario}
              >
                📷 {idioma === 'PT' ? 'Escanear' : 'Escanear'}
              </button>
            )}
          </div>

          {errorEscaneo && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{errorEscaneo}</div>
          )}
        </div>
      )}

      {escaneandoVenta && (
        <EscanerCodigoBarras
          idioma={idioma ?? 'ES'}
          colores={{ azul: COLORES.azul, verde: COLORES.verde }}
          onDetectado={manejarEscaneoLinea}
          onCerrar={() => setEscaneandoVenta(false)}
        />
      )}

      <div style={totalStyle}>
        <span>{t('total')}</span>
        <span>{simbolo} {formatearNumeroEntero(total)}</span>
      </div>

      <div style={validacionStyle}>
        <span>{camposCompletos ? t('camposCompletos') : t('faltanCampos')}</span>

        <span>{contadorRenglones(idioma, lineas.length)}</span>
      </div>

      {stockInsuficiente && (
        <p style={{ color: '#dc2626', fontSize: 13, margin: '10px 0 0' }}>
          {t('stockInsuficiente')}
        </p>
      )}

      {saldoMedioInsuficiente && (
        <p style={{ color: '#dc2626', fontSize: 13, margin: '10px 0 0' }}>
          {msgSaldoMedioInsuficiente(
            idioma,
            formaPago,
            `${simbolo} ${formatearNumeroEntero(saldoMedioActual)}`,
            `${simbolo} ${formatearNumeroEntero(total)}`
          )}
        </p>
      )}

      <p style={{ color: COLORES.verde, fontSize: 13, margin: '14px 0 0' }}>{mensajeSabio}</p>

      {comprobanteWhatsapp && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#e7f9ef',
            border: '1px solid #bbf0d1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, color: COLORES.azul }}>
            {idioma === 'PT'
              ? `Enviar o comprovante para ${comprobanteWhatsapp.cliente}?`
              : `¿Enviar el comprobante a ${comprobanteWhatsapp.cliente}?`}
          </span>

          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={comprobanteWhatsapp.enlace}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setComprobanteWhatsapp(null)}
              style={{
                background: '#25D366',
                color: '#fff',
                borderRadius: 10,
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              📲 {idioma === 'PT' ? 'Enviar por WhatsApp' : 'Enviar por WhatsApp'}
            </a>

            <button
              onClick={() => setComprobanteWhatsapp(null)}
              style={{ border: 'none', background: 'transparent', color: COLORES.azul, cursor: 'pointer', fontSize: 13 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            style={botonSecundario}
          >
            {t('cancelar')}
          </button>
        )}

        <button
          onClick={handleRegistrar}
          disabled={guardando || !camposCompletos}
          style={{ ...botonPrincipal, flex: 1 }}
        >
          {guardando ? t('guardando') : modoEdicion ? t('guardarCambios') : t('registrarOperacion')}
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

// Saldo en vivo de una cuenta a la fecha elegida — mismo cálculo
// exacto que ya usa registrarOperacion para bloquear una operación
// que la dejaría en negativo (ver lib/saldoCuenta.ts), mostrado acá
// como referencia mientras se completa el formulario. Un saldo
// negativo se resalta en rojo: no bloquea nada por sí solo (eso lo
// decide el motor al guardar), es solo una alerta visual temprana.
function TextoSaldo({
  idioma,
  simbolo,
  fecha,
  saldo,
}: {
  idioma: string | null;
  simbolo: string;
  fecha: string;
  saldo: { cuenta: string; saldo: number };
}) {
  const fechaDisplay = new Date(`${fecha}T12:00:00`).toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR');

  return (
    <p
      style={{
        fontSize: 11.5,
        color: saldo.saldo < 0 ? '#dc2626' : '#6b7280',
        margin: '5px 0 0',
      }}
    >
      {idioma === 'PT' ? 'Saldo' : 'Saldo'} {saldo.cuenta} {idioma === 'PT' ? 'em' : 'al'} {fechaDisplay}: {simbolo} {formatearNumeroEntero(saldo.saldo)}
    </p>
  );
}

// Alta rápida de un cliente nuevo sin salir de Contabilidad — va
// directo a la misma tabla `clientes` que usa Recursos Humanos. La
// clave para no duplicar es el teléfono (ver lib/clientes.ts): si ya
// existe un cliente con ese número, se reutiliza en vez de crear uno
// repetido.
function ModalNuevoCliente({
  empresaId,
  idioma,
  onCreado,
  onCancelar,
}: {
  empresaId: string;
  idioma: string | null;
  onCreado: (cliente: { nombre: string; yaExistia: boolean }) => void;
  onCancelar: () => void;
}) {
  const esPT = idioma === 'PT';
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function confirmar() {
    if (!nombre.trim()) {
      setError(esPT ? 'Coloque um nome.' : 'Poné un nombre.');
      return;
    }

    if (!telefono.trim()) {
      setError(esPT ? 'Coloque um telefone (com código do país).' : 'Poné un teléfono (con código de país).');
      return;
    }

    setError('');
    setGuardando(true);

    try {
      const cliente = await crearOUsarClientePorTelefono(empresaId, nombre, telefono);
      onCreado({ nombre: cliente.nombre, yaExistia: cliente.yaExistia });
    } catch (errorCrear) {
      setError((errorCrear as Error).message);
      setGuardando(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000,
      }}
      onClick={onCancelar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: 24,
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', color: COLORES.azul, fontSize: 18 }}>
          {esPT ? 'Novo cliente' : 'Nuevo cliente'}
        </h3>

        <Campo label={esPT ? 'Nome' : 'Nombre'}>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={campoInput} autoFocus />
        </Campo>

        <Campo label={esPT ? 'Telefone (com código do país)' : 'Teléfono (con código de país)'}>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder={esPT ? 'Ex: 5511987654321' : 'Ej: 5491122334455'}
            style={campoInput}
          />
        </Campo>

        {error && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={confirmar}
            disabled={guardando}
            style={{
              flex: 1,
              background: COLORES.verde,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '11px 16px',
              fontWeight: 700,
              cursor: guardando ? 'default' : 'pointer',
              opacity: guardando ? 0.7 : 1,
            }}
          >
            {guardando ? (esPT ? 'Salvando...' : 'Guardando...') : esPT ? 'Salvar' : 'Guardar'}
          </button>

          <button
            onClick={onCancelar}
            style={{
              background: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: 12,
              padding: '11px 16px',
              fontWeight: 700,
              color: COLORES.azul,
              cursor: 'pointer',
            }}
          >
            {esPT ? 'Cancelar' : 'Cancelar'}
          </button>
        </div>
      </div>
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

// Reconstruye los ValoresIniciales de un registro ya cargado para
// poder reabrirlo en modo edición — usado tanto por Registro de
// Operaciones (admin) como por Editar Registros (cliente). Para
// Compra, el monto original por línea se recupera de
// movimientos_stock (ver comentario en OPERACIONES_EDITABLES); para
// el resto se usa el total de la operación en una sola línea.
async function construirValoresEdicion(empresaId: string, fila: Registro): Promise<ValoresIniciales> {
  const { data: movimientos, error: errorMovimientos } = await supabase
    .from('movimientos_stock')
    .select('producto_id, cantidad, costo_unitario')
    .eq('empresa_id', empresaId)
    .eq('id_operacion', fila.id_operacion);

  if (errorMovimientos) {
    throw errorMovimientos;
  }

  const lineas: LineaFormulario[] =
    movimientos && movimientos.length > 0
      ? movimientos.map((m) => ({
          producto: m.producto_id,
          cantidad: Number(m.cantidad),
          monto: Number(m.costo_unitario),
          unidadCarga: '',
        }))
      : [{ producto: '', cantidad: 1, monto: Number(fila.total), unidadCarga: '' }];

  return {
    fecha: fila.fecha,
    operacion: fila.operacion,
    categoria: fila.categoria,
    formaPago: fila.forma_pago,
    historico: fila.historico ?? '',
    clienteProveedor: fila.cliente_proveedor ?? '',
    lineas,
  };
}

