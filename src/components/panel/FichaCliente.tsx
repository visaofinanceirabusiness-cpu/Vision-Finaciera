'use client';

// FICHA DE CLIENTE — se despliega dentro de la tarjeta de cada
// cliente en Panel Maestro. Dos bloques:
//
//   - Perfil de uso (📊): calculado solo, de sus propias operaciones
//     — no depende de que el admin cargue nada.
//   - Descripción + notas (📝): lo que el admin va anotando a mano
//     con el tiempo, con fecha, para no depender de la memoria.

import { useEffect, useState } from 'react';
import {
  obtenerNotasCliente,
  agregarNotaCliente,
  eliminarNotaCliente,
  actualizarDescripcionPerfil,
  obtenerPerfilDeUso,
  type NotaCliente,
  type PerfilDeUso,
} from '@/lib/fichaCliente';

type Colores = { azul: string; verde: string; blanco: string };

const TENDENCIA_INFO: Record<PerfilDeUso['tendencia'], { emoji: string; es: string; pt: string; color: string }> = {
  SUBIENDO: { emoji: '📈', es: 'Usando más que el mes pasado', pt: 'Usando mais que o mês passado', color: '#15803d' },
  BAJANDO: { emoji: '📉', es: 'Usando menos que el mes pasado', pt: 'Usando menos que o mês passado', color: '#b91c1c' },
  ESTABLE: { emoji: '➖', es: 'Ritmo de uso estable', pt: 'Ritmo de uso estável', color: '#6e7781' },
  SIN_DATOS: { emoji: '❔', es: 'Todavía sin suficiente historial', pt: 'Ainda sem histórico suficiente', color: '#6e7781' },
};

export function FichaCliente({
  empresaId,
  simbolo,
  idioma,
  colores,
  descripcionInicial,
}: {
  empresaId: string;
  simbolo: string;
  idioma: string;
  colores: Colores;
  descripcionInicial: string | null;
}) {
  const esPT = idioma === 'PT';

  const [perfilUso, setPerfilUso] = useState<PerfilDeUso | null>(null);
  const [notas, setNotas] = useState<NotaCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [descripcion, setDescripcion] = useState(descripcionInicial ?? '');
  const [guardandoDescripcion, setGuardandoDescripcion] = useState(false);

  const [notaNueva, setNotaNueva] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);

  async function recargar() {
    try {
      const [perfil, listaNotas] = await Promise.all([
        obtenerPerfilDeUso(empresaId),
        obtenerNotasCliente(empresaId),
      ]);
      setPerfilUso(perfil);
      setNotas(listaNotas);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando la ficha del cliente.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function guardarDescripcion() {
    setGuardandoDescripcion(true);
    try {
      await actualizarDescripcionPerfil(empresaId, descripcion);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la descripción.');
    } finally {
      setGuardandoDescripcion(false);
    }
  }

  async function agregarNota() {
    if (!notaNueva.trim()) return;
    setGuardandoNota(true);
    try {
      await agregarNotaCliente(empresaId, notaNueva);
      setNotaNueva('');
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la nota.');
    } finally {
      setGuardandoNota(false);
    }
  }

  async function borrarNota(notaId: string) {
    try {
      await eliminarNotaCliente(notaId);
      setNotas((actuales) => actuales.filter((n) => n.id !== notaId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la nota.');
    }
  }

  const cajaEstilo: React.CSSProperties = {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    background: '#fbfcfd',
    padding: 14,
  };

  return (
    <div style={{ marginTop: 4, display: 'grid', gap: 12 }} onClick={(e) => e.stopPropagation()}>
      {error && (
        <div style={{ fontSize: 11.5, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 10px' }}>
          {error}
        </div>
      )}

      {/* ============ PERFIL DE USO (calculado solo) ============ */}
      <div style={cajaEstilo}>
        <div style={{ fontSize: 11, fontWeight: 800, color: colores.azul, marginBottom: 8, letterSpacing: 0.3 }}>
          {esPT ? '📊 Perfil de uso (últimos 30 dias)' : '📊 Perfil de uso (últimos 30 días)'}
        </div>

        {cargando ? (
          <p style={{ fontSize: 12, color: '#6e7781', margin: 0 }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
        ) : !perfilUso || (perfilUso.operacionesUltimoMes === 0 && perfilUso.operacionesMesAnterior === 0) ? (
          <p style={{ fontSize: 12, color: '#6e7781', margin: 0 }}>
            {esPT ? 'Ainda não hay operações suficientes para armar um perfil.' : 'Todavía no hay operaciones suficientes para armar un perfil.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 6, fontSize: 12.5 }}>
            <div>
              <strong>{esPT ? 'Movido este mês: ' : 'Movido este mes: '}</strong>
              {simbolo} {perfilUso.totalUltimoMes.toFixed(2)} · {perfilUso.operacionesUltimoMes} {esPT ? 'operações' : 'operaciones'}
            </div>

            {perfilUso.topCategorias.length > 0 && (
              <div>
                <strong>{esPT ? 'Gasta mais em: ' : 'Gasta más en: '}</strong>
                {perfilUso.topCategorias.map((c) => c.nombre).join(', ')}
              </div>
            )}

            {perfilUso.formaPagoMasUsada && (
              <div>
                <strong>{esPT ? 'Forma de pagamento mais usada: ' : 'Forma de pago más usada: '}</strong>
                {perfilUso.formaPagoMasUsada}
              </div>
            )}

            <div style={{ color: TENDENCIA_INFO[perfilUso.tendencia].color, fontWeight: 700 }}>
              {TENDENCIA_INFO[perfilUso.tendencia].emoji} {esPT ? TENDENCIA_INFO[perfilUso.tendencia].pt : TENDENCIA_INFO[perfilUso.tendencia].es}
            </div>
          </div>
        )}
      </div>

      {/* ============ DESCRIPCIÓN DE PERFIL (a mano) ============ */}
      <div style={cajaEstilo}>
        <div style={{ fontSize: 11, fontWeight: 800, color: colores.azul, marginBottom: 8, letterSpacing: 0.3 }}>
          {esPT ? '📝 Descrição do perfil' : '📝 Descripción del perfil'}
        </div>

        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={
            esPT
              ? 'Ex.: prefere que falem de forma direta, se preocupa muito com o fluxo de caixa, melhor contatar à noite...'
              : 'Ej.: prefiere que le hablen directo, le preocupa mucho el flujo de caja, mejor contactarlo de noche...'
          }
          rows={3}
          style={{ width: '100%', borderRadius: 8, border: '1px solid #d1d5db', padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical' }}
        />

        <button
          type="button"
          onClick={guardarDescripcion}
          disabled={guardandoDescripcion || descripcion === (descripcionInicial ?? '')}
          style={{
            marginTop: 8,
            border: 'none',
            background: colores.verde,
            color: '#fff',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: guardandoDescripcion ? 'wait' : 'pointer',
            opacity: guardandoDescripcion || descripcion === (descripcionInicial ?? '') ? 0.6 : 1,
          }}
        >
          {guardandoDescripcion ? (esPT ? 'Salvando...' : 'Guardando...') : esPT ? 'Salvar' : 'Guardar'}
        </button>
      </div>

      {/* ============ NOTAS CON FECHA ============ */}
      <div style={cajaEstilo}>
        <div style={{ fontSize: 11, fontWeight: 800, color: colores.azul, marginBottom: 8, letterSpacing: 0.3 }}>
          {esPT ? '🗒️ Histórico de notas' : '🗒️ Historial de notas'}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={notaNueva}
            onChange={(e) => setNotaNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') agregarNota();
            }}
            placeholder={esPT ? 'Adicionar uma nota...' : 'Agregar una nota...'}
            style={{ flex: 1, borderRadius: 8, border: '1px solid #d1d5db', padding: '7px 10px', fontSize: 12.5 }}
          />
          <button
            type="button"
            onClick={agregarNota}
            disabled={guardandoNota || !notaNueva.trim()}
            style={{
              border: 'none',
              background: colores.azul,
              color: '#fff',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: guardandoNota ? 'wait' : 'pointer',
              opacity: guardandoNota || !notaNueva.trim() ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {esPT ? '+ Adicionar' : '+ Agregar'}
          </button>
        </div>

        {notas.length === 0 ? (
          <p style={{ fontSize: 12, color: '#6e7781', margin: 0 }}>
            {esPT ? 'Ainda não hay notas.' : 'Todavía no hay notas.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {notas.map((nota) => (
              <div
                key={nota.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 12,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid #eef2f6',
                }}
              >
                <div>
                  <span style={{ color: '#6e7781', fontWeight: 700 }}>
                    {new Date(nota.creado_en).toLocaleDateString(esPT ? 'pt-BR' : 'es-AR')}:
                  </span>{' '}
                  {nota.texto}
                </div>
                <button
                  type="button"
                  onClick={() => borrarNota(nota.id)}
                  title={esPT ? 'Excluir nota' : 'Eliminar nota'}
                  style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
