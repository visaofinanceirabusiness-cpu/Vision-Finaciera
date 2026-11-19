'use client';

// EVOLUCIÓN — la herramienta para ver cómo se mueve cada cuenta de la empresa en el tiempo: Activo, Pasivo, Patrimonio, resultado, caja,
// bancos, deudas o cualquier otra cuenta del plan, separadas por tipo y varias a la vez. Las cuentas padre se ven como áreas y las
// individuales como líneas, así se aprecia el peso de cada una. Sale de las operaciones cargadas (no guarda nada). Ver lib/sabioSoporte/evolucion.ts.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useEnShell } from '@/components/shell/ShellContext';
import { simboloMoneda } from '@/lib/moneda';
import { cargarEvolucion } from '@/lib/evolucionDatos';
import type { Evolucion } from '@/lib/sabioSoporte/evolucion';
import { GraficoEvolucion } from '@/components/sabioSoporte/GraficoEvolucion';

const COLORES = { azul: 'var(--color-primario, #1f3a5f)', gris: 'var(--color-acento, #6e7781)' };

export default function EvolucionPage() {
  const enShell = useEnShell();
  const router = useRouter();
  const [evolucion, setEvolucion] = useState<Evolucion | null>(null);
  const [empresa, setEmpresa] = useState({ nombre: '', simbolo: '$', pt: false });
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return router.push('/login');
      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', u.user.id).maybeSingle();
      if (!perfil?.empresa_id) return setError('No se pudo identificar la empresa del usuario.');
      const id = perfil.empresa_id as string;
      const { data: e } = await supabase.from('empresas').select('nombre, moneda, idioma').eq('id', id).maybeSingle();
      if (vivo) setEmpresa({ nombre: (e?.nombre as string) ?? '', simbolo: simboloMoneda(e?.moneda as string | null), pt: e?.idioma === 'PT' });
      try {
        const ev = await cargarEvolucion(id);
        if (vivo) setEvolucion(ev);
      } catch (er) {
        if (vivo) setError(er instanceof Error ? er.message : 'No se pudo cargar la evolución.');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [router]);

  const t = (es: string, p: string) => (empresa.pt ? p : es);
  const resumen = useMemo(() => {
    if (!evolucion || evolucion.fechas.length === 0) return [];
    const ultimo = evolucion.fechas.length - 1;
    const valor = (clave: string) => evolucion.porClave.get(clave)?.valores[ultimo] ?? null;
    return [
      { titulo: t('Activo', 'Ativo'), valor: valor('1.0.0.0.0') },
      { titulo: t('Pasivo', 'Passivo'), valor: valor('2.0.0.0.0') },
      { titulo: t('Patrimonio neto', 'Patrimônio líquido'), valor: valor('RES:PN_TOTAL') },
      { titulo: t('Resultado acumulado', 'Resultado acumulado'), valor: valor('RES:RESULTADO') },
      { titulo: t('Disponible', 'Disponível'), valor: valor('RES:DISPONIBLE') },
    ].filter((x) => x.valor !== null) as Array<{ titulo: string; valor: number }>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evolucion, empresa.pt]);

  const dinero = (n: number) => `${n < 0 ? '−' : ''}${empresa.simbolo} ${Math.abs(n).toLocaleString(empresa.pt ? 'pt-BR' : 'es-AR', { maximumFractionDigits: 0 })}`;

  return (
    <main style={{ minHeight: enShell ? 'auto' : '100vh', background: 'var(--fondo-app, linear-gradient(180deg, #f5f7f9 0%, #e8eff6 100%))', padding: '20px 20px 40px', color: COLORES.azul }}>
      <div style={{ maxWidth: 1700, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>📈 {t('Evolución', 'Evolução')}</h1>
            <p style={{ margin: '2px 0 0', fontSize: 14, color: COLORES.gris }}>{t('Mirá cómo se mueve cada cuenta en el tiempo: elegí las que quieras, de a varias, y compará.', 'Veja como cada conta se move no tempo: escolha as que quiser, várias de uma vez, e compare.')}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {resumen.map((r) => (
              <div key={r.titulo} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '8px 14px', minWidth: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORES.gris }}>{r.titulo}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: r.valor < 0 ? '#b91c1c' : COLORES.azul }}>{dinero(r.valor)}</div>
              </div>
            ))}
          </div>
        </div>

        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        {!evolucion && !error && <p style={{ color: COLORES.gris }}>{t('Cargando…', 'Carregando…')}</p>}
        {evolucion && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 14 }}>
            <GraficoEvolucion evolucion={evolucion} simbolo={empresa.simbolo} alto="calc(100vh - 470px)" />
          </div>
        )}
      </div>
    </main>
  );
}
