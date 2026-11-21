'use client';

import { useState } from 'react';
import { conversacionComoTexto, type Conversacion } from '@/lib/informes/conversacion';
import type { VersionGuardada } from '@/lib/informes/interpretacionHistorial';
import { EstiloImpresion } from './DreVisual';

// Informes → Interpretación: el Sabio conversa con la persona sobre el mes. A la izquierda Sabio, a la derecha el relato:
// saludo, qué pasó, cómo se llegó, tendencia, recomendaciones y un resumen. Texto armado por reglas con las cifras de los informes.

const COL = { azul: 'var(--color-primario, #1f3a5f)', verde: 'var(--color-secundario, #2e7d4f)', gris: '#6b7280' };

const SABIO_POR_TONO = { bien: 'sabio-hoodie-medalla', atencion: 'sabio-hoodie-libro', neutro: 'sabio-hoodie-checklist' } as const;

// **texto** → negrita en el color del Sabio.
function conMarcas(texto: string) {
  return texto.split('**').map((parte, i) => (i % 2 === 1 ? <strong key={i} style={{ color: '#15803d' }}>{parte}</strong> : <span key={i}>{parte}</span>));
}

const fechaCorta = (iso: string, pt: boolean) => new Date(iso).toLocaleString(pt ? 'pt-BR' : 'es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export type EstadoVista = { tipo: 'vivo' | 'guardada' | 'historial'; version?: number; generadoEn?: string; hayCambios?: boolean; periodoEtiqueta?: string };

export function InterpretacionVisual({
  conversacion,
  estado,
  empresa,
  periodos,
  periodo,
  onPeriodo,
  onGenerar,
  generando,
  guardado,
  historial,
  etiquetaDe,
  onVerVersion,
  onVolver,
  pt,
  etiquetaPeriodo,
}: {
  conversacion: Conversacion;
  estado: EstadoVista;
  empresa: string;
  periodos: { valor: string; etiqueta: string }[];
  periodo: string;
  onPeriodo: (v: string) => void;
  onGenerar: () => void;
  generando: boolean;
  guardado: boolean;
  historial: VersionGuardada[];
  etiquetaDe: (clave: string) => string;
  onVerVersion: (id: string) => void;
  onVolver: () => void;
  pt: boolean;
  etiquetaPeriodo: string;
}) {
  const [verDetalle, setVerDetalle] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const [menuCompartir, setMenuCompartir] = useState(false);
  const [aviso, setAviso] = useState('');
  const texto = () => conversacionComoTexto(`${pt ? 'Interpretação' : 'Interpretación'} — ${empresa} — ${estado.periodoEtiqueta ?? etiquetaPeriodo}`, conversacion);

  const avisar = (m: string) => { setAviso(m); setTimeout(() => setAviso(''), 2200); };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto()); avisar(pt ? '✓ Texto copiado' : '✓ Texto copiado'); } catch { avisar(pt ? 'Não foi possível copiar' : 'No se pudo copiar'); }
    setMenuCompartir(false);
  };
  const compartirNativo = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { await navigator.share({ title: pt ? 'Interpretação' : 'Interpretación', text: texto() }); } catch { /* cancelado */ }
      setMenuCompartir(false);
    } else void copiar();
  };
  const imprimir = () => { setVerDetalle(true); setTimeout(() => window.print(), 150); };

  const boton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #d1d5db', background: '#fff', color: '#1f3a5f', borderRadius: 14, padding: '10px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 6px rgba(15,23,42,0.06)' };
  const sabio = SABIO_POR_TONO[conversacion.tono];

  return (
    <div>
      <EstiloImpresion />

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden style={{ width: 54, height: 54, borderRadius: 18, background: 'linear-gradient(135deg, #2563eb, #22a559)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>💬</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 30, color: COL.azul, lineHeight: 1.1 }}>{pt ? 'Interpretação' : 'Interpretación'}</h2>
            <div style={{ color: COL.azul, fontWeight: 600 }}>{pt ? 'Converse com o Sabio' : 'Conversá con el Sabio'}</div>
          </div>
        </div>
        <p style={{ margin: 0, flex: '1 1 260px', color: COL.gris, fontSize: 14, borderLeft: '2px solid #d1d5db', paddingLeft: 14 }}>
          {pt ? 'Uma análise clara e personalizada dos seus resultados, com contexto, tendências e recomendações.' : 'Un análisis claro y personalizado de tus resultados, con contexto, tendencias y recomendaciones.'}
        </p>
      </div>

      {/* Filtros */}
      <div className="dre-no-imprimir" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ ...boton, cursor: 'default' }}>🏢 <span style={{ color: COL.gris, fontWeight: 600 }}>{pt ? 'Cliente:' : 'Cliente:'}</span> {empresa}</div>
        <label style={{ ...boton, cursor: 'pointer' }}>
          📅 <span style={{ color: COL.gris, fontWeight: 600 }}>{pt ? 'Período:' : 'Período:'}</span>
          <select value={periodo} onChange={(e) => onPeriodo(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 14, color: COL.azul, cursor: 'pointer' }}>
            {periodos.map((x) => (
              <option key={x.valor} value={x.valor}>{x.etiqueta}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onGenerar} disabled={generando} style={{ ...boton, marginLeft: 'auto', background: 'linear-gradient(135deg, #15803d, #22a559)', color: '#fff', border: 'none', opacity: generando ? 0.7 : 1 }}>
          ✨ {generando ? (pt ? 'Gerando…' : 'Generando…') : estado.tipo === 'vivo' ? (pt ? 'Gerar interpretação' : 'Generar interpretación') : pt ? 'Gerar de novo' : 'Generar de nuevo'}
        </button>
      </div>

      {/* Estado de la versión que se ve */}
      {estado.tipo === 'historial' && (
        <div className="dre-no-imprimir" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', borderRadius: 14, padding: '10px 14px', marginBottom: 12, fontSize: 13.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          🕘 {pt ? `Você está vendo a versão ${estado.version} de ${estado.periodoEtiqueta}, gerada em ${fechaCorta(estado.generadoEn ?? '', pt)}.` : `Estás viendo la versión ${estado.version} de ${estado.periodoEtiqueta}, generada el ${fechaCorta(estado.generadoEn ?? '', pt)}.`}
          <button type="button" onClick={onVolver} style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 800, cursor: 'pointer' }}>{pt ? 'Voltar à atual ›' : 'Volver a la actual ›'}</button>
        </div>
      )}
      {estado.tipo === 'guardada' && estado.hayCambios && (
        <div className="dre-no-imprimir" style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#78350f', borderRadius: 14, padding: '10px 14px', marginBottom: 12, fontSize: 13.5 }}>
          ⚠️ {pt ? 'Há movimentos novos desde que esta interpretação foi gerada. Toque em «Gerar de novo» para atualizá-la.' : 'Hay movimientos nuevos desde que se generó esta interpretación. Tocá «Generar de nuevo» para actualizarla.'}
        </div>
      )}
      {estado.tipo === 'guardada' && !estado.hayCambios && estado.generadoEn && (
        <div className="dre-no-imprimir" style={{ color: COL.gris, fontSize: 12.5, marginBottom: 10 }}>
          🕒 {pt ? `Interpretação gerada em ${fechaCorta(estado.generadoEn, pt)} (versão ${estado.version}) — está em dia com seus números.` : `Interpretación generada el ${fechaCorta(estado.generadoEn, pt)} (versión ${estado.version}) — está al día con tus números.`}
        </div>
      )}
      {estado.tipo === 'vivo' && !guardado && (
        <div className="dre-no-imprimir" style={{ color: COL.gris, fontSize: 12.5, marginBottom: 10 }}>
          {pt ? 'Este perfil só visualiza: a interpretação aparece, mas não fica no histórico.' : 'Este perfil solo mira: la interpretación se ve, pero no queda en el historial.'}
        </div>
      )}

      {/* Sabio + relato */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 250px', maxWidth: '100%', display: 'grid', gap: 10, justifyItems: 'center' }} className="dre-sabio-tarjeta">
          <img src={`/sabio/${sabio}.webp`} alt="Sabio" style={{ width: 230, maxWidth: '100%', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 10px 14px rgba(15,23,42,0.18))' }} />
          <div style={{ background: 'linear-gradient(180deg, #f0fdf4, #fff)', border: '1px solid #bbf7d0', borderRadius: 18, padding: '10px 18px', textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: COL.azul }}>Sabio</div>
            <div style={{ fontSize: 13.5, color: COL.azul }}>{pt ? 'Seu consultor financeiro' : 'Tu consultor financiero'}</div>
            <div style={{ height: 4, width: 70, background: '#22c55e', borderRadius: 99, margin: '6px auto 0' }} />
          </div>
        </div>

        <div style={{ flex: '1 1 420px', minWidth: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 22, padding: 16 }}>
          <div style={{ background: 'linear-gradient(135deg, #dcfce7, #ecfdf5)', border: '1px solid #bbf7d0', borderRadius: 16, padding: '12px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#14532d' }}>{conversacion.saludo.titulo}</div>
            <div style={{ fontSize: 16, color: '#14532d', lineHeight: 1.45 }}>{conversacion.saludo.texto}</div>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {conversacion.bloques.map((b) => (
              <div key={b.clave} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span aria-hidden style={{ fontSize: 30, width: 40, textAlign: 'center', flexShrink: 0 }}>{b.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  {b.titulo && <div style={{ fontSize: 18, fontWeight: 800, color: COL.azul, marginBottom: 3 }}>{b.titulo}</div>}
                  {b.parrafos.map((p, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0', fontSize: 15.5, lineHeight: 1.6, color: '#1f2937' }}>{conMarcas(p)}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {conversacion.resumen && (
            <div style={{ marginTop: 16, background: 'linear-gradient(135deg, #dcfce7, #f0fdf4)', border: '1px solid #86efac', borderRadius: 16, padding: '12px 16px', fontSize: 16, lineHeight: 1.5, color: '#14532d' }}>
              🎯 {conMarcas(conversacion.resumen)}
            </div>
          )}
        </div>
      </div>

      {/* Detalle por informe (opcional) */}
      {conversacion.detalle.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <button type="button" className="dre-no-imprimir" onClick={() => setVerDetalle((v) => !v)} style={{ ...boton, boxShadow: 'none' }}>
            {verDetalle ? '▾' : '▸'} {pt ? 'Ver o detalhe por relatório' : 'Ver el detalle por informe'}
          </button>
          {verDetalle && (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {conversacion.detalle.map((s) => (
                <div key={s.clave} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderLeft: `5px solid ${s.tono === 'bien' ? '#22c55e' : s.tono === 'atencion' ? '#f59e0b' : '#60a5fa'}`, borderRadius: 14, padding: '10px 14px' }}>
                  <div style={{ fontWeight: 800, color: COL.azul, marginBottom: 4 }}>{s.titulo}</div>
                  {s.lineas.map((l, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : '4px 0 0', fontSize: 14, lineHeight: 1.5, color: '#374151' }}>{i === 0 ? '' : '• '}{l}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="dre-no-imprimir" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16, position: 'relative', alignItems: 'center' }}>
        <button type="button" style={boton} onClick={() => setVerHistorial((v) => !v)}>🕘 {pt ? 'Histórico de interpretações' : 'Historial de interpretaciones'}</button>
        <button type="button" style={boton} onClick={imprimir}>📄 {pt ? 'Exportar PDF' : 'Exportar PDF'}</button>
        <div style={{ position: 'relative' }}>
          <button type="button" style={boton} onClick={() => setMenuCompartir((v) => !v)}>🔗 {pt ? 'Compartilhar' : 'Compartir'}</button>
          {menuCompartir && (
            <div style={{ position: 'absolute', bottom: '110%', left: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 10px 28px rgba(15,23,42,0.16)', padding: 6, display: 'grid', gap: 2, minWidth: 190, zIndex: 5 }}>
              <button type="button" style={itemMenu} onClick={copiar}>📋 {pt ? 'Copiar texto' : 'Copiar texto'}</button>
              <a style={{ ...itemMenu, textDecoration: 'none' }} href={`https://wa.me/?text=${encodeURIComponent(texto())}`} target="_blank" rel="noreferrer" onClick={() => setMenuCompartir(false)}>💬 WhatsApp</a>
              <a style={{ ...itemMenu, textDecoration: 'none' }} href={`mailto:?subject=${encodeURIComponent(`${pt ? 'Interpretação' : 'Interpretación'} — ${empresa}`)}&body=${encodeURIComponent(texto())}`} onClick={() => setMenuCompartir(false)}>✉️ Email</a>
              <button type="button" style={itemMenu} onClick={compartirNativo}>📱 {pt ? 'Mais opções…' : 'Más opciones…'}</button>
            </div>
          )}
        </div>
        {aviso && <span style={{ color: '#15803d', fontWeight: 700, fontSize: 13 }}>{aviso}</span>}
      </div>

      {verHistorial && (
        <div className="dre-no-imprimir" style={{ marginTop: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 14 }}>
          <div style={{ fontWeight: 800, color: COL.azul, marginBottom: 8 }}>🕘 {pt ? `Histórico de ${empresa}` : `Historial de ${empresa}`}</div>
          {historial.length === 0 ? (
            <div style={{ color: COL.gris, fontSize: 13.5 }}>{pt ? 'Ainda não há interpretações guardadas. Toque em «Gerar interpretação».' : 'Todavía no hay interpretaciones guardadas. Tocá «Generar interpretación».'}</div>
          ) : (
            <div style={{ display: 'grid', gap: 6, maxHeight: 280, overflow: 'auto' }}>
              {historial.map((v) => (
                <button key={v.id} type="button" onClick={() => { onVerVersion(v.id); setVerHistorial(false); }} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', border: '1px solid #e5e7eb', background: v.periodo === periodo ? '#f0fdf4' : '#fff', borderRadius: 12, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, color: '#1f2937' }}>
                  <span><strong style={{ textTransform: 'capitalize' }}>{etiquetaDe(v.periodo)}</strong> · {pt ? 'versão' : 'versión'} {v.version}</span>
                  <span style={{ color: COL.gris }}>{fechaCorta(v.generado_en, pt)} · {v.origen === 'AUTO' ? (pt ? 'automática' : 'automática') : pt ? 'manual' : 'manual'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ marginTop: 14, fontSize: 12.5, color: COL.gris }}>
        {pt ? 'O Sabio monta esta conversa com os números dos seus relatórios: não inventa dados nem tendências e cada empresa vê somente a sua.' : 'El Sabio arma esta conversación con los números de tus informes: no inventa datos ni tendencias y cada empresa ve solo lo suyo.'}
      </p>
    </div>
  );
}

const itemMenu: React.CSSProperties = { display: 'block', textAlign: 'left', border: 'none', background: 'transparent', padding: '9px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 14, color: '#1f3a5f', fontWeight: 600 };
