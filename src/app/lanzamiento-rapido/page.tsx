'use client';

// LANZAMIENTO RÁPIDO
//
// Nuevo método de carga de operaciones: las 10 combinaciones (operación +
// categoría + medio) más repetidas de los últimos 60 días, como tarjetas. Se
// toca una, se ajusta valor y fecha y se registra con el motor de siempre.
// Disponible para todas las empresas (nació como piloto de Buenaventura).

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { SABIO_SURFISTA_URL } from '@/lib/lanzamientoRapidoEmpresas';
import { simboloMoneda, formatearNumeroEntero } from '@/lib/moneda';
import { fechaLocalHoy } from '@/lib/fecha';
import { nombreOperacionDisplay } from '@/lib/i18n';
import { contarJugadasHoy } from '@/lib/miniJuego';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { SabioWidget } from '@/components/panel/SabioWidget';
import { montoSospechoso, parsearMonto, validarMonto, type TarjetaRapida } from '@/lib/lanzamientoRapido';
import {
  cargarTarjetas,
  registrarLanzamiento,
  deshacerLanzamiento,
  agregarFavorita,
  quitarFavorita,
  leerCache,
  guardarCache,
  invalidarCache,
  type MetaEmpresa,
} from '@/lib/lanzamientoRapidoDatos';
import { OPERACIONES_RAPIDAS, parsearMonto as parsearMontoFav } from '@/lib/lanzamientoRapido';
import { obtenerCategoriasJuego } from '@/lib/miniJuego';
import { obtenerFormasPagoOperacion } from '@/lib/formasPagoOperacion';

const COLORES = {
  azul: 'var(--color-primario, #1f3a5f)',
  verde: 'var(--color-secundario, #2e8b57)',
  gris: '#6e7781',
  blanco: '#ffffff',
};

const ESTILO_OPERACION: Record<string, { emoji: string; color: string; fondo: string }> = {
  COBRO: { emoji: '💰', color: '#15803d', fondo: '#f0fdf4' },
  PAGO: { emoji: '💸', color: '#b45309', fondo: '#fffbeb' },
  TRANSFERENCIA: { emoji: '🔁', color: '#1d4ed8', fondo: '#eff6ff' },
  INVERSION: { emoji: '🌱', color: '#6d28d9', fondo: '#f5f3ff' },
  EXTRACCION: { emoji: '🏧', color: '#be123c', fondo: '#fff1f2' },
};

const FRASES_OK = {
  ES: ['Registrado. Sigamos surfeando.', '¡Esa ola ya está cargada!', 'Listo, socio. Siguiente ola.'],
  PT: ['Registrado. Vamos continuar surfando.', 'Essa onda já está carregada!', 'Pronto, sócio. Próxima onda.'],
};
const SEGUNDOS_DESHACER = 8;

export default function LanzamientoRapidoPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [meta, setMeta] = useState<MetaEmpresa>({ moneda: null, idioma: 'ES', esFamiliar: false });
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tarjetas, setTarjetas] = useState<TarjetaRapida[]>([]);

  const [abierta, setAbierta] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [errorTarjeta, setErrorTarjeta] = useState('');
  const [confirmarGrande, setConfirmarGrande] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [frase, setFrase] = useState<string | null>(null);
  const [vanHoy, setVanHoy] = useState<number | null>(null);
  const [ultimo, setUltimo] = useState<{ id: string; resumen: string } | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const esPT = meta.idioma === 'PT';
  const tr = (es: string, pt: string) => (esPT ? pt : es);
  const simbolo = simboloMoneda(meta.moneda);

  async function refrescar(empresa: string, metaActual: MetaEmpresa) {
    const [lista, hoy] = await Promise.all([
      cargarTarjetas(empresa),
      contarJugadasHoy(empresa).catch(() => null),
    ]);
    setTarjetas(lista);
    setVanHoy(hoy);
    guardarCache(empresa, lista, metaActual);
  }

  useEffect(() => {
    async function iniciar() {
      // getSession lee la sesión local (getUser sería otra ida y vuelta a la red).
      const { data: sesion } = await supabase.auth.getSession();
      const userId = sesion.session?.user.id;

      if (!userId) {
        router.push('/login');
        return;
      }

      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', userId).maybeSingle();

      if (!perfil?.empresa_id) {
        setAutorizado(false);
        setCargando(false);
        return;
      }

      setAutorizado(true);
      setEmpresaId(perfil.empresa_id);

      const cache = leerCache(perfil.empresa_id);
      if (cache) {
        setTarjetas(cache.tarjetas);
        setMeta(cache.meta);
        setCargando(false);
        contarJugadasHoy(perfil.empresa_id).then(setVanHoy).catch(() => null);
        if (cache.fresco) return;
      }

      try {
        const { data: empresa } = await supabase
          .from('empresas')
          .select('moneda, idioma, perfiles_empresa(codigo)')
          .eq('id', perfil.empresa_id)
          .maybeSingle();
        const relacion = empresa?.perfiles_empresa as { codigo: string }[] | { codigo: string } | null | undefined;
        const codigo = Array.isArray(relacion) ? relacion[0]?.codigo : relacion?.codigo;
        const metaNueva: MetaEmpresa = {
          moneda: empresa?.moneda ?? null,
          idioma: empresa?.idioma ?? 'ES',
          esFamiliar: codigo === 'FAMILIAR',
        };
        setMeta(metaNueva);
        await refrescar(perfil.empresa_id, metaNueva);
      } catch (e) {
        setError((e as { message?: string }).message ?? tr('No se pudieron cargar las tarjetas.', 'Não foi possível carregar os cartões.'));
      }

      setCargando(false);
    }

    iniciar();
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function alternarFavorita(t: TarjetaRapida) {
    if (!empresaId) return;
    setError('');
    // Se refleja al toque; si falla se recarga el estado real.
    setTarjetas((prev) => prev.map((x) => (x.clave === t.clave ? { ...x, favorita: !t.favorita } : x)));

    try {
      if (t.favorita) await quitarFavorita(empresaId, t);
      else
        await agregarFavorita(empresaId, {
          operacion: t.operacion,
          categoria: t.categoria,
          forma_pago: t.formaPago,
          historico: t.ultimoHistorico,
          cliente_proveedor: t.ultimoProveedor,
          valor_sugerido: t.ultimoValor,
        });
      await refrescar(empresaId, meta);
    } catch (e) {
      setError((e as { message?: string }).message ?? tr('No se pudo guardar la favorita.', 'Não foi possível salvar o favorito.'));
      await refrescar(empresaId, meta).catch(() => null);
    }
  }

  async function guardarNuevaFavorita(f: { operacion: string; categoria: string; formaPago: string; valor: string }) {
    if (!empresaId) return;
    await agregarFavorita(empresaId, {
      operacion: f.operacion,
      categoria: f.categoria,
      forma_pago: f.formaPago,
      historico: f.categoria,
      cliente_proveedor: '',
      valor_sugerido: Number.isFinite(parsearMontoFav(f.valor)) ? Math.max(0, parsearMontoFav(f.valor)) : 0,
    });
    await refrescar(empresaId, meta);
  }

  function abrirTarjeta(t: TarjetaRapida) {
    if (abierta === t.clave) {
      setAbierta(null);
      return;
    }
    setAbierta(t.clave);
    setValor(String(t.ultimoValor).replace('.', ','));
    setFecha(fechaLocalHoy());
    setErrorTarjeta('');
    setConfirmarGrande(false);
  }

  async function registrar(t: TarjetaRapida) {
    if (!empresaId) return;

    const monto = parsearMonto(valor);
    const problema = validarMonto(monto, esPT);
    if (problema) {
      setErrorTarjeta(problema);
      return;
    }
    if (!fecha) {
      setErrorTarjeta(tr('Elegí la fecha.', 'Escolha a data.'));
      return;
    }
    if (!confirmarGrande && montoSospechoso(monto, t)) {
      setConfirmarGrande(true);
      return;
    }

    setGuardando(true);
    setErrorTarjeta('');

    try {
      const id = await registrarLanzamiento(empresaId, t, monto, fecha);
      invalidarCache(empresaId);
      const resumen = `${nombreOperacionDisplay(meta.idioma, t.operacion, meta.esFamiliar)} · ${t.categoria} · ${simbolo} ${formatearNumeroEntero(monto)}`;

      setUltimo({ id, resumen });
      setAbierta(null);
      setConfirmarGrande(false);
      const frasesOk = FRASES_OK[esPT ? 'PT' : 'ES'];
      setFrase(frasesOk[Math.floor(Math.random() * frasesOk.length)]);
      setVanHoy(await contarJugadasHoy(empresaId).catch(() => null));

      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setUltimo(null), SEGUNDOS_DESHACER * 1000);
    } catch (e) {
      setErrorTarjeta((e as { message?: string }).message ?? tr('No se pudo registrar.', 'Não foi possível registrar.'));
    }

    setGuardando(false);
  }

  async function deshacer() {
    if (!empresaId || !ultimo) return;
    const { id } = ultimo;

    if (temporizador.current) clearTimeout(temporizador.current);
    setUltimo(null);

    try {
      await deshacerLanzamiento(empresaId, id);
      invalidarCache(empresaId);
      setFrase(tr('Deshecho. Esa ola no cuenta.', 'Desfeito. Essa onda não conta.'));
      setVanHoy(await contarJugadasHoy(empresaId).catch(() => null));
    } catch (e) {
      setError((e as { message?: string }).message ?? tr('No se pudo deshacer.', 'Não foi possível desfazer.'));
    }
  }

  const fondo: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--fondo-app, linear-gradient(180deg, #f5f7f9 0%, #eaf0f6 100%))',
    padding: '24px 16px 48px',
  };

  if (cargando) {
    return (
      <div style={{ ...fondo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: COLORES.gris }}>{tr('Cargando...', 'Carregando...')}</p>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div style={{ ...fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: COLORES.gris }}>{tr('No pudimos abrir esta herramienta.', 'Não conseguimos abrir esta ferramenta.')}</p>
        <Link href="/" style={{ color: COLORES.azul }}>{tr('← Volver', '← Voltar')}</Link>
      </div>
    );
  }

  return (
    <div style={fondo}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header
          style={{
            background: `linear-gradient(125deg, ${COLORES.azul} 0%, ${COLORES.azul} 58%, ${COLORES.verde} 100%)`,
            color: COLORES.blanco,
            borderRadius: 28,
            padding: '26px 28px',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <Link href="/" style={{ color: '#dbe5ef', fontSize: 13, textDecoration: 'none' }}>{tr('← Volver al lobby', '← Voltar ao lobby')}</Link>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, opacity: 0.75, margin: '10px 0 6px' }}>{tr('CARGA EN UN TOQUE', 'REGISTRO EM UM TOQUE')}</div>
              <h1 style={{ margin: 0, fontSize: 30 }}>{tr('Lanzamiento rápido', 'Lançamento rápido')}</h1>
              <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
                {tr('Tus operaciones de siempre. Tocá una, poné el valor y listo.', 'Suas operações de sempre. Toque em uma, coloque o valor e pronto.')}
              </p>
              {vanHoy !== null && vanHoy > 0 && (
                <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 700 }}>🔥 {tr(`Van ${vanHoy} hoy`, `Já são ${vanHoy} hoje`)}</p>
              )}
            </div>
            <SabioWidget colores={{ azul: '#1f3a5f', verde: '#2e8b57', blanco: '#ffffff' }} frase={frase ?? tr('¡Ola del día lista, socio!', 'Onda do dia pronta, sócio!')} imagenUrl={SABIO_SURFISTA_URL} />
            <AccesosHerramientas variante="oscuro" />
          </div>
        </header>

        {error && (
          <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 16, background: '#fef2f2', padding: '10px 14px', borderRadius: 10 }}>
            {error}
          </p>
        )}

        {ultimo && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              background: '#ecfdf5',
              border: '1px solid #86efac',
              borderRadius: 14,
              padding: '10px 16px',
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            <span>✅ {ultimo.resumen}</span>
            <button
              type="button"
              onClick={deshacer}
              style={{ border: '1px solid #15803d', background: '#fff', color: '#15803d', borderRadius: 10, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}
            >
              {tr('Deshacer', 'Desfazer')}
            </button>
          </div>
        )}

        {tarjetas.length === 0 && !error && (
          <p style={{ color: COLORES.gris, textAlign: 'center', padding: 24 }}>
            {tr('Todavía no hay operaciones repetidas en los últimos 60 días. Cargá algunas y acá van a aparecer, o sumá una favorita con el +.', 'Ainda não há operações repetidas nos últimos 60 dias. Registre algumas e elas aparecerão aqui, ou adicione um favorito com o +.')}
          </p>
        )}
        <div className="lanzamiento-rapido-grilla">
            {tarjetas.map((t) => {
              const estilo = ESTILO_OPERACION[t.operacion] ?? ESTILO_OPERACION.PAGO;
              const esAbierta = abierta === t.clave;

              return (
                <div
                  key={t.clave}
                  style={{
                    background: estilo.fondo,
                    border: `2px solid ${esAbierta ? estilo.color : 'transparent'}`,
                    borderRadius: 20,
                    padding: 14,
                    boxShadow: '0 6px 16px rgba(31,58,95,0.08)',
                    gridColumn: esAbierta ? '1 / -1' : undefined,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => alternarFavorita(t)}
                    aria-label={t.favorita ? tr('Quitar de favoritas', 'Remover dos favoritos') : tr('Marcar como favorita', 'Marcar como favorito')}
                    title={t.favorita ? tr('Quitar de favoritas', 'Remover dos favoritos') : tr('Marcar como favorita', 'Marcar como favorito')}
                    style={{ float: 'right', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}
                  >
                    {t.favorita ? '❤️' : '🤍'}
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirTarjeta(t)}
                    style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                  >
                    <div style={{ fontSize: 28 }}>{estilo.emoji}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: estilo.color, marginTop: 4 }}>
                      {nombreOperacionDisplay(meta.idioma, t.operacion, meta.esFamiliar)}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1f2937', margin: '2px 0' }}>{t.categoria}</div>
                    <div style={{ fontSize: 12, color: COLORES.gris }}>{t.formaPago}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: estilo.color, marginTop: 8 }}>
                      {t.ultimoValor > 0 ? `${simbolo} ${formatearNumeroEntero(t.ultimoValor)}` : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: COLORES.gris }}>{t.usos > 0 ? `${t.usos} ${t.usos === 1 ? tr('uso', 'uso') : tr('usos', 'usos')}` : tr('sin usos recientes', 'sem usos recentes')}</div>
                  </button>

                  {esAbierta && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(t.ultimoHistorico || t.ultimoProveedor) && (
                        <div style={{ fontSize: 12, color: COLORES.gris }}>
                          {[t.ultimoHistorico, t.ultimoProveedor].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700, color: COLORES.gris }}>
                          {tr('Valor', 'Valor')}
                          <input
                            type="text"
                            inputMode="decimal"
                            value={valor}
                            onChange={(e) => {
                              setValor(e.target.value);
                              setConfirmarGrande(false);
                            }}
                            autoFocus
                            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16 }}
                          />
                        </label>
                        <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700, color: COLORES.gris }}>
                          {tr('Fecha', 'Data')}
                          <input
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16 }}
                          />
                        </label>
                      </div>

                      {confirmarGrande && (
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#b45309' }}>
                          {tr('¿Seguro, socio? Es mucho más de lo habitual', 'Certeza, sócio? É muito mais que o habitual')} ({tr('lo normal ronda', 'o normal gira em torno de')} {simbolo} {formatearNumeroEntero(t.mediana)}). {tr('Tocá otra vez para confirmar.', 'Toque novamente para confirmar.')}
                        </p>
                      )}
                      {errorTarjeta && <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{errorTarjeta}</p>}

                      <button
                        type="button"
                        onClick={() => registrar(t)}
                        disabled={guardando}
                        style={{ background: estilo.color, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px', fontWeight: 800, fontSize: 15, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.7 : 1 }}
                      >
                        {guardando ? tr('Registrando...', 'Registrando...') : confirmarGrande ? tr('Sí, registrar', 'Sim, registrar') : tr('Registrar', 'Registrar')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <TarjetaMas empresaId={empresaId} idioma={meta.idioma} esFamiliar={meta.esFamiliar} onGuardar={guardarNuevaFavorita} />
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link href="/?jugar=1" style={{ color: COLORES.azul, fontWeight: 700, fontSize: 14 }}>
            {tr('Ver todas las operaciones →', 'Ver todas as operações →')}
          </Link>
        </div>
      </div>

      <style>{`
        .lanzamiento-rapido-grilla {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }
        @media (max-width: 900px) {
          .lanzamiento-rapido-grilla { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 560px) {
          .lanzamiento-rapido-grilla { grid-template-columns: repeat(2, 1fr); gap: 10px; }
        }
      `}</style>
    </div>
  );
}


// "+" para sumar una favorita a mano: operación → categoría → medio (+ valor
// sugerido opcional). Las opciones salen de la matriz, así que solo se pueden
// elegir combinaciones que el motor acepta.
function TarjetaMas({
  empresaId,
  idioma,
  esFamiliar,
  onGuardar,
}: {
  empresaId: string | null;
  idioma: string;
  esFamiliar: boolean;
  onGuardar: (f: { operacion: string; categoria: string; formaPago: string; valor: string }) => Promise<void>;
}) {
  const esPT = idioma === 'PT';
  const tr = (es: string, pt: string) => (esPT ? pt : es);
  const [abierta, setAbierta] = useState(false);
  const [operacion, setOperacion] = useState('');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoria, setCategoria] = useState('');
  const [medios, setMedios] = useState<string[]>([]);
  const [medio, setMedio] = useState('');
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function cerrar() {
    setAbierta(false);
    setOperacion('');
    setCategorias([]);
    setCategoria('');
    setMedios([]);
    setMedio('');
    setValor('');
    setError('');
  }

  async function elegirOperacion(op: string) {
    if (!empresaId) return;
    setOperacion(op);
    setCategoria('');
    setMedio('');
    setMedios([]);
    setError('');
    try {
      setCategorias((await obtenerCategoriasJuego(empresaId, op)).map((c) => c.nombre));
    } catch (e) {
      setError((e as { message?: string }).message ?? tr('No se pudieron cargar las categorías.', 'Não foi possível carregar as categorias.'));
    }
  }

  async function elegirCategoria(cat: string) {
    if (!empresaId) return;
    setCategoria(cat);
    setMedio('');
    setError('');
    try {
      setMedios(await obtenerFormasPagoOperacion(empresaId, operacion, cat));
    } catch (e) {
      setError((e as { message?: string }).message ?? tr('No se pudieron cargar los medios.', 'Não foi possível carregar os meios.'));
    }
  }

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      await onGuardar({ operacion, categoria, formaPago: medio, valor });
      cerrar();
    } catch (e) {
      setError((e as { message?: string }).message ?? tr('No se pudo guardar.', 'Não foi possível salvar.'));
    }
    setGuardando(false);
  }

  const chip = (activo: boolean): React.CSSProperties => ({
    border: `1px solid ${activo ? '#1f3a5f' : '#d1d5db'}`,
    background: activo ? '#1f3a5f' : '#fff',
    color: activo ? '#fff' : '#1f2937',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  });

  if (!abierta) {
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        style={{
          border: '2px dashed #9ca3af',
          background: 'transparent',
          borderRadius: 20,
          minHeight: 150,
          cursor: 'pointer',
          color: '#6e7781',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 36, lineHeight: 1 }}>+</span>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{tr('Agregar favorita ❤️', 'Adicionar favorito ❤️')}</span>
      </button>
    );
  }

  return (
    <div style={{ gridColumn: '1 / -1', background: '#fff', border: '2px solid #1f3a5f', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <strong style={{ fontSize: 15 }}>{tr('Nueva favorita ❤️', 'Novo favorito ❤️')}</strong>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {OPERACIONES_RAPIDAS.map((op) => (
          <button key={op} type="button" onClick={() => elegirOperacion(op)} style={chip(operacion === op)}>
            {nombreOperacionDisplay(idioma, op, esFamiliar)}
          </button>
        ))}
      </div>

      {categorias.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {categorias.map((c) => (
            <button key={c} type="button" onClick={() => elegirCategoria(c)} style={chip(categoria === c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {medios.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {medios.map((m) => (
            <button key={m} type="button" onClick={() => setMedio(m)} style={chip(medio === m)}>
              {m}
            </button>
          ))}
        </div>
      )}

      {medio && (
        <label style={{ fontSize: 12, fontWeight: 700, color: '#6e7781' }}>
          {tr('Valor habitual (opcional)', 'Valor habitual (opcional)')}
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            style={{ display: 'block', width: '100%', maxWidth: 220, boxSizing: 'border-box', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16 }}
          />
        </label>
      )}

      {error && <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={guardar}
          disabled={!medio || guardando}
          style={{ background: '#1f3a5f', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 18px', fontWeight: 800, cursor: !medio || guardando ? 'not-allowed' : 'pointer', opacity: !medio || guardando ? 0.5 : 1 }}
        >
          {guardando ? tr('Guardando...', 'Salvando...') : tr('Guardar favorita', 'Salvar favorito')}
        </button>
        <button type="button" onClick={cerrar} style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: 12, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
          {tr('Cancelar', 'Cancelar')}
        </button>
      </div>
    </div>
  );
}
