'use client';

import { useEffect, useState } from 'react';
import { cargarSituacionCierre, diasParaElCierre, enPeriodoDeAviso, estadoDelMes, hoyLocalCierre, limiteReapertura, type SituacionCierre } from '@/lib/cierres';
import { pendientesParaCargar, type CompromisoAbierto } from '@/lib/compromisosAbiertos';

// Situación contable del mes sobre el calendario: aviso de cierre (últimos 5 días, con lo pendiente para ayudar) y mes anterior
// recién cerrado (hasta el día 5). Sin cierre activo en la empresa no muestra nada.
export function AvisoCierreMes({ empresaId, idioma, onSituacion }: { empresaId: string; idioma: string; onSituacion?: (s: SituacionCierre) => void }) {
  const pt = idioma === 'PT';
  const [situacion, setSituacion] = useState<SituacionCierre | null>(null);
  const [pendientes, setPendientes] = useState<CompromisoAbierto[]>([]);
  const hoy = hoyLocalCierre();

  useEffect(() => {
    let vivo = true;
    void cargarSituacionCierre(empresaId).then((s) => {
      if (!vivo) return;
      setSituacion(s);
      onSituacion?.(s);
    });
    return () => { vivo = false; };
  }, [empresaId, onSituacion]);

  const aviso = Boolean(situacion?.config.activo) && enPeriodoDeAviso(hoy);
  useEffect(() => {
    if (!aviso) return;
    let vivo = true;
    void pendientesParaCargar(empresaId).then((p) => { if (vivo) setPendientes(p.filter((x) => x.fechaVencimiento <= `${hoy.slice(0, 7)}-31`)); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [aviso, empresaId, hoy]);

  if (!situacion?.config.activo) return null;

  const mesAnterior = (() => {
    const d = new Date(`${hoy.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const estadoAnterior = estadoDelMes(situacion, mesAnterior, hoy);
  const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  const caja = (color: string): React.CSSProperties => ({ border: `1px solid ${color}`, background: `${color}14`, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#1f2937' });

  return (
    <div>
      {aviso && (
        <div style={caja(diasParaElCierre(hoy) === 0 ? '#dc2626' : '#d97706')}>
          <strong>
            {diasParaElCierre(hoy) === 0
              ? (pt ? 'Hoje o mês fecha automaticamente.' : 'Hoy el mes se cierra automáticamente.')
              : (pt ? `Faltam ${diasParaElCierre(hoy)} dia(s) para o fechamento do mês.` : `Faltan ${diasParaElCierre(hoy)} día(s) para el cierre del mes.`)}
          </strong>{' '}
          {pt ? 'Lance o que falta antes que feche.' : 'Cargá lo que falte antes de que cierre.'}
          {pendientes.length > 0 ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {pendientes.slice(0, 5).map((p) => (
                <li key={`${p.tipo}-${p.recordatorioId}`}>
                  {p.lado === 'COBRAR' ? (pt ? 'Receber' : 'Cobrar') : (pt ? 'Pagar' : 'Pagar')} · {p.nombre} · {fechaCorta(p.fechaVencimiento)}
                </li>
              ))}
              {pendientes.length > 5 && <li>{pt ? `e mais ${pendientes.length - 5}…` : `y ${pendientes.length - 5} más…`}</li>}
            </ul>
          ) : (
            <div style={{ marginTop: 4, color: '#166534' }}>{pt ? 'Nada pendente do mês. 👌' : 'Nada pendiente del mes. 👌'}</div>
          )}
        </div>
      )}
      {estadoAnterior === 'CERRADO' && (
        <div style={caja('#2563eb')}>
          {pt
            ? `O mês anterior já está fechado. Se faltar algo, você pode reabri-lo até ${fechaCorta(limiteReapertura(mesAnterior))} em Configurações → Fechamento de períodos.`
            : `El mes anterior ya está cerrado. Si falta algo, podés reabrirlo hasta el ${fechaCorta(limiteReapertura(mesAnterior))} en Configuraciones → Cierre de períodos.`}
        </div>
      )}
      {estadoAnterior === 'HABILITADO' && (
        <div style={caja('#d97706')}>
          {pt ? 'O mês anterior está habilitado agora. Ao fechar o app, bloqueia sozinho.' : 'El mes anterior está habilitado ahora. Al cerrar la app se bloquea solo.'}
        </div>
      )}
    </div>
  );
}
