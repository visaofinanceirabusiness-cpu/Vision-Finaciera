// lib/categorias.ts
//
// ALTA DE CATEGORÍAS DESDE CONFIGURAÇÕES
// =====================================================
//
// Acá es donde una categoría de producto o de gasto nueva se
// convierte automáticamente en cuentas contables reales. Es el
// mecanismo que reemplaza la carga manual del Plano de Contas: el
// usuario solo pone un nombre, y esta función arma todo lo demás
// (cuenta, vínculo, reglas contables) usando las cuentas
// "contenedoras" que dejó marcadas el perfil de la empresa
// (rol_contable = CONTENEDOR_STOCK / CONTENEDOR_INGRESO /
// CONTENEDOR_COSTO / CONTENEDOR_GASTO / CONTENEDOR_PERDIDA).
//
// Si la empresa no tiene esas cuentas contenedoras (por ejemplo,
// porque nunca se le aplicó un perfil), tira un error claro en vez
// de crear una cuenta "suelta" sin padre.

import { supabase } from './supabase';

function generarCodigo(nombre: string, existentes: string[]): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');

  if (!existentes.includes(base)) {
    return base;
  }

  for (let sufijo = 2; sufijo < 100; sufijo += 1) {
    const candidato = `${base.slice(0, 2)}${sufijo}`;
    if (!existentes.includes(candidato)) {
      return candidato;
    }
  }

  return `${base}${Date.now()}`;
}

async function buscarCuentaContenedora(empresaId: string, rolContable: string) {
  const { data, error } = await supabase
    .from('plan_cuentas')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('rol_contable', rolContable)
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      `Esta empresa no tiene configurada la cuenta contenedora "${rolContable}". Revisá que el perfil se haya aplicado correctamente.`
    );
  }

  return data.id as string;
}

async function siguienteCodigoDeCuenta(empresaId: string, prefijoPadreId: string) {
  const { data, error } = await supabase
    .from('plan_cuentas')
    .select('codigo')
    .eq('empresa_id', empresaId)
    .eq('cuenta_padre_id', prefijoPadreId);

  if (error) {
    throw error;
  }

  const codigosHijos = (data ?? []).map((fila) => fila.codigo);

  // Los códigos son del estilo "1.1.3.0.0" (padre) → "1.1.3.0.1",
  // "1.1.3.0.2", ... (hijos). Buscamos el próximo número libre en la
  // última posición.
  const { data: padre, error: errorPadre } = await supabase
    .from('plan_cuentas')
    .select('codigo')
    .eq('id', prefijoPadreId)
    .single();

  if (errorPadre) {
    throw errorPadre;
  }

  const partesPadre = padre.codigo.split('.');
  const numeros = codigosHijos
    .map((codigo) => parseInt(codigo.split('.').pop() ?? '0', 10))
    .filter((n) => !Number.isNaN(n));

  const siguiente = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;

  return [...partesPadre.slice(0, -1), String(siguiente)].join('.');
}

// Busca si ya existe una cuenta con ese nombre y tipo en el Plan de
// Cuentas de la empresa, SIN importar en qué encabezado esté (los
// gastos que trae el perfil maestro a veces quedan repartidos entre
// varios sub-grupos: Comerciales, Generales, Financieras, etc.).
// Evita crear duplicados cuando el usuario escribe el nombre de una
// cuenta que el plan ya trae de fábrica.
async function buscarCuentaExistentePorNombre(empresaId: string, nombre: string, tipoSaldo: string) {
  const { data, error } = await supabase
    .from('plan_cuentas')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('tipo_saldo', tipoSaldo)
    .ilike('nombre', nombre.trim())
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id as string | undefined;
}

async function crearCuentaHija(
  empresaId: string,
  padreId: string,
  nombre: string,
  naturaleza: string,
  tipoSaldo: string
) {
  const codigo = await siguienteCodigoDeCuenta(empresaId, padreId);

  const { data, error } = await supabase
    .from('plan_cuentas')
    .insert({
      empresa_id: empresaId,
      codigo,
      nombre,
      cuenta_padre_id: padreId,
      naturaleza,
      tipo_saldo: tipoSaldo,
      activo: true,
      saldo_inicial: 0,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

// =====================================================
// CATEGORÍA DE PRODUCTO (habilita COMPRA / VENTA / PERDIDA)
// =====================================================

export async function crearCategoriaProducto(empresaId: string, nombre: string) {
  const nombreLimpio = nombre.trim();

  if (!nombreLimpio) {
    throw new Error('El nombre de la categoría no puede estar vacío.');
  }

  const { data: existentes, error: errorExistentes } = await supabase
    .from('categorias_productos')
    .select('codigo')
    .eq('empresa_id', empresaId);

  if (errorExistentes) {
    throw errorExistentes;
  }

  const codigo = generarCodigo(nombreLimpio, (existentes ?? []).map((c) => c.codigo));

  const [contenedorStock, contenedorIngreso, contenedorCosto] = await Promise.all([
    buscarCuentaContenedora(empresaId, 'CONTENEDOR_STOCK'),
    buscarCuentaContenedora(empresaId, 'CONTENEDOR_INGRESO'),
    buscarCuentaContenedora(empresaId, 'CONTENEDOR_COSTO'),
  ]);

  const [cuentaStockId, cuentaIngresoId, cuentaCmvId] = await Promise.all([
    crearCuentaHija(empresaId, contenedorStock, `Stock ${nombreLimpio}`, 'DEUDORA', 'ACTIVO'),
    crearCuentaHija(empresaId, contenedorIngreso, `Venta ${nombreLimpio}`, 'ACREEDORA', 'INGRESO'),
    crearCuentaHija(empresaId, contenedorCosto, `Costo de ${nombreLimpio}`, 'DEUDORA', 'COSTO'),
  ]);

  const { data: categoriaCreada, error: errorCategoria } = await supabase
    .from('categorias_productos')
    .insert({ empresa_id: empresaId, codigo, nombre: nombreLimpio, activo: true })
    .select('id')
    .single();

  if (errorCategoria) {
    throw errorCategoria;
  }

  const { error: errorVinculo } = await supabase.from('categorias_productos_cuentas').insert({
    empresa_id: empresaId,
    categoria_producto_id: categoriaCreada.id,
    cuenta_stock_id: cuentaStockId,
    cuenta_ingreso_id: cuentaIngresoId,
    cuenta_cmv_id: cuentaCmvId,
    activo: true,
  });

  if (errorVinculo) {
    throw errorVinculo;
  }

  // ---------------------------------------------------
  // PERDIDA: la categoría de operación es una por cada categoría de
  // producto, pero todas apuntan a la misma cuenta contenedora fija.
  // ---------------------------------------------------

  const contenedorPerdida = await buscarCuentaContenedora(empresaId, 'CONTENEDOR_PERDIDA');

  const { data: catOperacionPerdida, error: errorCatOperacion } = await supabase
    .from('categorias_operacion')
    .insert({
      empresa_id: empresaId,
      operacion: 'PERDIDA',
      codigo,
      nombre: nombreLimpio,
      tipo: 'AJUSTE',
      activo: true,
    })
    .select('id')
    .single();

  if (errorCatOperacion) {
    throw errorCatOperacion;
  }

  const { error: errorCatOperacionCuentas } = await supabase.from('categorias_operacion_cuentas').insert({
    empresa_id: empresaId,
    categoria_operacion_id: catOperacionPerdida.id,
    cuenta_id: contenedorPerdida,
    rol: 'PERDIDA',
    activo: true,
  });

  if (errorCatOperacionCuentas) {
    throw errorCatOperacionCuentas;
  }

  // ---------------------------------------------------
  // REGLAS CONTABLES: se copian de las plantillas COMPRA/VENTA/
  // PERDIDA que dejó cargadas el perfil (categoria en null).
  // ---------------------------------------------------

  // Se filtra también por "motor" porque en el perfil Mixto hay DOS
  // plantillas de VENTA: una para producto (motor VENTAS, con stock)
  // y otra para servicio (motor SERVICIOS, sin stock). Acá solo nos
  // interesa la de producto.
  const { data: plantillas, error: errorPlantillas } = await supabase
    .from('reglas_contables')
    .select('operacion, rol_debito, rol_credito, stock, libro, cmv, motor')
    .eq('empresa_id', empresaId)
    .is('categoria_codigo', null)
    .in('operacion', ['COMPRA', 'VENTA', 'PERDIDA'])
    .in('motor', ['COMPRAS', 'VENTAS', 'GASTOS']);

  if (errorPlantillas) {
    throw errorPlantillas;
  }

  if (plantillas && plantillas.length > 0) {
    const { error: errorReglas } = await supabase.from('reglas_contables').insert(
      plantillas.map((p) => ({
        empresa_id: empresaId,
        operacion: p.operacion,
        categoria_codigo: codigo,
        categoria_nombre: nombreLimpio,
        rol_debito: p.rol_debito,
        rol_credito: p.rol_credito,
        stock: p.stock,
        libro: p.libro,
        cmv: p.cmv,
        motor: p.motor,
      }))
    );

    if (errorReglas) {
      throw errorReglas;
    }
  }

  return { codigo, nombre: nombreLimpio };
}

// =====================================================
// CATEGORÍA DE GASTO (habilita PAGO)
// =====================================================

export async function crearCategoriaGasto(empresaId: string, nombre: string) {
  const nombreLimpio = nombre.trim();

  if (!nombreLimpio) {
    throw new Error('El nombre de la categoría no puede estar vacío.');
  }

  const { data: existentes, error: errorExistentes } = await supabase
    .from('categorias_operacion')
    .select('codigo')
    .eq('empresa_id', empresaId)
    .eq('operacion', 'PAGO');

  if (errorExistentes) {
    throw errorExistentes;
  }

  const codigo = generarCodigo(nombreLimpio, (existentes ?? []).map((c) => c.codigo));

  // Si el plan de cuentas ya trae una cuenta de gasto con ese nombre
  // (por ejemplo "Alquiler", cargada por el perfil), la reutilizamos
  // en vez de crear una cuenta duplicada.
  const cuentaExistente = await buscarCuentaExistentePorNombre(empresaId, nombreLimpio, 'GASTO');
  const cuentaGastoId =
    cuentaExistente ??
    (await crearCuentaHija(
      empresaId,
      await buscarCuentaContenedora(empresaId, 'CONTENEDOR_GASTO'),
      nombreLimpio,
      'DEUDORA',
      'GASTO'
    ));

  const { data: categoriaCreada, error: errorCategoria } = await supabase
    .from('categorias_operacion')
    .insert({
      empresa_id: empresaId,
      operacion: 'PAGO',
      codigo,
      nombre: nombreLimpio,
      tipo: 'GASTO',
      activo: true,
    })
    .select('id')
    .single();

  if (errorCategoria) {
    throw errorCategoria;
  }

  const { error: errorVinculo } = await supabase.from('categorias_operacion_cuentas').insert({
    empresa_id: empresaId,
    categoria_operacion_id: categoriaCreada.id,
    cuenta_id: cuentaGastoId,
    rol: 'GASTO',
    activo: true,
  });

  if (errorVinculo) {
    throw errorVinculo;
  }

  const { data: plantilla, error: errorPlantilla } = await supabase
    .from('reglas_contables')
    .select('rol_debito, rol_credito, stock, libro, cmv, motor')
    .eq('empresa_id', empresaId)
    .eq('operacion', 'PAGO')
    .is('categoria_codigo', null)
    .maybeSingle();

  if (errorPlantilla) {
    throw errorPlantilla;
  }

  if (plantilla) {
    const { error: errorRegla } = await supabase.from('reglas_contables').insert({
      empresa_id: empresaId,
      operacion: 'PAGO',
      categoria_codigo: codigo,
      categoria_nombre: nombreLimpio,
      rol_debito: plantilla.rol_debito,
      rol_credito: plantilla.rol_credito,
      stock: plantilla.stock,
      libro: plantilla.libro,
      cmv: plantilla.cmv,
      motor: plantilla.motor,
    });

    if (errorRegla) {
      throw errorRegla;
    }
  }

  return { codigo, nombre: nombreLimpio };
}

// =====================================================
// CATEGORÍA DE SERVICIO / INGRESO (sin stock)
//
// Sirve para dos casos que son estructuralmente iguales: una venta
// de servicio (perfil Servicios/Mixto, operación VENTA) y un ingreso
// personal como un sueldo (perfil Familiar, operación COBRO). En
// ambos casos se crea UNA cuenta de ingreso, sin stock ni CMV.
// =====================================================

export async function crearCategoriaIngreso(
  empresaId: string,
  nombre: string,
  operacion: 'VENTA' | 'COBRO'
) {
  const nombreLimpio = nombre.trim();

  if (!nombreLimpio) {
    throw new Error('El nombre de la categoría no puede estar vacío.');
  }

  const { data: existentes, error: errorExistentes } = await supabase
    .from('categorias_operacion')
    .select('codigo')
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion);

  if (errorExistentes) {
    throw errorExistentes;
  }

  const codigo = generarCodigo(nombreLimpio, (existentes ?? []).map((c) => c.codigo));

  const contenedorIngreso = await buscarCuentaContenedora(empresaId, 'CONTENEDOR_INGRESO');
  const cuentaIngresoId = await crearCuentaHija(empresaId, contenedorIngreso, nombreLimpio, 'ACREEDORA', 'INGRESO');

  const { data: categoriaCreada, error: errorCategoria } = await supabase
    .from('categorias_operacion')
    .insert({
      empresa_id: empresaId,
      operacion,
      codigo,
      nombre: nombreLimpio,
      tipo: 'INGRESO',
      activo: true,
    })
    .select('id')
    .single();

  if (errorCategoria) {
    throw errorCategoria;
  }

  const { error: errorVinculo } = await supabase.from('categorias_operacion_cuentas').insert({
    empresa_id: empresaId,
    categoria_operacion_id: categoriaCreada.id,
    cuenta_id: cuentaIngresoId,
    rol: 'INGRESO',
    activo: true,
  });

  if (errorVinculo) {
    throw errorVinculo;
  }

  const { data: plantilla, error: errorPlantilla } = await supabase
    .from('reglas_contables')
    .select('rol_debito, rol_credito, stock, libro, cmv, motor')
    .eq('empresa_id', empresaId)
    .eq('operacion', operacion)
    .is('categoria_codigo', null)
    .in('motor', ['SERVICIOS', 'INGRESOS'])
    .maybeSingle();

  if (errorPlantilla) {
    throw errorPlantilla;
  }

  if (plantilla) {
    const { error: errorRegla } = await supabase.from('reglas_contables').insert({
      empresa_id: empresaId,
      operacion,
      categoria_codigo: codigo,
      categoria_nombre: nombreLimpio,
      rol_debito: plantilla.rol_debito,
      rol_credito: plantilla.rol_credito,
      stock: plantilla.stock,
      libro: plantilla.libro,
      cmv: plantilla.cmv,
      motor: plantilla.motor,
    });

    if (errorRegla) {
      throw errorRegla;
    }
  }

  return { codigo, nombre: nombreLimpio };
}

// =====================================================
// FORMA DE PAGO NUEVA
//
// A diferencia de las categorías, una forma de pago no genera una
// cuenta nueva: se vincula a una cuenta que el usuario elige entre
// las que ya existen en su Plano de Contas (normalmente una cuenta
// de Activo: un banco, una billetera virtual nueva, etc.).
// =====================================================

// Crea una cuenta nueva para una forma de pago que todavía no tiene
// dónde imputarse (ej. "Mercado Pago" cuando no existe una cuenta de
// billetera virtual separada de "Banco"). Se cuelga de la cuenta
// contenedora CONTENEDOR_MEDIO_PAGO (Activo Corriente).
export async function crearCuentaParaMedioPago(
  empresaId: string,
  nombre: string,
  tipoSaldo: 'ACTIVO' | 'PASIVO'
) {
  const nombreLimpio = nombre.trim();

  if (!nombreLimpio) {
    throw new Error('El nombre de la cuenta no puede estar vacío.');
  }

  const contenedor = await buscarCuentaContenedora(empresaId, 'CONTENEDOR_MEDIO_PAGO');
  const naturaleza = tipoSaldo === 'ACTIVO' ? 'DEUDORA' : 'ACREEDORA';

  return crearCuentaHija(empresaId, contenedor, nombreLimpio, naturaleza, tipoSaldo);
}

export async function crearFormaPago(
  empresaId: string,
  nombre: string,
  cuentaId: string,
  operacionesValidas: string[]
) {
  const nombreLimpio = nombre.trim();

  if (!nombreLimpio) {
    throw new Error('El nombre de la forma de pago no puede estar vacío.');
  }

  if (!cuentaId) {
    throw new Error('Elegí a qué cuenta contable corresponde esta forma de pago.');
  }

  const { data: existentes, error: errorExistentes } = await supabase
    .from('formas_pago')
    .select('codigo')
    .eq('empresa_id', empresaId);

  if (errorExistentes) {
    throw errorExistentes;
  }

  const codigo = generarCodigo(nombreLimpio, (existentes ?? []).map((c) => c.codigo));

  const { data: formaPagoCreada, error: errorFormaPago } = await supabase
    .from('formas_pago')
    .insert({ empresa_id: empresaId, codigo, nombre: nombreLimpio, activo: true })
    .select('id')
    .single();

  if (errorFormaPago) {
    throw errorFormaPago;
  }

  const { error: errorVinculo } = await supabase.from('forma_pago_cuentas').insert({
    empresa_id: empresaId,
    forma_pago_id: formaPagoCreada.id,
    cuenta_id: cuentaId,
    activo: true,
  });

  if (errorVinculo) {
    throw errorVinculo;
  }

  if (operacionesValidas.length > 0) {
    const { data: operaciones, error: errorOperaciones } = await supabase
      .from('operaciones')
      .select('id, nombre')
      .eq('empresa_id', empresaId)
      .in('nombre', operacionesValidas);

    if (errorOperaciones) {
      throw errorOperaciones;
    }

    const filas = (operaciones ?? []).map((o) => ({
      empresa_id: empresaId,
      operacion_id: o.id,
      forma_pago_id: formaPagoCreada.id,
      activo: true,
    }));

    if (filas.length > 0) {
      const { error: errorFPO } = await supabase.from('formas_pago_operacion').insert(filas);

      if (errorFPO) {
        throw errorFPO;
      }
    }
  }

  return { codigo, nombre: nombreLimpio };
}

// =====================================================
// ACTIVAR / DESACTIVAR
// =====================================================

export async function cambiarActivoCategoriaProducto(id: string, activo: boolean) {
  const { error } = await supabase.from('categorias_productos').update({ activo }).eq('id', id);
  if (error) throw error;
}

export async function cambiarActivoCategoriaGasto(id: string, activo: boolean) {
  const { error } = await supabase.from('categorias_operacion').update({ activo }).eq('id', id);
  if (error) throw error;
}

// Misma tabla que las categorías de gasto (categorias_operacion) —
// alias con nombre claro para cuando el ítem es una categoría de
// servicio/ingreso.
export const cambiarActivoCategoriaIngreso = cambiarActivoCategoriaGasto;

export async function cambiarActivoFormaPago(id: string, activo: boolean) {
  const { error } = await supabase.from('formas_pago').update({ activo }).eq('id', id);
  if (error) throw error;
}
