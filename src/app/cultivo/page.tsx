'use client';

// MI CULTIVO
//
// Feature a medida para un único cliente (Buenaventura — ver
// empresaTieneCultivo en lib/perfilCapacidades.ts): seguimiento de
// producciones de tomate. Cada producción tiene su fecha de inicio y
// sus semanas por fase, y la pantalla le dice en qué fase va, qué
// toca hacer ahora y cuándo cambia de fase. Español nomás (idioma del
// cliente), igual que plan-accion.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { empresaTieneCultivo } from '@/lib/perfilCapacidades';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { fechaLocalHoy } from '@/lib/fecha';
import {
  ProduccionCultivo,
  listarProducciones,
  crearProduccion,
  actualizarProduccion,
  eliminarProduccion,
} from '@/lib/cultivo';
import {
  FaseProduccion,
  FaseConFechas,
  calcularCalendario,
  definicionFase,
  estadoProduccion,
  fasesPorDefecto,
} from '@/lib/cultivoTomate';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  rojo: '#dc2626',
  gris: '#6e7781',
  blanco: '#ffffff',
  fondo: '#f5f7f9',
  borde: '#e5e7eb',
};

function formatearFecha(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function CultivoPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [producciones, setProducciones] = useState<ProduccionCultivo[]>([]);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const [nombre, setNombre] = useState('');
  const [variedad, setVariedad] = useState('');
  const [plantas, setPlantas] = useState('');
  const [fechaInicio, setFechaInicio] = useState(fechaLocalHoy());
  const [semanasForm, setSemanasForm] = useState<FaseProduccion[]>(fasesPorDefecto());
  const [guardando, setGuardando] = useState(false);

  async function cargar(empresa: string, seleccionar?: string | null) {
    const lista = await listarProducciones(empresa);
    setProducciones(lista);
    setSeleccionadaId((actual) => {
      const buscada = seleccionar ?? actual;
      if (buscada && lista.some((p) => p.id === buscada)) return buscada;
      return lista.find((p) => !p.cerrada)?.id ?? lista[0]?.id ?? null;
    });
  }

  useEffect(() => {
    async function iniciar() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id || !empresaTieneCultivo(perfil.empresa_id)) {
        setAutorizado(false);
        setCargando(false);
        return;
      }

      setAutorizado(true);
      setEmpresaId(perfil.empresa_id);

      try {
        await cargar(perfil.empresa_id);
      } catch (e) {
        console.error(e);
        setError('No se pudieron cargar tus producciones.');
      }

      setCargando(false);
    }

    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || !nombre.trim()) return;

    setGuardando(true);
    setError('');

    try {
      await crearProduccion({
        empresa_id: empresaId,
        nombre: nombre.trim(),
        variedad: variedad.trim() || null,
        cantidad_plantas: plantas ? Number(plantas) : null,
        fecha_inicio: fechaInicio,
        fases: semanasForm,
      });
      setNombre('');
      setVariedad('');
      setPlantas('');
      setFechaInicio(fechaLocalHoy());
      setSemanasForm(fasesPorDefecto());
      setCreando(false);
      await cargar(empresaId);
    } catch (err) {
      console.error(err);
      setError('No se pudo crear la producción.');
    }

    setGuardando(false);
  }

  async function guardarCambios(id: string, cambios: Parameters<typeof actualizarProduccion>[1]) {
    if (!empresaId) return;
    setError('');

    try {
      await actualizarProduccion(id, cambios);
      await cargar(empresaId, id);
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar el cambio.');
    }
  }

  async function handleEliminar(produccion: ProduccionCultivo) {
    if (!empresaId) return;
    if (!window.confirm(`¿Eliminar la producción "${produccion.nombre}"? No se puede deshacer.`)) return;

    try {
      await eliminarProduccion(produccion.id);
      await cargar(empresaId);
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar la producción.');
    }
  }

  if (cargando) {
    return (
      <div style={{ ...fondo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: COLORES.gris }}>Cargando...</p>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div style={{ ...fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: COLORES.gris }}>No encontramos esta herramienta para tu empresa.</p>
        <Link href="/" style={{ color: COLORES.azul }}>← Volver</Link>
      </div>
    );
  }

  const seleccionada = producciones.find((p) => p.id === seleccionadaId) ?? null;

  return (
    <div style={fondo}>
      <style>{`
        .cultivo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 560px) { .cultivo-grid { grid-template-columns: 1fr; } }
      `}</style>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <header style={encabezado}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <Link href="/?vista=empresa" style={volver}>← Volver a Mi Negocio</Link>
              <div style={eyebrow}>PRODUCCIÓN</div>
              <h1 style={{ margin: 0, fontSize: 30 }}>🍅 Mi Cultivo de Tomates</h1>
              <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>
                Creá una producción, seguí su avance semana a semana y mirá qué te toca hacer en cada fase.
              </p>
            </div>
            <AccesosHerramientas variante="oscuro" />
          </div>
        </header>

        <main style={panel}>
          {error && (
            <p style={{ color: COLORES.rojo, fontSize: 13, marginBottom: 16, background: '#fef2f2', padding: '10px 14px', borderRadius: 10 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
            {producciones.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSeleccionadaId(p.id);
                  setCreando(false);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: `1px solid ${p.id === seleccionadaId && !creando ? COLORES.rojo : COLORES.borde}`,
                  background: p.id === seleccionadaId && !creando ? '#fef2f2' : COLORES.blanco,
                  color: p.cerrada ? COLORES.gris : '#1f2937',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {p.cerrada ? '✔ ' : ''}{p.nombre}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCreando(true)}
              style={{ padding: '8px 14px', borderRadius: 999, border: 'none', background: COLORES.verde, color: COLORES.blanco, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
            >
              + Nueva producción
            </button>
          </div>

          {creando && (
            <FormularioNueva
              nombre={nombre}
              variedad={variedad}
              plantas={plantas}
              fechaInicio={fechaInicio}
              semanas={semanasForm}
              guardando={guardando}
              onNombre={setNombre}
              onVariedad={setVariedad}
              onPlantas={setPlantas}
              onFechaInicio={setFechaInicio}
              onSemanas={setSemanasForm}
              onSubmit={handleCrear}
              onCancelar={() => setCreando(false)}
            />
          )}

          {!creando && !seleccionada && (
            <div style={{ padding: 32, textAlign: 'center', border: '1px dashed #d6dee5', borderRadius: 16, color: COLORES.gris }}>
              Todavía no tenés producciones. Tocá “+ Nueva producción” para empezar la primera.
            </div>
          )}

          {!creando && seleccionada && (
            <DetalleProduccion
              key={seleccionada.id}
              produccion={seleccionada}
              onGuardar={(cambios) => guardarCambios(seleccionada.id, cambios)}
              onEliminar={() => handleEliminar(seleccionada)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function FormularioNueva(props: {
  nombre: string;
  variedad: string;
  plantas: string;
  fechaInicio: string;
  semanas: FaseProduccion[];
  guardando: boolean;
  onNombre: (v: string) => void;
  onVariedad: (v: string) => void;
  onPlantas: (v: string) => void;
  onFechaInicio: (v: string) => void;
  onSemanas: (v: FaseProduccion[]) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelar: () => void;
}) {
  const calendario = calcularCalendario(props.fechaInicio, props.semanas);
  const totalSemanas = props.semanas.reduce((acc, f) => acc + f.semanas, 0);

  return (
    <form onSubmit={props.onSubmit} style={{ border: `1px solid ${COLORES.borde}`, borderRadius: 16, padding: 20 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 18, color: COLORES.azul }}>Nueva producción</h2>

      <div className="cultivo-grid">
        <Campo label="Nombre (ej: Tomates de primavera)">
          <input required value={props.nombre} onChange={(e) => props.onNombre(e.target.value)} style={input} />
        </Campo>
        <Campo label="Variedad (opcional)">
          <input value={props.variedad} onChange={(e) => props.onVariedad(e.target.value)} placeholder="Ej: Perita, cherry..." style={input} />
        </Campo>
        <Campo label="Cantidad de plantas (opcional)">
          <input type="number" min={1} value={props.plantas} onChange={(e) => props.onPlantas(e.target.value)} style={input} />
        </Campo>
        <Campo label="Fecha de siembra">
          <input required type="date" value={props.fechaInicio} onChange={(e) => props.onFechaInicio(e.target.value)} style={input} />
        </Campo>
      </div>

      <p style={{ margin: '18px 0 8px', fontWeight: 700, fontSize: 13, color: COLORES.azul }}>
        Semanas por fase (ajustalas según tu variedad y clima) — total {totalSemanas} semanas
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {calendario.map((fase) => {
          const def = definicionFase(fase.clave);
          return (
            <div key={fase.clave} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ flex: '1 1 180px' }}>{def.emoji} {def.nombre}</span>
              <input
                type="number"
                min={1}
                max={20}
                value={fase.semanas}
                onChange={(e) =>
                  props.onSemanas(
                    props.semanas.map((f) =>
                      f.clave === fase.clave ? { ...f, semanas: Math.max(1, Number(e.target.value) || 1) } : f
                    )
                  )
                }
                style={{ ...input, width: 70 }}
              />
              <span style={{ color: COLORES.gris, fontSize: 12 }}>
                sem · {formatearFecha(fase.inicio)} → {formatearFecha(fase.fin)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button type="submit" disabled={props.guardando} style={botonPrimario}>
          {props.guardando ? 'Creando...' : 'Crear producción'}
        </button>
        <button type="button" onClick={props.onCancelar} style={botonSecundario}>Cancelar</button>
      </div>
    </form>
  );
}

function DetalleProduccion({
  produccion,
  onGuardar,
  onEliminar,
}: {
  produccion: ProduccionCultivo;
  onGuardar: (cambios: Parameters<typeof actualizarProduccion>[1]) => void;
  onEliminar: () => void;
}) {
  const hoy = fechaLocalHoy();
  const calendario = calcularCalendario(produccion.fecha_inicio, produccion.fases);
  const estado = estadoProduccion(calendario, hoy);
  const [faseVista, setFaseVista] = useState<string | null>(null);
  const [kilos, setKilos] = useState(String(produccion.kilos_cosechados ?? 0));
  const [notas, setNotas] = useState(produccion.notas ?? '');

  const claveVista = faseVista ?? estado.faseActual?.clave ?? calendario[0].clave;
  const faseDef = definicionFase(claveVista as FaseConFechas['clave']);
  const faseCal = calendario.find((f) => f.clave === claveVista) as FaseConFechas;
  const esActual = estado.faseActual?.clave === claveVista;

  function alternarTarea(indice: number) {
    const clave = `${claveVista}:${indice}`;
    const hechas = produccion.tareas_hechas.includes(clave)
      ? produccion.tareas_hechas.filter((t) => t !== clave)
      : [...produccion.tareas_hechas, clave];
    onGuardar({ tareas_hechas: hechas });
  }

  const resumen =
    estado.estado === 'PENDIENTE'
      ? `Empieza en ${estado.diasParaSiguienteFase} día${estado.diasParaSiguienteFase === 1 ? '' : 's'} (${formatearFecha(produccion.fecha_inicio)})`
      : estado.estado === 'TERMINADA'
        ? 'Ciclo completo — la producción ya pasó todas sus fases'
        : `Día ${estado.diaActual} de ${estado.diasTotales} · ${estado.faseActual!.numero < calendario.length ? `próxima fase en ${estado.diasParaSiguienteFase} día${estado.diasParaSiguienteFase === 1 ? '' : 's'}` : `fin del ciclo en ${estado.diasParaSiguienteFase} día${estado.diasParaSiguienteFase === 1 ? '' : 's'}`}`;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: COLORES.azul }}>{produccion.nombre}</h2>
          <p style={{ margin: '4px 0 0', color: COLORES.gris, fontSize: 13 }}>
            {[produccion.variedad, produccion.cantidad_plantas ? `${produccion.cantidad_plantas} plantas` : null, `siembra ${formatearFecha(produccion.fecha_inicio)}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <button type="button" onClick={() => onGuardar({ cerrada: !produccion.cerrada })} style={botonSecundario}>
            {produccion.cerrada ? 'Reabrir' : 'Cerrar producción'}
          </button>
          <button type="button" onClick={onEliminar} style={{ ...botonSecundario, color: COLORES.rojo, borderColor: COLORES.rojo }}>
            Eliminar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Chip titulo="Fase actual" valor={estado.faseActual ? `${definicionFase(estado.faseActual.clave).emoji} ${definicionFase(estado.faseActual.clave).nombre}` : estado.estado === 'PENDIENTE' ? 'Sin empezar' : 'Terminada'} />
        {estado.faseActual && <Chip titulo="Semana de la fase" valor={`${estado.semanaDeLaFase} de ${estado.semanasDeLaFase}`} />}
        <Chip titulo="Avance total" valor={`${estado.porcentaje}%`} />
      </div>

      <p style={{ margin: '0 0 8px', fontSize: 13, color: COLORES.gris }}>{resumen}</p>
      <div style={{ background: '#eef2f6', borderRadius: 999, height: 10, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ width: `${estado.porcentaje}%`, background: `linear-gradient(90deg, ${COLORES.verde}, ${COLORES.rojo})`, height: '100%', transition: 'width 0.3s ease' }} />
      </div>

      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13, color: COLORES.azul }}>Línea de tiempo (tocá una fase para ver su guía)</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
        {calendario.map((fase) => {
          const def = definicionFase(fase.clave);
          const pasada = hoy > fase.fin;
          const actual = estado.faseActual?.clave === fase.clave;
          const elegida = fase.clave === claveVista;
          return (
            <button
              key={fase.clave}
              type="button"
              onClick={() => setFaseVista(fase.clave)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: 12,
                border: `1px solid ${elegida ? COLORES.rojo : COLORES.borde}`,
                background: actual ? '#fef2f2' : pasada ? '#eaf7ee' : COLORES.blanco,
                cursor: 'pointer',
                fontSize: 13.5,
              }}
            >
              <span style={{ fontWeight: actual ? 800 : 600 }}>
                {pasada ? '✅' : def.emoji} {fase.numero}. {def.nombre}{actual ? '  ← estás acá' : ''}
              </span>
              <span style={{ color: COLORES.gris, fontSize: 12 }}>
                {fase.semanas} sem · {formatearFecha(fase.inicio)} → {formatearFecha(fase.fin)}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ border: `1px solid ${esActual ? COLORES.rojo : COLORES.borde}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, color: COLORES.azul }}>
          {faseDef.emoji} {faseDef.nombre}{esActual ? ' — lo que te toca ahora' : ''}
        </h3>
        <p style={{ margin: '0 0 14px', color: COLORES.gris, fontSize: 12 }}>
          {formatearFecha(faseCal.inicio)} → {formatearFecha(faseCal.fin)} · {faseCal.semanas} semana{faseCal.semanas === 1 ? '' : 's'}
        </p>

        <Dato titulo="Qué pasa" texto={faseDef.queOcurre} />
        <Dato titulo="Ambiente" texto={faseDef.ambiente} />
        <Dato titulo="Riego" texto={faseDef.riego} />
        <Dato titulo="Nutrición" texto={faseDef.nutricion} />

        <p style={{ margin: '14px 0 8px', fontWeight: 700, fontSize: 13, color: COLORES.azul }}>Tareas de la fase</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {faseDef.tareas.map((texto, i) => {
            const hecha = produccion.tareas_hechas.includes(`${claveVista}:${i}`);
            return (
              <label
                key={i}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 10, background: hecha ? '#eaf7ee' : '#f8fafc', cursor: 'pointer', fontSize: 13.5 }}
              >
                <input type="checkbox" checked={hecha} onChange={() => alternarTarea(i)} style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ textDecoration: hecha ? 'line-through' : 'none', color: hecha ? COLORES.gris : '#1f2937' }}>{texto}</span>
              </label>
            );
          })}
        </div>

        <Dato titulo="Cuándo pasa a la siguiente fase" texto={faseDef.pasaALaSiguiente} />
      </div>

      <div style={{ border: `1px solid ${COLORES.borde}`, borderRadius: 16, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, color: COLORES.azul }}>Registro de la producción</h3>

        <div className="cultivo-grid">
          <Campo label="Fecha de siembra">
            <input
              type="date"
              defaultValue={produccion.fecha_inicio}
              onBlur={(e) => e.target.value && e.target.value !== produccion.fecha_inicio && onGuardar({ fecha_inicio: e.target.value })}
              style={input}
            />
          </Campo>
          <Campo label="Kilos cosechados">
            <input type="number" min={0} step="0.1" value={kilos} onChange={(e) => setKilos(e.target.value)} style={input} />
          </Campo>
        </div>

        <p style={{ margin: '16px 0 8px', fontWeight: 700, fontSize: 13, color: COLORES.azul }}>Semanas por fase</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {produccion.fases.map((f) => (
            <label key={f.clave} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: COLORES.gris, fontWeight: 700 }}>
              {definicionFase(f.clave).nombre}
              <input
                type="number"
                min={1}
                max={20}
                defaultValue={f.semanas}
                onBlur={(e) => {
                  const nuevas = Math.max(1, Number(e.target.value) || 1);
                  if (nuevas !== f.semanas) {
                    onGuardar({ fases: produccion.fases.map((x) => (x.clave === f.clave ? { ...x, semanas: nuevas } : x)) });
                  }
                }}
                style={{ ...input, width: 80 }}
              />
            </label>
          ))}
        </div>

        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas: plagas, clima, qué funcionó, qué cambiar la próxima vez..."
          rows={3}
          style={{ ...input, width: '100%', marginTop: 16, resize: 'vertical', fontFamily: 'inherit' }}
        />

        <button
          type="button"
          onClick={() => onGuardar({ kilos_cosechados: Number(kilos) || 0, notas: notas.trim() || null })}
          style={{ ...botonPrimario, marginTop: 12 }}
        >
          Guardar kilos y notas
        </button>
      </div>
    </section>
  );
}

function Dato({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.5 }}>
      <strong style={{ color: COLORES.azul }}>{titulo}: </strong>
      {texto}
    </p>
  );
}

function Chip({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ background: '#f8fafc', border: `1px solid ${COLORES.borde}`, borderRadius: 12, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: COLORES.gris, fontWeight: 700 }}>{titulo}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: COLORES.azul }}>{valor}</div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: COLORES.gris, fontWeight: 700 }}>
      {label}
      {children}
    </label>
  );
}

const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
  boxSizing: 'border-box',
  width: '100%',
};

const botonPrimario: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  background: COLORES.verde,
  color: COLORES.blanco,
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
};

const botonSecundario: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 10,
  border: `1px solid ${COLORES.borde}`,
  background: COLORES.blanco,
  color: COLORES.azul,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const fondo: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--fondo-app, ' + COLORES.fondo + ')',
  padding: '24px 16px 60px',
};

const encabezado: React.CSSProperties = {
  background: `linear-gradient(125deg, ${COLORES.azul} 0%, ${COLORES.azul} 55%, ${COLORES.rojo} 100%)`,
  borderRadius: 24,
  padding: '26px 28px',
  color: COLORES.blanco,
  marginBottom: 20,
};

const volver: React.CSSProperties = {
  color: '#dbe5ef',
  fontSize: 13,
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: 10,
};

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  color: '#f3c1c1',
  marginBottom: 4,
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 24,
  border: `1px solid ${COLORES.borde}`,
};
