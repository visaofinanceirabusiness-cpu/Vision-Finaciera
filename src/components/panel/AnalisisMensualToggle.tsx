'use client';

// ANÁLISIS MENSUAL AUTOMÁTICO — toggle para prender/apagar el envío
// automático del día 1 de cada mes (ver api/analisis-mensual/generar
// y lib/analisisMensual.ts). Autocontenido, mismo patrón que
// PersonalizacionColoresSeccion.tsx: cada uno carga y guarda su
// propio pedacito de configuración_dashboard... en este caso,
// empresas.analisis_mensual_habilitado directamente, porque es una
// propiedad de la empresa, no de la personalización del dashboard.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Colores = { azul: string; verde: string; gris?: string; acento?: string; blanco: string };

export function AnalisisMensualToggle({
  empresaId,
  idioma,
  colores,
}: {
  empresaId: string;
  idioma: string;
  colores: Colores;
}) {
  const esPt = idioma === 'PT';
  const colorGris = colores.gris ?? colores.acento ?? '#6e7781';

  const [cargando, setCargando] = useState(true);
  const [puedeEditar, setPuedeEditar] = useState(true);
  const [habilitado, setHabilitado] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const [{ data: perfilData }, { data: empresaData }] = await Promise.all([
        supabase.from('perfiles').select('tipo_usuario').eq('id', userData.user.id).maybeSingle(),
        supabase.from('empresas').select('analisis_mensual_habilitado').eq('id', empresaId).maybeSingle(),
      ]);

      setPuedeEditar(perfilData?.tipo_usuario !== 'ASISTENTE');
      setHabilitado(empresaData?.analisis_mensual_habilitado ?? true);
      setCargando(false);
    }

    cargar();
  }, [empresaId]);

  async function alternar(valor: boolean) {
    setGuardando(true);
    setError('');
    setHabilitado(valor);

    const { error: errorGuardar } = await supabase
      .from('empresas')
      .update({ analisis_mensual_habilitado: valor })
      .eq('id', empresaId);

    setGuardando(false);

    if (errorGuardar) {
      setHabilitado(!valor);
      setError(
        esPt
          ? `Não foi possível salvar: ${errorGuardar.message}`
          : `No se pudo guardar: ${errorGuardar.message}`
      );
    }
  }

  if (cargando) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontWeight: 800, color: colores.azul, fontSize: 14.5, marginBottom: 3 }}>
          📊 {esPt ? 'Análise mensal automática' : 'Análisis mensual automático'}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: colorGris, lineHeight: 1.5 }}>
          {esPt
            ? 'Todo dia 1, o Sábio manda por Mensagens um resumo do mês que fechou — receitas, despesas e principais categorias.'
            : 'Todos los días 1, Sabio manda por Mensajes un resumen del mes que cerró — ingresos, egresos y principales categorías.'}
        </p>
        {!puedeEditar && (
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: colorGris }}>
            {esPt ? 'Assistentes não podem alterar isso.' : 'Los Asistentes no pueden cambiar esto.'}
          </p>
        )}
        {error && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#b91c1c' }}>{error}</p>}
      </div>

      <label
        style={{
          position: 'relative',
          display: 'inline-block',
          width: 46,
          height: 26,
          flexShrink: 0,
          opacity: puedeEditar ? 1 : 0.5,
          cursor: puedeEditar ? 'pointer' : 'default',
        }}
      >
        <input
          type="checkbox"
          checked={habilitado}
          disabled={!puedeEditar || guardando}
          onChange={(e) => alternar(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: habilitado ? colores.verde : '#d1d5db',
            transition: 'background 150ms ease',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: habilitado ? 23 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: colores.blanco,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'left 150ms ease',
          }}
        />
      </label>
    </div>
  );
}
