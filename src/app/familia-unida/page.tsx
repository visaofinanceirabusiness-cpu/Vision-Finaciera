'use client';

// FAMILIA UNIDA
//
// Une dos o más perfiles de Finanzas Personales y muestra sus finanzas como las de una sola familia: resumen, lo que se tiene y
// se debe, resultado, evolución y distribución de gastos e ingresos. Cada persona sigue con sus propios registros: esto es una
// SUMA de lo que ya calcula el Panel de Control (ver lib/familiaUnida.ts y /api/familia-unida). Se vincula con un código que la
// otra persona acepta, y cualquiera puede salir cuando quiera.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useEnShell } from '@/components/shell/ShellContext';
import { formatearMonto } from '@/lib/moneda';
import { consolidar, participaciones, tendenciaDelResultado, type EstadoFamilia, type PersonaFamilia, type PuntoEvolucion } from '@/lib/familiaUnida';
import type { PuntoGrafico } from '@/lib/contabilidad';

const COLORES = {
  azul: 'var(--color-primario, #1f3a5f)',
  verde: 'var(--color-secundario, #2e8b57)',
  gris: 'var(--color-acento, #6e7781)',
  blanco: '#ffffff',
};
const PALETA = ['#1f3a5f', '#2e8b57', '#4caf50', '#7bc67e', '#0ea5e9', '#94a3b8'];

type Familia = Extract<EstadoFamilia, { estado: 'ACTIVA' }>;

export default function FamiliaUnidaPage() {
  const enShell = useEnShell();
  const router = useRouter();
  const [idioma, setIdioma] = useState<'ES' | 'PT'>('ES');
  const [estado, setEstado] = useState<EstadoFamilia | null>(null);
  const [moneda, setMoneda] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('TODOS');
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [verInvitar, setVerInvitar] = useState(false);

  const pt = idioma === 'PT';
  const t = useCallback((es: string, p: string) => (pt ? p : es), [pt]);

  const llamar = useCallback(async (metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Sesión vencida: volvé a iniciar sesión.');
    const respuesta = await fetch(ruta, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(json.error ?? 'No se pudo completar la acción.');
    return json;
  }, []);

  const cargar = useCallback(
    async (p: string) => {
      try {
        const json = (await llamar('GET', `/api/familia-unida?periodo=${encodeURIComponent(p)}`)) as EstadoFamilia;
        setEstado(json);
        setError('');
        if (json.estado === 'ACTIVA' && p === 'TODOS') {
          setMesesDisponibles(consolidar(json.personas).evolucion.map((e) => e.clave).reverse());
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar Familia Unida.');
      }
    },
    [llamar]
  );

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.push('/login');
        return;
      }
      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', u.user.id).maybeSingle();
      if (perfil?.empresa_id) {
        const { data: emp } = await supabase.from('empresas').select('idioma, moneda').eq('id', perfil.empresa_id).maybeSingle();
        if (vivo) {
          setIdioma(emp?.idioma === 'PT' ? 'PT' : 'ES');
          setMoneda((emp?.moneda as string | null) ?? null);
        }
      }
      if (vivo) await cargar('TODOS');
    })();
    return () => {
      vivo = false;
    };
  }, [router, cargar]);

  async function accion(cuerpo: Record<string, unknown>, exito?: string) {
    setTrabajando(true);
    setError('');
    setAviso('');
    try {
      await llamar('POST', '/api/familia-unida', cuerpo);
      if (exito) setAviso(exito);
      setPeriodo('TODOS');
      await cargar('TODOS');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setTrabajando(false);
    }
  }

  async function invitar() {
    setTrabajando(true);
    setError('');
    try {
      await llamar('POST', '/api/familia-unida', { accion: 'invitar' });
      await cargar(periodo);
      setVerInvitar(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la invitación.');
    } finally {
      setTrabajando(false);
    }
  }

  const cambiarPeriodo = async (p: string) => {
    setPeriodo(p);
    await cargar(p);
  };

  const familia: Familia | null = estado?.estado === 'ACTIVA' ? estado : null;
  const total = useMemo(() => (familia ? consolidar(familia.personas) : null), [familia]);
  const dinero = (v: number) => formatearMonto(v, moneda);
  const invitacion = estado?.invitacion ?? null;

  if (!estado && !error) {
    return <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORES.azul, fontWeight: 700, fontSize: 18 }}>{t('Reuniendo a la familia…', 'Reunindo a família…')}</main>;
  }

  return (
    <main style={{ minHeight: enShell ? 'auto' : '100vh', background: 'var(--fondo-app, linear-gradient(180deg, #f5f9f7 0%, #e6f1ec 100%))', padding: '20px 18px 48px', color: COLORES.azul }}>
      <style>{`
        .fu-fila { display: grid; gap: 16px; }
        .fu-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .fu-medio { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; }
        @media (min-width: 1750px) { .fu-medio { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        @media (max-width: 720px) { .fu-kpis, .fu-medio { grid-template-columns: 1fr; } .fu-pareja { width: 110px !important; height: 110px !important; } }
      `}</style>

      <Encabezado
        t={t}
        personas={familia?.personas ?? []}
        enFamilia={Boolean(familia)}
        trabajando={trabajando}
        onInvitar={() => (invitacion ? setVerInvitar(true) : invitar())}
        onSalir={() => {
          if (window.confirm(t('¿Salir de la familia? Tus datos dejan de verse en ella al instante y los de los demás dejan de verse en tu pantalla. Tus registros no se tocan.', 'Sair da família? Seus dados deixam de aparecer nela na hora e os dos outros deixam de aparecer na sua tela. Seus registros não são alterados.'))) void accion({ accion: 'salir' }, t('Saliste de la familia.', 'Você saiu da família.'));
        }}
      />

      {error && <Aviso color="#b91c1c" fondo="#fef2f2">{error}</Aviso>}
      {aviso && <Aviso color="#166534" fondo="#dcfce7">{aviso}</Aviso>}
      {familia && familia.omitidas.length > 0 && <Aviso color="#92400e" fondo="#fffbeb">{t('No se pudieron leer los datos de:', 'Não foi possível ler os dados de:')} {familia.omitidas.join(', ')}.</Aviso>}

      {estado?.estado === 'SIN_FAMILIA' && (
        <SinFamilia t={t} codigo={codigo} setCodigo={setCodigo} trabajando={trabajando} onInvitar={invitar} onUnirse={() => accion({ accion: 'unirse', codigo }, t('¡Listo! Ya son una familia unida.', 'Pronto! Vocês já são uma família unida.'))} />
      )}

      {familia && total && (
        <>
          {familia.personas.length < 2 && (
            <Aviso color="#1e3a8a" fondo="#eff6ff">
              {t('Por ahora estás solo en la familia: lo que ves son tus propias finanzas. Invitá a otra persona para sumar las suyas.', 'Por enquanto você está sozinho na família: o que você vê são as suas finanças. Convide outra pessoa para somar as dela.')}
            </Aviso>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
            <label style={{ fontWeight: 800, fontSize: 17 }}>📅 {t('Período', 'Período')}</label>
            <select value={periodo} onChange={(e) => void cambiarPeriodo(e.target.value)} style={{ fontSize: 17, padding: '8px 12px', borderRadius: 12, border: '2px solid #cfe3d8', background: '#fff', color: COLORES.azul, fontWeight: 700 }}>
              <option value="TODOS">{t('Todo el tiempo', 'Todo o período')}</option>
              {mesesDisponibles.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="fu-fila fu-kpis">
            <Kpi imagen="💰" titulo={t('Ingresos', 'Receitas')} valor={dinero(total.ingresos)} personas={familia.personas} campo="ingresos" dinero={dinero} t={t} color="#16a34a" />
            <Kpi imagen="🛒" titulo={t('Gastos', 'Despesas')} valor={dinero(total.egresos)} personas={familia.personas} campo="egresos" dinero={dinero} t={t} color="#ea580c" />
            <Kpi imagen={total.resultado >= 0 ? '✅' : '⚠️'} titulo={t('Resultado de la familia', 'Resultado da Família')} valor={dinero(total.resultado)} personas={familia.personas} campo="resultado" dinero={dinero} t={t} color={total.resultado >= 0 ? '#2e8b57' : '#dc2626'} destacado />
          </div>

          <div className="fu-fila fu-medio" style={{ marginTop: 16 }}>
            <Tarjeta titulo={t('Distribución de los gastos', 'Distribuição dos gastos')} sabio="/sabio/sabio-resumen-gastos.webp">
              <Distribucion gastos={total.gastosCategorias} ingresos={total.ingresosCategorias} dinero={dinero} t={t} />
            </Tarjeta>

            <Tarjeta titulo={t('Lo que tenemos y lo que debemos', 'O que temos e o que devemos')} sabio="/sabio/sabio-patrimonio.webp" detalle={t('Foto de hoy de lo que la familia tiene y debe (perfiles unidos)', 'Foto de hoje do que a família tem e deve (perfis unidos)')}>
              <Fila emoji="🏠" texto={t('Lo que tenemos', 'O que temos')} valor={dinero(total.activos)} />
              <Fila emoji="💳" texto={t('Lo que debemos', 'O que devemos')} valor={dinero(total.pasivos)} />
              <Destacado emoji="⚖️" texto={t('Patrimonio líquido', 'Patrimônio líquido')} valor={dinero(total.patrimonioLiquido)} positivo={total.patrimonioLiquido >= 0} />
              <Desplegable t={t}>
                {familia.personas.map((p) => (
                  <PersonaLinea key={p.empresaId} p={p} t={t}>
                    <span>🏠 {dinero(p.activos)} · 💳 {dinero(p.pasivos)} · ⚖️ {dinero(p.activos - p.pasivos)}</span>
                  </PersonaLinea>
                ))}
              </Desplegable>
            </Tarjeta>

            <Tarjeta titulo={t('Resultado de la familia', 'Resultado da família')} sabio="/sabio/sabio-resumen-resultado.webp" detalle={t('Ingresos, gastos y resultado del período (perfiles unidos)', 'Receitas, despesas e resultado do período (perfis unidos)')}>
              <Fila emoji="⬆️" texto={t('Ingresos', 'Receitas')} valor={dinero(total.ingresos)} />
              <Fila emoji="⬇️" texto={t('Gastos', 'Despesas')} valor={dinero(total.egresos)} />
              <Destacado emoji="🎯" texto={t('Resultado del período', 'Resultado do período')} valor={dinero(total.resultado)} positivo={total.resultado >= 0} />
              <Desplegable t={t}>
                {familia.personas.map((p) => (
                  <PersonaLinea key={p.empresaId} p={p} t={t}>
                    <span>⬆️ {dinero(p.ingresos)} · ⬇️ {dinero(p.egresos)} · 🎯 {dinero(p.resultado)}</span>
                  </PersonaLinea>
                ))}
              </Desplegable>
            </Tarjeta>

            <Tarjeta titulo={t('Evolución', 'Evolução')} sabio="/sabio/sabio-evolucion.webp" detalle={t('Resultado de la familia mes a mes', 'Resultado da família mês a mês')}>
              <Evolucion evolucion={total.evolucion} dinero={dinero} t={t} />
            </Tarjeta>
          </div>
        </>
      )}

      {verInvitar && invitacion && <ModalInvitacion t={t} invitacion={invitacion} onCerrar={() => setVerInvitar(false)} onNueva={invitar} onCancelar={() => { setVerInvitar(false); void accion({ accion: 'cancelar' }); }} />}

      <p style={{ textAlign: 'center', color: COLORES.gris, fontSize: 15, marginTop: 24 }}>
        🔒 {t('Cada persona conserva sus propios registros. Acá solo se suman los totales y categorías; nada se copia ni se modifica.', 'Cada pessoa mantém os seus próprios registros. Aqui só se somam os totais e categorias; nada é copiado nem modificado.')}
      </p>
    </main>
  );
}

function Aviso({ children, color, fondo }: { children: React.ReactNode; color: string; fondo: string }) {
  return <div style={{ background: fondo, color, borderRadius: 14, padding: '12px 16px', margin: '12px 0', fontSize: 16, fontWeight: 600 }}>{children}</div>;
}

function Encabezado({ t, personas, enFamilia, trabajando, onInvitar, onSalir }: { t: (es: string, p: string) => string; personas: PersonaFamilia[]; enFamilia: boolean; trabajando: boolean; onInvitar: () => void; onSalir: () => void }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '18px 22px', background: 'linear-gradient(115deg, #0f2747 0%, #1f3a5f 45%, #2e8b57 100%)', color: '#fff', boxShadow: '0 12px 30px rgba(31,58,95,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
        <div className="fu-pareja" style={{ width: 170, height: 170, borderRadius: '50%', overflow: 'hidden', border: '5px solid #fff', flexShrink: 0, background: '#fff', boxShadow: '0 8px 22px rgba(0,0,0,0.3)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/familia-unida/pareja.webp" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(30px, 5vw, 46px)', lineHeight: 1.05 }}>{t('Familia Unida', 'Família Unida')}</h1>
            <span style={{ background: '#fff', borderRadius: 18, width: 112, height: 112, overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* El logo original trae mucho margen blanco: se agranda para que se lea el símbolo y el nombre. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpeg" alt="Visão Financeira" style={{ width: '124%', height: '124%', maxWidth: 'none', objectFit: 'contain', flexShrink: 0 }} />
            </span>
          </div>
          <span style={{ display: 'inline-block', marginTop: 8, background: '#2e8b57', borderRadius: 999, padding: '6px 16px', fontWeight: 700, fontSize: 17 }}>👥 {t('Visión financiera conjunta', 'Visão financeira conjunta')}</span>
        </div>
        <div style={{ background: '#fff', color: COLORES.azul, borderRadius: 20, padding: '12px 16px', flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>🔗 {t('Perfiles vinculados', 'Perfis vinculados')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {personas.map((p) => (
              <span key={p.empresaId} style={{ background: '#eef6f1', border: '2px solid #cfe3d8', borderRadius: 999, padding: '6px 14px', fontWeight: 700, fontSize: 16 }}>👤 {p.nombre}{p.esYo ? ` (${t('yo', 'eu')})` : ''}</span>
            ))}
            <button type="button" onClick={onInvitar} disabled={trabajando} style={{ border: '2px solid #2e8b57', background: '#fff', color: '#2e8b57', borderRadius: 999, padding: '6px 14px', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>+ {t('Agregar perfil', 'Adicionar perfil')}</button>
            {enFamilia && (
              <button type="button" onClick={onSalir} disabled={trabajando} style={{ border: 'none', background: 'transparent', color: '#6e7781', textDecoration: 'underline', fontSize: 15, cursor: 'pointer' }}>{t('Salir de la familia', 'Sair da família')}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SinFamilia({ t, codigo, setCodigo, trabajando, onInvitar, onUnirse }: { t: (es: string, p: string) => string; codigo: string; setCodigo: (v: string) => void; trabajando: boolean; onInvitar: () => void; onUnirse: () => void }) {
  const caja: React.CSSProperties = { background: '#fff', borderRadius: 22, padding: '22px 24px', boxShadow: '0 8px 22px rgba(31,58,95,0.1)', flex: '1 1 320px' };
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: 19, lineHeight: 1.5, maxWidth: 820 }}>
        👨‍👩‍👧 {t('Unan sus finanzas personales y vean juntos cómo le va a la familia: cuánto entra, cuánto sale, qué tienen y cómo evoluciona mes a mes. Cada uno sigue cargando lo suyo y nadie ve las operaciones del otro, solo los totales.', 'Unam suas finanças pessoais e vejam juntos como vai a família: quanto entra, quanto sai, o que têm e como evolui mês a mês. Cada um continua lançando o seu e ninguém vê as operações do outro, só os totais.')}
      </p>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div style={caja}>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>✉️ {t('Invitar a alguien', 'Convidar alguém')}</h2>
          <p style={{ fontSize: 17, color: COLORES.gris, lineHeight: 1.5 }}>{t('Genera un código de 8 letras para pasárselo a la otra persona. Vence en 7 días.', 'Gere um código de 8 letras para passar à outra pessoa. Vence em 7 dias.')}</p>
          <button type="button" onClick={onInvitar} disabled={trabajando} style={botonVerde}>{t('Crear código de invitación', 'Criar código de convite')}</button>
        </div>
        <div style={caja}>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>🔑 {t('Tengo un código', 'Tenho um código')}</h2>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={8} placeholder="ABCD2345" style={{ width: '100%', boxSizing: 'border-box', fontSize: 24, letterSpacing: 4, padding: '10px 14px', borderRadius: 14, border: '2px solid #cfe3d8', fontWeight: 800, textAlign: 'center', color: COLORES.azul }} />
          <p style={{ fontSize: 15, color: COLORES.gris, lineHeight: 1.5 }}>🔒 {t('Al unirte, tu familia verá tus totales de ingresos, gastos, lo que tenés y debés, y tus categorías (no tus operaciones una por una). Podés salir cuando quieras. Ambos deben usar la misma moneda.', 'Ao se unir, sua família verá seus totais de receitas, despesas, o que você tem e deve, e suas categorias (não suas operações uma a uma). Você pode sair quando quiser. Ambos devem usar a mesma moeda.')}</p>
          <button type="button" onClick={onUnirse} disabled={trabajando || codigo.length < 8} style={{ ...botonVerde, opacity: codigo.length < 8 ? 0.5 : 1 }}>{t('Unirme a la familia', 'Entrar na família')}</button>
        </div>
      </div>
    </div>
  );
}

const botonVerde: React.CSSProperties = { border: 'none', background: '#2e8b57', color: '#fff', borderRadius: 14, padding: '12px 20px', fontWeight: 800, fontSize: 18, cursor: 'pointer', width: '100%' };

function ModalInvitacion({ t, invitacion, onCerrar, onNueva, onCancelar }: { t: (es: string, p: string) => string; invitacion: { codigo: string; expiraEn: string }; onCerrar: () => void; onNueva: () => void; onCancelar: () => void }) {
  const mensaje = encodeURIComponent(t(`Te invito a unir nuestras finanzas en Visão Financeira (Familia Unida). Entrá a Familia Unida y usá este código: ${invitacion.codigo}`, `Convido você a unir nossas finanças na Visão Financeira (Família Unida). Entre em Família Unida e use este código: ${invitacion.codigo}`));
  return (
    <div role="dialog" aria-modal="true" onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 24, maxWidth: 520, width: '100%', padding: '24px 26px', borderTop: '8px solid #2e8b57', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 24 }}>✉️ {t('Código de invitación', 'Código de convite')}</h2>
        <p style={{ fontSize: 17, color: COLORES.gris }}>{t('Pasale este código a la persona que quieras sumar. Lo usa en su pantalla de Familia Unida.', 'Passe este código à pessoa que quer adicionar. Ela o usa na tela de Família Unida.')}</p>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 8, background: '#eef6f1', borderRadius: 16, padding: '14px 10px', margin: '12px 0' }}>{invitacion.codigo}</div>
        <p style={{ fontSize: 15, color: COLORES.gris }}>{t('Vence', 'Vence')}: {new Date(invitacion.expiraEn).toLocaleDateString('es-AR')}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(invitacion.codigo)} style={{ ...botonVerde, width: 'auto' }}>📋 {t('Copiar', 'Copiar')}</button>
          <a href={`https://wa.me/?text=${mensaje}`} target="_blank" rel="noreferrer" style={{ ...botonVerde, width: 'auto', textDecoration: 'none', background: '#25d366' }}>WhatsApp</a>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', fontSize: 15 }}>
          <button type="button" onClick={onNueva} style={{ border: 'none', background: 'none', color: COLORES.azul, textDecoration: 'underline', cursor: 'pointer', fontSize: 15 }}>{t('Crear otro código', 'Criar outro código')}</button>
          <button type="button" onClick={onCancelar} style={{ border: 'none', background: 'none', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', fontSize: 15 }}>{t('Cancelar invitación', 'Cancelar convite')}</button>
          <button type="button" onClick={onCerrar} style={{ border: 'none', background: 'none', color: COLORES.gris, textDecoration: 'underline', cursor: 'pointer', fontSize: 15 }}>{t('Cerrar', 'Fechar')}</button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ imagen, titulo, valor, personas, campo, dinero, t, color, destacado }: { imagen: string; titulo: string; valor: string; personas: PersonaFamilia[]; campo: 'ingresos' | 'egresos' | 'resultado'; dinero: (v: number) => string; t: (es: string, p: string) => string; color: string; destacado?: boolean }) {
  return (
    <div style={{ background: destacado ? 'linear-gradient(135deg, #ecfdf3, #d9f5e3)' : '#fff', borderRadius: 22, padding: '16px 20px', boxShadow: '0 8px 22px rgba(31,58,95,0.09)', border: '2px solid #dcefe4' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 44 }}>{imagen}</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORES.azul }}>{titulo}</div>
          <div style={{ fontSize: 'clamp(26px, 3vw, 34px)', fontWeight: 800, color }}>{valor}</div>
        </div>
      </div>
      <Desplegable t={t}>
        {personas.map((p) => (
          <PersonaLinea key={p.empresaId} p={p} t={t}>
            <strong style={{ color }}>{dinero(p[campo])}</strong>
          </PersonaLinea>
        ))}
      </Desplegable>
    </div>
  );
}

function Tarjeta({ titulo, detalle, sabio, children }: { titulo: string; detalle?: string; sabio: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', borderRadius: 22, padding: '16px 18px', boxShadow: '0 8px 22px rgba(31,58,95,0.09)', border: '2px solid #dcefe4', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sabio} alt="" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 19, lineHeight: 1.2 }}>{titulo}</h2>
          {detalle && <div style={{ fontSize: 14, color: COLORES.gris, lineHeight: 1.3 }}>{detalle}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Fila({ emoji, texto, valor }: { emoji: string; texto: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#f5f9f7', border: '2px solid #e2efe8', borderRadius: 14, padding: '10px 14px', marginBottom: 8, fontSize: 17, fontWeight: 700 }}>
      <span>{emoji} {texto}</span>
      <span>{valor}</span>
    </div>
  );
}

function Destacado({ emoji, texto, valor, positivo }: { emoji: string; texto: string; valor: string; positivo: boolean }) {
  return (
    <div style={{ background: positivo ? 'linear-gradient(135deg, #ecfdf3, #d9f5e3)' : '#fef2f2', borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{emoji} {texto}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: positivo ? '#2e8b57' : '#dc2626' }}>{valor}</div>
    </div>
  );
}

function Desplegable({ children, t }: { children: React.ReactNode; t: (es: string, p: string) => string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} style={{ border: 'none', background: 'transparent', color: '#2e8b57', fontWeight: 800, fontSize: 16, cursor: 'pointer', padding: '4px 0' }}>
        {abierto ? '▾' : '▸'} {t('Ver por persona', 'Ver por pessoa')}
      </button>
      {abierto && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

function PersonaLinea({ p, children, t }: { p: PersonaFamilia; children: React.ReactNode; t: (es: string, p: string) => string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2px 10px', padding: '8px 0', borderTop: '1px dashed #cfe3d8', fontSize: 16 }}>
      <span style={{ fontWeight: 700 }}>👤 {p.nombre}{p.esYo ? ` (${t('yo', 'eu')})` : ''}</span>
      {children}
    </div>
  );
}

function Distribucion({ gastos, ingresos, dinero, t }: { gastos: PuntoGrafico[]; ingresos: PuntoGrafico[]; dinero: (v: number) => string; t: (es: string, p: string) => string }) {
  const [que, setQue] = useState<'gastos' | 'ingresos'>('gastos');
  const lista = participaciones(que === 'gastos' ? gastos : ingresos);
  const principales = lista.slice(0, 5);
  const resto = lista.slice(5).reduce((a, c) => a + c.valor, 0);
  const trozos = resto > 0 ? [...principales, { nombre: t('Otros', 'Outros'), valor: resto, porcentaje: Math.round((resto / lista.reduce((a, c) => a + c.valor, 0)) * 100) }] : principales;
  const total = trozos.reduce((a, c) => a + c.valor, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['gastos', 'ingresos'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setQue(k)} style={{ border: 'none', borderRadius: 999, padding: '6px 14px', fontWeight: 800, fontSize: 16, cursor: 'pointer', background: que === k ? '#2e8b57' : '#eef6f1', color: que === k ? '#fff' : COLORES.azul }}>{k === 'gastos' ? t('Gastos', 'Despesas') : t('Ingresos', 'Receitas')}</button>
        ))}
      </div>
      {trozos.length === 0 ? (
        <p style={{ fontSize: 16, color: COLORES.gris }}>{t('Todavía no hay movimientos para mostrar en este período.', 'Ainda não há movimentos para mostrar neste período.')}</p>
      ) : (
        <>
          <svg viewBox="0 0 140 140" style={{ width: '100%', maxWidth: 200, display: 'block', margin: '0 auto 10px' }} role="img" aria-label={t('Distribución por categoría', 'Distribuição por categoria')}>
            <g transform="rotate(-90 70 70)">
              {trozos.map((c, i) => {
                const largo = (c.valor / total) * C;
                const desde = acumulado;
                acumulado += largo;
                return <circle key={c.nombre} cx="70" cy="70" r={R} fill="none" stroke={PALETA[i % PALETA.length]} strokeWidth="26" strokeDasharray={`${largo} ${C - largo}`} strokeDashoffset={-desde} />;
              })}
            </g>
            <text x="70" y="78" textAnchor="middle" fontSize="26">{que === 'gastos' ? '🛒' : '💰'}</text>
          </svg>
          {trozos.map((c, i) => (
            <div key={c.nombre} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 16, padding: '3px 0' }}>
              <span><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: PALETA[i % PALETA.length], marginRight: 8 }} />{c.nombre}</span>
              <strong title={dinero(c.valor)}>{c.porcentaje}%</strong>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Evolucion({ evolucion, dinero, t }: { evolucion: PuntoEvolucion[]; dinero: (v: number) => string; t: (es: string, p: string) => string }) {
  const puntos = evolucion.filter((p) => p.ingresos !== 0 || p.egresos !== 0).slice(-12);
  const tend = tendenciaDelResultado(evolucion);
  if (puntos.length < 2) return <p style={{ fontSize: 16, color: COLORES.gris }}>{t('Con un mes más de registros se dibuja la evolución.', 'Com mais um mês de registros a evolução será desenhada.')}</p>;
  const W = 520, H = 250, ML = 16, MR = 16, MT = 24, MB = 40;
  const valores = puntos.map((p) => p.resultado);
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const rango = max - min || 1;
  const x = (i: number) => ML + (i / (puntos.length - 1)) * (W - ML - MR);
  const y = (v: number) => MT + (1 - (v - min) / rango) * (H - MT - MB);
  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.resultado).toFixed(1)}`).join(' ');
  const area = `${linea} L${x(puntos.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const ultimo = puntos[puntos.length - 1];
  const mensaje =
    tend.direccion === 'sube'
      ? `📈 ${tend.mesesSeguidos >= 2 ? t(`El resultado viene creciendo ${tend.mesesSeguidos} meses seguidos.`, `O resultado vem crescendo há ${tend.mesesSeguidos} meses seguidos.`) : t('El resultado subió contra el mes anterior.', 'O resultado subiu em relação ao mês anterior.')}`
      : tend.direccion === 'baja'
        ? `📉 ${tend.mesesSeguidos >= 2 ? t(`El resultado viene bajando ${tend.mesesSeguidos} meses seguidos.`, `O resultado vem caindo há ${tend.mesesSeguidos} meses seguidos.`) : t('El resultado bajó contra el mes anterior.', 'O resultado caiu em relação ao mês anterior.')}`
        : tend.direccion === 'estable'
          ? `➡️ ${t('El resultado se mantuvo igual que el mes anterior.', 'O resultado ficou igual ao mês anterior.')}`
          : '';
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={t('Resultado de la familia mes a mes', 'Resultado da família mês a mês')}>
        <line x1={ML} x2={W - MR} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeDasharray="4 4" />
        <path d={area} fill="#2e8b5722" />
        <path d={linea} fill="none" stroke="#2e8b57" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
        {puntos.map((p, i) => (
          <circle key={p.clave} cx={x(i)} cy={y(p.resultado)} r={i === puntos.length - 1 ? 6.5 : 4.5} fill="#fff" stroke={p.resultado >= 0 ? '#2e8b57' : '#dc2626'} strokeWidth="3" />
        ))}
        {puntos.map((p, i) => (i % Math.ceil(puntos.length / 6) === 0 || i === puntos.length - 1 ? (
          <text key={p.clave} x={x(i)} y={H - 12} textAnchor={i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle'} fontSize="16" fontWeight="700" fill="#475569">{p.clave.slice(2)}</text>
        ) : null))}
      </svg>
      <div style={{ fontSize: 16, lineHeight: 1.5 }}>
        <div>{t('Último mes', 'Último mês')} ({ultimo.clave}): <strong style={{ color: ultimo.resultado >= 0 ? '#2e8b57' : '#dc2626' }}>{dinero(ultimo.resultado)}</strong></div>
        {tend.anterior !== null && <div style={{ color: COLORES.gris }}>{t('Mes anterior', 'Mês anterior')}: {dinero(tend.anterior)}{tend.variacionPct !== null ? ` · ${tend.variacionPct >= 0 ? '+' : ''}${tend.variacionPct}%` : ''}</div>}
        {mensaje && <div style={{ marginTop: 6, fontWeight: 700 }}>{mensaje}</div>}
      </div>
    </div>
  );
}
