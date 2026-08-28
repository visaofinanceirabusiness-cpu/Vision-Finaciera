'use client';

// PIE DE PÁGINA DE VISÃO FINANCEIRA
//
// Muestra la marca oficial de Visão Financeira, el lema,
// el propósito y los pilares/indicadores.
//
// El logo ahora utiliza la imagen oficial alojada en Supabase.

const LOGO_VISAO_FINANCEIRA =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/LOGO%20y%20NOMBRE.jpeg';

const PILARES = [
  {
    icono: '🔎',
    titulo: 'Información',
    bajada: 'que aclara',
  },
  {
    icono: '🎯',
    titulo: 'Decisiones',
    bajada: 'que impulsan',
  },
  {
    icono: '🛡️',
    titulo: 'Control',
    bajada: 'que da seguridad',
  },
  {
    icono: '📈',
    titulo: 'Estrategias',
    bajada: 'que generan valor',
  },
  {
    icono: '🤝',
    titulo: 'Acompañamiento',
    bajada: 'que hace crecer',
  },
];

const VALORES = [
  {
    icono: '💡',
    titulo: 'Claridad',
    bajada: 'para entender tu negocio.',
  },
  {
    icono: '✅',
    titulo: 'Seguridad',
    bajada: 'para tomar decisiones.',
  },
  {
    icono: '📊',
    titulo: 'Crecimiento',
    bajada: 'para alcanzar tus objetivos.',
  },
];

export function PieVisao({
  colores,
}: {
  colores: {
    azul: string;
    verde: string;
    blanco: string;
  };
}) {
  return (
    <footer
      style={{
        background: colores.blanco,
        borderRadius: 24,
        padding: 28,
        marginTop: 20,
        border: '1px solid #e5e7eb',
        boxShadow: '0 10px 28px rgba(31,58,95,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* =================================================
          MARCA OFICIAL + LEMA
      ================================================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_VISAO_FINANCEIRA}
            alt="Visão Financeira"
            style={{
              width: 300,
              maxWidth: '100%',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: 0.6,
          color: colores.azul,
        }}
      >
        CLARIDAD PARA{' '}
        <span style={{ color: colores.verde }}>DECIDIR</span>.{' '}
        SEGURIDAD PARA{' '}
        <span style={{ color: colores.verde }}>CRECER</span>.
      </div>

      <p
        style={{
          margin: '12px auto 0',
          maxWidth: 620,
          textAlign: 'center',
          fontSize: 13.5,
          lineHeight: 1.6,
          color: '#6e7781',
        }}
      >
        Transformamos información financiera en{' '}
        <strong style={{ color: colores.verde }}>
          claridad
        </strong>{' '}
        para que tomes mejores decisiones y hagas crecer tu negocio con{' '}
        <strong style={{ color: colores.verde }}>
          seguridad
        </strong>
        .
      </p>

      {/* =================================================
          PILARES
      ================================================== */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginTop: 24,
          paddingTop: 22,
          borderTop: '1px solid #e5e7eb',
        }}
      >
        {PILARES.map((pilar) => (
          <div
            key={pilar.titulo}
            style={{
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 24,
                marginBottom: 8,
              }}
            >
              {pilar.icono}
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: colores.azul,
              }}
            >
              {pilar.titulo}
            </div>

            <div
              style={{
                fontSize: 11.5,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: '#6e7781',
                marginTop: 2,
              }}
            >
              {pilar.bajada}
            </div>
          </div>
        ))}
      </div>

      {/* =================================================
          PROPÓSITO + VALORES
      ================================================== */}

      <div
        style={{
          marginTop: 24,
          borderRadius: 18,
          background: colores.azul,
          color: colores.blanco,
          padding: '20px 22px',
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: colores.verde,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            ⭐
          </div>

          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: 1.2,
                color: '#86efac',
                marginBottom: 5,
              }}
            >
              NUESTRO PROPÓSITO
            </div>

            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.55,
                opacity: 0.92,
              }}
            >
              Ser tu aliado estratégico en la gestión financiera
              para que tu negocio crezca más, mejor y con visión.
            </div>
          </div>
        </div>

        {VALORES.map((valor) => (
          <div
            key={valor.titulo}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {valor.icono}
            </div>

            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              <strong
                style={{
                  letterSpacing: 0.5,
                }}
              >
                {valor.titulo}
              </strong>

              <div
                style={{
                  opacity: 0.85,
                }}
              >
                {valor.bajada}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* =================================================
          PIE DE MARCA
      ================================================== */}

      <div
        style={{
          marginTop: 18,
          textAlign: 'center',
          fontSize: 11.5,
          color: '#9aa4ad',
        }}
      >
        Visão Financeira · Plataforma de gestión financiera
      </div>
    </footer>
  );
}
