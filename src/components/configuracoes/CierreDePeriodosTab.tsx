'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  EVENTO_PERIODO_CAMBIO,
  bloquearPeriodos,
  cargarSituacionCierre,
  estadoDelMes,
  habilitarPeriodo,
  hoyLocalCierre,
  limiteReapertura,
  type EstadoPeriodo,
  type SituacionCierre,
} from '@/lib/cierres';

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const COLOR: Record<EstadoPeriodo, { fondo: string; texto: string }> = {
  ABIERTO: { fondo: '#dcfce7', texto: '#166534' },
  HABILITADO: { fondo: '#fef3c7', texto: '#92400e' },
  CERRADO: { fondo: '#dbeafe', texto: '#1e40af' },
  BLOQUEADO: { fondo: '#fee2e2', texto: '#991b1b' },
};

function mesesParaMostrar(situacion: SituacionCierre, hoy: string): string[] {
  const [a, m] = hoy.split('-').map(Number);
  const lista: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    const mes = d.toISOString().slice(0, 10);
    if (situacion.config.desde && mes < `${situacion.config.desde.slice(0, 7)}-01`) break;
    lista.push(mes);
  }
  return lista;
}

export function CierreDePeriodosTab({ empresaId, idioma, puedeHabilitar }: { empresaId: string; idioma: string; puedeHabilitar: boolean }) {
  const pt = idioma === 'PT';
  const [situacion, setSituacion] = useState<SituacionCierre | null>(null);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [clave, setClave] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [, setReloj] = useState(0);
  const hoy = hoyLocalCierre();

  const cargar = useCallback(async () => setSituacion(await cargarSituacionCierre(empresaId)), [empresaId]);
  useEffect(() => {
    void cargar();
    const r = setInterval(() => {
      setReloj((n) => n + 1);
      void cargar();
    }, 30000);
    return () => clearInterval(r);
  }, [cargar]);

  const nombreMes = (mes: string) => `${(pt ? MESES_PT : MESES_ES)[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
  const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;

  async function habilitar(mes: string) {
    setTrabajando(true);
    setMensaje('');
    const r = await habilitarPeriodo(mes, clave).catch(() => null);
    setTrabajando(false);
    if (r?.ok) {
      setClave('');
      setEligiendo(null);
      window.dispatchEvent(new Event(EVENTO_PERIODO_CAMBIO));
      await cargar();
      return;
    }
    const err = String(r?.json.error ?? '');
    if (err === 'PLAZO_VENCIDO') setMensaje(pt ? 'O prazo de reabertura terminou. Fale com o desenvolvedor.' : 'Venció el plazo de reapertura. Hablá con el desarrollador.');
    else if (r?.status === 401) setMensaje(pt ? 'Senha incorreta.' : 'Contraseña incorrecta.');
    else if (r?.status === 429) setMensaje(pt ? 'Muitas tentativas. Tente de novo em 15 minutos.' : 'Demasiados intentos. Probá de nuevo en 15 minutos.');
    else setMensaje(err || (pt ? 'Não foi possível habilitar.' : 'No se pudo habilitar.'));
  }

  async function volverABloquear(mes: string) {
    setTrabajando(true);
    await bloquearPeriodos(mes).catch(() => null);
    setTrabajando(false);
    window.dispatchEvent(new Event(EVENTO_PERIODO_CAMBIO));
    await cargar();
  }

  if (!situacion) return <div style={{ color: '#6b7280' }}>{pt ? 'Carregando…' : 'Cargando…'}</div>;
  if (!situacion.config.activo) return <div style={{ color: '#6b7280' }}>{pt ? 'O fechamento mensal não está ativo nesta empresa.' : 'El cierre mensual no está activo en esta empresa.'}</div>;

  const etiqueta: Record<EstadoPeriodo, string> = pt
    ? { ABIERTO: 'Aberto', HABILITADO: 'Habilitado', CERRADO: 'Fechado', BLOQUEADO: 'Bloqueado' }
    : { ABIERTO: 'Abierto', HABILITADO: 'Habilitado', CERRADO: 'Cerrado', BLOQUEADO: 'Bloqueado' };

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
      <div style={{ color: '#374151', fontSize: 14, lineHeight: 1.5 }}>
        {pt
          ? 'Cada mês fecha sozinho ao terminar: no dia 1 já está fechado. Durante os 5 primeiros dias do mês seguinte você pode reabri-lo com a sua senha, lançar o que falta e ele volta a bloquear sozinho quando fechar o app. Depois dos 5 dias só se reabre falando com o desenvolvedor.'
          : 'Cada mes se cierra solo al terminar: el día 1 ya está cerrado. Durante los primeros 5 días del mes siguiente podés reabrirlo con tu contraseña, cargar lo que falte y se vuelve a bloquear solo cuando cerrás la app. Pasados los 5 días solo se reabre hablando con el desarrollador.'}
      </div>

      {mesesParaMostrar(situacion, hoy).map((mes) => {
        const estado = estadoDelMes(situacion, mes, hoy);
        const color = COLOR[estado];
        return (
          <div key={mes} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ textTransform: 'capitalize', flex: '1 1 140px' }}>{nombreMes(mes)}</strong>
              <span style={{ background: color.fondo, color: color.texto, borderRadius: 999, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>{etiqueta[estado]}</span>
              {estado === 'CERRADO' && puedeHabilitar && (
                <button type="button" onClick={() => { setEligiendo(eligiendo === mes ? null : mes); setMensaje(''); setClave(''); }} style={botonSecundario}>
                  {pt ? `Habilitar ${nombreMes(mes)}` : `Habilitar ${nombreMes(mes)}`}
                </button>
              )}
              {estado === 'HABILITADO' && (
                <button type="button" disabled={trabajando} onClick={() => void volverABloquear(mes)} style={botonPrimario}>
                  {pt ? 'Bloquear de novo' : 'Volver a bloquear'}
                </button>
              )}
            </div>
            {estado === 'CERRADO' && (
              <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>
                {pt ? `Você pode reabrir até ${fechaCorta(limiteReapertura(mes))}.` : `Podés reabrirlo hasta el ${fechaCorta(limiteReapertura(mes))}.`}
              </div>
            )}
            {estado === 'HABILITADO' && (
              <div style={{ color: '#92400e', fontSize: 13, marginTop: 6 }}>
                {pt ? 'Aberto enquanto o app estiver aberto. Ao fechar o app, bloqueia sozinho.' : 'Abierto mientras la app siga abierta. Al cerrarla, se bloquea solo.'}
              </div>
            )}
            {estado === 'BLOQUEADO' && (
              <div style={{ color: '#991b1b', fontSize: 13, marginTop: 6 }}>
                {pt
                  ? 'O prazo de reabertura terminou. Para reabrir este mês, fale com o desenvolvedor.'
                  : 'Venció el plazo de reapertura. Para reabrir este mes hablá con el desarrollador.'}
              </div>
            )}
            {eligiendo === mes && (
              <form
                onSubmit={(e) => { e.preventDefault(); void habilitar(mes); }}
                style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}
              >
                <input
                  type="password"
                  autoComplete="current-password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder={pt ? 'Sua senha' : 'Tu contraseña'}
                  style={{ flex: '1 1 200px', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
                />
                <button type="submit" disabled={trabajando || !clave} style={botonPrimario}>{pt ? 'Confirmar' : 'Confirmar'}</button>
              </form>
            )}
          </div>
        );
      })}
      {mensaje && <div style={{ color: '#991b1b', fontWeight: 600 }}>{mensaje}</div>}
    </div>
  );
}

const botonPrimario: React.CSSProperties = { background: 'var(--color-primario, #1f3a5f)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' };
const botonSecundario: React.CSSProperties = { background: '#fff', color: 'var(--color-primario, #1f3a5f)', border: '1px solid var(--color-primario, #1f3a5f)', borderRadius: 8, padding: '7px 13px', fontWeight: 700, cursor: 'pointer' };
