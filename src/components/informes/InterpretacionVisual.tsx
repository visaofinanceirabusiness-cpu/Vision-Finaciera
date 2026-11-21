'use client';

import { useState } from 'react';
import { relatoComoTexto, type SeccionInterpretacion, type Tono } from '@/lib/informes/interpretacion';
import { EstiloImpresion } from './DreVisual';

// Informes → Interpretación: el Sabio cuenta el mes como un relato, informe por informe. Solo texto, armado con las cifras de los informes.

const COL = { azul: 'var(--color-primario, #1f3a5f)', gris: '#6b7280' };
const COLOR_TONO: Record<Tono, { borde: string; fondo: string; icono: string }> = {
  bien: { borde: '#22c55e', fondo: '#f0fdf4', icono: '✅' },
  atencion: { borde: '#f59e0b', fondo: '#fffbeb', icono: '⚠️' },
  neutro: { borde: '#60a5fa', fondo: '#f8fafc', icono: '📖' },
};

function sabioDe(s: SeccionInterpretacion): string {
  switch (s.clave) {
    case 'panorama':
      return s.tono === 'bien' ? 'sabio-hoodie-medalla' : s.tono === 'atencion' ? 'sabio-hoodie-libro' : 'sabio-hoodie-graduado';
    case 'resultado':
      return 'sabio-hoodie-lupa';
    case 'flujo':
      return 'sabio-flujo';
    case 'balance':
      return 'sabio-balanza';
    case 'cuentas':
      return 'sabio-libro';
    case 'sumas':
      return 'sabio-hoodie-tablet';
    default:
      return s.tono === 'bien' ? 'sabio-trofeo' : 'sabio-meta';
  }
}

export function InterpretacionVisual({
  secciones,
  periodos,
  periodo,
  onPeriodo,
  pt,
  etiquetaPeriodo,
}: {
  secciones: SeccionInterpretacion[];
  periodos: { valor: string; etiqueta: string }[];
  periodo: string;
  onPeriodo: (v: string) => void;
  pt: boolean;
  etiquetaPeriodo: string;
}) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState(false);
  const todasAbiertas = secciones.length > 0 && secciones.every((s) => s.lineas.length <= 1 || abiertas.has(s.clave));

  const alternar = (clave: string) => setAbiertas((prev) => { const n = new Set(prev); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(relatoComoTexto(`${pt ? 'Interpretação' : 'Interpretación'} — ${etiquetaPeriodo}`, secciones));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin permiso de portapapeles: no pasa nada */
    }
  };
  const imprimir = () => {
    setAbiertas(new Set(secciones.map((s) => s.clave)));
    setTimeout(() => window.print(), 150);
  };

  const boton: React.CSSProperties = { border: '1px solid #d1d5db', background: '#fff', color: '#1f3a5f', borderRadius: 12, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' };

  return (
    <div>
      <EstiloImpresion />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img className="dre-sabio-tarjeta" src="/sabio/sabio-hoodie-graduado.webp" alt="" style={{ height: 88, width: 'auto', objectFit: 'contain' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 30, color: COL.azul }}>{pt ? 'Interpretação' : 'Interpretación'}</h2>
            <p style={{ margin: '2px 0 0', color: COL.gris, fontSize: 14 }}>{pt ? 'O Sabio conta o mês, relatório por relatório.' : 'El Sabio te cuenta el mes, informe por informe.'}</p>
          </div>
        </div>

        <div className="dre-no-imprimir" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '10px 14px' }}>
          <div>
            <div style={{ fontSize: 11, color: COL.gris, fontWeight: 700 }}>{pt ? 'Mês' : 'Mes'}</div>
            <select value={periodo} onChange={(e) => onPeriodo(e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, color: COL.azul, background: '#fff' }}>
              {periodos.map((x) => (
                <option key={x.valor} value={x.valor}>{x.etiqueta}</option>
              ))}
            </select>
          </div>
          <button type="button" style={boton} onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(secciones.map((s) => s.clave)))}>
            {todasAbiertas ? (pt ? 'Ver menos' : 'Ver menos') : pt ? 'Ver tudo' : 'Ver todo'}
          </button>
          <button type="button" style={boton} onClick={copiar}>{copiado ? (pt ? '✓ Copiado' : '✓ Copiado') : pt ? '📋 Copiar texto' : '📋 Copiar texto'}</button>
          <button type="button" style={boton} onClick={imprimir}>⬇ {pt ? 'Exportar PDF' : 'Exportar PDF'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {secciones.map((s) => {
          const c = COLOR_TONO[s.tono];
          const abierta = abiertas.has(s.clave);
          const [resumen, ...resto] = s.lineas;
          return (
            <section key={s.clave} style={{ background: c.fondo, border: `1px solid ${c.borde}55`, borderLeft: `6px solid ${c.borde}`, borderRadius: 18, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <img className="dre-sabio-tarjeta" src={`/sabio/${sabioDe(s)}.webp`} alt="" style={{ height: 84, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, color: COL.azul }}>{c.icono} {s.titulo}</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#1f2937' }}>{resumen}</p>
                {resto.length > 0 && abierta && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                    {resto.map((l, i) => (
                      <p key={i} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: '#374151' }}>• {l}</p>
                    ))}
                  </div>
                )}
                {resto.length > 0 && (
                  <button type="button" className="dre-no-imprimir" onClick={() => alternar(s.clave)} style={{ marginTop: 8, border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 }}>
                    {abierta ? (pt ? 'Ver menos' : 'Ver menos') : `${pt ? 'Ver mais' : 'Ver más'} ›`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p style={{ marginTop: 14, fontSize: 12.5, color: COL.gris }}>
        {pt ? 'Este relato é montado pelo Sabio com os números dos seus relatórios: não inventa dados e muda sozinho conforme o mês escolhido.' : 'Este relato lo arma el Sabio con los números de tus informes: no inventa datos y cambia solo según el mes elegido.'}
      </p>
    </div>
  );
}
