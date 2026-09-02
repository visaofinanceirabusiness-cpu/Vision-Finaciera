// lib/i18n.ts
//
// Mecánica genérica de traducción para el sistema. Cada pantalla define
// su propio diccionario (ver src/app/configuracoes/i18n.ts como
// ejemplo) con las claves de sus textos en 'ES' y 'PT'; este archivo
// solo da la función que resuelve una clave contra el idioma de la
// empresa (empresas.idioma — que ya quedó separado del país/moneda que
// define el Plano de Contas, ver lib/perfiles.ts).
//
// No es una librería de i18n con rutas por idioma ni carga asíncrona
// de mensajes: el sistema es todo 'use client' con una sola empresa
// por sesión, así que alcanza con un objeto en memoria y una función
// de lookup — cero costo real de performance.

export type Idioma = 'ES' | 'PT';

// Diccionario de una pantalla: cada clave tiene su texto en cada
// idioma soportado. `Claves` queda inferido en cada pantalla para que
// t('clave-que-no-existe') tire error de tipos en vez de romper en
// producción.
export type Diccionario<Claves extends string> = Record<Idioma, Record<Claves, string>>;

export function crearTraductor<Claves extends string>(
  diccionario: Diccionario<Claves>,
  idioma: string | null | undefined
) {
  const tabla = diccionario[idioma === 'PT' ? 'PT' : 'ES'];

  return function t(clave: Claves): string {
    return tabla[clave];
  };
}

// Traducción de estados guardados literalmente en la base (PENDIENTE/
// VALIDADO) — se usa solo para mostrar, nunca para comparar/filtrar
// (esas comparaciones siguen contra el valor original en mayúsculas).
export function estadoDisplay(idioma: string | null | undefined, valor: string | null | undefined): string {
  const normalizado = (valor || 'PENDIENTE').toUpperCase();

  if (normalizado === 'PENDIENTE') {
    return idioma === 'PT' ? 'Pendente' : 'Pendiente';
  }

  return valor || normalizado;
}

// Nombre visible de una operación (COMPRA, VENTA, etc.) — el valor
// real (nombreOperacion) es un identificador interno usado como texto
// literal en reglas_contables/matriz_operaciones/registro_operaciones
// en TODO el sistema, así que nunca se traduce ni se guarda traducido:
// esto es solo la etiqueta que se muestra en pantalla.
const NOMBRE_OPERACION_PT: Record<string, string> = {
  COMPRA: 'Compra',
  VENTA: 'Venda',
  PAGO: 'Pagamento',
  INVERSION: 'Investimento',
  EXTRACCION: 'Retirada',
  COBRO: 'Recebimento',
  PERDIDA: 'Perda',
  TRANSFERENCIA: 'Transferência',
};

export function nombreOperacionDisplay(idioma: string | null | undefined, nombreOperacion: string): string {
  if (idioma !== 'PT') return nombreOperacion;
  return NOMBRE_OPERACION_PT[nombreOperacion] ?? nombreOperacion;
}

// Nombre visible de las cuentas "rubro" (estructurales, sin uso
// contable directo — ACTIVO, ACTIVO CORRIENTE, etc.) del Plan de
// Cuentas. El nombre real en plan_cuentas.nombre queda en español
// (así salió del plan maestro, y así se usa donde haga falta el
// texto literal); esto solo traduce lo que se muestra en pantalla
// para los ~18 nombres estructurales conocidos de todos los
// perfiles. Las cuentas hoja (las que el usuario puede renombrar) no
// se tocan, porque su nombre puede ser cualquier cosa que el usuario
// ya haya escrito en el idioma que prefiera.
const NOMBRE_RUBRO_PT: Record<string, string> = {
  ACTIVO: 'ATIVO',
  'ACTIVO CORRIENTE': 'ATIVO CIRCULANTE',
  'ACTIVO NO CORRIENTE': 'ATIVO NÃO CIRCULANTE',
  'AHORROS E INVERSIONES': 'POUPANÇAS E INVESTIMENTOS',
  PASIVO: 'PASSIVO',
  'PASIVO CORRIENTE': 'PASSIVO CIRCULANTE',
  'PASIVO NO CORRIENTE': 'PASSIVO NÃO CIRCULANTE',
  'PATRIMONIO NETO': 'PATRIMÔNIO LÍQUIDO',
  'PATRIMONIO FAMILIAR': 'PATRIMÔNIO FAMILIAR',
  INGRESOS: 'RECEITAS',
  COSTOS: 'CUSTOS',
  GASTOS: 'DESPESAS',
  'GASTOS ADMINISTRATIVOS': 'DESPESAS ADMINISTRATIVAS',
  'GASTOS DEL HOGAR': 'DESPESAS DOMÉSTICAS',
  'GASTOS COMERCIALES': 'DESPESAS COMERCIAIS',
  'GASTOS GENERALES': 'DESPESAS GERAIS',
  'GASTOS FINANCIEROS': 'DESPESAS FINANCEIRAS',
  IMPUESTOS: 'IMPOSTOS',
};

export function nombreCuentaDisplay(idioma: string | null | undefined, nombre: string): string {
  if (idioma !== 'PT') return nombre;
  return NOMBRE_RUBRO_PT[nombre] ?? nombre;
}

// perfiles_empresa es un catálogo fijo de 5 filas (COMERCIAL, FAMILIAR,
// MIXTO, PRODUCCION, SERVICIOS) cuyo nombre/descripción vienen en
// español desde la base — acá solo se traduce lo que se muestra en
// pantalla, igual que nombreOperacionDisplay/nombreCuentaDisplay.
const PERFILES_EMPRESA_PT: Record<string, { nombre: string; descripcion: string }> = {
  COMERCIAL: {
    nombre: 'Comercial',
    descripcion: 'Empresa dedicada principalmente à compra, gestão de estoque e venda de produtos.',
  },
  FAMILIAR: {
    nombre: 'Familiar',
    descripcion: 'Controle de receitas e despesas pessoais ou familiares, sem compra/venda de mercadoria.',
  },
  MIXTO: {
    nombre: 'Misto',
    descripcion: 'Empresa que combina diferentes modelos de negócio e precisa de uma configuração flexível.',
  },
  PRODUCCION: {
    nombre: 'Produção',
    descripcion: 'Empresa que compra insumos, transforma ou produz e depois comercializa produtos.',
  },
  SERVICIOS: {
    nombre: 'Serviços',
    descripcion: 'Empresa cuja atividade principal é prestar serviços a clientes.',
  },
};

export function perfilEmpresaDisplay(
  idioma: string | null | undefined,
  codigo: string,
  nombre: string,
  descripcion: string | null = null
): { nombre: string; descripcion: string | null } {
  if (idioma !== 'PT') return { nombre, descripcion };
  const traducido = PERFILES_EMPRESA_PT[codigo];
  return traducido ? traducido : { nombre, descripcion };
}
