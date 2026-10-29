'use client';

// PANEL MAESTRO → CAJA DE MATERIALES
//
// Exclusivo del Desarrollador (es_admin_plataforma). Inventario de todo lo que existe en el sistema (herramientas, pantallas,
// piezas del lobby, perfiles, pantallas del Panel Maestro) y lugar donde se guarda lo que se deja de usar. Mandar algo a la
// caja lo esconde a las empresas pero no borra nada, y antes de confirmar se muestran las consecuencias. El inventario vive
// en lib/cajaMateriales.ts; el estado, en la tabla `caja_materiales_estado`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { cargarCaja, empresasConTarjetasFijadas, mandarALaCaja, sacarDeLaCaja, type EstadoCaja } from '@/lib/cajaMaterialesDatos';
import { INVENTARIO, NOMBRE_TIPO, evaluarEnvioALaCaja, evaluarSalidaDeLaCaja, piezaPorClave, type Pieza, type TipoPieza } from '@/lib/cajaMateriales';

const COLORES = { azul: '#1f3a5f', verde: '#2e8b57', gris: '#6e7781', rojo: '#b91c1c', ambar: '#92400e' };
const TIPOS = Object.keys(NOMBRE_TIPO) as TipoPieza[];

function Insignia({ texto, fondo, color }: { texto: string; fondo: string; color: string }) {
  return <span style={{ background: fondo, color, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{texto}</span>;
}

function Lista({ titulo, items, color }: { titulo: string; items: string[]; color?: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: color ?? COLORES.azul, letterSpacing: 0.4 }}>{titulo}</div>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.5 }}>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default function CajaDeMaterialesPage() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [caja, setCaja] = useState<EstadoCaja[]>([]);
  const [filtro, setFiltro] = useState<'TODO' | 'CAJA' | 'ACTIVAS' | TipoPieza>('TODO');
  const [busqueda, setBusqueda] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Pieza | null>(null);
  const [sacando, setSacando] = useState<Pieza | null>(null);
  const [motivo, setMotivo] = useState('');
  const [entendi, setEntendi] = useState(false);
  const [datoReal, setDatoReal] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  const recargar = useCallback(async () => setCaja(await cargarCaja()), []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return router.push('/login');
      const { data } = await supabase.from('perfiles').select('es_admin_plataforma').eq('id', u.user.id).maybeSingle();
      if (!data?.es_admin_plataforma) return router.push('/');
      setAutorizado(true);
      await recargar();
    })();
  }, [router, recargar]);

  const enCaja = useMemo(() => new Set(caja.map((c) => c.clave)), [caja]);
  const estadoDe = useMemo(() => new Map(caja.map((c) => [c.clave, c])), [caja]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return INVENTARIO.filter((p) => {
      if (filtro === 'CAJA' && !enCaja.has(p.clave)) return false;
      if (filtro === 'ACTIVAS' && enCaja.has(p.clave)) return false;
      if (TIPOS.includes(filtro as TipoPieza) && p.tipo !== filtro) return false;
      if (q && !`${p.nombre} ${p.descripcion} ${p.ruta ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filtro, busqueda, enCaja]);

  async function abrirEnvio(p: Pieza) {
    setMotivo('');
    setEntendi(false);
    setDatoReal(null);
    setEnviando(p);
    if (p.clave === 'lanzamiento-rapido') {
      const n = await empresasConTarjetasFijadas();
      setDatoReal(n === null ? null : n === 0 ? 'Hoy ninguna empresa tiene tarjetas fijadas.' : `Hoy ${n} ${n === 1 ? 'empresa tiene' : 'empresas tienen'} tarjetas fijadas en esta pantalla: se conservan.`);
    }
  }

  async function confirmarEnvio() {
    if (!enviando) return;
    setTrabajando(true);
    try {
      await mandarALaCaja(enviando.clave, motivo);
      setMensaje({ ok: true, texto: `«${enviando.nombre}» está ahora en la caja de materiales.` });
      setEnviando(null);
      await recargar();
    } catch {
      setMensaje({ ok: false, texto: 'No se pudo guardar en la caja. Probá de nuevo.' });
    }
    setTrabajando(false);
  }

  async function confirmarSalida() {
    if (!sacando) return;
    setTrabajando(true);
    try {
      await sacarDeLaCaja(sacando.clave);
      setMensaje({ ok: true, texto: `«${sacando.nombre}» volvió a estar activa.` });
      setSacando(null);
      await recargar();
    } catch {
      setMensaje({ ok: false, texto: 'No se pudo sacar de la caja. Probá de nuevo.' });
    }
    setTrabajando(false);
  }

  if (autorizado === null) return <div style={{ padding: 40, color: COLORES.gris }}>Cargando...</div>;

  const evaluacion = enviando ? evaluarEnvioALaCaja(enviando.clave, enCaja) : null;
  const salida = sacando ? evaluarSalidaDeLaCaja(sacando.clave, enCaja) : null;
  const conectadas = INVENTARIO.filter((p) => p.interruptor === 'conectado').length;
  const boton = { border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' } as const;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--fondo-app, #f4f7fb)', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link href="/panel-maestro" style={{ color: COLORES.azul, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          ← Panel Maestro
        </Link>
        <h1 style={{ color: COLORES.azul, fontSize: 26, margin: '14px 0 4px' }}>📦 Caja de materiales</h1>
        <p style={{ color: COLORES.gris, fontSize: 14, marginTop: 0, lineHeight: 1.5 }}>
          Inventario de todo el sistema. Lo que se manda a la caja deja de verse en las empresas pero <b>no se borra</b>: código, tablas y datos quedan intactos y se puede sacar cuando quieras. Antes de confirmar siempre se muestran las consecuencias.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
          {[
            ['Piezas inventariadas', INVENTARIO.length],
            ['En la caja', caja.length],
            ['Con interruptor conectado', conectadas],
          ].map(([t, v]) => (
            <div key={t as string} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '10px 16px', minWidth: 150 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORES.gris, letterSpacing: 0.8 }}>{(t as string).toUpperCase()}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: COLORES.azul }}>{v}</div>
            </div>
          ))}
        </div>

        {mensaje && (
          <div role="status" style={{ background: mensaje.ok ? '#ecfdf5' : '#fef2f2', color: mensaje.ok ? '#047857' : COLORES.rojo, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 14 }}>
            {mensaje.texto}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {([['TODO', 'Todo'], ['CAJA', '📦 En la caja'], ['ACTIVAS', 'Activas'], ...TIPOS.map((t) => [t, NOMBRE_TIPO[t]])] as [string, string][]).map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setFiltro(id as typeof filtro)} style={{ ...boton, padding: '7px 14px', background: filtro === id ? COLORES.azul : '#fff', color: filtro === id ? '#fff' : COLORES.azul, border: `1px solid ${COLORES.azul}55` }}>
              {texto}
            </button>
          ))}
        </div>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, descripción o ruta…" style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 12, border: '1px solid #d6dee5', fontSize: 14, marginBottom: 14 }} />

        {TIPOS.map((tipo) => {
          const lista = visibles.filter((p) => p.tipo === tipo);
          if (lista.length === 0) return null;
          return (
            <section key={tipo} style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 14, letterSpacing: 1, color: COLORES.gris, margin: '0 0 8px' }}>{NOMBRE_TIPO[tipo].toUpperCase()} ({lista.length})</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {lista.map((p) => {
                  const guardada = enCaja.has(p.clave);
                  const estado = estadoDe.get(p.clave);
                  const usadaPor = INVENTARIO.filter((x) => x.necesita?.includes(p.clave));
                  const abiertaAhora = abierta === p.clave;
                  return (
                    <article key={p.clave} style={{ background: guardada ? '#fffbeb' : '#fff', border: `1px solid ${guardada ? '#fcd34d' : '#e5e7eb'}`, borderRadius: 16, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <button type="button" onClick={() => setAbierta(abiertaAhora ? null : p.clave)} aria-expanded={abiertaAhora} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', flex: '1 1 320px' }}>
                          <div style={{ fontWeight: 800, color: COLORES.azul, fontSize: 15 }}>
                            {abiertaAhora ? '▾' : '▸'} {p.emoji} {p.nombre}
                          </div>
                          <div style={{ fontSize: 13, color: COLORES.gris, marginTop: 3, lineHeight: 1.45 }}>{p.descripcion}</div>
                        </button>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {guardada ? (
                            <Insignia texto="📦 En la caja" fondo="#fef3c7" color={COLORES.ambar} />
                          ) : p.interruptor === 'nucleo' ? (
                            <Insignia texto="Núcleo" fondo="#e0e7ff" color="#3730a3" />
                          ) : p.interruptor === 'conectado' ? (
                            <Insignia texto="Activa · con interruptor" fondo="#dcfce7" color="#166534" />
                          ) : (
                            <Insignia texto="Activa · interruptor pendiente" fondo="#f1f5f9" color={COLORES.gris} />
                          )}
                          {guardada ? (
                            <button type="button" onClick={() => { setMensaje(null); setSacando(p); }} style={{ ...boton, background: COLORES.verde, color: '#fff' }}>Sacar de la caja</button>
                          ) : p.interruptor === 'conectado' ? (
                            <button type="button" onClick={() => { setMensaje(null); void abrirEnvio(p); }} style={{ ...boton, background: '#fff', color: COLORES.ambar, border: '1px solid #fcd34d' }}>Mandar a la caja…</button>
                          ) : null}
                        </div>
                      </div>

                      {guardada && estado && (
                        <div style={{ fontSize: 12.5, color: COLORES.ambar, marginTop: 8 }}>
                          Guardada el {new Date(estado.movido_en).toLocaleDateString('es-AR')}
                          {estado.motivo ? ` · Motivo: ${estado.motivo}` : ''}
                        </div>
                      )}

                      {abiertaAhora && (
                        <div style={{ marginTop: 10, borderTop: '1px dashed #e5e7eb', paddingTop: 8 }}>
                          {p.ruta && <div style={{ fontSize: 13 }}><b>Ruta:</b> <code>{p.ruta}</code></div>}
                          <Lista titulo="ARCHIVOS" items={p.archivos ?? []} />
                          <Lista titulo="TABLAS / DATOS" items={p.tablas ?? []} />
                          <Lista titulo="CONFIGURACIÓN RELEVANTE" items={p.configuracion ?? []} />
                          <Lista titulo="NECESITA" items={(p.necesita ?? []).map((c) => piezaPorClave(c)?.nombre ?? c)} />
                          <Lista titulo="LA NECESITAN" items={usadaPor.map((x) => x.nombre)} />
                          <Lista titulo="SI SE GUARDA, SE ESCONDE" items={p.seOculta ?? []} color={COLORES.ambar} />
                          <Lista titulo="SI SE GUARDA, SE CONSERVA" items={p.seConserva ?? []} color={COLORES.verde} />
                          {p.interruptor === 'pendiente' && <p style={{ fontSize: 12.5, color: COLORES.gris, marginBottom: 0 }}>Para poder mandarla a la caja hay que conectar su interruptor; se hace cuando decidas guardarla.</p>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
        {visibles.length === 0 && <p style={{ color: COLORES.gris }}>No hay piezas con ese filtro.</p>}
      </div>

      {enviando && evaluacion && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 22, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ margin: 0, color: COLORES.azul }}>Mandar a la caja: {enviando.emoji} {enviando.nombre}</h3>
            {evaluacion.bloqueos.length > 0 && <Lista titulo="NO SE PUEDE POR AHORA" items={evaluacion.bloqueos} color={COLORES.rojo} />}
            <Lista titulo="SE ESCONDE" items={evaluacion.seOculta} color={COLORES.ambar} />
            <Lista titulo="CONSECUENCIAS PARA LOS CLIENTES" items={[...evaluacion.consecuencias, ...(datoReal ? [datoReal] : [])]} color={COLORES.ambar} />
            <Lista titulo="NO SE TOCA" items={evaluacion.seConserva} color={COLORES.verde} />
            {evaluacion.permitido && (
              <>
                <label style={{ display: 'block', marginTop: 14, fontSize: 13, fontWeight: 700, color: COLORES.azul }}>
                  Motivo (opcional, para acordarte después)
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={2} style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #d6dee5', fontSize: 14 }} />
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13.5 }}>
                  <input type="checkbox" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} />
                  Leí las consecuencias y quiero guardarla.
                </label>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setEnviando(null)} disabled={trabajando} style={{ ...boton, background: '#f1f5f9', color: COLORES.azul }}>Cancelar</button>
              <button type="button" onClick={confirmarEnvio} disabled={trabajando || !evaluacion.permitido || !entendi} style={{ ...boton, background: COLORES.ambar, color: '#fff', opacity: !evaluacion.permitido || !entendi ? 0.5 : 1 }}>
                {trabajando ? '…' : 'Mandar a la caja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sacando && salida && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 22, maxWidth: 520, width: '100%' }}>
            <h3 style={{ margin: 0, color: COLORES.azul }}>Sacar de la caja: {sacando.emoji} {sacando.nombre}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.5 }}>Vuelve a verse en las empresas apenas se recargue la pantalla.</p>
            <Lista titulo="ATENCIÓN" items={salida.avisos} color={COLORES.ambar} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setSacando(null)} disabled={trabajando} style={{ ...boton, background: '#f1f5f9', color: COLORES.azul }}>Cancelar</button>
              <button type="button" onClick={confirmarSalida} disabled={trabajando} style={{ ...boton, background: COLORES.verde, color: '#fff' }}>{trabajando ? '…' : 'Sacar de la caja'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
