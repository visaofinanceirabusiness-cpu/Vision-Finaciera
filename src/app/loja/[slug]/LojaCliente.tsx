'use client';

// LOJA PÚBLICA (Mi Local) — sin login. Habla solo con las RPCs públicas
// mi_local_tienda_publica / mi_local_crear_pedido. Los precios mostrados
// son informativos: el servidor vuelve a consultarlos al crear el pedido.
// Se muestra en el idioma y la moneda de la empresa dueña (loja.idioma / loja.moneda); sin dato, portugués y reales como siempre.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { CarruselLateral } from '@/components/mi-local/CarruselLateral';
import { CampoWhatsapp } from '@/components/mi-local/CampoWhatsapp';
import { formatearWhatsapp, paisPorMoneda } from '@/lib/whatsappPais';
import { cargarTiendaPublica, crearPedidoPublico, type TiendaPublica } from '@/lib/miLocalDatos';
import { idiomaDeTienda, formatearPrecio, textosTienda } from '@/lib/miLocalTexto';
import { agregarAlCarrito, cambiarCantidad, cantidadTotal, LIMITE_CANTIDAD_ITEM, quitarDelCarrito, totalCarrito, mensajePedidoWhatsapp, urlWhatsapp, validarPedido, type ItemCarrito } from '@/lib/miLocal';

type Producto = TiendaPublica['productos'][number];

const AZUL = '#1f3a5f';
const VERDE = '#2e8b57';

function claveNueva(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LojaCliente() {
  const { slug } = useParams<{ slug: string }>();
  const [loja, setLoja] = useState<TiendaPublica | null | undefined>(undefined);
  const [erro, setErro] = useState(false);
  const [carrinho, setCarrinho] = useState<ItemCarrito[]>([]);
  const [detalhe, setDetalhe] = useState<Producto | null>(null);
  const [qtd, setQtd] = useState(1);
  const [etapa, setEtapa] = useState<'loja' | 'carrinho' | 'dados' | 'revisao' | 'ok'>('loja');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmado, setConfirmado] = useState<{ numero: number; total: number; nombre: string; items: ItemCarrito[]; observaciones: string } | null>(null);
  const chave = useRef(claveNueva());
  const tx = textosTienda(idiomaDeTienda(loja?.idioma));
  const moeda = loja?.moneda ?? 'BRL';
  const reais = (v: number) => formatearPrecio(v, moeda);

  useEffect(() => {
    cargarTiendaPublica(slug)
      .then(setLoja)
      .catch(() => {
        setErro(true);
        setLoja(null);
      });
  }, [slug]);

  useEffect(() => {
    if (loja?.idioma) document.documentElement.lang = loja.idioma === 'ES' ? 'es' : 'pt-BR';
  }, [loja?.idioma]);

  const total = useMemo(() => totalCarrito(carrinho), [carrinho]);
  const itens = cantidadTotal(carrinho);

  function adicionar(p: Producto, n: number) {
    setCarrinho((c) => agregarAlCarrito(c, { id: p.id, titulo: p.titulo, precio: Number(p.precio) }, n));
    setDetalhe(null);
    setQtd(1);
  }

  async function enviar() {
    const problema = validarPedido(nome, whatsapp, carrinho);
    if (problema) return setMsg(problema === 'nombre' ? tx.errNombre : problema === 'whatsapp' ? tx.errWhatsapp : tx.errCarritoVacio);
    setEnviando(true);
    setMsg('');
    try {
      const r = await crearPedidoPublico({ slug, nombre: nome.trim(), whatsapp, observaciones: obs.trim(), items: carrinho.map((i) => ({ id: i.id, cantidad: i.cantidad })), clave: chave.current });
      // El resumen se guarda antes de vaciar el carrito: el mensaje de WhatsApp lleva el detalle.
      setConfirmado({ ...r, nombre: nome.trim(), items: carrinho, observaciones: obs.trim() });
      setCarrinho([]);
      chave.current = claveNueva();
      setEtapa('ok');
    } catch (e) {
      const t = e instanceof Error ? e.message : (e as { message?: string })?.message ?? '';
      setMsg(
        t.includes('ML_LIMITE') ? tx.errLimite :
        t.includes('ML_PRODUCTO') || t.includes('ML_STOCK') || t.includes('ML_TIENDA') ? tx.errNoDisponible :
        tx.errEnviar
      );
    }
    setEnviando(false);
  }

  if (loja === undefined) return <Pagina><p style={{ textAlign: 'center', color: '#64748b' }}>…</p></Pagina>;
  if (!loja) return <Pagina><div style={{ textAlign: 'center', padding: 40 }}><h1 style={{ color: AZUL }}>{tx.noEncontrada}</h1><p style={{ color: '#64748b' }}>{erro ? tx.noCarga : tx.linkInexistente}</p></div></Pagina>;

  if (etapa === 'ok' && confirmado) {
    return (
      <Pagina>
        <div style={{ textAlign: 'center', padding: '40px 8px' }}>
          <div style={{ fontSize: 56 }}>✅</div>
          <h1 style={{ color: AZUL }}>{tx.pedidoRecibido}</h1>
          <p style={{ fontSize: 18 }}>{tx.numeroPedido} <strong>#{confirmado.numero}</strong></p>
          <p>{tx.total} <strong>{reais(confirmado.total)}</strong></p>
          <p style={{ color: '#64748b' }}>{tx.contactoPronto(loja.nombre)}</p>
          {loja.whatsapp && <a href={urlWhatsapp(loja.whatsapp, mensajePedidoWhatsapp({ numero: confirmado.numero, nombre: confirmado.nombre, items: confirmado.items, total: confirmado.total, observaciones: confirmado.observaciones, idioma: idiomaDeTienda(loja.idioma), moneda: moeda }), paisPorMoneda(moeda))} style={{ ...btn, display: 'inline-block', textDecoration: 'none' }}>{tx.hablarTienda}</a>}
          <div><button onClick={() => { setEtapa('loja'); setConfirmado(null); }} style={{ ...btn2, marginTop: 14 }}>{tx.volverTienda}</button></div>
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina banners={loja.banners ?? []}>
      <header style={{ borderRadius: 20, overflow: 'hidden', background: '#fff', boxShadow: '0 8px 24px rgba(31,58,95,0.10)', marginBottom: 18 }}>
        {loja.portada_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={loja.portada_url} alt="" style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />}
        <div style={{ padding: 18 }}>
          <h1 style={{ margin: 0, color: AZUL, fontSize: 26 }}>{loja.nombre}</h1>
          {loja.descripcion && <p style={{ margin: '6px 0 0', color: '#475569' }}>{loja.descripcion}</p>}
        </div>
      </header>

      {etapa === 'loja' && (
        <>
          {loja.productos.length === 0 ? <p style={{ textAlign: 'center', color: '#64748b' }}>{tx.sinProductos}</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, paddingBottom: 90 }}>
              {loja.productos.map((p) => (
                <button key={p.id} onClick={() => { setDetalhe(p); setQtd(1); }} style={{ textAlign: 'left', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 0, overflow: 'hidden', cursor: 'pointer' }}>
                  {p.foto_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.foto_url} alt={p.titulo} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} /> : <div style={{ aspectRatio: '1 / 1', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🛍️</div>}
                  <div style={{ padding: 10 }}>
                    <div style={{ fontWeight: 700, color: AZUL, fontSize: 14 }}>{p.titulo}</div>
                    <div style={{ color: VERDE, fontWeight: 800, marginTop: 4 }}>{reais(Number(p.precio))}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {itens > 0 && (
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: 12, background: 'rgba(255,255,255,0.95)', borderTop: '1px solid #e5e7eb' }}>
              <button onClick={() => setEtapa('carrinho')} style={{ ...btn, width: '100%', maxWidth: 720, margin: '0 auto', display: 'block' }}>{tx.verCarrito(itens, reais(total))}</button>
            </div>
          )}
        </>
      )}

      {etapa === 'carrinho' && (
        <Cartao titulo={tx.tuCarrito}>
          {carrinho.length === 0 ? <p>{tx.carritoVacio}</p> : carrinho.map((i) => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{i.titulo}</div><div style={{ fontSize: 13, color: '#64748b' }}>{reais(i.precio)} {tx.cadaUno}</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button aria-label={tx.disminuir} onClick={() => setCarrinho((c) => cambiarCantidad(c, i.id, i.cantidad - 1))} style={mini}>−</button>
                <span style={{ minWidth: 22, textAlign: 'center' }}>{i.cantidad}</span>
                <button aria-label={tx.aumentar} onClick={() => setCarrinho((c) => cambiarCantidad(c, i.id, i.cantidad + 1))} style={mini}>+</button>
                <button aria-label={tx.quitar} onClick={() => setCarrinho((c) => quitarDelCarrito(c, i.id))} style={{ ...mini, color: '#b91c1c' }}>🗑</button>
              </div>
            </div>
          ))}
          <p style={{ textAlign: 'right', fontSize: 18 }}>{tx.total} <strong>{reais(total)}</strong></p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setEtapa('loja')} style={btn2}>{tx.seguirComprando}</button>
            <button onClick={() => setEtapa('dados')} disabled={carrinho.length === 0} style={btn}>{tx.continuar}</button>
          </div>
        </Cartao>
      )}

      {etapa === 'dados' && (
        <Cartao titulo={tx.tusDatos}>
          <label style={lab}>{tx.tuNombre}<input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoComplete="name" style={campo} /></label>
          <div style={lab}>{tx.whatsappConArea}<CampoWhatsapp valor={whatsapp} onChange={setWhatsapp} paisInicial={paisPorMoneda(moeda)} idioma={idiomaDeTienda(loja.idioma)} estiloCampo={campo} /></div>
          <label style={lab}>{tx.observaciones}<textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={3} style={{ ...campo, resize: 'vertical' }} /></label>
          {msg && <p style={{ color: '#b91c1c' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setEtapa('carrinho')} style={btn2}>{tx.volver}</button>
            <button onClick={() => { const p = validarPedido(nome, whatsapp, carrinho); if (p) setMsg(p === 'nombre' ? tx.errNombre : tx.errWhatsapp); else { setMsg(''); setEtapa('revisao'); } }} style={btn}>{tx.revisarPedido}</button>
          </div>
        </Cartao>
      )}

      {etapa === 'revisao' && (
        <Cartao titulo={tx.revisaTuPedido}>
          {carrinho.map((i) => <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{i.cantidad} × {i.titulo}</span><span>{reais(i.precio * i.cantidad)}</span></div>)}
          <p style={{ textAlign: 'right', fontSize: 18 }}>{tx.total} <strong>{reais(total)}</strong></p>
          <p style={{ fontSize: 14, color: '#475569' }}>{nome} · {formatearWhatsapp(whatsapp, paisPorMoneda(moeda))}{obs && <><br />“{obs}”</>}</p>
          <p style={{ fontSize: 13, color: '#64748b' }}>{tx.avisoPago}</p>
          {msg && <p style={{ color: '#b91c1c' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setEtapa('dados')} disabled={enviando} style={btn2}>{tx.volver}</button>
            <button onClick={enviar} disabled={enviando} style={btn}>{enviando ? tx.enviando : tx.enviarPedido}</button>
          </div>
        </Cartao>
      )}

      {detalhe && (
        <div onClick={() => setDetalhe(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', paddingBottom: 16 }}>
            {detalhe.foto_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={detalhe.foto_url} alt={detalhe.titulo} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />}
            <div style={{ padding: 18 }}>
              <h2 style={{ margin: 0, color: AZUL }}>{detalhe.titulo}</h2>
              <div style={{ color: VERDE, fontWeight: 800, fontSize: 20, margin: '6px 0' }}>{reais(Number(detalhe.precio))}</div>
              {detalhe.descripcion && <p style={{ color: '#475569', whiteSpace: 'pre-line' }}>{detalhe.descripcion}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
                <button aria-label={tx.disminuir} onClick={() => setQtd((q) => Math.max(1, q - 1))} style={mini}>−</button>
                <strong>{qtd}</strong>
                <button aria-label={tx.aumentar} onClick={() => setQtd((q) => Math.min(LIMITE_CANTIDAD_ITEM, q + 1))} style={mini}>+</button>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDetalhe(null)} style={btn2}>{tx.cerrar}</button>
                <button onClick={() => adicionar(detalhe, qtd)} style={{ ...btn, flex: 1 }}>{tx.agregar(reais(Number(detalhe.precio) * qtd))}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Pagina>
  );
}

type BannerPublico = NonNullable<TiendaPublica['banners']>[number];

// En pantallas anchas los banners van en columnas a los costados; en celular y
// tablet se muestran como una tira rotativa arriba del contenido.
function Pagina({ children, banners = [] }: { children: React.ReactNode; banners?: BannerPublico[] }) {
  const izquierda = banners.filter((b) => b.lado === 'izquierda');
  const derecha = banners.filter((b) => b.lado === 'derecha');
  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', padding: '16px 14px' }}>
      <style>{`
        .lj-grid { display: block; max-width: 720px; margin: 0 auto; }
        .lj-rail { display: none; }
        .lj-tira { display: block; margin-bottom: 14px; }
        @media (min-width: 1280px) {
          .lj-grid { display: grid; grid-template-columns: 240px minmax(0, 720px) 240px; gap: 24px; max-width: none; justify-content: center; align-items: start; }
          .lj-rail { display: block; position: sticky; top: 16px; }
          .lj-tira { display: none; }
        }
        @media (min-width: 1600px) {
          .lj-grid { grid-template-columns: 340px minmax(0, 720px) 340px; gap: 32px; }
        }
        @media (min-width: 1920px) {
          .lj-grid { grid-template-columns: 460px minmax(0, 720px) 460px; gap: 40px; }
        }
      `}</style>
      <div className="lj-grid">
        <aside className="lj-rail"><CarruselLateral imagenes={izquierda} /></aside>
        <div>
          {banners.length > 0 && <div className="lj-tira"><CarruselLateral imagenes={banners} alto={150} /></div>}
          {children}
        </div>
        <aside className="lj-rail"><CarruselLateral imagenes={derecha} /></aside>
      </div>
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 8px 24px rgba(31,58,95,0.08)' }}><h2 style={{ marginTop: 0, color: AZUL }}>{titulo}</h2>{children}</section>;
}

const btn: React.CSSProperties = { background: VERDE, color: '#fff', border: 'none', borderRadius: 12, padding: '13px 20px', fontWeight: 700, fontSize: 16, cursor: 'pointer' };
const btn2: React.CSSProperties = { background: '#f1f5f9', color: AZUL, border: '1px solid #d6dee5', borderRadius: 12, padding: '12px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' };
const mini: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: '1px solid #d6dee5', background: '#fff', fontSize: 18, cursor: 'pointer' };
const lab: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 12 };
const campo: React.CSSProperties = { padding: '12px', borderRadius: 10, border: '1px solid #d6dee5', fontSize: 16, width: '100%', boxSizing: 'border-box' };
