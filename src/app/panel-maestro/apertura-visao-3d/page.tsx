'use client';

// PANEL MAESTRO → APERTURA DE VISÃO 3D
//
// Exclusivo del Desarrollador (es_admin_plataforma). Decide quién ve Visão 3D sin tocar código: un interruptor por perfil de
// empresa, excepciones por empresa (abrir o cerrar una puntual, gana sobre su perfil) y un apagado general. Se guarda en
// `visao3d_apertura`; si esa tabla no se puede leer, la app usa el respaldo del código (lib/visao3dEmpresas.ts).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { FilaApertura } from '@/lib/visao3dEmpresas';

const COLORES = { azul: '#1f3a5f', verde: '#2e8b57', gris: '#6e7781', rojo: '#b91c1c' };

const PERFILES = [
  { codigo: 'FAMILIAR', nombre: 'Familiar', detalle: 'La casa de siempre, con jardín y pileta.' },
  { codigo: 'COMERCIAL', nombre: 'Comercial', detalle: 'Local con toldo, mostrador y depósito.' },
  { codigo: 'SERVICIOS', nombre: 'Servicios', detalle: 'Oficina de vidrio con recepción y reuniones.' },
  { codigo: 'MIXTO', nombre: 'Mixto', detalle: 'Local con toldo verde y jardín.' },
  { codigo: 'PRODUCCION', nombre: 'Producción', detalle: 'Taller con techo de sierra y depósito.' },
];

type Empresa = { id: string; nombre: string; perfil: string | null; onboarding: boolean };

function Interruptor({ activo, onCambiar, deshabilitado, etiqueta }: { activo: boolean; onCambiar: () => void; deshabilitado?: boolean; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={onCambiar}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        border: 'none',
        padding: 3,
        cursor: deshabilitado ? 'wait' : 'pointer',
        background: activo ? COLORES.verde : '#cbd5e1',
        display: 'flex',
        justifyContent: activo ? 'flex-end' : 'flex-start',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

export default function AperturaVisao3DPage() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [filas, setFilas] = useState<FilaApertura[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    const [{ data: reglas, error: errorReglas }, { data: lista }] = await Promise.all([
      supabase.from('visao3d_apertura').select('tipo, clave, abierto'),
      supabase.from('empresas').select('id, nombre, onboarding_completado, perfiles_empresa(codigo)').order('nombre'),
    ]);

    if (errorReglas) setError(`No se pudo leer la apertura: ${errorReglas.message}`);
    setFilas((reglas ?? []) as FilaApertura[]);
    setEmpresas(
      (lista ?? []).map((e) => {
        const rel = e.perfiles_empresa as { codigo: string }[] | { codigo: string } | null;
        return { id: e.id as string, nombre: e.nombre as string, perfil: (Array.isArray(rel) ? rel[0]?.codigo : rel?.codigo) ?? null, onboarding: Boolean(e.onboarding_completado) };
      })
    );
  }, []);

  useEffect(() => {
    async function iniciar() {
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
      await cargar();
    }
    void iniciar();
  }, [router, cargar]);

  const fila = useCallback((tipo: string, clave: string) => filas.find((f) => f.tipo === tipo && f.clave === clave), [filas]);
  const global = fila('GLOBAL', 'todos')?.abierto !== false;

  async function guardar(tipo: string, clave: string, abierto: boolean | null) {
    setError('');
    setGuardando(`${tipo}|${clave}`);
    const { error: errorGuardar } =
      abierto === null
        ? await supabase.from('visao3d_apertura').delete().eq('tipo', tipo).eq('clave', clave)
        : await supabase.from('visao3d_apertura').upsert({ tipo, clave, abierto, actualizado_en: new Date().toISOString() }, { onConflict: 'tipo,clave' });
    if (errorGuardar) setError(`No se pudo guardar: ${errorGuardar.message}`);
    await cargar();
    setGuardando(null);
  }

  const cuentaPorPerfil = useMemo(() => {
    const cuenta = new Map<string, number>();
    empresas.forEach((e) => e.perfil && cuenta.set(e.perfil, (cuenta.get(e.perfil) ?? 0) + 1));
    return cuenta;
  }, [empresas]);

  const conExcepcion = empresas.filter((e) => fila('EMPRESA', e.id));
  const candidatas = busqueda.trim()
    ? empresas.filter((e) => !fila('EMPRESA', e.id) && e.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 6)
    : [];

  if (autorizado === null) return <div style={{ padding: 40, color: COLORES.gris }}>Cargando...</div>;

  const tarjeta = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: '18px 20px', marginBottom: 18 } as const;

  return (
    <main style={{ minHeight: '100vh', background: '#f4f7fb', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link href="/panel-maestro" style={{ color: COLORES.azul, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          ← Panel Maestro
        </Link>
        <h1 style={{ color: COLORES.azul, fontSize: 26, margin: '14px 0 4px' }}>🏢 Apertura de Visão 3D</h1>
        <p style={{ color: COLORES.gris, fontSize: 14, marginTop: 0, lineHeight: 1.5 }}>
          Elegí qué perfiles ven Visão 3D. El cambio se nota al recargar la app de la empresa; no hace falta publicar nada. El asistente de cada empresa nunca lo ve, y las empresas que no completaron el onboarding van primero a su bienvenida.
        </p>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: COLORES.rojo, borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13.5, fontWeight: 600 }}>{error}</div>}

        <section style={{ ...tarjeta, borderColor: global ? '#e5e7eb' : '#fecaca', background: global ? '#fff' : '#fef2f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: global ? COLORES.azul : COLORES.rojo, fontSize: 16 }}>{global ? 'Visão 3D encendido' : '⛔ Visão 3D APAGADO para todos'}</div>
              <div style={{ color: COLORES.gris, fontSize: 13, marginTop: 2 }}>Apagado general: cierra Visão 3D para todas las empresas de golpe (ante un problema). Los interruptores de abajo se conservan.</div>
            </div>
            <Interruptor activo={global} etiqueta="Visão 3D encendido" deshabilitado={guardando === 'GLOBAL|todos'} onCambiar={() => void guardar('GLOBAL', 'todos', !global)} />
          </div>
        </section>

        <section style={{ ...tarjeta, opacity: global ? 1 : 0.55 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, color: COLORES.gris, textTransform: 'uppercase', marginBottom: 6 }}>Por perfil de empresa</div>
          {PERFILES.map((p) => {
            const abierto = fila('PERFIL', p.codigo)?.abierto === true;
            return (
              <div key={p.codigo} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid #eef1f5' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: COLORES.azul, fontSize: 15 }}>
                    {p.nombre} <span style={{ color: COLORES.gris, fontWeight: 600, fontSize: 12.5 }}>· {cuentaPorPerfil.get(p.codigo) ?? 0} {cuentaPorPerfil.get(p.codigo) === 1 ? 'empresa' : 'empresas'}</span>
                  </div>
                  <div style={{ color: COLORES.gris, fontSize: 12.5 }}>{p.detalle}</div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: abierto ? COLORES.verde : COLORES.gris, minWidth: 54, textAlign: 'right' }}>{abierto ? 'Abierto' : 'Cerrado'}</span>
                <Interruptor activo={abierto} etiqueta={`Visão 3D para ${p.nombre}`} deshabilitado={guardando === `PERFIL|${p.codigo}`} onCambiar={() => void guardar('PERFIL', p.codigo, !abierto)} />
              </div>
            );
          })}
        </section>

        <section style={{ ...tarjeta, opacity: global ? 1 : 0.55 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, color: COLORES.gris, textTransform: 'uppercase', marginBottom: 4 }}>Excepciones por empresa</div>
          <div style={{ color: COLORES.gris, fontSize: 12.5, marginBottom: 10 }}>Una excepción gana sobre el perfil: sirve para abrirlo a una sola empresa de un perfil cerrado, o cerrarlo a una de un perfil abierto.</div>

          {conExcepcion.length === 0 && <div style={{ color: COLORES.gris, fontSize: 13, padding: '6px 0' }}>Sin excepciones.</div>}
          {conExcepcion.map((e) => {
            const abierto = fila('EMPRESA', e.id)?.abierto === true;
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #eef1f5' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: COLORES.azul, fontSize: 14.5 }}>{e.nombre}</div>
                  <div style={{ color: COLORES.gris, fontSize: 12 }}>{e.perfil ?? 'sin perfil'}{e.onboarding ? '' : ' · onboarding incompleto'}</div>
                </div>
                <Interruptor activo={abierto} etiqueta={`Visão 3D para ${e.nombre}`} deshabilitado={guardando === `EMPRESA|${e.id}`} onCambiar={() => void guardar('EMPRESA', e.id, !abierto)} />
                <button type="button" onClick={() => void guardar('EMPRESA', e.id, null)} title="Quitar la excepción (vuelve a valer su perfil)" style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: COLORES.gris, fontWeight: 700 }}>
                  Quitar
                </button>
              </div>
            );
          })}

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar una empresa para agregar una excepción…"
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, padding: '11px 12px', borderRadius: 10, border: '1px solid #d6dee5', fontSize: 14 }}
          />
          {candidatas.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                setBusqueda('');
                void guardar('EMPRESA', e.id, fila('PERFIL', e.perfil ?? '')?.abierto !== true);
              }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderTop: '1px solid #eef1f5', background: 'transparent', padding: '10px 4px', cursor: 'pointer', color: COLORES.azul, fontWeight: 700, fontSize: 14 }}
            >
              {e.nombre} <span style={{ color: COLORES.gris, fontWeight: 600, fontSize: 12 }}>· {e.perfil ?? 'sin perfil'} · {fila('PERFIL', e.perfil ?? '')?.abierto === true ? 'agregar excepción: cerrar' : 'agregar excepción: abrir'}</span>
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
