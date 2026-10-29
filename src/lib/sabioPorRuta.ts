// lib/sabioPorRuta.ts
//
// El Sabio de la barra superior (nuevo diseño) rota los tips de la herramienta que se está viendo, igual que el Sabio que
// cada pantalla traía en su encabezado. Sin tips propios, usa los genéricos de siempre.

import { frasesSabioContabilidad } from '@/app/contabilidad/i18n';
import { frasesSabioFinanzas } from '@/app/finanzas/i18n';
import { frasesSabioInformes } from '@/app/informes/i18n';
import { frasesSabioMercaderia } from '@/app/mercaderia/i18n';
import { frasesSabioPanel } from '@/app/panel-de-control/i18n';
import { frasesSabioProduccion } from '@/app/produccion/i18n';
import { frasesSabioRecursosHumanos } from '@/app/recursos-humanos/i18n';
import { frasesSabioConfiguracoes } from '@/app/configuracoes/i18n';

type Frases = (idioma: string | null | undefined) => string[];

const POR_PREFIJO: [string, Frases][] = [
  ['/panel-de-control', frasesSabioPanel],
  ['/contabilidad', frasesSabioContabilidad],
  ['/libro-diario', frasesSabioContabilidad],
  ['/registros', frasesSabioContabilidad],
  ['/diario', frasesSabioContabilidad],
  ['/finanzas', frasesSabioFinanzas],
  ['/mercaderia', frasesSabioMercaderia],
  ['/stock', frasesSabioMercaderia],
  ['/movimientos-stock', frasesSabioMercaderia],
  ['/informes', frasesSabioInformes],
  ['/produccion', frasesSabioProduccion],
  ['/recursos-humanos', frasesSabioRecursosHumanos],
  ['/configuracoes', frasesSabioConfiguracoes],
];

export function frasesSabioDeRuta(pathname: string | null | undefined, idioma: string | null | undefined): string[] | undefined {
  if (!pathname) return undefined;
  const hallada = POR_PREFIJO.find(([prefijo]) => pathname === prefijo || pathname.startsWith(`${prefijo}/`));
  return hallada ? hallada[1](idioma) : undefined;
}
