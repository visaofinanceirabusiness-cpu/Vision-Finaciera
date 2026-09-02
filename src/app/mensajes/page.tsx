'use client';

// MENSAJES / VISÃO FINANCEIRA
//
// Bandeja de mensajes financieros para el emprendedor.
// Sabio utiliza este espacio para explicar qué están diciendo
// los números del negocio.
//
// Primera versión:
// - 3 mensajes de análisis para Encanto.
// - Los mensajes se despliegan al hacer clic.
// - Sin gráficos ni tablas.
// - La información visual y detallada continúa viviendo en el sistema.
//
// Más adelante:
// - Los mensajes serán generados automáticamente.
// - Se almacenarán por empresa y período.
// - Se incorporará estado leído/no leído.
// - Se generará un nuevo conjunto de mensajes cada mes.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  fondo: '#f5f7f9',
};

type Empresa = {
  nombre: string;
};

type MensajeFinanciero = {
  id: number;
  titulo: string;
  texto: string;
};

const MENSAJES_ENCANTO: MensajeFinanciero[] = [
  {
    id: 1,

    titulo: 'Vamos a mirar tu resultado y rentabilidad',

    texto: `Hola, Brenda! 👋

Estuve analizando los números de Encanto y quiero llamar tu atención sobre algo importante.

Hasta el momento, tu negocio presenta un resultado acumulado de R$ 771, sobre una facturación operativa de R$ 2.303.

Esto significa que, después de los costos de las mercaderías y los gastos registrados, aproximadamente R$ 33,50 de cada R$ 100 vendidos permanecen como resultado.

Es un indicador positivo, pero hay un punto que debemos observar juntos.

El resultado no está creciendo de manera constante. En los últimos meses tuvimos una recuperación importante, pero septiembre presentó un resultado negativo de R$ 120.

Esto no significa, por sí solo, que el negocio esté funcionando mal.

Significa que necesitamos entender qué ocurrió este mes.

Puede estar relacionado con el volumen de ventas, el costo de las mercaderías, los gastos o algún movimiento extraordinario.

💡 Mi recomendación:

Antes de aumentar las compras o asumir nuevos compromisos, debemos entender qué provocó este cambio en el resultado de septiembre.

Los números indican que Encanto tiene capacidad para generar resultados, pero necesitamos acompañar más de cerca su evolución mensual.

Un abrazo,

Sabio 🦉

Visão Financeira
Claridad para decidir. Seguridad para crecer.`,
  },

  {
    id: 2,

    titulo: 'Vamos a mirar dónde está tu dinero',

    texto: `Hola, Brenda! 👋

Hoy quiero mirar otro punto importante: la estructura financiera de Encanto.

Actualmente tienes R$ 671 disponibles en caja y no tienes pasivos registrados.

Esto es una situación positiva.

Significa que, dentro de la información registrada en el sistema, la empresa no depende de deudas para mantener su estructura financiera actual.

Pero hay algo importante que debemos entender:

Tener dinero en caja no significa necesariamente que todo ese dinero esté disponible para gastar.

Parte de los recursos de la empresa está aplicada al stock.

Actualmente, el stock representa aproximadamente R$ 280.

Es decir, una parte del patrimonio de Encanto está transformada en productos que todavía deben venderse para volver a convertirse en dinero disponible.

💡 ¿Qué significa esto?

Antes de utilizar toda la caja para comprar nuevos productos, debemos observar cuánto del stock actual realmente está rotando.

El objetivo no es simplemente tener más productos.

El objetivo es conseguir que el capital de la empresa circule y genere retorno.

Por ahora, tu estructura financiera presenta una característica positiva:

Caja disponible y ausencia de pasivos registrados.

Ahora necesitamos trabajar para que ese capital sea utilizado de la manera más eficiente posible.

Un abrazo,

Sabio 🦉

Visão Financeira
Claridad para decidir. Seguridad para crecer.`,
  },

  {
    id: 3,

    titulo: 'Vamos a prestar atención a tu stock',

    texto: `Hola, Brenda! 👋

Hay una información de tus números que merece nuestra atención especial.

Encanto generó R$ 2.303 en ventas, mientras que el costo de las mercaderías vendidas fue de R$ 1.308.

Esto significa que una parte importante de los ingresos está siendo utilizada para cubrir el costo de los productos vendidos.

Hasta aquí, esto es normal para una empresa comercial.

Lo interesante está en cómo está distribuido el dinero entre las categorías.

Los productos de belleza representan la mayor parte de las ventas, con R$ 1.683.

Al mismo tiempo, los accesorios tienen una participación muy importante en el stock actual.

💡 Esto nos lleva a una pregunta importante:

¿Estamos colocando más dinero en stock justamente en los productos que más rotan?

Esta es una pregunta financiera, no solamente comercial.

Un producto puede tener un buen margen y aun así no ser una buena aplicación de capital si permanece demasiado tiempo inmovilizado.

Por eso, para las próximas compras, mi sugerencia es observar tres cosas:

Margen + rotación + capital invertido.

No necesitamos simplemente vender más.

Necesitamos conseguir que cada real invertido en stock tenga capacidad de regresar a la empresa y generar un nuevo resultado.

Este será uno de los puntos que vale la pena acompañar durante los próximos meses.

Un abrazo,

Sabio 🦉

Visão Financeira
Claridad para decidir. Seguridad para crecer.`,
  },
];

export default function MensajesPage() {
  const router = useRouter();

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [mensajeAbierto, setMensajeAbierto] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargarEmpresa() {
      setError('');

      const { data: usuarioData } = await supabase.auth.getUser();

      if (!usuarioData.user) {
        router.push('/login');
        return;
      }

      const { data: perfilData, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', usuarioData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfilData?.empresa_id) {
        setError('No se pudo identificar la empresa del usuario.');
        setCargando(false);
        return;
      }

      const { data: empresaData, error: errorEmpresa } = await supabase
        .from('empresas')
        .select('nombre')
        .eq('id', perfilData.empresa_id)
        .maybeSingle();

      if (errorEmpresa) {
        setError(`No se pudo cargar la empresa: ${errorEmpresa.message}`);
        setCargando(false);
        return;
      }

      setEmpresa(empresaData);
      setCargando(false);
    }

    cargarEmpresa();
  }, [router]);

  if (cargando) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORES.fondo,
          color: COLORES.azul,
          fontWeight: 700,
        }}
      >
        Cargando mensajes...
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORES.fondo,
          padding: 24,
        }}
      >
        <section
          style={{
            background: COLORES.blanco,
            borderRadius: 20,
            padding: 30,
            maxWidth: 500,
            textAlign: 'center',
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ fontSize: 38, marginBottom: 12 }}>⚠️</div>

          <h1
            style={{
              margin: '0 0 10px',
              color: COLORES.azul,
              fontSize: 21,
            }}
          >
            No pudimos cargar tus mensajes
          </h1>

          <p
            style={{
              margin: 0,
              color: COLORES.gris,
              lineHeight: 1.6,
            }}
          >
            {error}
          </p>

          <button
            onClick={() => router.push('/inicio')}
            style={{
              marginTop: 20,
              background: COLORES.azul,
              border: 'none',
              borderRadius: 12,
              padding: '11px 18px',
              color: COLORES.blanco,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Volver al inicio
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #edf4f1 0%, transparent 34%), #f5f7f9',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        {/* VOLVER */}

        <button
          onClick={() => router.push('/')}
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORES.azul,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '8px 0',
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          ← Volver al inicio
        </button>

        {/* ENCABEZADO */}

        <section
          style={{
            background: COLORES.blanco,
            borderRadius: 24,
            border: '1px solid #e5e7eb',
            padding: 30,
            marginBottom: 20,
            boxShadow: '0 12px 30px rgba(31,58,95,0.06)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 15,
                background: `${COLORES.verde}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              ✉️
            </div>

            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.4,
                  color: COLORES.verde,
                  textTransform: 'uppercase',
                }}
              >
                Visão Financeira
              </div>

              <div
                style={{
                  color: COLORES.azul,
                  fontSize: 13,
                  marginTop: 3,
                }}
              >
                Mensajes para {empresa?.nombre ?? 'tu negocio'}
              </div>
            </div>
          </div>

          <h1
            style={{
              margin: 0,
              color: COLORES.azul,
              fontSize: 28,
              lineHeight: 1.2,
            }}
          >
            Lo que tus números están diciendo
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              color: COLORES.gris,
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            Sabio analizó la información de tu negocio y separó algunos
            puntos importantes para que puedas tomar mejores decisiones.
          </p>
        </section>

        {/* MENSAJES */}

        <div
          style={{
            display: 'grid',
            gap: 12,
          }}
        >
          {MENSAJES_ENCANTO.map((mensaje, indice) => {
            const estaAbierto = mensajeAbierto === mensaje.id;

            return (
              <section
                key={mensaje.id}
                style={{
                  background: COLORES.blanco,
                  borderRadius: 18,
                  border: estaAbierto
                    ? `1px solid ${COLORES.verde}`
                    : '1px solid #e5e7eb',
                  overflow: 'hidden',
                  boxShadow: estaAbierto
                    ? '0 10px 25px rgba(46,139,87,0.08)'
                    : '0 5px 15px rgba(31,58,95,0.04)',
                  transition: 'all 0.2s ease',
                }}
              >
                <button
                  onClick={() =>
                    setMensajeAbierto(
                      estaAbierto ? null : mensaje.id
                    )
                  }
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '20px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    textAlign: 'left',
                  }}
                >
                  {/* ICONO */}

                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      background: `${COLORES.verde}12`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 21,
                      flexShrink: 0,
                    }}
                  >
                    ✉️
                  </div>

                  {/* TITULO */}

                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 1.2,
                        color: COLORES.verde,
                        marginBottom: 5,
                      }}
                    >
                      MENSAJE {indice + 1}
                    </div>

                    <div
                      style={{
                        color: COLORES.azul,
                        fontSize: 17,
                        fontWeight: 800,
                        lineHeight: 1.35,
                      }}
                    >
                      {mensaje.titulo}
                    </div>
                  </div>

                  {/* FLECHA */}

                  <div
                    style={{
                      color: COLORES.azul,
                      fontSize: 22,
                      fontWeight: 700,
                      transform: estaAbierto
                        ? 'rotate(180deg)'
                        : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    ⌄
                  </div>
                </button>

                {/* CONTENIDO */}

                {estaAbierto && (
                  <div
                    style={{
                      borderTop: '1px solid #edf0f2',
                      padding: '24px 28px 28px',
                      color: '#374151',
                      fontSize: 15,
                      lineHeight: 1.75,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {mensaje.texto}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* PIE */}

        <div
          style={{
            textAlign: 'center',
            marginTop: 28,
            paddingBottom: 20,
            color: COLORES.gris,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          🦉 Sabio estará aquí cuando quieras entender mejor tus números.
        </div>
      </div>
    </main>
  );
}
