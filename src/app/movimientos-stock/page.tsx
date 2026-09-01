'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
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

type Producto = {
  id: string;
  nombre: string;
};

export default function MovimientosStockPage() {
  const router = useRouter();

  const [filas, setFilas] = useState<Movimiento[]>([]);
  const [productos, setProductos] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

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
        setCargando(false);
        return;
      }

      const [{ data: movimientos }, { data: catalogo }] =
        await Promise.all([
          supabase
            .from('movimientos_stock')
            .select(
              'id, id_operacion, fecha, tipo, categoria, producto_id, cantidad, costo_unitario, total, historico, estado'
            )
            .eq('empresa_id', perfil.empresa_id),

          supabase
            .from('productos')
            .select('id, nombre')
            .eq('empresa_id', perfil.empresa_id),
        ]);

      /*
       * ======================================================
       * ORDEN DE MOVIMIENTOS
       * ======================================================
       *
       * La operación más reciente queda primero.
       *
       * Como los IDs tienen formato OP-00001, OP-00002, etc.,
       * la comparación numérica garantiza el orden correcto.
       *
       * Todas las líneas pertenecientes a la misma operación
       * permanecen juntas.
       */
      const movimientosOrdenados = ((movimientos ?? []) as Movimiento[])
        .slice()
        .sort((a, b) => {
          const numeroA = extraerNumeroOperacion(a.id_operacion);
          const numeroB = extraerNumeroOperacion(b.id_operacion);

          if (numeroA !== numeroB) {
            return numeroB - numeroA;
          }

          const fechaA = String(a.fecha ?? '');
          const fechaB = String(b.fecha ?? '');

          return fechaB.localeCompare(fechaA);
        });

      setFilas(movimientosOrdenados);

      setProductos(
        Object.fromEntries(
          ((catalogo ?? []) as Producto[]).map((producto) => [
            producto.id,
            producto.nombre,
          ])
        )
      );

      setCargando(false);
    }

    cargar();
  }, [router]);

  const visibles = filas.filter((fila) =>
    [
      fila.id_operacion,
      fila.tipo,
      fila.categoria,
      fila.historico,
      productos[fila.producto_id],
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  return (
    <Pantalla
      titulo="Movimientos de Stock"
      subtitulo="Consultá las entradas y salidas generadas por las operaciones."
    >
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar ID, producto, tipo o categoría..."
        style={inputStyle}
      />

      {cargando ? (
        <p>Cargando movimientos...</p>
      ) : (
        <Tabla>
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
            </tr>
          </thead>

          <tbody>
            {visibles.map((fila) => (
              <tr key={fila.id} style={filaStyle}>
                <Td>{fila.id_operacion || '—'}</Td>

                <Td>
                  {new Date(
                    `${fila.fecha}T12:00:00`
                  ).toLocaleDateString('es-AR')}
                </Td>

                <Td>{fila.tipo}</Td>

                <Td>
                  {productos[fila.producto_id] ||
                    fila.producto_id}
                </Td>

                <Td>{fila.categoria}</Td>

                <Td align="right">
                  {fila.cantidad}
                </Td>

                <Td align="right">
                  R$ {Number(fila.costo_unitario).toFixed(2)}
                </Td>

                <Td align="right">
                  R${' '}
                  {Number(
                    fila.total ??
                      fila.cantidad *
                        fila.costo_unitario
                  ).toFixed(2)}
                </Td>

                <Td>{fila.historico || '—'}</Td>

                <Td>{fila.estado || '—'}</Td>
              </tr>
            ))}

            {!visibles.length && (
              <tr>
                <td
                  colSpan={10}
                  style={vacioStyle}
                >
                  No se encontraron movimientos.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      )}
    </Pantalla>
  );
}

/* ==========================================================
   OBTENER NÚMERO DE OPERACIÓN
========================================================== */

function extraerNumeroOperacion(
  idOperacion: string | null
): number {
  if (!idOperacion) {
    return -1;
  }

  const coincidencia = idOperacion.match(/\d+/);

  if (!coincidencia) {
    return -1;
  }

  return Number(coincidencia[0]);
}

/* ==========================================================
   PANTALLA
========================================================== */

function Pantalla({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fondo}>
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
        }}
      >
        <header style={encabezado}>
          <Link
            href="/?vista=empresa"
            style={volver}
          >
            ← Volver a Mi Negocio
          </Link>

          <p style={eyebrow}>
            GESTIÓN FINANCIERA
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
            }}
          >
            {titulo}
          </h1>

          <p
            style={{
              margin: '8px 0 0',
              color: '#dbe5ef',
            }}
          >
            {subtitulo}
          </p>
        </header>

        <main style={panel}>
          {children}
        </main>
      </div>
    </div>
  );
}

/* ==========================================================
   TABLA
========================================================== */

function Tabla({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={tablaContenedor}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        {children}
      </table>
    </div>
  );
}

/* ==========================================================
   CABECERA DE TABLA
========================================================== */

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
        padding: '12px 14px',
        color: '#374151',
        fontSize: 12,
        textAlign: align,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

/* ==========================================================
   CELDA DE TABLA
========================================================== */

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
        padding: '12px 14px',
        fontSize: 13,
        textAlign: align,
        whiteSpace: 'nowrap',
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
  background:
    'radial-gradient(circle at top left, #e7f1ed 0%, transparent 34%), #f4f7f8',
  padding: '28px 24px 48px',
};

const encabezado: React.CSSProperties = {
  background:
    'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
  borderRadius: 24,
  padding: '28px 34px',
  color: COLORES.blanco,
  marginBottom: 24,
  boxShadow:
    '0 18px 40px rgba(20,42,71,0.16)',
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
  margin: '0 0 8px',
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 26,
  boxShadow:
    '0 14px 36px rgba(31,58,95,0.10)',
  overflow: 'hidden',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid #d6dee5',
  background: '#fbfcfd',
  marginBottom: 18,
  boxSizing: 'border-box',
};

const tablaContenedor: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
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
