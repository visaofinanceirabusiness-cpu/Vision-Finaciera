'use client';
const SABIO_URL =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/SABIO_3D_WEBP_ligero.webp';

export function SabioHero({
  colores,
  nombreEmpresa,
  mensajeBienvenida,
  subtitulo,
  hoy,
}: {
  colores: { azul: string; verde: string; blanco: string };
  nombreEmpresa: string | null | undefined;
  mensajeBienvenida: string;
  subtitulo: string;
  hoy: string;
}) {
  return (
    <section style={{ background: `linear-gradient(125deg, ${colores.azul} 0%, ${colores.azul} 58%, ${colores.verde} 100%)`, color: colores.blanco, borderRadius: 28, padding: '30px 32px', marginBottom: 20, boxShadow: '0 18px 40px rgba(31,58,95,0.16)' }}>
      <style>{`
        @keyframes sabioFlota {
          0% { transform: translateY(18px) scale(1.08); }
          50% { transform: translateY(8px) scale(1.10); }
          100% { transform: translateY(18px) scale(1.08); }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.75, marginBottom: 8 }}>MI NEGOCIO</div>
          <h1 style={{ margin: 0, fontSize: 34 }}>{nombreEmpresa}</h1>
          <p style={{ margin: '10px 0 0', fontSize: 19, fontWeight: 600 }}>{mensajeBienvenida}</p>
          <p style={{ margin: '6px 0 0', opacity: 0.82, fontSize: 14 }}>{subtitulo}</p>
          <p style={{ margin: '10px 0 0', opacity: 0.68, fontSize: 12 }}>{hoy}</p>
        </div>
        <div style={{ width: 240, minHeight: 220, borderRadius: 24, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 18px', flexShrink: 0, overflow: 'visible' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, opacity: 0.78, marginBottom: 4 }}>SABIO</div>
          <div style={{ position: 'relative', width: 210, height: 180, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'visible' }}>
            <img src={SABIO_URL} alt="Sabio - asistente inteligente de Visão Financeira" style={{ width: 205, height: 205, objectFit: 'contain', display: 'block', transform: 'translateY(18px) scale(1.08)', filter: 'drop-shadow(0 18px 18px rgba(0,0,0,0.25))', animation: 'sabioFlota 3.8s ease-in-out infinite' }} />
          </div>
          <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, opacity: 0.90, textAlign: 'center' }}>Tu compañero financiero</div>
        </div>
      </div>
    </section>
  );
}
