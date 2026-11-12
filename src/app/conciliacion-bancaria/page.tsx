'use client';

// CONCILIACIÓN BANCARIA (Open Finance, Brasil) — ARMADA PERO NO ACTIVA (la pieza de Caja «conciliacion-bancaria» la mantiene oculta).
// Compara lo que informa el banco con lo cargado en Visão: lo que ya está cargado queda conciliado, lo que falta se PROPONE y la persona
// aprueba, edita o ignora. Al aprobar se registra con el motor contable de siempre. Ver lib/conciliacionBancaria.ts y lib/openFinance/.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useEnShell } from '@/components/shell/ShellContext';
import { simboloMoneda } from '@/lib/moneda';
import { obtenerCategoriasJuego } from '@/lib/miniJuego';
import { BANCOS_OPEN_FINANCE, bancoDeNombre } from '@/lib/openFinance/bancos';
import { aprobarMovimiento, cargarConciliacion, formasPagoVinculables, ignorarMovimiento, recalcularCuenta, reabrirMovimiento, vincularCuenta, type CuentaBanco, type MovimientoBanco } from '@/lib/conciliacionBancariaDatos';
import type { EstadoSaldos } from '@/lib/conciliacionBancaria';

const COLORES = { azul: 'var(--color-primario, #1f3a5f)', verde: 'var(--color-secundario, #2e8b57)', gris: 'var(--color-acento, #6e7781)' };

type Revision = { estadoSaldos: EstadoSaldos | null; saldoVisao: number | null; sinBanco: number };

export default function ConciliacionBancariaPage() {
  const enShell = useEnShell();
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState({ idioma: 'ES', simbolo: 'R$' });
  const [activo, setActivo] = useState<boolean | null>(null);
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof cargarConciliacion>> | null>(null);
  const [formas, setFormas] = useState<string[]>([]);
  const [revisiones, setRevisiones] = useState<Record<string, Revision>>({});
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const pt = empresa.idioma === 'PT';
  const t = (es: string, p: string) => (pt ? p : es);
  const dinero = (n: number) => `${empresa.simbolo} ${n.toLocaleString(pt ? 'pt-BR' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cargar = useCallback(async (id: string) => {
    setError('');
    try {
      const d = await cargarConciliacion(id);
      setDatos(d);
      const rev: Record<string, Revision> = {};
      for (const c of d.cuentas) {
        const r = await recalcularCuenta(id, c);
        rev[c.id] = { estadoSaldos: r.estadoSaldos, saldoVisao: r.saldoVisao, sinBanco: r.sinBanco.length };
      }
      setRevisiones(rev);
      if (d.cuentas.length > 0) setDatos(await cargarConciliacion(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la conciliación.');
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    async function iniciar() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return router.push('/login');
      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', u.user.id).maybeSingle();
      if (!perfil?.empresa_id) return setError('No se pudo identificar la empresa del usuario.');
      const id = perfil.empresa_id as string;
      const { data: e } = await supabase.from('empresas').select('idioma, moneda').eq('id', id).maybeSingle();
      if (!vivo) return;
      setEmpresa({ idioma: e?.idioma === 'PT' ? 'PT' : 'ES', simbolo: simboloMoneda(e?.moneda as string | null) });
      setEmpresaId(id);
      setFormas(await formasPagoVinculables(id).catch(() => []));
      fetch('/api/open-finance/estado', { method: 'POST' }).then((r) => r.json()).then((j) => vivo && setActivo(Boolean(j.activo))).catch(() => vivo && setActivo(false));
      await cargar(id);
    }
    void iniciar();
    return () => {
      vivo = false;
    };
  }, [router, cargar]);

  async function llamar(accion: 'token' | 'sincronizar') {
    setTrabajando(accion);
    setAviso('');
    setError('');
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const r = await fetch(`/api/open-finance/${accion}`, { method: 'POST', headers: { authorization: `Bearer ${sesion.session?.access_token ?? ''}`, 'content-type': 'application/json' }, body: '{}' });
      const j = (await r.json()) as { error?: string; nuevos?: number };
      if (!r.ok) throw new Error(j.error ?? 'No se pudo completar.');
      setAviso(accion === 'sincronizar' ? t(`Listo: ${j.nuevos ?? 0} movimientos nuevos.`, `Pronto: ${j.nuevos ?? 0} movimentos novos.`) : t('Conexión lista para abrir.', 'Conexão pronta para abrir.'));
      if (empresaId) await cargar(empresaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.');
    }
    setTrabajando(null);
  }

  const tarjeta: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '16px 18px', boxShadow: '0 4px 14px rgba(31,58,95,0.06)' };

  return (
    <main style={{ minHeight: enShell ? 'auto' : '100vh', background: 'var(--fondo-app, linear-gradient(180deg, #f5f7f9 0%, #e8eff6 100%))', padding: '24px 20px 48px', color: COLORES.azul }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>🏦 {t('Conciliación bancaria', 'Conciliação bancária')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14.5, color: COLORES.gris }}>
            {t('Conectá tu banco, mirá su saldo y aprobá lo que falta en Visão para que los dos queden iguales.', 'Conecte seu banco, veja o saldo e aprove o que falta na Visão para os dois ficarem iguais.')}
          </p>
        </div>

        {activo === false && (
          <div style={{ ...tarjeta, background: '#fffbeb', border: '1px solid #fcd34d' }}>
            <strong>🚧 {t('Open Finance todavía no está activado.', 'O Open Finance ainda não está ativado.')}</strong>
            <p style={{ margin: '6px 0 0', fontSize: 14 }}>{t('La pantalla está lista: cuando se active, acá vas a conectar tu banco y aprobar las propuestas.', 'A tela está pronta: quando for ativado, aqui você conecta seu banco e aprova as propostas.')}</p>
          </div>
        )}
        {error && <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>{error}</p>}
        {aviso && <p style={{ color: '#166534', fontSize: 14, margin: 0 }}>{aviso}</p>}

        {datos && datos.cuentas.length === 0 && (
          <div style={tarjeta}>
            <strong style={{ fontSize: 16 }}>{t('Bancos previstos (Brasil)', 'Bancos previstos (Brasil)')}</strong>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
              {BANCOS_OPEN_FINANCE.map((b) => (
                <span key={b.codigo} style={{ border: '1px solid #d1d5db', borderRadius: 999, padding: '7px 14px', fontWeight: 700, fontSize: 14 }}>{b.emoji} {b.nombre}</span>
              ))}
            </div>
            <button type="button" disabled={!activo || trabajando !== null} onClick={() => llamar('token')} style={{ border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 800, background: activo ? COLORES.verde : '#cbd5e1', color: '#fff', cursor: activo ? 'pointer' : 'not-allowed' }}>
              🔗 {t('Conectar un banco', 'Conectar um banco')}
            </button>
          </div>
        )}

        {datos?.cuentas.map((c) => (
          <CuentaCard key={c.id} cuenta={c} banco={datos.conexiones.find((x) => x.id === c.conexion_id)?.banco_nombre ?? ''} formas={formas} revision={revisiones[c.id]} movimientos={datos.movimientos.filter((m) => m.cuenta_banco_id === c.id)} empresaId={empresaId} t={t} dinero={dinero} activo={Boolean(activo)} trabajando={trabajando} onSincronizar={() => llamar('sincronizar')} onCambio={() => empresaId && cargar(empresaId)} onError={setError} />
        ))}
      </div>
    </main>
  );
}

function CuentaCard({ cuenta, banco, formas, revision, movimientos, empresaId, t, dinero, activo, trabajando, onSincronizar, onCambio, onError }: { cuenta: CuentaBanco; banco: string; formas: string[]; revision?: Revision; movimientos: MovimientoBanco[]; empresaId: string | null; t: (es: string, pt: string) => string; dinero: (n: number) => string; activo: boolean; trabajando: string | null; onSincronizar: () => void; onCambio: () => void; onError: (m: string) => void }) {
  const pendientes = useMemo(() => movimientos.filter((m) => m.estado === 'PENDIENTE'), [movimientos]);
  const resueltos = movimientos.length - pendientes.length;
  const sd = revision?.estadoSaldos ?? null;
  const emoji = bancoDeNombre(banco)?.emoji ?? '🏦';

  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '16px 18px', boxShadow: '0 4px 14px rgba(31,58,95,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{emoji} {banco} · {cuenta.nombre} {cuenta.numero_mascara ?? ''}</div>
          <div style={{ fontSize: 13, color: COLORES.gris }}>{cuenta.saldo_actualizado_en ? `${t('Saldo del banco al', 'Saldo do banco em')} ${new Date(cuenta.saldo_actualizado_en).toLocaleString()}` : t('Sin saldo todavía', 'Sem saldo ainda')}</div>
        </div>
        <button type="button" disabled={!activo || trabajando !== null} onClick={onSincronizar} style={{ border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 800, background: activo ? '#e7f9ef' : '#e5e7eb', color: '#166534', cursor: activo ? 'pointer' : 'not-allowed' }}>
          🔄 {t('Sincronizar', 'Sincronizar')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '14px 0' }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: COLORES.gris }}>
          {t('Cuenta en Visão', 'Conta na Visão')}
          <select value={cuenta.forma_pago_nombre ?? ''} onChange={async (e) => { try { await vincularCuenta(cuenta.id, e.target.value || null); onCambio(); } catch (er) { onError(er instanceof Error ? er.message : 'No se pudo vincular.'); } }} style={{ display: 'block', marginTop: 4, padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 15 }}>
            <option value="">{t('Elegir…', 'Escolher…')}</option>
            {formas.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <Dato titulo={t('Saldo del banco', 'Saldo do banco')} valor={cuenta.saldo_banco === null ? '—' : dinero(cuenta.saldo_banco)} />
        <Dato titulo={t('Saldo en Visão', 'Saldo na Visão')} valor={revision?.saldoVisao == null ? '—' : dinero(revision.saldoVisao)} />
        {sd && <Dato titulo={t('Diferencia', 'Diferença')} valor={sd.coincide ? '✅ 0' : dinero(sd.diferencia)} color={sd.coincide ? '#166534' : '#b45309'} />}
      </div>

      {!cuenta.forma_pago_nombre && <p style={{ margin: '0 0 8px', fontSize: 13.5, color: '#b45309' }}>{t('Vinculá la cuenta con una de Visão para poder conciliar.', 'Vincule a conta a uma da Visão para conciliar.')}</p>}
      {sd?.coincidiriaAlAprobar && <p style={{ margin: '0 0 8px', fontSize: 13.5, color: '#166534', fontWeight: 700 }}>✔ {t('Si aprobás todo lo pendiente, los saldos quedan iguales.', 'Se aprovar tudo que está pendente, os saldos ficam iguais.')}</p>}
      {sd && !sd.coincide && !sd.coincidiriaAlAprobar && pendientes.length >= 0 && <p style={{ margin: '0 0 8px', fontSize: 13.5, color: '#b45309' }}>{t('Aun aprobando todo quedaría una diferencia: puede venir de un saldo inicial o de movimientos anteriores al período traído.', 'Mesmo aprovando tudo ficaria uma diferença: pode vir de um saldo inicial ou de movimentos anteriores ao período.')}</p>}
      {(revision?.sinBanco ?? 0) > 0 && <p style={{ margin: '0 0 8px', fontSize: 13.5, color: COLORES.gris }}>{revision!.sinBanco} {t('operaciones de Visão no aparecen en el extracto.', 'operações da Visão não aparecem no extrato.')}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pendientes.map((m) => (
          <Propuesta key={m.id} mov={m} formaPago={cuenta.forma_pago_nombre} empresaId={empresaId} t={t} dinero={dinero} onCambio={onCambio} onError={onError} />
        ))}
        {pendientes.length === 0 && cuenta.forma_pago_nombre && <p style={{ margin: 0, fontSize: 14, color: COLORES.gris }}>{t('No hay nada pendiente de revisar.', 'Não há nada pendente de revisão.')}</p>}
      </div>
      {resueltos > 0 && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: COLORES.gris }}>{resueltos} {t('movimientos ya resueltos (conciliados, aprobados o ignorados).', 'movimentos já resolvidos (conciliados, aprovados ou ignorados).')}</p>}
    </section>
  );
}

function Dato({ titulo, valor, color }: { titulo: string; valor: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORES.gris }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: color ?? COLORES.azul, marginTop: 2 }}>{valor}</div>
    </div>
  );
}

function Propuesta({ mov, formaPago, empresaId, t, dinero, onCambio, onError }: { mov: MovimientoBanco; formaPago: string | null; empresaId: string | null; t: (es: string, pt: string) => string; dinero: (n: number) => string; onCambio: () => void; onError: (m: string) => void }) {
  const operacion: 'PAGO' | 'COBRO' = mov.monto < 0 ? 'PAGO' : 'COBRO';
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoria, setCategoria] = useState(mov.sugerencia?.categoria ?? '');
  const [contacto, setContacto] = useState(mov.sugerencia?.contacto ?? mov.contraparte ?? '');
  const [detalle, setDetalle] = useState(mov.sugerencia?.detalle ?? mov.descripcion ?? '');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    obtenerCategoriasJuego(empresaId, operacion).then((cs) => setCategorias(cs.filter((c) => c.stock !== 'SI').map((c) => c.nombre))).catch(() => null);
  }, [empresaId, operacion]);

  async function aprobar() {
    if (!empresaId || !formaPago) return;
    setGuardando(true);
    try {
      await aprobarMovimiento(empresaId, mov, formaPago, { operacion, categoria, contacto, detalle });
      onCambio();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo aprobar.');
    }
    setGuardando(false);
  }

  const campo: React.CSSProperties = { padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, minWidth: 0 };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', background: '#fafbfc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800 }}>{mov.descripcion || mov.contraparte || '—'}</div>
          <div style={{ fontSize: 12.5, color: COLORES.gris }}>{new Date(`${mov.fecha}T12:00:00`).toLocaleDateString()} · {operacion === 'PAGO' ? t('Salió', 'Saiu') : t('Entró', 'Entrou')}</div>
        </div>
        <div style={{ fontSize: 19, fontWeight: 900, color: mov.monto < 0 ? '#b91c1c' : '#166534' }}>{dinero(mov.monto)}</div>
      </div>
      {mov.sugerencia && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: COLORES.gris }}>💡 {mov.sugerencia.motivo}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ ...campo, flex: '1 1 180px' }}>
          <option value="">{t('Categoría…', 'Categoria…')}</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder={operacion === 'PAGO' ? t('Proveedor / destino', 'Fornecedor / destino') : t('Cliente / origen', 'Cliente / origem')} style={{ ...campo, flex: '1 1 150px' }} />
        <input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder={t('Detalle', 'Detalhe')} style={{ ...campo, flex: '1 1 150px' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" disabled={guardando || !categoria || !formaPago} onClick={aprobar} style={{ border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 800, background: !categoria || !formaPago ? '#cbd5e1' : COLORES.verde, color: '#fff', cursor: 'pointer' }}>
          ✔ {t('Aprobar', 'Aprovar')}
        </button>
        <button type="button" disabled={guardando} onClick={async () => { try { await ignorarMovimiento(mov.id); onCambio(); } catch (e) { onError(e instanceof Error ? e.message : 'No se pudo ignorar.'); } }} style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: '9px 14px', fontWeight: 700, background: '#fff', color: COLORES.azul, cursor: 'pointer' }}>
          {t('Ignorar', 'Ignorar')}
        </button>
      </div>
    </div>
  );
}

// reabrirMovimiento queda disponible para una futura lista de «ignorados».
void reabrirMovimiento;
