# memory.md

Contexto vivo del proyecto — lo que cambia sesión a sesión. Reglas
estables van en `CLAUDE.md`; esto es historial reciente, pendientes y
limitaciones conocidas. Actualizar al final de cada sesión con cambios
relevantes; no hace falta detallar cada PR, solo lo que otra sesión
necesitaría saber para no repetir trabajo o pisar una decisión ya
tomada.

## Análisis Mensual Automático — Fase A (03/10/2026)
Antes se mandaba a mano por Mensajes (ver mensajes_financieros) un
"Análisis a fondo" del mes — se hizo manualmente para Buenaventura y
Ocaña (septiembre). Ahora es automático, el día 1 de cada mes, para
cualquier empresa:

- `lib/analisisMensual.ts`: función PURA (sin Supabase) que arma el
  mensaje a partir de las operaciones del mes — ingresos
  (COBRO/VENTA) vs egresos (PAGO/COMPRA), aportes (INVERSION) y
  extracciones aparte, top categorías, actividad en el sistema. Sirve
  para cualquier perfil de empresa, no solo Familia. Con menos de 10
  operaciones o menos de 5 días con actividad en el mes
  (`MINIMO_OPERACIONES_PARA_ANALISIS_COMPLETO`/
  `MINIMO_DIAS_CON_ACTIVIDAD...`), en vez de un desglose pobre manda
  un mensaje corto motivador + invitación a hablar con un asesor.
  Tiene tests (`analisisMensual.test.ts`).
- `api/analisis-mensual/generar`: cron nuevo (`vercel.json`, día 1 a
  las 6am UTC), protegido con `CRON_SECRET` igual que
  `plan-accion/resumen-diario`. Recorre empresas con `activo`,
  `onboarding_completado` y `analisis_mensual_habilitado` en true,
  calcula el mes recién cerrado (con el mismo ajuste UTC-3 a mano que
  ya usa `cotizaciones/actualizar` — el server de Vercel corre en
  UTC) y guarda el mensaje. Es idempotente: si ya existe un mensaje
  para esa empresa+período con título que arranca "📊", no duplica.
  **Ojo real que casi se me escapa**: `registro_operaciones.total` es
  `numeric` en Postgres y Supabase lo devuelve como *string* — sin
  convertir con `Number()` antes de sumarlo, la suma hubiera sido
  concatenación de texto. Si se toca este archivo o se arma otro
  parecido, no asumir que un campo numeric ya viene number.
- `empresas.analisis_mensual_habilitado` (columna nueva, default
  `true`) — toggle visible en Panel de Control
  (`AnalisisMensualToggle.tsx`, autocontenido, mismo patrón que
  `PersonalizacionColoresSeccion.tsx`), bloqueado para Asistente
  (la política RLS `e3_bloquear_edicion_empresa` ya lo impide a nivel
  de base, el toggle solo lo refleja en la UI).

**No se pudo probar en vivo contra Supabase real** (el cron necesita
`SUPABASE_SERVICE_ROLE_KEY`, que no está disponible desde este
entorno a propósito) — se validó con tests unitarios de la función
pura, `tsc`, `lint` y `next build` (la ruta compila y aparece como
dinámica). Si algo falla la primera vez que corra en producción (día
1 de noviembre), revisar primero el formato de `total` como string —
ver el comentario de arriba — antes de asumir otra causa.

**Decisiones ya confirmadas por el usuario (03/10/2026) para B/C:**
1. Umbral de "pocos movimientos" queda como está (10 operaciones / 5
   días).
2. Fase C arranca con festejo simple (texto festivo), no el modal de
   confetti real — se puede sumar después.
3. El segundo mensaje (Fase C) va **5 días después** del primero, por
   empresa (no una fecha global) — aplica a todas. Buenaventura y
   Ocaña ya tienen su primer mensaje (mandado a mano el 03/10), así
   que cuando se implemente Fase C hay que calcular su "5 días
   después" desde esa fecha real, no asumir que arrancan desde cero.

**Fase B — hecha (03/10/2026):** `panel-maestro/analisis-mensual`
(nueva pantalla, exclusiva de `es_admin_plataforma`, mismo patrón que
`panel-maestro/auditoria`) — tabla con estado de cada empresa activa
para "el mes que acaba de cerrar" (mismo cálculo que el cron, pero en
hora local del navegador del admin, no hace falta el ajuste UTC-3):
🟢 enviado completo / 🟡 enviado motivacional / ⚪ deshabilitado por
el cliente / 🔴 todavía no se generó — con la fila completa resaltada
en rojo si la empresa tuvo pocos o ningún movimiento ese mes (mismos
umbrales de `lib/analisisMensual.ts`, importados de ahí para no
duplicar el criterio). Acceso nuevo en Panel Maestro → Herramientas →
Análisis. No se pudo probar logueado como admin real (sin
credenciales desde este entorno) — validado con `tsc`, `lint`,
`next build` (la ruta aparece como página estática nueva).

**Fase C — hecha (03/10/2026):** segundo mensaje de agradecimiento,
festejo simple (texto con emojis, no el modal de confetti real):
- `lib/agradecimientoMensual.ts`: función PURA
  `construirMensajeAgradecimiento(idioma)` — mensaje corto, título
  "🎉 ¡Gracias por usar Visão Financeira!" / PT equivalente. Tests en
  `agradecimientoMensual.test.ts`.
- `api/analisis-mensual/agradecer`: cron nuevo, corre TODOS LOS DÍAS
  (`vercel.json`, 7am UTC — a diferencia del cron de Fase A que es
  solo el día 1, este tiene que revisar cada día porque el "5 días
  después" cae en fechas distintas por empresa). Por cada empresa
  activa+habilitada, busca su mensaje "📊"-análisis más reciente con
  `creado_en` ≥ 5 días, y si no tiene ya un "🎉"-agradecimiento para
  ese mismo `periodo`, lo inserta. Al ser por empresa (no una fecha
  global), Buenaventura y Ocaña —que recibieron el análisis a mano el
  03/10, antes de que existiera este cron— también les va a llegar en
  su propio día 5 sin tratamiento especial.
- Tampoco se pudo probar en vivo (mismo motivo: sin
  `SUPABASE_SERVICE_ROLE_KEY` en este entorno) — validado con tests
  unitarios, `tsc`, `lint`, `next build` (aparece como ruta dinámica).

Con esto el feature "Análisis Mensual Automático" (Fases A+B+C) queda
completo.

## Mis Ingresos / Mis Vencimientos / Salud de Caja — selector de período compartido + ♻️ Salud de Caja (03/10/2026)
Antes Mis Vencimientos mezclaba implícitamente "este mes" con
"próximo mes" (atenuado en gris) en una sola vista, sin poder elegir
qué mes mirar. Primero se le agregó un selector propio a Mis
Vencimientos; después, al pedir comparar eso contra el saldo bancario
y los ingresos pendientes, se unificó todo: ahora el período se elige
UNA sola vez, en el panel nuevo del medio (♻️ Salud de Caja), y se
pasa como prop controlado a los tres:
- `MisIngresos.tsx` y `MisVencimientos.tsx` ya NO manejan su propio
  `periodoSeleccionado` — lo reciben por prop desde
  `panel-de-control/page.tsx` (estado `periodoFlujoCaja`). Los dos
  filtran igual: todo lo que vence en el período elegido se muestra
  (pagado y pendiente juntos, ya no hace falta destapar nada con el
  botón "⋯" — ese botón quedó solo para gestionar plantillas), pero el
  total solo suma lo pendiente.
- Los períodos disponibles ahora son un rango FIJO por fecha (2 meses
  atrás a 3 meses adelante — `periodosDisponibles()` en `lib/fecha.ts`,
  con tests), no derivado de qué datos ya estén cargados — así los
  tres paneles siempre ofrecen las mismas opciones sin depender de que
  cada uno haya terminado de cargar su propia data.
- **`♻️ Salud de Caja`** (`components/panel/SaludDeCaja.tsx`, nuevo,
  entre Mis Ingresos y Mis Vencimientos en el grid de
  `panel-de-control/page.tsx` — por eso en el medio): círculo (SVG,
  arco proporcional) que compara, para el período elegido:
  - DISPONIBLE = saldo de las "cuentas de dinero" que el cliente elige
    + lo que falta cobrar ese período (Cuentas por Cobrar + Ingresos
    Recurrentes pendientes).
  - NECESARIO = Pasivos + Gastos Recurrentes pendientes ese período.
  - Diferencia: verde si sobra, naranja/rojo si falta.
  - "Cuenta de dinero" = una Forma de Pago que resuelve a una cuenta
    del plan de cuentas de tipo ACTIVO (Caja/Banco) — se excluyen las
    que resuelven a PASIVO (Tarjeta de Crédito). El saldo en vivo se
    calcula con `obtenerSaldoCuenta` (`lib/motor.ts`), el mismo cálculo
    que ya usaba `lib/saldoCuenta.ts` para no dejar una cuenta en
    negativo — no se inventó un cálculo de saldo nuevo.
  - Qué cuentas se suman queda guardado en
    `formas_pago.incluir_en_salud_caja` (columna nueva, default
    `false`, agregada vía MCP) — fijo hasta que alguien lo cambia a
    mano con el checkbox de cada cuenta en el propio panel. Es una
    preferencia de la EMPRESA, no de cada usuario.
  - Toda la lógica nueva vive en `lib/saludCaja.ts`
    (`listarCuentasDeDinero`, `cambiarCuentaEnSaludCaja`).
- OJO si se toca de nuevo: para un gasto/ingreso recurrente, elegir un
  mes futuro puede mostrar "sin pendientes" aunque el usuario espere
  ver algo — es esperado, `generarRecordatoriosPendientes`/
  `generarRecordatoriosIngresosPendientes` no arman el recordatorio
  del período siguiente hasta que el actual se resuelve, no es un bug
  de este cambio.
- No se pudo probar logueado en vivo (sin credenciales en este
  entorno) — validado con `tsc`, `lint`, `vitest` (27/27 tests, 5
  nuevos de `periodosDisponibles`/`formatearPeriodo`/
  `sumarMesesPeriodo` en `lib/fecha.test.ts`) y `next build`.

## Plan de Acción (Buenaventura) ↔ Calendário — sincronizados (03/10/2026)
Bug real: los 30 días del Plan de Acción de Buenaventura (feature a
medida, ver `lib/planAccionEmpresas.ts`) tenían sus eventos en
Calendário Organizador (`eventos_calendario`) cargados A MANO de una
sola vez, con fechas consecutivas fijas asumiendo un día de plan por
día de calendario — totalmente desconectados del progreso real
(`plan_accion_dias.estado`, que se desbloquea solo al completar el
día anterior, sin importar la fecha). Si un día se atrasaba, el
calendario seguía mostrando "Día 4", "Día 5"... en fechas ya pasadas,
como si esas tareas se hubieran salteado, cuando en realidad seguían
`BLOQUEADO` esperando el cierre del día anterior.

Arreglado de raíz en `lib/planAccion.ts` (`completarDia`) + columna
nueva `plan_accion_dias.evento_calendario_id` (FK a
`eventos_calendario`, agregada vía MCP) + se empezó a usar
`fecha_iniciado` (ya existía en la tabla, sin usar):
- Al desbloquear un día, se le crea su propio evento en el calendario
  fechado HOY (no una fecha fija asumida de antemano).
- Al completar un día, su evento se marca con cuántos días tardó
  (`✅ completado con N días de atraso` o `✅ completado en el día`).
- Un cron diario ya existente (`api/plan-accion/resumen-diario`, el
  mismo que manda el push/email de resumen) ahora también pospone a
  hoy el evento del día activo si sigue sin completarse, dejando en
  la nota cuántos días de atraso lleva (`⏳ N días de atraso. ...`) —
  así queda un historial de la demora de cada día, visible en el
  propio evento del calendario.
- Nueva función pura `diasEntre` en `lib/fecha.ts` (con tests) para
  medir la diferencia en días de calendario. OJO: el cron usa su
  propia versión local de "hoy" con el offset UTC-3 a mano (mismo
  patrón que `api/cotizaciones/actualizar/route.ts`), no
  `fechaLocalHoy()` de `lib/fecha.ts` — esa asume hora del navegador,
  rompería en el server. `completarDia` sí usa la de `lib/fecha.ts`
  porque corre en el browser.

**Datos de Buenaventura corregidos a mano (03/10/2026)**: el Día 3
(el activo, con 9 días de atraso en ese momento) se vinculó a su
evento existente y se reprogramó a hoy con la nota de atraso. Los
eventos "Día 4" a "Día 30" (27, todos sobre días aún `BLOQUEADO`,
con fechas ya sin sentido) **no se pudieron borrar desde acá** — el
`DELETE` vía MCP de Supabase se cuelga sin confirmar en este entorno
(probado varias veces, hasta con un solo registro; `UPDATE` sí
funciona). Quedó pendiente que el usuario los borre a mano desde el
Calendário (un rato, son consecutivos del 25/09 al 21/10). Si
aparece el mismo problema de `DELETE` colgado en otra sesión, no es
un bug de esta tarea — documentarlo y resolver igual con `UPDATE` o
pidiéndole el borrado al usuario.

## Mantenimiento mensual
Día 1 de cada mes corre la skill `mantenimiento` (Routine programada,
sin conectores MCP — ver nota abajo) — análisis de salud del código +
plan de mejoras, guardado en `mantenimiento/<AAAA-MM>.md`. Primer
informe: `mantenimiento/2026-10.md`. La Routine no tiene conectores de
GitHub/Supabase pasados, así que cuando dispare sola puede trabarse en
el paso de crear el PR — el usuario decidió dejarla así por ahora
(01/10/2026), no recrearla desde la UI de claude.ai todavía.

**Fase 1 del informe de octubre — completada (01/10/2026):**
`fechaLocalHoy()` desduplicada en `MisVencimientos.tsx`/
`MisIngresos.tsx` (la de `api/cotizaciones/actualizar/route.ts` NO era
duplicado real — corre server-side con su propio offset UTC-3 a
propósito, no tocar). Los 5 `any` de `mercaderia/page.tsx` tipados como
`Clave` (ya existía el tipo, solo faltaba exportarlo).

**Fase 2 del informe de octubre — completada (01/10/2026):**
`MisDatosSeccion`, `PersonalizacionColoresSeccion` y
`GestionAsistentes` se movieron de `configuracoes/page.tsx` a
`src/components/configuracoes/` (junto con un `estilosCompartidos.ts`
nuevo para los estilos que esas 3 secciones comparten con el resto de
la pantalla). `configuracoes/page.tsx`: 4005 → 3232 líneas, mismo
comportamiento (PR #323, mergeado).

Mismo tratamiento para `contabilidad/page.tsx` (PR #325, mergeado):
las 4 pestañas (Central de Lançamentos, Registro de Operaciones, Libro
Diario, Editar Registros) y sus helpers privados se movieron a
`src/components/contabilidad/`, con `compartido.ts` (contextos,
`COLORES`, `OPERACIONES_EDITABLES`, tipos `ValoresIniciales`/
`LineaFormulario`/`Registro`, `construirValoresEdicion`) y
`estilosCompartidos.ts` para lo que comparten las 4 pestañas, más un
`celdas.tsx` para `Th`/`Td`/`Estado` (usados tanto por Registro de
Operaciones como por Libro Diario). `contabilidad/page.tsx`: 3927 →
279 líneas, mismo comportamiento.

**Fase 3 del informe de octubre — completada parcialmente (01/10/2026):**
ESLint configurado (`next/core-web-vitals`, `npm run lint`) — se
corrigieron los 4 errores reales que tenía el repo (comillas sin
escapar en JSX, en `panel-maestro/page.tsx` y
`panel-maestro/seguranca-dados/page.tsx`); quedan solo warnings de
`react-hooks/exhaustive-deps` preexistentes en varias pantallas, no
tocados a propósito (cambiar esos arrays de dependencias puede
cambiar el timing de efectos ya probados en producción — no se tocan
sin pedido puntual). Vitest configurado (`npm test`,
`vitest.config.ts`, env dummy de Supabase para que los módulos que
importan `lib/supabase.ts` no revienten al cargarse).

Tests unitarios: solo se pudo cubrir `generarCodigo`
(`lib/categorias.ts`) — es la ÚNICA función realmente pura de
`categorias.ts`; todo el resto de `categorias.ts` y **absolutamente
todo** `lib/motor.ts` son funciones `async` que hablan con Supabase en
el medio de la lógica (no hay una capa de "decisión pura" separada de
la I/O). El informe de octubre asumía que eran "en su mayoría puras"
— no es así. Para testear `motor.ts` de verdad hacen falta, en orden
de preferencia: (a) mockear el cliente de Supabase completo
(`vi.mock('@/lib/supabase')`) — factible pero son muchas llamadas
encadenadas (`.from().select().eq()...`) distintas por función, mock
grande y frágil de mantener; o (b) separar la lógica de resolución de
roles/cuentas de la I/O dentro de `motor.ts` — un cambio real al
motor contable, ALTO RIESGO, requiere pedido explícito antes de
tocarlo. Ninguna de las dos se hizo todavía — queda como el próximo
paso si se quiere seguir profundizando la Fase 3, pero es trabajo
grande aparte, no algo para colar de pasada.

**Fase 4 del informe de octubre — hecha en rama separada
`upgrade-next-react` (01/10/2026):** upgrade Next 14.2.5 → 16.3.8 y
React 18.3.1 → 19.3.0, de a un salto por vez (14→15, React 18→19,
15→16), con codemods oficiales en cada paso
(`@next/codemod next-async-request-api`,
`types-react-codemod preset-19` — ninguno de los dos modificó código,
esta app no usaba los patrones deprecados que corrigen). Verificado en
cada paso con `tsc --noEmit`, `npm test`, `next build` completo (con
`.env.local` apuntando al proyecto real de Supabase vía MCP — las
claves públicas, no hace falta pedirle nada al usuario) y, con
Playwright temporal, screenshots + chequeo de consola del navegador en
~10 pantallas clave (login, contabilidad, panel-de-control,
configuracoes, informes, mercaderia, recursos-humanos, producción,
nuestro-sueno) — cero errores/warnings de consola y cero diferencia
visual en todo el proceso. **Limitación de esta verificación**: no
había credenciales reales para loguearse, así que no se probaron
flujos autenticados de punta a punta (cargar una operación, etc.) —
eso lo tiene que probar el usuario en el preview de Vercel antes de
confirmar el merge.

Hallazgos del upgrade, documentados para la próxima vez:
- **`next lint` ya no existe en Next 16** — se cambió `npm run lint` a
  `eslint . --ext .ts,.tsx` directo (mismo `.eslintrc.json`, mismo
  resultado). Ver nota en `CLAUDE.md`.
- **Next 16 + Turbopack exige `"jsx": "react-jsx"`** en `tsconfig.json`
  (antes `"preserve"`) — a diferencia del resto del ruido que agrega
  `next build` en `include`/`plugins` (que no aporta nada y se
  revierte), este cambio sí hace falta y se dejó aplicado a mano,
  sin el reformateo del resto del archivo.
- **Next 16 agrega automáticamente un bloque a `CLAUDE.md`** en cada
  `next dev` (su propia guía para agentes de IA, entre marcadores
  `<!-- BEGIN/END:nextjs-agent-rules -->`). Se sacó y se desactivó
  con `next.config.js` → `{ agentRules: false }`, para que
  `CLAUDE.md` siga siendo 100% curado por el equipo.
- Hubo un 404 real y transitorio del registry de npm en
  `baseline-browser-mapping@2.11.27` (una dependencia transitiva de
  Next 16) — se fijó la versión a `2.11.26` con `overrides` en
  `package.json`. Si en el futuro se nota que ya no hace falta
  (porque el registry ya sirve bien esa versión), se puede probar a
  sacarlo.
- `eslint-config-next` quedó en `14.2.5` (no en `16.x`) porque la
  versión que acompaña a Next 16 pide ESLint ≥9 con flat config
  (`eslint.config.js`), y este repo sigue en ESLint 8 con
  `.eslintrc.json` clásico — migrar eso es una tarea aparte, no
  bloqueante (el lint de hoy sigue andando igual).
- Warning aparte, no relacionado a este upgrade: `@zxing/library`
  pide Node ≥24 y acá hay Node 22 — sigue funcionando, es solo un
  `EBADENGINE` warning de npm, no se tocó.

Falta: abrir PR de `upgrade-next-react` contra `main`, esperar CI, y
que el usuario revise el preview de Vercel (sobre todo un flujo
logueado real) antes de mergear — no se mergea solo por haber pasado
los chequeos automáticos, dado el alcance del cambio.

Además (01/10/2026, no parte del plan de octubre): se eliminó de
Configurações el link `🦉 Sabio (beta)` (`/sabio-bot`) de la barra de
tabs — era un acceso de prueba a un prototipo, no un feature terminado
(PR #324, mergeado).

## Empresas de referencia (para probar features)
- **Buenaventura** y **Ocaña** — perfil Familia, las más usadas para
  probar gamificación/objetivos/trofeos
- **Equilibra**, **Encanto**, **Origen Natural** — perfil Comercial/
  Mixto, usadas para probar Cuentas a Cobrar/Pagar

## Features del perfil Familia (recientes)
- **Objetivos Escalonados** (`lib/objetivosEscalonados.ts` +
  `components/panel/ObjetivosEscalonados.tsx`): 3 operaciones (Pago,
  Cobro, Transferencia) con 3 checkpoints crecientes por nivel (1-10),
  resetean al subir de nivel. Viven en Panel de Control, arriba de
  todo para Familia (independiente del período elegido).
- **Trofeos** (`lib/trofeos.ts` + `components/panel/VitrinaTrofeos.tsx`):
  acumulado histórico (nunca resetea) de Pago/Cobro/Transferencia,
  tiers Bronce/Plata/Oro. Vitrina en el lobby. Tabla
  `trofeos_empresa` en Supabase.
- Festejo compartido: `lib/festejoVisual.ts` + `components/panel/
  FestejoModal.tsx` — mismo confetti/sonido que ya usaba
  `GamificacionHitoModal`, extraído para reutilizar.
- Apariencia personalizable (CONFIGURAÇÕES → Apariencia, todos los
  perfiles): colores + fondo. Fondo son 6 paisajes en **degradados
  CSS**, NO fotos reales — este entorno no tiene salida a internet
  para descargarlas. Si el usuario sube fotos reales, reemplazar los
  valores en `lib/apariencia.ts` (`FONDOS_DISPONIBLES[].fondoCss`) sin
  tocar el resto del mecanismo.

## Motor contable — bug corregido (Cuentas a Cobrar/Pagar)
Un Cobro contra una Cuenta a Cobrar (ej. "cobrar a Brenda") inflaba la
cuenta en vez de cancelarla y duplicaba el ingreso — nunca pedía el
banco real. Corregido con `habilitarLiquidacionCuentaCobrar/Pagar`
(`lib/categorias.ts`): la misma cuenta se habilita también como
categoría, con el rol invertido (débito medio financiero / crédito la
cuenta por cobrar). Aplicado retroactivamente a las empresas que ya
tenían esto activo. **No se corrigieron registros históricos** (ej. el
cobro a Brenda en Buenaventura sigue tal cual estaba) — si el usuario
pide corregir uno puntual, se hace a mano desde Contabilidad.

## Lobby — Panel de Control con tarjeta propia
Panel de Control salió de la grilla de "Tus Herramientas" y tiene su
propia tarjeta destacada arriba de Sabio del Azar
(`components/panel/PanelControlLobby.tsx`), con ilustración propia en
`public/sabio/sabio-panel-control.png` y borde grueso con degradado
metálico. Mismo modelo visual que `SabioAzarLobby`/`SabioBotLobby`.

## Overflow horizontal en celular (varias correcciones)
Patrón recurrente: grillas con `minmax(Npx, 1fr)` y filas con
`flexWrap: nowrap` + scroll horizontal se rompían en celulares
angostos (<480px) — contenido o barras saliéndose de la tarjeta.
Corregido en:
- `MisVencimientos.tsx` (Pasivos/Gastos Recurrentes/Plantillas): clases
  `mv-fila`/`mv-texto`/`mv-derecha` + `@media (max-width: 560px)` que
  apila en vez de scrollear.
- `panel-de-control/page.tsx`: clase `grilla-responsiva` +
  `@media (max-width: 480px)` en las grillas de Endeudamiento/Fondo de
  Respaldo, Mis Ingresos/Vencimientos y Composición del Patrimonio.
- `DistribucionPieChart.tsx`: el SVG tenía ancho fijo (220px) y la
  leyenda un `minWidth: 260` — ninguno se achicaba lo suficiente ni
  siquiera dentro de una sola columna. Ahora `width: min(100%, 220px)`
  en el SVG y `minWidth: 160` en la leyenda.

Si aparece otro caso de "se sale de la pantalla en celular", es casi
seguro el mismo patrón (ancho mínimo fijo que no cede) — buscar
`minmax(`, `nowrap` o `minWidth` grandes en el componente afectado
antes de inventar algo nuevo.

## Pendientes / ideas no implementadas
- Fondos de Apariencia con fotos reales (ver arriba) — pendiente de
  que el usuario las suba, o de que el entorno tenga salida a
  internet.
- Nada más pendiente a la fecha de este registro — si encontrás algo
  a medio hacer, agregalo acá antes de asumir que está completo.
