'use client';

// BIENVENIDA — WIZARD DE ONBOARDING (Fase 2)
//
// Pantalla obligatoria para toda empresa con onboarding_completado =
// false (ver lib/onboarding.ts). Junta lo mínimo para que la empresa
// quede operativa: categoría de producto/servicio, categoría de
// gasto, socio/a, 2 proveedores/destinos de pago, 2 clientes/fuentes
// de ingreso y (si maneja mercadería) productos.
//
// No marca onboarding_completado = true acá — eso lo hace la Fase 3
// (las 3 operaciones guiadas en la Central de Lançamentos). Esta
// pantalla solo deja la empresa en condiciones de operar: al
// terminar, genera la Matriz de Operações y redirige a Contabilidad.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { crearTraductor } from '@/lib/i18n';
import { crearCategoriaProducto, crearCategoriaGasto, crearCategoriaIngreso } from '@/lib/categorias';
import { crearSocio } from '@/lib/socios';
import { generarMatrizOperaciones } from '@/lib/motor';
import { empresaManejaMercaderia } from '@/lib/perfilCapacidades';
import { empresaTieneOnboardingCompleto } from '@/lib/onboarding';
import { obtenerEtiquetas } from '../recursos-humanos/i18n';
import { diccionarioBienvenida } from './i18n';
import { crearContacto, crearProductoBasico } from './acciones';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Producto = { nombre: string; categoria: string };

type Progreso = {
  categorias: boolean;
  gastos: boolean;
  socios: boolean;
  proveedores: boolean;
  clientes: boolean;
  productos: boolean;
  matriz: boolean;
};

const PROGRESO_INICIAL: Progreso = {
  categorias: false,
  gastos: false,
  socios: false,
  proveedores: false,
  clientes: false,
  productos: false,
  matriz: false,
};

export default function BienvenidaPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<string | null>(null);
  const [esFamiliar, setEsFamiliar] = useState(false);
  const [manejaMercaderia, setManejaMercaderia] = useState(false);

  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [error, setError] = useState('');

  const [categorias, setCategorias] = useState<string[]>([]);
  const [gastos, setGastos] = useState<string[]>([]);
  const [socios, setSocios] = useState<string[]>([]);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [clientes, setClientes] = useState<string[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  const [campoCategoria, setCampoCategoria] = useState('');
  const [campoGasto, setCampoGasto] = useState('');
  const [campoSocio, setCampoSocio] = useState('');
  const [campoProveedor, setCampoProveedor] = useState('');
  const [campoCliente, setCampoCliente] = useState('');
  const [campoProductoNombre, setCampoProductoNombre] = useState('');
  const [campoProductoCategoria, setCampoProductoCategoria] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState<Progreso>(PROGRESO_INICIAL);
  const [errorFinal, setErrorFinal] = useState('');

  const t = crearTraductor(diccionarioBienvenida, idioma);
  const etiquetasProveedor = obtenerEtiquetas('proveedores', esFamiliar, idioma);
  const etiquetasCliente = obtenerEtiquetas('clientes', esFamiliar, idioma);

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

      if (errorPerfil || !perfil?.empresa_id) {
        setError(t('errorSinEmpresa'));
        setCargandoInicial(false);
        return;
      }

      const [{ data: empresa }, tieneOnboardingCompleto, manejaMercaderiaResultado] = await Promise.all([
        supabase
          .from('empresas')
          .select('idioma, perfiles_empresa(codigo)')
          .eq('id', perfil.empresa_id)
          .maybeSingle(),
        empresaTieneOnboardingCompleto(perfil.empresa_id),
        empresaManejaMercaderia(perfil.empresa_id),
      ]);

      if (tieneOnboardingCompleto) {
        router.push('/');
        return;
      }

      const perfilCodigo = (
        empresa as unknown as { perfiles_empresa?: { codigo: string } | null } | null
      )?.perfiles_empresa?.codigo;

      setEmpresaId(perfil.empresa_id);
      setIdioma(empresa?.idioma ?? null);
      setEsFamiliar(perfilCodigo === 'FAMILIAR');
      setManejaMercaderia(manejaMercaderiaResultado);
      setCargandoInicial(false);
    }

    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function agregar(valor: string, lista: string[], setLista: (v: string[]) => void, limpiar: () => void) {
    const limpio = valor.trim();
    if (!limpio) return;
    setLista([...lista, limpio]);
    limpiar();
  }

  function quitar(indice: number, lista: string[], setLista: (v: string[]) => void) {
    setLista(lista.filter((_, i) => i !== indice));
  }

  function agregarProducto() {
    const nombre = campoProductoNombre.trim();
    if (!nombre || !campoProductoCategoria) return;
    setProductos([...productos, { nombre, categoria: campoProductoCategoria }]);
    setCampoProductoNombre('');
  }

  const etiquetaCategoria = manejaMercaderia
    ? t('seccionCategoriaProductoTitulo')
    : t('seccionCategoriaServicioTitulo');

  const ayudaCategoria = manejaMercaderia
    ? t('seccionCategoriaProductoAyuda')
    : t('seccionCategoriaServicioAyuda');

  async function finalizar() {
    if (!empresaId) return;

    if (categorias.length === 0) return setErrorFinal(t('errorMinimoCategoria'));
    if (gastos.length === 0) return setErrorFinal(t('errorMinimoGasto'));
    if (socios.length === 0) return setErrorFinal(t('errorMinimoSocio'));
    if (proveedores.length < 2) return setErrorFinal(t('errorMinimoProveedores'));
    if (clientes.length < 2) return setErrorFinal(t('errorMinimoClientes'));
    if (manejaMercaderia && productos.length === 0) return setErrorFinal(t('errorMinimoProducto'));

    setErrorFinal('');
    setGuardando(true);

    try {
      if (!progreso.categorias) {
        for (const nombre of categorias) {
          if (manejaMercaderia) {
            await crearCategoriaProducto(empresaId, nombre);
          } else {
            await crearCategoriaIngreso(empresaId, nombre, esFamiliar ? 'COBRO' : 'VENTA');
          }
        }
        setProgreso((actual) => ({ ...actual, categorias: true }));
      }

      if (!progreso.gastos) {
        for (const nombre of gastos) {
          await crearCategoriaGasto(empresaId, nombre);
        }
        setProgreso((actual) => ({ ...actual, gastos: true }));
      }

      if (!progreso.socios) {
        for (const nombre of socios) {
          await crearSocio(empresaId, nombre);
        }
        setProgreso((actual) => ({ ...actual, socios: true }));
      }

      if (!progreso.proveedores) {
        for (const nombre of proveedores) {
          await crearContacto(empresaId, 'proveedores', nombre);
        }
        setProgreso((actual) => ({ ...actual, proveedores: true }));
      }

      if (!progreso.clientes) {
        for (const nombre of clientes) {
          await crearContacto(empresaId, 'clientes', nombre);
        }
        setProgreso((actual) => ({ ...actual, clientes: true }));
      }

      if (!progreso.productos && manejaMercaderia) {
        const { data: categoriasCreadas, error: errorCategorias } = await supabase
          .from('categorias_productos')
          .select('id, nombre')
          .eq('empresa_id', empresaId);

        if (errorCategorias) {
          throw errorCategorias;
        }

        const idPorNombre = new Map((categoriasCreadas ?? []).map((c) => [c.nombre, c.id]));

        for (const producto of productos) {
          const categoriaId = idPorNombre.get(producto.categoria);

          if (!categoriaId) {
            throw new Error(t('errorSeleccionarCategoria'));
          }

          await crearProductoBasico(empresaId, producto.nombre, categoriaId, producto.categoria);
        }

        setProgreso((actual) => ({ ...actual, productos: true }));
      }

      if (!progreso.matriz) {
        await generarMatrizOperaciones(empresaId);
        setProgreso((actual) => ({ ...actual, matriz: true }));
      }

      router.push('/contabilidad');
    } catch (e) {
      console.error('Error en el onboarding:', e);
      setErrorFinal(e instanceof Error ? e.message : t('errorMatriz'));
    } finally {
      setGuardando(false);
    }
  }

  if (cargandoInicial) {
    return <div style={cargandoStyle}>{t('cargando')}</div>;
  }

  if (error) {
    return <div style={cargandoStyle}>{error}</div>;
  }

  return (
    <div style={fondo}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <header style={encabezado}>
          <div style={eyebrow}>{t('eyebrow')}</div>
          <h1 style={{ margin: 0, fontSize: 30 }}>{t('titulo')}</h1>
          <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>{t('subtitulo')}</p>
        </header>

        <main style={panel}>
          <Seccion titulo={etiquetaCategoria} ayuda={ayudaCategoria}>
            <FilaAgregar
              valor={campoCategoria}
              onChange={setCampoCategoria}
              onAgregar={() => agregar(campoCategoria, categorias, setCategorias, () => setCampoCategoria(''))}
              placeholder={t('nombrePlaceholder')}
              botonLabel={t('agregar')}
            />
            <Chips items={categorias} onQuitar={(i) => quitar(i, categorias, setCategorias)} quitarLabel={t('quitar')} vacio={t('sinCargar')} />
          </Seccion>

          <Seccion titulo={t('seccionGastoTitulo')} ayuda={t('seccionGastoAyuda')}>
            <FilaAgregar
              valor={campoGasto}
              onChange={setCampoGasto}
              onAgregar={() => agregar(campoGasto, gastos, setGastos, () => setCampoGasto(''))}
              placeholder={t('nombrePlaceholder')}
              botonLabel={t('agregar')}
            />
            <Chips items={gastos} onQuitar={(i) => quitar(i, gastos, setGastos)} quitarLabel={t('quitar')} vacio={t('sinCargar')} />
          </Seccion>

          <Seccion titulo={t('seccionSocioTitulo')} ayuda={t('seccionSocioAyuda')}>
            <FilaAgregar
              valor={campoSocio}
              onChange={setCampoSocio}
              onAgregar={() => agregar(campoSocio, socios, setSocios, () => setCampoSocio(''))}
              placeholder={t('nombrePlaceholder')}
              botonLabel={t('agregar')}
            />
            <Chips items={socios} onQuitar={(i) => quitar(i, socios, setSocios)} quitarLabel={t('quitar')} vacio={t('sinCargar')} />
          </Seccion>

          <Seccion titulo={`4. ${etiquetasProveedor.plural}`} ayuda="">
            <FilaAgregar
              valor={campoProveedor}
              onChange={setCampoProveedor}
              onAgregar={() => agregar(campoProveedor, proveedores, setProveedores, () => setCampoProveedor(''))}
              placeholder={t('nombrePlaceholder')}
              botonLabel={t('agregar')}
            />
            <Chips items={proveedores} onQuitar={(i) => quitar(i, proveedores, setProveedores)} quitarLabel={t('quitar')} vacio={t('sinCargar')} />
          </Seccion>

          <Seccion titulo={`5. ${etiquetasCliente.plural}`} ayuda="">
            <FilaAgregar
              valor={campoCliente}
              onChange={setCampoCliente}
              onAgregar={() => agregar(campoCliente, clientes, setClientes, () => setCampoCliente(''))}
              placeholder={t('nombrePlaceholder')}
              botonLabel={t('agregar')}
            />
            <Chips items={clientes} onQuitar={(i) => quitar(i, clientes, setClientes)} quitarLabel={t('quitar')} vacio={t('sinCargar')} />
          </Seccion>

          {manejaMercaderia && (
            <Seccion titulo={t('seccionProductoTitulo')} ayuda={t('seccionProductoAyuda')}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <input
                  value={campoProductoNombre}
                  onChange={(e) => setCampoProductoNombre(e.target.value)}
                  placeholder={t('nombrePlaceholder')}
                  style={{ ...inputStyle, flex: 2, minWidth: 160 }}
                />

                <select
                  value={campoProductoCategoria}
                  onChange={(e) => setCampoProductoCategoria(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 140 }}
                >
                  <option value="">{t('categoriaPlaceholder')}</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button type="button" onClick={agregarProducto} style={botonAgregar}>
                  {t('agregar')}
                </button>
              </div>

              {productos.length === 0 ? (
                <p style={{ color: COLORES.gris, fontSize: 13 }}>{t('sinCargar')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {productos.map((p, indice) => (
                    <div key={`${p.nombre}-${indice}`} style={chipFila}>
                      <span>
                        <strong>{p.nombre}</strong> — {p.categoria}
                      </span>
                      <button
                        type="button"
                        onClick={() => setProductos(productos.filter((_, i) => i !== indice))}
                        style={botonQuitar}
                      >
                        {t('quitar')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Seccion>
          )}

          {errorFinal && <div style={errorBox}>{errorFinal}</div>}

          <button type="button" onClick={finalizar} disabled={guardando} style={botonFinal}>
            {guardando ? t('procesando') : t('botonFinalizar')}
          </button>
        </main>
      </div>
    </div>
  );
}

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda: string; children: React.ReactNode }) {
  return (
    <section style={seccionEstilo}>
      <h2 style={{ margin: '0 0 4px', color: COLORES.azul, fontSize: 17 }}>{titulo}</h2>
      {ayuda && <p style={{ margin: '0 0 12px', color: COLORES.gris, fontSize: 13 }}>{ayuda}</p>}
      {children}
    </section>
  );
}

function FilaAgregar({
  valor,
  onChange,
  onAgregar,
  placeholder,
  botonLabel,
}: {
  valor: string;
  onChange: (v: string) => void;
  onAgregar: () => void;
  placeholder: string;
  botonLabel: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAgregar();
          }
        }}
        placeholder={placeholder}
        style={{ ...inputStyle, flex: 1 }}
      />
      <button type="button" onClick={onAgregar} style={botonAgregar}>
        {botonLabel}
      </button>
    </div>
  );
}

function Chips({
  items,
  onQuitar,
  quitarLabel,
  vacio,
}: {
  items: string[];
  onQuitar: (indice: number) => void;
  quitarLabel: string;
  vacio: string;
}) {
  if (items.length === 0) {
    return <p style={{ color: COLORES.gris, fontSize: 13 }}>{vacio}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, indice) => (
        <div key={`${item}-${indice}`} style={chipFila}>
          <span>{item}</span>
          <button type="button" onClick={() => onQuitar(indice)} style={botonQuitar}>
            {quitarLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

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
};

const seccionEstilo: React.CSSProperties = {
  paddingBottom: 20,
  marginBottom: 20,
  borderBottom: '1px solid #e7edf1',
};

const inputStyle: React.CSSProperties = {
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

const botonAgregar: React.CSSProperties = {
  padding: '0 16px',
  borderRadius: 10,
  border: 'none',
  background: COLORES.verde,
  color: COLORES.blanco,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const chipFila: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '9px 12px',
  borderRadius: 10,
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
  fontSize: 13.5,
  color: COLORES.azul,
};

const botonQuitar: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#b91c1c',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const botonFinal: React.CSSProperties = {
  width: '100%',
  padding: '15px 0',
  borderRadius: 12,
  border: 'none',
  background: 'linear-gradient(135deg, #2e8b57, #237044)',
  color: COLORES.blanco,
  fontWeight: 800,
  fontSize: 16,
  cursor: 'pointer',
  marginTop: 8,
};

const errorBox: React.CSSProperties = {
  background: '#fef2f2',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 12,
  padding: '11px 14px',
  marginBottom: 18,
  fontSize: 13,
};

const cargandoStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: COLORES.azul,
  fontWeight: 700,
};
