'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { eliminarOperacion } from '@/lib/motor';

const COLORES = { azul: '#1f3a5f', verde: '#2e8b57', gris: '#6e7781', blanco: '#ffffff' };

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

export default function RegistrosPage() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [filas, setFilas] = useState<Registro[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function cargar(empresa: string) {
    const { data } = await supabase
      .from('registro_operaciones')
      .select('id_operacion, fecha, operacion, categoria, forma_pago, total, historico, cliente_proveedor, estado')
      .eq('empresa_id', empresa)
      .order('fecha', { ascending: false });

    setFilas((data ?? []) as Registro[]);
  }

  useEffect(() => {
    async function iniciar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.push('/login'); return; }

      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', userData.user.id).maybeSingle();
      if (!perfil?.empresa_id) { setCargando(false); return; }

      setEmpresaId(perfil.empresa_id);
      await cargar(perfil.empresa_id);
      setCargando(false);
    }
    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleEliminar(idOperacion: string) {
    if (!empresaId) return;

    const confirmado = window.confirm(
      `¿Eliminar la operación ${idOperacion}?\n\n` +
        'Esto borra también todos los movimientos de stock que generó. ' +
        'No se puede deshacer.'
    );

    if (!confirmado) return;

    setError('');
    setBorrando(idOperacion);

    try {
      await eliminarOperacion(empresaId, idOperacion);
      await cargar(empresaId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo eliminar la operación.'
      );
    } finally {
      setBorrando(null);
    }
  }

  const visibles = filas.filter((fila) =>
    [fila.id_operacion, fila.operacion, fila.categoria, fila.forma_pago, fila.historico, fila.cliente_proveedor]
      .filter(Boolean).join(' ').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <Pantalla titulo="Registro de Operaciones" subtitulo="Consultá las operaciones contables registradas en tu empresa.">
      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar operación, categoría o persona..." style={inputStyle} />
      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {cargando ? <p>Cargando registros...</p> : (
        <Tabla>
          <thead><tr style={cabeceraFila}><Th>ID Registro</Th><Th>Fecha</Th><Th>Operación</Th><Th>Categoría</Th><Th>Forma de pago</Th><Th>Histórico</Th><Th>Cliente / Proveedor</Th><Th align="right">Total</Th><Th>Estado</Th><Th></Th></tr></thead>
          <tbody>{visibles.map((fila) => (
            <tr key={fila.id_operacion} style={filaStyle}>
              <Td>{fila.id_operacion}</Td><Td>{new Date(`${fila.fecha}T12:00:00`).toLocaleDateString('es-AR')}</Td>
              <Td>{fila.operacion}</Td><Td>{fila.categoria}</Td><Td>{fila.forma_pago}</Td>
              <Td>{fila.historico || '—'}</Td><Td>{fila.cliente_proveedor || '—'}</Td>
              <Td align="right">R$ {Number(fila.total).toFixed(2)}</Td><Td>{fila.estado || '—'}</Td>
              <Td>
                <button
                  onClick={() => handleEliminar(fila.id_operacion)}
                  disabled={borrando === fila.id_operacion}
                  style={botonEliminar}
                  title="Eliminar operación y sus movimientos de stock"
                >
                  {borrando === fila.id_operacion ? '...' : 'Eliminar'}
                </button>
              </Td>
            </tr>
          ))}{!visibles.length && <tr><td colSpan={10} style={vacioStyle}>No se encontraron registros.</td></tr>}</tbody>
        </Tabla>
      )}
    </Pantalla>
  );
}

function Pantalla({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return <div style={fondo}><div style={{ maxWidth: 1180, margin: '0 auto' }}><header style={encabezado}><Link href="/" style={volver}>← Volver a Mi Negocio</Link><p style={eyebrow}>GESTIÓN FINANCIERA</p><h1 style={{ margin: 0, fontSize: 28 }}>{titulo}</h1><p style={{ margin: '8px 0 0', color: '#dbe5ef' }}>{subtitulo}</p></header><main style={panel}>{children}</main></div></div>;
}

function Tabla({ children }: { children: React.ReactNode }) { return <div style={tablaContenedor}><table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table></div>; }
function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) { return <th style={{ padding: '12px 14px', color: '#374151', fontSize: 12, textAlign: align, whiteSpace: 'nowrap' }}>{children}</th>; }
function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) { return <td style={{ padding: '12px 14px', fontSize: 13, textAlign: align, whiteSpace: 'nowrap' }}>{children}</td>; }

const fondo: React.CSSProperties = { minHeight: '100vh', background: 'radial-gradient(circle at top left, #e7f1ed 0%, transparent 34%), #f4f7f8', padding: '28px 24px 48px' };
const encabezado: React.CSSProperties = { background: 'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)', borderRadius: 24, padding: '28px 34px', color: COLORES.blanco, marginBottom: 24, boxShadow: '0 18px 40px rgba(20,42,71,0.16)' };
const volver: React.CSSProperties = { color: '#cbd5e1', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 18 };
const eyebrow: React.CSSProperties = { color: '#86efac', fontSize: 11, fontWeight: 700, letterSpacing: 1.4, margin: '0 0 8px' };
const panel: React.CSSProperties = { background: COLORES.blanco, borderRadius: 24, padding: 26, boxShadow: '0 14px 36px rgba(31,58,95,0.10)', overflow: 'hidden' };
const inputStyle: React.CSSProperties = { width: '100%', maxWidth: 420, padding: '11px 12px', borderRadius: 10, border: '1px solid #d6dee5', background: '#fbfcfd', marginBottom: 18, boxSizing: 'border-box' };
const tablaContenedor: React.CSSProperties = { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 14 };
const cabeceraFila: React.CSSProperties = { background: '#f1f5f9', textAlign: 'left' };
const filaStyle: React.CSSProperties = { borderTop: '1px solid #e5e7eb' };
const vacioStyle: React.CSSProperties = { padding: 24, textAlign: 'center', color: COLORES.gris };
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
