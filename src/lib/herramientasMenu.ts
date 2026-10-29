// lib/herramientasMenu.ts
//
// Lista de herramientas del sistema y qué empresa/usuario ve cada una. La usan la fila de accesos de cada pantalla
// (AccesosHerramientas) y el menú lateral del nuevo diseño (AppShell): así las reglas no se repiten.

import { empresaTieneVisao3D } from './visao3dEmpresas';
import type { FilaApertura } from './visao3dEmpresas';

export type Herramienta = {
  href: string;
  titulo: string;
  // Nombre corto que queda siempre a la vista debajo del ícono.
  corto: { es: string; pt: string };
  emoji: string;
  color: string;
};

export const TODAS_LAS_HERRAMIENTAS: Herramienta[] = [
  { href: '/panel-de-control', titulo: 'Panel de Control', corto: { es: 'Panel', pt: 'Painel' }, emoji: '📊', color: '#2e8b57' },
  { href: '/contabilidad', titulo: 'Contabilidad', corto: { es: 'Contab.', pt: 'Contab.' }, emoji: '🧾', color: '#7c3aed' },
  { href: '/finanzas', titulo: 'Finanzas', corto: { es: 'Finanzas', pt: 'Finanças' }, emoji: '💼', color: '#0d9488' },
  { href: '/mercaderia', titulo: 'Mercadería', corto: { es: 'Mercad.', pt: 'Mercad.' }, emoji: '📦', color: '#ea580c' },
  { href: '/mi-local', titulo: 'Mi Local', corto: { es: 'Mi Local', pt: 'Meu Local' }, emoji: '🛍️', color: '#e11d48' },
  { href: '/informes', titulo: 'Informes', corto: { es: 'Informes', pt: 'Relat.' }, emoji: '📈', color: '#0891b2' },
  { href: '/visao-3d', titulo: 'Visão 3D', corto: { es: 'Visión 3D', pt: 'Visão 3D' }, emoji: '🏢', color: '#0ea5e9' },
  { href: '/produccion', titulo: 'Producción', corto: { es: 'Produc.', pt: 'Produç.' }, emoji: '🏭', color: '#65a30d' },
  { href: '/recursos-humanos', titulo: 'Recursos Humanos', corto: { es: 'RR. HH.', pt: 'RH' }, emoji: '👥', color: '#db2777' },
  { href: '/plan-accion', titulo: 'Plan de Acción', corto: { es: 'Plan', pt: 'Plano' }, emoji: '🎯', color: '#1f3a5f' },
  { href: '/nuestro-sueno', titulo: 'Nuestro Sueño', corto: { es: 'Sueño', pt: 'Sonho' }, emoji: '💞', color: '#db2777' },
  { href: '/mensajes', titulo: 'Mensajes', corto: { es: 'Mensajes', pt: 'Mensag.' }, emoji: '✉️', color: '#2563eb' },
  { href: '/configuracoes', titulo: 'Configurações', corto: { es: 'Config.', pt: 'Config.' }, emoji: '⚙️', color: '#475569' },
];


export type ContextoMenu = {
  empresaId: string;
  perfilCodigo: string | null;
  tipoUsuario: string | null;
  manejaMercaderia: boolean;
  tieneProduccion: boolean;
  aperturaVisao3D: FilaApertura[] | null;
};

export function herramientaDisponible(href: string, c: ContextoMenu): boolean {
  if (href === '/mercaderia') return c.manejaMercaderia;
  if (href === '/produccion') return c.tieneProduccion;
  if (href === '/mi-local') return c.manejaMercaderia && c.tipoUsuario !== 'ASISTENTE';
  // Igual que en el lobby: el asistente no ve Informes.
  if (href === '/informes') return c.tipoUsuario !== 'ASISTENTE';
  // Piloto: solo las empresas habilitadas, y no para el asistente (como Informes).
  if (href === '/visao-3d') return empresaTieneVisao3D(c.empresaId, c.perfilCodigo, c.aperturaVisao3D) && c.tipoUsuario !== 'ASISTENTE';
  return true;
}
