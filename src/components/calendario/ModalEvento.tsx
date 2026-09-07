'use client';
// Modal de crear/editar/eliminar un evento del Calendário Organizador.
// Mismo patrón que ModalEditarObjetivo (configuracoes/page.tsx): estado
// controlado desde afuera, overlay + tarjeta centrada.

import { useState } from 'react';
import {
  CATEGORIAS_EVENTO,
  type CategoriaEvento,
  type EventoCalendario,
  nombreCategoria,
} from '@/lib/calendario';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

const ANTELACIONES = [
  { minutos: 0, labelES: 'En el momento', labelPT: 'No momento' },
  { minutos: 30, labelES: '30 min antes', labelPT: '30 min antes' },
  { minutos: 60, labelES: '1 hora antes', labelPT: '1 hora antes' },
  { minutos: 1440, labelES: '1 día antes', labelPT: '1 dia antes' },
];

export function ModalEvento({
  evento,
  fechaSugerida,
  idioma,
  colores,
  onGuardar,
  onEliminar,
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
  }) => Promise<void>;
  onEliminar: () => Promise<void>;
  onCancelar: () => void;
}) {
  const esPT = idioma === 'PT';

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

  async function confirmar() {
    if (!titulo.trim()) {
      setError(esPT ? 'Coloque um título.' : 'Poné un título.');
      return;
    }

    if (notificar && !hora) {
      setError(esPT ? 'Para notificar, escolha um horário.' : 'Para notificar, elegí un horario.');
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
      });
    } catch (erroGuardar) {
      setError((erroGuardar as Error).message);
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    setEliminando(true);
    try {
      await onEliminar();
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
              onClick={confirmarEliminar}
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
              🗑️ {esPT ? 'Excluir' : 'Eliminar'}
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
