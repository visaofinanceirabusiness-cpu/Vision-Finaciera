'use client';

// WHATSAPP — las ventas y cobros de la empresa con el nombre del cliente, para mandarle el comprobante completo (cantidad, producto,
// precio por unidad, total y forma de pago) o abrir un chat con un toque. No hay WhatsApp Business API: se abre WhatsApp con el
// mensaje ya armado y la persona toca «Enviar». El teléfono es el que ya se carga en Recursos Humanos → Clientes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useEnShell } from '@/components/shell/ShellContext';
import { simboloMoneda } from '@/lib/moneda';
import { fechaLocalHoy } from '@/lib/fecha';
import { enlaceWhatsapp } from '@/lib/whatsapp';
import { enlaceChat, listarVentasWhatsapp, mensajeDeVenta, type VentaWhatsapp } from '@/lib/whatsappVentas';

const COLORES = { azul: 'var(--color-primario, #1f3a5f)', verde: 'var(--color-secundario, #2e8b57)', gris: 'var(--color-acento, #6e7781)', blanco: '#ffffff', wa: '#25D366' };

type Periodo = 'HOY' | '7' | '30' | 'TODO';

function restarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

// «Ya enviado» es una comodidad de este navegador (no se comparte entre dispositivos).
function leerEnviados(empresaId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(`wa-enviados-${empresaId}`) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function guardarEnviados(empresaId: string, ids: Set<string>) {
  try {
    localStorage.setItem(`wa-enviados-${empresaId}`, JSON.stringify([...ids].slice(-500)));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

export default function WhatsappPage() {
  const enShell = useEnShell();
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<{ nombre: string; idioma: string; simbolo: string }>({ nombre: '', idioma: 'ES', simbolo: '$' });
  const [ventas, setVentas] = useState<VentaWhatsapp[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [busqueda, setBusqueda] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<string | null>(null);

  const pt = empresa.idioma === 'PT';
  const t = (es: string, p: string) => (pt ? p : es);

  const cargar = useCallback(async (id: string, p: Periodo) => {
    setCargando(true);
    setError('');
    try {
      const desde = p === 'HOY' ? fechaLocalHoy() : p === 'TODO' ? null : restarDias(fechaLocalHoy(), Number(p));
      setVentas(await listarVentasWhatsapp(id, desde));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las ventas.');
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    let vivo = true;
    async function iniciar() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.push('/login');
        return;
      }
      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', u.user.id).maybeSingle();
      if (!perfil?.empresa_id) {
        setError('No se pudo identificar la empresa del usuario.');
        setCargando(false);
        return;
      }
      const id = perfil.empresa_id as string;
      const { data: e } = await supabase.from('empresas').select('nombre, idioma, moneda').eq('id', id).maybeSingle();
      if (!vivo) return;
      setEmpresa({ nombre: (e?.nombre as string) ?? '', idioma: e?.idioma === 'PT' ? 'PT' : 'ES', simbolo: simboloMoneda(e?.moneda as string | null) });
      setEmpresaId(id);
      setEnviados(leerEnviados(id));
    }
    void iniciar();
    return () => {
      vivo = false;
    };
  }, [router]);

  useEffect(() => {
    if (empresaId) void cargar(empresaId, periodo);
  }, [empresaId, periodo, cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ventas.filter((v) => (!q || v.cliente.toLowerCase().includes(q) || v.idOperacion.toLowerCase().includes(q) || v.detalle.toLowerCase().includes(q)) && (!soloPendientes || !enviados.has(v.idOperacion)));
  }, [ventas, busqueda, soloPendientes, enviados]);

  const conTelefono = ventas.filter((v) => v.telefono).length;
  const sinEnviar = ventas.filter((v) => v.telefono && !enviados.has(v.idOperacion)).length;
  const dinero = (n: number) => `${empresa.simbolo} ${n.toLocaleString(pt ? 'pt-BR' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function marcarEnviado(id: string) {
    if (!empresaId) return;
    const nuevo = new Set(enviados).add(id);
    setEnviados(nuevo);
    guardarEnviados(empresaId, nuevo);
  }

  const chip = (activo: boolean): React.CSSProperties => ({ border: `1.5px solid ${activo ? COLORES.wa : '#d1d5db'}`, background: activo ? '#e7f9ef' : '#fff', color: activo ? '#166534' : COLORES.azul, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' });
  const boton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '9px 14px', fontSize: 13.5, fontWeight: 800, textDecoration: 'none', cursor: 'pointer', border: 'none' };

  return (
    <main style={{ minHeight: enShell ? 'auto' : '100vh', background: 'var(--fondo-app, linear-gradient(180deg, #f5f7f9 0%, #e8eff6 100%))', padding: '24px 20px 48px', color: COLORES.azul }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
          <span aria-hidden style={{ width: 54, height: 54, borderRadius: 16, background: COLORES.wa, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>💬</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>WhatsApp</h1>
            <p style={{ margin: '2px 0 0', fontSize: 14.5, color: COLORES.gris }}>{t('Tus ventas con el nombre del cliente: mandá el comprobante o abrí el chat con un toque.', 'Suas vendas com o nome do cliente: envie o comprovante ou abra o chat com um toque.')}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 12px' }}>
          {([['HOY', t('Hoy', 'Hoje')], ['7', t('7 días', '7 dias')], ['30', t('30 días', '30 dias')], ['TODO', t('Todo', 'Tudo')]] as Array<[Periodo, string]>).map(([valor, etiqueta]) => (
            <button key={valor} type="button" onClick={() => setPeriodo(valor)} style={chip(periodo === valor)}>{etiqueta}</button>
          ))}
          <button type="button" onClick={() => setSoloPendientes((x) => !x)} style={chip(soloPendientes)}>{soloPendientes ? '✓ ' : ''}{t('Sin enviar', 'Sem enviar')}</button>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t('Buscar cliente, número o detalle', 'Buscar cliente, número ou detalhe')}
            style={{ flex: '1 1 220px', minWidth: 0, border: '1.5px solid #d1d5db', borderRadius: 999, padding: '8px 14px', fontSize: 14 }}
          />
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: COLORES.gris }}>
          {ventas.length} {t('ventas', 'vendas')} · {conTelefono} {t('con teléfono', 'com telefone')} · <strong style={{ color: '#166534' }}>{sinEnviar} {t('para enviar', 'para enviar')}</strong>
        </p>

        {error && <p style={{ color: '#dc2626', fontSize: 14 }}>{error}</p>}
        {cargando && <p style={{ color: COLORES.gris }}>{t('Cargando…', 'Carregando…')}</p>}
        {!cargando && !error && visibles.length === 0 && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 24, textAlign: 'center', color: COLORES.gris }}>
            {t('No hay ventas para mostrar en este período.', 'Não há vendas para mostrar neste período.')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibles.map((v) => {
            const mensaje = mensajeDeVenta(v, empresa.nombre, empresa.idioma, empresa.simbolo);
            const ya = enviados.has(v.idOperacion);
            return (
              <article key={v.idOperacion} style={{ background: '#fff', border: `1px solid ${ya ? '#bbf0d1' : '#e5e7eb'}`, borderRadius: 16, padding: '14px 16px', boxShadow: '0 4px 14px rgba(31,58,95,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{v.cliente || t('Sin cliente', 'Sem cliente')}</div>
                    <div style={{ fontSize: 13, color: COLORES.gris, marginTop: 2 }}>
                      {v.idOperacion} · {new Date(`${v.fecha}T12:00:00`).toLocaleDateString(pt ? 'pt-BR' : 'es-AR')} · {v.formaPago || '—'}
                    </div>
                    {v.detalle && <div style={{ fontSize: 13.5, marginTop: 4 }}>{v.detalle}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: COLORES.verde }}>{dinero(v.total)}</div>
                    {ya && <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✓ {t('Enviado', 'Enviado')}</div>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                  {v.telefono ? (
                    <>
                      <a href={enlaceWhatsapp(v.telefono, mensaje)} target="_blank" rel="noopener noreferrer" onClick={() => marcarEnviado(v.idOperacion)} style={{ ...boton, background: COLORES.wa, color: '#fff' }}>
                        📲 {t('Enviar comprobante', 'Enviar comprovante')}
                      </a>
                      <a href={enlaceChat(v.telefono)} target="_blank" rel="noopener noreferrer" style={{ ...boton, background: '#e7f9ef', color: '#166534', border: `1px solid ${COLORES.wa}` }}>
                        💬 {t('Abrir chat', 'Abrir chat')}
                      </a>
                    </>
                  ) : (
                    <span style={{ fontSize: 13, color: '#b45309', fontWeight: 700 }}>
                      {v.cliente ? t('Este cliente no tiene teléfono.', 'Este cliente não tem telefone.') : t('La venta no tiene cliente.', 'A venda não tem cliente.')}{' '}
                      {v.cliente && <Link href="/recursos-humanos" style={{ color: COLORES.azul }}>{t('Cargar teléfono', 'Cadastrar telefone')}</Link>}
                    </span>
                  )}
                  <button type="button" onClick={() => setAbierta(abierta === v.idOperacion ? null : v.idOperacion)} style={{ ...boton, background: 'transparent', color: COLORES.azul, textDecoration: 'underline' }}>
                    {abierta === v.idOperacion ? t('Ocultar mensaje', 'Ocultar mensagem') : t('Ver mensaje', 'Ver mensagem')}
                  </button>
                </div>

                {abierta === v.idOperacion && (
                  <pre style={{ margin: '10px 0 0', padding: '10px 12px', background: '#f0fdf4', borderRadius: 10, fontSize: 12.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{mensaje}</pre>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
