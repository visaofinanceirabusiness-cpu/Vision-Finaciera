// lib/iconosJuego.ts
//
// ÍCONOS PARA EL MODO MINI-JUEGO
// =====================================================
// El Mini-Juego muestra Operación/Categoría/Forma de pago como
// tarjetas con ícono, no como texto plano — pero las categorías y
// formas de pago las nombra cada empresa (no hay una lista fija), así
// que no se le puede pedir a nadie que cargue un emoji a mano para
// cada una. Se adivina por palabra clave (español + portugués) y, si
// no matchea ninguna, cae en un ícono genérico — nunca deja una
// tarjeta sin dibujo.

export const ICONO_OPERACION: Record<string, string> = {
  VENTA: '💰',
  COMPRA: '🛒',
  PAGO: '💸',
  COBRO: '💵',
  TRANSFERENCIA: '🔄',
  INVERSION: '📈',
  EXTRACCION: '🏧',
  PERDIDA: '📉',
};

// [ícono, palabras clave en español/portugués que lo disparan]
const PALABRAS_CLAVE: [string, string[]][] = [
  ['🏦', ['banco', 'bank']],
  ['💵', ['efectivo', 'dinheiro', 'caixa', 'caja']],
  ['💳', ['tarjeta', 'cartao', 'cartão', 'credito', 'crédito', 'debito', 'débito']],
  ['📱', ['pix', 'billetera virtual', 'virtual', 'mercado pago', 'nequi']],
  ['🏠', ['alquiler', 'aluguel', 'renta', 'rent']],
  ['⛽', ['combustible', 'combustivel', 'combustível', 'nafta', 'gasolina']],
  ['👤', ['sueldo', 'salario', 'salário', 'empleado', 'funcionario', 'funcionário']],
  ['📄', ['impuesto', 'imposto', 'iva', 'tax']],
  ['💡', ['luz', 'electricidad', 'eletricidade', 'energia', 'energía']],
  ['💧', ['agua', 'água']],
  ['📶', ['internet', 'telefone', 'teléfono', 'celular', 'wifi']],
  ['🍔', ['comida', 'almoco', 'almoço', 'restaurante', 'alimentacion', 'alimentação']],
  ['🚗', ['auto', 'carro', 'vehiculo', 'veículo', 'transporte']],
  ['🏥', ['salud', 'saude', 'saúde', 'medico', 'médico', 'farmacia', 'farmácia']],
  ['📦', ['insumo', 'mercaderia', 'mercadoria', 'producto', 'produto', 'stock', 'estoque']],
  ['🎓', ['educacion', 'educação', 'escola', 'escuela', 'curso']],
  ['✈️', ['viaje', 'viagem']],
  ['🏦', ['prestamo', 'préstamo', 'emprestimo', 'empréstimo', 'financiamento', 'financiacion']],
  ['💍', ['ahorro', 'poupança', 'poupanca', 'inversion', 'investimento']],
  ['🎁', ['regalo', 'presente']],
  ['🐾', ['mascota', 'pet', 'veterinaria', 'veterinária']],
];

const ICONO_GENERICO = '🏷️';

export function iconoParaTexto(texto: string): string {
  const normalizado = texto.toLowerCase();

  for (const [icono, palabras] of PALABRAS_CLAVE) {
    if (palabras.some((palabra) => normalizado.includes(palabra))) {
      return icono;
    }
  }

  return ICONO_GENERICO;
}

export function iconoOperacion(operacion: string): string {
  return ICONO_OPERACION[operacion.toUpperCase()] ?? '🎲';
}
