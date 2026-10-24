'use client';

// PANEL MAESTRO → DEMO EN VIVO
//
// Informe en vivo de la demo para quien presenta (Desarrollador): quién entró por el QR, quién sigue
// conectado, en qué pantalla está cada uno, qué botones toca, cuánto tiempo pasa en cada lugar y qué
// intentó abrir bloqueado. Se actualiza solo cada 5 segundos. Solo lectura (las pantallas se habilitan
// desde la tarjeta "Controle da demonstração" del lobby de la empresa demo).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { HERRAMIENTAS_DEMO, PREFIJO_INFORME } from '@/lib/modoEspectador';
import {
  armarInforme,
  armarParticipacion,
  eventosACsv,
  formatoDuracion,
  nombreRuta,
  type EspectadorDemo,
  type EventoDemo,
} from '@/lib/demoInforme';

const COLORES = { azul: '#1f3a5f', verde: '#2e8b57', gris: '#6e7781' };
const HORAS_DE_HISTORIAL = 24;

type Acceso = { id: string; codigo: string; activo: boolean; vence_en: string | null; habilitadas: string[]; empresa_id: string };

const NOMBRE_HABILITADA: Record<string, string> = {
  ...Object.fromEntries(HERRAMIENTAS_DEMO.map((h) => [h.clave, h.es])),
  [`${PREFIJO_INFORME}BALANCE`]: 'Informe: Balance (ESP)',
  [`${PREFIJO_INFORME}RESULTADO`]: 'Informe: DRE',
  [`${PREFIJO_INFORME}FLUJO`]: 'Informe: Flujo de Caja',
  [`${PREFIJO_INFORME}MAYOR`]: 'Informe: Mayor',
  [`${PREFIJO_INFORME}SUMAS`]: 'Informe: Sumas y Saldos',
};

function hora(fecha: string | null): string {
  return fecha ? new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '14px 18px', minWidth: 150 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: COLORES.gris }}>{titulo}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: COLORES.azul }}>{valor}</div>
      {detalle && <div style={{ fontSize: 12, color: COLORES.gris }}>{detalle}</div>}
    </div>
  );
}

function ListaConteo({ filas, vacio }: { filas: { texto: string; veces: number; personas: number }[]; vacio: string }) {
  if (filas.length === 0) return <p style={{ margin: 0, color: COLORES.gris, fontSize: 14 }}>{vacio}</p>;
  return (
    <>
      {filas.slice(0, 10).map((f) => (
        <div key={f.texto} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, padding: '3px 0', color: '#374151' }}>
          <span>{f.texto}</span>
          <b style={{ color: COLORES.azul, whiteSpace: 'nowrap' }}>{f.veces}× · {f.personas} {f.personas === 1 ? 'persona' : 'personas'}</b>
        </div>
      ))}
    </>
  );
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 18, marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16, color: COLORES.azul }}>{titulo}</h2>
      {children}
    </section>
  );
}

export default function DemoEnVivoPage() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [acceso, setAcceso] = useState<Acceso | null>(null);
  const [espectadores, setEspectadores] = useState<EspectadorDemo[]>([]);
  const [eventos, setEventos] = useState<EventoDemo[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [ultimaLectura, setUltimaLectura] = useState<number>(Date.now());
  const [error, setError] = useState('');

  useEffect(() => {
    async function validar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase.from('perfiles').select('es_admin_plataforma').eq('id', userData.user.id).maybeSingle();
      if (!data?.es_admin_plataforma) {
        router.push('/');
        return;
      }

      setAutorizado(true);
    }

    validar();
  }, [router]);

  const cargar = useCallback(async () => {
    const { data: accesos, error: errorAcceso } = await supabase
      .from('demo_accesos')
      .select('id, codigo, activo, vence_en, habilitadas, empresa_id')
      .order('creado_en', { ascending: true })
      .limit(1);

    if (errorAcceso) {
      setError(errorAcceso.message);
      return;
    }

    const fila = (accesos?.[0] ?? null) as Acceso | null;
    setAcceso(fila);
    if (!fila) return;

    const { data: esps } = await supabase.from('espectadores').select('user_id, apodo, idioma, sabio, creado_en').eq('acceso_id', fila.id);
    const ids = (esps ?? []).map((e) => e.user_id as string);

    const { data: perfiles } = ids.length ? await supabase.from('perfiles').select('id, nombre').in('id', ids) : { data: [] };
    const nombrePerfil = new Map((perfiles ?? []).map((p) => [p.id as string, p.nombre as string]));

    setEspectadores(
      (esps ?? []).map((e) => ({
        user_id: e.user_id as string,
        nombre: (e.apodo as string | null) || nombrePerfil.get(e.user_id as string) || 'Sin nombre',
        idioma: e.idioma as string,
        sabio: (e.sabio as string | null) ?? null,
        creado_en: e.creado_en as string,
      }))
    );

    if (ids.length === 0) {
      setEventos([]);
    } else {
      const desde = new Date(Date.now() - HORAS_DE_HISTORIAL * 3_600_000).toISOString();
      const { data: evs, error: errorEventos } = await supabase
        .from('espectador_eventos')
        .select('user_id, ruta, tipo, detalle, creado_en')
        .in('user_id', ids)
        .gte('creado_en', desde)
        .order('creado_en', { ascending: false })
        .limit(5000);

      if (errorEventos) {
        setError(errorEventos.message);
        return;
      }

      setEventos((evs ?? []) as EventoDemo[]);
    }

    setError('');
    setUltimaLectura(Date.now());
  }, []);

  useEffect(() => {
    if (!autorizado) return;
    void cargar();
    const intervalo = window.setInterval(cargar, 5000);
    return () => window.clearInterval(intervalo);
  }, [autorizado, cargar]);

  const informe = useMemo(() => armarInforme(espectadores, eventos, ultimaLectura), [espectadores, eventos, ultimaLectura]);
  const participacion = useMemo(() => armarParticipacion(eventos), [eventos]);

  const ultimos = useMemo(() => {
    const nombres = new Map(espectadores.map((e) => [e.user_id, e.nombre]));
    return eventos.filter((e) => e.tipo !== 'LATIDO').slice(0, 25).map((e) => ({ ...e, nombre: nombres.get(e.user_id) ?? '—' }));
  }, [eventos, espectadores]);

  async function guardarHabilitadas(habilitadas: string[]) {
    if (!acceso) return;
    const anterior = acceso;
    setAcceso({ ...acceso, habilitadas });
    const { error: errorGuardar } = await supabase.from('demo_accesos').update({ habilitadas }).eq('id', acceso.id);
    if (errorGuardar) {
      setAcceso(anterior);
      setError(`No se pudo guardar: ${errorGuardar.message}`);
    }
  }

  function descargarCsv() {
    const blob = new Blob(['﻿', eventosACsv(espectadores, eventos)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `demo-en-vivo-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  if (autorizado === null) {
    return <div style={{ padding: 40, color: COLORES.gris }}>Cargando...</div>;
  }

  const vence = acceso?.vence_en ? new Date(acceso.vence_en) : null;
  const tiempoTotalPantallas = informe.pantallas.reduce((s, p) => s + p.segundos, 0);

  return (
    <main style={{ minHeight: '100vh', background: '#f5f7f9', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/panel-maestro" style={{ color: COLORES.gris, textDecoration: 'none', fontSize: 14 }}>
          ← Volver al Panel Maestro
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: COLORES.azul, margin: '10px 0 4px' }}>🎓 Demo en vivo</h1>
            <p style={{ color: COLORES.gris, margin: 0, lineHeight: 1.5 }}>
              Qué hacen los espectadores en este momento. Se actualiza solo cada 5 segundos
              {' '}(última lectura {hora(new Date(ultimaLectura).toISOString())}).
            </p>
          </div>
          <button
            type="button"
            onClick={descargarCsv}
            disabled={eventos.length === 0}
            style={{ border: `1px solid ${COLORES.azul}`, background: '#fff', color: COLORES.azul, borderRadius: 999, padding: '9px 18px', fontWeight: 800, cursor: eventos.length ? 'pointer' : 'not-allowed', opacity: eventos.length ? 1 : 0.5 }}
          >
            ⬇ Descargar detalle (CSV)
          </button>
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 14, padding: 14, margin: '14px 0' }}>{error}</div>}

        {!acceso ? (
          <Panel titulo="Sin código de demo">
            <p style={{ margin: 0, color: COLORES.gris }}>Todavía no hay ningún acceso de demo creado (tabla demo_accesos).</p>
          </Panel>
        ) : (
          <>
            <Panel titulo={`Acceso ${acceso.codigo}`}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ padding: '4px 12px', borderRadius: 999, fontWeight: 800, fontSize: 13, background: acceso.activo && (!vence || vence.getTime() > Date.now()) ? '#edf6f0' : '#fef2f2', color: acceso.activo && (!vence || vence.getTime() > Date.now()) ? COLORES.verde : '#b91c1c' }}>
                  {acceso.activo && (!vence || vence.getTime() > Date.now()) ? '● Activo' : '● Inactivo'}
                </span>
                {vence && <span style={{ color: COLORES.gris, fontSize: 13 }}>vence {vence.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                <span style={{ color: COLORES.gris, fontSize: 13 }}>· Habilitado ahora:</span>
                {acceso.habilitadas.length === 0 ? (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>🔒 solo lobby y Mini-Juego</span>
                ) : (
                  acceso.habilitadas.map((h) => (
                    <span key={h} style={{ background: '#eef4fb', color: COLORES.azul, borderRadius: 999, padding: '3px 10px', fontSize: 12.5, fontWeight: 700 }}>
                      🔓 {NOMBRE_HABILITADA[h] ?? h}
                    </span>
                  ))
                )}
              </div>
            </Panel>

            <Panel titulo="Habilitar herramientas para el público (solo lectura: nadie puede cargar ni editar)">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button type="button" onClick={() => void guardarHabilitadas(HERRAMIENTAS_DEMO.map((h) => h.clave))} style={{ border: 'none', background: COLORES.verde, color: '#fff', borderRadius: 999, padding: '8px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  🔓 Habilitar todo
                </button>
                <button type="button" onClick={() => void guardarHabilitadas([])} style={{ border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: 999, padding: '8px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  🔒 Bloquear todo
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                {HERRAMIENTAS_DEMO.map((h) => {
                  const activa = acceso.habilitadas.includes(h.clave);
                  return (
                    <label key={h.clave} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: activa ? '#edf6f0' : '#f9fafb', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: COLORES.azul }}>
                      <input type="checkbox" checked={activa} onChange={() => void guardarHabilitadas(activa ? acceso.habilitadas.filter((x) => x !== h.clave) : [...acceso.habilitadas, h.clave])} style={{ width: 18, height: 18 }} />
                      {activa ? '🔓' : '🔒'} {h.es}
                    </label>
                  );
                })}
              </div>
              <p style={{ fontSize: 12.5, color: COLORES.gris, margin: '10px 0 0', lineHeight: 1.5 }}>
                Visión 3D además necesita estar abierta para la empresa demo en Apertura de Visão 3D (excepción por empresa). Mercadería y Producción dependen de los módulos de la empresa demo; Plan de Acción y Nuestro Sueño solo existen para las empresas que los tienen (hoy Buenaventura y Ocaña), así que en la demo rebotan al lobby aunque estén habilitados.
              </p>
            </Panel>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <Dato titulo="EN LÍNEA AHORA" valor={informe.enLinea} detalle={`de ${informe.total} que entraron`} />
              <Dato titulo="IDIOMA" valor={`${informe.porIdioma.PT ?? 0} PT · ${informe.porIdioma.ES ?? 0} ES`} />
              <Dato titulo="CLICKS" valor={informe.clicks} />
              <Dato titulo="INTENTOS BLOQUEADOS" valor={informe.bloqueos} detalle="tocaron algo todavía no habilitado" />
            </div>

            {Object.keys(informe.dondeEstan).length > 0 && (
              <Panel titulo="Dónde están ahora">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(informe.dondeEstan)
                    .sort((a, b) => b[1] - a[1])
                    .map(([ruta, cantidad]) => (
                      <span key={ruta} style={{ background: '#edf6f0', color: COLORES.verde, borderRadius: 999, padding: '6px 14px', fontWeight: 800 }}>
                        {nombreRuta(ruta)}: {cantidad}
                      </span>
                    ))}
                </div>
              </Panel>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <Panel titulo="📅 Calendario">
                <p style={{ margin: '0 0 8px', fontSize: 14, color: COLORES.azul, fontWeight: 700 }}>
                  {participacion.calendario.creados} creados · {participacion.calendario.editados} editados · {participacion.calendario.intentosBorrar} intentos de eliminar (bloqueados)
                </p>
                {participacion.calendario.ultimos.length === 0 ? (
                  <p style={{ margin: 0, color: COLORES.gris, fontSize: 14 }}>Todavía nadie tocó el calendario.</p>
                ) : (
                  participacion.calendario.ultimos.map((u, i) => (
                    <div key={`${u.cuando}-${i}`} style={{ fontSize: 13.5, padding: '3px 0', color: '#374151' }}>
                      <span style={{ color: COLORES.gris }}>{hora(u.cuando)}</span> · {u.texto}
                    </div>
                  ))
                )}
              </Panel>
              <Panel titulo="📰 Noticias que abrieron">
                <ListaConteo filas={participacion.noticias} vacio="Todavía sin lecturas." />
              </Panel>
              <Panel titulo="💱 Cotizaciones que miraron">
                <ListaConteo filas={participacion.cotizaciones} vacio="Todavía sin consultas." />
              </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              <Panel titulo="Pantallas más vistas">
                {informe.pantallas.length === 0 ? (
                  <p style={{ margin: 0, color: COLORES.gris, fontSize: 14 }}>Todavía sin actividad.</p>
                ) : (
                  informe.pantallas.map((p) => (
                    <div key={p.ruta} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: COLORES.azul, fontWeight: 700 }}>
                        <span>{nombreRuta(p.ruta)}</span>
                        <span>{formatoDuracion(p.segundos)} · {p.personas} {p.personas === 1 ? 'persona' : 'personas'}</span>
                      </div>
                      <div style={{ height: 8, background: '#eef2f6', borderRadius: 999, overflow: 'hidden', marginTop: 4 }}>
                        <div style={{ width: `${tiempoTotalPantallas ? Math.max(3, (p.segundos / tiempoTotalPantallas) * 100) : 0}%`, height: '100%', background: COLORES.verde }} />
                      </div>
                    </div>
                  ))
                )}
              </Panel>

              <Panel titulo="Botones y pestañas más tocados">
                {informe.botones.length === 0 ? (
                  <p style={{ margin: 0, color: COLORES.gris, fontSize: 14 }}>Todavía sin clicks.</p>
                ) : (
                  informe.botones.slice(0, 12).map((b) => (
                    <div key={b.texto} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#374151' }}>{b.texto}</span>
                      <b style={{ color: COLORES.azul, whiteSpace: 'nowrap' }}>{b.veces} ({b.personas})</b>
                    </div>
                  ))
                )}
              </Panel>
            </div>

            <Panel titulo={`Espectadores (${informe.total})`}>
              {informe.filas.length === 0 ? (
                <p style={{ margin: 0, color: COLORES.gris, fontSize: 14 }}>Todavía no entró nadie.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 720 }}>
                    <thead>
                      <tr style={{ background: '#eef4fb', color: COLORES.azul, textAlign: 'left' }}>
                        {['', 'Nombre', 'Idioma', 'Entró', 'Última actividad', 'Ahora en', 'Clicks', 'Bloq.', 'Pantallas vistas'].map((t) => (
                          <th key={t} style={{ padding: '9px 10px', fontWeight: 800, whiteSpace: 'nowrap' }}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {informe.filas.map((f) => (
                        <FilaEspectadorTabla key={f.user_id} fila={f} abierto={abierto === f.user_id} onToggle={() => setAbierto(abierto === f.user_id ? null : f.user_id)} eventos={eventos.filter((e) => e.user_id === f.user_id && e.tipo !== 'LATIDO')} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel titulo="Actividad en vivo">
              {ultimos.length === 0 ? (
                <p style={{ margin: 0, color: COLORES.gris, fontSize: 14 }}>Sin movimientos todavía.</p>
              ) : (
                ultimos.map((e, i) => (
                  <div key={`${e.user_id}-${e.creado_en}-${i}`} style={{ display: 'flex', gap: 10, fontSize: 13.5, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: COLORES.gris, minWidth: 66 }}>{hora(e.creado_en)}</span>
                    <b style={{ color: COLORES.azul, minWidth: 110 }}>{e.nombre}</b>
                    <span style={{ minWidth: 86, fontWeight: 700, color: e.tipo === 'BLOQUEADO' ? '#b91c1c' : e.tipo === 'CLICK' ? COLORES.verde : COLORES.gris }}>
                      {e.tipo === 'VISTA' ? 'abrió' : e.tipo === 'CLICK' ? 'tocó' : e.tipo === 'CAMBIO' ? 'cambió' : e.tipo === 'CALENDARIO' ? 'calendario' : e.tipo === 'BLOQUEADO' ? 'bloqueado' : e.tipo}
                    </span>
                    <span style={{ color: '#374151' }}>{e.tipo === 'VISTA' ? nombreRuta(e.ruta) : (e.detalle ?? nombreRuta(e.ruta))}</span>
                  </div>
                ))
              )}
            </Panel>
          </>
        )}
      </div>
    </main>
  );
}

function FilaEspectadorTabla({
  fila,
  abierto,
  onToggle,
  eventos,
}: {
  fila: ReturnType<typeof armarInforme>['filas'][number];
  abierto: boolean;
  onToggle: () => void;
  eventos: EventoDemo[];
}) {
  return (
    <>
      <tr onClick={onToggle} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer', background: abierto ? '#f8fafc' : 'transparent' }}>
        <td style={{ padding: '9px 10px' }}>{fila.enLinea ? '🟢' : '⚪'}</td>
        <td style={{ padding: '9px 10px', fontWeight: 800, color: COLORES.azul }}>{fila.nombre}</td>
        <td style={{ padding: '9px 10px' }}>{fila.idioma}</td>
        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>{hora(fila.creado_en)}</td>
        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>{hora(fila.ultimaActividad)}</td>
        <td style={{ padding: '9px 10px' }}>{fila.rutaActual && fila.enLinea ? nombreRuta(fila.rutaActual) : '—'}</td>
        <td style={{ padding: '9px 10px' }}>{fila.clicks}</td>
        <td style={{ padding: '9px 10px', color: fila.bloqueos ? '#b91c1c' : 'inherit', fontWeight: fila.bloqueos ? 800 : 400 }}>{fila.bloqueos}</td>
        <td style={{ padding: '9px 10px' }}>
          {Object.entries(fila.segundosPorRuta)
            .sort((a, b) => b[1] - a[1])
            .map(([ruta, s]) => `${nombreRuta(ruta)} (${formatoDuracion(s)})`)
            .join(' · ') || '—'}
        </td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={9} style={{ padding: '4px 10px 14px 40px', background: '#f8fafc' }}>
            {eventos.length === 0 ? (
              <span style={{ color: COLORES.gris }}>Sin movimientos.</span>
            ) : (
              eventos.slice(0, 80).map((e, i) => (
                <div key={`${e.creado_en}-${i}`} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '2px 0' }}>
                  <span style={{ color: COLORES.gris, minWidth: 66 }}>{hora(e.creado_en)}</span>
                  <span style={{ minWidth: 80, fontWeight: 700, color: e.tipo === 'BLOQUEADO' ? '#b91c1c' : e.tipo === 'CLICK' ? COLORES.verde : COLORES.gris }}>{e.tipo}</span>
                  <span>{nombreRuta(e.ruta)}{e.detalle ? ` — ${e.detalle}` : ''}</span>
                </div>
              ))
            )}
          </td>
        </tr>
      )}
    </>
  );
}
