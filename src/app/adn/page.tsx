'use client';

// ADN DE LA EMPRESA
//
// Se entra desde el nombre de la empresa en la barra superior. Es la «pantalla
// de personaje» del negocio: al centro el logo y, alrededor, las partes que lo
// forman — tiempo de uso, herramientas, personas, evolución, logros, memoria
// del sistema — y abajo la historia de cómo se llegó hasta acá.
//
// Es SOLO uso del sistema. Los datos contables (montos, saldos, resultados)
// están en el Panel de Control y no se repiten acá. El tiempo anterior al día
// en que se empezó a medir es un estimado (ver lib/actividad.ts).

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useEnShell } from '@/components/shell/ShellContext';
import { cargarAdn, construirHistoria, fechaLocal, type DatosAdn, type EventoHistoria } from '@/lib/adn';
import { etiquetaRuta, formatearDuracion, operacionesPorMes, resumirActividad, usoPorHerramienta } from '@/lib/actividad';
import { ESCALONES, escalon, textoDelNivel } from '@/lib/nivelesTextos';
import { FAMILIAS_TROFEO } from '@/lib/trofeosRangos';

const COLORES = {
  azul: 'var(--color-primario, #1f3a5f)',
  verde: 'var(--color-secundario, #2e8b57)',
  gris: 'var(--color-acento, #6e7781)',
  blanco: '#ffffff',
};

type NodoClave = 'tiempo' | 'herramientas' | 'personas' | 'evolucion' | 'logros' | 'memoria' | 'historia';

const COLOR_NODO: Record<NodoClave, string> = {
  tiempo: '#0ea5e9',
  herramientas: '#f59e0b',
  personas: '#8b5cf6',
  evolucion: '#10b981',
  logros: '#e11d48',
  memoria: '#0d9488',
  historia: '#1f3a5f',
};

const EMOJI_NODO: Record<NodoClave, string> = { tiempo: '⏱️', herramientas: '🧰', personas: '👣', evolucion: '📈', logros: '🏆', memoria: '🧠', historia: '📜' };

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default function AdnPage() {
  const enShell = useEnShell();
  const router = useRouter();
  const [datos, setDatos] = useState<DatosAdn | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<NodoClave | null>(null);

  useEffect(() => {
    let vivo = true;
    async function cargar() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.push('/login');
        return;
      }
      const { data: perfil } = await supabase.from('perfiles').select('empresa_id, empresas(perfiles_empresa(codigo))').eq('id', u.user.id).maybeSingle();
      if (!perfil?.empresa_id) {
        if (vivo) setError('No se pudo identificar la empresa del usuario.');
        return;
      }
      const emp = perfil.empresas as unknown as { perfiles_empresa: { codigo: string } | { codigo: string }[] | null } | null;
      const rel = emp?.perfiles_empresa;
      const codigo = Array.isArray(rel) ? rel[0]?.codigo : rel?.codigo;
      try {
        const adn = await cargarAdn(perfil.empresa_id as string, codigo === 'FAMILIAR');
        if (vivo) setDatos(adn);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudo cargar el ADN de la empresa.');
      }
    }
    void cargar();
    return () => {
      vivo = false;
    };
  }, [router]);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(null);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  const idioma = datos?.empresa.idioma ?? 'ES';
  const pt = idioma === 'PT';
  const t = (es: string, p: string) => (pt ? p : es);
  const hoy = fechaLocal(new Date().toISOString());

  const calculos = useMemo(() => {
    if (!datos) return null;
    const resumen = resumirActividad(datos.actividad, hoy);
    const herramientas = usoPorHerramienta(datos.actividad);
    const meses = operacionesPorMes(datos.fechasOperaciones, hoy, 3);
    const historia = construirHistoria({ empresa: datos.empresa, momentosOperaciones: datos.momentosOperaciones, trofeos: datos.trofeos, hitos: datos.hitos, usuarios: datos.usuarios, actividad: datos.actividad, nombresNivel: datos.niveles }, idioma);
    const minutosPorDia = new Map<string, number>();
    for (const f of datos.actividad) minutosPorDia.set(f.fecha, (minutosPorDia.get(f.fecha) ?? 0) + f.segundos / 60);
    const ultimos14 = Array.from({ length: 14 }, (_, i) => {
      const fecha = sumarDias(hoy, i - 13);
      return { fecha, minutos: Math.round(minutosPorDia.get(fecha) ?? 0) };
    });
    const totalOps = datos.fechasOperaciones.length;
    return { resumen, herramientas, meses, historia, ultimos14, totalOps };
  }, [datos, hoy, idioma]);

  const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString(pt ? 'pt-BR' : 'es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });

  if (error) {
    return (
      <main style={{ padding: 24, color: COLORES.azul }}>
        <p style={{ fontWeight: 700 }}>{error}</p>
      </main>
    );
  }

  if (!datos || !calculos) {
    return (
      <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORES.azul, fontWeight: 700 }}>
        {t('Leyendo el ADN de tu empresa…', 'Lendo o DNA da sua empresa…')}
      </main>
    );
  }

  const { resumen, herramientas, meses, historia, totalOps } = calculos;
  const p = datos.progreso;
  const textoNivel = textoDelNivel(p.nivel, idioma);
  const trofeosGanados = datos.trofeos.length;
  const topHerramienta = herramientas[0] ? etiquetaRuta(herramientas[0].ruta, idioma) : null;
  const ops90 = meses.reduce((a, m) => a + m.operaciones, 0);
  const cambiosTotal = datos.cambios.reduce((a, c) => a + c.cantidad, 0);
  const titulo = datos.esFamiliar ? t('ADN de la familia', 'DNA da família') : t('ADN de la empresa', 'DNA da empresa');

  const nodos: Array<{ clave: NodoClave; titulo: string; sub: string; resumen: string }> = [
    { clave: 'tiempo', titulo: t('Tiempo de actividad', 'Tempo de atividade'), sub: t('Horas, sesiones, frecuencia', 'Horas, sessões, frequência'), resumen: `${formatearDuracion(resumen.totalSegundos, idioma)} · ${resumen.sesiones} ${t('sesiones', 'sessões')}` },
    { clave: 'herramientas', titulo: t('Herramientas favoritas', 'Ferramentas favoritas'), sub: t('Lo que más usamos', 'O que mais usamos'), resumen: topHerramienta ? `${topHerramienta.emoji} ${topHerramienta.texto}` : t('Se está midiendo', 'Em medição') },
    { clave: 'personas', titulo: t('Huella de usuarios', 'Pegada de usuários'), sub: t('Perfiles, accesos, participación', 'Perfis, acessos, participação'), resumen: `${datos.usuarios.length} ${datos.usuarios.length === 1 ? t('persona', 'pessoa') : t('personas', 'pessoas')}` },
    { clave: 'evolucion', titulo: t('Evolución', 'Evolução'), sub: t('Últimos 90 días', 'Últimos 90 dias'), resumen: `${ops90} ${t('operaciones', 'operações')}` },
    { clave: 'logros', titulo: t('Logros del negocio', 'Conquistas do negócio'), sub: t('Niveles, escalones y trofeos', 'Níveis, degraus e troféus'), resumen: `${t('Nivel', 'Nível')} ${p.nivel} · ${trofeosGanados} ${t('trofeos', 'troféus')}` },
    { clave: 'memoria', titulo: t('Memoria del sistema', 'Memória do sistema'), sub: t('Configuraciones y cambios', 'Configurações e mudanças'), resumen: `${cambiosTotal} ${t('cambios', 'mudanças')}` },
  ];
  const izquierda = nodos.slice(0, 3);
  const derecha = nodos.slice(3);

  return (
    <main style={{ minHeight: enShell ? 'auto' : '100vh', background: 'var(--fondo-app, linear-gradient(180deg, #f5f7f9 0%, #e8eff6 100%))', padding: '24px 20px 48px', color: COLORES.azul }}>
      <style>{`
        .adn-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 340px) minmax(0, 1fr); gap: 18px 36px; align-items: stretch; position: relative; }
        .adn-col { display: flex; flex-direction: column; justify-content: space-between; gap: 18px; position: relative; z-index: 1; }
        .adn-centro { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .adn-lineas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
        .adn-nodo:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgba(31,58,95,0.16); }
        @media (max-width: 860px) {
          .adn-grid { grid-template-columns: 1fr; }
          .adn-centro { order: -1; }
          .adn-lineas { display: none; }
          .adn-col { justify-content: flex-start; }
        }
        @media (max-width: 480px) { .adn-logo { width: 150px !important; height: 150px !important; } }
      `}</style>

      <header style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.4, textTransform: 'uppercase', color: COLORES.gris }}>🧬 {titulo}</div>
        <h1 style={{ margin: '6px 0 4px', fontSize: 'clamp(24px, 4vw, 36px)', lineHeight: 1.1 }}>{datos.empresa.nombre}</h1>
        <p style={{ margin: 0, color: COLORES.gris, fontSize: 15 }}>{t('Tu historia, tu uso, tu evolución en el sistema', 'Sua história, seu uso, sua evolução no sistema')}</p>
      </header>

      <div className="adn-grid">
        <svg className="adn-lineas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {[16, 50, 84].map((y) => (
            <g key={y}>
              <line x1="22" y1={y} x2="40" y2="46" stroke="#9db4cc" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              <line x1="78" y1={y} x2="60" y2="46" stroke="#9db4cc" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </svg>

        <div className="adn-col">{izquierda.map((n) => <Nodo key={n.clave} {...n} onClick={() => setAbierto(n.clave)} />)}</div>

        <div className="adn-centro">
          <div className="adn-logo" style={{ width: 200, height: 200, borderRadius: '50%', background: '#fff', border: `6px solid ${COLORES.verde}`, boxShadow: '0 0 0 10px rgba(46,139,87,0.14), 0 18px 40px rgba(31,58,95,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {datos.empresa.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={datos.empresa.logoUrl} alt={datos.empresa.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 14 }} />
            ) : (
              <span style={{ fontSize: 84, fontWeight: 800, color: COLORES.azul }}>{datos.empresa.nombre.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div aria-hidden style={{ width: 250, height: 22, marginTop: -4, borderRadius: '50%', background: 'linear-gradient(180deg, #cfd8e3, #aebccd)', boxShadow: '0 6px 0 #94a6bb' }} />
          <div aria-hidden style={{ width: 310, height: 26, marginTop: 6, borderRadius: '50%', background: 'linear-gradient(180deg, #dbe3ec, #b7c5d6)', boxShadow: '0 7px 0 #9fb0c5' }} />
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 30 }}>{p.emoji}</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{t('Nivel', 'Nível')} {p.nivel} · {p.nombre}</div>
            <div style={{ fontSize: 13, color: COLORES.gris, marginTop: 2 }}>{p.operaciones} {t('operaciones registradas', 'operações registradas')}</div>
          </div>
        </div>

        <div className="adn-col">{derecha.map((n) => <Nodo key={n.clave} {...n} onClick={() => setAbierto(n.clave)} />)}</div>
      </div>

      <section style={{ marginTop: 28 }}>
        <button type="button" className="adn-nodo" onClick={() => setAbierto('historia')} style={{ ...estiloTarjeta(COLOR_NODO.historia), width: '100%', textAlign: 'left', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 26 }}>{EMOJI_NODO.historia}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, textTransform: 'uppercase', letterSpacing: 1 }}>{t('Nuestra historia', 'Nossa história')}</div>
              <div style={{ fontSize: 13, color: COLORES.gris }}>{t('Línea de tiempo de cómo construimos nuestro sistema', 'Linha do tempo de como construímos nosso sistema')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6 }}>
            {historia.slice(-6).map((e) => (
              <div key={e.clave} style={{ minWidth: 150, flex: '0 0 auto', borderTop: `3px solid ${COLOR_NODO.historia}`, paddingTop: 8 }}>
                <div style={{ fontSize: 22 }}>{e.emoji}</div>
                <div style={{ fontSize: 12, color: COLORES.gris }}>{fechaCorta(e.fecha)}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{e.titulo}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: COLORES.gris, marginTop: 8 }}>{t('Tocá para ver toda la historia', 'Toque para ver toda a história')} · {historia.length} {t('hitos', 'marcos')}</div>
        </button>
      </section>

      <p style={{ textAlign: 'center', color: COLORES.gris, fontSize: 12, marginTop: 22 }}>
        {t('Acá solo se ve el uso del sistema. Los números del negocio están en el Panel de Control.', 'Aqui só aparece o uso do sistema. Os números do negócio estão no Painel de Controle.')} {totalOps === 0 ? t('Cargá tu primera operación para empezar a escribir tu historia.', 'Lance sua primeira operação para começar a escrever sua história.') : ''}
      </p>

      {abierto && (
        <div role="dialog" aria-modal="true" onClick={() => setAbierto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 22, maxWidth: 720, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: '22px 22px 26px', borderTop: `8px solid ${COLOR_NODO[abierto]}`, boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 21 }}>{EMOJI_NODO[abierto]} {abierto === 'historia' ? t('Nuestra historia', 'Nossa história') : nodos.find((n) => n.clave === abierto)?.titulo}</h2>
              <button type="button" onClick={() => setAbierto(null)} aria-label={t('Cerrar', 'Fechar')} style={{ border: 'none', background: '#eef2f7', borderRadius: 999, width: 36, height: 36, fontSize: 18, cursor: 'pointer', color: COLORES.azul }}>✕</button>
            </div>
            {abierto === 'tiempo' && <DetalleTiempo datos={datos} calculos={calculos} t={t} fechaCorta={fechaCorta} />}
            {abierto === 'herramientas' && <DetalleHerramientas datos={datos} calculos={calculos} t={t} />}
            {abierto === 'personas' && <DetallePersonas datos={datos} t={t} fechaCorta={fechaCorta} />}
            {abierto === 'evolucion' && <DetalleEvolucion datos={datos} calculos={calculos} t={t} />}
            {abierto === 'logros' && <DetalleLogros datos={datos} textoNivel={textoNivel} t={t} fechaCorta={fechaCorta} />}
            {abierto === 'memoria' && <DetalleMemoria datos={datos} t={t} fechaCorta={fechaCorta} />}
            {abierto === 'historia' && <DetalleHistoria historia={historia} fechaCorta={fechaCorta} />}
          </div>
        </div>
      )}
    </main>
  );
}

function estiloTarjeta(color: string): React.CSSProperties {
  return { background: '#fff', borderRadius: 20, padding: '16px 18px', border: `2px solid ${color}33`, borderLeft: `6px solid ${color}`, boxShadow: '0 6px 18px rgba(31,58,95,0.08)', color: COLORES.azul };
}

function Nodo({ clave, titulo, sub, resumen, onClick }: { clave: NodoClave; titulo: string; sub: string; resumen: string; onClick: () => void }) {
  return (
    <button type="button" className="adn-nodo" onClick={onClick} style={{ ...estiloTarjeta(COLOR_NODO[clave]), textAlign: 'left', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s', display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 54, height: 54, flexShrink: 0, borderRadius: 16, background: `${COLOR_NODO[clave]}1f`, border: `2px solid ${COLOR_NODO[clave]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{EMOJI_NODO[clave]}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.6 }}>{titulo}</span>
        <span style={{ display: 'block', fontSize: 12, color: COLORES.gris, margin: '2px 0 6px' }}>{sub}</span>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: COLOR_NODO[clave] }}>{resumen}</span>
      </span>
    </button>
  );
}

type Tr = (es: string, pt: string) => string;
type Calculos = {
  resumen: ReturnType<typeof resumirActividad>;
  herramientas: ReturnType<typeof usoPorHerramienta>;
  meses: ReturnType<typeof operacionesPorMes>;
  historia: EventoHistoria[];
  ultimos14: Array<{ fecha: string; minutos: number }>;
  totalOps: number;
};

const bloque: React.CSSProperties = { background: '#f5f7f9', borderRadius: 14, padding: '12px 14px', marginBottom: 12 };
const subtitulo: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: COLORES.gris, margin: '16px 0 8px' };

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div style={{ ...bloque, flex: '1 1 130px', marginBottom: 0, textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: 22 }}>{valor}</div>
      <div style={{ fontSize: 12, color: COLORES.gris }}>{etiqueta}</div>
    </div>
  );
}

function Barra({ proporcion, color, alto = 10 }: { proporcion: number; color: string; alto?: number }) {
  return (
    <div style={{ background: '#e5eaf0', borderRadius: 999, height: alto, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, proporcion)) * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  );
}

function DetalleTiempo({ datos, calculos, t, fechaCorta }: { datos: DatosAdn; calculos: Calculos; t: Tr; fechaCorta: (iso: string) => string }) {
  const r = calculos.resumen;
  const idioma = datos.empresa.idioma;
  const maximo = Math.max(1, ...calculos.ultimos14.map((d) => d.minutos));
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Dato valor={formatearDuracion(r.totalSegundos, idioma)} etiqueta={t('de uso total', 'de uso total')} />
        <Dato valor={String(r.sesiones)} etiqueta={t('sesiones', 'sessões')} />
        <Dato valor={String(r.diasActivos)} etiqueta={t('días activos', 'dias ativos')} />
        <Dato valor={`${r.rachaActual} / ${r.mejorRacha}`} etiqueta={t('racha actual / mejor', 'sequência atual / melhor')} />
      </div>
      <div style={subtitulo}>{t('Últimos 14 días (minutos por día)', 'Últimos 14 dias (minutos por dia)')}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
        {calculos.ultimos14.map((d) => (
          <div key={d.fecha} title={`${d.fecha}: ${d.minutos} min`} style={{ flex: 1, height: `${Math.max(3, (d.minutos / maximo) * 100)}%`, background: d.minutos > 0 ? COLOR_NODO.tiempo : '#e5eaf0', borderRadius: 6 }} />
        ))}
      </div>
      <div style={{ ...bloque, marginTop: 14, fontSize: 13, lineHeight: 1.5 }}>
        {r.medidoDesde ? (
          <>
            ⏱️ {t(`El tiempo se mide con exactitud desde el ${fechaCorta(`${r.medidoDesde}T12:00:00Z`)}: ${formatearDuracion(r.medidoSegundos, idioma)}.`, `O tempo é medido com exatidão desde ${fechaCorta(`${r.medidoDesde}T12:00:00Z`)}: ${formatearDuracion(r.medidoSegundos, idioma)}.`)}{' '}
          </>
        ) : null}
        {r.estimadoSegundos > 0 &&
          t(`Lo anterior (${formatearDuracion(r.estimadoSegundos, idioma)}) es una estimación según tus operaciones, tu nivel y tus ingresos al sistema.`, `O anterior (${formatearDuracion(r.estimadoSegundos, idioma)}) é uma estimativa conforme suas operações, seu nível e seus acessos ao sistema.`)}
      </div>
    </>
  );
}

function DetalleHerramientas({ datos, calculos, t }: { datos: DatosAdn; calculos: Calculos; t: Tr }) {
  const idioma = datos.empresa.idioma;
  const top = calculos.herramientas.slice(0, 7);
  const maxSeg = Math.max(1, top[0]?.segundos ?? 1);
  const maxMov = Math.max(1, datos.cuentas[0]?.movimientos ?? 1);
  return (
    <>
      <div style={subtitulo}>{t('Dónde pasamos el tiempo', 'Onde passamos o tempo')}</div>
      {top.length === 0 && <p style={{ color: COLORES.gris }}>{t('Todavía no hay datos de uso.', 'Ainda não há dados de uso.')}</p>}
      {top.map((h) => {
        const e = etiquetaRuta(h.ruta, idioma);
        return (
          <div key={h.ruta} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              <span>{e.emoji} {e.texto}</span>
              <span style={{ color: COLORES.gris }}>{formatearDuracion(h.segundos, idioma)}</span>
            </div>
            <Barra proporcion={h.segundos / maxSeg} color={COLOR_NODO.herramientas} />
          </div>
        );
      })}
      <div style={subtitulo}>{t('Cuentas que más se mueven (90 días)', 'Contas que mais se movimentam (90 dias)')}</div>
      {datos.cuentas.length === 0 && <p style={{ color: COLORES.gris }}>{t('Todavía no hay movimientos en los últimos 90 días.', 'Ainda não há movimentos nos últimos 90 dias.')}</p>}
      {datos.cuentas.map((c) => (
        <div key={c.cuenta} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            <span>{c.cuenta}</span>
            <span style={{ color: COLORES.gris }}>{c.movimientos} {t('movimientos', 'movimentos')}</span>
          </div>
          <Barra proporcion={c.movimientos / maxMov} color={COLOR_NODO.evolucion} />
        </div>
      ))}
      <p style={{ fontSize: 12, color: COLORES.gris }}>{t('Se cuentan movimientos, no importes: los saldos están en el Panel de Control.', 'São contados movimentos, não valores: os saldos estão no Painel de Controle.')}</p>
    </>
  );
}

function DetallePersonas({ datos, t, fechaCorta }: { datos: DatosAdn; t: Tr; fechaCorta: (iso: string) => string }) {
  const totalOps = datos.usuarios.reduce((a, u) => a + u.operaciones, 0);
  const ordenados = [...datos.usuarios].sort((a, b) => b.operaciones - a.operaciones || b.accesos - a.accesos);
  return (
    <>
      {ordenados.map((u) => (
        <div key={u.id} style={bloque}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong>{u.nombre}</strong>
            <span style={{ fontSize: 12, color: COLORES.gris }}>{u.tipoUsuario ?? '—'}{u.activo ? '' : ` · ${t('inactivo', 'inativo')}`}</span>
          </div>
          <div style={{ fontSize: 13, color: COLORES.gris, margin: '4px 0 8px' }}>
            {t('Último acceso', 'Último acesso')}: {u.ultimoAcceso ? fechaCorta(u.ultimoAcceso) : '—'} · {u.accesos} {t('accesos', 'acessos')} · {u.operaciones} {t('operaciones cargadas', 'operações lançadas')}
          </div>
          <Barra proporcion={totalOps > 0 ? u.operaciones / totalOps : 0} color={COLOR_NODO.personas} />
          <div style={{ fontSize: 12, color: COLORES.gris, marginTop: 4 }}>{totalOps > 0 ? Math.round((u.operaciones / totalOps) * 100) : 0}% {t('de las operaciones del equipo', 'das operações da equipe')}</div>
        </div>
      ))}
      <p style={{ fontSize: 12, color: COLORES.gris }}>{t('La participación cuenta las operaciones cargadas desde que se guarda quién las hace.', 'A participação conta as operações lançadas desde que se registra quem as faz.')}</p>
    </>
  );
}

function DetalleEvolucion({ datos, calculos, t }: { datos: DatosAdn; calculos: Calculos; t: Tr }) {
  const idioma = datos.empresa.idioma;
  const maximo = Math.max(1, ...calculos.meses.map((m) => m.operaciones));
  const nombreMes = (clave: string) => new Date(`${clave}-15T12:00:00Z`).toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR', { month: 'long', timeZone: 'UTC' });
  const horasMes = (clave: string) => datos.actividad.filter((f) => f.fecha.startsWith(clave)).reduce((a, f) => a + f.segundos, 0);
  const actual = calculos.meses[calculos.meses.length - 1];
  const anterior = calculos.meses[calculos.meses.length - 2];
  const variacion = anterior && anterior.operaciones > 0 ? Math.round(((actual.operaciones - anterior.operaciones) / anterior.operaciones) * 100) : null;
  return (
    <>
      <div style={subtitulo}>{t('Operaciones cargadas por mes', 'Operações lançadas por mês')}</div>
      {calculos.meses.map((m) => (
        <div key={m.mes} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, marginBottom: 4, textTransform: 'capitalize' }}>
            <span>{nombreMes(m.mes)}</span>
            <span style={{ color: COLORES.gris, textTransform: 'none' }}>{m.operaciones} {t('operaciones', 'operações')} · {m.diasConOperaciones} {t('días con registros', 'dias com registros')} · {formatearDuracion(horasMes(m.mes), idioma)}</span>
          </div>
          <Barra proporcion={m.operaciones / maximo} color={COLOR_NODO.evolucion} alto={14} />
        </div>
      ))}
      <div style={{ ...bloque, fontSize: 14 }}>
        {variacion === null ? t('Todavía no hay un mes anterior para comparar.', 'Ainda não há um mês anterior para comparar.') : variacion >= 0 ? `📈 ${t(`Este mes llevás un ${variacion}% más de operaciones que el anterior.`, `Este mês você tem ${variacion}% mais operações que o anterior.`)}` : `📉 ${t(`Este mes llevás un ${Math.abs(variacion)}% menos de operaciones que el anterior (el mes todavía no terminó).`, `Este mês você tem ${Math.abs(variacion)}% menos operações que o anterior (o mês ainda não terminou).`)}`}
      </div>
      <p style={{ fontSize: 12, color: COLORES.gris }}>{t('Es ritmo de uso (cantidad de registros). Los ingresos y egresos en plata están en el Panel de Control.', 'É o ritmo de uso (quantidade de registros). As receitas e despesas em dinheiro estão no Painel de Controle.')}</p>
    </>
  );
}

function DetalleLogros({ datos, textoNivel, t, fechaCorta }: { datos: DatosAdn; textoNivel: ReturnType<typeof textoDelNivel>; t: Tr; fechaCorta: (iso: string) => string }) {
  const idioma = datos.empresa.idioma;
  const p = datos.progreso;
  const [nivelVisto, setNivelVisto] = useState(p.nivel);
  const textoVisto = textoDelNivel(nivelVisto, idioma);
  const infoVisto = datos.niveles[nivelVisto];
  const medallas = datos.hitos.filter((h) => h.nivel === p.nivel);
  const pct = p.operacionesMax ? Math.round(((p.operaciones - p.operacionesMin) / (p.operacionesMax + 1 - p.operacionesMin)) * 100) : 100;
  return (
    <>
      <div style={{ ...bloque, background: '#fff1f2' }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{p.emoji} {t('Nivel', 'Nível')} {p.nivel} · {p.nombre}</div>
        <div style={{ margin: '8px 0' }}><Barra proporcion={pct / 100} color={COLOR_NODO.logros} alto={12} /></div>
        <div style={{ fontSize: 13, color: COLORES.gris }}>{p.operacionesMax ? `${p.faltan} ${t('operaciones para el próximo nivel', 'operações para o próximo nível')}` : t('Llegaste al último nivel', 'Você chegou ao último nível')}</div>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5 }}>{textoNivel.etapa}</p>
      </div>

      <div style={subtitulo}>{t('El camino de los 10 niveles (tocá uno para leerlo)', 'O caminho dos 10 níveis (toque em um para ler)')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" onClick={() => setNivelVisto(n)} title={datos.niveles[n]?.nombre} style={{ width: 46, height: 46, borderRadius: 14, border: n === nivelVisto ? `3px solid ${COLOR_NODO.logros}` : '2px solid #d6dde6', background: n <= p.nivel ? '#fff1f2' : '#f5f7f9', opacity: n <= p.nivel ? 1 : 0.6, cursor: 'pointer', fontSize: 20 }}>{datos.niveles[n]?.emoji ?? n}</button>
        ))}
      </div>
      <div style={bloque}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>{infoVisto?.emoji} {t('Nivel', 'Nível')} {nivelVisto} · {infoVisto?.nombre}{nivelVisto > p.nivel ? ` 🔒` : ''}</div>
        <div style={{ fontSize: 13, color: COLORES.gris, marginBottom: 8 }}>{infoVisto?.mision} — {infoVisto?.mensaje}</div>
        <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5 }}><strong>{t('La etapa', 'A etapa')}:</strong> {textoVisto.etapa}</p>
        <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5 }}><strong>{t('Qué significa', 'O que significa')}:</strong> {textoVisto.significa}</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}><strong>{t('Para seguir', 'Para continuar')}:</strong> {textoVisto.consejo}</p>
      </div>

      <div style={subtitulo}>{t('Escalones de este nivel', 'Degraus deste nível')}</div>
      {datos.escalonados.length === 0 && <p style={{ color: COLORES.gris }}>{t('Sin objetivos escalonados por ahora.', 'Sem objetivos escalonados por enquanto.')}</p>}
      {datos.escalonados.map((o) => (
        <div key={o.tipo} style={bloque}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{o.emoji} {idioma === 'PT' ? o.nombrePT : o.nombre} · {o.conteo}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {o.checkpoints.map((c, i) => {
              const hecho = o.conteo >= c;
              const e = escalon(i);
              return (
                <div key={c} title={idioma === 'PT' ? e.ptDetalle : e.esDetalle} style={{ flex: '1 1 160px', background: hecho ? '#dcfce7' : '#fff', border: `2px solid ${hecho ? '#16a34a' : '#d6dde6'}`, borderRadius: 12, padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{e.emoji} {idioma === 'PT' ? e.pt : e.es}</div>
                  <div style={{ fontSize: 13, color: COLORES.gris }}>{hecho ? '✅' : `${Math.min(o.conteo, c)}/${c}`} {hecho ? `(${c})` : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p style={{ fontSize: 12, color: COLORES.gris, marginTop: 4 }}>{ESCALONES.map((e) => `${e.emoji} ${idioma === 'PT' ? e.ptDetalle : e.esDetalle}`).join(' ')}</p>

      <div style={subtitulo}>{t('Medallas de este nivel', 'Medalhas deste nível')}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['BRONCE', 'PLATA', 'ORO'] as const).map((tier) => {
          const m = medallas.find((x) => x.tipo === tier);
          return (
            <div key={tier} style={{ ...bloque, marginBottom: 0, flex: '1 1 130px', textAlign: 'center', opacity: m ? 1 : 0.5 }}>
              <div style={{ fontSize: 26 }}>{tier === 'ORO' ? '🥇' : tier === 'PLATA' ? '🥈' : '🥉'}</div>
              <div style={{ fontSize: 12, color: COLORES.gris }}>{m ? fechaCorta(m.vistoEn) : t('Pendiente', 'Pendente')}</div>
            </div>
          );
        })}
      </div>

      <div style={subtitulo}>{t('Trofeos ganados', 'Troféus ganhos')} ({datos.trofeos.length})</div>
      {datos.trofeos.length === 0 && <p style={{ color: COLORES.gris }}>{t('Todavía no ganaste trofeos: se obtienen sumando operaciones de cada tipo.', 'Você ainda não ganhou troféus: eles vêm somando operações de cada tipo.')}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[...datos.trofeos].sort((a, b) => b.obtenidoEn.localeCompare(a.obtenidoEn)).slice(0, 12).map((tr) => {
          const rango = FAMILIAS_TROFEO[tr.tipo]?.rangos[tr.rango];
          return (
            <div key={`${tr.tipo}-${tr.rango}-${tr.tier}`} style={{ background: rango?.estilo.fondo ?? '#fff', border: `2px solid ${rango?.estilo.borde ?? '#d6dde6'}`, borderRadius: 12, padding: '8px 12px', fontSize: 13 }}>
              {rango?.emblema} <strong>{idioma === 'PT' ? rango?.nombrePT : rango?.nombre}</strong> · {tr.tier === 'ORO' ? '🥇' : tr.tier === 'PLATA' ? '🥈' : '🥉'}
              <div style={{ fontSize: 11, color: COLORES.gris }}>{fechaCorta(tr.obtenidoEn)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const NOMBRE_CAMBIO: Record<string, { es: string; pt: string; emoji: string }> = {
  cuenta_creada: { es: 'Cuentas creadas', pt: 'Contas criadas', emoji: '➕' },
  cuenta_editada: { es: 'Cuentas editadas', pt: 'Contas editadas', emoji: '✏️' },
  cuenta_eliminada: { es: 'Cuentas eliminadas', pt: 'Contas excluídas', emoji: '🗑️' },
  regla_contable_creada: { es: 'Reglas creadas', pt: 'Regras criadas', emoji: '🧩' },
  regla_contable_editada: { es: 'Reglas ajustadas', pt: 'Regras ajustadas', emoji: '🔧' },
  regla_contable_eliminada: { es: 'Reglas eliminadas', pt: 'Regras excluídas', emoji: '🗑️' },
  operacion_editada: { es: 'Operaciones corregidas', pt: 'Operações corrigidas', emoji: '🩹' },
  operacion_eliminada: { es: 'Operaciones eliminadas', pt: 'Operações excluídas', emoji: '🧹' },
  invitacion_creada: { es: 'Invitaciones al equipo', pt: 'Convites à equipe', emoji: '✉️' },
  consentimiento_aceptado: { es: 'Consentimientos aceptados', pt: 'Consentimentos aceitos', emoji: '🤝' },
};

function DetalleMemoria({ datos, t, fechaCorta }: { datos: DatosAdn; t: Tr; fechaCorta: (iso: string) => string }) {
  const idioma = datos.empresa.idioma;
  const ordenados = [...datos.cambios].sort((a, b) => b.cantidad - a.cantidad);
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Dato valor={datos.empresa.onboardingCompletado ? '✅' : '⏳'} etiqueta={t('puesta en marcha', 'configuração inicial')} />
        <Dato valor={datos.empresa.matrizGenerada ? '✅' : '⏳'} etiqueta={t('matriz de operaciones', 'matriz de operações')} />
        <Dato valor={fechaCorta(datos.empresa.creadoEn)} etiqueta={t('alta en el sistema', 'cadastro no sistema')} />
      </div>
      <div style={subtitulo}>{t('Lo que fuimos ajustando', 'O que fomos ajustando')}</div>
      {ordenados.length === 0 && <p style={{ color: COLORES.gris }}>{t('Todavía no hay cambios de configuración registrados.', 'Ainda não há mudanças de configuração registradas.')}</p>}
      {ordenados.map((c) => {
        const n = NOMBRE_CAMBIO[c.tipo] ?? { es: c.tipo, pt: c.tipo, emoji: '🔹' };
        return (
          <div key={c.tipo} style={bloque}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>{n.emoji} {idioma === 'PT' ? n.pt : n.es}</span>
              <span>{c.cantidad}</span>
            </div>
            <div style={{ fontSize: 12, color: COLORES.gris }}>{t('Primera vez', 'Primeira vez')}: {fechaCorta(c.primero)} · {t('última', 'última')}: {fechaCorta(c.ultimo)}</div>
          </div>
        );
      })}
    </>
  );
}

function DetalleHistoria({ historia, fechaCorta }: { historia: EventoHistoria[]; fechaCorta: (iso: string) => string }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 22, borderLeft: `3px solid ${COLOR_NODO.historia}33` }}>
      {[...historia].reverse().map((e) => (
        <div key={e.clave} style={{ position: 'relative', marginBottom: 16 }}>
          <span style={{ position: 'absolute', left: -38, top: 0, width: 30, height: 30, borderRadius: '50%', background: '#fff', border: `2px solid ${COLOR_NODO.historia}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{e.emoji}</span>
          <div style={{ fontSize: 12, color: COLORES.gris }}>{fechaCorta(e.fecha)}</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{e.titulo}</div>
          {e.detalle && <div style={{ fontSize: 13, color: COLORES.gris }}>{e.detalle}</div>}
        </div>
      ))}
    </div>
  );
}
