'use client';

// FINANZAS
//
// Herramienta para todos los perfiles, con pestañas (igual que
// Contabilidad). Hoy tiene una sola: Compromisos — lo que está por cobrar
// y por pagar. Las siguientes se agregan acá como pestañas nuevas.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { simboloMoneda } from '@/lib/moneda';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { crearTraductor } from '@/lib/i18n';
import { SabioWidget } from '@/components/panel/SabioWidget';
import { SabioFlotante } from '@/components/panel/SabioFlotante';
import { SimboloContext, IdiomaContext, COLORES } from '@/components/contabilidad/compartido';
import { fondo, encabezado, volver, eyebrow, panel } from '@/components/contabilidad/estilosCompartidos';
import { CompromisosTab } from '@/components/finanzas/CompromisosTab';
import { FlujoProyectadoTab } from '@/components/finanzas/FlujoProyectadoTab';
import { DeudasTab } from '@/components/finanzas/DeudasTab';
import { PresupuestoTab } from '@/components/finanzas/PresupuestoTab';
import { diccionarioFinanzas, frasesSabioFinanzas } from './i18n';

type Pestana = 'compromisos' | 'flujo' | 'deudas' | 'presupuesto';

export default function FinanzasPage() {
  const [pestana, setPestana] = useState<Pestana>('compromisos');
  const [moneda, setMoneda] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<string | null>(null);
  const [esFamiliar, setEsFamiliar] = useState(false);

  const t = crearTraductor(diccionarioFinanzas, idioma);

  useEffect(() => {
    async function cargarEmpresa() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id) return;

      const { data: empresa } = await supabase
        .from('empresas')
        .select('moneda, idioma, perfiles_empresa(codigo)')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      setMoneda(empresa?.moneda ?? null);
      setIdioma(empresa?.idioma ?? null);
      setEsFamiliar((empresa as unknown as { perfiles_empresa?: { codigo: string } | null } | null)?.perfiles_empresa?.codigo === 'FAMILIAR');
    }

    cargarEmpresa();
  }, []);

  return (
    <IdiomaContext.Provider value={idioma}>
      <SimboloContext.Provider value={simboloMoneda(moneda)}>
        <div style={fondo}>
          <div style={{ maxWidth: 1450, margin: '0 auto' }}>
            <header style={encabezado}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
                <div style={{ flex: '1 1 240px', minWidth: 200 }}>
                  <Link href="/?vista=empresa" style={volver}>
                    {t('volver')}
                  </Link>

                  <div style={eyebrow}>{t('eyebrow')}</div>

                  <h1 style={{ margin: 0, fontSize: 32 }}>{t('titulo')}</h1>

                  <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>{t('subtitulo')}</p>
                </div>

                <SabioWidget
                  colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
                  idioma={idioma ?? 'ES'}
                  frases={frasesSabioFinanzas(idioma)}
                />

                <AccesosHerramientas />
              </div>
            </header>

            <SabioFlotante
              colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
              idioma={idioma ?? 'ES'}
              frases={frasesSabioFinanzas(idioma)}
            />

            <main style={panel}>
              <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #e5e7eb', marginBottom: 22, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setPestana('compromisos')} style={tabStyle(pestana === 'compromisos')}>
                  {t('tabCompromisos')}
                </button>
                <button type="button" onClick={() => setPestana('flujo')} style={tabStyle(pestana === 'flujo')}>
                  {t('tabFlujo')}
                </button>
                <button type="button" onClick={() => setPestana('deudas')} style={tabStyle(pestana === 'deudas')}>
                  {t('tabDeudas')}
                </button>
                <button type="button" onClick={() => setPestana('presupuesto')} style={tabStyle(pestana === 'presupuesto')}>
                  {t(esFamiliar ? 'tabPresupuestoFamilia' : 'tabPresupuesto')}
                </button>
              </div>

              {pestana === 'compromisos' && <CompromisosTab />}
              {pestana === 'flujo' && <FlujoProyectadoTab />}
              {pestana === 'deudas' && <DeudasTab />}
              {pestana === 'presupuesto' && <PresupuestoTab />}
            </main>
          </div>
        </div>
      </SimboloContext.Provider>
    </IdiomaContext.Provider>
  );
}

function tabStyle(activa: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    padding: '12px 18px',
    color: activa ? COLORES.verde : COLORES.gris,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    borderBottom: activa ? `3px solid ${COLORES.verde}` : '3px solid transparent',
    marginBottom: -1,
  };
}
