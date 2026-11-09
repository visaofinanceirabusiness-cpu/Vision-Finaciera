'use client';

// «DIVIDIR EL PAGO» — formulario compartido por todos los métodos de carga (Mini-Juego, Central de Lanzamientos, Lanzamiento
// rápido y la edición de registros). Reparte el total de UNA operación entre 2 a 5 partes, cada una con su forma de pago (y, si la
// operación no mueve productos, su categoría) y su monto. Muestra en vivo cuánto falta o sobra y el saldo de cada medio; los saldos
// que no alcanzan los rechaza el motor (ver lib/pagoDividido.ts), con el mismo criterio de siempre. Es una tarjeta clara que se ve
// bien tanto sobre fondo blanco (Contabilidad) como sobre el oscuro del Mini-Juego.

import { useEffect, useMemo, useState } from 'react';
import { obtenerCategoriasJuego } from '@/lib/miniJuego';
import { obtenerFormasPagoOperacion } from '@/lib/formasPagoOperacion';
import { saldosDeMedios } from '@/lib/saldoCuenta';
import { tipoCuotasDeFormaPago, type TipoCuotas } from '@/lib/cuotasOperacion';
import { MAX_PARTES, autocompletarUltima, faltante, numeroDeMonto, partesDeForm, validarPartes, type ParteForm } from '@/lib/pagoDividido';

const AZUL = 'var(--color-primario, #1f3a5f)';
const VERDE = 'var(--color-secundario, #2e8b57)';

export function DivisionDelPago({
  empresaId,
  operacion,
  fecha,
  total,
  simbolo,
  idioma,
  tieneStock,
  partes,
  onChange,
  onCancelar,
  sinCuotas,
}: {
  empresaId: string;
  operacion: string;
  fecha: string;
  total: number;
  simbolo: string;
  idioma: string | null | undefined;
  // La operación mueve productos: todas las partes llevan la misma categoría y solo se divide entre formas de pago.
  tieneStock: boolean;
  partes: ParteForm[];
  onChange: (partes: ParteForm[]) => void;
  // Volver al pago en una sola parte. Si no se pasa, no se muestra el botón (p. ej. al editar una operación ya dividida).
  onCancelar?: () => void;
  // No ofrecer cuotas (p. ej. al editar).
  sinCuotas?: boolean;
}) {
  const esPT = idioma === 'PT';
  const t = (es: string, pt: string) => (esPT ? pt : es);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [formasPorCategoria, setFormasPorCategoria] = useState<Record<string, string[]>>({});
  const [saldos, setSaldos] = useState<Record<string, number>>({});
  const [tiposCuotas, setTiposCuotas] = useState<Record<string, TipoCuotas>>({});

  const dinero = (n: number) => `${simbolo} ${n.toLocaleString(esPT ? 'pt-BR' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Categorías de la operación (solo si se pueden repartir).
  useEffect(() => {
    if (tieneStock) return;
    let cancelado = false;
    obtenerCategoriasJuego(empresaId, operacion)
      .then((cs) => !cancelado && setCategorias(cs.map((c) => c.nombre)))
      .catch(() => null);
    return () => {
      cancelado = true;
    };
  }, [empresaId, operacion, tieneStock]);

  // Formas de pago de cada categoría usada en las partes.
  const categoriasUsadas = useMemo(() => Array.from(new Set(partes.map((p) => p.categoria).filter(Boolean))), [partes]);
  useEffect(() => {
    let cancelado = false;
    for (const cat of categoriasUsadas) {
      if (formasPorCategoria[cat]) continue;
      obtenerFormasPagoOperacion(empresaId, operacion, cat)
        .then((fp) => !cancelado && setFormasPorCategoria((actual) => ({ ...actual, [cat]: fp })))
        .catch(() => null);
    }
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, operacion, categoriasUsadas]);

  // Saldo de cada medio (para elegir viendo dónde hay plata).
  const todasLasFormas = useMemo(() => Array.from(new Set(Object.values(formasPorCategoria).flat())), [formasPorCategoria]);
  useEffect(() => {
    if (todasLasFormas.length === 0) return;
    let cancelado = false;
    saldosDeMedios(empresaId, todasLasFormas, fecha)
      .then((s) => !cancelado && setSaldos(s))
      .catch(() => null);
    return () => {
      cancelado = true;
    };
  }, [empresaId, fecha, todasLasFormas]);

  // Qué formas de pago admiten cuotas (tarjeta, cuenta a cobrar).
  useEffect(() => {
    if (sinCuotas) return;
    let cancelado = false;
    for (const p of partes) {
      if (!p.formaPago || p.formaPago in tiposCuotas) continue;
      tipoCuotasDeFormaPago(empresaId, operacion, p.formaPago)
        .then((tipo) => !cancelado && setTiposCuotas((actual) => ({ ...actual, [p.formaPago]: tipo })))
        .catch(() => null);
    }
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, operacion, partes, sinCuotas]);

  const cambiar = (indice: number, cambios: Partial<ParteForm>) => {
    const nuevas = partes.map((p, i) => (i === indice ? { ...p, ...cambios, auto: 'monto' in cambios ? false : p.auto } : p));
    onChange(autocompletarUltima(nuevas, total));
  };

  const agregar = () => {
    if (partes.length >= MAX_PARTES) return;
    const ultima = partes[partes.length - 1];
    // La que era «lo que falta» pasa a ser una parte más; la nueva parte toma lo que quede.
    onChange(autocompletarUltima([...partes.map((p) => ({ ...p, auto: false })), { categoria: ultima?.categoria ?? '', formaPago: '', monto: '', auto: true }], total));
  };

  const quitar = (indice: number) => {
    if (partes.length <= 2) return;
    const resto = partes.filter((_, i) => i !== indice);
    onChange(autocompletarUltima(resto.map((p, i) => (i === resto.length - 1 ? { ...p, auto: true, monto: '' } : p)), total));
  };

  const sobra = faltante(partes, total);
  const completas = partes.every((p) => p.categoria && p.formaPago && numeroDeMonto(p.monto) > 0);
  const error = completas ? validarPartes(partesDeForm(partes), total, { tieneStock }) : null;
  const hayCuotas = partes.some((p) => p.enCuotas);

  const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 10px', borderRadius: 10, border: '2px solid #d6dee5', fontSize: 15, color: '#1f2937', background: '#fff' };

  return (
    <div style={{ background: '#fff', color: '#1f2937', borderRadius: 18, padding: '14px 14px 16px', textAlign: 'left', border: `2px solid ${VERDE}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: AZUL }}>➗ {t('Dividir el pago', 'Dividir o pagamento')}</div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{t('Total', 'Total')}: {dinero(total)}</div>
      </div>

      {partes.map((p, i) => {
        const formas = formasPorCategoria[p.categoria] ?? [];
        const tipo = tiposCuotas[p.formaPago] ?? null;
        return (
          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 10, marginBottom: 8, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong style={{ fontSize: 14, color: AZUL }}>{t('Parte', 'Parte')} {i + 1}</strong>
              {partes.length > 2 && (
                <button type="button" onClick={() => quitar(i)} aria-label={t('Quitar esta parte', 'Remover esta parte')} style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: 8, width: 30, height: 30, fontWeight: 900, cursor: 'pointer' }}>
                  ✕
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {!tieneStock && (
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#6e7781' }}>
                  {t('Categoría', 'Categoria')}
                  <select value={p.categoria} onChange={(e) => cambiar(i, { categoria: e.target.value, formaPago: '', enCuotas: false })} style={campo}>
                    {!categorias.includes(p.categoria) && p.categoria && <option value={p.categoria}>{p.categoria}</option>}
                    {categorias.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#6e7781' }}>
                {t('Forma de pago', 'Forma de pagamento')}
                <select value={p.formaPago} onChange={(e) => cambiar(i, { formaPago: e.target.value, enCuotas: false })} style={campo}>
                  <option value="">{t('Elegí…', 'Escolha…')}</option>
                  {formas.map((f) => (
                    <option key={f} value={f}>
                      {f}
                      {f in saldos ? ` · ${dinero(saldos[f])}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#6e7781' }}>
                {t('Monto', 'Valor')}
                <input inputMode="decimal" value={p.monto} onChange={(e) => cambiar(i, { monto: e.target.value })} placeholder="0,00" style={{ ...campo, fontWeight: 800 }} />
              </label>
            </div>

            {!sinCuotas && tipo && (!hayCuotas || p.enCuotas) && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14 }}>
                <input type="checkbox" checked={Boolean(p.enCuotas)} onChange={(e) => cambiar(i, { enCuotas: e.target.checked, cuotas: e.target.checked ? (p.cuotas ?? '2') : undefined })} />
                {t('Esta parte en cuotas', 'Esta parte em parcelas')}
                {p.enCuotas && <input inputMode="numeric" value={p.cuotas ?? '2'} onChange={(e) => cambiar(i, { cuotas: e.target.value })} style={{ ...campo, width: 70, padding: '6px 8px' }} aria-label={t('Cantidad de cuotas', 'Quantidade de parcelas')} />}
              </label>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <button type="button" onClick={agregar} disabled={partes.length >= MAX_PARTES} style={{ border: `2px solid ${VERDE}`, background: '#fff', color: VERDE, borderRadius: 12, padding: '8px 14px', fontWeight: 800, fontSize: 14, cursor: partes.length >= MAX_PARTES ? 'default' : 'pointer', opacity: partes.length >= MAX_PARTES ? 0.5 : 1 }}>
          ➕ {t('Agregar parte', 'Adicionar parte')}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} style={{ border: 'none', background: 'none', color: '#6e7781', textDecoration: 'underline', fontSize: 14, cursor: 'pointer' }}>
            {t('Pagar todo de una vez', 'Pagar tudo de uma vez')}
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, color: Math.abs(sobra) < 0.005 ? '#16a34a' : '#b91c1c' }}>
          {Math.abs(sobra) < 0.005 ? `✅ ${t('Las partes suman el total', 'As partes somam o total')}` : sobra > 0 ? `${t('Faltan', 'Faltam')} ${dinero(sobra)}` : `${t('Sobran', 'Sobram')} ${dinero(Math.abs(sobra))}`}
        </div>
      </div>

      {error && <div style={{ marginTop: 8, fontSize: 14, color: '#b91c1c', fontWeight: 700 }}>⚠️ {error}</div>}
      <div style={{ marginTop: 8, fontSize: 12.5, color: '#6e7781', lineHeight: 1.4 }}>
        {t('Cada parte usa su propia cuenta y se controla su saldo: ninguna puede quedar en negativo.', 'Cada parte usa sua própria conta e tem o saldo controlado: nenhuma pode ficar negativa.')}
      </div>
    </div>
  );
}
