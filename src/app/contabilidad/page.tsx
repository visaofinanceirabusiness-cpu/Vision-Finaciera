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

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  registrarOperacion,
  editarOperacion,
  eliminarOperacion,
  LineaOperacion,
} from '@/lib/motor';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { fechaLocalHoy } from '@/lib/fecha';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { crearTraductor, estadoDisplay, nombreOperacionDisplay } from '@/lib/i18n';
import { empresaManejaMercaderia } from '@/lib/perfilCapacidades';
import { empresaTieneOnboardingCompleto, marcarOnboardingCompleto } from '@/lib/onboarding';
import { SabioWidget } from '@/components/panel/SabioWidget';
import {
  diccionarioContabilidad,
  etiquetaRelacion,
  msgEditandoOperacion,
  msgElegirOperacion,
  msgElegirCategoria,
  msgOperacionActualizada,
  msgOperacionRegistrada,
  msgErrorCategorias,
  msgErrorFormasPago,
  msgErrorOperaciones,
  msgErrorAutomaticos,
  msgErrorEmpresa,
  msgSaldoMedioInsuficiente,
  tituloOperacion,
  stockDisponible,
  contadorRenglones,
  contadorAsientos,
  msgConfirmarEliminarOperacion,
  msgConfirmarEliminarYRecargar,
  pasosTutorial,
  msgTutorialCancelar,
  msgTutorialPaso,
  msgTutorialCompletado,
  frasesSabioContabilidad,
} from './i18n';

// Igual que en Informes: contexto para no tener que pasar el símbolo
// de moneda como prop por cada pestaña y sub-componente.
const SimboloContext = createContext('R$');

// Si la empresa es de perfil Familiar, "Cliente"/"Proveedor" no es
// vocabulario natural (nadie dice "mi proveedor" por el supermercado)
// — se usan las mismas etiquetas amigables que en Recursos Humanos.
const EsFamiliarContext = createContext(false);

const IdiomaContext = createContext<string | null>(null);

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
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>('lanzamientos');
  const [esAdmin, setEsAdmin] = useState(false);
  const [moneda, setMoneda] = useState<string | null>(null);
  const [esFamiliar, setEsFamiliar] = useState(false);
  const [idioma, setIdioma] = useState<string | null>(null);

  const t = crearTraductor(diccionarioContabilidad, idioma);

  useEffect(() => {
    async function cargarPerfil() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('es_admin_plataforma, empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      setEsAdmin(Boolean(perfil?.es_admin_plataforma));

      if (perfil?.empresa_id) {
        // Contabilidad (Central de Lançamentos) NO se gatea con
        // empresaTieneOnboardingCompleto — es acá donde la Fase 2 del
        // wizard redirige y donde la Fase 3 hace cargar las 3
        // operaciones guiadas, justo ANTES de que el onboarding quede
        // marcado como completo. Gatearla también generaría un loop.
        const { data: empresa } = await supabase
          .from('empresas')
          .select('moneda, idioma, perfil_empresa_id, perfiles_empresa(codigo)')
          .eq('id', perfil.empresa_id)
          .maybeSingle();

        setMoneda(empresa?.moneda ?? null);
        setIdioma(empresa?.idioma ?? null);

        const perfilCodigo = (empresa as unknown as { perfiles_empresa?: { codigo: string } | null } | null)
          ?.perfiles_empresa?.codigo;

        setEsFamiliar(perfilCodigo === 'FAMILIAR');
      }
    }

    cargarPerfil();
  }, []);

  return (
    <IdiomaContext.Provider value={idioma}>
    <EsFamiliarContext.Provider value={esFamiliar}>
    <SimboloContext.Provider value={simboloMoneda(moneda)}>
    <div style={fondo}>
      <div style={{ maxWidth: 1450, margin: '0 auto' }}>
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

            {/* SABIO — permanente, con tips propios de Contabilidad.
                Vive en el mismo panel del encabezado, entre el título y
                los accesos rápidos, igual que en el resto de las
                herramientas. El de dentro de Central de Lançamentos
                sigue existiendo aparte, pero solo durante el tutorial
                guiado (ver CentralDeLanzamientosTab). */}
            <SabioWidget
              colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
              idioma={idioma ?? 'ES'}
              frases={frasesSabioContabilidad(idioma)}
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
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setPestana('lanzamientos')}
              style={tabStyle(pestana === 'lanzamientos')}
            >
              {t('tabLanzamientos')}
            </button>

            {esAdmin && (
              <button
                type="button"
                onClick={() => setPestana('registros')}
                style={tabStyle(pestana === 'registros')}
              >
                {t('tabRegistros')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setPestana('libro')}
              style={tabStyle(pestana === 'libro')}
            >
              {t('tabLibro')}
            </button>
          </div>

          {pestana === 'lanzamientos' && <CentralDeLanzamientosTab />}
          {pestana === 'registros' && <RegistroOperacionesTab />}
          {pestana === 'libro' && <LibroDiarioTab />}
        </main>
      </div>
    </div>
    </SimboloContext.Provider>
    </EsFamiliarContext.Provider>
    </IdiomaContext.Provider>
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

type ValoresIniciales = {
  fecha: string;
  operacion: string;
  categoria: string;
  formaPago: string;
  historico: string;
  clienteProveedor: string;
  socio?: string;
  lineas: LineaOperacion[];
};

function CentralDeLanzamientosTab({
  idOperacionEditar,
  valoresIniciales,
  onGuardado,
  onCancelar,
}: {
  idOperacionEditar?: string;
  valoresIniciales?: ValoresIniciales;
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
  const [cargandoInicial, setCargandoInicial] = useState(true);

  // Tutorial guiado (Fase 3 del onboarding): activo siempre para una
  // empresa nueva (onboarding_completado = false) y opcionalmente
  // para cualquier otra que entre con ?tutorial=1 desde el mensaje de
  // invitación. "Voluntario" es lo que distingue a una empresa que ya
  // operaba (puede cancelar) de una nueva (no puede: onCancelar no se
  // le pasa a este tab desde ContabilidadPage).
  const [modoTutorial, setModoTutorial] = useState(false);
  const [tutorialVoluntario, setTutorialVoluntario] = useState(false);
  const [pasoTutorial, setPasoTutorial] = useState(0);
  const [operacionesTutorial, setOperacionesTutorial] = useState<string[]>([]);
  const [manejaMercaderiaEmpresa, setManejaMercaderiaEmpresa] = useState(false);
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

  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [formaPago, setFormaPago] = useState(valoresIniciales?.formaPago ?? '');

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

  const [lineas, setLineas] = useState<LineaOperacion[]>(
    valoresIniciales?.lineas ?? [{ producto: '', cantidad: 0, monto: 0 }]
  );

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
    ['PAGO', 'INVERSION', 'EXTRACCION', 'TRANSFERENCIA'].includes(operacion) ||
    (['COMPRA', 'VENTA', 'PERDIDA'].includes(operacion) && Boolean(categoria) && !categoriaEsProducto);

  // Transferencia es un movimiento entre cuentas propias (ej. de
  // Cuenta Bancaria a Plazo Fijo) — no hay un tercero involucrado,
  // así que no corresponde pedir Cliente/Proveedor/Socio acá.
  const esTransferencia = operacion === 'TRANSFERENCIA';

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
    setLineas([{ producto: '', cantidad: formularioSimple ? 1 : 0, monto: 0 }]);
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

    setOperacionesTutorial(pasosTutorial(esFamiliar, manejaMercaderiaEmpresa));
    setPasoTutorial(0);
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
      .select('id, nombre, categoria, proveedor_id')
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
    ] = await Promise.all([
      supabase.from('formas_pago').select('id, nombre').eq('empresa_id', empresaIdActual),
      supabase.from('forma_pago_cuentas').select('forma_pago_id, cuenta_id').eq('empresa_id', empresaIdActual).eq('activo', true),
      supabase.from('plan_cuentas').select('id, nombre, naturaleza').eq('empresa_id', empresaIdActual),
      supabase.from('registro_operaciones').select('cuenta_debito, cuenta_credito, total').eq('empresa_id', empresaIdActual),
      supabase.from('registros_automaticos').select('cuenta_debito, cuenta_credito, importe').eq('empresa_id', empresaIdActual),
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

      const [onboardingCompleto, manejaMercaderia] = await Promise.all([
        empresaTieneOnboardingCompleto(perfil.empresa_id),
        empresaManejaMercaderia(perfil.empresa_id),
      ]);

      setManejaMercaderiaEmpresa(manejaMercaderia);

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
        setOperacionesTutorial(pasosTutorial(esFamiliar, manejaMercaderia));
        setPasoTutorial(0);
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
      } else {
        setCategoria('');
      }

      setFormaPago('');
      setFormasPago([]);

      setError('');
    }

    cargarCategorias();

    setMensajeSabio(msgElegirCategoria(idioma, operacion));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setError(msgErrorFormasPago(idioma, errorFormas.message));
        return;
      }

      const unicas = Array.from(new Set((data ?? []).map((f) => f.forma_pago).filter(Boolean))) as string[];

      setFormasPago(unicas);

      if (hidratarFormaPago.current) {
        hidratarFormaPago.current = false;
        setFormaPago(valoresIniciales?.formaPago ?? '');
      } else {
        setFormaPago('');
      }

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
    setLineas((prev) => [...prev, { producto: '', cantidad: formularioSimple ? 1 : 0, monto: 0 }]);
  }

  const total = lineas.reduce((s, l) => s + l.cantidad * l.monto, 0);

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
      (formularioSimple || historico.trim()) &&
      (esTransferencia || clienteProveedor.trim()) &&
      (!requiereSocio || socio.trim()) &&
      lineasCompletas &&
      !stockInsuficiente &&
      !saldoMedioInsuficiente
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
        historico: formularioSimple
          ? historico.trim() || lineas.map((l) => l.producto.trim()).filter(Boolean).join(' / ') || categoria.trim()
          : historico.trim(),
        clienteProveedor: clienteProveedor.trim(),
        socio: requiereSocio ? socio.trim() : '',
        lineas: lineas.map((linea) => ({
          producto: linea.producto.trim(),
          cantidad: Number(linea.cantidad),
          monto: Number(linea.monto),
        })),
      };

      if (modoEdicion && idOperacionEditar) {
        await editarOperacion(empresaId, idOperacionEditar, formulario);
        setMensajeSabio(msgOperacionActualizada(idioma));
        onGuardado?.();
        return;
      }

      await registrarOperacion(empresaId, formulario);

      // Sin esto, el stock y los saldos de cuentas financieras que se
      // ven en pantalla quedaban pegados en lo que había al entrar a
      // la pestaña — una Compra que le da stock a un producto no se
      // reflejaba hasta recargar la página entera, así que vender ese
      // mismo producto en la misma sesión seguía viendo "stock: 0".
      await cargarDatosOperativos(empresaId);

      setMensajeSabio(msgOperacionRegistrada(idioma));

      setOperacion('');
      setCategoria('');
      setFormaPago('');
      setHistorico('');
      setClienteProveedor('');
      setSocio('');

      setLineas([{ producto: '', cantidad: 0, monto: 0 }]);

      // El progreso del tutorial avanza SOLO si la operación recién
      // registrada es la que tocaba en el paso actual — así una
      // empresa que registra otra cosa mientras tanto (o que ya tenía
      // ese tipo de operación en su historial) no hace saltar pasos.
      if (modoTutorial && formulario.operacion === operacionesTutorial[pasoTutorial]) {
        const pasoNuevo = pasoTutorial + 1;

        if (pasoNuevo >= operacionesTutorial.length) {
          setMensajeSabio(msgTutorialCompletado(idioma));
          setModoTutorial(false);

          if (!tutorialVoluntario) {
            await marcarOnboardingCompleto(empresaId);
          }

          setTimeout(() => router.push('/panel-de-control?tutorial=1'), 1400);
        } else {
          setPasoTutorial(pasoNuevo);
        }
      }
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

  // Mientras dura el tutorial guiado, todo el formulario se aísla en
  // un modal a pantalla completa — antes convivía como un banner
  // arriba del formulario normal, con las pestañas, los accesos
  // rápidos y el "Volver a mi negocio" real todavía visibles y
  // clickeables al lado, lo que hacía confuso qué había que hacer.
  // Acá abajo NO se duplica el formulario: se le agregan estos dos
  // `<div>` contenedores condicionales alrededor del mismo JSX de
  // siempre (panelTitulo en adelante), que hoy tapan el resto de la
  // pantalla con un fondo oscuro fijo cuando modoTutorial está activo.
  const enTutorial = !modoEdicion && modoTutorial;

  return (
    <div style={enTutorial ? fondoTutorial : undefined}>
      <div style={enTutorial ? tarjetaTutorial : undefined}>
        {enTutorial && (
          <div
            style={{
              background: 'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
              borderRadius: 24,
              padding: '24px 28px',
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
              boxShadow: '0 18px 40px rgba(20,42,71,0.16)',
            }}
          >
            <div style={{ flex: '1 1 200px', minWidth: 200 }}>
              <p
                style={{
                  margin: '0 0 10px',
                  color: '#86efac',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                }}
              >
                {t('tutorialEyebrow')}
              </p>

              <h2 style={{ margin: '0 0 14px', color: COLORES.blanco, fontSize: 22 }}>
                {t('tutorialTitulo')}
              </h2>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tutorialVoluntario && (
                  <button
                    type="button"
                    onClick={() => {
                      setModoTutorial(false);
                      setOfrecerTutorialVoluntario(true);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: 999,
                      color: COLORES.blanco,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '6px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    {msgTutorialCancelar(idioma)}
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.push('/login');
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 999,
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '6px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {t('tutorialSalir')}
                </button>
              </div>
            </div>

            <SabioWidget
              colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
              idioma={idioma ?? 'ES'}
              frase={msgTutorialPaso(idioma, pasoTutorial, operacionesTutorial[pasoTutorial] ?? '')}
            />
          </div>
        )}

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
                {nombreOperacionDisplay(idioma, op)}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label={esTransferencia ? t('labelHaciaCuenta') : t('labelCategoria')}>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            disabled={!operacion}
            style={campoInput}
          >
            <option value="">{t('seleccionar')}</option>

            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label={esTransferencia ? t('labelDesdeCuenta') : t('labelFormaPago')}>
          <select
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value)}
            disabled={!categoria}
            style={campoInput}
          >
            <option value="">{t('seleccionar')}</option>

            {formasPago.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {esTransferencia && (
        <p style={{ fontSize: 12.5, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '9px 12px', marginBottom: 16 }}>
          {t('avisoTransferencia')}
        </p>
      )}

      {!formularioSimple && (
        <Campo label={t('labelHistorico')}>
          <input
            type="text"
            value={historico}
            onChange={(e) => setHistorico(e.target.value)}
            placeholder={t('placeholderHistorico')}
            style={campoInput}
          />
        </Campo>
      )}

      {!esTransferencia && (
        <Campo label={etiquetaRelacionActual}>
          <select
            value={clienteProveedor}
            onChange={(e) => setClienteProveedor(e.target.value)}
            disabled={!operacion || contactos.length === 0}
            style={campoInput}
          >
            <option value="">{t('seleccionar')}</option>

            {contactos.map((contacto) => (
              <option key={contacto} value={contacto}>
                {contacto}
              </option>
            ))}
          </select>
        </Campo>
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

              <input
                type="number"
                placeholder={t('montoPlaceholder')}
                value={linea.monto || ''}
                onChange={(e) => actualizarLinea(i, 'monto', e.target.value)}
                style={{ ...campoInput, flex: 1 }}
              />
            </div>
          ))}

          <button type="button" onClick={agregarLinea} style={botonSecundario}>
            {t('agregarLinea')}
          </button>
        </div>
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

  // Venta y Pérdida no guardan el precio/monto original por línea
  // (solo el costo promedio, para el CMV) — reconstruirlo al editar
  // sería adivinar. Para esas dos, es más seguro eliminar y cargar
  // de nuevo a mano que "editar" con un valor estimado.
  const OPERACIONES_EDITABLES = ['COMPRA', 'PAGO', 'INVERSION', 'EXTRACCION', 'TRANSFERENCIA'];

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

    const { data: movimientos, error: errorMovimientos } = await supabase
      .from('movimientos_stock')
      .select('producto_id, cantidad, costo_unitario')
      .eq('empresa_id', empresaId)
      .eq('id_operacion', fila.id_operacion);

    if (errorMovimientos) {
      setError(t('errorDetallesEdicion'));
      return;
    }

    let lineas: LineaOperacion[];

    if (movimientos && movimientos.length > 0) {
      // "Editar" solo está habilitado para Compra (Pago/Inversión/
      // Extracción no tocan stock) — ahí el monto original se guarda
      // tal cual en costo_unitario, así que se recupera exacto.
      lineas = movimientos.map((m) => ({
        producto: m.producto_id,
        cantidad: Number(m.cantidad),
        monto: Number(m.costo_unitario),
      }));
    } else {
      lineas = [{ producto: '', cantidad: 1, monto: Number(fila.total) }];
    }

    setEditando({
      idOperacion: fila.id_operacion,
      valores: {
        fecha: fila.fecha,
        operacion: fila.operacion,
        categoria: fila.categoria,
        formaPago: fila.forma_pago,
        historico: fila.historico ?? '',
        clienteProveedor: fila.cliente_proveedor ?? '',
        lineas,
      },
    });
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
                  <Td>{nombreOperacionDisplay(idioma, fila.operacion)}</Td>
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
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioContabilidad, idioma);
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
      setError(msgErrorOperaciones(idioma, errorOperaciones.message));
      setFilas([]);
      return;
    }

    if (errorAutomaticos) {
      setError(msgErrorAutomaticos(idioma, errorAutomaticos.message));
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
        setError(msgErrorEmpresa(idioma));
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
          placeholder={t('buscarLibroDiario')}
          style={{ ...campoInput, maxWidth: 460 }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Resumen titulo={t('resumenOperaciones')} valor={String(totalOperaciones)} />
          <Resumen titulo={t('resumenAsientos')} valor={String(totalAsientos)} />
          <Resumen titulo={t('resumenImportes')} valor={`${simbolo} ${formatearNumeroEntero(totalImportes)}`} />
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
        <p>{t('cargandoLibroDiario')}</p>
      ) : (
        <div>
          {!grupos.length ? (
            <div style={vacioOperacion}>{t('sinMovimientosContables')}</div>
          ) : (
            grupos.map((grupo) => <GrupoOperacionCard key={grupo.id_operacion} grupo={grupo} />)
          )}
        </div>
      )}
    </div>
  );
}

function GrupoOperacionCard({ grupo }: { grupo: GrupoOperacion }) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const t = crearTraductor(diccionarioContabilidad, idioma);
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
            {new Date(`${grupo.fecha}T12:00:00`).toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR')}
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
            {contadorAsientos(idioma, grupo.filas.length)}
          </span>
        </div>

        <div style={{ fontSize: 13, color: COLORES.gris }}>
          {t('importeRegistrado')} <strong style={{ color: COLORES.azul }}>{simbolo} {formatearNumeroEntero(importeGrupo)}</strong>
        </div>
      </div>

      <div style={tablaContenedorInterna}>
        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <Th>{t('tipoHeader')}</Th>
              <Th>{t('operacion')}</Th>
              <Th>{t('historico')}</Th>
              <Th>{t('debeHeader')}</Th>
              <Th>{t('haberHeader')}</Th>
              <Th align="right">{t('importeHeader')}</Th>
              <Th>{t('estadoHeader')}</Th>
            </tr>
          </thead>

          <tbody>
            {grupo.filas.map((fila, indice) => (
              <tr
                key={`${fila.id_operacion}-${fila.tipo_registro}-${indice}`}
                style={{ borderTop: '1px solid #edf1f4' }}
              >
                <Td>
                  <TipoRegistro tipo={fila.tipo_registro} idioma={idioma} />
                </Td>

                <Td>
                  <strong style={{ color: COLORES.azul }}>{nombreOperacionDisplay(idioma, fila.operacion)}</strong>
                </Td>

                <Td>{fila.historico || '—'}</Td>

                <Td>
                  <span style={cuentaDebe}>{fila.cuenta_debito || '—'}</span>
                </Td>

                <Td>
                  <span style={cuentaHaber}>{fila.cuenta_credito || '—'}</span>
                </Td>

                <Td align="right">
                  <strong>{simbolo} {formatearNumeroEntero(Number(fila.importe ?? 0))}</strong>
                </Td>

                <Td>
                  <Estado estado={fila.estado} idioma={idioma} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TipoRegistro({ tipo, idioma }: { tipo: 'OPERACION' | 'AUTOMATICO'; idioma: string | null }) {
  const automatico = tipo === 'AUTOMATICO';
  const t = crearTraductor(diccionarioContabilidad, idioma);

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
      {automatico ? t('automatico') : t('operacionEtiqueta')}
    </span>
  );
}

function Estado({ estado, idioma }: { estado: string | null; idioma: string | null }) {
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

// Modal a pantalla completa del tutorial guiado (ver enTutorial en
// CentralDeLanzamientosTab) — tapa el resto de la pantalla (pestañas,
// accesos rápidos, el "Volver a mi negocio" real) con un fondo fijo
// oscuro mientras dura, para que no compita con el formulario.
const fondoTutorial: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.72)',
  zIndex: 1000,
  display: 'flex',
  justifyContent: 'center',
  padding: '32px 16px',
  overflowY: 'auto',
};

const tarjetaTutorial: React.CSSProperties = {
  ...panel,
  width: '100%',
  maxWidth: 720,
  height: 'fit-content',
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
