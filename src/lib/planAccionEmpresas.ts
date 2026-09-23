// lib/planAccionEmpresas.ts
//
// Lista de empresas con Plan de Acción de 30 Días — hoy solo
// Buenaventura (ver comentario en perfilCapacidades.ts). Vive en su
// propio archivo, sin importar nada más, para que rutas de servidor
// (ej. api/plan-accion/resumen-diario) puedan usarla sin arrastrar el
// cliente de Supabase del browser (lib/supabase.ts) a su cadena de
// imports estáticos.
export const EMPRESAS_CON_PLAN_ACCION = ['8512b8b0-1985-4731-981b-955f1d62a898']; // Buenaventura
