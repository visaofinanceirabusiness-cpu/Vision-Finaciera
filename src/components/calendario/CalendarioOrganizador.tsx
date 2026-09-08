'use client';
// CALENDÁRIO ORGANIZADOR — vive directo en el lobby (no es una
// "herramienta" con acceso aparte). A ancho completo del contenedor
// del lobby. Cualquier usuario de la empresa puede crear, editar o
// borrar eventos y anotações del mes.

import { useEffect, useState } from 'react';
import {
  CATEGORIAS_EVENTO,
  type AnotacionCalendario,
  type CategoriaEvento,
  type EventoCalendario,
  actualizarEvento,
  alternarAnotacion,
  crearAnotacion,
  crearEvento,
  eliminarAnotacion,
  eliminarEvento,
  listarAnotacionesDelMes,
  listarEventosDelMes,
  nombreCategoria,
} from '@/lib/calendario';
import { ModalEvento } from './ModalEvento';
import { fechasEspecialesDelPais, iconoFechaEspecial, mapaFechasEspeciales, paisPorMoneda } from '@/lib/fechasEspeciales';

type Colores = { azul: string; verde: string; acento: string; blanco: string };

const CLAVE_FECHAS_ESPECIALES = 'vf_calendario_fechas_especiales';

const DIAS_SEMANA_ES = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
const DIAS_SEMANA_PT = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO'];
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CLAVE_COLAPSO = 'vf_calendario_referencias_colapsadas';

// Paleta pastel tipo "papelitos adhesivos" — rota por índice, sin
// relación con las categorías de eventos (son cosas distintas).
const COLORES_PAPELETA = ['#fef3c7', '#fce7f3', '#dbeafe', '#dcfce7', '#ede9fe', '#ffe4e6', '#fff7d6'];

function aFechaLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function generarGrilla(mesReferencia: Date): { fecha: string; delMes: boolean }[] {
  const primerDia = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1);
  // JS: domingo=0..sábado=6. El mockup arranca en lunes → se convierte.
  const offsetLunes = (primerDia.getDay() + 6) % 7;

  const inicio = new Date(primerDia);
  inicio.setDate(inicio.getDate() - offsetLunes);

  const celdas: { fecha: string; delMes: boolean }[] = [];
  const cursor = new Date(inicio);

  for (let i = 0; i < 42; i++) {
    celdas.push({ fecha: aFechaLocal(cursor), delMes: cursor.getMonth() === mesReferencia.getMonth() });
    cursor.setDate(cursor.getDate() + 1);
  }

  // No mostrar la última semana si es enteramente del mes siguiente.
  while (celdas.length > 35 && celdas.slice(-7).every((c) => !c.delMes)) {
    celdas.splice(celdas.length - 7, 7);
  }

  return celdas;
}

export function CalendarioOrganizador({
  empresaId,
  usuarioId,
  idioma,
  colores,
  logoUrl,
  moneda,
}: {
  empresaId: string;
  usuarioId: string;
  idioma: string;
  colores: Colores;
  // Marca de agua del calendario y país para las fechas especiales —
  // ambos opcionales para no romper si algún caller viejo no los pasa.
  logoUrl?: string | null;
  moneda?: string | null;
}) {
  const esPT = idioma === 'PT';
  const meses = esPT ? MESES_PT : MESES_ES;
  const diasSemana = esPT ? DIAS_SEMANA_PT : DIAS_SEMANA_ES;
  const hoy = new Date();
  const fechasEspeciales = mapaFechasEspeciales(paisPorMoneda(moneda));

  const [fechasEspecialesVisibles, setFechasEspecialesVisibles] = useState(true);

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_FECHAS_ESPECIALES);
      if (guardado !== null) setFechasEspecialesVisibles(guardado === '1');
    } catch {
      // localStorage puede fallar en algunos navegadores/modo privado — no es crítico.
    }
  }, []);

  function alternarFechasEspeciales() {
    setFechasEspecialesVisibles((prev) => {
      const nuevo = !prev;
      try {
        window.localStorage.setItem(CLAVE_FECHAS_ESPECIALES, nuevo ? '1' : '0');
      } catch {
        // Ignorado a propósito.
      }
      return nuevo;
    });
  }

  const [mesReferencia, setMesReferencia] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [anotaciones, setAnotaciones] = useState<AnotacionCalendario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [referenciasAbiertas, setReferenciasAbiertas] = useState(true);
  const [notasAbiertas, setNotasAbiertas] = useState(true);

  const [modal, setModal] = useState<{ evento: EventoCalendario | null; fecha: string } | null>(null);
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);
  const [nuevaAnotacion, setNuevaAnotacion] = useState('');

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_COLAPSO);
      if (guardado !== null) setReferenciasAbiertas(guardado === '1');
    } catch {
      // localStorage puede fallar en algunos navegadores/modo privado — no es crítico.
    }
  }, []);

  function alternarReferencias() {
    setReferenciasAbiertas((prev) => {
      const nuevo = !prev;
      try {
        window.localStorage.setItem(CLAVE_COLAPSO, nuevo ? '1' : '0');
      } catch {
        // Ignorado a propósito.
      }
      return nuevo;
    });
  }

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setError('');

      try {
        const [eventosData, anotacionesData] = await Promise.all([
          listarEventosDelMes(empresaId, mesReferencia),
          listarAnotacionesDelMes(empresaId, mesReferencia),
        ]);

        setEventos(eventosData);
        setAnotaciones(anotacionesData);
      } catch (erroCarga) {
        setError((erroCarga as Error).message);
      } finally {
        setCargando(false);
      }
    }

    if (empresaId) cargar();
  }, [empresaId, mesReferencia]);

  // El cron diario de Vercel (plan Hobby: no admite crons más
  // frecuentes) queda solo como red de respaldo. Mientras cualquier
  // usuario tenga el lobby abierto, este "latido" en segundo plano
  // revisa cada 3 minutos si hay recordatorios listos para avisar —
  // así los eventos con hora exacta notifican casi en el momento sin
  // depender del plan de Vercel.
  useEffect(() => {
    const intervalo = setInterval(() => {
      fetch('/api/calendario/verificar-recordatorios').catch(() => {});
    }, 3 * 60 * 1000);

    return () => clearInterval(intervalo);
  }, []);

  function cambiarMes(delta: number) {
    setMesReferencia((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setDiaExpandido(null);
  }

  async function refrescarEventos() {
    setEventos(await listarEventosDelMes(empresaId, mesReferencia));
  }

  async function guardarEvento(datos: {
    titulo: string;
    categoria: CategoriaEvento;
    fecha: string;
    hora: string | null;
    notas: string;
    notificar: boolean;
    antelacionMinutos: number;
  }) {
    if (modal?.evento) {
      await actualizarEvento(modal.evento.id, datos);
    } else {
      await crearEvento(empresaId, usuarioId, datos);
    }
    await refrescarEventos();
    setModal(null);
  }

  async function borrarEvento() {
    if (!modal?.evento) return;
    await eliminarEvento(modal.evento.id);
    await refrescarEventos();
    setModal(null);
  }

  async function agregarAnotacion() {
    const texto = nuevaAnotacion.trim();
    if (!texto) return;

    setNuevaAnotacion('');
    await crearAnotacion(empresaId, mesReferencia, texto, anotaciones.length);
    setAnotaciones(await listarAnotacionesDelMes(empresaId, mesReferencia));
  }

  async function tildarAnotacion(anotacion: AnotacionCalendario) {
    setAnotaciones((prev) =>
      prev.map((a) => (a.id === anotacion.id ? { ...a, completada: !a.completada } : a))
    );
    await alternarAnotacion(anotacion.id, !anotacion.completada);
  }

  async function borrarAnotacion(id: string) {
    setAnotaciones((prev) => prev.filter((a) => a.id !== id));
    await eliminarAnotacion(id);
  }

  const celdas = generarGrilla(mesReferencia);
  const filas: { fecha: string; delMes: boolean }[][] = [];
  for (let i = 0; i < celdas.length; i += 7) filas.push(celdas.slice(i, i + 7));

  const eventosPorFecha = new Map<string, EventoCalendario[]>();
  for (const ev of eventos) {
    const lista = eventosPorFecha.get(ev.fecha) ?? [];
    lista.push(ev);
    eventosPorFecha.set(ev.fecha, lista);
  }

  const hoyStr = aFechaLocal(hoy);

  // Fechas especiales del mes que se está viendo, ordenadas por día —
  // para listarlas con nombre y fecha en la barra lateral (el ícono
  // en la celda no alcanza para que se entienda qué se festeja, sobre
  // todo en el celular donde no hay "hover" para el tooltip).
  const fechasEspecialesDelMes = fechasEspecialesVisibles
    ? fechasEspecialesDelPais(paisPorMoneda(moneda))
        .filter((f) => f.mes === mesReferencia.getMonth() + 1)
        .sort((a, b) => a.dia - b.dia)
    : [];

  return (
    <section
      style={{
        position: 'relative',
        background: colores.blanco,
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative' }}>

      {/* CABECERA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde, marginBottom: 4 }}>
            {esPT ? 'ORGANIZAÇÃO' : 'ORGANIZACIÓN'}
          </div>
          <h2 style={{ margin: 0, color: colores.azul, fontSize: 21 }}>
            📅 {esPT ? 'Calendário Organizador' : 'Calendario Organizador'}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => cambiarMes(-1)} style={estiloBotonNav(colores)}>
            ‹
          </button>
          <div style={{ minWidth: 150, textAlign: 'center', fontWeight: 800, color: colores.azul, fontSize: 15 }}>
            {meses[mesReferencia.getMonth()]} {mesReferencia.getFullYear()}
          </div>
          <button onClick={() => cambiarMes(1)} style={estiloBotonNav(colores)}>
            ›
          </button>

          <button
            onClick={alternarFechasEspeciales}
            title={esPT ? 'Datas comemorativas, feriados e mudanças de estação' : 'Fechas patrias, festejos y cambios de estación'}
            style={{
              marginLeft: 6,
              background: fechasEspecialesVisibles ? `${colores.verde}1c` : colores.blanco,
              color: fechasEspecialesVisibles ? colores.verde : colores.acento,
              border: `1px solid ${fechasEspecialesVisibles ? colores.verde : '#d1d5db'}`,
              borderRadius: 12,
              padding: '9px 12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 12.5,
            }}
          >
            🎉 {esPT ? 'Datas especiais' : 'Fechas especiales'}
          </button>

          <button
            onClick={() => setModal({ evento: null, fecha: hoyStr })}
            style={{
              marginLeft: 6,
              background: colores.verde,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '10px 14px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            + {esPT ? 'Novo evento' : 'Nuevo evento'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* LAYOUT: grilla a ancho completo + barra lateral */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* GRILLA MENSUAL */}
        <div style={{ flex: '1 1 640px', minWidth: 0, position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
          {/* MARCA DE AGUA — el logo de la empresa, con su color
              original (nada de blanco y negro). Ancla acá adentro (no
              en el <section> completo) para que siempre quede fijo
              detrás de los días — a todo el ancho de la grilla — y no
              se corra cuando se abre/cierra "Categorías" o
              "Anotações" en la barra lateral. */}
          {logoUrl?.trim() && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                height: 'auto',
                opacity: 0.24,
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 0,
              }}
            />
          )}

          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {diasSemana.map((dia) => (
              <div key={dia} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: colores.acento, letterSpacing: 0.5 }}>
                {dia}
              </div>
            ))}
          </div>

          {cargando ? (
            <div style={{ position: 'relative', zIndex: 1, padding: 30, textAlign: 'center', color: colores.acento, fontSize: 13 }}>
              {esPT ? 'Carregando...' : 'Cargando...'}
            </div>
          ) : (
            filas.map((fila, i) => (
              <div key={i} style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                {fila.map((celda) => {
                  const eventosDelDia = eventosPorFecha.get(celda.fecha) ?? [];
                  const esHoy = celda.fecha === hoyStr;
                  const esPasado = celda.fecha < hoyStr;
                  const expandido = diaExpandido === celda.fecha;
                  const visibles = expandido ? eventosDelDia : eventosDelDia.slice(0, 2);
                  const restantes = eventosDelDia.length - visibles.length;
                  const especialesDelDia = fechasEspecialesVisibles ? fechasEspeciales.get(celda.fecha.slice(5, 10)) ?? [] : [];

                  return (
                    <div
                      key={celda.fecha}
                      style={{
                        position: 'relative',
                        minHeight: 84,
                        borderRadius: 12,
                        border: esHoy ? `2px solid ${colores.verde}` : '1px solid #eef0f2',
                        // Estilo "fibrón": una franja diagonal verde
                        // translúcida sobre el día ya pasado, como si
                        // se hubiera resaltado a mano.
                        //
                        // El fondo de cada día va con transparencia
                        // (no un blanco sólido) a propósito: es lo que
                        // deja asomar la marca de agua del logo detrás
                        // de la grilla, no solo en los huecos entre
                        // celdas.
                        background: esPasado
                          ? `linear-gradient(105deg, transparent 0%, transparent 18%, ${colores.verde}30 22%, ${colores.verde}30 78%, transparent 82%, transparent 100%), ${celda.delMes ? `${colores.blanco}d9` : 'rgba(250,251,252,0.7)'}`
                          : celda.delMes
                            ? `${colores.blanco}d9`
                            : 'rgba(250,251,252,0.7)',
                        padding: 6,
                        opacity: celda.delMes ? 1 : 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        cursor: 'pointer',
                      }}
                      onClick={() => setModal({ evento: null, fecha: celda.fecha })}
                    >
                      {esPasado && (
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 5,
                            fontSize: 12,
                            color: colores.verde,
                            fontWeight: 800,
                          }}
                        >
                          ✓
                        </span>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: esHoy ? colores.verde : colores.azul }}>
                          {Number(celda.fecha.slice(8, 10))}
                        </span>

                        {especialesDelDia.length > 0 && (
                          <span
                            title={especialesDelDia.map((f) => (esPT ? f.nombrePt : f.nombreEs)).join(' · ')}
                            style={{ fontSize: 11, lineHeight: 1 }}
                          >
                            {iconoFechaEspecial(especialesDelDia[0].tipo)}
                          </span>
                        )}
                      </div>

                      {visibles.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setModal({ evento: ev, fecha: ev.fecha });
                          }}
                          title={ev.titulo}
                          style={{
                            background: `${CATEGORIAS_EVENTO[ev.categoria].color}1c`,
                            color: CATEGORIAS_EVENTO[ev.categoria].color,
                            borderRadius: 6,
                            padding: '2px 5px',
                            fontSize: 10,
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ev.hora ? `${ev.hora.slice(0, 5)} ` : ''}
                          {ev.titulo}
                        </div>
                      ))}

                      {restantes > 0 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setDiaExpandido(expandido ? null : celda.fecha);
                          }}
                          style={{ fontSize: 10, fontWeight: 700, color: colores.acento }}
                        >
                          {expandido ? (esPT ? 'ver menos' : 'ver menos') : `+${restantes}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* BARRA LATERAL */}
        <div style={{ flex: '1 1 260px', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* CATEGORIAS — colapsable */}
          <BloqueColapsable
            titulo={esPT ? 'Categorias' : 'Categorías'}
            abierto={referenciasAbiertas}
            onToggle={alternarReferencias}
            colores={colores}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Object.keys(CATEGORIAS_EVENTO) as CategoriaEvento[]).map((codigo) => (
                <div key={codigo} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORIAS_EVENTO[codigo].color, flexShrink: 0 }} />
                  <span style={{ color: colores.azul }}>{nombreCategoria(codigo, idioma)}</span>
                </div>
              ))}

              {fechasEspecialesVisibles && fechasEspecialesDelMes.length > 0 && (
                <>
                  <div style={{ height: 1, background: '#eef0f2', margin: '4px 0' }} />

                  <div style={{ fontSize: 11, fontWeight: 800, color: colores.acento, letterSpacing: 0.3, marginBottom: 2 }}>
                    {esPT ? 'Datas especiais do mês' : 'Fechas especiales del mes'}
                  </div>

                  {fechasEspecialesDelMes.map((f, i) => (
                    <div key={`${f.mes}-${f.dia}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>{iconoFechaEspecial(f.tipo)}</span>
                      <span style={{ color: colores.azul }}>
                        <strong>{f.dia}</strong> — {esPT ? f.nombrePt : f.nombreEs}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </BloqueColapsable>

          {/* ANOTAÇÕES — papeletas de colores, cada una se agrega,
              se tacha como realizada o se elimina. */}
          <BloqueColapsable
            titulo={esPT ? 'Anotações' : 'Anotaciones'}
            abierto={notasAbiertas}
            onToggle={() => setNotasAbiertas((p) => !p)}
            colores={colores}
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input
                value={nuevaAnotacion}
                onChange={(e) => setNuevaAnotacion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && agregarAnotacion()}
                placeholder={esPT ? 'Nova anotação...' : 'Nueva anotación...'}
                style={{ flex: 1, padding: '7px 9px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12.5 }}
              />
              <button
                onClick={agregarAnotacion}
                style={{ border: 'none', background: colores.verde, color: '#fff', borderRadius: 8, padding: '0 12px', fontWeight: 700, cursor: 'pointer' }}
              >
                +
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {anotaciones.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    background: COLORES_PAPELETA[i % COLORES_PAPELETA.length],
                    borderRadius: 10,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={a.completada}
                    onChange={() => tildarAnotacion(a)}
                    style={{ marginTop: 2 }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: '#3f3f28',
                      textDecoration: a.completada ? 'line-through' : 'none',
                      opacity: a.completada ? 0.55 : 1,
                      wordBreak: 'break-word',
                    }}
                  >
                    {a.texto}
                  </span>
                  <button
                    onClick={() => borrarAnotacion(a.id)}
                    style={{ border: 'none', background: 'transparent', color: '#7a5c00', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {anotaciones.length === 0 && (
                <div style={{ fontSize: 12, color: colores.acento }}>
                  {esPT ? 'Nenhuma anotação ainda.' : 'Todavía no hay anotaciones.'}
                </div>
              )}
            </div>
          </BloqueColapsable>
        </div>
      </div>

      {modal && (
        <ModalEvento
          evento={modal.evento}
          fechaSugerida={modal.fecha}
          idioma={idioma}
          colores={colores}
          onGuardar={guardarEvento}
          onEliminar={borrarEvento}
          onCancelar={() => setModal(null)}
        />
      )}
      </div>
    </section>
  );
}

function estiloBotonNav(colores: Colores): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: colores.blanco,
    color: colores.azul,
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 16,
  };
}

function BloqueColapsable({
  titulo,
  abierto,
  onToggle,
  colores,
  children,
}: {
  titulo: string;
  abierto: boolean;
  onToggle: () => void;
  colores: Colores;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid #eef0f2', borderRadius: 14, padding: 12 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: abierto ? 10 : 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: colores.azul, letterSpacing: 0.3 }}>{titulo}</span>
        <span style={{ color: colores.acento, fontSize: 12 }}>{abierto ? '▲' : '▼'}</span>
      </div>

      {abierto && children}
    </div>
  );
}
