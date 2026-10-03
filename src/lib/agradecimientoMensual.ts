// lib/agradecimientoMensual.ts
//
// ANÁLISIS MENSUAL AUTOMÁTICO — Fase C. Segundo mensaje, separado del
// "Análisis a fondo" (ver lib/analisisMensual.ts): un agradecimiento
// corto y festivo por usar el sistema, que se manda 5 días después
// del análisis — ver api/analisis-mensual/agradecer. Festejo simple
// (texto con emojis) por decisión explícita del usuario; el modal de
// confetti real (lib/festejoVisual.ts, ya existe para gamificación)
// queda como posible mejora futura, no para esta fase.

export function construirMensajeAgradecimiento(idioma: string | null | undefined): { titulo: string; texto: string } {
  const pt = idioma === 'PT';

  const titulo = pt ? '🎉 Obrigado por usar o Visão Financeira!' : '🎉 ¡Gracias por usar Visão Financeira!';

  const texto = pt
    ? `Oi! 👋 Sou o Sábio de novo.\n\nSó queria agradecer por mais um mês usando o sistema para organizar suas finanças — cada operação que você carrega é o que me permite te ajudar de verdade.\n\nContinue assim! 🎉✨\n\n— Sábio 🦉`
    : `¡Hola! 👋 Soy Sabio de nuevo.\n\nSolo quería agradecerte por otro mes usando el sistema para organizar tus finanzas — cada operación que cargás es lo que me permite ayudarte de verdad.\n\n¡Seguí así! 🎉✨\n\n— Sabio 🦉`;

  return { titulo, texto };
}
