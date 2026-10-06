'use client';

// PANEL MAESTRO → PROBAR TUTORIAL
//
// Exclusivo del Desarrollador (es_admin_plataforma). Recorre el onboarding que
// ven las empresas nuevas (wizard "Antes de arrancar" + tutorial guiado con el
// Sabio) con datos de ejemplo: NO consulta ni escribe nada en la base, así que
// se puede repetir las veces que haga falta y con cualquier perfil.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { MiniJuego } from '@/components/panel/MiniJuego';
import { SabioWidget } from '@/components/panel/SabioWidget';
import { pasosTutorial, msgTutorialPaso } from '@/app/contabilidad/i18n';
import { msgBienvenidaTutorialPanel } from '@/app/panel-de-control/i18n';
import {
  PERFILES_SIMULADOS,
  configuracionPerfil,
  datosSimulados,
  esPerfilSimulado,
  type PerfilSimulado,
} from '@/lib/tutorialSimulacion';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type Vista = 'menu' | 'tutorial' | 'fin';

export default function ProbarTutorialPage() {
  const router = useRouter();

  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [perfil, setPerfil] = useState<PerfilSimulado>('SERVICIOS');
  const [idioma, setIdioma] = useState<'ES' | 'PT'>('ES');
  const [vista, setVista] = useState<Vista>('menu');

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

      // Al terminar el wizard simulado vuelve acá directo al tutorial guiado.
      const params = new URLSearchParams(window.location.search);
      const perfilUrl = params.get('perfil');
      if (esPerfilSimulado(perfilUrl)) setPerfil(perfilUrl);
      if (params.get('idioma') === 'PT') setIdioma('PT');
      if (params.get('paso') === 'tutorial') setVista('tutorial');

      setAutorizado(true);
    }

    iniciar();
  }, [router]);

  // Estable entre renders: MiniJuego lo usa como dependencia de sus efectos.
  const simulacion = useMemo(() => datosSimulados(perfil, idioma), [perfil, idioma]);

  if (autorizado === null) {
    return <div style={{ padding: 40, color: COLORES.gris }}>Cargando...</div>;
  }

  const { esFamiliar, manejaMercaderia } = configuracionPerfil(perfil);
  const operaciones = pasosTutorial(esFamiliar, manejaMercaderia);

  if (vista === 'tutorial') {
    return (
      <MiniJuego
        empresaId="simulacion"
        idioma={idioma}
        esFamiliar={esFamiliar}
        simbolo="$"
        colores={{ azul: COLORES.azul, verde: COLORES.verde, acento: COLORES.gris, blanco: COLORES.blanco }}
        simulacion={simulacion}
        tutorial={{ operaciones, mensaje: (paso) => msgTutorialPaso(idioma, paso, operaciones[paso] ?? '') }}
        onCompletadoTutorial={() => setVista('fin')}
        onCerrar={() => setVista('menu')}
      />
    );
  }

  if (vista === 'fin') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7f9', padding: 24 }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', borderRadius: 10, padding: '6px 12px', fontSize: 12.5, fontWeight: 800, marginBottom: 20 }}>
            🧪 MODO PRUEBA — así termina el tutorial (en la empresa real se marca el onboarding como completo y se abre el Panel de Control)
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', background: COLORES.azul, borderRadius: 24, padding: 24 }}>
            <SabioWidget
              colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
              idioma={idioma}
              frase={msgBienvenidaTutorialPanel(idioma)}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setVista('menu')} style={botonPrimario}>
              Volver a probar
            </button>
            <Link href="/panel-maestro" style={botonSecundario}>
              Volver al panel maestro
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-app, linear-gradient(180deg, #f5f7f9 0%, #eaf0f6 100%))', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/panel-maestro" style={{ color: COLORES.azul, fontSize: 13, textDecoration: 'none' }}>
          ← Volver al panel maestro
        </Link>

        <h1 style={{ margin: '12px 0 4px', color: COLORES.azul, fontSize: 28 }}>🧪 Probar tutorial de empresas nuevas</h1>
        <p style={{ margin: '0 0 20px', color: COLORES.gris, fontSize: 14, lineHeight: 1.5 }}>
          Recorré lo que ve una empresa nueva, con datos de ejemplo. <strong>No se guarda nada</strong> en la base: es solo para el
          Desarrollador y se puede repetir cuantas veces quieras.
        </p>

        <section style={tarjeta}>
          <div style={etiqueta}>Perfil a simular</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {PERFILES_SIMULADOS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPerfil(p.id)} style={chip(perfil === p.id)}>
                {p.nombre}
              </button>
            ))}
          </div>

          <div style={etiqueta}>Idioma</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['ES', 'PT'] as const).map((i) => (
              <button key={i} type="button" onClick={() => setIdioma(i)} style={chip(idioma === i)}>
                {i === 'ES' ? 'Español' : 'Português'}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 13, color: COLORES.gris, margin: '0 0 16px', lineHeight: 1.5 }}>
            Operaciones guiadas de este perfil: <strong>{operaciones.join(' → ')}</strong>
            {esFamiliar ? '. El wizard de Familia solo pide la categoría.' : '.'}
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => router.push(`/bienvenida?simulacion=${perfil}&idioma=${idioma}`)}
              style={botonPrimario}
            >
              ▶ Recorrido completo (wizard + tutorial)
            </button>
            <button type="button" onClick={() => setVista('tutorial')} style={botonSecundarioBtn}>
              Solo el tutorial guiado
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const tarjeta: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 20,
  padding: 22,
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 28px rgba(31,58,95,0.06)',
};

const etiqueta: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: COLORES.verde, marginBottom: 8, textTransform: 'uppercase' };

const botonPrimario: React.CSSProperties = {
  background: COLORES.azul,
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  padding: '12px 18px',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
};

const botonSecundarioBtn: React.CSSProperties = {
  background: '#fff',
  color: COLORES.azul,
  border: `1px solid ${COLORES.azul}`,
  borderRadius: 12,
  padding: '12px 18px',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};

const botonSecundario: React.CSSProperties = { ...botonSecundarioBtn, textDecoration: 'none', display: 'inline-block' };

function chip(activo: boolean): React.CSSProperties {
  return {
    border: `1px solid ${activo ? COLORES.azul : '#d1d5db'}`,
    background: activo ? COLORES.azul : '#fff',
    color: activo ? '#fff' : '#1f2937',
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  };
}
