'use client';
export function PeriodSelector({
  periodos,
  periodoSeleccionado,
  onChange,
  colores,
}: {
  periodos: { valor: string; etiqueta: string }[];
  periodoSeleccionado: string;
  onChange: (valor: string) => void;
  colores: { azul: string; verde: string; acento: string; blanco: string };
}) {
  return (
    <section style={{ background: colores.blanco, borderRadius: 18, padding: '15px 18px', marginBottom: 20, border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: colores.verde, marginBottom: 4 }}>PERÍODO DE ANÁLISIS</div>
        <div style={{ fontSize: 13, color: '#6e7781' }}>El dashboard utiliza este período para sus objetivos e indicadores.</div>
      </div>
      <select value={periodoSeleccionado} onChange={(e) => onChange(e.target.value)} style={{ minWidth: 210, padding: '11px 14px', borderRadius: 12, border: `1px solid ${colores.acento}`, background: '#fbfcfd', color: colores.azul, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        {periodos.map((periodo) => (
          <option key={periodo.valor} value={periodo.valor}>{periodo.etiqueta}</option>
        ))}
        <option value="TODOS">Todos los períodos</option>
      </select>
    </section>
  );
}
