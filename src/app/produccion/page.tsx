'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  calcularConsumo,
  CalculoProduccion,
  ProductoProduccion,
} from '@/lib/produccion';
import { crearTraductor } from '@/lib/i18n';
import { empresaTieneOnboardingCompleto } from '@/lib/onboarding';
import { SabioWidget } from '@/components/panel/SabioWidget';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import {
  diccionarioProduccion,
  msgStockSuficiente,
  msgStockFaltante,
  msgFaltan,
  msgHayStockSuficiente,
  msgNoHayStockSuficiente,
  frasesSabioProduccion,
} from './i18n';

const COLORES = {
  azul: '#1f3a5f',
  azulOscuro: '#142a47',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  fondo: '#f5f7f9',
  borde: '#d6dee5',
  rojo: '#dc2626',
  verdeClaro: '#eaf7ee',
};

export default function ProduccionPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<string | null>(null);
  const [productos, setProductos] = useState<ProductoProduccion[]>([]);
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [calculo, setCalculo] = useState<CalculoProduccion | null>(null);

  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const t = crearTraductor(diccionarioProduccion, idioma);

  useEffect(() => {
    async function cargar() {
      setError('');

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

      if (errorPerfil) {
        setError(t('errorPerfilEmpresa'));
        setCargandoInicial(false);
        return;
      }

      if (!perfil?.empresa_id) {
        setError(t('errorSinEmpresa'));
        setCargandoInicial(false);
        return;
      }

      if (!(await empresaTieneOnboardingCompleto(perfil.empresa_id))) {
        router.push('/bienvenida');
        return;
      }

      setEmpresaId(perfil.empresa_id);

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('idioma')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      setIdioma(empresaData?.idioma ?? null);

      const { data: productosData, error: errorProductos } = await supabase
        .from('productos')
        .select('id, nombre, unidad_medida, tipo_producto')
        .eq('empresa_id', perfil.empresa_id)
        .eq('tipo_producto', 'TERMINADO')
        .order('nombre');

      if (errorProductos) {
        setError(t('errorProductosTerminados'));
        setCargandoInicial(false);
        return;
      }

      setProductos((productosData ?? []) as ProductoProduccion[]);
      setCargandoInicial(false);
    }

    cargar();
  }, [router]);

  const productoSeleccionado = useMemo(
    () => productos.find((producto) => producto.id === productoId) ?? null,
    [productos, productoId]
  );

  function limpiarCalculo() {
    setCalculo(null);
    setError('');
    setMensaje('');
  }

  async function handleCalcular() {
    if (!empresaId) {
      setError(t('errorSinEmpresaCalcular'));
      return;
    }

    if (!productoId) {
      setError(t('errorSeleccionarProducto'));
      return;
    }

    const cantidadNumerica = Number(cantidad);

    if (!cantidadNumerica || cantidadNumerica <= 0) {
      setError(t('errorCantidadInvalida'));
      return;
    }

    setError('');
    setMensaje('');
    setCalculando(true);
    setCalculo(null);

    try {
      const resultado = await calcularConsumo(
        empresaId,
        productoId,
        cantidadNumerica
      );

      setCalculo(resultado);

      if (resultado.stockSuficiente) {
        setMensaje(msgStockSuficiente(idioma));
      } else {
        setMensaje(msgStockFaltante(idioma));
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t('errorCalcular')
      );
    } finally {
      setCalculando(false);
    }
  }

  function handleCantidadChange(valor: string) {
    setCantidad(valor);
    limpiarCalculo();
  }

  function handleProductoChange(valor: string) {
    setProductoId(valor);
    setCantidad('');
    limpiarCalculo();
  }

  if (cargandoInicial) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: COLORES.fondo,
          padding: 24,
          color: COLORES.azul,
        }}
      >
        <p>{t('cargandoProduccion')}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORES.fondo,
        padding: '28px 24px 48px',
      }}
    >
      <div style={{ maxWidth: 1050, margin: '0 auto' }}>
        {/* ENCABEZADO */}
        <header style={encabezado}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Link
              href="/?vista=empresa"
              style={{
                color: '#cbd5e1',
                fontSize: 13,
                textDecoration: 'none',
                display: 'inline-block',
                marginBottom: 14,
              }}
            >
              &larr; {t('volver')}
            </Link>

            <p
              style={{
                margin: '0 0 7px',
                color: '#86efac',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.4,
              }}
            >
              {t('eyebrow')}
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: 30,
                letterSpacing: '-0.6px',
              }}
            >
              {t('titulo')}
            </h1>

            <p
              style={{
                margin: '8px 0 0',
                color: '#dbe5ef',
                fontSize: 14,
                lineHeight: 1.5,
                maxWidth: 610,
              }}
            >
              {t('subtitulo')}
            </p>
          </div>

          {/* SABIO — permanente, con tips propios de Produção. Vive en
              el mismo panel del encabezado. */}
          <SabioWidget
            colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
            idioma={idioma}
            frases={frasesSabioProduccion(idioma)}
          />

          <AccesosHerramientas />
        </header>

        {/* PANEL PRINCIPAL */}
        <main style={panel}>
          <div style={panelTitulo}>
            <div>
              <p style={eyebrow}>{t('eyebrowNueva')}</p>
              <h2
                style={{
                  margin: 0,
                  color: COLORES.azul,
                  fontSize: 21,
                }}
              >
                {t('prepararProduccion')}
              </h2>
            </div>

            <span style={estadoActivo}>{t('moduloActivo')}</span>
          </div>

          {/* DATOS DE PRODUCCIÓN */}
          <div style={grid2}>
            <Campo label={t('productoTerminado')}>
              <select
                value={productoId}
                onChange={(e) => handleProductoChange(e.target.value)}
                style={inputStyle}
              >
                <option value="">{t('seleccionarProducto')}</option>

                {productos.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label={t('cantidadAProducir')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cantidad}
                onChange={(e) => handleCantidadChange(e.target.value)}
                placeholder={t('cantidadPlaceholder')}
                style={inputStyle}
                disabled={!productoId}
              />
            </Campo>
          </div>

          {/* INFORMACIÓN DEL PRODUCTO */}
          {productoSeleccionado && (
            <div style={infoProducto}>
              <div>
                <span style={infoLabel}>{t('producto')}</span>
                <strong>{productoSeleccionado.nombre}</strong>
              </div>

              <div>
                <span style={infoLabel}>{t('unidad')}</span>
                <strong>
                  {productoSeleccionado.unidad_medida ?? 'UNIDAD'}
                </strong>
              </div>
            </div>
          )}

          {/* ACCIÓN CALCULAR */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={handleCalcular}
              disabled={
                calculando ||
                !productoId ||
                !cantidad ||
                Number(cantidad) <= 0
              }
              style={{
                ...botonPrincipal,
                opacity:
                  calculando ||
                  !productoId ||
                  !cantidad ||
                  Number(cantidad) <= 0
                    ? 0.55
                    : 1,
              }}
            >
              {calculando ? t('calculando') : t('calcularConsumo')}
            </button>
          </div>

          {/* MENSAJES */}
          {error && (
            <div style={errorBox}>
              {error}
            </div>
          )}

          {mensaje && !error && (
            <div
              style={{
                ...mensajeBox,
                background: calculo?.stockSuficiente
                  ? COLORES.verdeClaro
                  : '#fff7ed',
                color: calculo?.stockSuficiente
                  ? '#247347'
                  : '#9a3412',
              }}
            >
              {mensaje}
            </div>
          )}

          {/* RESULTADO */}
          {calculo && (
            <section style={{ marginTop: 28 }}>
              <div style={resultadoHeader}>
                <div>
                  <p style={eyebrow}>{t('eyebrowResultado')}</p>
                  <h3
                    style={{
                      margin: 0,
                      color: COLORES.azul,
                      fontSize: 20,
                    }}
                  >
                    {t('consumoEstimado')}
                  </h3>
                </div>

                <div style={cantidadResultado}>
                  <span>{t('cantidad')}</span>
                  <strong>{calculo.cantidadProducir}</strong>
                </div>
              </div>

              <div style={tarjetaReceta}>
                <div>
                  <span style={infoLabel}>{t('receta')}</span>
                  <strong>{calculo.receta.nombre}</strong>
                </div>

                <div>
                  <span style={infoLabel}>{t('rinde')}</span>
                  <strong>
                    {calculo.receta.rendimiento}{' '}
                    {calculo.receta.unidad_rendimiento}
                  </strong>
                </div>

                <div>
                  <span style={infoLabel}>{t('multiplicador')}</span>
                  <strong>{calculo.multiplicador.toFixed(2)}×</strong>
                </div>
              </div>

              <div style={tablaWrapper}>
                <table style={tabla}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <Th>{t('insumoHeader')}</Th>
                      <Th align="right">{t('necesarioHeader')}</Th>
                      <Th align="right">{t('disponibleHeader')}</Th>
                      <Th>{t('estadoHeader')}</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {calculo.insumos.map((insumo) => (
                      <tr
                        key={insumo.insumoId}
                        style={{
                          borderTop: '1px solid #e5e7eb',
                        }}
                      >
                        <Td>
                          <strong>{insumo.nombre}</strong>
                        </Td>

                        <Td align="right">
                          {formatearNumero(insumo.cantidadNecesaria, idioma)}{' '}
                          {insumo.unidadMedida}
                        </Td>

                        <Td align="right">
                          {formatearNumero(insumo.stockDisponible, idioma)}{' '}
                          {insumo.unidadMedida}
                        </Td>

                        <Td>
                          <span
                            style={{
                              ...estadoInsumo,
                              color: insumo.stockSuficiente
                                ? '#247347'
                                : COLORES.rojo,
                              background: insumo.stockSuficiente
                                ? COLORES.verdeClaro
                                : '#fef2f2',
                            }}
                          >
                            {insumo.stockSuficiente
                              ? t('disponible')
                              : msgFaltan(
                                  idioma,
                                  formatearNumero(
                                    insumo.cantidadNecesaria - insumo.stockDisponible,
                                    idioma
                                  ),
                                  insumo.unidadMedida
                                )}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: '15px 18px',
                  borderRadius: 14,
                  background: calculo.stockSuficiente
                    ? '#edf6f0'
                    : '#fef2f2',
                  color: calculo.stockSuficiente
                    ? '#247347'
                    : '#991b1b',
                  fontWeight: 700,
                }}
              >
                {calculo.stockSuficiente
                  ? msgHayStockSuficiente(idioma, calculo.cantidadProducir, calculo.producto.nombre)
                  : msgNoHayStockSuficiente(idioma)}
              </div>

              {/* TODAVÍA NO PRODUCE */}
              <div style={bloqueProximaEtapa}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    color: COLORES.azul,
                  }}
                >
                  {t('proximoPaso')}
                </p>

                <p
                  style={{
                    margin: '5px 0 0',
                    fontSize: 13,
                    color: COLORES.gris,
                    lineHeight: 1.5,
                  }}
                >
                  {t('proximoPasoTexto')}
                </p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          fontSize: 13,
          color: '#374151',
          fontWeight: 600,
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      style={{
        padding: '12px 16px',
        fontSize: 13,
        color: '#374151',
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      style={{
        padding: '12px 16px',
        fontSize: 14,
        textAlign: align,
      }}
    >
      {children}
    </td>
  );
}

function formatearNumero(valor: number, idioma: string | null) {
  return Number(valor).toLocaleString(idioma === 'PT' ? 'pt-BR' : 'es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

const encabezado: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 28,
  minHeight: 180,
  padding: '30px 34px',
  borderRadius: 24,
  color: COLORES.blanco,
  background:
    'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
  boxShadow: '0 18px 40px rgba(20, 42, 71, 0.18)',
  marginBottom: 24,
  flexWrap: 'wrap',
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 30,
  boxShadow: '0 14px 36px rgba(31,58,95,0.10)',
  border: '1px solid rgba(31,58,95,0.07)',
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

const eyebrow: React.CSSProperties = {
  margin: '0 0 5px',
  color: COLORES.verde,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: 1.3,
};

const estadoActivo: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: 999,
  background: COLORES.verdeClaro,
  color: '#247347',
  fontSize: 12,
  fontWeight: 700,
};

const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0 16px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: `1px solid ${COLORES.borde}`,
  background: '#fbfcfd',
  color: '#1f2937',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

const botonPrincipal: React.CSSProperties = {
  minWidth: 190,
  padding: '13px 18px',
  borderRadius: 11,
  border: 'none',
  background: 'linear-gradient(135deg, #2e8b57, #237044)',
  color: COLORES.blanco,
  boxShadow: '0 8px 16px rgba(46,139,87,0.22)',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

const infoProducto: React.CSSProperties = {
  display: 'flex',
  gap: 34,
  flexWrap: 'wrap',
  marginTop: 4,
  padding: '14px 16px',
  borderRadius: 12,
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
  color: COLORES.azul,
};

const infoLabel: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  color: COLORES.gris,
  fontSize: 11,
  fontWeight: 600,
};

const errorBox: React.CSSProperties = {
  marginTop: 18,
  padding: '12px 15px',
  borderRadius: 10,
  background: '#fef2f2',
  color: '#991b1b',
  fontSize: 13,
  fontWeight: 600,
};

const mensajeBox: React.CSSProperties = {
  marginTop: 18,
  padding: '12px 15px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
};

const resultadoHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 16,
  flexWrap: 'wrap',
};

const cantidadResultado: React.CSSProperties = {
  minWidth: 110,
  padding: '12px 16px',
  borderRadius: 14,
  background: '#edf6f0',
  color: COLORES.azul,
  textAlign: 'center',
};

const tarjetaReceta: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  marginBottom: 18,
  padding: 16,
  borderRadius: 14,
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
};

const tablaWrapper: React.CSSProperties = {
  background: COLORES.blanco,
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  overflowX: 'auto',
};

const tabla: React.CSSProperties = {
  width: '100%',
  minWidth: 760,
  borderCollapse: 'collapse',
};

const estadoInsumo: React.CSSProperties = {
  display: 'inline-block',
  padding: '5px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
};

const bloqueProximaEtapa: React.CSSProperties = {
  marginTop: 18,
  padding: '14px 16px',
  borderRadius: 12,
  background: '#f8fafc',
  border: '1px dashed #cbd5e1',
};
