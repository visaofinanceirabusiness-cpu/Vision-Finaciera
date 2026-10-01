'use client';

// EQUIPE — invitar y dar de baja Asistentes (Bloque E1)
// Rol pensado para empleados de un cliente que solo cargan datos: no
// editan, no eliminan, no ven Informes. Por ahora eso se cubre a nivel
// de frontend (se oculta lo que no deben ver); el bloqueo real a nivel
// de base de datos (RLS) es la pasada de E3.
//
// Extraído de app/configuracoes/page.tsx — mismo comportamiento, solo
// en su propio archivo.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  crearInvitacionAsistente,
  listarInvitacionesPendientes,
  listarPerfilesPorTipo,
  revocarInvitacion,
  cambiarActivoPerfil,
  urlInvitacion,
  type Invitacion,
  type PerfilConRol,
} from '@/lib/invitaciones';
import { COLORES, campo, label, inputFormulario, botonSecundario, errorStyle, mensajeOkStyle } from './estilosCompartidos';

export function GestionAsistentes({ empresaId, esFamiliar, idioma }: { empresaId: string; esFamiliar: boolean; idioma: string }) {
  const esPt = idioma === 'PT';
  const etiqueta = esFamiliar ? 'Colaborador' : esPt ? 'Assistente' : 'Asistente';
  const etiquetaPlural = esFamiliar ? 'Colaboradores' : esPt ? 'Assistentes' : 'Asistentes';
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ultimoLink, setUltimoLink] = useState('');

  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [asistentes, setAsistentes] = useState<PerfilConRol[]>([]);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);

  async function cargar() {
    const [{ data: inv }, { data: asist }] = await Promise.all([
      listarInvitacionesPendientes('ASISTENTE', empresaId),
      listarPerfilesPorTipo('ASISTENTE', empresaId),
    ]);
    setInvitaciones((inv ?? []) as Invitacion[]);
    setAsistentes((asist ?? []) as PerfilConRol[]);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function invitar() {
    if (!email.trim() || !nombre.trim()) {
      setError(esPt ? 'Preencha o email e o nome da pessoa.' : 'Completá el email y el nombre de la persona.');
      return;
    }

    setError('');
    setMensaje('');
    setEnviando(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error: errorCrear } = await crearInvitacionAsistente(email, nombre, empresaId, userData.user.id);

    setEnviando(false);

    if (errorCrear || !data) {
      setError(
        esPt
          ? `Não foi possível criar o convite: ${errorCrear?.message ?? 'erro desconhecido'}.`
          : `No se pudo crear la invitación: ${errorCrear?.message ?? 'error desconocido'}.`
      );
      return;
    }

    const link = urlInvitacion(data.token);
    setUltimoLink(link);
    setMensaje(
      esPt
        ? `Convite criado para ${nombre.trim()}. Copie o link abaixo e envie por WhatsApp ou email.`
        : `Invitación creada para ${nombre.trim()}. Copiá el link de abajo y mandaselo por WhatsApp o email.`
    );
    setEmail('');
    setNombre('');
    await cargar();
  }

  async function revocar(id: string) {
    setCambiandoId(id);
    await revocarInvitacion(id);
    await cargar();
    setCambiandoId(null);
  }

  async function cambiarActivo(perfilId: string, activo: boolean) {
    setCambiandoId(perfilId);
    await cambiarActivoPerfil(perfilId, activo);
    await cargar();
    setCambiandoId(null);
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 17, color: COLORES.azul }}>👥 Equipe</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: COLORES.gris }}>
        {esPt
          ? `Convide alguém como ${etiqueta}: pode carregar dados, mas não edita, não exclui e não vê Relatórios.`
          : `Invitá a alguien como ${etiqueta}: puede cargar datos, pero no edita, no elimina y no ve Informes.`}
      </p>

      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={mensajeOkStyle}>{mensaje}</div>}
      {ultimoLink && (
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 13px', marginBottom: 16, fontSize: 12, wordBreak: 'break-all', color: COLORES.azul }}>
          {ultimoLink}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={campo}>
          <label style={label}>Email</label>
          <input style={inputFormulario} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@email.com" />
        </div>
        <div style={campo}>
          <label style={label}>{esPt ? 'Nome' : 'Nombre'}</label>
          <input style={inputFormulario} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={esPt ? 'Ex: Pedro' : 'Ej: Pedro'} />
        </div>
      </div>

      <button type="button" disabled={enviando} onClick={invitar} style={botonSecundario}>
        {enviando ? (esPt ? 'Convidando...' : 'Invitando...') : `${esPt ? 'Convidar como' : 'Invitar como'} ${etiqueta}`}
      </button>

      {invitaciones.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: COLORES.gris, textTransform: 'uppercase', marginBottom: 8 }}>
            {esPt ? 'Convites pendentes' : 'Invitaciones pendientes'}
          </div>
          {invitaciones.map((inv) => (
            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb', marginBottom: 6, fontSize: 12.5 }}>
              <span>{inv.nombre} · {inv.email}</span>
              <button type="button" disabled={cambiandoId === inv.id} onClick={() => revocar(inv.id)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', color: COLORES.gris }}>
                {esPt ? 'Revogar' : 'Revocar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {asistentes.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: COLORES.gris, textTransform: 'uppercase', marginBottom: 8 }}>{etiquetaPlural}</div>
          {asistentes.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: a.activo ? '#f0fdf4' : '#fef2f2', border: `1px solid ${a.activo ? '#bbf7d0' : '#fecaca'}`, marginBottom: 6, fontSize: 12.5 }}>
              <span>{a.nombre} — {a.activo ? (esPt ? 'ativo' : 'activo') : (esPt ? 'desativado' : 'dado de baja')}</span>
              <button
                type="button"
                disabled={cambiandoId === a.id}
                onClick={() => cambiarActivo(a.id, !a.activo)}
                style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', color: a.activo ? '#b91c1c' : '#166534' }}
              >
                {a.activo ? (esPt ? 'Desativar' : 'Dar de baja') : (esPt ? 'Reativar' : 'Reactivar')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
