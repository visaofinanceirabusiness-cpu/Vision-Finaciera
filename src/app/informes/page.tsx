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

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';

// Contexto para no tener que pasar el símbolo de moneda como prop a
// cada uno de los informes y sus sub-componentes — cada uno lo toma
// con useContext(SimboloContext) donde lo necesite.
const SimboloContext = createContext('R$');

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
  const [moneda, setMoneda] = useState<string | null>(null);
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

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('moneda')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      setMoneda(empresaData?.moneda ?? null);

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
    <SimboloContext.Provider value={simboloMoneda(moneda)}>
    <div style={fondo}>
      <div style={{ maxWidth: 1250, margin: '0 auto' }}>
        <header style={encabezado}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/?vista=empresa" style={volver}>
              ← Volver a Mi Negocio
            </Link>

            <AccesosHerramientas />
          </div>

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
              {pestana === 'flujo' && <FlujoDeCajaTab hojas={hojas} asientos={asientos} />}
              {pestana === 'resultado' && <EstadoDeResultadoTab hojas={hojas} asientos={asientos} />}
              {pestana === 'balance' && <BalancePatrimonialTab cuentas={cuentas} hojas={hojas} asientos={asientos} />}
            </>
          )}
        </main>
      </div>
    </div>
    </SimboloContext.Provider>
  );
}

/* ==========================================================
   UTILIDAD COMPARTIDA — saldo de una cuenta según su naturaleza
========================================================== */

function calcularMovimiento(cuenta: CuentaPlan, asientos: Asiento[], incluirInicial = true) {
  let debe = 0;
  let haber = 0;

  for (const asiento of asientos) {
    if (asiento.debito === cuenta.nombre) debe += asiento.importe;
    if (asiento.credito === cuenta.nombre) haber += asiento.importe;
  }

  const inicial = incluirInicial ? Number(cuenta.saldo_inicial ?? 0) : 0;

  const saldoFinal =
    cuenta.naturaleza === 'ACREEDORA' ? inicial + haber - debe : inicial + debe - haber;

  return { inicial, debe, haber, saldoFinal };
}

// Agrupa las fechas de los asientos en períodos "AAAA-MM", más la
// opción "TODOS" para ver el histórico completo.
function obtenerPeriodos(asientos: Asiento[]) {
  const claves = new Set(asientos.map((a) => a.fecha.slice(0, 7)).filter(Boolean));

  return Array.from(claves)
    .sort((a, b) => b.localeCompare(a))
    .map((clave) => ({ valor: clave, etiqueta: formatearPeriodo(clave) }));
}

function formatearPeriodo(clave: string): string {
  const [anio, mes] = clave.split('-').map(Number);

  if (!anio || !mes) return clave;

  return new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
}

/* ==========================================================
   PESTAÑA · SUMAS Y SALDOS
========================================================== */

function SumasYSaldosTab({ hojas, asientos }: { hojas: CuentaPlan[]; asientos: Asiento[] }) {
  const simbolo = useContext(SimboloContext);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarCeros, setMostrarCeros] = useState(false);

  const filas = useMemo(
    () =>
      hojas.map((cuenta) => ({
        cuenta,
        ...calcularMovimiento(cuenta, asientos),
      })),
    [hojas, asientos]
  );

  const visibles = filas.filter((fila) => {
    const coincideBusqueda = `${fila.cuenta.codigo} ${fila.cuenta.nombre}`
      .toLowerCase()
      .includes(busqueda.toLowerCase());

    const tieneMovimiento = fila.inicial !== 0 || fila.debe !== 0 || fila.haber !== 0 || fila.saldoFinal !== 0;

    return coincideBusqueda && (mostrarCeros || tieneMovimiento);
  });

  const totalInicial = visibles.reduce((s, f) => s + f.inicial, 0);
  const totalDebe = visibles.reduce((s, f) => s + f.debe, 0);
  const totalHaber = visibles.reduce((s, f) => s + f.haber, 0);
  const totalFinal = visibles.reduce((s, f) => s + f.saldoFinal, 0);
  const diferenciaDebeHaber = totalDebe - totalHaber;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar cuenta por código o nombre..."
          style={{ ...campoInput, maxWidth: 420, marginBottom: 0 }}
        />

        <BotonToggle
          activo={mostrarCeros}
          onClick={() => setMostrarCeros((actual) => !actual)}
          etiquetaActivo="Ocultar cuentas en cero"
          etiquetaInactivo="Mostrar cuentas en cero"
        />
      </div>

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
                <Td align="right">{simbolo} {formatearNumeroEntero(fila.inicial)}</Td>
                <Td align="right">{fila.debe ? `${simbolo} ${formatearNumeroEntero(fila.debe)}` : '—'}</Td>
                <Td align="right">{fila.haber ? `${simbolo} ${formatearNumeroEntero(fila.haber)}` : '—'}</Td>
                <Td align="right">
                  <strong style={{ color: COLORES.azul }}>{simbolo} {formatearNumeroEntero(fila.saldoFinal)}</strong>
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
                <strong>{simbolo} {formatearNumeroEntero(totalInicial)}</strong>
              </Td>
              <Td align="right">
                <strong>{simbolo} {formatearNumeroEntero(totalDebe)}</strong>
              </Td>
              <Td align="right">
                <strong>{simbolo} {formatearNumeroEntero(totalHaber)}</strong>
              </Td>
              <Td align="right">
                <strong>{simbolo} {formatearNumeroEntero(totalFinal)}</strong>
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
          : `⚠ El Debe y el Haber no cierran — diferencia de ${simbolo} ${formatearNumeroEntero(diferenciaDebeHaber)}.`}
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA · MAYOR
========================================================== */

function MayorTab({ hojas, asientos }: { hojas: CuentaPlan[]; asientos: Asiento[] }) {
  const simbolo = useContext(SimboloContext);
  const [cuentaId, setCuentaId] = useState('');
  const [mostrarCeros, setMostrarCeros] = useState(false);

  const cuenta = hojas.find((c) => c.id === cuentaId) ?? null;

  // Antes de buscar la cuenta, sacamos del desplegable las que nunca
  // tuvieron saldo — ensucian la lista y casi nunca son las que se
  // necesita mirar.
  const opciones = useMemo(() => {
    const lista = mostrarCeros
      ? hojas
      : hojas.filter((c) => calcularMovimiento(c, asientos, true).saldoFinal !== 0);

    return lista.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [hojas, asientos, mostrarCeros]);

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

  const saldoActual = cuenta
    ? filasConSaldo.length
      ? filasConSaldo[filasConSaldo.length - 1].saldo
      : Number(cuenta.saldo_inicial ?? 0)
    : 0;

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 420, flex: 1, minWidth: 260 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: COLORES.azul, display: 'block', marginBottom: 6 }}>
            Cuenta
          </label>

          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={campoInput}>
            <option value="">Seleccionar cuenta...</option>

            {opciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <BotonToggle
          activo={mostrarCeros}
          onClick={() => setMostrarCeros((actual) => !actual)}
          etiquetaActivo="Ocultar cuentas en cero"
          etiquetaInactivo="Mostrar cuentas en cero"
        />

        {cuenta && (
          <div
            style={{
              padding: '11px 18px',
              borderRadius: 12,
              background: 'linear-gradient(90deg, #edf6f0, #f7faf8)',
              minWidth: 200,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
              SALDO ACTUAL
            </div>

            <div style={{ fontSize: 22, fontWeight: 800, color: COLORES.azul }}>
              {simbolo} {formatearNumeroEntero(saldoActual)}
            </div>
          </div>
        )}
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
                  <strong>{simbolo} {formatearNumeroEntero(Number(cuenta.saldo_inicial ?? 0))}</strong>
                </Td>
              </tr>

              {filasConSaldo.map((fila, indice) => (
                <tr key={`${fila.id_operacion}-${indice}`} style={filaStyle}>
                  <Td>{new Date(`${fila.fecha}T12:00:00`).toLocaleDateString('es-AR')}</Td>
                  <Td>{fila.id_operacion || '—'}</Td>
                  <Td>{fila.descripcion || '—'}</Td>
                  <Td align="right">{fila.esDebe ? `${simbolo} ${formatearNumeroEntero(fila.importe)}` : '—'}</Td>
                  <Td align="right">{!fila.esDebe ? `${simbolo} ${formatearNumeroEntero(fila.importe)}` : '—'}</Td>
                  <Td align="right">
                    <strong>{simbolo} {formatearNumeroEntero(fila.saldo)}</strong>
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
   PESTAÑA · ESTADO DE RESULTADO
========================================================== */

function EstadoDeResultadoTab({ hojas, asientos }: { hojas: CuentaPlan[]; asientos: Asiento[] }) {
  const simbolo = useContext(SimboloContext);
  const periodos = useMemo(() => obtenerPeriodos(asientos), [asientos]);
  const [periodo, setPeriodo] = useState('TODOS');

  const esTodos = periodo === 'TODOS';

  const asientosDelPeriodo = useMemo(
    () => (esTodos ? asientos : asientos.filter((a) => a.fecha.slice(0, 7) === periodo)),
    [asientos, periodo, esTodos]
  );

  // Con "Todos los períodos" el saldo inicial representa el arrastre
  // histórico y suma al resultado. Con un mes puntual, se mira solo
  // lo que pasó ese mes.
  const filasPorTipo = (tipo: string) =>
    hojas
      .map((cuenta) => ({ cuenta, ...calcularMovimiento(cuenta, asientosDelPeriodo, esTodos) }))
      .filter((fila) => fila.cuenta.tipo_saldo === tipo && fila.saldoFinal !== 0)
      .sort((a, b) => b.saldoFinal - a.saldoFinal);

  const ingresos = filasPorTipo('INGRESO');
  const costos = filasPorTipo('COSTO');
  const gastos = filasPorTipo('GASTO');

  const totalIngresos = ingresos.reduce((s, f) => s + f.saldoFinal, 0);
  const totalCostos = costos.reduce((s, f) => s + f.saldoFinal, 0);
  const totalGastos = gastos.reduce((s, f) => s + f.saldoFinal, 0);
  const resultado = totalIngresos - totalCostos - totalGastos;
  const rentabilidad = totalIngresos !== 0 ? (resultado / totalIngresos) * 100 : 0;

  // La tendencia mira siempre todo el histórico, sin importar el
  // período elegido arriba — es el panorama general de la empresa,
  // no un dato que dependa del filtro.
  const tendencia = useMemo(() => calcularTendenciaResultado(hojas, asientos), [hojas, asientos]);

  return (
    <div>
      <div style={{ marginBottom: 18, maxWidth: 280 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: COLORES.azul, display: 'block', marginBottom: 6 }}>
          Período
        </label>

        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={campoInput}>
          <option value="TODOS">Todos los períodos</option>

          {periodos.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <SeccionResultado titulo="Ingresos" emoji="💵" filas={ingresos} total={totalIngresos} color={COLORES.verde} />

      {/* Una empresa sin cuentas de Costo (Familiar, Servicios puro)
          nunca va a tener nada acá — mostrar la sección igual sería
          solo ruido ("Costos: $0" sin ninguna fila debajo). */}
      {costos.length > 0 && (
        <SeccionResultado titulo="Costos" emoji="📦" filas={costos} total={totalCostos} color="#c2410c" resta />
      )}

      <SeccionResultado titulo="Gastos" emoji="🧾" filas={gastos} total={totalGastos} color="#c2410c" resta />

      <div
        style={{
          marginTop: 18,
          padding: '18px 20px',
          borderRadius: 16,
          background: resultado >= 0 ? 'linear-gradient(90deg, #edf6f0, #f7faf8)' : '#fef2f2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
            RESULTADO {esTodos ? '(histórico)' : `— ${formatearPeriodo(periodo)}`}
          </div>

          <div style={{ fontSize: 24, fontWeight: 800, color: resultado >= 0 ? COLORES.verde : '#dc2626' }}>
            {simbolo} {formatearNumeroEntero(resultado)}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 13, color: COLORES.gris }}>
          Rentabilidad
          <div style={{ fontSize: 18, fontWeight: 800, color: COLORES.azul }}>
            {rentabilidad.toFixed(1)}%
          </div>
        </div>
      </div>

      <SeccionTendencia titulo="Tendencia del Resultado" datos={tendencia} />
    </div>
  );
}

// Resultado (Ingresos - Costos - Gastos) de cada mes, calculado solo
// con el movimiento de ese mes (no acumulado, no incluye saldo inicial).
function calcularTendenciaResultado(hojas: CuentaPlan[], asientos: Asiento[]) {
  const claves = Array.from(new Set(asientos.map((a) => a.fecha.slice(0, 7)).filter(Boolean))).sort();

  return claves.map((clave) => {
    const delMes = asientos.filter((a) => a.fecha.slice(0, 7) === clave);

    const sumaTipo = (tipo: string) =>
      hojas
        .filter((c) => c.tipo_saldo === tipo)
        .reduce((s, c) => s + calcularMovimiento(c, delMes, false).saldoFinal, 0);

    const valor = sumaTipo('INGRESO') - sumaTipo('COSTO') - sumaTipo('GASTO');

    return { clave, etiqueta: formatearPeriodoCorto(clave), valor };
  });
}

function formatearPeriodoCorto(clave: string): string {
  const [anio, mes] = clave.split('-').map(Number);
  if (!anio || !mes) return clave;

  const nombre = new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'short' });
  return `${nombre.replace('.', '')} ${String(anio).slice(2)}`;
}

// Bloque "panorama general": título + gráfico de tendencia, siempre
// con todo el histórico, sin importar el período elegido arriba.
function SeccionTendencia({
  titulo,
  datos,
}: {
  titulo: string;
  datos: { clave: string; etiqueta: string; valor: number }[];
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: COLORES.verde }}>
        PANORAMA GENERAL
      </div>

      <h3 style={{ margin: '0 0 4px', color: COLORES.azul, fontSize: 17 }}>{titulo}</h3>

      <p style={{ margin: '0 0 14px', fontSize: 12, color: COLORES.gris }}>
        Todo el histórico, mes a mes — no cambia con el período elegido arriba.
      </p>

      <GraficoTendenciaResultado datos={datos} />
    </div>
  );
}

function GraficoTendenciaResultado({
  datos,
}: {
  datos: { clave: string; etiqueta: string; valor: number }[];
}) {
  if (!datos.length) {
    return <div style={vacioOperacion}>Todavía no hay historial suficiente para mostrar una tendencia.</div>;
  }

  const alto = 160;
  const anchoBarra = 46;
  const gap = 14;
  const ancho = datos.length * (anchoBarra + gap) + gap;

  const maxAbs = Math.max(...datos.map((d) => Math.abs(d.valor)), 1);
  const mitad = alto / 2;
  const escala = (mitad - 16) / maxAbs;

  return (
    <div style={{ ...tablaContenedor, padding: '18px 12px', overflowX: 'auto' }}>
      <svg width={ancho} height={alto + 26} style={{ display: 'block' }}>
        <line x1={0} y1={mitad} x2={ancho} y2={mitad} stroke="#e5e7eb" strokeWidth={1} />

        {datos.map((dato, indice) => {
          const x = gap + indice * (anchoBarra + gap);
          const alturaBarra = Math.abs(dato.valor) * escala;
          const y = dato.valor >= 0 ? mitad - alturaBarra : mitad;
          const color = dato.valor >= 0 ? COLORES.verde : '#dc2626';

          return (
            <g key={dato.clave}>
              <rect x={x} y={y} width={anchoBarra} height={Math.max(alturaBarra, 2)} rx={4} fill={color} />

              <text
                x={x + anchoBarra / 2}
                y={dato.valor >= 0 ? y - 6 : y + alturaBarra + 14}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill={color}
              >
                {dato.valor.toFixed(0)}
              </text>

              <text
                x={x + anchoBarra / 2}
                y={alto + 18}
                textAnchor="middle"
                fontSize={11}
                fill={COLORES.gris}
              >
                {dato.etiqueta}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SeccionResultado({
  titulo,
  emoji,
  filas,
  total,
  color,
  resta = false,
}: {
  titulo: string;
  emoji: string;
  filas: { cuenta: CuentaPlan; saldoFinal: number }[];
  total: number;
  color: string;
  resta?: boolean;
}) {
  const simbolo = useContext(SimboloContext);
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: '#f8fafc',
          borderRadius: '10px 10px 0 0',
          border: '1px solid #e5e7eb',
          borderBottom: 'none',
        }}
      >
        <strong style={{ color: COLORES.azul, fontSize: 13 }}>
          {emoji} {titulo}
        </strong>

        <strong style={{ color, fontSize: 13 }}>
          {resta ? '− ' : ''}{simbolo} {formatearNumeroEntero(total)}
        </strong>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        {!filas.length ? (
          <div style={{ padding: 16, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>
            Sin movimiento en este período.
          </div>
        ) : (
          filas.map((fila, indice) => (
            <div
              key={fila.cuenta.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '9px 14px',
                fontSize: 13,
                borderTop: indice === 0 ? 'none' : '1px solid #f1f5f9',
              }}
            >
              <span>{fila.cuenta.nombre}</span>
              <span>{simbolo} {formatearNumeroEntero(fila.saldoFinal)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA · FLUJO DE CAJA
========================================================== */

function FlujoDeCajaTab({ hojas, asientos }: { hojas: CuentaPlan[]; asientos: Asiento[] }) {
  const simbolo = useContext(SimboloContext);
  const cuentasCaja = useMemo(
    () => hojas.filter((c) => (c.codigo ?? '').startsWith('1.1.1.')),
    [hojas]
  );

  const nombresCaja = useMemo(() => new Set(cuentasCaja.map((c) => c.nombre)), [cuentasCaja]);

  const periodos = useMemo(() => obtenerPeriodos(asientos), [asientos]);
  const [periodo, setPeriodo] = useState('TODOS');
  const esTodos = periodo === 'TODOS';

  // El saldo de caja actual es siempre acumulado a la fecha — no
  // depende del período elegido, igual que "Caja disponible" en el
  // Panel de Control.
  const saldoCajaActual = useMemo(
    () => cuentasCaja.reduce((s, c) => s + calcularMovimiento(c, asientos, true).saldoFinal, 0),
    [cuentasCaja, asientos]
  );

  const asientosDelPeriodo = useMemo(
    () => (esTodos ? asientos : asientos.filter((a) => a.fecha.slice(0, 7) === periodo)),
    [asientos, periodo, esTodos]
  );

  // Entrada de caja: el débito es una cuenta de caja (la caja aumenta).
  // Salida de caja: el crédito es una cuenta de caja (la caja baja).
  // Se excluyen los movimientos entre dos cuentas de caja propias, para
  // no contar una transferencia interna como entrada y salida a la vez.
  const entradas = useMemo(
    () =>
      asientosDelPeriodo.filter(
        (a) => a.debito && nombresCaja.has(a.debito) && !(a.credito && nombresCaja.has(a.credito))
      ),
    [asientosDelPeriodo, nombresCaja]
  );

  const salidas = useMemo(
    () =>
      asientosDelPeriodo.filter(
        (a) => a.credito && nombresCaja.has(a.credito) && !(a.debito && nombresCaja.has(a.debito))
      ),
    [asientosDelPeriodo, nombresCaja]
  );

  const entradasAgrupadas = agruparPorContraparte(entradas, (a) => a.credito);
  const salidasAgrupadas = agruparPorContraparte(salidas, (a) => a.debito);

  const totalEntradas = entradasAgrupadas.reduce((s, f) => s + f.valor, 0);
  const totalSalidas = salidasAgrupadas.reduce((s, f) => s + f.valor, 0);
  const flujoNeto = totalEntradas - totalSalidas;

  // Igual que en Estado de Resultado: la tendencia mira todo el
  // histórico, sin importar el período elegido arriba.
  const tendenciaCaja = useMemo(
    () => calcularTendenciaCaja(nombresCaja, asientos),
    [nombresCaja, asientos]
  );

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 280, flex: 1, minWidth: 220 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: COLORES.azul, display: 'block', marginBottom: 6 }}>
            Período
          </label>

          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={campoInput}>
            <option value="TODOS">Todos los períodos</option>

            {periodos.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            padding: '11px 18px',
            borderRadius: 12,
            background: 'linear-gradient(90deg, #edf6f0, #f7faf8)',
            minWidth: 200,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
            CAJA DISPONIBLE HOY
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: COLORES.azul }}>
            {simbolo} {formatearNumeroEntero(saldoCajaActual)}
          </div>
        </div>
      </div>

      <SeccionMontos titulo="Entradas de caja" emoji="⬇️" filas={entradasAgrupadas} total={totalEntradas} color={COLORES.verde} />
      <SeccionMontos titulo="Salidas de caja" emoji="⬆️" filas={salidasAgrupadas} total={totalSalidas} color="#c2410c" resta />

      <div
        style={{
          marginTop: 18,
          padding: '18px 20px',
          borderRadius: 16,
          background: flujoNeto >= 0 ? 'linear-gradient(90deg, #edf6f0, #f7faf8)' : '#fef2f2',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
          FLUJO NETO {esTodos ? '(histórico)' : `— ${formatearPeriodo(periodo)}`}
        </div>

        <div style={{ fontSize: 24, fontWeight: 800, color: flujoNeto >= 0 ? COLORES.verde : '#dc2626' }}>
          {simbolo} {formatearNumeroEntero(flujoNeto)}
        </div>
      </div>

      <SeccionTendencia titulo="Tendencia de Caja" datos={tendenciaCaja} />
    </div>
  );
}

// Flujo neto de caja (entradas - salidas) de cada mes.
function calcularTendenciaCaja(nombresCaja: Set<string>, asientos: Asiento[]) {
  const claves = Array.from(new Set(asientos.map((a) => a.fecha.slice(0, 7)).filter(Boolean))).sort();

  return claves.map((clave) => {
    const delMes = asientos.filter((a) => a.fecha.slice(0, 7) === clave);

    const entradasMes = delMes
      .filter((a) => a.debito && nombresCaja.has(a.debito) && !(a.credito && nombresCaja.has(a.credito)))
      .reduce((s, a) => s + a.importe, 0);

    const salidasMes = delMes
      .filter((a) => a.credito && nombresCaja.has(a.credito) && !(a.debito && nombresCaja.has(a.debito)))
      .reduce((s, a) => s + a.importe, 0);

    return { clave, etiqueta: formatearPeriodoCorto(clave), valor: entradasMes - salidasMes };
  });
}

// Agrupa una lista de asientos por el nombre de la cuenta "contraparte"
// (la otra punta del asiento), sumando importes iguales.
function agruparPorContraparte(lista: Asiento[], contraparte: (a: Asiento) => string | null) {
  const mapa = new Map<string, number>();

  for (const asiento of lista) {
    const clave = contraparte(asiento) || 'Otro';
    mapa.set(clave, (mapa.get(clave) ?? 0) + asiento.importe);
  }

  return Array.from(mapa.entries())
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function SeccionMontos({
  titulo,
  emoji,
  filas,
  total,
  color,
  resta = false,
}: {
  titulo: string;
  emoji: string;
  filas: { nombre: string; valor: number }[];
  total: number;
  color: string;
  resta?: boolean;
}) {
  const simbolo = useContext(SimboloContext);
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: '#f8fafc',
          borderRadius: '10px 10px 0 0',
          border: '1px solid #e5e7eb',
          borderBottom: 'none',
        }}
      >
        <strong style={{ color: COLORES.azul, fontSize: 13 }}>
          {emoji} {titulo}
        </strong>

        <strong style={{ color, fontSize: 13 }}>
          {resta ? '− ' : ''}{simbolo} {formatearNumeroEntero(total)}
        </strong>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        {!filas.length ? (
          <div style={{ padding: 16, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>
            Sin movimiento en este período.
          </div>
        ) : (
          filas.map((fila, indice) => (
            <div
              key={fila.nombre}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '9px 14px',
                fontSize: 13,
                borderTop: indice === 0 ? 'none' : '1px solid #f1f5f9',
              }}
            >
              <span>{fila.nombre}</span>
              <span>{simbolo} {formatearNumeroEntero(fila.valor)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ==========================================================
   PESTAÑA · BALANCE PATRIMONIAL
========================================================== */

function BalancePatrimonialTab({
  cuentas,
  hojas,
  asientos,
}: {
  cuentas: CuentaPlan[];
  hojas: CuentaPlan[];
  asientos: Asiento[];
}) {
  const simbolo = useContext(SimboloContext);
  const [mostrarCeros, setMostrarCeros] = useState(false);

  // Agrupa cada cuenta hoja bajo el nombre de su cuenta padre directa
  // (ej. "Caja"/"PIX" bajo "ATIVO CIRCULANTE"), para mostrar el balance
  // con la misma estructura que tiene el Plan de Cuentas.
  function nombreGrupo(cuenta: CuentaPlan): string {
    if (!cuenta.cuenta_padre_id) return cuenta.nombre;
    const padre = cuentas.find((c) => c.id === cuenta.cuenta_padre_id);
    return padre ? padre.nombre : cuenta.nombre;
  }

  function bloque(tipo: string) {
    const filas = hojas
      .map((cuenta) => ({ cuenta, grupo: nombreGrupo(cuenta), ...calcularMovimiento(cuenta, asientos, true) }))
      .filter((fila) => fila.cuenta.tipo_saldo === tipo);

    // El total siempre suma TODAS las cuentas del tipo (los ceros no
    // aportan nada), pero las filas que se muestran sí respetan el
    // interruptor de "mostrar cuentas en cero".
    const total = filas.reduce((s, f) => s + f.saldoFinal, 0);

    const filasVisibles = mostrarCeros ? filas : filas.filter((f) => f.saldoFinal !== 0);

    const grupos = new Map<string, typeof filas>();

    for (const fila of filasVisibles) {
      const lista = grupos.get(fila.grupo) ?? [];
      lista.push(fila);
      grupos.set(fila.grupo, lista);
    }

    return { grupos, total };
  }

  const activo = bloque('ACTIVO');
  const pasivo = bloque('PASIVO');
  const patrimonio = bloque('PATRIMONIO');

  // Ganancia o pérdida del ejercicio, todavía no cerrada contra
  // "Lucros Acumulados" — se muestra como una línea más del Patrimonio,
  // para que Activo = Pasivo + Patrimonio siga cerrando.
  const resultadoDelEjercicio =
    hojas.filter((c) => c.tipo_saldo === 'INGRESO').reduce((s, c) => s + calcularMovimiento(c, asientos, true).saldoFinal, 0) -
    hojas.filter((c) => c.tipo_saldo === 'COSTO').reduce((s, c) => s + calcularMovimiento(c, asientos, true).saldoFinal, 0) -
    hojas.filter((c) => c.tipo_saldo === 'GASTO').reduce((s, c) => s + calcularMovimiento(c, asientos, true).saldoFinal, 0);

  const totalPatrimonioConResultado = patrimonio.total + resultadoDelEjercicio;
  const totalPasivoYPatrimonio = pasivo.total + totalPatrimonioConResultado;
  const diferencia = activo.total - totalPasivoYPatrimonio;

  return (
    <div>
      <div
        style={{
          marginBottom: 18,
          padding: '18px 20px',
          borderRadius: 16,
          background: resultadoDelEjercicio >= 0 ? 'linear-gradient(90deg, #edf6f0, #f7faf8)' : '#fef2f2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>
            RESULTADO DEL EJERCICIO (SIN CERRAR)
          </div>

          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: resultadoDelEjercicio >= 0 ? COLORES.verde : '#dc2626',
            }}
          >
            {simbolo} {formatearNumeroEntero(resultadoDelEjercicio)}
          </div>
        </div>

        <p style={{ margin: 0, maxWidth: 280, fontSize: 12, color: COLORES.gris }}>
          Lo que ganó o perdió el negocio hasta hoy, todavía no volcado a Lucros Acumulados. Ya está
          incluido en el Patrimonio de abajo.
        </p>
      </div>

      <div style={{ marginBottom: 18 }}>
        <BotonToggle
          activo={mostrarCeros}
          onClick={() => setMostrarCeros((actual) => !actual)}
          etiquetaActivo="Ocultar cuentas en cero"
          etiquetaInactivo="Mostrar cuentas en cero"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 18,
        }}
      >
        <BloqueBalance titulo="Activo" emoji="💚" grupos={activo.grupos} total={activo.total} color={COLORES.verde} />

        <div>
          <BloqueBalance titulo="Pasivo" emoji="💗" grupos={pasivo.grupos} total={pasivo.total} color="#b91c1c" />

          <div style={{ height: 14 }} />

          <BloqueBalance
            titulo="Patrimonio"
            emoji="💙"
            grupos={patrimonio.grupos}
            total={patrimonio.total}
            color={COLORES.azul}
            filaExtra={{ nombre: 'Resultado del Ejercicio (no cerrado)', valor: resultadoDelEjercicio }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: '12px 16px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          background: Math.abs(diferencia) < 0.01 ? '#eaf7ee' : '#fef2f2',
          color: Math.abs(diferencia) < 0.01 ? '#247347' : '#dc2626',
        }}
      >
        {Math.abs(diferencia) < 0.01
          ? `✓ Activo (${simbolo} ${formatearNumeroEntero(activo.total)}) = Pasivo + Patrimonio (${simbolo} ${formatearNumeroEntero(totalPasivoYPatrimonio)}).`
          : `⚠ La ecuación no cierra por ${simbolo} ${formatearNumeroEntero(diferencia)}. Activo: ${simbolo} ${formatearNumeroEntero(activo.total)} — Pasivo + Patrimonio: ${simbolo} ${formatearNumeroEntero(totalPasivoYPatrimonio)}.`}
      </div>
    </div>
  );
}

function BloqueBalance({
  titulo,
  emoji,
  grupos,
  total,
  color,
  filaExtra,
}: {
  titulo: string;
  emoji: string;
  grupos: Map<string, { cuenta: CuentaPlan; saldoFinal: number }[]>;
  total: number;
  color: string;
  filaExtra?: { nombre: string; valor: number };
}) {
  const simbolo = useContext(SimboloContext);
  const entradas = Array.from(grupos.entries());

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
      <div
        style={{
          padding: '12px 16px',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <strong style={{ color: COLORES.azul, fontSize: 14 }}>
          {emoji} {titulo}
        </strong>

        <strong style={{ color, fontSize: 14 }}>{simbolo} {formatearNumeroEntero((total + (filaExtra?.valor ?? 0)))}</strong>
      </div>

      <div style={{ padding: '4px 0' }}>
        {entradas.map(([grupo, filas]) => (
          <div key={grupo} style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: COLORES.gris, marginBottom: 4 }}>
              {grupo.toUpperCase()}
            </div>

            {filas.map((fila) => (
              <div
                key={fila.cuenta.id}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}
              >
                <span>{fila.cuenta.nombre}</span>
                <span>{simbolo} {formatearNumeroEntero(fila.saldoFinal)}</span>
              </div>
            ))}
          </div>
        ))}

        {filaExtra && (
          <div
            style={{
              margin: '8px 12px 4px',
              padding: '9px 12px',
              borderRadius: 10,
              background: filaExtra.valor >= 0 ? '#eaf7ee' : '#fef2f2',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 800,
              color: filaExtra.valor >= 0 ? '#247347' : '#dc2626',
            }}
          >
            <span>{filaExtra.nombre}</span>
            <span>{simbolo} {formatearNumeroEntero(filaExtra.valor)}</span>
          </div>
        )}

        {!entradas.length && !filaExtra && (
          <div style={{ padding: 16, textAlign: 'center', color: COLORES.gris, fontSize: 13 }}>
            Sin cuentas con movimiento.
          </div>
        )}
      </div>
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

function BotonToggle({
  activo,
  onClick,
  etiquetaActivo,
  etiquetaInactivo,
}: {
  activo: boolean;
  onClick: () => void;
  etiquetaActivo: string;
  etiquetaInactivo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        border: `1px solid ${activo ? COLORES.azul : '#d1d5db'}`,
        background: activo ? `${COLORES.azul}12` : COLORES.blanco,
        color: activo ? COLORES.azul : COLORES.gris,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {activo ? `👁️ ${etiquetaActivo}` : `🙈 ${etiquetaInactivo}`}
    </button>
  );
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
