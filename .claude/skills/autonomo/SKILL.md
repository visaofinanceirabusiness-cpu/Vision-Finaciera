---
name: autonomo
description: Modo autónomo para esta sesión/tarea — dejar de proponer en texto y esperar un "Dale" antes de implementar, e ir directo a hacer el cambio y subirlo (commit, PR, merge). Se activa cuando el usuario lo pide explícitamente — "modo autónomo", "no me pidas autorización", "actuá solo", "/autonomo", "dale manija", "no esperes que te confirme" — o escribe `/autonomo` al principio del pedido. Dura hasta que el usuario pida volver al modo normal ("volvé a preguntarme primero", "salí del modo autónomo") o termine la sesión.
---

# Modo autónomo

Activa, para lo que queda de esta sesión (o de la tarea puntual que el
usuario marcó), una excepción a la regla de `CLAUDE.md`: *"Para
cambios grandes/ambiguos... proponer en texto primero, esperar
confirmación explícita antes de implementar."* En modo autónomo, en
cambio: se decide el enfoque razonable y se implementa directo, sin
pausar a esperar un "Dale".

## Qué NO cambia (sigue aplicando igual que siempre)

- **El motor contable es zona excluida de este modo.** Cualquier
  cambio a `lib/motor.ts`, `lib/categorias.ts`, la lógica de
  `reglas_contables`/`matriz_operaciones`, o cualquier edición masiva
  de datos reales de clientes activos (vía Supabase MCP) **sigue
  necesitando la propuesta en texto y la confirmación explícita de
  siempre** — ahí un error afecta plata real, y el usuario pidió
  específicamente dejar esa puerta cerrada incluso en modo autónomo.
  Si una tarea autónoma termina necesitando tocar algo de esto, se
  frena en ese punto puntual, se explica por qué, y se espera
  confirmación solo para esa parte — el resto de la tarea sigue
  andando sola.
- **Los "nunca" de git y de acciones riesgosas siguen siendo nunca**:
  nada de `--force`, `reset --hard`, saltear hooks, pisar historia de
  una rama ajena, ni ninguna de las operaciones destructivas listadas
  en las instrucciones del sistema. Modo autónomo es "no preguntes
  antes de avanzar", no "ignorá las barandas de seguridad".
- **Seguir* el flujo de `ship`** (typecheck → commit → merge main →
  push → PR → esperar CI → mergear → sincronizar rama) para cualquier
  cambio de código — eso no se salta, solo deja de haber una pausa
  pidiendo permiso entre "propuesta" e "implementación".
- Comunicar igual lo que se hizo. Modo autónomo no es modo silencioso:
  después de cada tarea, un resumen corto de qué se cambió y por qué,
  igual que siempre — simplemente no se pide luz verde antes de
  empezar.
- Si algo es genuinamente ambiguo incluso para una decisión razonable
  (dos interpretaciones del pedido que llevan a resultados muy
  distintos, no solo detalles de implementación), sigue estando bien
  preguntar — modo autónomo reduce las preguntas de "¿puedo
  implementar esto que te propuse?", no elimina la posibilidad de
  pedir una aclaración cuando hace falta para no adivinar mal.

## Qué SÍ cambia

- Ante un pedido de feature/fix/cambio de UI que antes hubiera
  merecido "te propongo esto, ¿va así?": se elige el enfoque más
  razonable (consistente con los patrones ya usados en el repo, ver
  `CLAUDE.md`) y se implementa directo, sin escribir la propuesta
  como paso separado a confirmar.
- Al terminar de editar código, se aplica la skill `ship` sin
  preguntar "¿lo subo?" — se sube directo.
- Decisiones de diseño menores (nombres, dónde ubicar un componente,
  qué mensaje de error mostrar) se toman sin preguntar, documentando
  la decisión en el resumen final si vale la pena que el usuario la
  conozca.

## Cómo volver al modo normal

El usuario puede pedir salir del modo autónomo en cualquier momento
("volvé a preguntarme primero", "salí del modo autónomo", "de nuevo
con propuestas") — a partir de ahí se retoma la regla normal de
`CLAUDE.md` (proponer y esperar confirmación en cambios grandes o
ambiguos). Si no se pide salir, el modo autónomo dura lo que dura la
sesión actual — una sesión nueva arranca otra vez en modo normal,
salvo que el usuario la invoque de nuevo.
