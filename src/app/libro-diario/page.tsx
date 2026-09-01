'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
};

type MovimientoDiario = {
  empresa_id: string;
  id_operacion: string;
  fecha: string;
  operacion: string;
  historico: string | null;
  cuenta_debito: string | null;
  cuenta_credito: string | null;
  importe: number;
  estado: string | null;
  tipo_registro: 'OPERACION' | 'AUTOMATICO';
};

type GrupoOperacion = {
  id_operacion: string;
  fecha: string;
  filas: MovimientoDiario[];
};

export default function LibroDiarioPage() {
  const router = useRouter();

  const [filas, setFilas] = useState<MovimientoDiario[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar(empresaId: string) {
    setError('');

    const [
      { data: operaciones, error: errorOperaciones },
      { data: automaticos, error: errorAutomaticos },
    ] = await Promise.all([
      supabase
        .from('registro_operaciones')
        .select(
          `
          empresa_id,
          id_operacion,
          fecha,
          operacion,
          historico,
          cuenta_debito,
          cuenta_credito,
          total,
          estado
          `
        )
        .eq('empresa_id', empresaId),

      supabase
        .from('registros_automaticos')
        .select(
          `
          empresa_id,
          id_operacion,
          fecha,
          tipo_registro,
          historico,
          cuenta_debito,
          cuenta_credito,
          importe,
          estado
          `
        )
        .eq('empresa_id', empresaId),
    ]);

    if (errorOperaciones) {
      setError(
        `No se pudieron cargar las operaciones: ${errorOperaciones.message}`
      );
      setFilas([]);
      return;
    }

    if (errorAutomaticos) {
      setError(
        `No se pudieron cargar los registros automáticos: ${errorAutomaticos.message}`
      );
      setFilas([]);
      return;
    }

    const filasOperacion: MovimientoDiario[] =
      (operaciones ?? []).map((fila) => ({
        empresa_id: fila.empresa_id,
        id_operacion: fila.id_operacion,
        fecha: fila.fecha,
        operacion: fila.operacion,
        historico: fila.historico,
        cuenta_debito: fila.cuenta_debito,
        cuenta_credito: fila.cuenta_credito,
        importe: Number(fila.total ?? 0),
        estado: fila.estado,
        tipo_registro: 'OPERACION',
      }));

    const filasAutomaticas: MovimientoDiario[] =
      (automaticos ?? []).map((fila) => ({
        empresa_id: fila.empresa_id,
        id_operacion: fila.id_operacion,
        fecha: fila.fecha,
        operacion: fila.tipo_registro,
        historico: fila.historico,
        cuenta_debito: fila.cuenta_debito,
        cuenta_credito: fila.cuenta_credito,
        importe: Number(fila.importe ?? 0),
        estado: fila.estado,
        tipo_registro: 'AUTOMATICO',
      }));

    const combinadas = [
      ...filasOperacion,
      ...filasAutomaticas,
    ];

    combinadas.sort((a, b) => {
      const numeroA =
        parseInt(
          String(a.id_operacion).replace('OP-', ''),
          10
        ) || 0;

      const numeroB =
        parseInt(
          String(b.id_operacion).replace('OP-', ''),
          10
        ) || 0;

      if (numeroA !== numeroB) {
        return numeroB - numeroA;
      }

      if (a.tipo_registro !== b.tipo_registro) {
        return a.tipo_registro === 'OPERACION' ? -1 : 1;
      }

      return 0;
    });

    setFilas(combinadas);
  }

  useEffect(() => {
    async function iniciar() {
      const { data: userData } =
        await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil, error: errorPerfil } =
        await supabase
          .from('perfiles')
          .select('empresa_id')
          .eq('id', userData.user.id)
          .maybeSingle();

      if (errorPerfil || !perfil?.empresa_id) {
        setError(
          'No se pudo identificar la empresa.'
        );
        setCargando(false);
        return;
      }

      await cargar(perfil.empresa_id);
      setCargando(false);
    }

    iniciar();
  }, [router]);

  const visibles = useMemo(() => {
    const texto = busqueda
      .trim()
      .toLowerCase();

    if (!texto) {
      return filas;
    }

    return filas.filter((fila) =>
      [
        fila.id_operacion,
        fila.operacion,
        fila.historico,
        fila.cuenta_debito,
        fila.cuenta_credito,
        fila.estado,
        fila.tipo_registro,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(texto)
    );
  }, [filas, busqueda]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, GrupoOperacion>();

    for (const fila of visibles) {
      const existente = mapa.get(
        fila.id_operacion
      );

      if (existente) {
        existente.filas.push(fila);
      } else {
        mapa.set(
          fila.id_operacion,
          {
            id_operacion: fila.id_operacion,
            fecha: fila.fecha,
            filas: [fila],
          }
        );
      }
    }

    return Array.from(mapa.values());
  }, [visibles]);

  const totalAsientos = visibles.length;

  const totalImportes = visibles.reduce(
    (suma, fila) =>
      suma + Number(fila.importe ?? 0),
    0
  );

  const totalOperaciones = grupos.length;

  return (
    <Pantalla
      titulo="Libro Diario"
      subtitulo="Vista contable unificada de las operaciones y registros automáticos."
    >
      {/* ================================
          BARRA DE BÚSQUEDA + RESUMEN
      ================================= */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <input
          type="text"
          value={busqueda}
          onChange={(e) =>
            setBusqueda(e.target.value)
          }
          placeholder="Buscar ID, cuenta, histórico..."
          style={inputStyle}
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <Resumen
            titulo="Operaciones"
            valor={String(totalOperaciones)}
          />

          <Resumen
            titulo="Asientos"
            valor={String(totalAsientos)}
          />

          <Resumen
            titulo="Importes"
            valor={`R$ ${totalImportes.toFixed(2)}`}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {cargando ? (
        <p>Cargando Libro Diario...</p>
      ) : (
        <div>
          {!grupos.length ? (
            <div style={vacioOperacion}>
              No se encontraron movimientos contables.
            </div>
          ) : (
            grupos.map((grupo) => (
              <GrupoOperacionCard
                key={grupo.id_operacion}
                grupo={grupo}
              />
            ))
          )}
        </div>
      )}
    </Pantalla>
  );
}

function GrupoOperacionCard({
  grupo,
}: {
  grupo: GrupoOperacion;
}) {
  const importeGrupo = grupo.filas.reduce(
    (suma, fila) =>
      suma + Number(fila.importe ?? 0),
    0
  );

  return (
    <section
      style={{
        marginBottom: 16,
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      {/* =================================
          CABECERA DEL GRUPO
      ================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          padding: '14px 18px',
          background:
            'linear-gradient(90deg, #eff5f9, #f8fafc)',
          borderBottom:
            '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: COLORES.azul,
            }}
          >
            {grupo.id_operacion}
          </span>

          <span
            style={{
              fontSize: 12,
              color: COLORES.gris,
            }}
          >
            {new Date(
              `${grupo.fecha}T12:00:00`
            ).toLocaleDateString('es-AR')}
          </span>

          <span
            style={{
              padding: '5px 9px',
              borderRadius: 999,
              background: '#eaf7ee',
              color: '#247347',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {grupo.filas.length}{' '}
            {grupo.filas.length === 1
              ? 'asiento'
              : 'asientos'}
          </span>
        </div>

        <div
          style={{
            fontSize: 13,
            color: COLORES.gris,
          }}
        >
          Importe registrado:{' '}
          <strong
            style={{
              color: COLORES.azul,
            }}
          >
            R$ {importeGrupo.toFixed(2)}
          </strong>
        </div>
      </div>

      {/* =================================
          TABLA DEL GRUPO
      ================================== */}
      <div style={tablaContenedorInterna}>
        <table
          style={{
            width: '100%',
            minWidth: 1100,
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr
              style={{
                background: '#fafbfc',
              }}
            >
              <Th>Tipo</Th>
              <Th>Operación</Th>
              <Th>Histórico</Th>
              <Th>Debe</Th>
              <Th>Haber</Th>
              <Th align="right">
                Importe
              </Th>
              <Th>Estado</Th>
            </tr>
          </thead>

          <tbody>
            {grupo.filas.map(
              (fila, indice) => (
                <tr
                  key={`${fila.id_operacion}-${fila.tipo_registro}-${indice}`}
                  style={{
                    borderTop:
                      '1px solid #edf1f4',
                  }}
                >
                  <Td>
                    <TipoRegistro
                      tipo={
                        fila.tipo_registro
                      }
                    />
                  </Td>

                  <Td>
                    <strong
                      style={{
                        color: COLORES.azul,
                      }}
                    >
                      {fila.operacion}
                    </strong>
                  </Td>

                  <Td>
                    {fila.historico || '—'}
                  </Td>

                  <Td>
                    <span
                      style={cuentaDebe}
                    >
                      {fila.cuenta_debito ||
                        '—'}
                    </span>
                  </Td>

                  <Td>
                    <span
                      style={cuentaHaber}
                    >
                      {fila.cuenta_credito ||
                        '—'}
                    </span>
                  </Td>

                  <Td align="right">
                    <strong>
                      R${' '}
                      {Number(
                        fila.importe ?? 0
                      ).toFixed(2)}
                    </strong>
                  </Td>

                  <Td>
                    <Estado
                      estado={fila.estado}
                    />
                  </Td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TipoRegistro({
  tipo,
}: {
  tipo: 'OPERACION' | 'AUTOMATICO';
}) {
  const automatico =
    tipo === 'AUTOMATICO';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: automatico
          ? '#ede9fe'
          : '#eaf7ee',
        color: automatico
          ? '#6d28d9'
          : '#247347',
      }}
    >
      {automatico
        ? 'AUTOMÁTICO'
        : 'OPERACIÓN'}
    </span>
  );
}

function Estado({
  estado,
}: {
  estado: string | null;
}) {
  const valor =
    estado || 'PENDIENTE';

  const validado =
    valor.toUpperCase() === 'VALIDADO';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: validado
          ? '#dcfce7'
          : '#fef3c7',
        color: validado
          ? '#166534'
          : '#92400e',
      }}
    >
      {valor}
    </span>
  );
}

function Resumen({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div
      style={{
        background: '#f1f5f9',
        borderRadius: 10,
        padding: '9px 13px',
        minWidth: 105,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: COLORES.gris,
          marginBottom: 2,
        }}
      >
        {titulo}
      </div>

      <strong
        style={{
          color: COLORES.azul,
          fontSize: 14,
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function Pantalla({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fondo}>
      <div
        style={{
          maxWidth: 1450,
          margin: '0 auto',
        }}
      >
        <header style={encabezado}>
          <Link
            href="/?vista=empresa"
            style={volver}
          >
            ← Volver a Mi Negocio
          </Link>

          <p style={eyebrow}>
            CONTABILIDAD
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: 30,
            }}
          >
            {titulo}
          </h1>

          <p
            style={{
              margin: '8px 0 0',
              color: '#dbe5ef',
              fontSize: 14,
            }}
          >
            {subtitulo}
          </p>
        </header>

        <main style={panel}>
          {children}
        </main>
      </div>
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      style={{
        padding: '11px 14px',
        color: '#374151',
        fontSize: 12,
        textAlign: align,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      style={{
        padding: '11px 14px',
        fontSize: 13,
        textAlign: align,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  );
}

const fondo: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, #e7f1ed 0%, transparent 34%), #f4f7f8',
  padding: '28px 24px 48px',
};

const encabezado: React.CSSProperties = {
  background:
    'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)',
  borderRadius: 24,
  padding: '28px 34px',
  color: COLORES.blanco,
  marginBottom: 24,
  boxShadow:
    '0 18px 40px rgba(20,42,71,0.16)',
};

const volver: React.CSSProperties = {
  color: '#cbd5e1',
  fontSize: 13,
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: 18,
};

const eyebrow: React.CSSProperties = {
  color: '#86efac',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.4,
  margin: '0 0 8px',
};

const panel: React.CSSProperties = {
  background: COLORES.blanco,
  borderRadius: 24,
  padding: 26,
  boxShadow:
    '0 14px 36px rgba(31,58,95,0.10)',
  overflow: 'hidden',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 460,
  padding: '11px 12px',
  borderRadius: 10,
  border:
    '1px solid #d6dee5',
  background: '#fbfcfd',
  boxSizing: 'border-box',
};

const tablaContenedorInterna: React.CSSProperties = {
  overflowX: 'auto',
};

const cuentaDebe: React.CSSProperties = {
  fontWeight: 600,
  color: '#1f3a5f',
};

const cuentaHaber: React.CSSProperties = {
  fontWeight: 600,
  color: '#2e8b57',
};

const vacioOperacion: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: COLORES.gris,
  border:
    '1px dashed #d6dee5',
  borderRadius: 14,
};
