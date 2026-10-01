# CLAUDE.md

Visão Financeira — app de gestión financiera (Next.js + Supabase) para
tres tipos de empresa: Comercial/Servicios/Mixto y un perfil especial
"Familia" (finanzas personales/hogar, con gamificación).

Ver también `memory.md` — contexto vivo del proyecto (decisiones
recientes, cosas pendientes, limitaciones conocidas). Este archivo
(`CLAUDE.md`) son las reglas estables; `memory.md` es lo que cambia
sesión a sesión.

## Comandos
- `npm run dev` — levantar en local
- `npm run build` — build de producción
- `npx tsc --noEmit` — typecheck (correr siempre antes de pushear)
- `npm run lint` — ESLint directo (`next lint` ya no existe desde
  Next 16). OJO: `next build` (no así `eslint` corrido directo)
  reescribe `tsconfig.json` solo (agrega `.next/types/**/*.ts` a
  `include` y `{name: "next"}` a `plugins`) — este repo no usa typed
  routes, así que no aporta nada; revertir con `git checkout --
  tsconfig.json` después de buildear si no se lo pidió el usuario
  explícitamente.
- `npm test` — tests unitarios (Vitest). Hoy solo cubren funciones
  puras (`generarCodigo` en `lib/categorias.ts`) — ver `memory.md`
  para el estado de testear `lib/motor.ts`.

## Stack
- Next.js App Router, todo en `src/app/<pantalla>/page.tsx` (son
  archivos grandes, 1000-3000+ líneas — una sola pantalla por archivo,
  no por carpeta de componentes)
- Supabase (Postgres + Auth + RLS) — project ref `dbmbyqsgyrbccxesqdfj`
- Sin librería de UI: estilos inline (`style={{...}}`), sin Tailwind

## Convenciones del código
- Español primero, portugués como `idioma === 'PT'` condicional en
  cada string visible — nunca portugués solo
- Comentarios solo cuando explican el PORQUÉ (una decisión, un bug que
  evitan, una restricción no obvia) — nunca QUÉ hace el código
- No hay abstracciones/librerías de UI compartidas más allá de algunos
  componentes puntuales en `src/components/panel/` — cada pantalla
  repite sus propios estilos; no "arreglar" esto de oficio
- Colores: cada pantalla define `const COLORES = { azul, verde, gris,
  blanco }` — usa `var(--color-primario, '#1f3a5f')` etc. para que
  CONFIGURAÇÕES → Apariencia los pueda sobreescribir (ver
  `lib/apariencia.ts` + `TemaGlobal.tsx`, montado en `app/layout.tsx`)
- Fondo de pantalla: `background: 'var(--fondo-app, <gradiente de
  siempre>)'` en el `<main>` de cada pantalla — mismo mecanismo
- Motor contable de partida doble en `lib/motor.ts` +
  `lib/categorias.ts` — cualquier cambio ahí es de ALTO RIESGO (afecta
  plata real de clientes activos). Antes de tocarlo, entender
  `reglas_contables` (rol_debito/rol_credito/motor) y
  `matriz_operaciones` (generada por `generarMatrizOperaciones`)
- Gamificación (perfil Familia): `lib/gamificacion.ts` (niveles,
  75 operaciones por nivel, medallas Bronce/Plata/Oro),
  `lib/objetivosEscalonados.ts` y `lib/trofeos.ts` (capas nuevas,
  ver `memory.md`)
- Responsive: este proyecto no tiene un sistema de breakpoints —
  cuando hace falta, se agrega un `<style>` inline con
  `@media (max-width: 480-560px)` y una className puntual (ver
  `MisVencimientos.tsx`, `panel-de-control/page.tsx`)

## Flujo de trabajo esperado
- Rama de trabajo: `claude/mobile-financial-vision-edits-1zfouk`
- Para cambios grandes/ambiguos (sobre todo algo que toque el motor
  contable o datos reales): proponer en texto primero, esperar
  confirmación explícita antes de implementar
- Al terminar un cambio: `npx tsc --noEmit` → commit → `git fetch
  origin main && git merge origin/main --no-edit` → push → crear PR →
  esperar CI (Vercel) en verde → mergear (squash) → sync de la rama
  local (`git fetch origin main && git merge origin/main --no-edit &&
  git push`)
- Cambios de esquema (tablas/columnas nuevas) van directo a Supabase
  vía MCP, no como archivos de migración en el repo (no hay carpeta
  `supabase/migrations`) — documentarlos igual en el mensaje de commit
- Este entorno NO tiene acceso a internet para descargar assets
  externos (imágenes de stock, fuentes, etc.) — si hace falta una foto
  real, pedírsela al usuario
