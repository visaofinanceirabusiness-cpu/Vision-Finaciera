import type { Diccionario } from '@/lib/i18n';
import { nombreOperacionDisplay } from '@/lib/i18n';

type Clave =
  | 'volver'
  | 'eyebrow'
  | 'titulo'
  | 'subtitulo'
  | 'tabLanzamientos'
  | 'tabRegistros'
  | 'tabLibro'
  | 'cargando'
  | 'editandoOperacion'
  | 'nuevoRegistro'
  | 'cargaOperacion'
  | 'sistemaActivo'
  | 'tutorialEyebrow'
  | 'tutorialTitulo'
  | 'tutorialSalir'
  | 'ofrecerTutorial'
  | 'avisoEdicion'
  | 'labelFecha'
  | 'labelOperacion'
  | 'labelCategoria'
  | 'labelHaciaCuenta'
  | 'labelFormaPago'
  | 'labelDesdeCuenta'
  | 'labelHistorico'
  | 'labelSocio'
  | 'seleccionar'
  | 'avisoTransferencia'
  | 'detalleValores'
  | 'productoPlaceholder'
  | 'descripcionPlaceholder'
  | 'cantidadPlaceholder'
  | 'montoPlaceholder'
  | 'agregarLinea'
  | 'total'
  | 'camposCompletos'
  | 'faltanCampos'
  | 'stockInsuficiente'
  | 'cancelar'
  | 'guardando'
  | 'guardarCambios'
  | 'registrarOperacion'
  | 'errorSinEmpresa'
  | 'errorRegistrar'
  | 'buscarOperaciones'
  | 'cargandoRegistros'
  | 'idRegistro'
  | 'fecha'
  | 'operacion'
  | 'categoria'
  | 'formaPago'
  | 'historico'
  | 'clienteProveedorHeader'
  | 'totalHeader'
  | 'estadoHeader'
  | 'tituloValidar'
  | 'validado'
  | 'tituloEditar'
  | 'editar'
  | 'tituloEliminarYRecargar'
  | 'eliminarYRecargar'
  | 'tituloEliminar'
  | 'eliminar'
  | 'sinRegistros'
  | 'errorDetallesEdicion'
  | 'errorEliminar'
  | 'errorValidar'
  | 'buscarLibroDiario'
  | 'resumenOperaciones'
  | 'resumenAsientos'
  | 'resumenImportes'
  | 'cargandoLibroDiario'
  | 'sinMovimientosContables'
  | 'importeRegistrado'
  | 'tipoHeader'
  | 'debeHeader'
  | 'haberHeader'
  | 'importeHeader'
  | 'automatico'
  | 'operacionEtiqueta';

export const diccionarioContabilidad: Diccionario<Clave> = {
  ES: {
    volver: '← Volver a Mi Negocio',
    eyebrow: 'GESTIÓN FINANCIERA',
    titulo: 'Contabilidad',
    subtitulo: 'Cargá, consultá y revisá contablemente las operaciones de tu negocio.',
    tabLanzamientos: '🚀 Central de Lanzamientos',
    tabRegistros: '📋 Registro de Operaciones',
    tabLibro: '📖 Libro Diario',
    cargando: 'Cargando...',
    editandoOperacion: 'EDITANDO OPERACIÓN',
    nuevoRegistro: 'NUEVO REGISTRO',
    cargaOperacion: 'Cargá una operación',
    sistemaActivo: 'Sistema activo',
    tutorialEyebrow: 'TUTORIAL GUIADO',
    tutorialTitulo: 'Cargá tu primera operación',
    tutorialSalir: 'Salir / continuar más tarde',
    ofrecerTutorial: '🦉 ¿Querés que Sabio te guíe para cargar 3 operaciones de práctica?',
    avisoEdicion: '⚠ Al guardar, la operación se recalcula de cero (stock, costo y diario) bajo el mismo ID.',
    labelFecha: 'Fecha',
    labelOperacion: 'Operación',
    labelCategoria: 'Categoría',
    labelHaciaCuenta: 'Hacia (cuenta de ahorro)',
    labelFormaPago: 'Forma de Pago',
    labelDesdeCuenta: 'Desde (cuenta de origen)',
    labelHistorico: 'Histórico',
    labelSocio: 'Socio/a',
    seleccionar: 'Seleccionar...',
    avisoTransferencia:
      '💡 Esto mueve plata entre tus propias cuentas — no es un gasto ni un ingreso. Usalo cada vez que guardes o inviertas dinero para una meta (ej. un viaje): elegí a qué cuenta de ahorro va, de dónde sale la plata, y el monto. Así el progreso de tu meta en "Objetivos familiares" se actualiza solo.',
    detalleValores: 'Detalle de valores',
    productoPlaceholder: 'Producto...',
    descripcionPlaceholder: 'Descripción',
    cantidadPlaceholder: 'Cant.',
    montoPlaceholder: 'Monto',
    agregarLinea: '+ Agregar línea',
    total: 'Total',
    camposCompletos: '✓ Todos los campos están completos',
    faltanCampos: '⚠ Faltan campos por completar',
    stockInsuficiente: 'No se puede registrar: la cantidad solicitada supera el stock disponible.',
    cancelar: 'Cancelar',
    guardando: 'Guardando...',
    guardarCambios: 'Guardar cambios',
    registrarOperacion: 'Registrar Operación',
    errorSinEmpresa: 'Tu usuario todavía no tiene una empresa asignada.',
    errorRegistrar: 'No se pudo registrar la operación.',
    buscarOperaciones: 'Buscar operación, categoría o persona...',
    cargandoRegistros: 'Cargando registros...',
    idRegistro: 'ID Registro',
    fecha: 'Fecha',
    operacion: 'Operación',
    categoria: 'Categoría',
    formaPago: 'Forma de pago',
    historico: 'Histórico',
    clienteProveedorHeader: 'Cliente / Proveedor',
    totalHeader: 'Total',
    estadoHeader: 'Estado',
    tituloValidar: 'Marcar operación como validada',
    validado: 'Validado',
    tituloEditar: 'Editar operación',
    editar: 'Editar',
    tituloEliminarYRecargar:
      'Venta/Pérdida no se puede editar de forma exacta: se elimina y se abre el formulario en blanco',
    eliminarYRecargar: 'Eliminar y recargar',
    tituloEliminar: 'Eliminar operación y sus movimientos de stock',
    eliminar: 'Eliminar',
    sinRegistros: 'No se encontraron registros.',
    errorDetallesEdicion: 'No se pudieron cargar los detalles de la operación para editarla.',
    errorEliminar: 'No se pudo eliminar la operación.',
    errorValidar: 'No se pudo validar la operación.',
    buscarLibroDiario: 'Buscar ID, cuenta, histórico...',
    resumenOperaciones: 'Operaciones',
    resumenAsientos: 'Asientos',
    resumenImportes: 'Importes',
    cargandoLibroDiario: 'Cargando Libro Diario...',
    sinMovimientosContables: 'No se encontraron movimientos contables.',
    importeRegistrado: 'Importe registrado:',
    tipoHeader: 'Tipo',
    debeHeader: 'Debe',
    haberHeader: 'Haber',
    importeHeader: 'Importe',
    automatico: 'AUTOMÁTICO',
    operacionEtiqueta: 'OPERACIÓN',
  },
  PT: {
    volver: '← Voltar para Meu Negócio',
    eyebrow: 'GESTÃO FINANCEIRA',
    titulo: 'Contabilidade',
    subtitulo: 'Registre, consulte e revise contabilmente as operações do seu negócio.',
    tabLanzamientos: '🚀 Central de Lançamentos',
    tabRegistros: '📋 Registro de Operações',
    tabLibro: '📖 Livro Diário',
    cargando: 'Carregando...',
    editandoOperacion: 'EDITANDO OPERAÇÃO',
    nuevoRegistro: 'NOVO REGISTRO',
    cargaOperacion: 'Registre uma operação',
    sistemaActivo: 'Sistema ativo',
    tutorialEyebrow: 'TUTORIAL GUIADO',
    tutorialTitulo: 'Registre sua primeira operação',
    tutorialSalir: 'Sair / continuar depois',
    ofrecerTutorial: '🦉 Quer que o Sabio te guie para registrar 3 operações de prática?',
    avisoEdicion: '⚠ Ao salvar, a operação é recalculada do zero (estoque, custo e diário) com o mesmo ID.',
    labelFecha: 'Data',
    labelOperacion: 'Operação',
    labelCategoria: 'Categoria',
    labelHaciaCuenta: 'Para (conta de poupança)',
    labelFormaPago: 'Forma de Pagamento',
    labelDesdeCuenta: 'De (conta de origem)',
    labelHistorico: 'Histórico',
    labelSocio: 'Sócio/a',
    seleccionar: 'Selecionar...',
    avisoTransferencia:
      '💡 Isso movimenta dinheiro entre suas próprias contas — não é um gasto nem uma receita. Use sempre que guardar ou investir dinheiro para uma meta (ex. uma viagem): escolha para qual conta de poupança vai, de onde sai o dinheiro, e o valor. Assim o progresso da sua meta em "Objetivos familiares" se atualiza sozinho.',
    detalleValores: 'Detalhe de valores',
    productoPlaceholder: 'Produto...',
    descripcionPlaceholder: 'Descrição',
    cantidadPlaceholder: 'Qtd.',
    montoPlaceholder: 'Valor',
    agregarLinea: '+ Adicionar linha',
    total: 'Total',
    camposCompletos: '✓ Todos os campos estão completos',
    faltanCampos: '⚠ Faltam campos por preencher',
    stockInsuficiente: 'Não é possível registrar: a quantidade solicitada supera o estoque disponível.',
    cancelar: 'Cancelar',
    guardando: 'Salvando...',
    guardarCambios: 'Salvar alterações',
    registrarOperacion: 'Registrar Operação',
    errorSinEmpresa: 'Seu usuário ainda não tem uma empresa atribuída.',
    errorRegistrar: 'Não foi possível registrar a operação.',
    buscarOperaciones: 'Buscar operação, categoria ou pessoa...',
    cargandoRegistros: 'Carregando registros...',
    idRegistro: 'ID Registro',
    fecha: 'Data',
    operacion: 'Operação',
    categoria: 'Categoria',
    formaPago: 'Forma de pagamento',
    historico: 'Histórico',
    clienteProveedorHeader: 'Cliente / Fornecedor',
    totalHeader: 'Total',
    estadoHeader: 'Situação',
    tituloValidar: 'Marcar operação como validada',
    validado: 'Validado',
    tituloEditar: 'Editar operação',
    editar: 'Editar',
    tituloEliminarYRecargar:
      'Venda/Perda não pode ser editada com exatidão: é excluída e o formulário abre em branco',
    eliminarYRecargar: 'Excluir e recarregar',
    tituloEliminar: 'Excluir operação e suas movimentações de estoque',
    eliminar: 'Excluir',
    sinRegistros: 'Nenhum registro encontrado.',
    errorDetallesEdicion: 'Não foi possível carregar os detalhes da operação para editá-la.',
    errorEliminar: 'Não foi possível excluir a operação.',
    errorValidar: 'Não foi possível validar a operação.',
    buscarLibroDiario: 'Buscar ID, conta, histórico...',
    resumenOperaciones: 'Operações',
    resumenAsientos: 'Lançamentos',
    resumenImportes: 'Valores',
    cargandoLibroDiario: 'Carregando Livro Diário...',
    sinMovimientosContables: 'Nenhuma movimentação contábil encontrada.',
    importeRegistrado: 'Valor registrado:',
    tipoHeader: 'Tipo',
    debeHeader: 'Débito',
    haberHeader: 'Crédito',
    importeHeader: 'Valor',
    automatico: 'AUTOMÁTICO',
    operacionEtiqueta: 'OPERAÇÃO',
  },
};

const esPT = (idioma: string | null | undefined) => idioma === 'PT';

export function etiquetaRelacion(
  idioma: string | null | undefined,
  esFamiliar: boolean,
  operacion: string
): string {
  if (['INVERSION', 'PERDIDA', 'EXTRACCION'].includes(operacion)) {
    return esPT(idioma) ? 'Sócio/a' : 'Socia/o';
  }

  if (operacion === 'COMPRA' || operacion === 'PAGO') {
    if (esFamiliar) {
      return esPT(idioma) ? 'Destino de pagamento' : 'Destino de pago';
    }
    return esPT(idioma) ? 'Fornecedor' : 'Proveedor';
  }

  if (operacion === 'VENTA' || operacion === 'COBRO') {
    if (esFamiliar) {
      return esPT(idioma) ? 'Fonte de renda' : 'Fuente de ingreso';
    }
    return 'Cliente';
  }

  if (esFamiliar) {
    return esPT(idioma) ? 'Fonte de renda / Destino de pagamento' : 'Fuente de ingreso / Destino de pago';
  }

  return esPT(idioma) ? 'Cliente / Fornecedor' : 'Cliente / Proveedor';
}

export function msgEditandoOperacion(idioma: string | null | undefined, idOperacion: string): string {
  return esPT(idioma) ? `Editando a operação ${idOperacion}.` : `Editando la operación ${idOperacion}.`;
}

export function msgElegirOperacion(idioma: string | null | undefined): string {
  return esPT(idioma) ? 'Escolha uma operação para começar.' : 'Elegí una operación para empezar.';
}

export function msgElegirCategoria(idioma: string | null | undefined, operacion: string): string {
  const nombre = nombreOperacionDisplay(idioma, operacion);
  return esPT(idioma) ? `Escolha a categoria para "${nombre}".` : `Elegí la categoría para "${nombre}".`;
}

export function msgOperacionActualizada(idioma: string | null | undefined): string {
  return esPT(idioma) ? 'Operação atualizada com sucesso!' : '¡Operación actualizada con éxito!';
}

export function msgOperacionRegistrada(idioma: string | null | undefined): string {
  return esPT(idioma) ? 'Operação registrada com sucesso!' : '¡Operación registrada con éxito!';
}

export function msgErrorCategorias(idioma: string | null | undefined, detalle: string): string {
  return esPT(idioma)
    ? `Não foi possível carregar as categorias: ${detalle}`
    : `No se pudieron cargar las categorías: ${detalle}`;
}

export function msgErrorFormasPago(idioma: string | null | undefined, detalle: string): string {
  return esPT(idioma)
    ? `Não foi possível carregar as formas de pagamento: ${detalle}`
    : `No se pudieron cargar las formas de pago: ${detalle}`;
}

export function msgErrorOperaciones(idioma: string | null | undefined, detalle: string): string {
  return esPT(idioma)
    ? `Não foi possível carregar as operações: ${detalle}`
    : `No se pudieron cargar las operaciones: ${detalle}`;
}

export function msgErrorAutomaticos(idioma: string | null | undefined, detalle: string): string {
  return esPT(idioma)
    ? `Não foi possível carregar os registros automáticos: ${detalle}`
    : `No se pudieron cargar los registros automáticos: ${detalle}`;
}

export function msgErrorEmpresa(idioma: string | null | undefined): string {
  return esPT(idioma) ? 'Não foi possível identificar a empresa.' : 'No se pudo identificar la empresa.';
}

export function tituloOperacion(idioma: string | null | undefined, idOperacion: string): string {
  return esPT(idioma) ? `Operação ${idOperacion}` : `Operación ${idOperacion}`;
}

export function stockDisponible(idioma: string | null | undefined, saldo: number): string {
  return esPT(idioma) ? ` (estoque: ${saldo})` : ` (stock: ${saldo})`;
}

export function contadorRenglones(idioma: string | null | undefined, cantidad: number): string {
  if (esPT(idioma)) {
    return `${cantidad} ${cantidad === 1 ? 'linha' : 'linhas'}`;
  }
  return `${cantidad} renglón${cantidad === 1 ? '' : 'es'}`;
}

export function contadorAsientos(idioma: string | null | undefined, cantidad: number): string {
  if (esPT(idioma)) {
    return `${cantidad} ${cantidad === 1 ? 'lançamento' : 'lançamentos'}`;
  }
  return `${cantidad} ${cantidad === 1 ? 'asiento' : 'asientos'}`;
}

export function msgConfirmarEliminarOperacion(idioma: string | null | undefined, idOperacion: string): string {
  if (esPT(idioma)) {
    return (
      `Excluir a operação ${idOperacion}?\n\n` +
      'Isso também apaga todas as movimentações de estoque que ela gerou. ' +
      'Não pode ser desfeito.'
    );
  }
  return (
    `¿Eliminar la operación ${idOperacion}?\n\n` +
    'Esto borra también todos los movimientos de stock que generó. ' +
    'No se puede deshacer.'
  );
}

export function msgConfirmarEliminarYRecargar(idioma: string | null | undefined, idOperacion: string): string {
  if (esPT(idioma)) {
    return (
      `Excluir a operação ${idOperacion} para recarregá-la?\n\n` +
      'Isso apaga a operação e suas movimentações de estoque. O formulário abre em branco para carregá-la de novo. ' +
      'Não pode ser desfeito.'
    );
  }
  return (
    `¿Eliminar la operación ${idOperacion} para volver a cargarla?\n\n` +
    'Esto borra la operación y sus movimientos de stock. Se abre el formulario en blanco para cargarla de nuevo. ' +
    'No se puede deshacer.'
  );
}

// Pago, Compra, Extracción y Transferencia le "sacan" plata a un medio
// de pago (Efectivo, Banco, Pix...). Si ese medio es una cuenta de
// Activo (plata real), no puede quedar en negativo — igual que vender
// stock que no existe. saldoTexto/totalTexto ya vienen formateados
// (con símbolo de moneda) desde la pantalla, para no repetir acá la
// lógica de formateo de números.
export function msgSaldoMedioInsuficiente(
  idioma: string | null | undefined,
  formaPago: string,
  saldoTexto: string,
  totalTexto: string
): string {
  if (esPT(idioma)) {
    return `Não é possível registrar: ${formaPago} ficaria negativo (saldo atual: ${saldoTexto}, esta operação é de ${totalTexto}). Escolha outra forma de pagamento ou um valor menor.`;
  }
  return `No se puede registrar: ${formaPago} quedaría en negativo (saldo actual: ${saldoTexto}, esta operación es de ${totalTexto}). Elegí otra forma de pago o un monto menor.`;
}

// ==========================================================
// TUTORIAL GUIADO — 3 primeras operaciones (Fase 3 del onboarding)
// ==========================================================
//
// Mensajes de Sabio para las 3 operaciones que hay que cargar para
// terminar el onboarding: Inversión siempre primero (ya tiene
// categoría/cuenta de fábrica), después Venta o Cobro según el
// perfil, y por último Compra o Pago según si la empresa maneja
// mercadería. Ver pasosTutorial() más abajo, que arma esta secuencia.

export function pasosTutorial(esFamiliar: boolean, manejaMercaderia: boolean): string[] {
  // Si maneja mercadería, la Venta tiene que ir DESPUÉS de la Compra:
  // recién nacida, la empresa no tiene ningún stock — pedirle una
  // Venta antes de que exista una Compra la deja sin poder completar
  // el paso (elige un producto que todavía tiene 0 de stock).
  if (manejaMercaderia) {
    return ['INVERSION', 'COMPRA', 'VENTA'];
  }

  return ['INVERSION', esFamiliar ? 'COBRO' : 'VENTA', 'PAGO'];
}

export function msgTutorialCancelar(idioma: string | null | undefined): string {
  return esPT(idioma) ? 'Sair do tutorial' : 'Salir del tutorial';
}

export function msgTutorialPaso(
  idioma: string | null | undefined,
  paso: number,
  nombreOperacion: string
): string {
  const esPTidioma = esPT(idioma);
  const nombre = nombreOperacionDisplay(idioma, nombreOperacion);

  const mensajes: Record<number, { es: string; pt: string }> = {
    0: {
      es: `¡Hola! 👋 Soy Sabio. Vamos a cargar juntos tus primeras 3 operaciones para terminar de dejar tu sistema listo.\n\nEmpecemos por una ${nombre} — así arrancás con saldo en tu caja.`,
      pt: `Olá! 👋 Eu sou o Sabio. Vamos registrar juntos suas primeiras 3 operações para deixar seu sistema pronto.\n\nComecemos por um(a) ${nombre} — assim você começa com saldo no seu caixa.`,
    },
    1: {
      es: `¡Muy bien! ✅ Ahora cargá una ${nombre}.`,
      pt: `Muito bem! ✅ Agora registre um(a) ${nombre}.`,
    },
    2: {
      es: `¡Vamos bien! ✅ Por último, cargá una ${nombre}.`,
      pt: `Estamos indo bem! ✅ Por último, registre um(a) ${nombre}.`,
    },
  };

  const mensaje = mensajes[paso] ?? mensajes[0];
  return esPTidioma ? mensaje.pt : mensaje.es;
}

export function msgTutorialCompletado(idioma: string | null | undefined): string {
  return esPT(idioma)
    ? '🎉 Muito bem! Você já registrou suas primeiras 3 operações. Te levando para o Painel de Controle...'
    : '🎉 ¡Muy bien! Ya cargaste tus primeras 3 operaciones. Te llevo al Panel de Control...';
}

// ==========================================================
// TIPS PERMANENTES DE SABIO EN CONTABILIDAD
// ==========================================================
//
// Cuando no hay tutorial activo, SabioWidget rota estos tips en vez
// de los genéricos del lobby — específicos de esta pantalla.

export const FRASES_SABIO_CONTABILIDAD: Record<'ES' | 'PT', string[]> = {
  ES: [
    'Con Fecha + Operación + Categoría + Forma de Pago, yo resuelvo solo qué cuentas debitar y acreditar.',
    'Registrá las operaciones el mismo día que pasan — así el Panel de Control siempre refleja la realidad.',
    'Si una Venta o Compra no te deja elegir el producto, revisá que tenga categoría asignada en Mercadería.',
    '¿Guardás o invertís plata para una meta? Usá "Transferencia" — así el objetivo se actualiza solo.',
    'En "Registro de Operações" podés validar, editar o eliminar lo ya cargado.',
    'El "Libro Diario" te muestra, agrupado por operación, cada asiento Debe/Haber que generé por vos.',
  ],
  PT: [
    'Com Data + Operação + Categoria + Forma de Pagamento, eu resolvo sozinho quais contas debitar e creditar.',
    'Registre as operações no mesmo dia em que acontecem — assim o Painel de Controle sempre reflete a realidade.',
    'Se uma Venda ou Compra não deixa escolher o produto, verifique se ele tem categoria atribuída em Mercadoria.',
    'Está guardando ou investindo dinheiro para uma meta? Use "Transferência" — o objetivo se atualiza sozinho.',
    'Em "Registro de Operações" você pode validar, editar ou excluir o que já foi carregado.',
    'O "Livro Diário" mostra, agrupado por operação, cada lançamento Débito/Crédito que eu gerei para você.',
  ],
};

export function frasesSabioContabilidad(idioma: string | null | undefined): string[] {
  return FRASES_SABIO_CONTABILIDAD[idioma === 'PT' ? 'PT' : 'ES'];
}
