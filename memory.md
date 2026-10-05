# memory.md

Contexto vivo del proyecto — lo que cambia sesión a sesión. Reglas
estables van en `CLAUDE.md`; esto es historial reciente, pendientes y
limitaciones conocidas. Actualizar al final de cada sesión con cambios
relevantes; no hace falta detallar cada PR, solo lo que otra sesión
necesitaría saber para no repetir trabajo o pisar una decisión ya
tomada.

## Compromisos: unificar Cobrar/Pagar + recurrentes (04/10/2026) — EN CURSO
Problema: 4 conceptos (Cuentas a Cobrar, Pasivos, Ingresos y Gastos
Recurrentes). Los recurrentes son solo recordatorios (no generan
asiento ni están en el balance); Cuentas a Cobrar y Pasivos sí.
**Decisiones del usuario**: quedan 2 conceptos (Cuentas a Cobrar /
Cuentas a Pagar); los recurrentes pasan a ser "una forma de generar
cuotas", programadas a **12 meses móviles** y **reconocidas mes a mes
(devengado), el día 1** — NO se reconoce todo el año de golpe (inflaría
ingresos/Activo de hoy). Carga y gestión en **pestaña propia
"Compromisos"** (desde 05/10/2026 vive en la herramienta **Finanzas**, `/finanzas`, para todos los perfiles; ya no está en Contabilidad); el Panel de Control queda de solo
lectura (análisis) y las alertas/vencimientos (Sabio, Calendário, push)
no se tocan.
- **Finanzas Fase 1 (05/10/2026)**: nueva herramienta `/finanzas` (tarjeta en el lobby + `AccesosHerramientas`), primera y única pestaña Compromisos (`components/finanzas/CompromisosTab.tsx`, movido sin dejar rastro en Contabilidad). Los enlaces del Panel apuntan a `/finanzas`. **Fase 2 (hecha 05/10/2026)**: devengo abierto a todos los perfiles (opt-in por plantilla). Pendiente: segunda pestaña (candidata: flujo proyectado).
- **Fase 1 (hecha)**: pestaña Compromisos (`CompromisosTab.tsx`, reusa
  MisIngresos/MisVencimientos completos), `soloLectura` en esos dos
  componentes (Panel de Control), y `lib/compromisosProgramados.ts`
  (proyección de 12 meses a partir de las plantillas, fuera del
  balance) mostrada en Panel (`CompromisosProgramadosResumen`) y en la
  pestaña. Sin asientos nuevos.
- **Fase 2 — gastos, piloto Buenaventura (código hecho, 04/10/2026)**:
  devengo mes a mes (Gasto / Cuentas a Pagar el día 1; al pagar,
  Cuentas a Pagar / Banco). Opt-in por plantilla (`gastos_recurrentes.
  devengar`, `monto_fijo`). **Desde 05/10/2026 (Finanzas Fase 2) abierto a
  TODOS los perfiles**: se eliminó `lib/devengoEmpresas.ts`/
  `EMPRESAS_CON_DEVENGO`; `empresaTieneDevengo` solo exige empresa. Se
  verificó por SQL que las 9 empresas tienen `CONTENEDOR_MEDIO_PAGO`
  (Activo Corriente 1.1.0.0.0), un pasivo-medio de pago (padre Pasivo
  Corriente 2.1.0.0.0) y las mismas reglas PAGO (GASTO/PASIVOS) y COBRO
  (INGRESO/ACTIVO) en todos los perfiles. Sin plantillas "Mes a mes" no se
  escribe nada (`mantenerVentana` sale sola); Ocaña tiene 5 gastos y 2
  ingresos recurrentes viejos que siguen en el flujo anterior hasta que ella
  los migre. Ingresos devengados en perfiles comerciales requieren
  categorías de ingreso bajo COBRO (el plan base solo trae las de cuentas a
  cobrar). Esquema (aplicado por MCP, aditivo):
  `gastos_recurrentes_recordatorios.estado/monto_devengado/
  id_operacion_devengo/devengo_iniciado_en`, `empresas.
  forma_pago_a_pagar`. Estados PROGRAMADA → (DEVENGANDO) →
  POR_CONFIRMAR (monto variable) → DEVENGADA → SALDADA; `estado` null =
  flujo viejo, intacto. Piezas: `lib/devengo.ts` (reglas puras +
  tests), `lib/devengoGastos.ts` (ventana de 12 meses, devengo
  idempotente con "reclamo" de la fila, activar/desactivar),
  `lib/cuentaAPagar.ts` (crea sola la cuenta "Cuentas a Pagar" con
  `crearPasivo` + matriz, una vez por empresa),
  `ConfirmarDevengoModal`. Corre solo al abrir (lobby y Mis
  Vencimientos). Se activa desde Compromisos → Mis Vencimientos → ⋯ →
  interruptor "Mes a mes" de la plantilla (devenga ya el mes en curso).
  El pago de un gasto DEVENGADO usa la categoría de liquidación de
  Cuentas a Pagar (`registrarPagoRecordatorio`), nunca la del gasto, y
  no puede superar lo devengado; "Ya lo pagué" no aplica. Alertas/Sabio
  (`listarRecordatoriosPendientes`) solo ven lo accionable (estado null
  o DEVENGADA). La proyección de Compromisos programados suma TODAS las
  plantillas activas (también las de "Mes a mes": sus meses futuros aún
  no se reconocen) y se recarga vía `onActualizado` de MisIngresos/
  MisVencimientos (antes excluía las devengar y quedaba desactualizada).
  **Límites conocidos**: borrar a mano el asiento de un devengo/pago no
  reabre la fila (igual que el flujo viejo); POR_CONFIRMAR no genera
  alerta de Sabio; devengo solo al abrir la app (no hay cron); falta
  los estados en el Panel (2E).
- **Cuentas específicas por plantilla — gastos (código hecho, 04/10/2026)**:
  la cuenta general "Cuentas a Pagar" se reemplaza por una cuenta propia
  por plantilla, llamada "<nombre> a pagar" (el "a pagar/a cobrar" va al
  FINAL; decisión del usuario), opcionalmente colgada de un GRUPO
  ("Alquileres a pagar": cuenta contenedora bajo Pasivo Corriente con
  `rol_contable = 'GRUPO_COMPROMISO'` y código `2.1.k.0.0`; las individuales
  `2.1.k.0.n`). Los informes leen solo hojas, así que ven cada una por
  separado. `lib/cuentasCompromiso.ts` (crear/buscar/resolver, grupos,
  renombrar, desactivar), `lib/cuentasCompromisoNombres.ts` (reglas puras +
  tests), `ActivarDevengoModal` (individual / existente del plan / grupo).
  Se referencia por ID: `gastos_recurrentes.cuenta_a_pagar_forma_pago_id` y
  `gastos_recurrentes_recordatorios.cuenta_devengo_forma_pago_id` (también
  creadas en ingresos). El libro identifica cuentas por NOMBRE: nombres
  únicos, y renombrar propaga (`renombrarCuentaPlan` + `renombrarFormaPago`),
  por eso renombrar la plantilla renombra su cuenta automática. Nada se
  borra: una cuenta sin uso ni deuda se DESACTIVA
  (`liberarCuentaSiCorresponde`); eliminar una plantilla con meses
  devengados sin pagar es BAJA (se sigue pudiendo pagar). La cuenta general
  de la primera versión se convierte con el botón "Cuenta propia" de la
  plantilla (`migrarCuentaGeneral`: la RENOMBRA, no toca asientos).
  **Lado ingresos (hecho, 04/10/2026)**: mismo esquema con cuenta a cobrar
  propia ("Casita a cobrar", grupo "Alquileres a cobrar" bajo el
  corriente de Activo, `1.1.k.0.0`). La cuenta a cobrar GENERAL del plan
  ("Cuentas a cobrar", "Costão a cobrar") no se renombra ni desactiva
  nunca (la usa Contabilidad para ventas a crédito): el botón "Cuenta
  propia" de un ingreso solo CREA la cuenta y MUEVE los asientos de
  devengo con `editarOperacion` (`migrarCuentaGeneralIngreso`).
  **Fix de caja**: una cuenta a cobrar se crea como forma de pago (igual
  que un banco) y se sumaba a "caja disponible" (`lib/contabilidad.ts`) y
  se ofrecía como "cuenta de dinero" en Salud de Caja
  (`lib/saludCaja.ts`). Ahora `lib/cuentasPorCobrar.ts`
  (`idsCuentasPorCobrar`: cuentas con categoría de COBRO de rol ACTIVO,
  que un banco no tiene) las excluye de la caja y de Salud de Caja; siguen
  en la distribución de liquidez. Efecto visible: baja la "caja" de
  Buenaventura (R$1.100 de Casita), Ocaña (R$360) y Equilibra (R$1.794 de
  "Tarjeta de Crédito a Cobrar"), que eran cuentas a cobrar contadas como
  plata.
- **Estado de resultado "por naturaleza" (hecho, 04/10/2026)**: selector
  "Por cuenta / Por naturaleza" en Informes → Estado de Resultado. Parte
  ingresos, costos y gastos en FIJOS (recurrentes de monto fijo),
  RECURRENTES VARIABLES (monto variable: luz, agua) y DEL MES (todo lo
  demás), con neto por grupo, cobertura y peso de lo recurrente. Solo es
  una vista: la suma de los tres grupos = el resultado por cuenta.
  `lib/naturalezaResultado.ts` (puro + tests), `naturalezaResultadoDatos.ts`
  (qué asientos vienen de una plantilla: `id_operacion_devengo`,
  `id_operacion` y `*_pagos`/`*_cobros` de los recordatorios),
  `components/informes/ResultadoPorNaturaleza.tsx`. Límite: lo que nunca se
  vinculó a una plantilla (pagos viejos cargados a mano) queda en DEL MES.
  También en el Resumen Ejecutivo del Panel de Control
  (`components/panel/ResumenNaturaleza.tsx`, datos desde
  `obtenerIndicadores().naturaleza`; se oculta si la empresa no tiene
  ningún recurrente). Letra agrandada a pedido del usuario (la vista del
  Informe salió chica).
- **Fase 2D — ingresos (código hecho, 04/10/2026)**: espejo del de
  gastos (`lib/devengoIngresos.ts`, `lib/cuentaACobrar.ts`): día 1,
  Cuenta a Cobrar / Ingreso; al cobrar, Banco / Cuenta a Cobrar con la
  categoría de liquidación. La cuenta a cobrar NO se crea si ya hay una
  (Buenaventura "Cuentas a cobrar", Ocaña "Costão a cobrar"): se busca
  por forma de pago de Activo válida para COBRO y con "cobrar" en el
  nombre, y su nombre queda en `empresas.forma_pago_a_cobrar`.
  Esquema aditivo (MCP): `ingresos_recurrentes.devengar/monto_fijo`,
  `ingresos_recurrentes_recordatorios.estado/monto_devengado/
  id_operacion_devengo/devengo_iniciado_en`, `empresas.forma_pago_a_cobrar`.
  Mismo piloto (Buenaventura) y mismo interruptor "Mes a mes" por
  plantilla; `ConfirmarDevengoModal` sirve para los dos lados.
- **Fase 3**: migrar plantillas y retirar lo viejo.

## Análisis Mensual Automático — bug de clasificación ingreso/egreso (03/10/2026)
El mensaje "Análisis a fondo" clasificaba ingreso/egreso mirando el
NOMBRE de la operación (COBRO/VENTA = ingreso, PAGO/COMPRA = egreso),
no el tipo real de la categoría. Un COBRO puede liquidar una Cuenta a
Cobrar ya facturada (tipo ACTIVO) o un PAGO puede pagar una deuda/
Tarjeta (tipo PASIVO) o comprar un bien que se activa (tipo ACTIVO) —
nada de eso es resultado del mes, pero se contaba igual. Encontrado
porque el usuario comparó el mensaje de Buenaventura (septiembre:
decía resultado operativo −R$1.883) contra el DRE real (−R$747) y no
cerraba.

**Fix**: `lib/analisisMensual.ts` ahora clasifica por `tipo` de la
categoría (`INGRESO` para ingreso, `GASTO`/`COSTO` para egreso) — el
mismo criterio que ya usa el DRE real en `lib/contabilidad.ts`.
`OperacionDelMes` tiene un campo `tipo` nuevo, que
`api/analisis-mensual/generar/route.ts` completa con un join a
`categorias_operacion` (por empresa_id+operacion+categoria). Aportes
(`INVERSION`) y Extracciones (`EXTRACCION`) siguen identificándose por
operación, ahí no hay esa ambigüedad. Test de regresión en
`analisisMensual.test.ts` que reproduce exactamente el caso de
Buenaventura.

**Dato corregido a mano**: se confirmó que Ocaña NO tenía este
problema (sus operaciones de septiembre eran todas INGRESO/GASTO
reales). Para Buenaventura se actualizó en el lugar (no se pudo
`DELETE`, límite ya conocido) el mensaje
"📊 Análisis a fondo de septiembre" con el número correcto
(−R$747,38 en vez de −R$1.883,38) y se mandó un mensaje nuevo aparte
explicando los 4 movimientos que quedaron afuera (cobro de una cuenta
a cobrar, compra de un mueble, pago de un préstamo y de la tarjeta de
crédito — suman R$1.356 que no son ni ingreso ni gasto del mes).

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
  `true`) — lo prende/apaga SOLO el Desarrollador, con un switch por
  empresa en Panel Maestro → Análisis Mensual (04/10/2026: antes era
  un toggle visible para el cliente en su Panel de Control; se sacó).
  A nivel de base lo garantiza el trigger
  `empresas_proteger_analisis_mensual` (solo `es_admin_plataforma()`
  puede cambiar esa columna; el service role y el SQL Editor pasan).

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
- Probar cobros parciales de alquileres devengados (la fila queda
  DEVENGADA con saldo; sobrepago bloqueado; migrar cuenta bloqueado
  hasta cerrar parciales). Para alquileres con ajustes, usar "Varía".
  El usuario lo prueba y reporta.
- Endurecer `.claude/hooks/sql_readonly_allow.py` contra `WITH … DELETE`
  / `EXPLAIN ANALYZE` (sin respuesta del usuario).
- Nada más pendiente a la fecha de este registro — si encontrás algo
  a medio hacer, agregalo acá antes de asumir que está completo.
