'use client';

// PESTAÑA 3 · LIBRO DIARIO
//
// Extraído de app/contabilidad/page.tsx — mismo comportamiento, solo
// en su propio archivo (Fase 2 de mantenimiento).

import { useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatearNumeroEntero } from '@/lib/moneda';
import { crearTraductor, nombreOperacionDisplay } from '@/lib/i18n';
import { armarMensajeComprobante, buscarTelefonoCliente, empresaTieneTelefonoValido, enlaceWhatsapp } from '@/lib/whatsapp';
import {
  diccionarioContabilidad,
  msgErrorOperaciones,
  msgErrorAutomaticos,
  msgErrorEmpresa,
  contadorAsientos,
} from '@/app/contabilidad/i18n';
import { SimboloContext, EsFamiliarContext, IdiomaContext, COLORES } from './compartido';
import { campoInput, tablaContenedorInterna, vacioOperacion, cuentaDebe, cuentaHaber } from './estilosCompartidos';
import { Th, Td, Estado } from './celdas';

/* ==========================================================
   PESTAÑA 3 · LIBRO DIARIO
========================================================== */

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
  // Solo presentes en filas tipo_registro==='OPERACION' — se usan
  // para poder reenviar el comprobante de una Venta ya validada
  // (ver BotonReenviarComprobante). Los registros_automaticos
  // (CMV, etc.) no tienen cliente ni forma de pago propia.
  cliente_proveedor?: string | null;
  forma_pago?: string | null;
};

type GrupoOperacion = {
  id_operacion: string;
  fecha: string;
  filas: MovimientoDiario[];
};

export function LibroDiarioTab() {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const esFamiliar = useContext(EsFamiliarContext);
  const t = crearTraductor(diccionarioContabilidad, idioma);
  const router = useRouter();

  const [filas, setFilas] = useState<MovimientoDiario[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState('');

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
          estado,
          cliente_proveedor,
          forma_pago
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
      setError(msgErrorOperaciones(idioma, errorOperaciones.message));
      setFilas([]);
      return;
    }

    if (errorAutomaticos) {
      setError(msgErrorAutomaticos(idioma, errorAutomaticos.message));
      setFilas([]);
      return;
    }

    const filasOperacion: MovimientoDiario[] = (operaciones ?? []).map((fila) => ({
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
      cliente_proveedor: fila.cliente_proveedor,
      forma_pago: fila.forma_pago,
    }));

    const filasAutomaticas: MovimientoDiario[] = (automaticos ?? []).map((fila) => ({
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

    const combinadas = [...filasOperacion, ...filasAutomaticas];

    combinadas.sort((a, b) => {
      const numeroA = parseInt(String(a.id_operacion).replace('OP-', ''), 10) || 0;
      const numeroB = parseInt(String(b.id_operacion).replace('OP-', ''), 10) || 0;

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
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil, error: errorPerfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (errorPerfil || !perfil?.empresa_id) {
        setError(msgErrorEmpresa(idioma));
        setCargando(false);
        return;
      }

      setEmpresaId(perfil.empresa_id);

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nombre')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      setNombreEmpresa(empresaData?.nombre ?? '');

      await cargar(perfil.empresa_id);
      setCargando(false);
    }

    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) {
      return filas;
    }

    return filas.filter((fila) =>
      [fila.id_operacion, fila.operacion, fila.historico, fila.cuenta_debito, fila.cuenta_credito, fila.estado, fila.tipo_registro]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(texto)
    );
  }, [filas, busqueda]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, GrupoOperacion>();

    for (const fila of visibles) {
      const existente = mapa.get(fila.id_operacion);

      if (existente) {
        existente.filas.push(fila);
      } else {
        mapa.set(fila.id_operacion, {
          id_operacion: fila.id_operacion,
          fecha: fila.fecha,
          filas: [fila],
        });
      }
    }

    return Array.from(mapa.values());
  }, [visibles]);

  const totalAsientos = visibles.length;
  const totalImportes = visibles.reduce((suma, fila) => suma + Number(fila.importe ?? 0), 0);
  const totalOperaciones = grupos.length;

  return (
    <div>
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
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={t('buscarLibroDiario')}
          style={{ ...campoInput, maxWidth: 460 }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Resumen titulo={t('resumenOperaciones')} valor={String(totalOperaciones)} />
          <Resumen titulo={t('resumenAsientos')} valor={String(totalAsientos)} />
          <Resumen titulo={t('resumenImportes')} valor={`${simbolo} ${formatearNumeroEntero(totalImportes)}`} />
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
        <p>{t('cargandoLibroDiario')}</p>
      ) : (
        <div>
          {!grupos.length ? (
            <div style={vacioOperacion}>{t('sinMovimientosContables')}</div>
          ) : (
            grupos.map((grupo) => (
              <GrupoOperacionCard
                key={grupo.id_operacion}
                grupo={grupo}
                empresaId={empresaId}
                nombreEmpresa={nombreEmpresa}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function GrupoOperacionCard({
  grupo,
  empresaId,
  nombreEmpresa,
}: {
  grupo: GrupoOperacion;
  empresaId: string | null;
  nombreEmpresa: string;
}) {
  const simbolo = useContext(SimboloContext);
  const idioma = useContext(IdiomaContext);
  const esFamiliar = useContext(EsFamiliarContext);
  const t = crearTraductor(diccionarioContabilidad, idioma);
  const importeGrupo = grupo.filas.reduce((suma, fila) => suma + Number(fila.importe ?? 0), 0);

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          padding: '14px 18px',
          background: 'linear-gradient(90deg, #eff5f9, #f8fafc)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: COLORES.azul }}>{grupo.id_operacion}</span>

          <span style={{ fontSize: 12, color: COLORES.gris }}>
            {new Date(`${grupo.fecha}T12:00:00`).toLocaleDateString(idioma === 'PT' ? 'pt-BR' : 'es-AR')}
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
            {contadorAsientos(idioma, grupo.filas.length)}
          </span>
        </div>

        <div style={{ fontSize: 13, color: COLORES.gris }}>
          {t('importeRegistrado')} <strong style={{ color: COLORES.azul }}>{simbolo} {formatearNumeroEntero(importeGrupo)}</strong>
        </div>
      </div>

      <div style={tablaContenedorInterna}>
        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <Th>{t('tipoHeader')}</Th>
              <Th>{t('operacion')}</Th>
              <Th>{t('historico')}</Th>
              <Th>{t('debeHeader')}</Th>
              <Th>{t('haberHeader')}</Th>
              <Th align="right">{t('importeHeader')}</Th>
              <Th>{t('estadoHeader')}</Th>
            </tr>
          </thead>

          <tbody>
            {grupo.filas.map((fila, indice) => (
              <tr
                key={`${fila.id_operacion}-${fila.tipo_registro}-${indice}`}
                style={{ borderTop: '1px solid #edf1f4' }}
              >
                <Td>
                  <TipoRegistro tipo={fila.tipo_registro} idioma={idioma} />
                </Td>

                <Td>
                  <strong style={{ color: COLORES.azul }}>{nombreOperacionDisplay(idioma, fila.operacion, esFamiliar)}</strong>
                </Td>

                <Td>{fila.historico || '—'}</Td>

                <Td>
                  <span style={cuentaDebe}>{fila.cuenta_debito || '—'}</span>
                </Td>

                <Td>
                  <span style={cuentaHaber}>{fila.cuenta_credito || '—'}</span>
                </Td>

                <Td align="right">
                  <strong>{simbolo} {formatearNumeroEntero(Number(fila.importe ?? 0))}</strong>
                </Td>

                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Estado estado={fila.estado} idioma={idioma} />

                    {empresaId &&
                      fila.tipo_registro === 'OPERACION' &&
                      fila.operacion === 'VENTA' &&
                      (fila.estado || '').toUpperCase() === 'VALIDADO' &&
                      fila.cliente_proveedor && (
                        <BotonReenviarComprobante
                          empresaId={empresaId}
                          nombreEmpresa={nombreEmpresa}
                          idioma={idioma}
                          simbolo={simbolo}
                          fila={fila}
                        />
                      )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Reenvía el comprobante de una Venta ya validada — misma mecánica
// que el botón que aparece al registrar (ver lib/whatsapp.ts), pero
// reconstruyendo el mensaje a partir de la fila del Libro Diario en
// vez de tenerlo ya armado en memoria.
function BotonReenviarComprobante({
  empresaId,
  nombreEmpresa,
  idioma,
  simbolo,
  fila,
}: {
  empresaId: string;
  nombreEmpresa: string;
  idioma: string | null;
  simbolo: string;
  fila: MovimientoDiario;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const esPT = idioma === 'PT';

  async function reenviar() {
    setEnviando(true);
    setError('');

    try {
      const telefono = await buscarTelefonoCliente(empresaId, fila.cliente_proveedor ?? '');

      if (!empresaTieneTelefonoValido(telefono)) {
        setError(esPT ? 'Esse cliente não tem telefone cadastrado.' : 'Ese cliente no tiene teléfono cargado.');
        return;
      }

      const mensaje = armarMensajeComprobante({
        idioma,
        nombreEmpresa: nombreEmpresa || (esPT ? 'Meu Negócio' : 'Mi Negocio'),
        numeroComprobante: fila.id_operacion,
        fecha: fila.fecha,
        cliente: fila.cliente_proveedor ?? '',
        detalle: fila.historico ?? '',
        formaPago: fila.forma_pago ?? '',
        total: Number(fila.importe ?? 0),
        simboloMoneda: simbolo,
      });

      window.open(enlaceWhatsapp(telefono as string, mensaje), '_blank', 'noopener,noreferrer');
    } catch (errorReenviar) {
      setError((errorReenviar as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <button
        onClick={reenviar}
        disabled={enviando}
        style={{
          border: 'none',
          background: '#25D366',
          color: '#fff',
          borderRadius: 8,
          padding: '4px 9px',
          fontSize: 11,
          fontWeight: 700,
          cursor: enviando ? 'default' : 'pointer',
          opacity: enviando ? 0.7 : 1,
        }}
      >
        📲 {esPT ? 'Reenviar comprovante' : 'Reenviar comprobante'}
      </button>

      {error && <span style={{ fontSize: 10, color: '#dc2626' }}>{error}</span>}
    </span>
  );
}


function TipoRegistro({ tipo, idioma }: { tipo: 'OPERACION' | 'AUTOMATICO'; idioma: string | null }) {
  const automatico = tipo === 'AUTOMATICO';
  const t = crearTraductor(diccionarioContabilidad, idioma);

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: automatico ? '#ede9fe' : '#eaf7ee',
        color: automatico ? '#6d28d9' : '#247347',
      }}
    >
      {automatico ? t('automatico') : t('operacionEtiqueta')}
    </span>
  );
}


function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 10, padding: '9px 13px', minWidth: 105 }}>
      <div style={{ fontSize: 10, color: COLORES.gris, marginBottom: 2 }}>{titulo}</div>

      <strong style={{ color: COLORES.azul, fontSize: 14 }}>{valor}</strong>
    </div>
  );
}
