'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { registrarOperacion, LineaOperacion } from '@/lib/motor';

// Paleta de marca
const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

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

  const [mensajeSabio, setMensajeSabio] = useState('🦉 Elegí una operación para empezar.');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const operacionesConProducto = ['COMPRA', 'VENTA', 'PERDIDA'];

  // ------------------------------------------------------------
  // Carga inicial: sesión, empresa, operaciones activas, productos
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // Al cambiar Operación → cargar Categorías desde la Matriz
  // ------------------------------------------------------------
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
    setMensajeSabio(`🦉 Elegí la categoría para "${operacion}".`);
  }, [empresaId, operacion]);

  // ------------------------------------------------------------
  // Al cambiar Categoría → cargar Formas de Pago desde la Matriz
  // ------------------------------------------------------------
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
          ? {
              ...linea,
              [campo]: campo === 'producto' ? valor : Number(valor),
            }
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

      setMensajeSabio('🦉 ¡Operación registrada con éxito!');
      // Reset del formulario, igual que limpiarFormulario() de Apps Script
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
    <div style={{ minHeight: '100vh', background: '#f5f7f9', padding: 24 }}>
      {/* Encabezado estilo banner, como en Google Sheets */}
      <div
        style={{
          background: COLORES.azul,
          borderRadius: 16,
          padding: 24,
          color: COLORES.blanco,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Link
            href="/"
            style={{
              color: '#cbd5e1',
              fontSize: 13,
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: 8,
            }}
          >
            ← Volver a Mi Negocio
          </Link>
          <h1 style={{ margin: 0, fontSize: 22 }}>Central de Lanzamientos</h1>
          <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: 13 }}>
            Registrá todas las operaciones desde un único punto de entrada.
          </p>
        </div>
        <div style={{ fontSize: 36 }}>🦉</div>
      </div>

      <div
        style={{
          background: COLORES.blanco,
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          maxWidth: 720,
        }}
      >
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
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: COLORES.gris, marginBottom: 4 }}>
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

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 600,
            color: COLORES.azul,
          }}
        >
          <span>Total</span>
          <span>R$ {total.toFixed(2)}</span>
        </div>

        <p style={{ color: COLORES.verde, fontSize: 13, marginTop: 12 }}>
          {mensajeSabio}
        </p>

        {error && (
          <p style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{error}</p>
        )}

        <button
          onClick={handleRegistrar}
          disabled={guardando || !operacion || !categoria || !formaPago}
          style={{ ...botonPrincipal, marginTop: 16 }}
        >
          {guardando ? 'Registrando...' : 'Registrar Operación'}
        </button>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
  boxSizing: 'border-box',
};

const filaProducto: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 8,
};

const botonPrincipal: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: 8,
  border: 'none',
  background: COLORES.verde,
  color: COLORES.blanco,
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
};

const botonSecundario: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: `1px solid ${COLORES.azul}`,
  background: 'transparent',
  color: COLORES.azul,
  fontSize: 13,
  cursor: 'pointer',
};
