---
name: ship
description: Lleva un cambio de código ya terminado en este repo (Vision-Finaciera) a producción — typecheck, commit, merge con main, push, crear PR, esperar CI en verde, mergear (squash) y sincronizar la rama de vuelta. Usar SIEMPRE que se termina de editar/crear archivos de código en este repo y corresponde subirlo, sin que haga falta que el usuario repita el flujo paso a paso — dispara con "subilo", "mergealo", "creá el PR", "llevalo a producción", "dale" (después de haber mostrado una propuesta e implementado), o simplemente al cerrar cualquier tarea de código que termina en "esto ya está, ahora hay que publicarlo".
---

# Ship — llevar un cambio a producción

Este repo (Next.js + Supabase) trabaja siempre sobre una sola rama de
feature de larga vida (`claude/mobile-financial-vision-edits-1zfouk`),
nunca ramas nuevas por cambio — cada tarea es un commit + PR separado
contra `main`. Antes de esto, leer `CLAUDE.md` y `memory.md` en la raíz
del repo si todavía no están en contexto: ahí están las convenciones de
código y el estado reciente del proyecto.

## Cuándo usarla

Después de terminar una edición de código que el usuario pidió (o
aprobó explícitamente, ej. "dale", "implementalo"). No es para cambios
exploratorios a medio hacer, ni para texto/propuestas que todavía no
se confirmaron. Si el pedido fue solo "dame una propuesta", esta skill
no aplica todavía.

## Pasos

Ejecutar en este orden, sin saltear ninguno:

1. **Typecheck**: `npx tsc --noEmit` desde la raíz del repo. Si tira
   errores, arreglarlos antes de seguir — nunca commitear con el
   typecheck roto.

2. **Commit**: `git add` solo los archivos relevantes al cambio (no
   `-A` a ciegas si hay archivos sueltos que no tienen que ver). El
   mensaje va en español, explica el POR QUÉ del cambio (no solo qué
   archivos tocó), y termina con las líneas de atribución que el
   sistema haya dado para esta sesión (`Co-Authored-By: ...` y
   `Claude-Session: ...` — tomarlas del recordatorio de atribución
   activo, nunca inventarlas ni reusar las de una sesión vieja).

3. **Traer main**: `git fetch origin main && git merge origin/main
   --no-edit`. Resolver conflictos si aparecen (raro, dado que cada
   PR se mergea antes de empezar el siguiente).

4. **Push**: `git push -u origin claude/mobile-financial-vision-edits-1zfouk`,
   con reintento exponencial (2s/4s/8s/16s) solo ante error de red.

5. **Crear el PR**: `mcp__github__create_pull_request` contra
   `visaofinanceirabusiness-cpu/Vision-Finaciera`, base `main`, head la
   rama de arriba. Título corto en español. Body con: qué cambió y por
   qué (no una lista de archivos), un test plan breve (typecheck +
   qué falta probar a mano), y termina con:
   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   <link de la sesión actual>
   ```

6. **Esperar CI**: `mcp__github__pull_request_read` con
   `method: "get_status"`. El deploy de Vercel suele tardar ~1 minuto
   — no hagas polling corto en loop; usa el tool `Monitor` con un
   comando `sleep 60; echo done` (o similar) y recién después volvé a
   chequear el estado. Si CI falla, diagnosticar y arreglar antes de
   mergear — nunca mergear con CI en rojo.

7. **Mergear**: `mcp__github__merge_pull_request` con
   `merge_method: "squash"`, solo cuando el estado sea `success`.

8. **Sincronizar la rama local**: después del merge, `git fetch origin
   main && git checkout claude/mobile-financial-vision-edits-1zfouk &&
   git merge origin/main --no-edit && git push` — así la rama local
   queda al día con el squash commit recién creado, para que el
   próximo cambio no arrastre un diff viejo.

## Notas

- Si el cambio toca el motor contable (`lib/motor.ts`,
  `lib/categorias.ts`) o cualquier dato real de una empresa activa,
  confirmar con el usuario ANTES de llegar a este punto — esta skill
  asume que la implementación ya fue aprobada, no decide si algo debe
  implementarse.
- Si el cambio incluye una migración de Supabase, esta skill no la
  aplica — eso se hace aparte con las tools de Supabase MCP antes de
  llegar al paso 1. Mencionar en el commit qué migración se aplicó.
- Al terminar (después del paso 8, o si el usuario pide cerrar la
  sesión), actualizar `memory.md` con lo que cambió si es información
  que otra sesión necesitaría para no repetir trabajo — no hace falta
  para cambios chicos/cosméticos.
