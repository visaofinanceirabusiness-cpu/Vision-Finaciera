'use client';

// NUESTRO SUEÑO
//
// Espacio compartido de pareja (fase 1): vínculo por código de una
// sola vez entre dos empresas, campos compartidos editables y un chat
// propio. Ver lib/nuestroSueno.ts para el modelo de datos y
// nuestroSuenoEmpresas.ts para quién lo tiene habilitado.
//
// Próximas fases (no acá todavía): tablero gamificado de etapas y
// tarjetas de propuestas de compra con extracción de datos del link
// y del mapa.

import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { empresaTieneNuestroSueno } from '@/lib/perfilCapacidades';
import {
  obtenerMiPareja,
  crearInvitacion,
  obtenerEmpresaDelOtroLado,
  listarCampos,
  guardarCampo,
  listarMensajes,
  enviarMensaje,
  CAMPOS_SUENO,
  type SuenoPareja,
  type SuenoCampo,
  type SuenoMensaje,
} from '@/lib/nuestroSueno';
import { TableroEtapas } from '@/components/nuestroSueno/TableroEtapas';
import { PropuestasCompra } from '@/components/nuestroSueno/PropuestasCompra';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  fondo: '#f5f7f9',
  rosa: '#db2777',
};

type Empresa = { nombre: string; idioma: string | null };
type Perfil = { id: string; empresa_id: string };

export default function NuestroSuenoPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [pareja, setPareja] = useState<SuenoPareja | null>(null);
  const [nombreOtroLado, setNombreOtroLado] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, SuenoCampo>>({});
  const [mensajes, setMensajes] = useState<SuenoMensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [codigoIngresado, setCodigoIngresado] = useState('');
  const [uniendo, setUniendo] = useState(false);
  const [textoMensaje, setTextoMensaje] = useState('');
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);
  const [valoresCampos, setValoresCampos] = useState<Record<string, string>>({});
  const [guardandoCampo, setGuardandoCampo] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  const esPT = empresa?.idioma === 'PT';
  const perfilRef = useRef(perfil);
  perfilRef.current = perfil;

  const cargarEspacioVinculado = useCallback(async (parejaActual: SuenoPareja, miEmpresaId: string) => {
    const [otroNombre, camposData, mensajesData] = await Promise.all([
      obtenerEmpresaDelOtroLado(parejaActual, miEmpresaId),
      listarCampos(parejaActual.id),
      listarMensajes(parejaActual.id),
    ]);
    setNombreOtroLado(otroNombre);
    setCampos(camposData);
    setValoresCampos(Object.fromEntries(CAMPOS_SUENO.map((c) => [c.clave, camposData[c.clave]?.valor ?? ''])));
    setMensajes(mensajesData);
  }, []);

  useEffect(() => {
    async function cargar() {
      setError('');
      const { data: usuarioData } = await supabase.auth.getUser();

      if (!usuarioData.user) {
        router.push('/login');
        return;
      }

      const { data: perfilData, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('id, empresa_id')
        .eq('id', usuarioData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfilData?.empresa_id) {
        setError('No se pudo identificar tu empresa.');
        setCargando(false);
        return;
      }

      if (!empresaTieneNuestroSueno(perfilData.empresa_id)) {
        router.push('/');
        return;
      }

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nombre, idioma')
        .eq('id', perfilData.empresa_id)
        .maybeSingle();

      setPerfil(perfilData as Perfil);
      setEmpresa(empresaData);

      try {
        const parejaActual = await obtenerMiPareja(perfilData.empresa_id);
        setPareja(parejaActual);

        if (parejaActual?.estado === 'VINCULADA') {
          await cargarEspacioVinculado(parejaActual, perfilData.empresa_id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando Nuestro Sueño.');
      }

      setCargando(false);
    }

    cargar();
  }, [router, cargarEspacioVinculado]);

  // Mientras el código está esperando que la otra empresa se una, se
  // vuelve a consultar cada 5s — así la pantalla pasa sola a "vinculado"
  // apenas Ocaña entra el código, sin que Buenaventura tenga que
  // recargar a mano para enterarse.
  useEffect(() => {
    if (pareja?.estado !== 'PENDIENTE') return;

    const intervalo = setInterval(async () => {
      const miPerfil = perfilRef.current;
      if (!miPerfil) return;

      const parejaActual = await obtenerMiPareja(miPerfil.empresa_id);
      if (parejaActual?.estado === 'VINCULADA') {
        setPareja(parejaActual);
        await cargarEspacioVinculado(parejaActual, miPerfil.empresa_id);
      }
    }, 5000);

    return () => clearInterval(intervalo);
  }, [pareja?.estado, cargarEspacioVinculado]);

  async function verificarAhora() {
    if (!perfil) return;
    setVerificando(true);
    const parejaActual = await obtenerMiPareja(perfil.empresa_id);
    setPareja(parejaActual);
    if (parejaActual?.estado === 'VINCULADA') {
      await cargarEspacioVinculado(parejaActual, perfil.empresa_id);
    }
    setVerificando(false);
  }

  async function generarCodigo() {
    if (!perfil) return;
    setError('');
    try {
      const nueva = await crearInvitacion(perfil.empresa_id, perfil.id);
      setPareja(nueva);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el código.');
    }
  }

  async function unirseConCodigo() {
    if (!codigoIngresado.trim()) return;
    setUniendo(true);
    setError('');

    try {
      const { data: sesion } = await supabase.auth.getSession();
      const token = sesion.session?.access_token;

      const respuesta = await fetch('/api/nuestro-sueno/vincular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ codigo: codigoIngresado }),
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        setError(resultado.error || 'No se pudo unir con ese código.');
        setUniendo(false);
        return;
      }

      if (perfil) {
        const parejaActual = await obtenerMiPareja(perfil.empresa_id);
        setPareja(parejaActual);
        if (parejaActual?.estado === 'VINCULADA') {
          await cargarEspacioVinculado(parejaActual, perfil.empresa_id);
        }
      }
    } catch {
      setError('No se pudo unir con ese código.');
    }

    setUniendo(false);
  }

  async function guardarValorCampo(clave: string) {
    if (!pareja || !perfil) return;
    setGuardandoCampo(clave);
    try {
      await guardarCampo(pareja.id, perfil.id, clave, valoresCampos[clave] ?? '');
      const camposData = await listarCampos(pareja.id);
      setCampos(camposData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el campo.');
    }
    setGuardandoCampo(null);
  }

  async function mandarMensaje() {
    if (!pareja || !perfil || !textoMensaje.trim()) return;
    setEnviandoMensaje(true);
    try {
      await enviarMensaje(pareja.id, perfil.id, perfil.empresa_id, textoMensaje);
      setTextoMensaje('');
      const mensajesData = await listarMensajes(pareja.id);
      setMensajes(mensajesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    }
    setEnviandoMensaje(false);
  }

  if (cargando) {
    return <main style={estilos.main}>{esPT ? 'Carregando…' : 'Cargando…'}</main>;
  }

  return (
    <main style={estilos.main}>
      <div style={estilos.contenedor}>
        <Link href="/" style={{ color: COLORES.gris, fontSize: 15, textDecoration: 'none' }}>
          {esPT ? '← Voltar ao início' : '← Volver al inicio'}
        </Link>
        <h1 style={{ color: COLORES.rosa, marginBottom: 4 }}>💞 Nuestro Sueño</h1>
        <p style={{ color: COLORES.gris, marginTop: 0 }}>
          {esPT ? 'Um espaço para construir juntos o sonho da casa própria.' : 'Un espacio para construir juntos el sueño de la casa propia.'}
        </p>

        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

        {!pareja && (
          <div style={estilos.tarjeta}>
            <h2 style={{ color: COLORES.azul, marginTop: 0 }}>
              {esPT ? 'Vincular com seu par' : 'Vincularte con tu pareja'}
            </h2>
            <p style={{ color: COLORES.gris }}>
              {esPT
                ? 'Isso é feito uma única vez. Uma pessoa gera o código e a outra o usa para se juntar.'
                : 'Esto se hace una sola vez. Una persona genera el código y la otra lo usa para unirse.'}
            </p>

            <button onClick={generarCodigo} style={estilos.botonPrincipal}>
              {esPT ? 'Gerar código' : 'Generar código'}
            </button>

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid #e5e7eb` }}>
              <p style={{ color: COLORES.gris, marginBottom: 8 }}>
                {esPT ? 'Já tenho um código:' : 'Ya tengo un código:'}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={codigoIngresado}
                  onChange={(e) => setCodigoIngresado(e.target.value.toUpperCase())}
                  placeholder={esPT ? 'Código' : 'Código'}
                  style={estilos.input}
                  maxLength={8}
                />
                <button onClick={unirseConCodigo} disabled={uniendo} style={estilos.botonPrincipal}>
                  {uniendo ? '...' : esPT ? 'Unir-me' : 'Unirme'}
                </button>
              </div>
            </div>
          </div>
        )}

        {pareja && pareja.estado === 'PENDIENTE' && (
          <div style={estilos.tarjeta}>
            <h2 style={{ color: COLORES.azul, marginTop: 0 }}>
              {esPT ? 'Compartilhe este código' : 'Compartí este código'}
            </h2>
            <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4, color: COLORES.rosa }}>{pareja.codigo}</p>
            <p style={{ color: COLORES.gris }}>
              {esPT
                ? 'Envie pela mensageria que vocês já usam. A outra pessoa entra nele em Nosso Sonho para se juntar.'
                : 'Mandalo por la mensajería que ya usan. La otra persona lo entra en Nuestro Sueño para unirse.'}
            </p>
            <p style={{ color: COLORES.gris, fontSize: 14 }}>
              {esPT
                ? 'Esta tela atualiza sozinha assim que a outra pessoa entrar o código.'
                : 'Esta pantalla se actualiza sola apenas la otra persona entre el código.'}
            </p>
            <button onClick={verificarAhora} disabled={verificando} style={estilos.botonSecundario}>
              {verificando ? '...' : esPT ? 'Verificar agora' : 'Verificar ahora'}
            </button>
          </div>
        )}

        {pareja && pareja.estado === 'VINCULADA' && (
          <>
            <p style={{ color: COLORES.gris }}>
              {esPT ? 'Vinculado com' : 'Vinculado con'} <strong>{nombreOtroLado ?? '—'}</strong>
            </p>

            <div style={estilos.tarjeta}>
              <h2 style={{ color: COLORES.azul, marginTop: 0 }}>
                {esPT ? 'Nosso caminho' : 'Nuestro camino'}
              </h2>
              {perfil && <TableroEtapas parejaId={pareja.id} perfilId={perfil.id} esPT={!!esPT} colorAcento={COLORES.rosa} />}
            </div>

            <div style={estilos.tarjeta}>
              <h2 style={{ color: COLORES.azul, marginTop: 0 }}>
                {esPT ? 'Propostas de compra' : 'Propuestas de compra'}
              </h2>
              {perfil && (
                <PropuestasCompra
                  parejaId={pareja.id}
                  perfilId={perfil.id}
                  esPT={!!esPT}
                  colorAcento={COLORES.rosa}
                  ahorroActual={campos.ahorro_actual?.valor ? Number(campos.ahorro_actual.valor) : null}
                />
              )}
            </div>

            <div style={estilos.tarjeta}>
              <h2 style={{ color: COLORES.azul, marginTop: 0 }}>
                {esPT ? 'A casa dos sonhos' : 'La casa de los sueños'}
              </h2>

              {CAMPOS_SUENO.map((campo) => (
                <div key={campo.clave} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', color: COLORES.gris, fontSize: 14, marginBottom: 4 }}>
                    {campo.etiqueta}
                    {campos[campo.clave]?.actualizado_en && (
                      <span style={{ marginLeft: 8, fontSize: 12 }}>
                        ({esPT ? 'atualizado' : 'actualizado'} {new Date(campos[campo.clave].actualizado_en).toLocaleDateString()})
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type={campo.tipo === 'fecha' ? 'date' : campo.tipo === 'monto' ? 'number' : 'text'}
                      value={valoresCampos[campo.clave] ?? ''}
                      onChange={(e) => setValoresCampos((v) => ({ ...v, [campo.clave]: e.target.value }))}
                      style={{ ...estilos.input, flex: 1 }}
                    />
                    <button
                      onClick={() => guardarValorCampo(campo.clave)}
                      disabled={guardandoCampo === campo.clave}
                      style={estilos.botonSecundario}
                    >
                      {guardandoCampo === campo.clave ? '...' : esPT ? 'Salvar' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={estilos.tarjeta}>
              <h2 style={{ color: COLORES.azul, marginTop: 0 }}>{esPT ? 'Mensagens' : 'Mensajes'}</h2>

              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
                {mensajes.length === 0 && (
                  <p style={{ color: COLORES.gris }}>
                    {esPT ? 'Ainda não há mensagens.' : 'Todavía no hay mensajes.'}
                  </p>
                )}
                {mensajes.map((m) => {
                  const esMio = m.autor_perfil_id === perfil?.id;
                  return (
                    <div
                      key={m.id}
                      style={{
                        textAlign: esMio ? 'right' : 'left',
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          background: esMio ? COLORES.verde : '#e5e7eb',
                          color: esMio ? COLORES.blanco : '#1f2937',
                          padding: '8px 12px',
                          borderRadius: 12,
                          maxWidth: '75%',
                        }}
                      >
                        {m.texto}
                      </span>
                      <div style={{ fontSize: 12, color: COLORES.gris }}>
                        {new Date(m.creado_en).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={textoMensaje}
                  onChange={(e) => setTextoMensaje(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && mandarMensaje()}
                  placeholder={esPT ? 'Escreva uma mensagem…' : 'Escribí un mensaje…'}
                  style={{ ...estilos.input, flex: 1 }}
                />
                <button onClick={mandarMensaje} disabled={enviandoMensaje} style={estilos.botonPrincipal}>
                  {esPT ? 'Enviar' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const estilos = {
  main: {
    minHeight: '100vh',
    background: COLORES.fondo,
    padding: 20,
  },
  contenedor: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  tarjeta: {
    background: COLORES.blanco,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 15,
  },
  botonPrincipal: {
    background: COLORES.rosa,
    color: COLORES.blanco,
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  botonSecundario: {
    background: COLORES.azul,
    color: COLORES.blanco,
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
} as const;
