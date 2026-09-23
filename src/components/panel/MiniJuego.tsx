'use client';

// MINI-JUEGO — tercera forma de cargar operaciones (además de Central
// de Lanzamientos y Sabio Bot): mismas preguntas, pero como tarjetas
// con ícono en vez de formulario/chat — "jugás una carta" en vez de
// llenar un campo. Cubre todas las operaciones, incluidas Venta/Compra
// (que suman un paso más: elegir el producto y la cantidad, igual que
// en Contabilidad).
//
// Usa el MISMO motor que ya usan Sabio Bot y Contabilidad
// (registrarOperacion) — esto es solo una capa visual nueva, no
// lógica contable nueva: cero riesgo de que un asiento salga mal por
// este camino que no salga también por los otros dos.

import { useEffect, useState } from 'react';
import { registrarOperacion } from '@/lib/motor';
import {
  obtenerCategoriasJuego,
  obtenerFormasPagoJuego,
  obtenerProductosJuego,
  obtenerContactosJuego,
  tablaContactoJuego,
  contarJugadasHoy,
  type CategoriaJuego,
  type ProductoJuego,
} from '@/lib/miniJuego';
import { crearOUsarContactoPorTelefono } from '@/lib/clientes';
import { iconoOperacion, iconoParaTexto, SABIO_LUDICO_URL } from '@/lib/iconosJuego';
import { fechaLocalHoy } from '@/lib/fecha';
import { saldoEnTransferencia } from '@/lib/saldoCuenta';
import { nombreOperacionDisplay } from '@/lib/i18n';
import { CelebracionMiniJuego } from './CelebracionMiniJuego';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

const OPERACIONES_JUEGO = ['VENTA', 'COMPRA', 'PAGO', 'COBRO', 'TRANSFERENCIA', 'INVERSION', 'EXTRACCION', 'PERDIDA'];

// A partir de cuántas tarjetas el buscador deja de ser opcional.
const MINIMO_PARA_BUSCADOR = 6;

// Misma regla que usa Contabilidad para saber si la categoría elegida
// mueve stock y por lo tanto hay que elegir un producto puntual.
function operacionNecesitaProducto(operacion: string, formaPago: string, categoria: CategoriaJuego | undefined) {
  if (!categoria) return false;
  const categoriaEsProducto = categoria.stock === 'SI';
  return (['COMPRA', 'VENTA', 'PERDIDA'].includes(operacion) && categoriaEsProducto) || (operacion === 'INVERSION' && formaPago === 'Mercadería');
}

type Paso = 'operacion' | 'categoria' | 'formaPago' | 'contacto' | 'producto' | 'cantidad' | 'monto' | 'guardando';

// El Sabio Lúdico no habla — reacciona con un símbolo (no un diálogo)
// y una "pose" distinta (nomás con transform, no hay dibujo aparte
// por pose) según en qué paso está el jugador.
const REACCION_POR_PASO: Record<Paso, { simbolo: string; pose: string }> = {
  operacion: { simbolo: '❓', pose: 'rotate(-4deg)' },
  categoria: { simbolo: '❗', pose: 'rotate(3deg) scale(1.04)' },
  formaPago: { simbolo: '❗', pose: 'rotate(-3deg) scale(1.04)' },
  contacto: { simbolo: '👤', pose: 'rotate(2deg)' },
  producto: { simbolo: '❓', pose: 'rotate(4deg)' },
  cantidad: { simbolo: '🔢', pose: 'scale(1.06)' },
  monto: { simbolo: '💰', pose: 'rotate(-5deg) scale(1.08)' },
  guardando: { simbolo: '⏳', pose: 'scale(0.95)' },
};

// Modo tutorial (Fase 3 del onboarding, ver contabilidad/page.tsx):
// en vez de elegir la operación de una grilla libre, viene forzada
// paso a paso desde afuera — el jugador solo completa categoría en
// adelante. `onCompletado` se llama una sola vez, al terminar la
// última operación de la lista. `mensaje` es una función (no un
// string fijo) porque el paso del tutorial avanza ACÁ ADENTRO
// (pasoTutorial es estado propio del Mini-Juego) — pasarlo ya
// calculado desde afuera lo dejaba congelado en el mensaje del
// primer paso para siempre.
type TutorialMiniJuego = {
  operaciones: string[];
  mensaje: (paso: number) => string;
};

export function MiniJuego({
  empresaId,
  idioma,
  esFamiliar,
  simbolo,
  colores,
  tutorial,
  onCompletadoTutorial,
  onCerrar,
}: {
  empresaId: string;
  idioma: string;
  esFamiliar?: boolean;
  simbolo: string;
  colores: Colores;
  tutorial?: TutorialMiniJuego;
  onCompletadoTutorial?: () => void;
  onCerrar: () => void;
}) {
  const esPT = idioma === 'PT';

  const [pasoTutorial, setPasoTutorial] = useState(0);
  const operacionForzada = tutorial?.operaciones[pasoTutorial] ?? null;

  const [paso, setPaso] = useState<Paso>(operacionForzada ? 'categoria' : 'operacion');
  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [operacion, setOperacion] = useState(operacionForzada ?? '');
  const [categoria, setCategoria] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [productoId, setProductoId] = useState('');
  const [productoNombre, setProductoNombre] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [monto, setMonto] = useState('');
  const [clienteProveedor, setClienteProveedor] = useState('');
  const [nombreContacto, setNombreContacto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');

  const [categorias, setCategorias] = useState<CategoriaJuego[]>([]);
  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [productos, setProductos] = useState<ProductoJuego[]>([]);
  const [contactos, setContactos] = useState<string[]>([]);
  const [creandoContacto, setCreandoContacto] = useState(false);
  const [guardandoContacto, setGuardandoContacto] = useState(false);
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [error, setError] = useState('');
  const [celebrando, setCelebrando] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [saldosPorMedio, setSaldosPorMedio] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!operacion) return;

    setCargandoOpciones(true);
    obtenerCategoriasJuego(empresaId, operacion)
      .then(setCategorias)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando categorías.'))
      .finally(() => setCargandoOpciones(false));
  }, [empresaId, operacion]);

  // Si la operación tiene una única categoría posible (ej. Aporte/
  // Retiro), no tiene sentido mostrar la tarjeta para elegirla: se
  // selecciona sola y se salta directo a Forma de pago — igual que
  // hacen Central de Lanzamientos y Sabio Bot en la misma situación.
  useEffect(() => {
    if (paso === 'categoria' && !cargandoOpciones && categorias.length === 1) {
      elegirCategoria(categorias[0].nombre);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, cargandoOpciones, categorias]);

  useEffect(() => {
    if (!operacion || !categoria) return;

    setCargandoOpciones(true);
    obtenerFormasPagoJuego(empresaId, operacion, categoria)
      .then(setFormasPago)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando formas de pago.'))
      .finally(() => setCargandoOpciones(false));
  }, [empresaId, operacion, categoria]);

  // Saldo de la cuenta detrás de cada medio (Activo: Caja, Banco... o
  // Pasivo: Tarjeta, Préstamo...) — para elegir el medio viendo antes
  // dónde hay plata (o deuda), no a ciegas por el nombre solo.
  useEffect(() => {
    if (formasPago.length === 0) {
      setSaldosPorMedio({});
      return;
    }

    let cancelado = false;

    Promise.all(
      formasPago.map(async (fp) => {
        const resultado = await saldoEnTransferencia(empresaId, fp, fecha).catch(() => null);
        return [fp, resultado] as const;
      })
    ).then((pares) => {
      if (cancelado) return;
      const mapa: Record<string, number> = {};
      for (const [fp, resultado] of pares) {
        if (resultado) mapa[fp] = resultado.saldo;
      }
      setSaldosPorMedio(mapa);
    });

    return () => {
      cancelado = true;
    };
  }, [empresaId, formasPago, fecha]);

  const categoriaSeleccionada = categorias.find((c) => c.nombre === categoria);
  const necesitaProducto = operacionNecesitaProducto(operacion, formaPago, categoriaSeleccionada);
  const productosDeCategoria = productos.filter((p) => (p.categoria ?? '').toUpperCase() === categoria.toUpperCase());
  const tablaContacto = tablaContactoJuego(operacion);

  async function irAProductoOMonto() {
    if (operacionNecesitaProducto(operacion, formaPago, categoriaSeleccionada)) {
      setCargandoOpciones(true);
      try {
        if (productos.length === 0) setProductos(await obtenerProductosJuego(empresaId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error cargando productos.');
      } finally {
        setCargandoOpciones(false);
      }
      setPaso('producto');
    } else {
      setPaso('monto');
    }
  }

  function elegirOperacion(op: string) {
    setOperacion(op);
    setCategoria('');
    setFormaPago('');
    setClienteProveedor('');
    setContactos([]);
    setCreandoContacto(false);
    setNombreContacto('');
    setTelefonoContacto('');
    setProductoId('');
    setProductoNombre('');
    setUnidadMedida('');
    setCantidad('');
    setMonto('');
    setBusqueda('');
    setPaso('categoria');
  }

  function elegirCategoria(cat: string) {
    setCategoria(cat);
    setFormaPago('');
    setClienteProveedor('');
    setContactos([]);
    setCreandoContacto(false);
    setNombreContacto('');
    setTelefonoContacto('');
    setProductoId('');
    setProductoNombre('');
    setUnidadMedida('');
    setCantidad('');
    setMonto('');
    setBusqueda('');
    setPaso('formaPago');
  }

  async function elegirFormaPago(fp: string) {
    setFormaPago(fp);
    setMonto('');
    setBusqueda('');

    const tabla = tablaContactoJuego(operacion);
    if (tabla) {
      setCargandoOpciones(true);
      try {
        setContactos(await obtenerContactosJuego(empresaId, tabla));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error cargando contactos.');
      } finally {
        setCargandoOpciones(false);
      }
      setPaso('contacto');
      return;
    }

    await irAProductoOMonto();
  }

  function elegirContacto(nombre: string) {
    setClienteProveedor(nombre);
    setBusqueda('');
    setCreandoContacto(false);
    irAProductoOMonto();
  }

  async function confirmarNuevoContacto() {
    if (!nombreContacto.trim()) {
      setError(esPT ? 'Coloque um nome.' : 'Poné un nombre.');
      return;
    }

    if (!telefonoContacto.trim()) {
      setError(esPT ? 'Coloque um telefone (com código do país).' : 'Poné un teléfono (con código de país).');
      return;
    }

    const tabla = tablaContactoJuego(operacion);
    if (!tabla) return;

    setGuardandoContacto(true);
    setError('');

    try {
      const contacto = await crearOUsarContactoPorTelefono(empresaId, tabla, nombreContacto, telefonoContacto);
      setContactos((actual) => (actual.includes(contacto.nombre) ? actual : [...actual, contacto.nombre]));
      setNombreContacto('');
      setTelefonoContacto('');
      elegirContacto(contacto.nombre);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el contacto.');
    } finally {
      setGuardandoContacto(false);
    }
  }

  function elegirProducto(p: ProductoJuego) {
    setProductoId(p.id);
    setProductoNombre(p.nombre);
    setUnidadMedida(p.unidad_medida ?? '');
    setCantidad('1');
    setBusqueda('');
    setPaso('cantidad');
  }

  function tocarTecla(destino: 'monto' | 'cantidad', tecla: string) {
    const setter = destino === 'monto' ? setMonto : setCantidad;
    setter((actual) => {
      if (tecla === 'borrar') return actual.slice(0, -1);
      if (tecla === '.' && actual.includes('.')) return actual;
      if (actual.length >= 10) return actual;
      return actual + tecla;
    });
  }

  function confirmarCantidad() {
    const cantidadNum = Number(cantidad);
    if (!cantidadNum || cantidadNum <= 0) {
      setError(esPT ? 'A quantidade tem que ser maior que zero.' : 'La cantidad tiene que ser mayor a cero.');
      return;
    }
    setError('');
    setPaso('monto');
  }

  function volver() {
    setError('');
    setBusqueda('');
    setCreandoContacto(false);
    if (paso === 'categoria') setPaso('operacion');
    else if (paso === 'formaPago') setPaso('categoria');
    else if (paso === 'contacto') setPaso('formaPago');
    else if (paso === 'producto') setPaso(tablaContacto ? 'contacto' : 'formaPago');
    else if (paso === 'cantidad') setPaso('producto');
    else if (paso === 'monto') setPaso(necesitaProducto ? 'cantidad' : tablaContacto ? 'contacto' : 'formaPago');
  }

  function reiniciarJuego() {
    setFecha(fechaLocalHoy());
    setOperacion('');
    setCategoria('');
    setFormaPago('');
    setClienteProveedor('');
    setContactos([]);
    setCreandoContacto(false);
    setNombreContacto('');
    setTelefonoContacto('');
    setProductoId('');
    setProductoNombre('');
    setUnidadMedida('');
    setCantidad('');
    setMonto('');
    setError('');
    setBusqueda('');
    setPaso('operacion');
  }

  async function confirmarJugada() {
    const total = Number(monto);

    if (!total || total <= 0) {
      setError(esPT ? 'O valor tem que ser maior que zero.' : 'El monto tiene que ser mayor a cero.');
      return;
    }

    setPaso('guardando');
    setError('');

    try {
      const cantidadNum = necesitaProducto ? Number(cantidad) || 1 : 1;
      const montoParaMotor = necesitaProducto ? total / cantidadNum : total;

      await registrarOperacion(empresaId, {
        fecha,
        operacion,
        categoria,
        formaPago,
        historico: categoria,
        clienteProveedor: clienteProveedor.trim(),
        lineas: [{ producto: necesitaProducto ? productoId : '', cantidad: cantidadNum, monto: montoParaMotor }],
      });

      const numeroDelDia = await contarJugadasHoy(empresaId).catch(() => 1);
      setCelebrando(numeroDelDia);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la jugada.');
      setPaso('monto');
    }
  }

  const esTransferencia = operacion === 'TRANSFERENCIA';

  const tituloPaso: Record<Paso, string> = {
    operacion: esPT ? '¿Qual jogada vamos fazer?' : '¿Qué jugada hacemos?',
    categoria: esTransferencia
      ? esPT
        ? 'Para onde vai o dinheiro?'
        : '¿Hacia dónde va la plata?'
      : esPT
        ? 'Escolha a categoria'
        : 'Elegí la categoría',
    formaPago: esPT ? 'Escolha o meio' : 'Elegí el medio',
    contacto: tablaContacto === 'proveedores' ? (esPT ? 'Qual fornecedor?' : '¿Qué proveedor?') : esPT ? 'Qual cliente?' : '¿Qué cliente?',
    producto: esPT ? 'Qual produto?' : '¿Qué producto?',
    cantidad: esPT ? 'Quantas unidades?' : '¿Cuántas unidades?',
    monto: necesitaProducto ? (esPT ? 'Quanto no total?' : '¿Cuánto salió en total?') : esPT ? 'Quanto foi?' : '¿Cuánto fue?',
    guardando: esPT ? 'Registrando...' : 'Registrando...',
  };

  const tarjeta = (emoji: string, etiqueta: string, onClick: () => void, key: string, subEtiqueta?: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '18px 10px',
        borderRadius: 18,
        border: '2px solid #e5e7eb',
        background: colores.blanco,
        cursor: 'pointer',
        minHeight: 100,
        boxShadow: '0 6px 16px rgba(31,58,95,0.08)',
        transition: 'transform 0.1s ease',
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <span style={{ fontSize: 34 }}>{emoji}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: colores.azul, textAlign: 'center' }}>{etiqueta}</span>
      {subEtiqueta && (
        <span style={{ fontSize: 11, fontWeight: 700, color: colores.verde, textAlign: 'center' }}>{subEtiqueta}</span>
      )}
    </button>
  );

  function formatearSaldo(valor: number): string {
    return `${simbolo} ${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const coincide = (texto: string) => texto.toLowerCase().includes(busqueda.trim().toLowerCase());

  const operacionesFiltradas = OPERACIONES_JUEGO.filter(coincide);
  const categoriasFiltradas = categorias.filter((c) => coincide(c.nombre));
  const formasPagoFiltradas = formasPago.filter(coincide);
  const contactosFiltrados = contactos.filter(coincide);
  const productosFiltrados = productosDeCategoria.filter((p) => coincide(p.nombre));

  const buscador = (
    <input
      type="text"
      value={busqueda}
      onChange={(e) => setBusqueda(e.target.value)}
      placeholder={esPT ? '🔎 Buscar...' : '🔎 Buscar...'}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        border: '2px solid rgba(255,255,255,0.25)',
        background: 'rgba(255,255,255,0.08)',
        color: '#fff',
        borderRadius: 14,
        padding: '11px 14px',
        fontSize: 14,
        marginBottom: 14,
        outline: 'none',
      }}
    />
  );

  const reaccion = REACCION_POR_PASO[paso];

  const avatarSabio = (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SABIO_LUDICO_URL}
          alt="Sabio"
          style={{
            width: 76,
            height: 76,
            objectFit: 'contain',
            filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.3))',
            transform: reaccion.pose,
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -10,
            fontSize: 24,
            fontWeight: 900,
            color: '#f4b400',
            textShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          {reaccion.simbolo}
        </span>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(160deg, #0f2138, #1f3a5f 60%, #163a2e)',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>🎲 {esPT ? 'Mini-Jogo' : 'Mini-Juego'}</div>

        <button
          type="button"
          onClick={onCerrar}
          style={{ border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {esPT ? 'Fechar' : 'Cerrar'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(244,180,0,0.14)',
            border: '2px solid #f4b400',
            borderRadius: 14,
            padding: '10px 18px',
            color: '#fff',
            fontSize: 17,
            fontWeight: 800,
            cursor: paso === 'guardando' ? 'default' : 'pointer',
          }}
        >
          📅
          <input
            type="date"
            value={fecha}
            disabled={paso === 'guardando'}
            onChange={(e) => setFecha(e.target.value || fechaLocalHoy())}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'inherit', colorScheme: 'dark' }}
          />
        </label>
      </div>

      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {paso !== 'operacion' && paso !== 'guardando' && !(tutorial && paso === 'categoria') && (
          <button
            type="button"
            onClick={volver}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}
          >
            ← {esPT ? 'Voltar' : 'Atrás'}
          </button>
        )}

        {tutorial && (
          <div
            style={{
              background: 'rgba(244,180,0,0.12)',
              border: '1px solid rgba(244,180,0,0.4)',
              borderRadius: 16,
              padding: '14px 18px',
              marginBottom: 14,
              color: '#fff',
              fontSize: 13.5,
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: '#f4b400', marginBottom: 6, textTransform: 'uppercase' }}>
              {esPT ? 'Tutorial guiado' : 'Tutorial guiado'} · {pasoTutorial + 1}/{tutorial.operaciones.length}
            </div>
            {tutorial.mensaje(pasoTutorial)}
          </div>
        )}

        {avatarSabio}

        <h2 style={{ color: '#fff', fontSize: 20, textAlign: 'center', margin: '0 0 18px' }}>{tituloPaso[paso]}</h2>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, marginBottom: 14, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {paso === 'operacion' && (
          <>
            {OPERACIONES_JUEGO.length > MINIMO_PARA_BUSCADOR && buscador}
            {operacionesFiltradas.length === 0 ? (
              <p style={{ color: '#fff', textAlign: 'center', fontSize: 13 }}>
                {esPT ? 'Nenhum resultado.' : 'Sin resultados.'}
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
                {operacionesFiltradas.map((op) =>
                  tarjeta(
                    iconoOperacion(op),
                    nombreOperacionDisplay(idioma, op, esFamiliar),
                    () => elegirOperacion(op),
                    op
                  )
                )}
              </div>
            )}
          </>
        )}

        {paso === 'categoria' && (
          <>
            {cargandoOpciones ? (
              <p style={{ color: '#fff', textAlign: 'center' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
            ) : categorias.length === 0 ? (
              <p style={{ color: '#fff', textAlign: 'center', fontSize: 13 }}>
                {esPT ? 'Nenhuma categoria configurada para essa jogada.' : 'No hay ninguna categoría configurada para esta jugada.'}
              </p>
            ) : (
              <>
                {categorias.length > MINIMO_PARA_BUSCADOR && buscador}
                {categoriasFiltradas.length === 0 ? (
                  <p style={{ color: '#fff', textAlign: 'center', fontSize: 13 }}>
                    {esPT ? 'Nenhum resultado.' : 'Sin resultados.'}
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
                    {categoriasFiltradas.map((cat) => tarjeta(iconoParaTexto(cat.nombre), cat.nombre, () => elegirCategoria(cat.nombre), cat.nombre))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {paso === 'formaPago' && (
          <>
            {cargandoOpciones ? (
              <p style={{ color: '#fff', textAlign: 'center' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
            ) : formasPago.length === 0 ? (
              <p style={{ color: '#fff', textAlign: 'center', fontSize: 13 }}>
                {esPT ? 'Nenhuma forma de pagamento configurada.' : 'No hay ninguna forma de pago configurada.'}
              </p>
            ) : (
              <>
                {formasPago.length > MINIMO_PARA_BUSCADOR && buscador}
                {formasPagoFiltradas.length === 0 ? (
                  <p style={{ color: '#fff', textAlign: 'center', fontSize: 13 }}>
                    {esPT ? 'Nenhum resultado.' : 'Sin resultados.'}
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
                    {formasPagoFiltradas.map((fp) =>
                      tarjeta(
                        iconoParaTexto(fp),
                        fp,
                        () => elegirFormaPago(fp),
                        fp,
                        fp in saldosPorMedio ? formatearSaldo(saldosPorMedio[fp]) : undefined
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {paso === 'contacto' && (
          <>
            {cargandoOpciones ? (
              <p style={{ color: '#fff', textAlign: 'center' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
            ) : creandoContacto ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="text"
                  value={nombreContacto}
                  onChange={(e) => setNombreContacto(e.target.value)}
                  placeholder={esPT ? 'Nome' : 'Nombre'}
                  autoFocus
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '2px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    borderRadius: 14,
                    padding: '13px 14px',
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
                <input
                  type="tel"
                  value={telefonoContacto}
                  onChange={(e) => setTelefonoContacto(e.target.value)}
                  placeholder={esPT ? 'Telefone (com código do país) — ex: 5511987654321' : 'Teléfono (con código de país) — ej: 5491122334455'}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '2px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    borderRadius: 14,
                    padding: '13px 14px',
                    fontSize: 15,
                    outline: 'none',
                  }}
                />

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setCreandoContacto(false)}
                    style={{
                      flex: 1,
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'transparent',
                      color: '#fff',
                      borderRadius: 14,
                      padding: '13px 0',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {esPT ? 'Cancelar' : 'Cancelar'}
                  </button>

                  <button
                    type="button"
                    disabled={guardandoContacto}
                    onClick={confirmarNuevoContacto}
                    style={{
                      flex: 2,
                      border: 'none',
                      background: colores.verde,
                      color: '#fff',
                      borderRadius: 14,
                      padding: '13px 0',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: guardandoContacto ? 'wait' : 'pointer',
                      opacity: guardandoContacto ? 0.7 : 1,
                    }}
                  >
                    {guardandoContacto ? (esPT ? 'Salvando...' : 'Guardando...') : esPT ? 'Salvar' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {contactos.length > MINIMO_PARA_BUSCADOR && buscador}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
                  {tarjeta('➕', esPT ? 'Novo' : 'Nuevo', () => setCreandoContacto(true), '__nuevo_contacto__')}
                  {contactosFiltrados.map((c) => tarjeta('👤', c, () => elegirContacto(c), c))}
                </div>
                {contactos.length > 0 && contactosFiltrados.length === 0 && (
                  <p style={{ color: '#fff', textAlign: 'center', fontSize: 13, marginTop: 14 }}>
                    {esPT ? 'Nenhum resultado.' : 'Sin resultados.'}
                  </p>
                )}
              </>
            )}
          </>
        )}

        {paso === 'producto' && (
          <>
            {cargandoOpciones ? (
              <p style={{ color: '#fff', textAlign: 'center' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
            ) : productosDeCategoria.length === 0 ? (
              <p style={{ color: '#fff', textAlign: 'center', fontSize: 13 }}>
                {esPT ? 'Nenhum produto cadastrado nessa categoria.' : 'No hay ningún producto cargado en esta categoría.'}
              </p>
            ) : (
              <>
                {productosDeCategoria.length > MINIMO_PARA_BUSCADOR && buscador}
                {productosFiltrados.length === 0 ? (
                  <p style={{ color: '#fff', textAlign: 'center', fontSize: 13 }}>
                    {esPT ? 'Nenhum resultado.' : 'Sin resultados.'}
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
                    {productosFiltrados.map((p) => tarjeta('📦', p.nombre, () => elegirProducto(p), p.id))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {paso === 'cantidad' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '10px 16px',
                marginBottom: 10,
                fontSize: 12,
                color: 'rgba(255,255,255,0.75)',
                textAlign: 'center',
              }}
            >
              📦 {productoNombre}
            </div>

            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: '26px 20px',
                textAlign: 'center',
                fontSize: 40,
                fontWeight: 900,
                color: colores.azul,
                marginBottom: 18,
              }}
            >
              {cantidad || '0'} {unidadMedida}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'borrar'].map((tecla) => (
                <button
                  key={tecla}
                  type="button"
                  onClick={() => tocarTecla('cantidad', tecla)}
                  style={{
                    padding: '16px 0',
                    borderRadius: 14,
                    border: 'none',
                    background: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tecla === 'borrar' ? '⌫' : tecla}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!cantidad}
              onClick={confirmarCantidad}
              style={{
                border: 'none',
                background: colores.verde,
                color: '#fff',
                borderRadius: 16,
                padding: '16px 0',
                fontSize: 17,
                fontWeight: 800,
                cursor: 'pointer',
                opacity: cantidad ? 1 : 0.5,
              }}
            >
              {esPT ? 'Continuar' : 'Continuar'}
            </button>
          </div>
        )}

        {(paso === 'monto' || paso === 'guardando') && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '10px 16px',
                marginBottom: 10,
                fontSize: 12,
                color: 'rgba(255,255,255,0.75)',
              }}
            >
              {iconoOperacion(operacion)} {nombreOperacionDisplay(idioma, operacion, esFamiliar)} · {iconoParaTexto(categoria)} {categoria} · {iconoParaTexto(formaPago)} {formaPago}
              {tablaContacto && clienteProveedor && (
                <>
                  {' '}· 👤 {clienteProveedor}
                </>
              )}
              {necesitaProducto && productoNombre && (
                <>
                  {' '}· 📦 {productoNombre} ({cantidad} {unidadMedida})
                </>
              )}
            </div>

            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: '26px 20px',
                textAlign: 'center',
                fontSize: 40,
                fontWeight: 900,
                color: colores.azul,
                marginBottom: 18,
              }}
            >
              {simbolo} {monto || '0'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'borrar'].map((tecla) => (
                <button
                  key={tecla}
                  type="button"
                  disabled={paso === 'guardando'}
                  onClick={() => tocarTecla('monto', tecla)}
                  style={{
                    padding: '16px 0',
                    borderRadius: 14,
                    border: 'none',
                    background: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tecla === 'borrar' ? '⌫' : tecla}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={paso === 'guardando' || !monto}
              onClick={confirmarJugada}
              style={{
                border: 'none',
                background: paso === 'guardando' ? 'rgba(46,139,87,0.6)' : colores.verde,
                color: '#fff',
                borderRadius: 16,
                padding: '16px 0',
                fontSize: 17,
                fontWeight: 800,
                cursor: paso === 'guardando' ? 'wait' : 'pointer',
                opacity: monto ? 1 : 0.5,
              }}
            >
              {paso === 'guardando' ? (esPT ? 'Registrando...' : 'Registrando...') : `✅ ${esPT ? 'Confirmar jogada' : 'Confirmar jugada'}`}
            </button>
          </div>
        )}
      </div>

      {celebrando !== null && (
        <CelebracionMiniJuego
          numeroDelDia={celebrando}
          idioma={idioma}
          onTerminar={() => {
            setCelebrando(null);

            if (tutorial) {
              const pasoNuevo = pasoTutorial + 1;
              if (pasoNuevo >= tutorial.operaciones.length) {
                onCompletadoTutorial?.();
              } else {
                setPasoTutorial(pasoNuevo);
                elegirOperacion(tutorial.operaciones[pasoNuevo]);
              }
              return;
            }

            reiniciarJuego();
          }}
        />
      )}
    </div>
  );
}
