'use client';

// PROPUESTAS DE COMPRA — Nuestro Sueño (fase 3)
//
// Tarjetas de propiedades candidatas. Pegando el link de la
// publicación se intenta traer datos reales (precio, m2, cuartos,
// dirección, foto) vía /api/nuestro-sueno/extraer-propiedad — best
// effort, según lo que el portal exponga en Open Graph / JSON-LD.
// Todo campo se puede completar o corregir a mano, extraer nunca es
// obligatorio.
//
// El comparador (precio/m2, distancia a la primera tarjeta cargada
// como referencia) y el simulador de financiamiento (sistema
// francés, ver lib/simuladorCompra.ts) trabajan sobre los datos reales
// que ya haya en las tarjetas.

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  listarPropuestas,
  crearPropuesta,
  actualizarPropuesta,
  eliminarPropuesta,
  ESTADOS_PROPUESTA,
  type SuenoPropuesta,
  type DatosPropuesta,
  type EstadoPropuesta,
} from '@/lib/nuestroSueno';
import {
  calcularFinanciamiento,
  distanciaKm,
  urlGoogleMaps,
  convertirAPesos,
  type ResultadoFinanciamiento,
  type TasasARS,
} from '@/lib/simuladorCompra';
import { obtenerCotizacionesActuales } from '@/lib/cotizaciones';

const BORRADOR_VACIO: DatosPropuesta = {
  link: '',
  titulo: '',
  precio: null,
  moneda: null,
  m2: null,
  cuartos: null,
  banos: null,
  direccion: '',
  lat: null,
  lng: null,
  imagen_url: null,
  servicios: null,
  notas: '',
  construccion: 0,
};

const COLOR_CONSTRUCCION = '#7c3aed';

// alquiler: un ingreso fijo mensual ya comprometido para aportar a la
// cuota (ej. alquilar una parte de la propiedad). NO cambia el monto
// de la cuota — es una explicación de CÓMO se paga: una parte la cubre
// ese aporte, el resto sale del bolsillo de la pareja.
type ParametrosSim = { entrada: number; tasa: number; plazo: number; alquiler: number };
const SIM_DEFAULT: ParametrosSim = { entrada: 20, tasa: 12, plazo: 240, alquiler: 0 };

const COLOR_ALQUILER = '#0891b2';
const COLOR_FALTA_AHORRO = '#d97706';

// El "resto a cargo" de la cuota (después de descontar el aporte de
// alquiler) lo termina poniendo la familia en Argentina — se lo llama
// así en vez de un genérico "resto a cargo" porque es quién realmente
// pone esa plata cada mes.
function etiquetaFinanciamientoArg(esPT: boolean): string {
  return esPT ? 'financiamento argentino (papais)' : 'financiamiento argentino (papis)';
}

export function PropuestasCompra({
  parejaId,
  perfilId,
  esPT,
  colorAcento,
  ahorroActual,
}: {
  parejaId: string;
  perfilId: string;
  esPT: boolean;
  colorAcento: string;
  // El ahorro compartido de la pareja (campo "Ahorro acumulado hoy" de
  // La casa de los sueños, ver page.tsx) — se usa acá para calcular
  // cuánto falta juntar para cubrir la entrada de cada propuesta, sin
  // duplicar ese dato en un campo aparte.
  ahorroActual: number | null;
}) {
  const [propuestas, setPropuestas] = useState<SuenoPropuesta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [borrador, setBorrador] = useState<DatosPropuesta>(BORRADOR_VACIO);
  const [extrayendo, setExtrayendo] = useState(false);
  const [errorExtraccion, setErrorExtraccion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [parametrosSim, setParametrosSim] = useState<Record<string, ParametrosSim>>({});
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [borradorEdicion, setBorradorEdicion] = useState<DatosPropuesta>(BORRADOR_VACIO);
  const [extrayendoEdicion, setExtrayendoEdicion] = useState(false);
  const [errorExtraccionEdicion, setErrorExtraccionEdicion] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [parametrosComparador, setParametrosComparador] = useState<ParametrosSim>(SIM_DEFAULT);
  // Con solo 2 propuestas da igual, pero apenas haya varias comparar
  // TODAS a la vez en la misma tabla deja de ser legible — por eso se
  // puede destildar cuáles entran a la comparación. Vacío = entran
  // todas (nada excluido).
  const [idsExcluidosComparador, setIdsExcluidosComparador] = useState<Set<string>>(new Set());
  const [tasasSistema, setTasasSistema] = useState<TasasARS>({ USD: null, BRL: null });
  const [usarCotizacionSistema, setUsarCotizacionSistema] = useState(true);
  const [tasasManual, setTasasManual] = useState<TasasARS>({ USD: null, BRL: null });

  async function cargar() {
    const datos = await listarPropuestas(parejaId);
    setPropuestas(datos);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parejaId]);

  useEffect(() => {
    obtenerCotizacionesActuales()
      .then((cotizaciones) => {
        const usdArs = cotizaciones.find((c) => c.par === 'USD_ARS')?.valor ?? null;
        const brlArs = cotizaciones.find((c) => c.par === 'ARS_BRL')?.valor ?? null;
        setTasasSistema({ USD: usdArs, BRL: brlArs });
      })
      .catch(() => {
        // Sin cotización del sistema disponible — el comparador sigue
        // funcionando, solo no puede convertir a pesos hasta que se
        // carguen tasas manuales.
      });
  }, []);

  const tasasEfectivas: TasasARS = usarCotizacionSistema ? tasasSistema : tasasManual;

  // Compartida entre "nueva propuesta" y "editar propuesta" — pegar (o
  // re-pegar) el link siempre puede volver a traer datos, por si la
  // primera extracción vino incompleta (el portal puede tardar en
  // exponer todo, o algunos campos solo aparecen en Open Graph y otros
  // solo en JSON-LD).
  async function extraerHacia(
    link: string | null | undefined,
    setBorradorDestino: Dispatch<SetStateAction<DatosPropuesta>>,
    setExtrayendoDestino: (v: boolean) => void,
    setErrorDestino: (v: string) => void
  ) {
    if (!link) return;
    setExtrayendoDestino(true);
    setErrorDestino('');

    try {
      const respuesta = await fetch('/api/nuestro-sueno/extraer-propiedad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link }),
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        setErrorDestino(resultado.error || (esPT ? 'Não foi possível extrair dados.' : 'No se pudo extraer datos.'));
        setExtrayendoDestino(false);
        return;
      }

      const d = resultado.datos;
      setBorradorDestino((actual) => ({
        ...actual,
        titulo: d.titulo ?? actual.titulo,
        precio: d.precio ?? actual.precio,
        moneda: d.moneda ?? actual.moneda,
        m2: d.m2 ?? actual.m2,
        cuartos: d.cuartos ?? actual.cuartos,
        banos: d.banos ?? actual.banos,
        direccion: d.direccion ?? actual.direccion,
        lat: d.lat ?? actual.lat,
        lng: d.lng ?? actual.lng,
        imagen_url: d.imagenUrl ?? actual.imagen_url,
      }));
    } catch {
      setErrorDestino(esPT ? 'Não foi possível acessar o link.' : 'No se pudo acceder al link.');
    }

    setExtrayendoDestino(false);
  }

  async function guardarTarjeta() {
    setGuardando(true);
    try {
      await crearPropuesta(parejaId, perfilId, borrador);
      setBorrador(BORRADOR_VACIO);
      setMostrandoForm(false);
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  function iniciarEdicion(p: SuenoPropuesta) {
    setEditandoId(p.id);
    setErrorExtraccionEdicion('');
    setBorradorEdicion({
      link: p.link,
      titulo: p.titulo,
      precio: p.precio,
      moneda: p.moneda,
      m2: p.m2,
      cuartos: p.cuartos,
      banos: p.banos,
      direccion: p.direccion,
      lat: p.lat,
      lng: p.lng,
      imagen_url: p.imagen_url,
      servicios: p.servicios,
      notas: p.notas,
      construccion: p.construccion,
    });
  }

  async function guardarEdicion() {
    if (!editandoId) return;
    setGuardandoEdicion(true);
    try {
      await actualizarPropuesta(editandoId, borradorEdicion);
      setEditandoId(null);
      await cargar();
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function cambiarEstado(id: string, estado: EstadoPropuesta) {
    await actualizarPropuesta(id, { estado });
    await cargar();
  }

  async function borrar(id: string) {
    if (!confirm(esPT ? 'Excluir esta proposta?' : '¿Eliminar esta propuesta?')) return;
    await eliminarPropuesta(id);
    await cargar();
  }

  function simParaTarjeta(id: string): ParametrosSim {
    return parametrosSim[id] ?? SIM_DEFAULT;
  }

  function actualizarSim(id: string, campo: keyof ParametrosSim, valor: number) {
    setParametrosSim((actual) => ({ ...actual, [id]: { ...simParaTarjeta(id), [campo]: valor } }));
  }

  const referencia = propuestas[0];

  // Sugerencia (no obligatoria) de cuánto cargar en "Construcción":
  // para que un terreno baldío quede en pie de igualdad con la opción
  // más cara ya construida, el precio + construcción debería alcanzar
  // al menos ese precio más alto — la diferencia entre ambas opciones.
  function sugerirMinimoConstruccion(precioActual: number | null, excluirId?: string): number {
    const otrasConPrecio = propuestas.filter((p) => p.id !== excluirId && p.precio !== null);
    if (!precioActual || otrasConPrecio.length === 0) return 0;
    const precioMasAlto = Math.max(...otrasConPrecio.map((p) => p.precio as number));
    return Math.max(0, precioMasAlto - precioActual);
  }

  if (cargando) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ margin: 0, color: '#6e7781', fontSize: 15 }}>
          {esPT
            ? 'Cole o link de um anúncio para trazer os dados reais.'
            : 'Pegá el link de una publicación para traer los datos reales.'}
        </p>
        <button onClick={() => setMostrandoForm((v) => !v)} style={estilosLocales.botonSecundario(colorAcento)}>
          {mostrandoForm ? (esPT ? 'Cancelar' : 'Cancelar') : esPT ? '+ Nova proposta' : '+ Nueva propuesta'}
        </button>
      </div>

      {mostrandoForm && (
        <div style={estilosLocales.formulario}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={borrador.link ?? ''}
              onChange={(e) => setBorrador((b) => ({ ...b, link: e.target.value }))}
              placeholder={esPT ? 'Link do anúncio' : 'Link de la publicación'}
              style={{ ...estilosLocales.input, flex: 1 }}
            />
            <button
              onClick={() => extraerHacia(borrador.link, setBorrador, setExtrayendo, setErrorExtraccion)}
              disabled={extrayendo || !borrador.link}
              style={estilosLocales.botonSecundario(colorAcento)}
            >
              {extrayendo ? '...' : esPT ? 'Extrair dados' : 'Extraer datos'}
            </button>
          </div>

          {errorExtraccion && <p style={{ color: '#b91c1c', fontSize: 15 }}>{errorExtraccion}</p>}

          <CamposPropuestaForm
            valores={borrador}
            onChange={setBorrador}
            esPT={esPT}
            sugerenciaMinimaConstruccion={sugerirMinimoConstruccion(borrador.precio)}
          />

          <button onClick={guardarTarjeta} disabled={guardando} style={estilosLocales.botonPrincipal(colorAcento)}>
            {guardando ? '...' : esPT ? 'Salvar proposta' : 'Guardar propuesta'}
          </button>
        </div>
      )}

      {propuestas.length === 0 && !mostrandoForm && (
        <p style={{ color: '#6e7781' }}>{esPT ? 'Ainda não há propostas carregadas.' : 'Todavía no hay propuestas cargadas.'}</p>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {propuestas.map((p) => {
          const mapaUrl = urlGoogleMaps(p.direccion, p.lat, p.lng);
          const precioM2 = p.precio && p.m2 ? Math.round(p.precio / p.m2) : null;
          const dist =
            referencia && referencia.id !== p.id && referencia.lat !== null && referencia.lng !== null && p.lat !== null && p.lng !== null
              ? distanciaKm(referencia.lat, referencia.lng, p.lat, p.lng)
              : null;

          const sim = simParaTarjeta(p.id);
          const resultado: ResultadoFinanciamiento | null = p.precio
            ? calcularFinanciamiento({ precio: p.precio, entradaPorcentaje: sim.entrada, tasaAnualPorcentaje: sim.tasa, plazoMeses: sim.plazo })
            : null;

          if (editandoId === p.id) {
            return (
              <div key={p.id} style={estilosLocales.tarjetaPropuesta}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    value={borradorEdicion.link ?? ''}
                    onChange={(e) => setBorradorEdicion((b) => ({ ...b, link: e.target.value }))}
                    placeholder={esPT ? 'Link do anúncio' : 'Link de la publicación'}
                    style={{ ...estilosLocales.input, flex: 1 }}
                  />
                  <button
                    onClick={() =>
                      extraerHacia(borradorEdicion.link, setBorradorEdicion, setExtrayendoEdicion, setErrorExtraccionEdicion)
                    }
                    disabled={extrayendoEdicion || !borradorEdicion.link}
                    style={estilosLocales.botonSecundario(colorAcento)}
                  >
                    {extrayendoEdicion ? '...' : esPT ? 'Extrair dados' : 'Extraer datos'}
                  </button>
                </div>

                {errorExtraccionEdicion && <p style={{ color: '#b91c1c', fontSize: 15 }}>{errorExtraccionEdicion}</p>}

                <CamposPropuestaForm
                  valores={borradorEdicion}
                  onChange={setBorradorEdicion}
                  esPT={esPT}
                  sugerenciaMinimaConstruccion={sugerirMinimoConstruccion(borradorEdicion.precio, editandoId ?? undefined)}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={guardarEdicion} disabled={guardandoEdicion} style={estilosLocales.botonPrincipal(colorAcento)}>
                    {guardandoEdicion ? '...' : esPT ? 'Salvar alterações' : 'Guardar cambios'}
                  </button>
                  <button onClick={() => setEditandoId(null)} style={estilosLocales.botonSecundario(colorAcento)}>
                    {esPT ? 'Cancelar' : 'Cancelar'}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={p.id} style={estilosLocales.tarjetaPropuesta}>
              <div style={{ display: 'flex', gap: 12 }}>
                {p.imagen_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen_url} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ color: '#1f3a5f' }}>{p.titulo || (esPT ? 'Sem título' : 'Sin título')}</strong>
                    <select
                      value={p.estado}
                      onChange={(e) => cambiarEstado(p.id, e.target.value as EstadoPropuesta)}
                      style={{ fontSize: 14, borderRadius: 6, border: '1px solid #d1d5db' }}
                    >
                      {ESTADOS_PROPUESTA.map((e) => (
                        <option key={e.valor} value={e.valor}>
                          {e.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>

                  {p.direccion && <p style={{ margin: '4px 0', fontSize: 15, color: '#6e7781' }}>{p.direccion}</p>}

                  <div style={{ display: 'flex', gap: 12, fontSize: 15, color: '#374151', flexWrap: 'wrap' }}>
                    {p.precio !== null && <span>💰 {p.moneda ?? ''} {p.precio.toLocaleString()}</span>}
                    {p.m2 !== null && <span>📐 {p.m2} m²</span>}
                    {precioM2 !== null && <span>({p.moneda ?? ''} {precioM2.toLocaleString()}/m²)</span>}
                    {p.cuartos !== null && <span>🛏️ {p.cuartos}</span>}
                    {p.banos !== null && <span>🛁 {p.banos}</span>}
                    {p.construccion > 0 && (
                      <span style={{ color: COLOR_CONSTRUCCION }}>
                        🏗️ {p.moneda ?? ''} {p.construccion.toLocaleString()}
                      </span>
                    )}
                    {dist !== null && <span>📍 {dist} km {esPT ? 'da referência' : 'de referencia'}</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 15 }}>
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noreferrer" style={{ color: colorAcento }}>
                        {esPT ? 'Ver anúncio' : 'Ver publicación'}
                      </a>
                    )}
                    {mapaUrl && (
                      <a href={mapaUrl} target="_blank" rel="noreferrer" style={{ color: colorAcento }}>
                        {esPT ? 'Ver no Google Maps' : 'Ver en Google Maps'}
                      </a>
                    )}
                    <button
                      onClick={() => setExpandido(expandido === p.id ? null : p.id)}
                      style={{ background: 'none', border: 'none', color: colorAcento, cursor: 'pointer', padding: 0, fontSize: 15 }}
                    >
                      {expandido === p.id ? (esPT ? 'Fechar simulador' : 'Cerrar simulador') : esPT ? 'Simular financiamento' : 'Simular financiamiento'}
                    </button>
                    <button
                      onClick={() => iniciarEdicion(p)}
                      style={{ background: 'none', border: 'none', color: colorAcento, cursor: 'pointer', padding: 0, fontSize: 15 }}
                    >
                      {esPT ? 'Editar' : 'Editar'}
                    </button>
                    <button onClick={() => borrar(p.id)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: 0, fontSize: 15 }}>
                      {esPT ? 'Excluir' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              </div>

              {expandido === p.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                  {!p.precio ? (
                    <p style={{ fontSize: 15, color: '#6e7781' }}>
                      {esPT ? 'Carregue o preço da propriedade para simular.' : 'Cargá el precio de la propiedad para simular.'}
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <CampoSim
                          etiqueta={esPT ? 'Entrada (%)' : 'Entrada (%)'}
                          valor={sim.entrada}
                          onChange={(v) => actualizarSim(p.id, 'entrada', v)}
                        />
                        <CampoSim
                          etiqueta={esPT ? 'Taxa anual (%)' : 'Tasa anual (%)'}
                          valor={sim.tasa}
                          onChange={(v) => actualizarSim(p.id, 'tasa', v)}
                        />
                        <CampoSim
                          etiqueta={esPT ? 'Prazo (meses)' : 'Plazo (meses)'}
                          valor={sim.plazo}
                          onChange={(v) => actualizarSim(p.id, 'plazo', v)}
                        />
                        <CampoSim
                          etiqueta={esPT ? 'Aporte de aluguel' : 'Aporte de alquiler'}
                          valor={sim.alquiler}
                          onChange={(v) => actualizarSim(p.id, 'alquiler', v)}
                        />
                      </div>

                      {resultado && (
                        <>
                          <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: 15, flexWrap: 'wrap' }}>
                            <span>
                              {esPT ? 'Entrada' : 'Entrada'}: <strong>{p.moneda ?? ''} {resultado.entradaMonto.toLocaleString()}</strong>
                            </span>
                            <span>
                              {esPT ? 'Parcela mensal' : 'Cuota mensual'}: <strong>{p.moneda ?? ''} {resultado.cuotaMensual.toLocaleString()}</strong>
                            </span>
                            <span>
                              {esPT ? 'Total de juros' : 'Total de intereses'}: <strong>{p.moneda ?? ''} {resultado.totalIntereses.toLocaleString()}</strong>
                            </span>
                          </div>

                          {sim.alquiler > 0 && (
                            <p style={{ fontSize: 14, color: '#6e7781', marginBottom: 12 }}>
                              {esPT ? 'Como se paga essa parcela:' : 'Cómo se paga esta cuota:'}{' '}
                              <strong style={{ color: COLOR_ALQUILER }}>
                                {esPT ? 'aluguel' : 'alquiler'} {p.moneda ?? ''} {sim.alquiler.toLocaleString()}
                              </strong>
                              {' + '}
                              <strong style={{ color: colorAcento }}>
                                {etiquetaFinanciamientoArg(esPT)} {p.moneda ?? ''}{' '}
                                {(resultado.cuotaMensual - sim.alquiler).toLocaleString()}
                              </strong>
                            </p>
                          )}

                          <GraficoAmortizacion detalle={resultado.detalle} colorAcento={colorAcento} esPT={esPT} moneda={p.moneda} />
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {propuestas.length >= 2 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 15, color: '#6e7781', marginBottom: 8 }}>
            {esPT ? 'Escolha quais opções comparar:' : 'Elegí qué opciones comparar:'}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            {propuestas.map((p) => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, color: '#374151' }}>
                <input
                  type="checkbox"
                  checked={!idsExcluidosComparador.has(p.id)}
                  onChange={(e) =>
                    setIdsExcluidosComparador((actual) => {
                      const nuevo = new Set(actual);
                      if (e.target.checked) nuevo.delete(p.id);
                      else nuevo.add(p.id);
                      return nuevo;
                    })
                  }
                />
                {p.titulo || '—'}
              </label>
            ))}
          </div>
        </div>
      )}

      {propuestas.filter((p) => !idsExcluidosComparador.has(p.id)).length >= 2 && (
        <ComparadorTabla
          propuestas={propuestas.filter((p) => !idsExcluidosComparador.has(p.id))}
          esPT={esPT}
          colorAcento={colorAcento}
          parametros={parametrosComparador}
          onCambiarParametros={setParametrosComparador}
          tasasSistema={tasasSistema}
          usarCotizacionSistema={usarCotizacionSistema}
          onCambiarUsarCotizacionSistema={setUsarCotizacionSistema}
          tasasManual={tasasManual}
          onCambiarTasasManual={setTasasManual}
          tasasEfectivas={tasasEfectivas}
          ahorroActual={ahorroActual}
        />
      )}
    </div>
  );
}

// Grilla de campos de una propuesta — compartida entre "nueva
// propuesta" y "editar propuesta" para no duplicar los inputs.
function CamposPropuestaForm({
  valores,
  onChange,
  esPT,
  sugerenciaMinimaConstruccion,
}: {
  valores: DatosPropuesta;
  onChange: Dispatch<SetStateAction<DatosPropuesta>>;
  esPT: boolean;
  // Piso sugerido (no forzado) para que un terreno baldío + su
  // construcción quede parejo con la opción más cara ya construida.
  sugerenciaMinimaConstruccion: number;
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <input
          value={valores.titulo ?? ''}
          onChange={(e) => onChange((b) => ({ ...b, titulo: e.target.value }))}
          placeholder={esPT ? 'Título' : 'Título'}
          style={estilosLocales.input}
        />
        <input
          value={valores.direccion ?? ''}
          onChange={(e) => onChange((b) => ({ ...b, direccion: e.target.value }))}
          placeholder={esPT ? 'Endereço / zona' : 'Dirección / zona'}
          style={estilosLocales.input}
        />
        <input
          type="number"
          value={valores.precio ?? ''}
          onChange={(e) => onChange((b) => ({ ...b, precio: e.target.value ? Number(e.target.value) : null }))}
          placeholder={esPT ? 'Preço' : 'Precio'}
          style={estilosLocales.input}
        />
        <select
          value={valores.moneda ?? ''}
          onChange={(e) => onChange((b) => ({ ...b, moneda: e.target.value || null }))}
          style={estilosLocales.input}
        >
          <option value="">{esPT ? 'Moeda…' : 'Moneda…'}</option>
          <option value="BRL">R$ (BRL)</option>
          <option value="ARS">$ (ARS)</option>
          <option value="USD">U$S (USD)</option>
        </select>
        <input
          type="number"
          value={valores.m2 ?? ''}
          onChange={(e) => onChange((b) => ({ ...b, m2: e.target.value ? Number(e.target.value) : null }))}
          placeholder="m²"
          style={estilosLocales.input}
        />
        <input
          type="number"
          value={valores.cuartos ?? ''}
          onChange={(e) => onChange((b) => ({ ...b, cuartos: e.target.value ? Number(e.target.value) : null }))}
          placeholder={esPT ? 'Quartos' : 'Cuartos'}
          style={estilosLocales.input}
        />
        <input
          type="number"
          value={valores.banos ?? ''}
          onChange={(e) => onChange((b) => ({ ...b, banos: e.target.value ? Number(e.target.value) : null }))}
          placeholder={esPT ? 'Banheiros' : 'Baños'}
          style={estilosLocales.input}
        />
        <input
          type="number"
          value={valores.lat ?? ''}
          onChange={(e) => onChange((b) => ({ ...b, lat: e.target.value ? Number(e.target.value) : null }))}
          placeholder={esPT ? 'Latitude (opcional)' : 'Latitud (opcional)'}
          style={estilosLocales.input}
        />
        <input
          type="number"
          value={valores.lng ?? ''}
          onChange={(e) => onChange((b) => ({ ...b, lng: e.target.value ? Number(e.target.value) : null }))}
          placeholder={esPT ? 'Longitude (opcional)' : 'Longitud (opcional)'}
          style={estilosLocales.input}
        />
        <div>
          <input
            type="number"
            value={valores.construccion || ''}
            onChange={(e) => onChange((b) => ({ ...b, construccion: e.target.value ? Number(e.target.value) : 0 }))}
            placeholder={esPT ? 'Construção (0 se já é habitável)' : 'Construcción (0 si ya es habitable)'}
            style={{ ...estilosLocales.input, width: '100%' }}
          />
          {sugerenciaMinimaConstruccion > 0 && (
            <p style={{ fontSize: 12, color: COLOR_CONSTRUCCION, margin: '4px 0 0' }}>
              {esPT
                ? `Sugerido: pelo menos ${sugerenciaMinimaConstruccion.toLocaleString()} (diferença com a opção mais cara)`
                : `Sugerido: al menos ${sugerenciaMinimaConstruccion.toLocaleString()} (diferencia con la opción más cara)`}
            </p>
          )}
        </div>
      </div>

      <textarea
        value={valores.notas ?? ''}
        onChange={(e) => onChange((b) => ({ ...b, notas: e.target.value }))}
        placeholder={esPT ? 'Notas' : 'Notas'}
        style={{ ...estilosLocales.input, width: '100%', minHeight: 60, marginBottom: 12 }}
      />
    </>
  );
}

// Tabla "transpuesta": las etiquetas (Precio, Cuota mensual, etc.) van
// UNA sola vez en la columna izquierda, y cada propiedad es una
// columna con sus valores — así se lee cada fila de un vistazo en vez
// de repetir las mismas etiquetas en una tarjeta por propiedad. Con
// pocas opciones (2-3) entra sin desplazar; si en el futuro hay
// muchas más, el checklist de arriba (ver PropuestasCompra) deja
// elegir cuáles entran a esta tabla.
function TablaTranspuesta({
  columnas,
  filas,
}: {
  columnas: { id: string; titulo: string }[];
  filas: { etiqueta: string; color?: string; valores: Record<string, string> }[];
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: 8, textAlign: 'left' }} />
            {columnas.map((c) => (
              <th key={c.id} style={{ padding: 8, textAlign: 'right', color: '#1f3a5f' }}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: 8, color: '#6e7781', whiteSpace: 'nowrap' }}>{f.etiqueta}</td>
              {columnas.map((c) => (
                <td key={c.id} style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: f.color ?? '#1f2937' }}>
                  {f.valores[c.id] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampoSim({ etiqueta, valor, onChange }: { etiqueta: string; valor: number; onChange: (v: number) => void }) {
  return (
    <label style={{ fontSize: 14, color: '#6e7781', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {etiqueta}
      <input
        type="number"
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ...estilosLocales.input, width: 90 }}
      />
    </label>
  );
}

// Gráfico de composición de la cuota (capital vs. interés) a lo largo
// del préstamo — muestra cómo la parte de interés baja con el tiempo,
// que es lo que suele sorprender a quien nunca sacó un crédito
// hipotecario. Barras apiladas, una cada 12 meses para que entre en
// el ancho de una tarjeta.
// Una barra por CUOTA (no una por año) — con un plazo largo (240
// meses típico de una hipoteca) son muchas barras para entrar en el
// ancho de la pantalla, así que el gráfico se dibuja a un ancho fijo
// en píxeles (no en %) dentro de un contenedor que se desplaza para
// el costado, en vez de achicar cada barra hasta que no se distinga
// capital de interés.
function GraficoAmortizacion({
  detalle,
  colorAcento,
  esPT,
  moneda,
}: {
  detalle: { numero: number; capital: number; interes: number }[];
  colorAcento: string;
  esPT: boolean;
  moneda: string | null;
}) {
  const anchoBarra = 10;
  const espacioBarra = 4;
  const alto = 140;
  const maxCuota = Math.max(...detalle.map((p) => p.capital + p.interes));
  const anchoSvg = detalle.length * (anchoBarra + espacioBarra);
  const valorCuota = detalle[0] ? detalle[0].capital + detalle[0].interes : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6e7781', marginBottom: 6 }}>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: colorAcento, marginRight: 4, borderRadius: 2 }} />
          {esPT ? 'Capital' : 'Capital'}
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#cbd5e1', marginRight: 4, borderRadius: 2 }} />
          {esPT ? 'Juros' : 'Interés'}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          {esPT ? '← desliza para o lado →' : '← deslizá para el costado →'}
        </span>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <svg width={anchoSvg} height={alto + 22} role="img" aria-label="Composición de cada cuota, mes a mes">
          {detalle.map((p, i) => {
            const x = i * (anchoBarra + espacioBarra);
            const totalAlto = ((p.capital + p.interes) / maxCuota) * alto;
            const interesAlto = (p.interes / maxCuota) * alto;
            const capitalAlto = totalAlto - interesAlto;
            const esMarcaDeAnio = p.numero % 12 === 0 || p.numero === detalle.length;

            return (
              <g key={p.numero}>
                <rect x={x} y={alto - totalAlto} width={anchoBarra} height={interesAlto} fill="#cbd5e1" />
                <rect x={x} y={alto - capitalAlto} width={anchoBarra} height={capitalAlto} fill={colorAcento} />
                {esMarcaDeAnio && (
                  <text x={x + anchoBarra / 2} y={alto + 14} fontSize="9" textAnchor="middle" fill="#6e7781">
                    M{p.numero}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
        {esPT
          ? `Cada barra é uma parcela (${moneda ?? ''} ${valorCuota.toLocaleString()}/mês) — abaixo, quanto é capital e quanto é juros.`
          : `Cada barra es una cuota (${moneda ?? ''} ${valorCuota.toLocaleString()}/mes) — de abajo hacia arriba, cuánto es capital y cuánto interés.`}
      </p>
    </div>
  );
}

// Compara TODAS las propuestas bajo los MISMOS supuestos de
// financiamiento (una sola entrada/tasa/plazo para todas) — comparar
// cada tarjeta con su propio simulador individual no serviría para
// decidir entre ellas, porque no se sabría si una cuota más baja es
// porque la propiedad es más barata o porque alguien le puso otro
// plazo.
function ComparadorTabla({
  propuestas,
  esPT,
  colorAcento,
  parametros,
  onCambiarParametros,
  tasasSistema,
  usarCotizacionSistema,
  onCambiarUsarCotizacionSistema,
  tasasManual,
  onCambiarTasasManual,
  tasasEfectivas,
  ahorroActual,
}: {
  propuestas: SuenoPropuesta[];
  esPT: boolean;
  colorAcento: string;
  parametros: ParametrosSim;
  onCambiarParametros: Dispatch<SetStateAction<ParametrosSim>>;
  tasasSistema: TasasARS;
  usarCotizacionSistema: boolean;
  onCambiarUsarCotizacionSistema: Dispatch<SetStateAction<boolean>>;
  tasasManual: TasasARS;
  onCambiarTasasManual: Dispatch<SetStateAction<TasasARS>>;
  tasasEfectivas: TasasARS;
  ahorroActual: number | null;
}) {
  const conFinanciamiento = propuestas.map((p) => {
    // El financiamiento se calcula sobre precio + construcción — un
    // terreno baldío no se termina pagando solo con lo que cuesta
    // comprarlo, hay que sumarle lo que va a costar construirlo.
    const precioTotal = p.precio !== null ? p.precio + (p.construccion || 0) : null;

    const resultado = precioTotal
      ? calcularFinanciamiento({
          precio: precioTotal,
          entradaPorcentaje: parametros.entrada,
          tasaAnualPorcentaje: parametros.tasa,
          plazoMeses: parametros.plazo,
        })
      : null;

    const restoACargo = resultado ? resultado.cuotaMensual - parametros.alquiler : null;
    // Las propuestas cargadas antes de que existiera el selector de
    // moneda quedaron sin ese dato — se asume BRL (la moneda con la
    // que se trabaja en este proyecto) en vez de no poder convertir
    // nunca. Una propuesta nueva con moneda elegida a mano siempre usa
    // esa, no este valor por defecto.
    const restoEnPesos = restoACargo !== null ? convertirAPesos(restoACargo, p.moneda ?? 'BRL', tasasEfectivas) : null;
    const restoEnPesosPorMitad = restoEnPesos !== null ? restoEnPesos / 2 : null;

    // Cuánto falta juntar para cubrir la entrada de ESTA propiedad —
    // negativo (o cero) significa que el ahorro ya alcanza y sobra.
    const faltaParaEntrada = resultado && ahorroActual !== null ? resultado.entradaMonto - ahorroActual : null;

    return { propuesta: p, precioTotal, resultado, restoACargo, restoEnPesos, restoEnPesosPorMitad, faltaParaEntrada };
  });

  return (
    <div style={{ marginTop: 20 }}>
      {/* Título genérico a propósito ("Método de compra", no "Terreno
          Santinho vs. Casa Ingleses"): cada propiedad es una columna
          más de la tabla — si mañana aparece una tercera opción, es
          solo una columna nueva, no hay que tocar nada de este texto. */}
      <h3 style={{ color: '#1f3a5f', fontSize: 18, marginBottom: 4 }}>{esPT ? 'Método de compra' : 'Método de compra'}</h3>

      {/* Una columna por propiedad, con el nombre en la cabecera y las
          mismas etiquetas a la izquierda una sola vez (no una tarjeta
          repetida por propiedad) — para comparar de un vistazo, en vez
          de tener que recordar el dato mientras se busca la misma fila
          en otra tarjeta más abajo. */}
      <TablaTranspuesta
        columnas={propuestas.map((p) => ({ id: p.id, titulo: p.titulo || '—' }))}
        filas={[
          {
            etiqueta: esPT ? 'Preço' : 'Precio',
            valores: Object.fromEntries(propuestas.map((p) => [p.id, p.precio ? `${p.moneda ?? ''} ${p.precio.toLocaleString()}` : '—'])),
          },
          { etiqueta: 'm²', valores: Object.fromEntries(propuestas.map((p) => [p.id, p.m2?.toString() ?? '—'])) },
          {
            etiqueta: esPT ? 'Preço/m²' : 'Precio/m²',
            valores: Object.fromEntries(
              propuestas.map((p) => [p.id, p.precio && p.m2 ? `${p.moneda ?? ''} ${Math.round(p.precio / p.m2).toLocaleString()}` : '—'])
            ),
          },
          { etiqueta: esPT ? 'Quartos' : 'Cuartos', valores: Object.fromEntries(propuestas.map((p) => [p.id, p.cuartos?.toString() ?? '—'])) },
          {
            etiqueta: esPT ? 'Estado' : 'Estado',
            valores: Object.fromEntries(propuestas.map((p) => [p.id, ESTADOS_PROPUESTA.find((e) => e.valor === p.estado)?.etiqueta ?? '—'])),
          },
        ]}
      />

      <h4 style={{ color: '#1f3a5f', fontSize: 16, marginTop: 20, marginBottom: 4 }}>
        {esPT ? 'Comparar financiamento (mesmas condições para todas)' : 'Comparar financiamiento (mismas condiciones para todas)'}
      </h4>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <CampoSim
          etiqueta={esPT ? 'Entrada (%)' : 'Entrada (%)'}
          valor={parametros.entrada}
          onChange={(v) => onCambiarParametros((actual) => ({ ...actual, entrada: v }))}
        />
        <CampoSim
          etiqueta={esPT ? 'Taxa anual (%)' : 'Tasa anual (%)'}
          valor={parametros.tasa}
          onChange={(v) => onCambiarParametros((actual) => ({ ...actual, tasa: v }))}
        />
        <CampoSim
          etiqueta={esPT ? 'Prazo (meses)' : 'Plazo (meses)'}
          valor={parametros.plazo}
          onChange={(v) => onCambiarParametros((actual) => ({ ...actual, plazo: v }))}
        />
        <CampoSim
          etiqueta={esPT ? 'Aporte de aluguel' : 'Aporte de alquiler'}
          valor={parametros.alquiler}
          onChange={(v) => onCambiarParametros((actual) => ({ ...actual, alquiler: v }))}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, color: '#374151', marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={usarCotizacionSistema}
          onChange={(e) => onCambiarUsarCotizacionSistema(e.target.checked)}
        />
        {esPT ? 'Usar cotação do sistema' : 'Usar cotización del sistema'}
        {usarCotizacionSistema && tasasSistema.USD === null && tasasSistema.BRL === null && (
          <span style={{ color: '#b91c1c', fontSize: 14 }}>
            ({esPT ? 'ainda não disponível' : 'todavía no disponible'})
          </span>
        )}
      </label>

      {!usarCotizacionSistema && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <CampoSim
            etiqueta={esPT ? '1 USD = quantos ARS' : '1 USD = cuántos ARS'}
            valor={tasasManual.USD ?? 0}
            onChange={(v) => onCambiarTasasManual((actual) => ({ ...actual, USD: v }))}
          />
          <CampoSim
            etiqueta={esPT ? '1 BRL = quantos ARS' : '1 BRL = cuántos ARS'}
            valor={tasasManual.BRL ?? 0}
            onChange={(v) => onCambiarTasasManual((actual) => ({ ...actual, BRL: v }))}
          />
        </div>
      )}

      {conFinanciamiento.some((c) => c.resultado) ? (
        <>
          <p style={{ fontSize: 14, color: '#6e7781', marginBottom: 8 }}>
            {esPT
              ? 'Como se paga cada parcela: uma parte com o aluguel, o resto é o financiamento argentino (papais) — convertido a pesos com a cotação escolhida acima.'
              : 'Cómo se paga cada cuota: una parte con el alquiler, el resto es el financiamiento argentino (papis) — convertido a pesos con la cotización elegida arriba.'}
          </p>

          <TablaTranspuesta
            columnas={conFinanciamiento.map(({ propuesta: p }) => ({ id: p.id, titulo: p.titulo || '—' }))}
            filas={[
              {
                etiqueta: esPT ? 'Preço total (compra + construção)' : 'Precio total (compra + construcción)',
                color: COLOR_CONSTRUCCION,
                valores: Object.fromEntries(
                  conFinanciamiento.map(({ propuesta: p, precioTotal }) => [
                    p.id,
                    precioTotal !== null ? `${p.moneda ?? ''} ${precioTotal.toLocaleString()}` : '—',
                  ])
                ),
              },
              {
                etiqueta: esPT ? 'Entrada' : 'Entrada',
                valores: Object.fromEntries(
                  conFinanciamiento.map(({ propuesta: p, resultado: r }) => [
                    p.id,
                    r ? `${p.moneda ?? ''} ${r.entradaMonto.toLocaleString()}` : (esPT ? 'sem preço' : 'sin precio'),
                  ])
                ),
              },
              {
                etiqueta: esPT ? 'Falta para a entrada' : 'Falta para la entrada',
                color: COLOR_FALTA_AHORRO,
                valores: Object.fromEntries(
                  conFinanciamiento.map(({ propuesta: p, faltaParaEntrada }) => {
                    if (faltaParaEntrada === null) return [p.id, esPT ? 'sem poupança carregada' : 'sin ahorro cargado'];
                    if (faltaParaEntrada <= 0) {
                      return [p.id, esPT ? `alcança (sobra ${p.moneda ?? ''} ${Math.abs(faltaParaEntrada).toLocaleString()})` : `alcanza (sobra ${p.moneda ?? ''} ${Math.abs(faltaParaEntrada).toLocaleString()})`];
                    }
                    return [p.id, `${p.moneda ?? ''} ${faltaParaEntrada.toLocaleString()}`];
                  })
                ),
              },
              {
                etiqueta: esPT ? 'Parcela mensal' : 'Cuota mensual',
                valores: Object.fromEntries(
                  conFinanciamiento.map(({ propuesta: p, resultado: r }) => [p.id, r ? `${p.moneda ?? ''} ${r.cuotaMensual.toLocaleString()}` : '—'])
                ),
              },
              {
                etiqueta: esPT ? 'Total de juros' : 'Total de intereses',
                valores: Object.fromEntries(
                  conFinanciamiento.map(({ propuesta: p, resultado: r }) => [p.id, r ? `${p.moneda ?? ''} ${r.totalIntereses.toLocaleString()}` : '—'])
                ),
              },
              {
                etiqueta: esPT ? 'Aporte aluguel' : 'Aporte alquiler',
                color: COLOR_ALQUILER,
                valores: Object.fromEntries(
                  conFinanciamiento.map(({ propuesta: p, resultado: r }) => [
                    p.id,
                    r && parametros.alquiler > 0 ? `${p.moneda ?? ''} ${parametros.alquiler.toLocaleString()}` : '—',
                  ])
                ),
              },
              {
                etiqueta: etiquetaFinanciamientoArg(esPT),
                color: colorAcento,
                valores: Object.fromEntries(
                  conFinanciamiento.map(({ propuesta: p, restoACargo }) => [p.id, restoACargo !== null ? `${p.moneda ?? ''} ${restoACargo.toLocaleString()}` : '—'])
                ),
              },
              {
                etiqueta: `${etiquetaFinanciamientoArg(esPT)} en $ARS`,
                color: colorAcento,
                valores: Object.fromEntries(
                  conFinanciamiento.map(({ propuesta: p, restoEnPesos }) => [
                    p.id,
                    restoEnPesos !== null ? `$ ${restoEnPesos.toLocaleString()}` : (esPT ? 'sem cotação' : 'sin cotización'),
                  ])
                ),
              },
              {
                etiqueta: esPT ? `${etiquetaFinanciamientoArg(esPT)} em $ARS ÷ 2 (cada um)` : `${etiquetaFinanciamientoArg(esPT)} en $ARS ÷ 2 (cada uno)`,
                color: colorAcento,
                valores: Object.fromEntries(
                  conFinanciamiento.map(({ propuesta: p, restoEnPesosPorMitad }) => [
                    p.id,
                    restoEnPesosPorMitad !== null ? `$ ${restoEnPesosPorMitad.toLocaleString()}` : (esPT ? 'sem cotação' : 'sin cotización'),
                  ])
                ),
              },
            ]}
          />

          <GraficoComparacionCuotas
            datos={conFinanciamiento
              .filter((c) => c.resultado)
              .map((c) => ({ etiqueta: c.propuesta.titulo || '—', cuota: c.resultado!.cuotaMensual }))}
            colorAcento={colorAcento}
          />
        </>
      ) : (
        <p style={{ fontSize: 15, color: '#6e7781' }}>
          {esPT ? 'Carregue o preço de pelo menos uma propriedade para comparar.' : 'Cargá el precio de al menos una propiedad para comparar.'}
        </p>
      )}

      {/* A propósito SEPARADO del análisis de "Método de compra" y del
          financiamiento de arriba — esto compara un dato distinto (lo
          que cuesta construir vs. lo que ya está construido), no las
          condiciones de compra de cada opción. Mezclarlo en la misma
          tabla confundiría ambas cosas. */}
      {propuestas.some((p) => p.construccion > 0) && (
        <div style={{ marginTop: 28 }}>
          <h4 style={{ color: '#1f3a5f', fontSize: 16, marginBottom: 4 }}>{esPT ? 'Construção' : 'Construcción'}</h4>
          <p style={{ fontSize: 12, color: '#6e7781', marginBottom: 8 }}>
            {esPT
              ? 'O que já está construído em cada opção vs. o que falta investir para construir.'
              : 'Lo que ya está construido en cada opción vs. lo que falta invertir para construir.'}
          </p>
          <TablaTranspuesta
            columnas={propuestas.map((p) => ({ id: p.id, titulo: p.titulo || '—' }))}
            filas={[
              {
                etiqueta: esPT ? 'Construção' : 'Construcción',
                color: COLOR_CONSTRUCCION,
                valores: Object.fromEntries(
                  propuestas.map((p) => [p.id, `${p.moneda ?? ''} ${p.construccion.toLocaleString()}`])
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// Barras horizontales con la cuota mensual de cada propuesta, bajo las
// mismas condiciones de financiamiento — la forma más directa de ver
// cuál sale más cara por mes.
function GraficoComparacionCuotas({
  datos,
  colorAcento,
}: {
  datos: { etiqueta: string; cuota: number }[];
  colorAcento: string;
}) {
  const maxCuota = Math.max(...datos.map((d) => d.cuota));
  const alto = datos.length * 32 + 8;
  const anchoDisponible = 100; // porcentaje

  return (
    <svg width="100%" viewBox={`0 0 320 ${alto}`} role="img" aria-label="Comparación de cuota mensual entre propiedades">
      {datos.map((d, i) => {
        const y = i * 32;
        const anchoBarra = maxCuota > 0 ? (d.cuota / maxCuota) * anchoDisponible * 1.6 : 0;

        return (
          <g key={d.etiqueta + i}>
            <text x={0} y={y + 10} fontSize="11" fill="#374151">
              {d.etiqueta.length > 22 ? `${d.etiqueta.slice(0, 22)}…` : d.etiqueta}
            </text>
            <rect x={0} y={y + 14} width={Math.max(2, anchoBarra)} height={12} fill={colorAcento} rx={2} />
            <text x={Math.max(2, anchoBarra) + 6} y={y + 24} fontSize="10" fill="#6e7781">
              {d.cuota.toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const estilosLocales = {
  formulario: {
    background: '#f8fafc',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  tarjetaPropuesta: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 14,
  },
  input: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 16,
  },
  botonPrincipal: (color: string) => ({
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  }),
  botonSecundario: (color: string) => ({
    background: '#fff',
    color,
    border: `1px solid ${color}`,
    borderRadius: 8,
    padding: '8px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 15,
  }),
} as const;
