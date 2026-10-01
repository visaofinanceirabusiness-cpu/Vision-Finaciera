// components/configuracoes/estilosCompartidos.ts
//
// Estilos y colores compartidos por las secciones de CONFIGURAÇÕES que
// viven en archivos propios (MisDatosSeccion, PersonalizacionColores
// Seccion, GestionAsistentes...) — antes estaban definidos al final de
// app/configuracoes/page.tsx y se usaban tanto ahí como en el resto de
// las pestañas de esa pantalla (que siguen en el mismo archivo). Se
// centralizan acá para que page.tsx y estos componentes lean del mismo
// lugar en vez de duplicar cada estilo.

import type { CSSProperties } from 'react';

// Colores personalizables por empresa (CONFIGURAÇÕES → Apariencia):
// var(--x, <default>) resuelve a la variable si TemaGlobal la seteó,
// y si no, usa el mismo valor de siempre — ver lib/apariencia.ts.
export const COLORES = {
  azul: 'var(--color-primario, #1f3a5f)',
  verde: 'var(--color-secundario, #2e8b57)',
  gris: 'var(--color-acento, #6e7781)',
  blanco: '#ffffff',
};

export const campo: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

export const label: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLORES.azul,
  marginBottom: 6,
};

export const inputFormulario: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid #d6dee5',
  background: COLORES.blanco,
  color: COLORES.azul,
  fontSize: 13,
};

export const botonGuardar: CSSProperties = {
  background: COLORES.azul,
  color: COLORES.blanco,
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  cursor: 'pointer',
  fontWeight: 800,
};

export const botonSecundario: CSSProperties = {
  background: COLORES.blanco,
  color: COLORES.azul,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '10px 16px',
  cursor: 'pointer',
  fontWeight: 700,
};

export const errorStyle: CSSProperties = {
  background: '#fef2f2',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 12,
  padding: '11px 14px',
  marginBottom: 18,
  fontSize: 13,
};

export const mensajeOkStyle: CSSProperties = {
  background: '#f0fdf4',
  color: '#166534',
  border: '1px solid #bbf7d0',
  borderRadius: 12,
  padding: '11px 14px',
  marginBottom: 18,
  fontSize: 13,
};

export const cargandoStyle: CSSProperties = {
  padding: 30,
  textAlign: 'center',
  color: COLORES.gris,
};
