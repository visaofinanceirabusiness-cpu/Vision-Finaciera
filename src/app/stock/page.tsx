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
  costoPromedio: number;
  valorInventario: number;
};

type MovimientoCosto = {
  producto_id: string;
  cantidad: number;
  costo_unitario: number;
};

const categoriaLabel = 'Categor' + String.fromCharCode(237) + 'a';

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

      const [{ data: productos }, { data: saldos }, { data: movimientos }] = await Promise.all([
        supabase
          .from('productos')
          .select('id, nombre, categoria, proveedores(nombre)')
          .eq('empresa_id', perfil.empresa_id),
        supabase
          .from('saldo_stock')
          .select('producto_id, saldo')
          .eq('empresa_id', perfil.empresa_id),
        supabase
          .from('movimientos_stock')
          .select('producto_id, cantidad, costo_unitario')
          .eq('empresa_id', perfil.empresa_id)
          .eq('tipo', 'ENTRADA'),
      ]);

      const saldoPorProducto = new Map(
        (saldos ?? []).map((fila) => [fila.producto_id, Number(fila.saldo ?? 0)])
      );
      const costoPorProducto = new Map<string, { cantidad: number; valor: number }>();

      for (const movimiento of (movimientos as MovimientoCosto[]) ?? []) {
        const actual = costoPorProducto.get(movimiento.producto_id) ?? { cantidad: 0, valor: 0 };
        const cantidad = Number(movimiento.cantidad ?? 0);
        actual.cantidad += cantidad;
        actual.valor += cantidad * Number(movimiento.costo_unitario ?? 0);
        costoPorProducto.set(movimiento.producto_id, actual);
      }

      const combinado: Fila[] = (productos ?? []).map((producto) => {
        const proveedorRel = Array.isArray(producto.proveedores)
          ? producto.proveedores[0]
          : producto.proveedores;
        const costo = costoPorProducto.get(producto.id);
        const costoPromedio = costo && costo.cantidad > 0 ? costo.valor / costo.cantidad : 0;
        const saldo = saldoPorProducto.get(producto.id) ?? 0;

        return {
          id: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          proveedor: (proveedorRel as { nombre: string } | null)?.nombre ?? null,
          saldo,
          costoPromedio,
          valorInventario: saldo * costoPromedio,
        };
      });

      combinado.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setFilas(combinado);
      setCargando(false);
    }

    cargar();
  }, [router]);

  const visibles = filas.filter((fila) =>
    `${fila.nombre} ${fila.categoria ?? ''} ${fila.proveedor ?? ''}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );
  const totalUnidades = visibles.reduce((total, fila) => total + fila.saldo, 0);
  const totalInventario = visibles.reduce((total, fila) => total + fila.valorInventario, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7f9', padding: 24 }}>
      <div style={{ background: COLORES.azul, borderRadius: 16, padding: 24, color: COLORES.blanco, marginBottom: 24 }}>
        <Link href="/" style={{ color: '#cbd5e1', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>
          &larr; Volver a Mi Negocio
        </Link>
        <h1 style={{ margin: 0, fontSize: 22 }}>Saldo de Stock</h1>
        <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: 13 }}>
          {'Cantidades finales, costo promedio y valor del inventario.'}
        </p>
      </div>

      <input
        type="text"
        placeholder={`Buscar producto, ${categoriaLabel.toLowerCase()} o proveedor...`}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ width: '100%', maxWidth: 440, padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: 16, boxSizing: 'border-box' }}
      />

      {cargando ? <p>Cargando...</p> : (
        <div style={{ background: COLORES.blanco, borderRadius: 16, overflowX: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', color: COLORES.azul, fontWeight: 700, borderBottom: '1px solid #e5e7eb' }}>
            <span>{totalUnidades} unidades disponibles</span>
            <span>Valor inventario: R$ {totalInventario.toFixed(2)}</span>
          </div>
          <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <Th>Producto</Th><Th>{categoriaLabel}</Th><Th>Proveedor</Th><Th align="right">Saldo</Th><Th align="right">Costo promedio</Th><Th>Valor inventario</Th><Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => (
                <tr key={fila.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <Td>{fila.nombre}</Td><Td>{fila.categoria ?? 'â€”'}</Td><Td>{fila.proveedor ?? 'â€”'}</Td>
                  <Td align="right"><span style={{ fontWeight: 700, color: fila.saldo <= 0 ? '#dc2626' : COLORES.verde }}>{fila.saldo}</span></Td>
                  <Td align="right">R$ {fila.costoPromedio.toFixed(2)}</Td><Td align="right">R$ {fila.valorInventario.toFixed(2)}</Td>
                  <Td>{fila.saldo <= 0 ? 'Sin stock' : fila.saldo <= 1 ? 'Bajo stock' : 'Activo'}</Td>
                </tr>
              ))}
              {!visibles.length && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: COLORES.gris }}>No se encontraron productos.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th style={{ padding: '12px 16px', fontSize: 13, color: '#374151', textAlign: align }}>{children}</th>;
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td style={{ padding: '12px 16px', fontSize: 14, textAlign: align }}>{children}</td>;
}

