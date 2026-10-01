---
name: mantenimiento
description: Mantenimiento periódico (mensual, día 1) del sistema Vision-Finaciera — análisis total del código, diagnóstico de salud (archivos gigantes, duplicación, tipado, dependencias desactualizadas, falta de tests) y plan de mejoras priorizado. Usar el día 1 de cada mes (vía la Routine programada), o cuando el usuario pida explícitamente "mantenimiento del sistema", "análisis de código", "revisión mensual" o similar.
---

# Mantenimiento mensual del sistema

Esta skill produce un informe — NO implementa cambios de código por su
cuenta. El objetivo es diagnosticar y proponer; las mejoras se
implementan en tareas separadas, cada una con su propio PR vía la
skill `ship`, después de que el usuario las apruebe.

## Antes de empezar

Leer `CLAUDE.md` y `memory.md` en la raíz del repo. Leer también el
informe del mes anterior en `mantenimiento/<AAAA-MM>.md` (el más
reciente que exista) — el diagnóstico de este mes debe comparar contra
ese, no repetir el análisis desde cero como si fuera la primera vez.

## Qué revisar

No hace falta leer cada archivo del repo entero — usar comandos que
den una foto rápida y después profundizar donde aparezca algo raro:

1. **Tamaño de archivos**: `find src -name "*.ts" -o -name "*.tsx" |
   xargs wc -l | sort -rn | head -30` — qué pantallas/módulos crecieron
   desde el mes pasado, cuáles ya pasan ~1500-2000 líneas.
2. **Duplicación**: buscar funciones/constantes que deberían vivir en
   un solo lugar pero se repiten (ej. `grep -rn "function
   fechaLocalHoy"` fue un caso real) — no todo lo repetido es un
   problema (ver la convención de `COLORES` por pantalla en
   `CLAUDE.md`, esa es deliberada), pero vale la pena mirar.
3. **Tipado**: `grep -rn ": any\b\|as any\b" src` — cuántos escapes de
   tipo hay y si crecieron.
4. **Tests y linter**: ¿sigue sin haber tests? ¿se configuró ESLint?
   (si alguien corre `next lint` sin querer, puede pisar `tsconfig.json`
   — ver nota en el informe de octubre 2026).
5. **Dependencias**: `npm outdated` — qué tan atrás están Next/React/
   TypeScript respecto a la última versión, si subió el riesgo.
6. **Motor contable**: si hubo cambios en `lib/motor.ts` o
   `lib/categorias.ts` este mes, prestar atención extra — es la parte
   de más riesgo del sistema (afecta plata real).

## Cómo escribir el informe

Guardar en `mantenimiento/<AAAA-MM>.md` (ej. `mantenimiento/2026-11.md`),
con esta estructura:

```markdown
# Mantenimiento Mensual — <Mes Año>

## Resumen ejecutivo
(3-5 líneas: qué cambió desde el mes pasado, qué tan sano está el
sistema en general)

## Hallazgos
(por categoría: archivos grandes, duplicación, tipado, tests/linter,
dependencias — cada uno con el dato concreto, no una opinión genérica)

## Plan de mejoras propuesto
(priorizado: Fase 1 bajo riesgo / esta semana, Fase 2 refactor
estructural, Fase 3 blindaje, Fase 4 mediano plazo — igual formato que
el informe de octubre 2026, ajustando fases según lo que ya se hizo)

## Seguimiento del mes anterior
(qué de lo propuesto el mes pasado se hizo, qué quedó pendiente y por
qué — si nunca se tocó algo de la Fase 1 por dos meses seguidos,
decirlo explícitamente en vez de volver a proponerlo igual)

## Próxima revisión
(primer día del mes siguiente)
```

Al terminar: actualizar `memory.md` con un link al nuevo informe (una
línea alcanza, no hace falta copiar el contenido), y subir el informe
con la skill `ship` (es solo un archivo de texto, pero igual sigue el
flujo normal: commit, PR, merge — así queda en el historial del repo
como cualquier otro cambio).

## Qué NO hacer acá

- No implementar las mejoras propuestas en la misma sesión salvo que
  el usuario lo pida explícitamente después de leer el informe.
- No proponer una reescritura grande de una pantalla completa — los
  archivos de este repo son grandes a propósito (una pantalla, un
  archivo — ver `CLAUDE.md`); el objetivo es reducir duplicación y
  extraer piezas autocontenidas, no imponer una arquitectura nueva.
- No tocar `lib/motor.ts`/`lib/categorias.ts` como parte del
  mantenimiento sin que el usuario lo pida — diagnosticar ahí, no
  refactorizar sin permiso explícito (ver CLAUDE.md, "ALTO RIESGO").
