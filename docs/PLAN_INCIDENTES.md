# Plan de Respuesta a Incidentes — Visão Financeira

Bloque K del Día 1 de seguridad (V3.0). Define qué hacemos si algo sale
mal — no es una herramienta que se construye hoy, es el procedimiento
que seguimos cuando haga falta.

## K1 — Plan

### Responsable
Vos (Desarrollador) sos el único punto de contacto y la única persona
con acceso real a Supabase y Vercel — no hay a quién delegar hoy.

### Detección
- Advisors de seguridad de Supabase (se revisan en cada bloque de esta
  auditoría, y deberían revisarse periódicamente después).
- Logs de Supabase (`query_logs`).
- Reporte directo de un cliente (WhatsApp, email de contacto).
- Un hallazgo propio en una auditoría futura.

No hay alertas automáticas configuradas hoy — queda pendiente evaluar
si suman (ej. alertas de Supabase ante picos de errores).

### Clasificación
- 🔴 **Crítico**: datos financieros o personales expuestos o alterados
  fuera de lo que RLS debería permitir; acceso no autorizado
  confirmado.
- 🟡 **Alto**: una función administrativa comprometida, sin evidencia
  todavía de que se haya usado de forma indebida.
- 🟢 **Medio/Bajo**: hallazgo teórico, sin explotación confirmada.

### Contención
Pasos disponibles hoy, según el caso:
- Revocar/rotar la Service Role Key y las claves VAPID.
- `revoke execute` sobre la función comprometida.
- Forzar cierre de sesión de un usuario puntual (`perfiles.activo = false`).
- Pausar el proyecto completo desde el dashboard de Supabase, si hiciera falta.

### Investigación
Usar `auditoria_eventos` (Bloque F) + logs de Supabase + advisors de
seguridad para reconstruir qué pasó, cuándo, y quién estuvo
involucrado.

### Recuperación
Aplicar el fix, confirmar con advisors + una prueba real (mismo
criterio que se usó en todos los bloques de este Día 1), y reactivar
lo que se haya pausado durante la contención.

### Documentación
Cada incidente real (no cada hallazgo de auditoría) queda registrado:
qué pasó, cuándo se detectó, impacto, quién se vio afectado, qué se
hizo para resolverlo.

### Comunicación
- A los clientes afectados, directamente (WhatsApp o email).
- A la ANPD (autoridad de protección de datos de Brasil), si la
  gravedad lo amerita — ver K2.

## K2 — LGPD

La LGPD (art. 48) exige notificar a la ANPD y a los titulares
afectados **en tiempo razonable** ante un incidente con riesgo o daño
relevante. No fija un plazo exacto (a diferencia de las 72 horas del
GDPR europeo), pero la práctica recomendada es actuar rápido.

**Pendiente de validar con asesoría jurídica**: qué constituye
"riesgo relevante" en la práctica y el detalle exacto de las
obligaciones de notificación exceden lo que se puede resolver desde
el código o la base de datos — esto no se da por resuelto hasta que
un abogado especializado en LGPD lo confirme.

---

_Documento vivo: se actualiza si el procedimiento cambia. Alimenta el
Bloque L (Documentación Legal) del Día 1 de seguridad._
