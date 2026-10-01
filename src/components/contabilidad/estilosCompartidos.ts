// Estilos compartidos entre Central de Lançamentos, Registro de
// Operaciones, Libro Diario y Editar Registros — movidos de
// contabilidad/page.tsx (Fase 2 de mantenimiento), sin cambiar nada.

import type { CSSProperties } from 'react';
import { COLORES } from './compartido';


export const fondo: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--fondo-app, radial-gradient(circle at top left, #e7f1ed 0%, transparent 34%), #f4f7f8)',
  padding: '28px 24px 48px',
};

export const encabezado: CSSProperties = {
  background: 'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
  borderRadius: 24,
  padding: '28px 34px',
  color: COLORES.blanco,
  marginBottom: 24,
  boxShadow: '0 18px 40px rgba(20,42,71,0.16)',
};

export const volver: CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: 18,
};

export const eyebrow: CSSProperties = {
  color: '#86efac',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.4,
  marginBottom: 8,
};

export const eyebrowVerde: CSSProperties = {
  margin: '0 0 5px',
  color: COLORES.verde,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: 1.3,
};

export const panel: CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 26,
  boxShadow: '0 14px 36px rgba(31,58,95,0.10)',
  overflow: 'hidden',
};

export const panelTitulo: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  paddingBottom: 20,
  marginBottom: 24,
  borderBottom: '1px solid #e7edf1',
  flexWrap: 'wrap',
};

export const estadoActivo: CSSProperties = {
  padding: '7px 11px',
  borderRadius: 999,
  background: '#eaf7ee',
  color: '#247347',
  fontSize: 12,
  fontWeight: 700,
};

export const grid2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0 16px',
};

export const campoInput: CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid #d6dee5',
  background: '#fbfcfd',
  color: '#1f2937',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

export const filaProducto: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 8,
  flexWrap: 'wrap',
};

export const botonEliminarLinea: CSSProperties = {
  flex: '0 0 auto',
  width: 36,
  border: '1px solid #fecaca',
  borderRadius: 8,
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: 1,
};

export const totalStyle: CSSProperties = {
  marginTop: 24,
  padding: '16px 18px',
  display: 'flex',
  justifyContent: 'space-between',
  borderRadius: 14,
  background: 'linear-gradient(90deg, #edf6f0, #f7faf8)',
  color: COLORES.azul,
  fontWeight: 700,
};

export const accionFinal: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginTop: 22,
  paddingTop: 22,
  borderTop: '1px solid #e7edf1',
  flexWrap: 'wrap',
};

export const marcaVision: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 145,
};

export const visionLogo: CSSProperties = {
  width: 66,
  height: 66,
  borderRadius: 16,
  objectFit: 'contain',
  mixBlendMode: 'multiply',
  filter: 'drop-shadow(0 5px 8px rgba(31,58,95,0.13))',
};

export const sabioMarcaChica: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const sabioLogoChico: CSSProperties = {
  width: 72,
  height: 46,
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))',
};

export const botonPrincipal: CSSProperties = {
  minWidth: 220,
  padding: '14px 18px',
  borderRadius: 11,
  border: 'none',
  background: 'linear-gradient(135deg, #2e8b57, #237044)',
  color: COLORES.blanco,
  boxShadow: '0 8px 16px rgba(46,139,87,0.22)',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

export const botonSecundario: CSSProperties = {
  padding: '9px 13px',
  borderRadius: 9,
  border: `1px solid ${COLORES.azul}`,
  background: '#f8fafc',
  color: COLORES.azul,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

export const validacionStyle: CSSProperties = {
  marginTop: 10,
  padding: '10px 14px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  borderRadius: 10,
  background: '#f8fafc',
  color: COLORES.gris,
  fontSize: 12,
  fontWeight: 600,
};

export const botonValidar: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #bbf7d0',
  background: '#f0fdf4',
  color: '#166534',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

export const botonEliminar: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#dc2626',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

export const tablaContenedor: CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
};

export const tablaContenedorInterna: CSSProperties = {
  overflowX: 'auto',
};

export const cabeceraFila: CSSProperties = {
  background: '#f1f5f9',
  textAlign: 'left',
};

export const filaStyle: CSSProperties = {
  borderTop: '1px solid #e5e7eb',
};

export const vacioStyle: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: COLORES.gris,
};

export const vacioOperacion: CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: COLORES.gris,
  border: '1px dashed #d6dee5',
  borderRadius: 14,
};

export const cuentaDebe: CSSProperties = {
  fontWeight: 600,
  color: '#1f3a5f',
};

export const cuentaHaber: CSSProperties = {
  fontWeight: 600,
  color: '#2e8b57',
};
