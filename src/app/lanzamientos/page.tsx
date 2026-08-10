'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { registrarOperacion, LineaOperacion } from '@/lib/motor';

const COLORES = {
  azul: '#1f3a5f',
  azulOscuro: '#142a47',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

const SABIO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/SABIO.png';

const LOGO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/Vision%20financiera.jpeg';

type Producto = { id: string; nombre: string; categoria: string | null };

export default function CentralDeLanzamientos() {
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
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lineas, setLineas] = useState<LineaOperacion[]>([
    { producto: '', cantidad: 0, precio: 0 },
  ]);
  const [mensajeSabio, setMensajeSabio] = useState('Elegí una operación para empezar.');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const operacionesConProducto = ['COMPRA', 'VENTA', 'PERDIDA'];

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
        .select('id, nombre, categoria')
        .eq('empresa_id', perfil.empresa_id);

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
      const { data } = await supabase
        .from('matriz_operaciones')
        .select('categoria')
        .eq('empresa_id', empresaId)
        .eq('operacion', operacion);

      const unicas = Array.from(
        new Set((data ?? []).map((f) => f.categoria).filter(Boolean))
      ) as string[];

      setCategorias(unicas);
      setCategoria('');
      setFormaPago('');
      setFormasPago([]);
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
      const { data } = await supabase
        .from('matriz_operaciones')
        .select('forma_pago')
        .eq('empresa_id', empresaId)
        .eq('operacion', operacion)
        .eq('categoria', categoria);

      const unicas = Array.from(
        new Set((data ?? []).map((f) => f.forma_pago).filter(Boolean))
      ) as string[];

      setFormasPago(unicas);
      setFormaPago('');
    }

    cargarFormasPago();
  }, [empresaId, operacion, categoria]);

  function actualizarLinea(indice: number, campo: keyof LineaOperacion, valor: string) {
    setLineas((prev) =>
      prev.map((linea, i) =>
        i === indice
          ? { ...linea, [campo]: campo === 'producto' ? valor : Number(valor) }
          : linea
      )
    );
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { producto: '', cantidad: 0, precio: 0 }]);
  }

  const total = lineas.reduce((s, l) => s + l.cantidad * l.precio, 0);

  const productosDeCategoria = productos.filter(
    (p) => (p.categoria ?? '').toUpperCase() === categoria.toUpperCase()
  );

  async function handleRegistrar() {
    if (!empresaId) return;

    setError('');
    setGuardando(true);

    try {
      await registrarOperacion(empresaId, {
        fecha,
        operacion,
        categoria,
        formaPago,
        historico,
        lineas,
      });

      setMensajeSabio('¡Operación registrada con éxito!');
      setOperacion('');
      setCategoria('');
      setFormaPago('');
      setHistorico('');
      setLineas([{ producto: '', cantidad: 0, precio: 0 }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la operación.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargandoInicial) {
    return <p style={{ padding: 24 }}>Cargando...</p>;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #e7f1ed 0%, transparent 34%), #f4f7f8',
        padding: '28px 24px 48px',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <header style={encabezado}>
          <div
            style={{
              position: 'absolute',
              width: 330,
              height: 330,
              borderRadius: '50%',
              background: 'rgba(89, 184, 134, 0.16)',
              right: -115,
              top: -155,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 210,
              height: 210,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              right: 40,
              bottom: -140,
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 240 }}>
            <Link
              href="/"
              style={{
                color: '#cbd5e1',
                fontSize: 13,
                textDecoration: 'none',
                display: 'inline-block',
                marginBottom: 14,
              }}
            >
              ← Volver a Mi Negocio
            </Link>

            <p
              style={{
                color: '#86efac',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.4,
                margin: '0 0 8px',
              }}
            >
              GESTIÓN FINANCIERA
            </p>

            <h1 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.6px' }}>
              Central de Lanzamientos
            </h1>

            <p
              style={{
                margin: '8px 0 0',
                color: '#dbe5ef',
                fontSize: 14,
                lineHeight: 1.5,
                maxWidth: 500,
              }}
            >
              Registrá todas las operaciones desde un único punto de entrada.
            </p>
          </div>

          <div style={sabioMarca}>
            <span style={sabioTexto}>ASISTIDO POR</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SABIO_URL} alt="Sabio" style={sabioLogo} />
          </div>
        </header>

        <main style={panel}>
          <div style={panelTitulo}>
            <div>
              <p style={eyebrow}>NUEVO REGISTRO</p>
              <h2 style={{ margin: 0, color: COLORES.azul, fontSize: 21 }}>
                Cargá una operación
              </h2>
            </div>
            <span style={estadoActivo}>Sistema activo</span>
          </div>

          <div style={grid2}>
            <Campo label="Fecha">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={inputStyle}
              />
            </Campo>

            <Campo label="Operación">
              <select
                value={operacion}
                onChange={(e) => setOperacion(e.target.value)}
                style={inputStyle}
              >
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
                style={inputStyle}
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
                style={inputStyle}
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

          <Campo label="Histórico / Cliente-Proveedor">
            <input
              type="text"
              value={historico}
              onChange={(e) => setHistorico(e.target.value)}
              style={inputStyle}
            />
          </Campo>

          {operacionesConProducto.includes(operacion) && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: COLORES.azul, marginBottom: 10 }}>
                Detalle de productos
              </p>

              {lineas.map((linea, i) => (
                <div key={i} style={filaProducto}>
                  <select
                    value={linea.producto}
                    onChange={(e) => actualizarLinea(i, 'producto', e.target.value)}
                    style={{ ...inputStyle, flex: 2 }}
                  >
                    <option value="">Producto...</option>
                    {productosDeCategoria.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Cant."
                    value={linea.cantidad || ''}
                    onChange={(e) => actualizarLinea(i, 'cantidad', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />

                  <input
                    type="number"
                    placeholder="Precio"
                    value={linea.precio || ''}
                    onChange={(e) => actualizarLinea(i, 'precio', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              ))}

              <button type="button" onClick={agregarLinea} style={botonSecundario}>
                + Agregar línea
              </button>
            </div>
          )}

          <div style={totalStyle}>
            <span>Total estimado</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>

          <p style={{ color: COLORES.verde, fontSize: 13, margin: '14px 0 0' }}>
            {mensajeSabio}
          </p>

          {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 6 }}>{error}</p>}

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

            <button
              onClick={handleRegistrar}
              disabled={guardando || !operacion || !categoria || !formaPago}
              style={{ ...botonPrincipal, flex: 1 }}
            >
              {guardando ? 'Registrando...' : 'Registrar Operación'}
            </button>
          </div>
        </main>
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

const encabezado: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 28,
  minHeight: 180,
  padding: '30px 34px',
  borderRadius: 24,
  color: COLORES.blanco,
  background: 'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
  boxShadow: '0 18px 40px rgba(20, 42, 71, 0.18)',
  marginBottom: 24,
  flexWrap: 'wrap',
};

const sabioMarca: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minWidth: 145,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '15px 20px',
  borderRadius: 20,
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.18)',
  backdropFilter: 'blur(8px)',
};

const sabioTexto: React.CSSProperties = {
  color: '#dbeafe',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 1.4,
};

const sabioLogo: React.CSSProperties = {
  width: 132,
  height: 82,
  objectFit: 'contain',
  filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.18))',
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