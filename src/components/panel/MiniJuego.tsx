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
  contarJugadasHoy,
  type CategoriaJuego,
  type ProductoJuego,
} from '@/lib/miniJuego';
import { iconoOperacion, iconoParaTexto } from '@/lib/iconosJuego';
import { fechaLocalHoy } from '@/lib/fecha';
import { CelebracionMiniJuego } from './CelebracionMiniJuego';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

const OPERACIONES_JUEGO = ['VENTA', 'COMPRA', 'PAGO', 'COBRO', 'TRANSFERENCIA', 'INVERSION', 'EXTRACCION', 'PERDIDA'];

// Misma regla que usa Contabilidad para saber si la categoría elegida
// mueve stock y por lo tanto hay que elegir un producto puntual.
function operacionNecesitaProducto(operacion: string, formaPago: string, categoria: CategoriaJuego | undefined) {
  if (!categoria) return false;
  const categoriaEsProducto = categoria.stock === 'SI';
  return (['COMPRA', 'VENTA', 'PERDIDA'].includes(operacion) && categoriaEsProducto) || (operacion === 'INVERSION' && formaPago === 'Mercadería');
}

type Paso = 'operacion' | 'categoria' | 'formaPago' | 'producto' | 'cantidad' | 'monto' | 'guardando';

export function MiniJuego({
  empresaId,
  idioma,
  simbolo,
  colores,
  onCerrar,
}: {
  empresaId: string;
  idioma: string;
  simbolo: string;
  colores: Colores;
  onCerrar: () => void;
}) {
  const esPT = idioma === 'PT';

  const [paso, setPaso] = useState<Paso>('operacion');
  const [operacion, setOperacion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [productoId, setProductoId] = useState('');
  const [productoNombre, setProductoNombre] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [monto, setMonto] = useState('');

  const [categorias, setCategorias] = useState<CategoriaJuego[]>([]);
  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [productos, setProductos] = useState<ProductoJuego[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [error, setError] = useState('');
  const [celebrando, setCelebrando] = useState<number | null>(null);

  useEffect(() => {
    if (!operacion) return;

    setCargandoOpciones(true);
    obtenerCategoriasJuego(empresaId, operacion)
      .then(setCategorias)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando categorías.'))
      .finally(() => setCargandoOpciones(false));
  }, [empresaId, operacion]);

  useEffect(() => {
    if (!operacion || !categoria) return;

    setCargandoOpciones(true);
    obtenerFormasPagoJuego(empresaId, operacion, categoria)
      .then(setFormasPago)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando formas de pago.'))
      .finally(() => setCargandoOpciones(false));
  }, [empresaId, operacion, categoria]);

  const categoriaSeleccionada = categorias.find((c) => c.nombre === categoria);
  const necesitaProducto = operacionNecesitaProducto(operacion, formaPago, categoriaSeleccionada);
  const productosDeCategoria = productos.filter((p) => (p.categoria ?? '').toUpperCase() === categoria.toUpperCase());

  function elegirOperacion(op: string) {
    setOperacion(op);
    setCategoria('');
    setFormaPago('');
    setProductoId('');
    setProductoNombre('');
    setUnidadMedida('');
    setCantidad('');
    setMonto('');
    setPaso('categoria');
  }

  function elegirCategoria(cat: string) {
    setCategoria(cat);
    setFormaPago('');
    setProductoId('');
    setProductoNombre('');
    setUnidadMedida('');
    setCantidad('');
    setMonto('');
    setPaso('formaPago');
  }

  async function elegirFormaPago(fp: string) {
    setFormaPago(fp);
    setMonto('');

    if (operacionNecesitaProducto(operacion, fp, categoriaSeleccionada)) {
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

  function elegirProducto(p: ProductoJuego) {
    setProductoId(p.id);
    setProductoNombre(p.nombre);
    setUnidadMedida(p.unidad_medida ?? '');
    setCantidad('1');
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
    if (paso === 'categoria') setPaso('operacion');
    else if (paso === 'formaPago') setPaso('categoria');
    else if (paso === 'producto') setPaso('formaPago');
    else if (paso === 'cantidad') setPaso('producto');
    else if (paso === 'monto') setPaso(necesitaProducto ? 'cantidad' : 'formaPago');
  }

  function reiniciarJuego() {
    setOperacion('');
    setCategoria('');
    setFormaPago('');
    setProductoId('');
    setProductoNombre('');
    setUnidadMedida('');
    setCantidad('');
    setMonto('');
    setError('');
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
        fecha: fechaLocalHoy(),
        operacion,
        categoria,
        formaPago,
        historico: categoria,
        clienteProveedor: '',
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
    formaPago: esPT ? 'De onde sai o dinheiro?' : '¿De dónde sale la plata?',
    producto: esPT ? 'Qual produto?' : '¿Qué producto?',
    cantidad: esPT ? 'Quantas unidades?' : '¿Cuántas unidades?',
    monto: necesitaProducto ? (esPT ? 'Quanto no total?' : '¿Cuánto salió en total?') : esPT ? 'Quanto foi?' : '¿Cuánto fue?',
    guardando: esPT ? 'Registrando...' : 'Registrando...',
  };

  const tarjeta = (emoji: string, etiqueta: string, onClick: () => void, key: string) => (
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
    </button>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>🎲 {esPT ? 'Mini-Jogo' : 'Mini-Juego'}</div>
        <button
          type="button"
          onClick={onCerrar}
          style={{ border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {esPT ? 'Fechar' : 'Cerrar'}
        </button>
      </div>

      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {paso !== 'operacion' && paso !== 'guardando' && (
          <button
            type="button"
            onClick={volver}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}
          >
            ← {esPT ? 'Voltar' : 'Atrás'}
          </button>
        )}

        <h2 style={{ color: '#fff', fontSize: 20, textAlign: 'center', margin: '0 0 18px' }}>{tituloPaso[paso]}</h2>

        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, marginBottom: 14, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {paso === 'operacion' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
            {OPERACIONES_JUEGO.map((op) =>
              tarjeta(
                iconoOperacion(op),
                op.charAt(0) + op.slice(1).toLowerCase(),
                () => elegirOperacion(op),
                op
              )
            )}
          </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
                {categorias.map((cat) => tarjeta(iconoParaTexto(cat.nombre), cat.nombre, () => elegirCategoria(cat.nombre), cat.nombre))}
              </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
                {formasPago.map((fp) => tarjeta(iconoParaTexto(fp), fp, () => elegirFormaPago(fp), fp))}
              </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
                {productosDeCategoria.map((p) => tarjeta('📦', p.nombre, () => elegirProducto(p), p.id))}
              </div>
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
              {iconoOperacion(operacion)} {operacion.charAt(0) + operacion.slice(1).toLowerCase()} · {iconoParaTexto(categoria)} {categoria} · {iconoParaTexto(formaPago)} {formaPago}
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
            reiniciarJuego();
          }}
        />
      )}
    </div>
  );
}
