'use client';

// CONTABILIDAD
//
// Junta en una sola pantalla, con pestañas (igual que Recursos Humanos
// con Clientes/Proveedores, y Mercadería con Saldo/Movimientos), las
// tres herramientas contables:
//
//   - Central de Lanzamientos: formulario para cargar operaciones.
//   - Registro de Operaciones: listado de lo ya cargado, con baja.
//   - Libro Diario: vista contable unificada (Debe/Haber) agrupada
//     por operación.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { simboloMoneda } from '@/lib/moneda';
import { fechaLocalHoy } from '@/lib/fecha';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { crearTraductor } from '@/lib/i18n';
import { empresaTieneOnboardingCompleto } from '@/lib/onboarding';
import { obtenerRecordatorio, saldoPendiente, type RecordatorioGastoRecurrente } from '@/lib/gastosRecurrentes';
import { obtenerConfigAPagar } from '@/lib/cuentaAPagar';
import { SabioWidget } from '@/components/panel/SabioWidget';
import { SabioFlotante } from '@/components/panel/SabioFlotante';
import { diccionarioContabilidad, frasesSabioContabilidad } from './i18n';
import { SimboloContext, EsFamiliarContext, IdiomaContext, COLORES, type ValoresIniciales } from '@/components/contabilidad/compartido';
import { fondo, encabezado, volver, eyebrow, panel } from '@/components/contabilidad/estilosCompartidos';
import { CentralDeLanzamientosTab } from '@/components/contabilidad/CentralDeLanzamientosTab';
import { RegistroOperacionesTab } from '@/components/contabilidad/RegistroOperacionesTab';
import { LibroDiarioTab } from '@/components/contabilidad/LibroDiarioTab';
import { EditarRegistrosTab } from '@/components/contabilidad/EditarRegistrosTab';
import { CompromisosTab } from '@/components/contabilidad/CompromisosTab';

type Pestana = 'lanzamientos' | 'registros' | 'libro' | 'editar' | 'compromisos';

export default function ContabilidadPage() {
  return (
    <Suspense fallback={null}>
      <ContabilidadPageInterno />
    </Suspense>
  );
}

function ContabilidadPageInterno() {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>('lanzamientos');
  const [esAdmin, setEsAdmin] = useState(false);
  const [moneda, setMoneda] = useState<string | null>(null);
  const [esFamiliar, setEsFamiliar] = useState(false);
  const [idioma, setIdioma] = useState<string | null>(null);

  // Al llegar desde el botón "Registrar" de un recordatorio de gasto
  // recurrente (Mis Vencimientos, en Panel de Control), la URL trae
  // el id del recordatorio — se precargan Operación/Categoría/Forma
  // de Pago/Monto y, al guardar, se marca ese recordatorio como
  // cumplido (ver handleRegistrar en CentralDeLanzamientosTab). Se
  // lee con useSearchParams (reactivo) y NO con un useState perezoso
  // leyendo window.location.search una sola vez: el App Router puede
  // reusar esta misma instancia de página al navegar de nuevo a
  // /contabilidad con un id distinto (si ya se había visitado antes
  // en la sesión) — con una lectura de una sola vez, ese segundo
  // click en "Registrar" quedaba con el id viejo (o ninguno) y el
  // formulario se abría completamente vacío, sin ni siquiera pedirle
  // el recordatorio al servidor.
  const searchParams = useSearchParams();
  const recordatorioIdUrl = searchParams.get('gastoRecurrenteRecordatorioId');
  const pestanaUrl = searchParams.get('pestana');
  const [recordatorioGastoRecurrente, setRecordatorioGastoRecurrente] = useState<RecordatorioGastoRecurrente | undefined>(undefined);
  const [valoresInicialesGasto, setValoresInicialesGasto] = useState<ValoresIniciales | undefined>(undefined);
  const [prefillListo, setPrefillListo] = useState(!recordatorioIdUrl);

  const t = crearTraductor(diccionarioContabilidad, idioma);

  // Enlaces desde el Panel de Control ("Gestionar en Contabilidad → Compromisos").
  useEffect(() => {
    if (pestanaUrl === 'compromisos') {
      setPestana('compromisos');
    }
  }, [pestanaUrl]);

  useEffect(() => {
    if (!recordatorioIdUrl) {
      setPrefillListo(true);
      return;
    }

    // Se desmonta el formulario mientras se busca el recordatorio (el
    // condicional de más abajo usa prefillListo) para que, al volver
    // a montarse con los valoresIniciales ya resueltos, arranque de
    // cero — necesario porque un mismo click en "Registrar" mientras
    // ya se estaba en /contabilidad no remonta el componente por sí
    // solo.
    setPrefillListo(false);

    obtenerRecordatorio(recordatorioIdUrl)
      .then(async (recordatorio) => {
        if (!recordatorio) return;

        // Un gasto ya devengado se paga con la categoría de liquidación de
        // Cuentas a Pagar (Cuentas a Pagar / Banco), no con la del gasto.
        const configAPagar = recordatorio.estado === 'DEVENGADA' ? await obtenerConfigAPagar(recordatorio.empresa_id) : null;

        setRecordatorioGastoRecurrente(recordatorio);
        setValoresInicialesGasto({
          fecha: fechaLocalHoy(),
          operacion: 'PAGO',
          categoria: configAPagar ? configAPagar.categoriaLiquidacion : recordatorio.categoria,
          formaPago: recordatorio.forma_pago,
          historico: recordatorio.nombre,
          clienteProveedor: '',
          lineas: [{ producto: '', cantidad: 1, monto: saldoPendiente(recordatorio), unidadCarga: '' }],
        });
      })
      .catch((e) => console.error('No se pudo precargar el recordatorio del gasto recurrente:', e))
      .finally(() => setPrefillListo(true));
  }, [recordatorioIdUrl]);

  useEffect(() => {
    async function cargarPerfil() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('es_admin_plataforma, empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      setEsAdmin(Boolean(perfil?.es_admin_plataforma));

      if (perfil?.empresa_id) {
        // Contabilidad (Central de Lançamentos) NO se gatea con
        // empresaTieneOnboardingCompleto — es acá donde la Fase 2 del
        // wizard redirige y donde la Fase 3 hace cargar las 3
        // operaciones guiadas, justo ANTES de que el onboarding quede
        // marcado como completo. Gatearla también generaría un loop.
        const { data: empresa } = await supabase
          .from('empresas')
          .select('moneda, idioma, perfil_empresa_id, perfiles_empresa(codigo)')
          .eq('id', perfil.empresa_id)
          .maybeSingle();

        setMoneda(empresa?.moneda ?? null);
        setIdioma(empresa?.idioma ?? null);

        const perfilCodigo = (empresa as unknown as { perfiles_empresa?: { codigo: string } | null } | null)
          ?.perfiles_empresa?.codigo;

        setEsFamiliar(perfilCodigo === 'FAMILIAR');
      }
    }

    cargarPerfil();
  }, []);

  return (
    <IdiomaContext.Provider value={idioma}>
    <EsFamiliarContext.Provider value={esFamiliar}>
    <SimboloContext.Provider value={simboloMoneda(moneda)}>
    <div style={fondo}>
      <div style={{ maxWidth: 1450, margin: '0 auto' }}>
        {/* =================================================
            ENCABEZADO
        ================================================== */}

        <header style={encabezado}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <Link href="/?vista=empresa" style={volver}>
                {t('volver')}
              </Link>

              <div style={eyebrow}>{t('eyebrow')}</div>

              <h1 style={{ margin: 0, fontSize: 32 }}>{t('titulo')}</h1>

              <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
                {t('subtitulo')}
              </p>
            </div>

            {/* SABIO — permanente, con tips propios de Contabilidad.
                Vive en el mismo panel del encabezado, entre el título y
                los accesos rápidos, igual que en el resto de las
                herramientas. El de dentro de Central de Lançamentos
                sigue existiendo aparte, pero solo durante el tutorial
                guiado (ver CentralDeLanzamientosTab). */}
            <SabioWidget
              colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
              idioma={idioma ?? 'ES'}
              frases={frasesSabioContabilidad(idioma)}
            />

            <AccesosHerramientas />
          </div>
        </header>

        <SabioFlotante
          colores={{ azul: COLORES.azul, verde: COLORES.verde, blanco: COLORES.blanco }}
          idioma={idioma ?? 'ES'}
          frases={frasesSabioContabilidad(idioma)}
        />

        {/* =================================================
            CONTENIDO
        ================================================== */}

        <main style={panel}>
          {/* =================================================
              PESTAÑAS
          ================================================== */}

          <div
            style={{
              display: 'flex',
              gap: 10,
              borderBottom: '1px solid #e5e7eb',
              marginBottom: 22,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setPestana('lanzamientos')}
              style={tabStyle(pestana === 'lanzamientos')}
            >
              {t('tabLanzamientos')}
            </button>

            {esAdmin && (
              <button
                type="button"
                onClick={() => setPestana('registros')}
                style={tabStyle(pestana === 'registros')}
              >
                {t('tabRegistros')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setPestana('compromisos')}
              style={tabStyle(pestana === 'compromisos')}
            >
              {t('tabCompromisos')}
            </button>

            <button
              type="button"
              onClick={() => setPestana('libro')}
              style={tabStyle(pestana === 'libro')}
            >
              {t('tabLibro')}
            </button>

            <button
              type="button"
              onClick={() => setPestana('editar')}
              style={tabStyle(pestana === 'editar')}
            >
              {t('tabEditar')}
            </button>
          </div>

          {pestana === 'lanzamientos' && prefillListo && (
            <CentralDeLanzamientosTab
              valoresIniciales={valoresInicialesGasto}
              recordatorioGastoRecurrente={recordatorioGastoRecurrente}
            />
          )}
          {pestana === 'registros' && <RegistroOperacionesTab />}
          {pestana === 'compromisos' && <CompromisosTab />}
          {pestana === 'libro' && <LibroDiarioTab />}
          {pestana === 'editar' && <EditarRegistrosTab />}
        </main>
      </div>
    </div>
    </SimboloContext.Provider>
    </EsFamiliarContext.Provider>
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

