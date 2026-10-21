'use client';

// Cabecera del Libro Diario: 6 indicadores que convierten los asientos en información
// (ver lib/indicadoresLibroDiario.ts). Casi todo lo que se ve se puede tocar para filtrar la
// lista de abajo.

import { formatearNumeroEntero } from '@/lib/moneda';
import { nombreOperacionDisplay } from '@/lib/i18n';
import type { FiltroIndicador, IndicadoresLibro, PeriodoLibro } from '@/lib/indicadoresLibroDiario';
import { COLORES } from './compartido';

type Props = {
  indicadores: IndicadoresLibro;
  periodo: PeriodoLibro;
  onPeriodo: (periodo: PeriodoLibro) => void;
  filtro: FiltroIndicador | null;
  onFiltro: (filtro: FiltroIndicador | null) => void;
  idioma: string;
  esFamiliar: boolean;
  simbolo: string;
};

const mismoFiltro = (a: FiltroIndicador | null, b: FiltroIndicador) => a?.tipo === b.tipo && a.valor === b.valor;

function fechaCorta(fecha: string, esPT: boolean): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString(esPT ? 'pt-BR' : 'es-AR', { day: '2-digit', month: '2-digit' });
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: COLORES.gris, marginBottom: 8 }}>{titulo}</div>
      {children}
    </section>
  );
}

// Fila que se puede tocar para filtrar (se resalta cuando es el filtro activo).
function FilaTocable({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: activa ? `1.5px solid ${COLORES.verde}` : '1.5px solid transparent',
        background: activa ? '#edf6f0' : 'transparent',
        borderRadius: 10,
        padding: '5px 7px',
        marginBottom: 3,
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

const textoChico: React.CSSProperties = { fontSize: 12.5, color: '#374151' };

export function IndicadoresLibroDiario({ indicadores: ind, periodo, onPeriodo, filtro, onFiltro, idioma, esFamiliar, simbolo }: Props) {
  const esPT = idioma === 'PT';
  const dinero = (n: number) => `${simbolo} ${formatearNumeroEntero(n)}`;
  const alternar = (nuevo: FiltroIndicador) => onFiltro(mismoFiltro(filtro, nuevo) ? null : nuevo);

  const opciones: Array<{ id: PeriodoLibro; texto: string }> = [
    { id: 'MES', texto: esPT ? 'Este mês' : 'Este mes' },
    { id: 'MES_ANTERIOR', texto: esPT ? 'Mês anterior' : 'Mes anterior' },
    { id: 'TODO', texto: esPT ? 'Tudo' : 'Todo' },
  ];

  const { movimiento, ritmo, mix, cuentas, contrapartes, calidad } = ind;
  const maxMix = Math.max(1, ...mix.map((m) => m.cantidad));
  const maxCuenta = Math.max(1, ...cuentas.map((c) => c.importe));

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPeriodo(o.id)}
            aria-pressed={periodo === o.id}
            style={{
              border: `1px solid ${periodo === o.id ? COLORES.azul : '#d1d5db'}`,
              background: periodo === o.id ? COLORES.azul : '#fff',
              color: periodo === o.id ? '#fff' : COLORES.azul,
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {o.texto}
          </button>
        ))}
        {filtro && (
          <button
            type="button"
            onClick={() => onFiltro(null)}
            style={{ border: 'none', background: '#fef3c7', color: '#78350f', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
          >
            🔎 {esPT ? 'Filtro' : 'Filtro'}: {filtro.tipo === 'operacion' ? nombreOperacionDisplay(idioma, filtro.valor, esFamiliar) : filtro.tipo === 'dia' ? fechaCorta(filtro.valor, esPT) : filtro.valor === 'PENDIENTE' ? (esPT ? 'Pendentes' : 'Pendientes') : filtro.valor === 'VALIDADO' ? (esPT ? 'Validados' : 'Validados') : filtro.valor === 'AUTOMATICO' ? (esPT ? 'Automáticos' : 'Automáticos') : filtro.valor === 'OPERACION' ? (esPT ? 'Manuais' : 'Manuales') : filtro.valor} ✕
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {/* 1 · Movimiento y cuadre */}
        <Tarjeta titulo={esPT ? '1 · MOVIMENTO' : '1 · MOVIMIENTO'}>
          <div style={{ fontSize: 22, fontWeight: 900, color: COLORES.azul }}>{dinero(movimiento.volumen)}</div>
          <div style={textoChico}>
            {movimiento.asientos} {esPT ? 'lançamentos' : 'asientos'} · {movimiento.operaciones} {esPT ? 'operações' : 'operaciones'}
          </div>
          {movimiento.variacionVolumen !== null && (
            <div style={{ ...textoChico, fontWeight: 700, color: movimiento.variacionVolumen >= 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>
              {movimiento.variacionVolumen >= 0 ? '↑' : '↓'} {Math.abs(movimiento.variacionVolumen).toLocaleString(esPT ? 'pt-BR' : 'es-AR')}% {esPT ? 'vs. mês anterior' : 'vs. mes anterior'}
            </div>
          )}
          <div style={{ ...textoChico, marginTop: 6, color: movimiento.incompletos === 0 ? '#16a34a' : '#b91c1c', fontWeight: 700 }}>
            {movimiento.incompletos === 0
              ? `✅ ${esPT ? 'Débito = Crédito em todos' : 'Debe = Haber en todos'}`
              : `⚠️ ${movimiento.incompletos} ${esPT ? 'sem débito, crédito ou valor' : 'sin debe, haber o importe'}`}
          </div>
        </Tarjeta>

        {/* 2 · Ritmo de actividad */}
        <Tarjeta titulo={esPT ? '2 · RITMO DE ATIVIDADE' : '2 · RITMO DE ACTIVIDAD'}>
          <div style={{ fontSize: 22, fontWeight: 900, color: COLORES.azul }}>
            {ritmo.diasConMovimiento}
            <span style={{ fontSize: 14, fontWeight: 700, color: COLORES.gris }}> / {ritmo.diasDelPeriodo} {esPT ? 'dias com movimento' : 'días con movimiento'}</span>
          </div>
          <div style={textoChico}>
            {ritmo.promedioOperacionesPorDiaActivo.toLocaleString(esPT ? 'pt-BR' : 'es-AR')} {esPT ? 'operações por dia ativo' : 'operaciones por día activo'}
          </div>
          {ritmo.diaMasActivo && (
            <FilaTocable activa={mismoFiltro(filtro, { tipo: 'dia', valor: ritmo.diaMasActivo.fecha })} onClick={() => alternar({ tipo: 'dia', valor: ritmo.diaMasActivo!.fecha })}>
              <span style={textoChico}>
                📆 {esPT ? 'Dia mais ativo' : 'Día más activo'}: <b>{fechaCorta(ritmo.diaMasActivo.fecha, esPT)}</b> ({ritmo.diaMasActivo.operaciones})
              </span>
            </FilaTocable>
          )}
          {ritmo.ultimoRegistro && (
            <div style={{ ...textoChico, paddingLeft: 7 }}>
              🕒 {esPT ? 'Último registro' : 'Último registro'}: <b>{fechaCorta(ritmo.ultimoRegistro, esPT)}</b>
            </div>
          )}
        </Tarjeta>

        {/* 3 · Mix de operaciones */}
        <Tarjeta titulo={esPT ? '3 · MIX DE OPERAÇÕES' : '3 · MIX DE OPERACIONES'}>
          {mix.length === 0 ? (
            <div style={textoChico}>—</div>
          ) : (
            mix.slice(0, 6).map((m) => (
              <FilaTocable key={m.clave} activa={mismoFiltro(filtro, { tipo: 'operacion', valor: m.clave })} onClick={() => alternar({ tipo: 'operacion', valor: m.clave })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...textoChico }}>
                  <span>{nombreOperacionDisplay(idioma, m.clave, esFamiliar)}</span>
                  <b>{m.cantidad}</b>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: '#eef2f6', marginTop: 2 }}>
                  <div style={{ width: `${(m.cantidad / maxMix) * 100}%`, height: '100%', borderRadius: 3, background: COLORES.verde }} />
                </div>
              </FilaTocable>
            ))
          )}
        </Tarjeta>

        {/* 4 · Cuentas más movidas */}
        <Tarjeta titulo={esPT ? '4 · CONTAS MAIS MOVIMENTADAS' : '4 · CUENTAS MÁS MOVIDAS'}>
          {cuentas.length === 0 ? (
            <div style={textoChico}>—</div>
          ) : (
            cuentas.map((c) => (
              <FilaTocable key={c.cuenta} activa={mismoFiltro(filtro, { tipo: 'cuenta', valor: c.cuenta })} onClick={() => alternar({ tipo: 'cuenta', valor: c.cuenta })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...textoChico }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cuenta}</span>
                  <b style={{ whiteSpace: 'nowrap' }}>{dinero(c.importe)} · {c.porcentaje.toLocaleString(esPT ? 'pt-BR' : 'es-AR')}%</b>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: '#eef2f6', marginTop: 2 }}>
                  <div style={{ width: `${(c.importe / maxCuenta) * 100}%`, height: '100%', borderRadius: 3, background: COLORES.azul }} />
                </div>
              </FilaTocable>
            ))
          )}
        </Tarjeta>

        {/* 5 · Principales contrapartes */}
        <Tarjeta titulo={esPT ? (esFamiliar ? '5 · ONDE MAIS GASTAMOS' : '5 · PRINCIPAIS CONTRAPARTES') : esFamiliar ? '5 · EN QUÉ GASTAMOS MÁS' : '5 · PRINCIPALES CONTRAPARTES'}>
          {contrapartes.clientes.length === 0 && contrapartes.proveedores.length === 0 && <div style={textoChico}>—</div>}
          {[
            { lista: contrapartes.clientes, titulo: esFamiliar ? (esPT ? 'Quem mais pagou' : 'Quién más aportó') : esPT ? 'Cliente principal' : 'Cliente principal', emoji: '🤝' },
            { lista: contrapartes.proveedores, titulo: esFamiliar ? (esPT ? 'Maior gasto com' : 'Mayor gasto en') : esPT ? 'Fornecedor principal' : 'Proveedor principal', emoji: '🏷️' },
          ].map(({ lista, titulo, emoji }) =>
            lista.map((c) => (
              <FilaTocable key={`${titulo}-${c.nombre}`} activa={mismoFiltro(filtro, { tipo: 'contraparte', valor: c.nombre })} onClick={() => alternar({ tipo: 'contraparte', valor: c.nombre })}>
                <div style={{ fontSize: 11, color: COLORES.gris }}>{emoji} {titulo}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...textoChico }}>
                  <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</b>
                  <span style={{ whiteSpace: 'nowrap' }}>{dinero(c.importe)}</span>
                </div>
              </FilaTocable>
            ))
          )}
        </Tarjeta>

        {/* 6 · Calidad del registro */}
        <Tarjeta titulo={esPT ? '6 · QUALIDADE DO REGISTRO' : '6 · CALIDAD DEL REGISTRO'}>
          <div style={{ fontSize: 22, fontWeight: 900, color: COLORES.azul }}>
            {calidad.porcentajeValidado}%
            <span style={{ fontSize: 14, fontWeight: 700, color: COLORES.gris }}> {esPT ? 'validados' : 'validados'}</span>
          </div>
          <FilaTocable activa={mismoFiltro(filtro, { tipo: 'estado', valor: 'PENDIENTE' })} onClick={() => alternar({ tipo: 'estado', valor: 'PENDIENTE' })}>
            <span style={textoChico}>
              ⏳ {calidad.pendientes} {esPT ? 'pendentes' : 'pendientes'}
            </span>
          </FilaTocable>
          <FilaTocable activa={mismoFiltro(filtro, { tipo: 'origen', valor: 'OPERACION' })} onClick={() => alternar({ tipo: 'origen', valor: 'OPERACION' })}>
            <span style={textoChico}>
              ✍️ {calidad.manuales} {esPT ? 'lançados por você' : 'cargados por vos'}
            </span>
          </FilaTocable>
          <FilaTocable activa={mismoFiltro(filtro, { tipo: 'origen', valor: 'AUTOMATICO' })} onClick={() => alternar({ tipo: 'origen', valor: 'AUTOMATICO' })}>
            <span style={textoChico}>
              ⚙️ {calidad.automaticos} {esPT ? 'gerados pelo sistema' : 'generados por el sistema'}
            </span>
          </FilaTocable>
        </Tarjeta>
      </div>
    </div>
  );
}
