'use client';

// PERSONALIZAÇÃO DE CORES (Bloque G del Día 1 de seguridad)
// configuracion_dashboard existía en la base desde antes, con RLS
// activado pero sin ninguna política — nadie podía leerla ni
// escribirla, y no había pantalla para editarla. Se agrega acá el
// mínimo: los 3 colores del panel + el fondo (CONFIGURAÇÕES →
// Apariencia). El mensaje de bienvenida, el subtítulo y los checkboxes
// de mostrar gamificación/objetivos/gráficos quedan afuera a pedido
// explícito (no se van a usar).
//
// Extraído de app/configuracoes/page.tsx — mismo comportamiento, solo
// en su propio archivo.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FONDOS_DISPONIBLES, aplicarTemaGlobal } from '@/lib/apariencia';
import { COLORES, campo, label, inputFormulario, botonGuardar, errorStyle, mensajeOkStyle, cargandoStyle } from './estilosCompartidos';

type ColoresDashboard = {
  color_primario: string;
  color_secundario: string;
  color_acento: string;
  fondo_imagen: string | null;
};

const COLORES_DASHBOARD_POR_DEFECTO: ColoresDashboard = {
  color_primario: '#1f3a5f',
  color_secundario: '#2e8b57',
  color_acento: '#6e7781',
  fondo_imagen: null,
};

export function PersonalizacionColoresSeccion({ empresaId, idioma }: { empresaId: string; idioma: string }) {
  const esPt = idioma === 'PT';

  const [cargando, setCargando] = useState(true);
  const [puedeEditar, setPuedeEditar] = useState(true);
  const [colores, setColores] = useState<ColoresDashboard>(COLORES_DASHBOARD_POR_DEFECTO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const [{ data: perfilData }, { data: configData }] = await Promise.all([
        supabase.from('perfiles').select('tipo_usuario').eq('id', userData.user.id).maybeSingle(),
        supabase
          .from('configuracion_dashboard')
          .select('color_primario, color_secundario, color_acento, fondo_imagen')
          .eq('empresa_id', empresaId)
          .maybeSingle(),
      ]);

      setPuedeEditar(perfilData?.tipo_usuario !== 'ASISTENTE');
      if (configData) {
        setColores({
          color_primario: configData.color_primario ?? COLORES_DASHBOARD_POR_DEFECTO.color_primario,
          color_secundario: configData.color_secundario ?? COLORES_DASHBOARD_POR_DEFECTO.color_secundario,
          color_acento: configData.color_acento ?? COLORES_DASHBOARD_POR_DEFECTO.color_acento,
          fondo_imagen: configData.fondo_imagen ?? null,
        });
      }
      setCargando(false);
    }

    cargar();
  }, [empresaId]);

  async function guardar() {
    setGuardando(true);
    setError('');
    setMensaje('');

    const { error: errorGuardar } = await supabase
      .from('configuracion_dashboard')
      .upsert({ empresa_id: empresaId, ...colores }, { onConflict: 'empresa_id' });

    setGuardando(false);

    if (errorGuardar) {
      setError(
        esPt
          ? `Não foi possível salvar a aparência: ${errorGuardar.message}`
          : `No se pudo guardar la apariencia: ${errorGuardar.message}`
      );
      return;
    }

    aplicarTemaGlobal(colores);
    setMensaje(esPt ? 'Aparência salva — já se aplica em todo o sistema.' : 'Apariencia guardada — ya se aplica en todo el sistema.');
  }

  if (cargando) {
    return <div style={cargandoStyle}>{esPt ? 'Carregando cores...' : 'Cargando colores...'}</div>;
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 17, color: COLORES.azul }}>
        {esPt ? '🎨 Aparência' : '🎨 Apariencia'}
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: COLORES.gris }}>
        {esPt
          ? 'Escolha as cores e o fundo que se usam em todo o sistema — não só no Painel de Controle.'
          : 'Elegí los colores y el fondo que se usan en todo el sistema — no solo en el Panel de Control.'}
      </p>

      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={mensajeOkStyle}>{mensaje}</div>}

      {!puedeEditar && (
        <p style={{ fontSize: 12.5, color: COLORES.gris, marginBottom: 12 }}>
          {esPt ? 'Somente quem administra a empresa pode alterar a aparência.' : 'Solo quien administra la empresa puede cambiar la apariencia.'}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18, marginBottom: 26 }}>
        {(
          [
            ['color_primario', esPt ? 'Cor primária' : 'Color primario'],
            ['color_secundario', esPt ? 'Cor secundária' : 'Color secundario'],
            ['color_acento', esPt ? 'Cor de destaque' : 'Color de acento'],
          ] as const
        ).map(([campoColor, etiqueta]) => (
          <div key={campoColor} style={campo}>
            <label style={label}>{etiqueta}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={colores[campoColor]}
                disabled={!puedeEditar}
                onChange={(e) => setColores((actual) => ({ ...actual, [campoColor]: e.target.value }))}
                style={{ width: 44, height: 36, padding: 0, border: '1px solid #d1d5db', borderRadius: 8, cursor: puedeEditar ? 'pointer' : 'default' }}
              />
              <input
                style={{ ...inputFormulario, textTransform: 'uppercase' }}
                value={colores[campoColor]}
                disabled={!puedeEditar}
                onChange={(e) => setColores((actual) => ({ ...actual, [campoColor]: e.target.value }))}
              />
            </div>
          </div>
        ))}
      </div>

      <label style={{ ...label, display: 'block', marginBottom: 10 }}>
        {esPt ? 'Fundo do sistema' : 'Fondo del sistema'}
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, marginBottom: 26 }}>
        <button
          type="button"
          disabled={!puedeEditar}
          onClick={() => setColores((actual) => ({ ...actual, fondo_imagen: null }))}
          style={{
            height: 72,
            borderRadius: 12,
            border: colores.fondo_imagen === null ? `3px solid ${COLORES.verde}` : '1px solid #d1d5db',
            background: '#f5f7f9',
            cursor: puedeEditar ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0 0 6px',
            fontSize: 11,
            fontWeight: 700,
            color: COLORES.gris,
          }}
        >
          {esPt ? 'Padrão (cinza)' : 'Por defecto (gris)'}
        </button>

        {FONDOS_DISPONIBLES.map((fondo) => (
          <button
            key={fondo.clave}
            type="button"
            disabled={!puedeEditar}
            onClick={() => setColores((actual) => ({ ...actual, fondo_imagen: fondo.clave }))}
            title={esPt ? fondo.nombrePt : fondo.nombreEs}
            style={{
              height: 72,
              borderRadius: 12,
              border: colores.fondo_imagen === fondo.clave ? `3px solid ${COLORES.verde}` : '1px solid #d1d5db',
              background: fondo.fondoCss,
              cursor: puedeEditar ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: '0 0 6px',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              }}
            >
              {esPt ? fondo.nombrePt : fondo.nombreEs}
            </span>
          </button>
        ))}
      </div>

      {puedeEditar && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" style={botonGuardar} onClick={guardar} disabled={guardando}>
            {guardando ? (esPt ? 'Salvando...' : 'Guardando...') : (esPt ? 'Salvar aparência' : 'Guardar apariencia')}
          </button>
        </div>
      )}
    </div>
  );
}
