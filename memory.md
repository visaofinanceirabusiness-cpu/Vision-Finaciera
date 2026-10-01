# memory.md

Contexto vivo del proyecto — lo que cambia sesión a sesión. Reglas
estables van en `CLAUDE.md`; esto es historial reciente, pendientes y
limitaciones conocidas. Actualizar al final de cada sesión con cambios
relevantes; no hace falta detallar cada PR, solo lo que otra sesión
necesitaría saber para no repetir trabajo o pisar una decisión ya
tomada.

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
