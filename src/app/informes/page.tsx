'use client';

// INFORMES
//
// Cinco informes contables, todos alimentados por el mismo Diario que
// arma Libro Diario (registro_operaciones + registros_automaticos),
// pero filtrados a estado = 'VALIDADO' únicamente — así un asiento
// pendiente de revisión no contamina ningún informe.
//
//   - Mayor: el detalle cronológico de una cuenta elegida, con saldo
//     corriendo.
//   - Sumas y Saldos: todas las cuentas, con su movimiento del período
//     y su saldo final. El total Debe debe cerrar igual al total Haber.
//   - Flujo de Caja, Estado de Resultado y Balance Patrimonial:
//     próximos pasos.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Pestana = 'mayor' | 'flujo' | 'resultado' | 'sumas' | 'balance';

type CuentaPlan = {
  id: string;
  codigo: string;
  nombre: string;
  cuenta_padre_id: string | null;
  tipo_saldo: string | null;
  naturaleza: string | null;
  saldo_inicial: number | null;
};

type Asiento = {
  id_operacion: string | null;
  fecha: string;
  descripcion: string;
  debito: string | null;
  credito: string | null;
  importe: number;
};

export default function InformesPage() {
  const router = useRouter();

  const [pestana, setPestana] = useState<Pestana>('sumas');
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<CuentaPlan[]>([]);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargar() {
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
        setError('No se pudo identificar la empresa del usuario.');
        setCargando(false);
        return;
      }

      setEmpresaId(perfil.empresa_id);

      const [
        { data: cuentasData, error: errorCuentas },
        { data: operacionesData, error: errorOperaciones },
        { data: automaticosData, error: errorAutomaticos },
      ] = await Promise.all([
        supabase
          .from('plan_cuentas')
          .select('id, codigo, nombre, cuenta_padre_id, tipo_saldo, naturaleza, saldo_inicial')
          .eq('empresa_id', perfil.empresa_id),

        supabase
          .from('registro_operaciones')
          .select('id_operacion, fecha, operacion, historico, cuenta_debito, cuenta_credito, total')
          .eq('empresa_id', perfil.empresa_id)
          .eq('estado', 'VALIDADO'),

        supabase
          .from('registros_automaticos')
          .select('id_operacion, fecha, tipo_registro, historico, cuenta_debito, cuenta_credito, importe')
          .eq('empresa_id', perfil.empresa_id)
          .eq('estado', 'VALIDADO'),
      ]);

      if (errorCuentas) console.warn('No se pudo cargar el plan de cuentas:', errorCuentas);
      if (errorOperaciones) console.warn('No se pudieron cargar las operaciones:', errorOperaciones);
      if (errorAutomaticos) console.warn('No se pudieron cargar los registros automáticos:', errorAutomaticos);

      setCuentas((cuentasData ?? []) as CuentaPlan[]);

      const asientosOperaciones: Asiento[] = (operacionesData ?? []).map((fila) => ({
        id_operacion: fila.id_operacion,
        fecha: String(fila.fecha ?? ''),
        descripcion: [fila.operacion, fila.historico].filter(Boolean).join(' · '),
        debito: fila.cuenta_debito,
        credito: fila.cuenta_credito,
        importe: Number(fila.total ?? 0),
      }));

      const asientosAutomaticos: Asiento[] = (automaticosData ?? []).map((fila) => ({
        id_operacion: fila.id_operacion,
        fecha: String(fila.fecha ?? ''),
        descripcion: [fila.tipo_registro, fila.historico].filter(Boolean).join(' · '),
        debito: fila.cuenta_debito,
        credito: fila.cuenta_credito,
        importe: Number(fila.importe ?? 0),
      }));

      setAsientos([...asientosOperaciones, ...asientosAutomaticos]);
      setCargando(false);
    }

    cargar();
  }, [router]);

  // Cuentas hoja: las que no son encabezado de ninguna otra. Son las
  // únicas que se suman — las cuentas título (ATIVO, PASSIVO...) son
  // solo agrupadores visuales.
  const hojas = useMemo(() => {
    const idsConHijas = new Set(
      cuentas.map((cuenta) => cuenta.cuenta_padre_id).filter(Boolean) as string[]
    );

    return cuentas
      .filter((cuenta) => !idsConHijas.has(cuenta.id))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [cuentas]);

  return (
    <div style={fondo}>
      <div style={{ maxWidth: 1250, margin: '0 auto' }}>
        <header style={encabezado}>
          <Link href="/" style={volver}>
            ← Volver a Mi Negocio
          </Link>

          <div style={eyebrow}>GESTIÓN FINANCIERA</div>

          <h1 style={{ margin: 0, fontSize: 32 }}>Informes</h1>

          <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
            Mayor, Flujo de Caja, Estado de Resultado, Sumas y Saldos y Balance Patrimonial —
            armados solo con asientos validados.
          </p>
        </header>

        <main style={panel}>
          <div
            style={{
              display: 'flex',
              gap: 10,
              borderBottom: '1px solid #e5e7eb',
              marginBottom: 22,
              flexWrap: 'wrap',
            }}
          >
            <button type="button" onClick={() => setPestana('mayor')} style={tabStyle(pestana === 'mayor')}>
              📘 Mayor
            </button>

            <button type="button" onClick={() => setPestana('flujo')} style={tabStyle(pestana === 'flujo')}>
              💧 Flujo de Caja
            </button>

            <button
              type="button"
              onClick={() => setPestana('resultado')}
              style={tabStyle(pestana === 'resultado')}
            >
              📈 Estado de Resultado
            </button>

            <button type="button" onClick={() => setPestana('sumas')} style={tabStyle(pestana === 'sumas')}>
              🧮 Sumas y Saldos
            </button>

            <button
              type="button"
              onClick={() => setPestana('balance')}
              style={tabStyle(pestana === 'balance')}
            >
              🏛️ Balance Patrimonial
            </button>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          {cargando ? (
            <div style={cargandoStyle}>Cargando informes...</div>
          ) : (
            <>
              {pestana === 'mayor' && <MayorTab hojas={hojas} asientos={asientos} />}
              {pestana === 'sumas' && <SumasYSaldosTab hojas={hojas} asientos={asientos} />}
              {pestana === 'flujo' && <ProximamenteTab titulo="Flujo de Caja" />}
              {pestana === 'resultado' && <ProximamenteTab titulo="Estado de Resultado" />}
              {pestana === 'balance' && <ProximamenteTab titulo="Balance Patrimonial" />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ==========================================================
   UTILIDAD COMPARTIDA — saldo de una cuenta según su naturaleza
========================================================== */

function calcularMovimiento(cuenta: CuentaPlan, asientos: Asiento[]) {
  let debe = 0;
  let haber = 0;

  for (const asiento of asientos) {
    if (asiento.debito === cuenta.nombre) debe += asiento.importe;
    if (asiento.credito === cuenta.nombre) haber += asiento.importe;
  }

  const inicial = Number(cuenta.saldo_inicial ?? 0);

  const saldoFinal =
    cuenta.naturaleza === 'ACREEDORA' ? inicial + haber - debe : inicial + debe - haber;

  return { inicial, debe, haber, saldoFinal };
}

/* ==========================================================
   PESTAÑA · SUMAS Y SALDOS
========================================================== */

function SumasYSaldosTab({ hojas, asientos }: { hojas: CuentaPlan[]; asientos: Asiento[] }) {
  const [busqueda, setBusqueda] = useState('');

  const filas = useMemo(
    () =>
      hojas.map((cuenta) => ({
        cuenta,
        ...calcularMovimiento(cuenta, asientos),
      })),
    [hojas, asientos]
  );

  const visibles = filas.filter((fila) =>
    `${fila.cuenta.codigo} ${fila.cuenta.nombre}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalInicial = visibles.reduce((s, f) => s + f.inicial, 0);
  const totalDebe = visibles.reduce((s, f) => s + f.debe, 0);
  const totalHaber = visibles.reduce((s, f) => s + f.haber, 0);
  const totalFinal = visibles.reduce((s, f) => s + f.saldoFinal, 0);
  const diferenciaDebeHaber = totalDebe - totalHaber;

  return (
    <div>
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar cuenta por código o nombre..."
        style={{ ...campoInput, maxWidth: 420, marginBottom: 18 }}
      />

      <div style={tablaContenedor}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={cabeceraFila}>
              <Th>Código</Th>
              <Th>Cuenta</Th>
              <Th align="right">Saldo Inicial</Th>
              <Th align="right">Debe</Th>
              <Th align="right">Haber</Th>
              <Th align="right">Saldo Final</Th>
            </tr>
          </thead>

          <tbody>
            {visibles.map((fila) => (
              <tr key={fila.cuenta.id} style={filaStyle}>
                <Td>{fila.cuenta.codigo}</Td>
                <Td>{fila.cuenta.nombre}</Td>
                <Td align="right">R$ {fila.inicial.toFixed(2)}</Td>
                <Td align="right">{fila.debe ? `R$ ${fila.debe.toFixed(2)}` : '—'}</Td>
                <Td align="right">{fila.haber ? `R$ ${fila.haber.toFixed(2)}` : '—'}</Td>
                <Td align="right">
                  <strong style={{ color: COLORES.azul }}>R$ {fila.saldoFinal.toFixed(2)}</strong>
                </Td>
              </tr>
            ))}

            {!visibles.length && (
              <tr>
                <td colSpan={6} style={vacioStyle}>
                  No se encontraron cuentas.
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr style={pieFila}>
              <Td>
                <strong>Total</strong>
              </Td>
              <Td>—</Td>
              <Td align="right">
                <strong>R$ {totalInicial.toFixed(2)}</strong>
              </Td>
              <Td align="right">
                <strong>R$ {totalDebe.toFixed(2)}</strong>
              </Td>
              <Td align="right">
                <strong>R$ {totalHaber.toFixed(2)}</strong>
              </Td>
              <Td align="right">
                <strong>R$ {totalFinal.toFixed(2)}</strong>
              </Td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '12px 16px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          background: Math.abs(diferenciaDebeHaber) < 0.01 ? '#eaf7ee' : '#fef2f2',
          color: Math.abs(diferenciaDebeHaber) < 0.01 ? '#247347' : '#dc2626',
        }}
      >
        {Math.abs(diferenciaDebeHaber) < 0.01
          ? '✓ El Debe y el Haber cierran iguales.'
          : `⚠ El Debe y el Haber no cierran — diferencia de R$ ${diferenciaDebeHaber.toFixed(2)}.`}
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA · MAYOR
========================================================== */

function MayorTab({ hojas, asientos }: { hojas: CuentaPlan[]; asientos: Asiento[] }) {
  const [cuentaId, setCuentaId] = useState('');

  const cuenta = hojas.find((c) => c.id === cuentaId) ?? null;

  const movimientos = useMemo(() => {
    if (!cuenta) return [];

    return asientos
      .filter((a) => a.debito === cuenta.nombre || a.credito === cuenta.nombre)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.id_operacion ?? '').localeCompare(b.id_operacion ?? ''));
  }, [cuenta, asientos]);

  const filasConSaldo = useMemo(() => {
    if (!cuenta) return [];

    let saldo = Number(cuenta.saldo_inicial ?? 0);
    const esAcreedora = cuenta.naturaleza === 'ACREEDORA';

    return movimientos.map((mov) => {
      const esDebe = mov.debito === cuenta.nombre;
      const monto = esDebe ? mov.importe : -mov.importe;

      saldo += esAcreedora ? -monto : monto;

      return { ...mov, esDebe, saldo };
    });
  }, [movimientos, cuenta]);

  return (
    <div>
      <div style={{ marginBottom: 18, maxWidth: 420 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: COLORES.azul, display: 'block', marginBottom: 6 }}>
          Cuenta
        </label>

        <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={campoInput}>
          <option value="">Seleccionar cuenta...</option>

          {hojas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {!cuenta ? (
        <div style={vacioOperacion}>Elegí una cuenta para ver su movimiento.</div>
      ) : (
        <div style={tablaContenedor}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={cabeceraFila}>
                <Th>Fecha</Th>
                <Th>Operación</Th>
                <Th>Descripción</Th>
                <Th align="right">Debe</Th>
                <Th align="right">Haber</Th>
                <Th align="right">Saldo</Th>
              </tr>
            </thead>

            <tbody>
              <tr style={filaStyle}>
                <Td>—</Td>
                <Td>—</Td>
                <Td>
                  <em>Saldo inicial</em>
                </Td>
                <Td align="right">—</Td>
                <Td align="right">—</Td>
                <Td align="right">
                  <strong>R$ {Number(cuenta.saldo_inicial ?? 0).toFixed(2)}</strong>
                </Td>
              </tr>

              {filasConSaldo.map((fila, indice) => (
                <tr key={`${fila.id_operacion}-${indice}`} style={filaStyle}>
                  <Td>{new Date(`${fila.fecha}T12:00:00`).toLocaleDateString('es-AR')}</Td>
                  <Td>{fila.id_operacion || '—'}</Td>
                  <Td>{fila.descripcion || '—'}</Td>
                  <Td align="right">{fila.esDebe ? `R$ ${fila.importe.toFixed(2)}` : '—'}</Td>
                  <Td align="right">{!fila.esDebe ? `R$ ${fila.importe.toFixed(2)}` : '—'}</Td>
                  <Td align="right">
                    <strong>R$ {fila.saldo.toFixed(2)}</strong>
                  </Td>
                </tr>
              ))}

              {!filasConSaldo.length && (
                <tr>
                  <td colSpan={6} style={vacioStyle}>
                    Esta cuenta todavía no tiene movimientos validados.
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

/* ==========================================================
   PESTAÑA · PRÓXIMAMENTE
========================================================== */

function ProximamenteTab({ titulo }: { titulo: string }) {
  return (
    <div style={vacioOperacion}>
      <strong style={{ color: COLORES.azul }}>{titulo}</strong>
      <div style={{ marginTop: 6 }}>Lo armamos en el próximo paso.</div>
    </div>
  );
}

/* ==========================================================
   COMPONENTES COMPARTIDOS
========================================================== */

function tabStyle(activa: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    padding: '12px 18px',
    color: activa ? COLORES.verde : COLORES.gris,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    borderBottom: activa ? `3px solid ${COLORES.verde}` : '3px solid transparent',
    marginBottom: -1,
  };
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      style={{
        padding: '10px 10px',
        color: '#374151',
        fontSize: 12,
        textAlign: align,
        whiteSpace: 'nowrap',
        fontWeight: 800,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '10px 10px', fontSize: 13, textAlign: align, whiteSpace: 'nowrap' }}>{children}</td>
  );
}

/* ==========================================================
   ESTILOS
========================================================== */

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
  marginBottom: 8,
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 26,
  boxShadow: '0 14px 36px rgba(31,58,95,0.10)',
  overflow: 'hidden',
};

const campoInput: React.CSSProperties = {
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

const tablaContenedor: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
};

const cabeceraFila: React.CSSProperties = {
  background: '#f8fafc',
  textAlign: 'left',
};

const pieFila: React.CSSProperties = {
  background: '#f1f5f9',
  borderTop: '2px solid #d6dee5',
};

const filaStyle: React.CSSProperties = {
  borderTop: '1px solid #e5e7eb',
};

const vacioStyle: React.CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: COLORES.gris,
};

const vacioOperacion: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: COLORES.gris,
  border: '1px dashed #d6dee5',
  borderRadius: 14,
};

const errorStyle: React.CSSProperties = {
  background: '#fef2f2',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 12,
  padding: '11px 14px',
  marginBottom: 18,
  fontSize: 13,
};

const cargandoStyle: React.CSSProperties = {
  padding: 30,
  textAlign: 'center',
  color: COLORES.gris,
};
