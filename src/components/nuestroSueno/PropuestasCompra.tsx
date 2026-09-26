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
import { calcularFinanciamiento, distanciaKm, urlGoogleMaps, type ResultadoFinanciamiento } from '@/lib/simuladorCompra';

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
};

type ParametrosSim = { entrada: number; tasa: number; plazo: number };
const SIM_DEFAULT: ParametrosSim = { entrada: 20, tasa: 12, plazo: 240 };

export function PropuestasCompra({
  parejaId,
  perfilId,
  esPT,
  colorAcento,
}: {
  parejaId: string;
  perfilId: string;
  esPT: boolean;
  colorAcento: string;
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

  async function cargar() {
    const datos = await listarPropuestas(parejaId);
    setPropuestas(datos);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parejaId]);

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

  if (cargando) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ margin: 0, color: '#6e7781', fontSize: 13 }}>
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

          {errorExtraccion && <p style={{ color: '#b91c1c', fontSize: 13 }}>{errorExtraccion}</p>}

          <CamposPropuestaForm valores={borrador} onChange={setBorrador} esPT={esPT} />

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

                {errorExtraccionEdicion && <p style={{ color: '#b91c1c', fontSize: 13 }}>{errorExtraccionEdicion}</p>}

                <CamposPropuestaForm valores={borradorEdicion} onChange={setBorradorEdicion} esPT={esPT} />

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
                      style={{ fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db' }}
                    >
                      {ESTADOS_PROPUESTA.map((e) => (
                        <option key={e.valor} value={e.valor}>
                          {e.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>

                  {p.direccion && <p style={{ margin: '4px 0', fontSize: 13, color: '#6e7781' }}>{p.direccion}</p>}

                  <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#374151', flexWrap: 'wrap' }}>
                    {p.precio !== null && <span>💰 {p.moneda ?? ''} {p.precio.toLocaleString()}</span>}
                    {p.m2 !== null && <span>📐 {p.m2} m²</span>}
                    {precioM2 !== null && <span>({p.moneda ?? ''} {precioM2.toLocaleString()}/m²)</span>}
                    {p.cuartos !== null && <span>🛏️ {p.cuartos}</span>}
                    {p.banos !== null && <span>🛁 {p.banos}</span>}
                    {dist !== null && <span>📍 {dist} km {esPT ? 'da referência' : 'de referencia'}</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13 }}>
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
                      style={{ background: 'none', border: 'none', color: colorAcento, cursor: 'pointer', padding: 0, fontSize: 13 }}
                    >
                      {expandido === p.id ? (esPT ? 'Fechar simulador' : 'Cerrar simulador') : esPT ? 'Simular financiamento' : 'Simular financiamiento'}
                    </button>
                    <button
                      onClick={() => iniciarEdicion(p)}
                      style={{ background: 'none', border: 'none', color: colorAcento, cursor: 'pointer', padding: 0, fontSize: 13 }}
                    >
                      {esPT ? 'Editar' : 'Editar'}
                    </button>
                    <button onClick={() => borrar(p.id)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: 0, fontSize: 13 }}>
                      {esPT ? 'Excluir' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              </div>

              {expandido === p.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                  {!p.precio ? (
                    <p style={{ fontSize: 13, color: '#6e7781' }}>
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
                      </div>

                      {resultado && (
                        <>
                          <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: 13 }}>
                            <span>
                              {esPT ? 'Entrada' : 'Entrada'}: <strong>{p.moneda ?? ''} {resultado.entradaMonto.toLocaleString()}</strong>
                            </span>
                            <span>
                              {esPT ? 'Parcela mensal' : 'Cuota mensual'}: <strong style={{ color: colorAcento }}>{p.moneda ?? ''} {resultado.cuotaMensual.toLocaleString()}</strong>
                            </span>
                            <span>
                              {esPT ? 'Total de juros' : 'Total de intereses'}: <strong>{p.moneda ?? ''} {resultado.totalIntereses.toLocaleString()}</strong>
                            </span>
                          </div>

                          <GraficoAmortizacion detalle={resultado.detalle} colorAcento={colorAcento} />
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

      {propuestas.length >= 2 && <ComparadorTabla propuestas={propuestas} esPT={esPT} />}
    </div>
  );
}

// Grilla de campos de una propuesta — compartida entre "nueva
// propuesta" y "editar propuesta" para no duplicar los inputs.
function CamposPropuestaForm({
  valores,
  onChange,
  esPT,
}: {
  valores: DatosPropuesta;
  onChange: Dispatch<SetStateAction<DatosPropuesta>>;
  esPT: boolean;
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

function CampoSim({ etiqueta, valor, onChange }: { etiqueta: string; valor: number; onChange: (v: number) => void }) {
  return (
    <label style={{ fontSize: 12, color: '#6e7781', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
function GraficoAmortizacion({
  detalle,
  colorAcento,
}: {
  detalle: { numero: number; capital: number; interes: number }[];
  colorAcento: string;
}) {
  const puntos = detalle.filter((_, i) => i % 12 === 0 || i === detalle.length - 1);
  const maxCuota = Math.max(...puntos.map((p) => p.capital + p.interes));
  const ancho = 320;
  const alto = 120;
  const anchoBarra = Math.min(28, ancho / puntos.length - 6);

  return (
    <svg width="100%" viewBox={`0 0 ${ancho} ${alto + 20}`} role="img" aria-label="Composición de la cuota a lo largo del tiempo">
      {puntos.map((p, i) => {
        const x = i * (ancho / puntos.length) + 4;
        const totalAlto = (( p.capital + p.interes) / maxCuota) * alto;
        const interesAlto = (p.interes / maxCuota) * alto;
        const capitalAlto = totalAlto - interesAlto;

        return (
          <g key={p.numero}>
            <rect x={x} y={alto - totalAlto} width={anchoBarra} height={interesAlto} fill="#cbd5e1" />
            <rect x={x} y={alto - capitalAlto} width={anchoBarra} height={capitalAlto} fill={colorAcento} />
            <text x={x + anchoBarra / 2} y={alto + 14} fontSize="9" textAnchor="middle" fill="#6e7781">
              {esNumeroDeAnio(p.numero)}
            </text>
          </g>
        );
      })}
      <text x={0} y={0} fontSize="0" />
    </svg>
  );
}

function esNumeroDeAnio(numeroMes: number): string {
  const anio = Math.ceil(numeroMes / 12);
  return `A${anio}`;
}

function ComparadorTabla({ propuestas, esPT }: { propuestas: SuenoPropuesta[]; esPT: boolean }) {
  return (
    <div style={{ marginTop: 20, overflowX: 'auto' }}>
      <h3 style={{ color: '#1f3a5f', fontSize: 16 }}>{esPT ? 'Comparador' : 'Comparador'}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: 6 }}>{esPT ? 'Título' : 'Título'}</th>
            <th style={{ padding: 6 }}>{esPT ? 'Preço' : 'Precio'}</th>
            <th style={{ padding: 6 }}>m²</th>
            <th style={{ padding: 6 }}>{esPT ? 'Preço/m²' : 'Precio/m²'}</th>
            <th style={{ padding: 6 }}>{esPT ? 'Quartos' : 'Cuartos'}</th>
            <th style={{ padding: 6 }}>{esPT ? 'Estado' : 'Estado'}</th>
          </tr>
        </thead>
        <tbody>
          {propuestas.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: 6 }}>{p.titulo || '—'}</td>
              <td style={{ padding: 6 }}>{p.precio ? `${p.moneda ?? ''} ${p.precio.toLocaleString()}` : '—'}</td>
              <td style={{ padding: 6 }}>{p.m2 ?? '—'}</td>
              <td style={{ padding: 6 }}>{p.precio && p.m2 ? Math.round(p.precio / p.m2).toLocaleString() : '—'}</td>
              <td style={{ padding: 6 }}>{p.cuartos ?? '—'}</td>
              <td style={{ padding: 6 }}>{ESTADOS_PROPUESTA.find((e) => e.valor === p.estado)?.etiqueta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    fontSize: 14,
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
    fontSize: 13,
  }),
} as const;
