'use client';

// PANEL MAESTRO → CUENTAS SIN OPERACIÓN
//
// Exclusivo del Desarrollador (es_admin_plataforma). Regla dura: ninguna
// cuenta del plan de cuentas puede quedar sin al menos una operación que la
// use. Esta pantalla corre las dos auditorías de la base — las empresas
// actuales y los planes maestros que se copian a las empresas nuevas — y marca
// qué es estructural, qué está pendiente con fecha, y qué es NUEVO (hay que
// resolverlo). Solo lectura.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  clasificarCuentaSinOperacion,
  resumenAuditoria,
  type EstadoCuentaSinOperacion,
} from '@/lib/auditoriaCuentas';

const COLORES = { azul: '#1f3a5f', verde: '#2e8b57', gris: '#6e7781' };

type FilaEmpresa = {
  empresa_id: string;
  empresa: string;
  perfil: string | null;
  codigo: string;
  nombre: string;
  tipo_saldo: string | null;
  rol_contable: string | null;
  movimientos: number;
};

type FilaMaestro = {
  perfil: string;
  pais: string | null;
  codigo: string;
  nombre: string;
  tipo_saldo: string | null;
  rol_contable: string | null;
};

const ESTILO_ESTADO: Record<EstadoCuentaSinOperacion, { texto: string; color: string; fondo: string }> = {
  ESTRUCTURAL: { texto: 'Estructural', color: '#475569', fondo: '#f1f5f9' },
  PENDIENTE: { texto: 'Pendiente (fin de mes)', color: '#b45309', fondo: '#fffbeb' },
  NUEVA: { texto: 'NUEVA — resolver', color: '#b91c1c', fondo: '#fef2f2' },
};

function Etiqueta({ estado }: { estado: EstadoCuentaSinOperacion }) {
  const e = ESTILO_ESTADO[estado];
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, background: e.fondo, color: e.color, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {e.texto}
    </span>
  );
}

export default function CuentasSinOperacionPage() {
  const router = useRouter();

  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [empresas, setEmpresas] = useState<FilaEmpresa[]>([]);
  const [maestro, setMaestro] = useState<FilaMaestro[]>([]);
  const [error, setError] = useState('');

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

      const [vivas, plantilla] = await Promise.all([
        supabase.rpc('cuentas_sin_operacion'),
        supabase.rpc('maestro_cuentas_sin_operacion'),
      ]);

      if (vivas.error || plantilla.error) {
        setError((vivas.error ?? plantilla.error)?.message ?? 'No se pudo correr la auditoría.');
        return;
      }

      setEmpresas((vivas.data ?? []) as FilaEmpresa[]);
      setMaestro((plantilla.data ?? []) as FilaMaestro[]);
    }

    iniciar();
  }, [router]);

  const resumenEmpresas = useMemo(() => resumenAuditoria(empresas), [empresas]);
  const resumenMaestro = useMemo(() => resumenAuditoria(maestro), [maestro]);
  const nuevas = resumenEmpresas.NUEVA + resumenMaestro.NUEVA;

  const empresasAgrupadas = useMemo(() => {
    const mapa = new Map<string, FilaEmpresa[]>();
    for (const fila of empresas) mapa.set(fila.empresa, [...(mapa.get(fila.empresa) ?? []), fila]);
    return [...mapa.entries()];
  }, [empresas]);

  const maestroAgrupado = useMemo(() => {
    const mapa = new Map<string, FilaMaestro[]>();
    for (const fila of maestro) {
      const clave = `${fila.perfil} (${fila.pais ?? '—'})`;
      mapa.set(clave, [...(mapa.get(clave) ?? []), fila]);
    }
    return [...mapa.entries()];
  }, [maestro]);

  if (autorizado === null) {
    return <div style={{ padding: 40, color: COLORES.gris }}>Cargando...</div>;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f7f9', padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Link href="/panel-maestro" style={{ color: COLORES.gris, textDecoration: 'none', fontSize: 14 }}>
          ← Volver al Panel Maestro
        </Link>

        <h1 style={{ color: COLORES.azul, margin: '10px 0 4px' }}>🧾 Cuentas sin operación</h1>
        <p style={{ color: COLORES.gris, marginTop: 0, lineHeight: 1.6 }}>
          Regla: toda cuenta del plan tiene que tener al menos una operación que la use. Acá se ve qué cuentas la incumplen, en las empresas actuales y en los
          planes maestros (lo que reciben las empresas nuevas).
        </p>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 14, padding: 14, marginBottom: 16 }}>{error}</div>}

        <div
          style={{
            background: nuevas === 0 ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${nuevas === 0 ? '#bbf7d0' : '#fecaca'}`,
            color: nuevas === 0 ? '#15803d' : '#b91c1c',
            borderRadius: 16,
            padding: '14px 18px',
            fontWeight: 800,
            marginBottom: 20,
          }}
        >
          {nuevas === 0
            ? '✓ No hay cuentas NUEVAS sin operación. Quedan solo las estructurales y las pendientes con fecha.'
            : `⚠️ ${nuevas} cuenta(s) NUEVAS sin operación: hay que asignarles una operación (o desactivarlas si no se usan).`}
          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4, color: '#475569' }}>
            Empresas: {resumenEmpresas.NUEVA} nuevas · {resumenEmpresas.PENDIENTE} pendientes · {resumenEmpresas.ESTRUCTURAL} estructurales — Planes maestros:{' '}
            {resumenMaestro.NUEVA} nuevas · {resumenMaestro.PENDIENTE} pendientes · {resumenMaestro.ESTRUCTURAL} estructurales
          </div>
        </div>

        <Seccion titulo="Empresas actuales">
          {empresasAgrupadas.length === 0 ? (
            <p style={{ color: COLORES.gris }}>Todas las cuentas de todas las empresas tienen operación. 🎉</p>
          ) : (
            empresasAgrupadas.map(([empresa, filas]) => (
              <Bloque key={empresa} titulo={`${empresa} — ${filas[0].perfil ?? 'sin perfil'}`}>
                {filas.map((f) => (
                  <Fila key={f.codigo + f.nombre} codigo={f.codigo} nombre={f.nombre} tipo={f.tipo_saldo} detalle={f.movimientos > 0 ? `${f.movimientos} movimientos` : 'sin movimientos'}>
                    <Etiqueta estado={clasificarCuentaSinOperacion(f)} />
                  </Fila>
                ))}
              </Bloque>
            ))
          )}
        </Seccion>

        <Seccion titulo="Planes maestros (empresas nuevas)">
          {maestroAgrupado.length === 0 ? (
            <p style={{ color: COLORES.gris }}>Todas las cuentas de los planes maestros tienen operación. 🎉</p>
          ) : (
            maestroAgrupado.map(([clave, filas]) => (
              <Bloque key={clave} titulo={clave}>
                {filas.map((f) => (
                  <Fila key={f.codigo + f.nombre} codigo={f.codigo} nombre={f.nombre} tipo={f.tipo_saldo}>
                    <Etiqueta estado={clasificarCuentaSinOperacion(f)} />
                  </Fila>
                ))}
              </Bloque>
            ))
          )}
        </Seccion>
      </div>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 24, padding: 22, marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 12px', color: COLORES.azul, fontSize: 20 }}>{titulo}</h2>
      {children}
    </section>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 800, color: COLORES.azul, fontSize: 14, marginBottom: 6 }}>{titulo}</div>
      {children}
    </div>
  );
}

function Fila({ codigo, nombre, tipo, detalle, children }: { codigo: string; nombre: string; tipo: string | null; detalle?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid #eef2f6', fontSize: 13.5 }}>
      <span style={{ color: COLORES.gris, minWidth: 80 }}>{codigo}</span>
      <span style={{ flex: 1, minWidth: 180, fontWeight: 700, color: '#1f2937' }}>{nombre}</span>
      <span style={{ color: COLORES.gris, minWidth: 80 }}>{tipo ?? ''}</span>
      {detalle && <span style={{ color: COLORES.gris, fontSize: 12 }}>{detalle}</span>}
      {children}
    </div>
  );
}
