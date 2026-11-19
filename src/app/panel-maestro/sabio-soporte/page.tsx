'use client';

// PANEL MAESTRO → SABIO SOPORTE
//
// Mantiene viva la empresa demo: cada día carga unas 4 a 6 operaciones coherentes (aportes de socios, compras, ventas, pagos,
// transferencias) siguiendo un PLAN DE CRECIMIENTO y unas PALANCAS que se editan acá. Todo pasa por el motor contable real: los
// resultados que se ven en los Informes de la demo salen de lo que Sabio carga, no se maquillan. Ver lib/sabioSoporte/.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CONFIG_POR_DEFECTO, MEDIOS_PLATA, configCompleta, validarConfig, type ConfigSabio, type Curva, type GastoFijo } from '@/lib/sabioSoporte/config';
import { metaVentasMes } from '@/lib/sabioSoporte/plan';

const EMPRESA_DEMO_ID = 'c887a052-cbab-47f2-8ec7-a2102af43295';
const COLORES = { azul: '#1f3a5f', verde: '#2e8b57', gris: '#6e7781' };
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

type Entrada = { id: string; fecha: string; tipo: string; operacion: string | null; id_operacion: string | null; monto: number | null; detalle: string | null; error: string | null; creado_en: string };
type ResultadoMes = { mes: string; meta: number; ventas: number; compras: number; gastos: number; ops: number; cmv: number };
type Resumen = { fecha: string; omitido?: string; ok: number; errores: number; simulado: boolean; registro: Array<{ tipo: string; detalle: string; error?: string }> };

const dinero = (n: number) => `R$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function poner<T>(obj: T, ruta: Array<string | number>, valor: unknown): T {
  const copia = structuredClone(obj) as Record<string | number, unknown>;
  let nodo: Record<string | number, unknown> = copia;
  ruta.slice(0, -1).forEach((k) => {
    nodo = nodo[k] as Record<string | number, unknown>;
  });
  nodo[ruta[ruta.length - 1]] = valor;
  return copia as T;
}

function Panel({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 18, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 17, color: COLORES.azul }}>{titulo}</h2>
      {ayuda && <p style={{ margin: '4px 0 12px', fontSize: 13, color: COLORES.gris }}>{ayuda}</p>}
      {!ayuda && <div style={{ height: 10 }} />}
      {children}
    </section>
  );
}

const estiloCampo: React.CSSProperties = { display: 'block', marginTop: 4, padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, width: '100%', boxSizing: 'border-box' };

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 700, color: COLORES.gris, display: 'block' }} title={ayuda}>
      {etiqueta}
      {children}
      {ayuda && <span style={{ display: 'block', fontWeight: 400, fontSize: 11, marginTop: 2 }}>{ayuda}</span>}
    </label>
  );
}

const rejilla: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 };

export default function SabioSoportePage() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [cfg, setCfg] = useState<ConfigSabio>(CONFIG_POR_DEFECTO);
  const [activo, setActivo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [meses, setMeses] = useState<ResultadoMes[]>([]);
  const [registro, setRegistro] = useState<Entrada[]>([]);
  const [dias, setDias] = useState<Array<{ fecha: string; ops_ok: number; ops_error: number }>>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number; ultimo: string } | null>(null);
  const detenerRef = useRef(false);
  const sucioRef = useRef(false);
  const [ultimo, setUltimo] = useState<Resumen | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return router.push('/login');
      const { data } = await supabase.from('perfiles').select('es_admin_plataforma').eq('id', u.user.id).maybeSingle();
      if (!data?.es_admin_plataforma) return router.push('/');
      setAutorizado(true);
    })();
  }, [router]);

  const cargar = useCallback(async () => {
    const [{ data: fila }, { data: reg }, { data: dd }] = await Promise.all([
      supabase.from('sabio_soporte_config').select('activo, pausado, config').eq('empresa_id', EMPRESA_DEMO_ID).maybeSingle(),
      supabase.from('sabio_soporte_registro').select('id, fecha, tipo, operacion, id_operacion, monto, detalle, error, creado_en').eq('empresa_id', EMPRESA_DEMO_ID).order('creado_en', { ascending: false }).limit(80),
      supabase.from('sabio_soporte_dias').select('fecha, ops_ok, ops_error').eq('empresa_id', EMPRESA_DEMO_ID).order('fecha', { ascending: false }).limit(14),
    ]);
    const c = configCompleta(fila?.config);
    setCfg((previa) => (sucioRef.current ? previa : c));
    setActivo(Boolean(fila?.activo));
    setPausado(Boolean(fila?.pausado));
    setRegistro((reg ?? []) as Entrada[]);
    setDias((dd ?? []) as typeof dias);

    // Resultados reales de la demo por mes (lo que ven los Informes): salen de las operaciones cargadas, no de Sabio.
    const [ops, cmvs] = await Promise.all([
      supabase.from('registro_operaciones').select('fecha, operacion, total, parte').eq('empresa_id', EMPRESA_DEMO_ID).gte('fecha', c.inicio).limit(10000),
      supabase.from('registros_automaticos').select('fecha, importe, tipo_registro').eq('empresa_id', EMPRESA_DEMO_ID).eq('tipo_registro', 'CMV').gte('fecha', c.inicio).limit(10000),
    ]);
    const porMes = new Map<string, ResultadoMes>();
    const mes = (m: string) => porMes.get(m) ?? porMes.set(m, { mes: m, meta: metaVentasMes(c, m), ventas: 0, compras: 0, gastos: 0, ops: 0, cmv: 0 }).get(m)!;
    for (const o of ops.data ?? []) {
      const m = mes((o.fecha as string).slice(0, 7));
      const t = Number(o.total);
      if (o.operacion === 'VENTA') m.ventas += t;
      else if (o.operacion === 'COMPRA') m.compras += t;
      else if (o.operacion === 'PAGO') m.gastos += t;
      if (o.parte === 1) m.ops++;
    }
    for (const x of cmvs.data ?? []) mes((x.fecha as string).slice(0, 7)).cmv += Number(x.importe);
    setMeses([...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)));
  }, []);

  useEffect(() => {
    if (autorizado) void cargar();
  }, [autorizado, cargar]);

  const problema = useMemo(() => validarConfig(cfg), [cfg]);
  const cambiar = (ruta: Array<string | number>, valor: unknown) => {
    setCfg((c) => poner(c, ruta, valor));
    sucioRef.current = true;
    setSucio(true);
  };
  const num = (e: React.ChangeEvent<HTMLInputElement>) => (e.target.value === '' ? 0 : Number(e.target.value));

  async function guardar(extra: { activo?: boolean; pausado?: boolean } = {}) {
    setError('');
    if (problema) return setError(problema);
    const { error: e } = await supabase.from('sabio_soporte_config').upsert({ empresa_id: EMPRESA_DEMO_ID, config: cfg, activo, pausado, ...extra, actualizado_en: new Date().toISOString() }, { onConflict: 'empresa_id' });
    if (e) return setError(e.message);
    sucioRef.current = false;
    setSucio(false);
    setAviso('Guardado.');
    await cargar();
  }

  async function llamar<T>(accion: string, cuerpo: Record<string, unknown>): Promise<T> {
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch(`/api/sabio-soporte/${accion}`, { method: 'POST', headers: { authorization: `Bearer ${s.session?.access_token ?? ''}`, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = (await r.json()) as T & { error?: string };
    if (!r.ok) throw new Error(j.error ?? 'No se pudo completar.');
    return j;
  }

  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

  async function dia(simular: boolean, forzar = false) {
    setTrabajando(simular ? 'simular' : 'hoy');
    setError('');
    setAviso('');
    try {
      if (sucio) await guardar();
      const r = await llamar<Resumen>('dia', { fecha: hoy, simular, forzar });
      setUltimo(r);
      setAviso(r.omitido ? `No se ejecutó: ${r.omitido}.` : `${simular ? 'Simulación' : 'Listo'}: ${r.ok} operaciones${r.errores ? `, ${r.errores} rechazadas por el motor` : ''}.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error.');
    }
    setTrabajando(null);
  }

  async function rellenar() {
    setTrabajando('rellenar');
    setError('');
    setAviso('');
    detenerRef.current = false;
    try {
      if (sucio) await guardar();
      const { pendientes } = await llamar<{ pendientes: string[] }>('dias-pendientes', {});
      let hechos = 0;
      let operaciones = 0;
      let rechazadas = 0;
      for (const fecha of pendientes) {
        if (detenerRef.current) break;
        const r = await llamar<Resumen>('dia', { fecha });
        hechos++;
        operaciones += r.ok;
        rechazadas += r.errores;
        setProgreso({ hechos, total: pendientes.length, ultimo: fecha });
      }
      setAviso(`Relleno: ${hechos} de ${pendientes.length} días, ${operaciones} operaciones${rechazadas ? ` (${rechazadas} rechazadas por el motor)` : ''}.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error.');
    }
    setProgreso(null);
    setTrabajando(null);
  }
  if (autorizado === null) return <main style={{ padding: 24 }}>Cargando…</main>;

  const boton = (color: string, desactivado = false): React.CSSProperties => ({ border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 800, fontSize: 14, background: desactivado ? '#cbd5e1' : color, color: '#fff', cursor: desactivado ? 'not-allowed' : 'pointer' });
  const ocupado = trabajando !== null;

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f5f7f9 0%, #e8eff6 100%)', padding: '24px 20px 60px', color: COLORES.azul }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/panel-maestro" style={{ color: COLORES.azul, fontSize: 14 }}>← Panel Maestro</Link>
        <h1 style={{ margin: '8px 0 4px', fontSize: 30, fontWeight: 900 }}>🦉 Sabio Soporte</h1>
        <p style={{ margin: '0 0 18px', color: COLORES.gris, fontSize: 14.5 }}>
          Mantiene viva la empresa demo: cada día carga unas {cfg.ritmo.opsMin} a {cfg.ritmo.opsMax} operaciones coherentes siguiendo el plan de crecimiento. Usa el mismo motor contable que cualquier cliente.
        </p>

        {error && <p style={{ color: '#dc2626', fontSize: 14 }}>{error}</p>}
        {aviso && <p style={{ color: '#166534', fontSize: 14 }}>{aviso}</p>}

        <Panel titulo="Control" ayuda="Activo = corre solo todos los días (Vercel Cron, ~8:00 hora de Brasil). Pausa = freno de mano: no ejecuta nada, ni a mano ni solo.">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontWeight: 700, fontSize: 14 }}>
              <input type="checkbox" checked={activo} onChange={(e) => { setActivo(e.target.checked); void guardar({ activo: e.target.checked }); }} /> Automático diario
            </label>
            <label style={{ fontWeight: 700, fontSize: 14, marginRight: 10 }}>
              <input type="checkbox" checked={pausado} onChange={(e) => { setPausado(e.target.checked); void guardar({ pausado: e.target.checked }); }} /> ⏸ Pausar todo
            </label>
            <button type="button" disabled={ocupado} onClick={() => dia(true)} style={boton('#0891b2', ocupado)}>🧪 Simular hoy</button>
            <button type="button" disabled={ocupado || Boolean(problema)} onClick={() => dia(false)} style={boton(COLORES.verde, ocupado || Boolean(problema))}>▶ Ejecutar hoy</button>
            <button type="button" disabled={ocupado || Boolean(problema)} onClick={rellenar} style={boton('#7c3aed', ocupado || Boolean(problema))}>⏪ Rellenar desde {cfg.inicio}</button>
            {trabajando === 'rellenar' && <button type="button" onClick={() => { detenerRef.current = true; }} style={boton('#b91c1c')}>■ Detener</button>}
          </div>
          {progreso && <p style={{ margin: '10px 0 0', fontSize: 13.5 }}>Rellenando… {progreso.hechos} / {progreso.total} días (último: {progreso.ultimo}). No cierres esta pestaña.</p>}
          {dias.length > 0 && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: COLORES.gris }}>Últimos días ejecutados: {dias.slice(0, 7).map((d) => `${d.fecha.slice(5)} (${d.ops_ok}${d.ops_error ? `+${d.ops_error}✗` : ''})`).join(' · ')}</p>}
          {ultimo && ultimo.simulado && (
            <details style={{ marginTop: 10 }} open>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13.5 }}>Agenda simulada de {ultimo.fecha}</summary>
              <ul style={{ margin: '6px 0 0', fontSize: 13 }}>{ultimo.registro.map((r, i) => <li key={i}>{r.detalle}</li>)}</ul>
            </details>
          )}
        </Panel>

        <Panel titulo="Resultados en vivo (lo que ven los Informes de la demo)" ayuda="Meta del plan contra lo realmente cargado en la demo. Si un mes va atrasado, Sabio vende un poco más los días que quedan.">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'right', color: COLORES.gris }}>
                  {['Mes', 'Meta ventas', 'Ventas reales', 'Avance', 'Compras', 'Gastos (pagos)', 'Margen bruto', 'Ops'].map((h, i) => <th key={h} style={{ padding: '6px 8px', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => {
                  const avance = m.meta > 0 ? (m.ventas / m.meta) * 100 : 0;
                  const margen = m.ventas > 0 ? ((m.ventas - m.cmv) / m.ventas) * 100 : 0;
                  return (
                    <tr key={m.mes} style={{ borderTop: '1px solid #eef2f6', textAlign: 'right' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>{MESES[Number(m.mes.slice(5, 7)) - 1]} {m.mes.slice(0, 4)}</td>
                      <td style={{ padding: '6px 8px' }}>{dinero(m.meta)}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>{dinero(m.ventas)}</td>
                      <td style={{ padding: '6px 8px', color: avance >= 90 ? '#166534' : avance >= 60 ? '#b45309' : '#b91c1c', fontWeight: 700 }}>{avance.toFixed(0)} %</td>
                      <td style={{ padding: '6px 8px' }}>{dinero(m.compras)}</td>
                      <td style={{ padding: '6px 8px' }}>{dinero(m.gastos)}</td>
                      <td style={{ padding: '6px 8px', color: Math.abs(margen - cfg.plan.margenBrutoObjetivoPct) <= 8 ? '#166534' : '#b45309' }}>{m.ventas > 0 ? `${margen.toFixed(0)} %` : '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{m.ops}</td>
                    </tr>
                  );
                })}
                {meses.length === 0 && <tr><td colSpan={8} style={{ padding: 12, color: COLORES.gris }}>Todavía no hay operaciones desde {cfg.inicio}.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel titulo="📈 Plan de crecimiento" ayuda="De acá sale la meta de ventas de cada mes y, dividida por día, el presupuesto diario.">
          <div style={rejilla}>
            <Campo etiqueta="Rellenar desde (AAAA-MM-DD)"><input style={estiloCampo} value={cfg.inicio} onChange={(e) => cambiar(['inicio'], e.target.value)} /></Campo>
            <Campo etiqueta="Ventas del mes de inicio (R$)"><input type="number" style={estiloCampo} value={cfg.plan.ventasBaseMensual} onChange={(e) => cambiar(['plan', 'ventasBaseMensual'], num(e))} /></Campo>
            <Campo etiqueta="Crecimiento mensual (%)"><input type="number" style={estiloCampo} value={cfg.plan.crecimientoMensualPct} onChange={(e) => cambiar(['plan', 'crecimientoMensualPct'], num(e))} /></Campo>
            <Campo etiqueta="Curva" ayuda="Compuesta: % sobre el mes anterior · Lineal: suma fija · Escalonada: sube cada trimestre · S: lento, rápido, se aplana">
              <select style={estiloCampo} value={cfg.plan.curva} onChange={(e) => cambiar(['plan', 'curva'], e.target.value as Curva)}>
                <option value="COMPUESTA">Compuesta</option><option value="LINEAL">Lineal</option><option value="ESCALONADA">Escalonada</option><option value="S">En S</option>
              </select>
            </Campo>
            <Campo etiqueta="Margen bruto objetivo (%)" ayuda="Solo para comparar en la tabla"><input type="number" style={estiloCampo} value={cfg.plan.margenBrutoObjetivoPct} onChange={(e) => cambiar(['plan', 'margenBrutoObjetivoPct'], num(e))} /></Campo>
            <Campo etiqueta="Semilla" ayuda="Misma semilla = mismos datos; cambiarla da otra historia"><input type="number" style={estiloCampo} value={cfg.semilla} onChange={(e) => cambiar(['semilla'], num(e))} /></Campo>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: COLORES.gris }}>Estacionalidad (multiplicador de cada mes; 1 = normal)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))', gap: 8, marginTop: 4 }}>
            {MESES.map((m, i) => (
              <label key={m} style={{ fontSize: 11, color: COLORES.gris }}>{m}<input type="number" step="0.05" style={estiloCampo} value={cfg.plan.estacionalidad[i]} onChange={(e) => cambiar(['plan', 'estacionalidad', i], num(e))} /></label>
            ))}
          </div>
        </Panel>

        <Panel titulo="⏱ Ritmo diario" ayuda="Cuántas operaciones por día y cómo se reparten en la semana (peso 0 = ese día no hay actividad).">
          <div style={rejilla}>
            <Campo etiqueta="Operaciones mínimas por día"><input type="number" style={estiloCampo} value={cfg.ritmo.opsMin} onChange={(e) => cambiar(['ritmo', 'opsMin'], num(e))} /></Campo>
            <Campo etiqueta="Operaciones máximas por día"><input type="number" style={estiloCampo} value={cfg.ritmo.opsMax} onChange={(e) => cambiar(['ritmo', 'opsMax'], num(e))} /></Campo>
            <Campo etiqueta="Tope diario" ayuda="Nunca se superan (seguridad)"><input type="number" style={estiloCampo} value={cfg.ritmo.topeDiario} onChange={(e) => cambiar(['ritmo', 'topeDiario'], num(e))} /></Campo>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(60px, 1fr))', gap: 8, marginTop: 12 }}>
            {DIAS.map((d, i) => (
              <label key={d} style={{ fontSize: 11, color: COLORES.gris }}>{d}<input type="number" step="0.05" style={estiloCampo} value={cfg.ritmo.pesoDiaSemana[i]} onChange={(e) => cambiar(['ritmo', 'pesoDiaSemana', i], num(e))} /></label>
            ))}
          </div>
        </Panel>

        <Panel titulo="🛒 Ventas" ayuda="Qué se vende, a qué precio y cómo se cobra.">
          <div style={rejilla}>
            <Campo etiqueta="Servicios en el mix de ventas (%)"><input type="number" style={estiloCampo} value={cfg.ventas.mixServiciosPct} onChange={(e) => cambiar(['ventas', 'mixServiciosPct'], num(e))} /></Campo>
            <Campo etiqueta="Ticket de un servicio (R$)"><input type="number" style={estiloCampo} value={cfg.ventas.ticketServicios} onChange={(e) => cambiar(['ventas', 'ticketServicios'], num(e))} /></Campo>
            <Campo etiqueta="Margen sobre el costo (%)" ayuda="Recargo de los productos"><input type="number" style={estiloCampo} value={cfg.ventas.margenProductosPct} onChange={(e) => cambiar(['ventas', 'margenProductosPct'], num(e))} /></Campo>
            <Campo etiqueta="Variación de precio (± %)"><input type="number" style={estiloCampo} value={cfg.ventas.variacionPrecioPct} onChange={(e) => cambiar(['ventas', 'variacionPrecioPct'], num(e))} /></Campo>
            {MEDIOS_PLATA.map((m) => (
              <Campo key={m} etiqueta={`Cobros en ${m} (peso)`}><input type="number" style={estiloCampo} value={cfg.ventas.medios[m] ?? 0} onChange={(e) => cambiar(['ventas', 'medios', m], num(e))} /></Campo>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Campo etiqueta="Categorías de producto que se compran y se venden (separadas por coma)">
              <input style={estiloCampo} value={cfg.ventas.categoriasProducto.join(', ')} onChange={(e) => cambiar(['ventas', 'categoriasProducto'], e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
            </Campo>
          </div>
        </Panel>

        <Panel titulo="📦 Compras" ayuda="Frecuencia de reposición, inflación de costos y costo de referencia de cada categoría (cada producto varía de 0,6× a 1,6×).">
          <div style={rejilla}>
            <Campo etiqueta="Compras por semana"><input type="number" step="0.5" style={estiloCampo} value={cfg.compras.comprasPorSemana} onChange={(e) => cambiar(['compras', 'comprasPorSemana'], num(e))} /></Campo>
            <Campo etiqueta="Inflación de costos (% mensual)"><input type="number" step="0.1" style={estiloCampo} value={cfg.compras.inflacionCostosMensualPct} onChange={(e) => cambiar(['compras', 'inflacionCostosMensualPct'], num(e))} /></Campo>
            {cfg.ventas.categoriasProducto.map((cat) => (
              <Campo key={cat} etiqueta={`Costo de referencia: ${cat} (R$)`}><input type="number" style={estiloCampo} value={cfg.compras.costoBaseCategoria[cat] ?? 80} onChange={(e) => cambiar(['compras', 'costoBaseCategoria', cat], num(e))} /></Campo>
            ))}
          </div>
        </Panel>

        <Panel titulo="💸 Gastos" ayuda="Fijos con día de pago, variables como % de las ventas e impuesto sobre las ventas del mes anterior (se paga el 20).">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead><tr style={{ color: COLORES.gris, textAlign: 'left' }}>{['Activo', 'Categoría de PAGO', 'Monto 1.er mes', 'Día', 'Medio', 'Proveedor', ''].map((h) => <th key={h} style={{ padding: '4px 6px' }}>{h}</th>)}</tr></thead>
              <tbody>
                {cfg.gastos.fijos.map((g: GastoFijo, i) => (
                  <tr key={i}>
                    <td style={{ padding: 4 }}><input type="checkbox" checked={g.activo} onChange={(e) => cambiar(['gastos', 'fijos', i, 'activo'], e.target.checked)} /></td>
                    <td style={{ padding: 4 }}><input style={estiloCampo} value={g.categoria} onChange={(e) => cambiar(['gastos', 'fijos', i, 'categoria'], e.target.value)} /></td>
                    <td style={{ padding: 4, width: 110 }}><input type="number" style={estiloCampo} value={g.monto} onChange={(e) => cambiar(['gastos', 'fijos', i, 'monto'], num(e))} /></td>
                    <td style={{ padding: 4, width: 70 }}><input type="number" style={estiloCampo} value={g.dia} onChange={(e) => cambiar(['gastos', 'fijos', i, 'dia'], num(e))} /></td>
                    <td style={{ padding: 4 }}><select style={estiloCampo} value={g.medio} onChange={(e) => cambiar(['gastos', 'fijos', i, 'medio'], e.target.value)}>{MEDIOS_PLATA.map((m) => <option key={m}>{m}</option>)}</select></td>
                    <td style={{ padding: 4 }}><input style={estiloCampo} value={g.proveedor} onChange={(e) => cambiar(['gastos', 'fijos', i, 'proveedor'], e.target.value)} /></td>
                    <td style={{ padding: 4 }}><button type="button" onClick={() => cambiar(['gastos', 'fijos'], cfg.gastos.fijos.filter((_, k) => k !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => cambiar(['gastos', 'fijos'], [...cfg.gastos.fijos, { categoria: '', monto: 100, dia: 10, medio: 'Banco', proveedor: '', activo: true }])} style={{ ...boton(COLORES.azul), marginTop: 8, padding: '6px 12px' }}>+ Gasto fijo</button>
          <div style={{ ...rejilla, marginTop: 14 }}>
            <Campo etiqueta="Gastos variables (% de las ventas)"><input type="number" step="0.5" style={estiloCampo} value={cfg.gastos.variablesPctVentas} onChange={(e) => cambiar(['gastos', 'variablesPctVentas'], num(e))} /></Campo>
            <Campo etiqueta="Impuesto (% de las ventas del mes anterior)"><input type="number" step="0.5" style={estiloCampo} value={cfg.gastos.impuestoPctVentas} onChange={(e) => cambiar(['gastos', 'impuestoPctVentas'], num(e))} /></Campo>
            <Campo etiqueta="Categoría del impuesto"><input style={estiloCampo} value={cfg.gastos.categoriaImpuesto} onChange={(e) => cambiar(['gastos', 'categoriaImpuesto'], e.target.value)} /></Campo>
          </div>
          <div style={{ marginTop: 12 }}>
            <Campo etiqueta="Categorías de gastos variables (separadas por coma)"><input style={estiloCampo} value={cfg.gastos.categoriasVariables.join(', ')} onChange={(e) => cambiar(['gastos', 'categoriasVariables'], e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></Campo>
          </div>
        </Panel>

        <Panel titulo="🏦 Capital y caja" ayuda="Los socios aportan el capital inicial y reponen la caja cuando baja del colchón; los depósitos pasan el efectivo al banco.">
          <div style={rejilla}>
            <Campo etiqueta="Aporte inicial de socios (R$)"><input type="number" style={estiloCampo} value={cfg.capital.aporteInicial} onChange={(e) => cambiar(['capital', 'aporteInicial'], num(e))} /></Campo>
            <Campo etiqueta="Colchón mínimo de caja (R$)"><input type="number" style={estiloCampo} value={cfg.capital.colchonMinimoCaja} onChange={(e) => cambiar(['capital', 'colchonMinimoCaja'], num(e))} /></Campo>
            <Campo etiqueta="Aporte mínimo de reposición (R$)"><input type="number" style={estiloCampo} value={cfg.capital.aporteMinimo} onChange={(e) => cambiar(['capital', 'aporteMinimo'], num(e))} /></Campo>
            <Campo etiqueta="Retiro de socios (% de las ventas del mes)" ayuda="0 = sin retiros"><input type="number" step="0.5" style={estiloCampo} value={cfg.capital.retiroSociosPctVentas} onChange={(e) => cambiar(['capital', 'retiroSociosPctVentas'], num(e))} /></Campo>
            <Campo etiqueta="Efectivo mínimo antes de depositar (R$)"><input type="number" style={estiloCampo} value={cfg.transferencias.umbralEfectivo} onChange={(e) => cambiar(['transferencias', 'umbralEfectivo'], num(e))} /></Campo>
            <Campo etiqueta="% del efectivo que se deposita (viernes)"><input type="number" style={estiloCampo} value={cfg.transferencias.efectivoQueSeDepositaPct} onChange={(e) => cambiar(['transferencias', 'efectivoQueSeDepositaPct'], num(e))} /></Campo>
          </div>
        </Panel>

        <div style={{ position: 'sticky', bottom: 10, display: 'flex', gap: 10, alignItems: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '10px 14px', marginBottom: 16 }}>
          <button type="button" disabled={!sucio || Boolean(problema)} onClick={() => guardar()} style={boton(COLORES.verde, !sucio || Boolean(problema))}>💾 Guardar plan y palancas</button>
          <button type="button" onClick={() => { setCfg(CONFIG_POR_DEFECTO); sucioRef.current = true; setSucio(true); }} style={{ ...boton('#64748b'), padding: '10px 12px' }}>Volver a los valores por defecto</button>
          {problema && <span style={{ color: '#b91c1c', fontSize: 13 }}>{problema}</span>}
          {!problema && sucio && <span style={{ color: '#b45309', fontSize: 13 }}>Hay cambios sin guardar.</span>}
        </div>

        <Panel titulo="Registro de actividad" ayuda="Lo que cargó Sabio y lo que el motor rechazó (el motor tiene la última palabra: nunca se fuerza nada).">
          <div style={{ maxHeight: 360, overflow: 'auto', fontSize: 13 }}>
            {registro.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 10, padding: '4px 0', borderTop: '1px solid #f1f5f9', color: r.tipo === 'RECHAZO' ? '#b91c1c' : '#374151' }}>
                <span style={{ color: COLORES.gris, whiteSpace: 'nowrap' }}>{r.fecha.slice(5)}</span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.id_operacion ?? (r.tipo === 'RECHAZO' ? '✗' : '·')}</span>
                <span>{r.detalle}{r.error ? ` — ${r.error}` : ''}</span>
              </div>
            ))}
            {registro.length === 0 && <p style={{ color: COLORES.gris, margin: 0 }}>Todavía no hay actividad.</p>}
          </div>
        </Panel>
      </div>
    </main>
  );
}
