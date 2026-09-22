'use client';
// Modal de crear/editar/eliminar un evento del Calendário Organizador.
// Mismo patrón que ModalEditarObjetivo (configuracoes/page.tsx): estado
// controlado desde afuera, overlay + tarjeta centrada.

import { useState } from 'react';
import {
  CATEGORIAS_EVENTO,
  type CategoriaEvento,
  type EventoCalendario,
  type FrecuenciaRepeticion,
  nombreCategoria,
} from '@/lib/calendario';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

const ANTELACIONES = [
  { minutos: 0, labelES: 'En el momento', labelPT: 'No momento' },
  { minutos: 30, labelES: '30 min antes', labelPT: '30 min antes' },
  { minutos: 60, labelES: '1 hora antes', labelPT: '1 hora antes' },
  { minutos: 1440, labelES: '1 día antes', labelPT: '1 dia antes' },
];

// 0=lunes...6=domingo, mismo orden que DIAS_SEMANA_ES/PT en
// CalendarioOrganizador.
const DIAS_SEMANA_CORTO_ES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_SEMANA_CORTO_PT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function diaDeLaSemana(fechaIso: string): number {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return (new Date(anio, mes - 1, dia).getDay() + 6) % 7;
}

export function ModalEvento({
  evento,
  fechaSugerida,
  idioma,
  colores,
  onGuardar,
  onEliminar,
  onEliminarSerie,
  onCancelar,
}: {
  evento: EventoCalendario | null;
  fechaSugerida: string;
  idioma: string;
  colores: Colores;
  onGuardar: (datos: {
    titulo: string;
    categoria: CategoriaEvento;
    fecha: string;
    hora: string | null;
    notas: string;
    notificar: boolean;
    antelacionMinutos: number;
    repeticion?: { frecuencia: FrecuenciaRepeticion; diasSemana?: number[]; hasta: string };
  }) => Promise<void>;
  onEliminar: () => Promise<void>;
  onEliminarSerie?: () => Promise<void>;
  onCancelar: () => void;
}) {
  const esPT = idioma === 'PT';
  const diasSemanaCorto = esPT ? DIAS_SEMANA_CORTO_PT : DIAS_SEMANA_CORTO_ES;

  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [categoria, setCategoria] = useState<CategoriaEvento>(evento?.categoria ?? 'FINANCEIRO');
  const [fecha, setFecha] = useState(evento?.fecha ?? fechaSugerida);
  const [hora, setHora] = useState(evento?.hora?.slice(0, 5) ?? '');
  const [notas, setNotas] = useState(evento?.notas ?? '');
  const [notificar, setNotificar] = useState(evento?.notificar ?? false);
  const [antelacionMinutos, setAntelacionMinutos] = useState(evento?.antelacion_minutos ?? 0);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState('');

  // La repetición solo se ofrece al crear — un evento que ya es parte
  // de una serie se edita/borra de a uno (o toda la serie junta, ver
  // onEliminarSerie), nunca se le arma una serie nueva encima.
  const [repetir, setRepetir] = useState(false);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaRepeticion>('SEMANAL');
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [repetirHasta, setRepetirHasta] = useState('');

  function alternarDiaSemana(dia: number) {
    setDiasSemana((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort()));
  }

  async function confirmar() {
    if (!titulo.trim()) {
      setError(esPT ? 'Coloque um título.' : 'Poné un título.');
      return;
    }

    if (notificar && !hora) {
      setError(esPT ? 'Para notificar, escolha um horário.' : 'Para notificar, elegí un horario.');
      return;
    }

    if (repetir && !repetirHasta) {
      setError(esPT ? 'Escolha até quando se repete.' : 'Elegí hasta cuándo se repite.');
      return;
    }

    if (repetir && repetirHasta < fecha) {
      setError(esPT ? '"Até" tem que ser depois da data inicial.' : 'El "hasta" tiene que ser posterior a la fecha inicial.');
      return;
    }

    setError('');
    setGuardando(true);

    try {
      await onGuardar({
        titulo: titulo.trim(),
        categoria,
        fecha,
        hora: hora ? `${hora}:00` : null,
        notas: notas.trim(),
        notificar,
        antelacionMinutos,
        repeticion: repetir ? { frecuencia, diasSemana: frecuencia === 'SEMANAL' ? diasSemana : undefined, hasta: repetirHasta } : undefined,
      });
    } catch (erroGuardar) {
      setError((erroGuardar as Error).message);
      setGuardando(false);
    }
  }

  async function confirmarEliminar(eliminarSerieCompleta: boolean) {
    setEliminando(true);
    try {
      await (eliminarSerieCompleta && onEliminarSerie ? onEliminarSerie() : onEliminar());
    } catch (erroEliminar) {
      setError((erroEliminar as Error).message);
      setEliminando(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000,
      }}
      onClick={onCancelar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colores.blanco,
          borderRadius: 20,
          padding: 24,
          maxWidth: 440,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', color: colores.azul, fontSize: 18 }}>
          {evento
            ? esPT
              ? 'Editar evento'
              : 'Editar evento'
            : esPT
              ? 'Novo evento'
              : 'Nuevo evento'}
        </h3>

        <Campo label={esPT ? 'Título' : 'Título'}>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={esPT ? 'Ex: Fechamento de caixa' : 'Ej: Cierre de caja'}
            style={estiloInput}
            autoFocus
          />
        </Campo>

        <Campo label={esPT ? 'Categoria' : 'Categoría'}>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaEvento)}
            style={estiloInput}
          >
            {(Object.keys(CATEGORIAS_EVENTO) as CategoriaEvento[]).map((codigo) => (
              <option key={codigo} value={codigo}>
                {CATEGORIAS_EVENTO[codigo].icono} {nombreCategoria(codigo, idioma)}
              </option>
            ))}
          </select>
        </Campo>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Campo label={esPT ? 'Data' : 'Fecha'}>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={estiloInput} />
            </Campo>
          </div>

          <div style={{ flex: 1 }}>
            <Campo label={esPT ? 'Horário' : 'Hora'}>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={estiloInput} />
            </Campo>
          </div>
        </div>

        {!evento && (
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="repetir-evento"
                type="checkbox"
                checked={repetir}
                onChange={(e) => setRepetir(e.target.checked)}
              />
              <label htmlFor="repetir-evento" style={{ fontSize: 13, color: colores.azul, fontWeight: 700 }}>
                🔁 {esPT ? 'Repetir este evento' : 'Repetir este evento'}
              </label>
            </div>

            {repetir && (
              <div style={{ marginTop: 10 }}>
                <Campo label={esPT ? 'Frequência' : 'Frecuencia'}>
                  <select
                    value={frecuencia}
                    onChange={(e) => setFrecuencia(e.target.value as FrecuenciaRepeticion)}
                    style={estiloInput}
                  >
                    <option value="DIARIA">{esPT ? 'Diariamente' : 'Diariamente'}</option>
                    <option value="SEMANAL">{esPT ? 'Semanalmente' : 'Semanalmente'}</option>
                    <option value="MENSUAL">{esPT ? 'Mensalmente' : 'Mensualmente'}</option>
                  </select>
                </Campo>

                {frecuencia === 'SEMANAL' && (
                  <Campo label={esPT ? 'Em quais dias' : 'En qué días'}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {diasSemanaCorto.map((letra, indice) => (
                        <button
                          key={indice}
                          type="button"
                          onClick={() => alternarDiaSemana(indice)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            border: `1px solid ${diasSemana.includes(indice) ? colores.verde : '#d1d5db'}`,
                            background: diasSemana.includes(indice) ? colores.verde : '#fff',
                            color: diasSemana.includes(indice) ? '#fff' : colores.azul,
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {letra}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      {esPT ? 'Nenhum dia marcado: repete no mesmo dia da semana da data inicial.' : 'Sin ningún día tildado: repite el mismo día de la semana que la fecha inicial.'}
                    </div>
                  </Campo>
                )}

                <Campo label={esPT ? 'Repetir até' : 'Repetir hasta'}>
                  <input
                    type="date"
                    value={repetirHasta}
                    min={fecha}
                    onChange={(e) => setRepetirHasta(e.target.value)}
                    style={estiloInput}
                  />
                </Campo>
              </div>
            )}
          </div>
        )}

        <Campo label={esPT ? 'Anotações' : 'Notas'}>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            style={{ ...estiloInput, resize: 'vertical' }}
          />
        </Campo>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
            marginBottom: notificar ? 8 : 0,
          }}
        >
          <input
            id="notificar-evento"
            type="checkbox"
            checked={notificar}
            onChange={(e) => setNotificar(e.target.checked)}
          />
          <label htmlFor="notificar-evento" style={{ fontSize: 13, color: colores.azul, fontWeight: 600 }}>
            🔔 {esPT ? 'Notificar por push' : 'Notificar por push'}
          </label>
        </div>

        {notificar && (
          <Campo label={esPT ? 'Quando avisar' : 'Cuándo avisar'}>
            <select
              value={antelacionMinutos}
              onChange={(e) => setAntelacionMinutos(Number(e.target.value))}
              style={estiloInput}
            >
              {ANTELACIONES.map((op) => (
                <option key={op.minutos} value={op.minutos}>
                  {esPT ? op.labelPT : op.labelES}
                </option>
              ))}
            </select>
          </Campo>
        )}

        {error && (
          <div style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            onClick={confirmar}
            disabled={guardando}
            style={{
              flex: 1,
              background: colores.verde,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '11px 16px',
              fontWeight: 700,
              cursor: guardando ? 'default' : 'pointer',
              opacity: guardando ? 0.7 : 1,
            }}
          >
            {guardando ? (esPT ? 'Salvando...' : 'Guardando...') : esPT ? 'Salvar' : 'Guardar'}
          </button>

          <button
            onClick={onCancelar}
            style={{
              background: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: 12,
              padding: '11px 16px',
              fontWeight: 700,
              color: colores.azul,
              cursor: 'pointer',
            }}
          >
            {esPT ? 'Cancelar' : 'Cancelar'}
          </button>

          {evento && (
            <button
              onClick={() => confirmarEliminar(false)}
              disabled={eliminando}
              style={{
                background: 'transparent',
                border: '1px solid #fecaca',
                borderRadius: 12,
                padding: '11px 16px',
                fontWeight: 700,
                color: '#dc2626',
                cursor: eliminando ? 'default' : 'pointer',
                opacity: eliminando ? 0.7 : 1,
              }}
            >
              🗑️ {evento.serie_id ? (esPT ? 'Excluir só este dia' : 'Eliminar solo este día') : esPT ? 'Excluir' : 'Eliminar'}
            </button>
          )}

          {evento?.serie_id && onEliminarSerie && (
            <button
              onClick={() => confirmarEliminar(true)}
              disabled={eliminando}
              style={{
                background: 'transparent',
                border: '1px solid #fecaca',
                borderRadius: 12,
                padding: '11px 16px',
                fontWeight: 700,
                color: '#dc2626',
                cursor: eliminando ? 'default' : 'pointer',
                opacity: eliminando ? 0.7 : 1,
              }}
            >
              🗑️ {esPT ? 'Excluir toda a série' : 'Eliminar toda la serie'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const estiloInput: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: 14,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
