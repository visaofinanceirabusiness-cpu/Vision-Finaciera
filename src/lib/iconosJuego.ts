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

// El "Sabio del Azar" — versión con galera, moño y bastón del Sabio
// de siempre, para el Mini-Juego (lobby + adentro del juego +
// festejo final). Mismo personaje que SABIO_URL (Sabio Bot), otro
// disfraz — se homogeneizan tamaño/forma entre los dos, la diferencia
// es el color de fondo de cada tarjeta.
export const SABIO_LUDICO_URL = '/sabio/sabio-azar.webp';

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
  ['🤝', ['prestamo', 'préstamo', 'emprestimo', 'empréstimo', 'financiamento', 'financiacion']],
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

// Repuesto para cuando ninguna palabra clave matchea (categorías con
// nombres propios de cada empresa) — en vez de que todas caigan en el
// mismo ICONO_GENERICO y se vean idénticas, cada nombre distinto cae
// en un ícono de esta lista según su propio texto (siempre el mismo
// ícono para el mismo nombre, de una sesión a la otra).
const POOL_RESPALDO = [
  '🔷', '🔶', '⭐', '🌙', '☀️', '🌈', '🍀', '🌵', '🍎', '🍋',
  '🍇', '🍉', '🥑', '🌻', '🌼', '🦋', '🐝', '🐠', '🐢', '🦉',
  '🐧', '🎈', '🎯', '🎨', '🧩', '🔔', '🔑', '⚙️', '🧭', '🧲',
  '🧵', '🧶', '🪁', '🪀', '🧊', '🪄', '🪅', '🪆', '🎲', '🎳',
  '🥁', '🎷', '🎺', '🪘', '🧰', '🧴', '🧺', '🧸',
];

// Hash simple (djb2) — solo necesita ser determinístico, no criptográfico.
function hashTexto(texto: string): number {
  let hash = 5381;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 33) ^ texto.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Asigna un ícono a cada texto del conjunto SIN REPETIR entre ellos —
// a diferencia de iconoParaTexto (que resuelve cada texto de forma
// aislada), esto mira todo el conjunto que se va a mostrar junto en
// pantalla (ej. todas las categorías de una empresa) y evita que dos
// terminen con el mismo ícono, aunque coincidan en la misma palabra
// clave o caigan en el mismo repuesto del pool.
export function asignarIconos(textos: string[]): Record<string, string> {
  const usados = new Set<string>();
  const resultado: Record<string, string> = {};

  // Primera pasada: palabra clave, solo si ese ícono todavía está libre.
  for (const texto of textos) {
    const normalizado = texto.toLowerCase();
    const candidato = PALABRAS_CLAVE.find(([, palabras]) => palabras.some((p) => normalizado.includes(p)))?.[0];

    if (candidato && !usados.has(candidato)) {
      resultado[texto] = candidato;
      usados.add(candidato);
    }
  }

  // Segunda pasada: lo que quedó sin ícono (no matcheó ninguna palabra
  // clave, o matcheaba una ya tomada por otro texto de este mismo
  // conjunto) — se busca en el pool de respaldo, arrancando en un
  // punto distinto según el texto para no apilar todo al principio.
  for (const texto of textos) {
    if (resultado[texto]) continue;

    const inicio = hashTexto(texto) % POOL_RESPALDO.length;
    let asignado: string | null = null;

    for (let i = 0; i < POOL_RESPALDO.length; i++) {
      const candidato = POOL_RESPALDO[(inicio + i) % POOL_RESPALDO.length];
      if (!usados.has(candidato)) {
        asignado = candidato;
        break;
      }
    }

    resultado[texto] = asignado ?? ICONO_GENERICO;
    if (asignado) usados.add(asignado);
  }

  return resultado;
}

export function iconoOperacion(operacion: string): string {
  return ICONO_OPERACION[operacion.toUpperCase()] ?? '🎲';
}
