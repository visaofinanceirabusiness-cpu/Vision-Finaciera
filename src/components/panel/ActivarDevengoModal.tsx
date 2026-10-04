'use client';

// ACTIVAR "MES A MES" EN UNA PLANTILLA (gastos e ingresos)
//
// Se abre al tildar "Mes a mes". Se elige:
//   - monto fijo o variable;
//   - la cuenta: por defecto una INDIVIDUAL con el nombre de la plantilla
//     ("Netflix a pagar"), que se busca en el plan y, si no existe, se crea;
//     o una existente del plan;
//   - opcionalmente, un GRUPO del que cuelga la individual ("Suscripciones a
//     pagar"), existente o nuevo.
// Sirve para los dos lados: quien lo usa le pasa las funciones que cargan las
// opciones y que activan (ver MisVencimientos / MisIngresos).

import { useEffect, useState } from 'react';
import { nombreCuentaCompromiso, type LadoCompromiso } from '@/lib/cuentasCompromisoNombres';
import type { GrupoCuentas, OpcionCuenta, OpcionesActivacion } from '@/lib/cuentasCompromiso';

type Colores = { azul: string; verde: string; blanco: string };

export type OpcionesCargadas = {
  existentes: OpcionCuenta[];
  grupos: GrupoCuentas[];
  // ¿Ya hay en el plan una cuenta con el nombre automático de la plantilla?
  individualYaExiste: boolean;
};

export function ActivarDevengoModal({
  modo = 'ACTIVAR',
  lado,
  nombrePlantilla,
  idioma,
  colores,
  cargarOpciones,
  onActivar,
  onClose,
}: {
  // MIGRAR: pasa una plantilla que ya devenga con la cuenta general a su cuenta propia
  // (solo individual, con grupo opcional: la general se renombra, no queda huérfana).
  modo?: 'ACTIVAR' | 'MIGRAR';
  lado: LadoCompromiso;
  nombrePlantilla: string;
  idioma: string;
  colores: Colores;
  cargarOpciones: () => Promise<OpcionesCargadas>;
  onActivar: (opciones: OpcionesActivacion) => Promise<void>;
  onClose: () => void;
}) {
  const esPT = idioma === 'PT';
  const [opciones, setOpciones] = useState<OpcionesCargadas | null>(null);
  const [montoFijo, setMontoFijo] = useState(true);
  const [modoCuenta, setModoCuenta] = useState<'INDIVIDUAL' | 'EXISTENTE'>('INDIVIDUAL');
  const [formaPagoId, setFormaPagoId] = useState('');
  const [agrupar, setAgrupar] = useState(false);
  const [grupoElegido, setGrupoElegido] = useState('');
  const [grupoNuevo, setGrupoNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarOpciones()
      .then(setOpciones)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error inesperado.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nombreIndividual = nombreCuentaCompromiso(nombrePlantilla, lado);
  const crearGrupoNuevo = grupoElegido === '__nuevo';

  async function activar() {
    setError('');

    if (modoCuenta === 'EXISTENTE' && !formaPagoId) {
      setError(esPT ? 'Escolha a conta.' : 'Elegí la cuenta.');
      return;
    }

    if (modoCuenta === 'INDIVIDUAL' && agrupar && !grupoElegido) {
      setError(esPT ? 'Escolha o grupo.' : 'Elegí el grupo.');
      return;
    }

    if (modoCuenta === 'INDIVIDUAL' && agrupar && crearGrupoNuevo && !grupoNuevo.trim()) {
      setError(esPT ? 'Escreva o nome do grupo novo.' : 'Escribí el nombre del grupo nuevo.');
      return;
    }

    setGuardando(true);

    try {
      await onActivar({
        montoFijo,
        cuenta: modoCuenta === 'EXISTENTE' ? { modo: 'EXISTENTE', formaPagoId } : { modo: 'INDIVIDUAL' },
        grupo:
          modoCuenta === 'INDIVIDUAL' && agrupar && (modo === 'MIGRAR' || !opciones?.individualYaExiste)
            ? crearGrupoNuevo
              ? { nombre: grupoNuevo }
              : { id: grupoElegido }
            : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
      setGuardando(false);
    }
  }

  const etiqueta: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: colores.azul, margin: '14px 0 6px' };
  const opcion: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#1f2937', cursor: 'pointer', marginBottom: 6, lineHeight: 1.4 };
  const campo: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: colores.blanco, borderRadius: 20, padding: 22, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
      >
        <h3 style={{ margin: '0 0 4px', color: colores.azul, fontSize: 18 }}>
          🔁 {modo === 'MIGRAR' ? (esPT ? 'Passar para conta própria' : 'Pasar a cuenta propia') : esPT ? 'Reconhecer mês a mês' : 'Reconocer mes a mes'}
        </h3>
        <p style={{ margin: 0, fontSize: 12.5, color: '#6e7781', lineHeight: 1.5 }}>
          <strong>{nombrePlantilla}</strong>
          {' — '}
          {lado === 'PAGAR'
            ? esPT
              ? 'o gasto é reconhecido todo dia 1 (Gasto / conta a pagar) e depois você o paga.'
              : 'el gasto se reconoce cada día 1 (Gasto / cuenta a pagar) y después lo pagás.'
            : esPT
              ? 'o ingresso é reconhecido todo dia 1 (conta a receber / Receita) e depois você o recebe.'
              : 'el ingreso se reconoce cada día 1 (cuenta a cobrar / Ingreso) y después lo cobrás.'}
        </p>

        {error && (
          <div style={{ fontSize: 12, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 10px', marginTop: 12 }}>
            {error}
          </div>
        )}

        {modo === 'ACTIVAR' && (
          <>
        <span style={etiqueta}>{esPT ? 'Valor' : 'Monto'}</span>
        <label style={opcion}>
          <input type="radio" checked={montoFijo} onChange={() => setMontoFijo(true)} />
          {esPT ? 'Fixo (igual todo mês): é reconhecido sozinho' : 'Fijo (igual todos los meses): se reconoce solo'}
        </label>
        <label style={opcion}>
          <input type="radio" checked={!montoFijo} onChange={() => setMontoFijo(false)} />
          {esPT ? 'Varia (luz, água...): eu confirmo o valor de cada mês' : 'Varía (luz, agua...): confirmo el monto de cada mes'}
        </label>
          </>
        )}

        <span style={etiqueta}>{lado === 'PAGAR' ? (esPT ? 'Conta a pagar' : 'Cuenta a pagar') : esPT ? 'Conta a receber' : 'Cuenta a cobrar'}</span>
        {!opciones ? (
          <p style={{ fontSize: 12.5, color: '#6e7781' }}>{esPT ? 'Carregando...' : 'Cargando...'}</p>
        ) : (
          <>
            <label style={opcion}>
              <input type="radio" checked={modoCuenta === 'INDIVIDUAL'} onChange={() => setModoCuenta('INDIVIDUAL')} />
              <span>
                {esPT ? 'Individual: ' : 'Individual: '}
                <strong>{nombreIndividual}</strong>
                <br />
                <span style={{ fontSize: 11.5, color: '#6e7781' }}>
                  {modo === 'MIGRAR'
                    ? esPT
                      ? 'A conta geral atual será renomeada com este nome (os lançamentos já feitos a acompanham).'
                      : 'La cuenta general actual se renombra con este nombre (los asientos ya cargados la acompañan).'
                    : opciones.individualYaExiste
                    ? esPT
                      ? 'Já existe no seu plano de contas: será usada.'
                      : 'Ya existe en tu plan de cuentas: se usa esa.'
                    : esPT
                      ? 'Será criada no plano de contas.'
                      : 'Se crea en el plan de cuentas.'}
                </span>
              </span>
            </label>

            {modoCuenta === 'INDIVIDUAL' && (modo === 'MIGRAR' || !opciones.individualYaExiste) && (
              <div style={{ marginLeft: 24, marginBottom: 8 }}>
                <label style={opcion}>
                  <input type="checkbox" checked={agrupar} onChange={(e) => setAgrupar(e.target.checked)} />
                  {esPT ? 'Agrupar com outras (ex.: Assinaturas)' : 'Agrupar con otras (ej.: Suscripciones)'}
                </label>

                {agrupar && (
                  <>
                    <select value={grupoElegido} onChange={(e) => setGrupoElegido(e.target.value)} style={campo}>
                      <option value="">{esPT ? 'Escolha um grupo...' : 'Elegí un grupo...'}</option>
                      {opciones.grupos.map((grupo) => (
                        <option key={grupo.id} value={grupo.id}>
                          {grupo.nombre}
                        </option>
                      ))}
                      <option value="__nuevo">{esPT ? '+ Novo grupo' : '+ Nuevo grupo'}</option>
                    </select>

                    {crearGrupoNuevo && (
                      <>
                        <input
                          value={grupoNuevo}
                          onChange={(e) => setGrupoNuevo(e.target.value)}
                          placeholder={esPT ? 'Nome do grupo (ex.: Assinaturas)' : 'Nombre del grupo (ej.: Suscripciones)'}
                          style={{ ...campo, marginTop: 8 }}
                        />
                        {grupoNuevo.trim() && (
                          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#6e7781' }}>
                            {esPT ? 'Grupo: ' : 'Grupo: '}
                            <strong>{nombreCuentaCompromiso(grupoNuevo, lado)}</strong>
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {modo === 'ACTIVAR' && (
              <label style={opcion}>
                <input type="radio" checked={modoCuenta === 'EXISTENTE'} onChange={() => setModoCuenta('EXISTENTE')} />
                {esPT ? 'Usar outra conta que já existe no plano' : 'Usar otra cuenta que ya existe en el plan'}
              </label>
            )}

            {modo === 'ACTIVAR' && modoCuenta === 'EXISTENTE' && (
              <select value={formaPagoId} onChange={(e) => setFormaPagoId(e.target.value)} style={{ ...campo, marginLeft: 24, width: 'calc(100% - 24px)' }}>
                <option value="">{esPT ? 'Escolha a conta...' : 'Elegí la cuenta...'}</option>
                {opciones.existentes.map((opcionCuenta) => (
                  <option key={opcionCuenta.formaPagoId} value={opcionCuenta.formaPagoId}>
                    {opcionCuenta.nombre}
                    {opcionCuenta.usadaPor.length > 0 ? ` (${opcionCuenta.usadaPor.join(', ')})` : ''}
                  </option>
                ))}
              </select>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={activar}
            disabled={guardando || !opciones}
            style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: 'none', background: colores.verde, color: '#fff', fontWeight: 800, fontSize: 14, cursor: guardando ? 'wait' : 'pointer' }}
          >
            {guardando ? (esPT ? 'Ativando...' : 'Activando...') : modo === 'MIGRAR' ? (esPT ? 'Passar' : 'Pasar') : esPT ? 'Ativar' : 'Activar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid #d1d5db', background: 'transparent', color: '#6e7781', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            {esPT ? 'Cancelar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
