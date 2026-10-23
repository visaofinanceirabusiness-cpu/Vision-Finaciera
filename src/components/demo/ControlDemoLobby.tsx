'use client';

// CONTROL DE LA DEMO — tarjeta del lobby para quien presenta
// =====================================================
//
// Los espectadores entran con casi todo bloqueado (solo ven el lobby y juegan el Mini-Juego
// simulado). Desde acá se habilita, de a una, cada pantalla (y cada informe) para que
// miren justo lo que se está explicando, y se ve cuántos hay conectados y dónde están.
// Solo aparece si la empresa tiene un código de demo (demo_accesos).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { HERRAMIENTAS_DEMO, INFORMES_DEMO } from '@/lib/modoEspectador';

type Acceso = { id: string; codigo: string; habilitadas: string[]; activo: boolean; vence_en: string | null };
type Presencia = { enLinea: number; total: number; porRuta: Record<string, number> };

const MS_EN_LINEA = 45_000;

export function ControlDemoLobby({ empresaId, idioma }: { empresaId: string; idioma: string }) {
  const esPT = idioma === 'PT';
  const [acceso, setAcceso] = useState<Acceso | null>(null);
  const [presencia, setPresencia] = useState<Presencia>({ enLinea: 0, total: 0, porRuta: {} });
  const [error, setError] = useState('');

  const nombresRuta: Record<string, string> = {
    '/': 'Lobby',
    '/informes': 'Informes',
    '/panel-de-control': 'Panel de Control',
    '/contabilidad': 'Contabilidad',
    '/finanzas': 'Finanzas',
    '/mercaderia': 'Mercadería',
    '/produccion': 'Producción',
    '/recursos-humanos': 'Recursos Humanos',
    '/visao-3d': 'Visão 3D',
    '/plan-accion': 'Plan de Acción',
    '/nuestro-sueno': 'Nuestro Sueño',
    '/mensajes': 'Mensajes',
    '/configuracoes': 'Configuraciones',
  };

  const secciones: { clave: string; nombre: string }[] = HERRAMIENTAS_DEMO.map((h) => ({ clave: h.clave, nombre: esPT ? h.pt : h.es }));
  const informes: { clave: string; nombre: string }[] = INFORMES_DEMO.map((h) => ({ clave: h.clave, nombre: esPT ? h.pt : h.es }));

  const cargar = useCallback(async () => {
    const { data: filas } = await supabase
      .from('demo_accesos')
      .select('id, codigo, habilitadas, activo, vence_en')
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: true })
      .limit(1);

    const fila = (filas?.[0] ?? null) as Acceso | null;
    setAcceso(fila);
    if (!fila) return;

    const { data: espectadores } = await supabase.from('espectadores').select('user_id').eq('acceso_id', fila.id);
    const ids = (espectadores ?? []).map((e) => e.user_id as string);
    if (ids.length === 0) {
      setPresencia({ enLinea: 0, total: 0, porRuta: {} });
      return;
    }

    const desde = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: eventos } = await supabase
      .from('espectador_eventos')
      .select('user_id, ruta, creado_en')
      .in('user_id', ids)
      .gte('creado_en', desde)
      .order('creado_en', { ascending: false })
      .limit(2000);

    const ultimo = new Map<string, { ruta: string; t: number }>();
    for (const e of eventos ?? []) {
      if (!ultimo.has(e.user_id as string)) ultimo.set(e.user_id as string, { ruta: e.ruta as string, t: new Date(e.creado_en as string).getTime() });
    }

    const ahora = Date.now();
    const porRuta: Record<string, number> = {};
    let enLinea = 0;
    for (const { ruta, t } of ultimo.values()) {
      if (ahora - t > MS_EN_LINEA) continue;
      enLinea += 1;
      porRuta[ruta] = (porRuta[ruta] ?? 0) + 1;
    }
    setPresencia({ enLinea, total: ids.length, porRuta });
  }, [empresaId]);

  useEffect(() => {
    void cargar();
    const intervalo = window.setInterval(cargar, 5000);
    return () => window.clearInterval(intervalo);
  }, [cargar]);

  async function guardar(habilitadas: string[]) {
    if (!acceso) return;
    setError('');
    const anterior = acceso;
    setAcceso({ ...acceso, habilitadas });

    const { error: errorGuardar } = await supabase.from('demo_accesos').update({ habilitadas }).eq('id', acceso.id);
    if (errorGuardar) {
      setAcceso(anterior);
      setError(esPT ? 'Não foi possível salvar.' : 'No se pudo guardar.');
    }
  }

  function alternar(clave: string) {
    if (!acceso) return;
    guardar(acceso.habilitadas.includes(clave) ? acceso.habilitadas.filter((h) => h !== clave) : [...acceso.habilitadas, clave]);
  }

  if (!acceso) return null;

  const todas = [...secciones, ...informes].map((s) => s.clave);
  const caja = (clave: string, nombre: string) => (
    <label key={clave} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: acceso.habilitadas.includes(clave) ? '#edf6f0' : '#f9fafb', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#1f3a5f' }}>
      <input type="checkbox" checked={acceso.habilitadas.includes(clave)} onChange={() => alternar(clave)} style={{ width: 18, height: 18 }} />
      {acceso.habilitadas.includes(clave) ? '🔓' : '🔒'} {nombre}
    </label>
  );

  return (
    <section style={{ background: '#fff', border: '2px solid #1f3a5f', borderRadius: 24, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: '#2e8b57' }}>{esPT ? 'CONTROLE DA DEMONSTRAÇÃO' : 'CONTROL DE LA DEMO'}</div>
          <h2 style={{ margin: '4px 0 2px', color: '#1f3a5f', fontSize: 20 }}>{esPT ? 'Libere as telas para o público' : 'Habilitá las pantallas al público'}</h2>
          <p style={{ margin: 0, fontSize: 12.5, color: '#6b7280' }}>
            {esPT
              ? `Código ${acceso.codigo}${acceso.activo ? '' : ' (inativo)'}${acceso.vence_en ? ` · vence ${new Date(acceso.vence_en).toLocaleDateString('pt-BR')}` : ''}. Os espectadores sempre veem o lobby e jogam o Mini-Jogo simulado.`
              : `Código ${acceso.codigo}${acceso.activo ? '' : ' (inactivo)'}${acceso.vence_en ? ` · vence ${new Date(acceso.vence_en).toLocaleDateString('es-AR')}` : ''}. Los espectadores siempre ven el lobby y juegan el Mini-Juego simulado.`}
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1f3a5f' }}>
            {presencia.enLinea}
            <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 700 }}> / {presencia.total}</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#6b7280' }}>{esPT ? 'online agora / entraram' : 'en línea ahora / entraron'}</div>
        </div>
      </div>

      {presencia.enLinea > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0 4px' }}>
          {Object.entries(presencia.porRuta)
            .sort((a, b) => b[1] - a[1])
            .map(([ruta, cantidad]) => (
              <span key={ruta} style={{ background: '#eef4fb', color: '#1f3a5f', borderRadius: 999, padding: '4px 11px', fontSize: 12.5, fontWeight: 700 }}>
                {nombresRuta[ruta] ?? ruta}: {cantidad}
              </span>
            ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, margin: '14px 0 10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => guardar(todas)} style={{ border: 'none', background: '#2e8b57', color: '#fff', borderRadius: 999, padding: '8px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
          {esPT ? '🔓 Liberar tudo' : '🔓 Habilitar todo'}
        </button>
        <button type="button" onClick={() => guardar([])} style={{ border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: 999, padding: '8px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
          {esPT ? '🔒 Bloquear tudo' : '🔒 Bloquear todo'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
        {secciones.map((s) => caja(s.clave, s.nombre))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: '#6b7280', margin: '14px 0 8px' }}>{esPT ? 'INFORMES (cada relatório)' : 'INFORMES (cada informe)'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
        {informes.map((s) => caja(s.clave, s.nombre))}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
    </section>
  );
}
