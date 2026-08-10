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

type Fila = {
  id: string;
  nombre: string;
  categoria: string | null;
  proveedor: string | null;
  saldo: number;
};

export default function StockPage() {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

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

      // Productos de la empresa, con el nombre del proveedor
      const { data: productos } = await supabase
        .from('productos')
        .select('id, nombre, categoria, proveedores(nombre)')
        .eq('empresa_id', perfil.empresa_id);

      // Saldo calculado (vista que suma entradas y resta salidas)
      const { data: saldos } = await supabase
        .from('saldo_stock')
        .select('producto_id, saldo')
        .eq('empresa_id', perfil.empresa_id);

      const saldoPorProducto = new Map(
        (saldos ?? []).map((s) => [s.producto_id, s.saldo])
      );

      const combinado: Fila[] = (productos ?? []).map((p) => {
        // Supabase devuelve la relación como objeto o array según el caso
        const proveedorRel = Array.isArray(p.proveedores)
          ? p.proveedores[0]
          : p.proveedores;

        return {
          id: p.id,
          nombre: p.nombre,
          categoria: p.categoria,
          proveedor: (proveedorRel as { nombre: string } | null)?.nombre ?? null,
          saldo: saldoPorProducto.get(p.id) ?? 0,
        };
      });

      combinado.sort((a, b) => a.nombre.localeCompare(b.nombre));

      setFilas(combinado);
      setCargando(false);
    }

    cargar();
  }, [router]);

  const filasFiltradas = filas.filter((f) =>
    f.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7f9', padding: 24 }}>
      <div
        style={{
          background: COLORES.azul,
          borderRadius: 16,
          padding: 24,
          color: COLORES.blanco,
          marginBottom: 24,
        }}
      >
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
        <h1 style={{ margin: 0, fontSize: 22 }}>Saldo de Stock</h1>
        <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: 13 }}>
          Cuánto tenés disponible de cada producto, calculado automáticamente.
        </p>
      </div>

      <input
        type="text"
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{
          width: '100%',
          maxWidth: 400,
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          marginBottom: 16,
          boxSizing: 'border-box',
        }}
      />

      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <div
          style={{
            background: COLORES.blanco,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <Th>Producto</Th>
                <Th>Categoría</Th>
                <Th>Proveedor</Th>
                <Th align="right">Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((f) => (
                <tr key={f.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <Td>{f.nombre}</Td>
                  <Td>{f.categoria ?? '—'}</Td>
                  <Td>{f.proveedor ?? '—'}</Td>
                  <Td align="right">
                    <span
                      style={{
                        fontWeight: 700,
                        color: f.saldo <= 0 ? '#dc2626' : COLORES.verde,
                      }}
                    >
                      {f.saldo}
                    </span>
                  </Td>
                </tr>
              ))}
              {filasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: COLORES.gris }}>
                    No se encontraron productos.
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

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{ padding: '12px 16px', fontSize: 13, color: '#374151', textAlign: align }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '12px 16px', fontSize: 14, textAlign: align }}>{children}</td>
  );
}
