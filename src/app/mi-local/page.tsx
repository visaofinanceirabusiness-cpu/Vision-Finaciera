'use client';

// MI LOCAL — administración de la tienda pública de la empresa.
//
// Tres pestañas: Tienda (datos, activar, link), Catálogo (qué productos
// del inventario se publican y con qué precio/foto) y Pedidos (los que
// llegan desde /loja/<slug>). Un pedido recibido NO es una venta: la
// contabilidad solo se toca cuando el comerciante pulsa "Registrar venta"
// (ver registrarVentaDelPedido en lib/miLocalDatos.ts).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { VolverLobby } from '@/components/nav/VolverLobby';
import { AccesosHerramientas } from '@/components/nav/AccesosHerramientas';
import { supabase } from '@/lib/supabase';
import {
  cambiarEstadoPedido,
  cargarMiTienda,
  costosPromedio,
  guardarPublicacion,
  guardarTienda,
  listarPedidos,
  listarPublicaciones,
  publicarVarios,
  registrarVentaDelPedido,
  saldosStock,
  subirFoto,
  type Pedido,
  type Publicacion,
  type Tienda,
} from '@/lib/miLocalDatos';
import {
  agruparCatalogo,
  etiquetaEstado,
  formatearReales,
  generarSlug,
  mensajeSlug,
  precioConMargen,
  puedeRegistrarVenta,
  rutaTienda,
  transicionesValidas,
  urlWhatsapp,
  validarSlug,
  whatsappValido,
  type EstadoPedido,
} from '@/lib/miLocal';
import { obtenerFormasPagoOperacion } from '@/lib/formasPagoOperacion';

const COLORES = {
  azul: 'var(--color-primario, #1f3a5f)',
  verde: 'var(--color-secundario, #2e8b57)',
  gris: 'var(--color-acento, #6e7781)',
  blanco: '#ffffff',
};

type Pestana = 'tienda' | 'catalogo' | 'pedidos';
type ProductoBase = { id: string; nombre: string; categoria: string | null; unidad_medida: string | null };

export default function MiLocalPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [esPT, setEsPT] = useState(false);
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [pestana, setPestana] = useState<Pestana>('tienda');
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [productos, setProductos] = useState<ProductoBase[]>([]);
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [saldos, setSaldos] = useState<Map<string, number>>(new Map());
  const [costos, setCostos] = useState<Map<string, number>>(new Map());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const tr = useCallback((es: string, pt: string) => (esPT ? pt : es), [esPT]);

  const recargar = useCallback(async (id: string) => {
    const [t, pubs, ped, sal, cos, { data: prods }] = await Promise.all([
      cargarMiTienda(id),
      listarPublicaciones(id),
      listarPedidos(id),
      saldosStock(id),
      costosPromedio(id),
      supabase.from('productos').select('id, nombre, categoria, unidad_medida').eq('empresa_id', id).order('nombre'),
    ]);
    setTienda(t);
    setPublicaciones(pubs);
    setPedidos(ped);
    setSaldos(sal);
    setCostos(cos);
    setProductos((prods ?? []) as ProductoBase[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: perfil } = await supabase.from('perfiles').select('empresa_id').eq('id', u.user.id).maybeSingle();
      if (!perfil?.empresa_id) return;
      const { data: emp } = await supabase.from('empresas').select('nombre, idioma').eq('id', perfil.empresa_id).maybeSingle();
      setEmpresaId(perfil.empresa_id);
      setEsPT(emp?.idioma === 'PT');
      setNombreEmpresa((emp?.nombre as string) ?? '');
      try {
        await recargar(perfil.empresa_id);
      } catch (e) {
        console.error(e);
        setAviso({ tipo: 'error', texto: 'No se pudo cargar Mi Local.' });
      }
      setCargando(false);
    })();
  }, [recargar]);

  const pendientes = pedidos.filter((p) => p.estado === 'pending').length;

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'var(--fondo-app, linear-gradient(180deg, #f4f7fb 0%, #eef3f8 100%))' }}>
      <style>{`@media (max-width: 560px) { .ml-fila { flex-direction: column !important; align-items: stretch !important; } .ml-pad { padding: 16px !important; } }`}</style>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <header style={{ background: 'linear-gradient(125deg, #142a47 0%, #1f3a5f 58%, #245a52 100%)', borderRadius: 24, padding: '28px 34px', color: COLORES.blanco, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: '1 1 240px' }}>
              <VolverLobby>{tr('← Volver', '← Voltar')}</VolverLobby>
              <div style={{ color: '#86efac', fontSize: 11, fontWeight: 700, letterSpacing: 1.4, margin: '12px 0 8px' }}>MI LOCAL</div>
              <h1 style={{ margin: 0, fontSize: 32 }}>🛍️ {tr('Mi Local', 'Meu Local')}</h1>
              <p style={{ margin: '8px 0 0', color: '#dbe5ef', fontSize: 15 }}>{tr('Tu tienda online: publicá productos y recibí pedidos.', 'Sua loja online: publique produtos e receba pedidos.')}</p>
            </div>
            <AccesosHerramientas />
          </div>
        </header>

        <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #e5e7eb', marginBottom: 18, flexWrap: 'wrap' }}>
          {(
            [
              ['tienda', tr('Tienda', 'Loja')],
              ['catalogo', tr('Catálogo', 'Catálogo')],
              ['pedidos', `${tr('Pedidos', 'Pedidos')}${pendientes ? ` (${pendientes})` : ''}`],
            ] as [Pestana, string][]
          ).map(([id, texto]) => (
            <button key={id} onClick={() => setPestana(id)} style={{ ...botonPestana, color: pestana === id ? COLORES.azul : COLORES.gris, borderBottom: pestana === id ? `3px solid ${COLORES.verde}` : '3px solid transparent' }}>
              {texto}
            </button>
          ))}
        </div>

        {aviso && (
          <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: aviso.tipo === 'ok' ? '#ecfdf5' : '#fef2f2', color: aviso.tipo === 'ok' ? '#047857' : '#b91c1c', fontSize: 14 }}>{aviso.texto}</div>
        )}

        <main className="ml-pad" style={{ background: COLORES.blanco, borderRadius: 24, padding: 26, boxShadow: '0 14px 36px rgba(31,58,95,0.10)' }}>
          {cargando || !empresaId ? (
            <p style={{ color: COLORES.gris }}>{tr('Cargando…', 'Carregando…')}</p>
          ) : pestana === 'tienda' ? (
            <PestanaTienda empresaId={empresaId} nombreEmpresa={nombreEmpresa} tienda={tienda} esPT={esPT} tr={tr} onGuardado={() => recargar(empresaId)} setAviso={setAviso} />
          ) : pestana === 'catalogo' ? (
            <PestanaCatalogo empresaId={empresaId} productos={productos} publicaciones={publicaciones} saldos={saldos} costos={costos} tr={tr} onGuardado={() => recargar(empresaId)} setAviso={setAviso} />
          ) : (
            <PestanaPedidos empresaId={empresaId} pedidos={pedidos} esPT={esPT} tr={tr} onCambio={() => recargar(empresaId)} setAviso={setAviso} />
          )}
        </main>
      </div>
    </div>
  );
}

type Tr = (es: string, pt: string) => string;
type SetAviso = (a: { tipo: 'ok' | 'error'; texto: string } | null) => void;

// ---------------- TIENDA ----------------

function PestanaTienda({ empresaId, nombreEmpresa, tienda, esPT, tr, onGuardado, setAviso }: { empresaId: string; nombreEmpresa: string; tienda: Tienda | null; esPT: boolean; tr: Tr; onGuardado: () => Promise<void>; setAviso: SetAviso }) {
  const [nombre, setNombre] = useState(tienda?.nombre ?? nombreEmpresa);
  const [slug, setSlug] = useState(tienda?.slug ?? generarSlug(nombreEmpresa));
  const [descripcion, setDescripcion] = useState(tienda?.descripcion ?? '');
  const [whatsapp, setWhatsapp] = useState(tienda?.whatsapp ?? '');
  const [portada, setPortada] = useState(tienda?.portada_url ?? '');
  const [activa, setActiva] = useState(tienda?.activa ?? false);
  const [guardando, setGuardando] = useState(false);

  const errorSlug = validarSlug(slug);
  const urlPublica = typeof window !== 'undefined' ? `${window.location.origin}${rutaTienda(slug)}` : rutaTienda(slug);

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    try {
      setPortada(await subirFoto(empresaId, archivo));
    } catch {
      setAviso({ tipo: 'error', texto: tr('No se pudo subir la imagen.', 'Não foi possível enviar a imagem.') });
    }
  }

  async function guardar() {
    if (errorSlug) return setAviso({ tipo: 'error', texto: mensajeSlug(errorSlug, esPT) });
    if (nombre.trim().length < 2) return setAviso({ tipo: 'error', texto: tr('Poné un nombre para la tienda.', 'Informe um nome para a loja.') });
    if (activa && !whatsappValido(whatsapp)) return setAviso({ tipo: 'error', texto: tr('Para activar la tienda cargá un WhatsApp válido (con DDD).', 'Para ativar a loja informe um WhatsApp válido (com DDD).') });
    setGuardando(true);
    try {
      await guardarTienda({ empresa_id: empresaId, slug, nombre: nombre.trim(), descripcion: descripcion.trim() || null, portada_url: portada || null, whatsapp: whatsapp.trim() || null, activa });
      await onGuardado();
      setAviso({ tipo: 'ok', texto: tr('Tienda guardada.', 'Loja salva.') });
    } catch (e) {
      const enUso = e instanceof Error && e.message === 'ML_SLUG_EN_USO';
      setAviso({ tipo: 'error', texto: enUso ? tr('Ese link ya lo usa otra tienda, elegí otro.', 'Esse link já é usado por outra loja, escolha outro.') : tr('No se pudo guardar.', 'Não foi possível salvar.') });
    }
    setGuardando(false);
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
      <label style={etiqueta}>
        {tr('Nombre público', 'Nome público')}
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} style={campo} />
      </label>
      <label style={etiqueta}>
        {tr('Link de la tienda', 'Link da loja')}
        <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={40} style={campo} />
        {errorSlug ? <span style={{ color: '#b91c1c', fontSize: 12 }}>{mensajeSlug(errorSlug, esPT)}</span> : <span style={{ color: COLORES.gris, fontSize: 12, wordBreak: 'break-all' }}>{urlPublica}</span>}
      </label>
      <label style={etiqueta}>
        {tr('Descripción corta', 'Descrição curta')}
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} rows={3} style={{ ...campo, resize: 'vertical' }} />
      </label>
      <label style={etiqueta}>
        WhatsApp ({tr('para avisos de pedidos', 'para avisos de pedidos')})
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 91234-5678" inputMode="tel" style={campo} />
      </label>
      <div style={etiqueta}>
        {tr('Imagen de portada', 'Imagem de capa')}
        {portada && /* eslint-disable-next-line @next/next/no-img-element */ <img src={portada} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12 }} />}
        <input type="file" accept="image/*" onChange={(e) => subir(e.target.files?.[0])} />
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 600, color: COLORES.azul }}>
        <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
        {tr('Tienda activa (visible al público)', 'Loja ativa (visível ao público)')}
      </label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={guardar} disabled={guardando} style={botonPrimario}>{guardando ? '…' : tr('Guardar', 'Salvar')}</button>
        {tienda && (
          <>
            <button onClick={() => navigator.clipboard?.writeText(urlPublica).then(() => setAviso({ tipo: 'ok', texto: tr('Link copiado.', 'Link copiado.') }))} style={botonSecundario}>{tr('Copiar link', 'Copiar link')}</button>
            <a href={rutaTienda(tienda.slug)} target="_blank" rel="noreferrer" style={{ ...botonSecundario, textDecoration: 'none' }}>{tr('Ver tienda', 'Ver loja')}</a>
          </>
        )}
      </div>
      {tienda && !tienda.activa && <p style={{ color: COLORES.gris, fontSize: 13, margin: 0 }}>{tr('La tienda está guardada pero inactiva: el link público no muestra nada.', 'A loja está salva mas inativa: o link público não mostra nada.')}</p>}
    </div>
  );
}

// ---------------- CATÁLOGO ----------------

function PestanaCatalogo({ empresaId, productos, publicaciones, saldos, costos, tr, onGuardado, setAviso }: { empresaId: string; productos: ProductoBase[]; publicaciones: Publicacion[]; saldos: Map<string, number>; costos: Map<string, number>; tr: Tr; onGuardado: () => Promise<void>; setAviso: SetAviso }) {
  const porProducto = useMemo(() => new Map(publicaciones.map((p) => [p.producto_id, p])), [publicaciones]);
  const [editando, setEditando] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [margen, setMargen] = useState('100');
  const [publicando, setPublicando] = useState(false);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const grupos = useMemo(() => agruparCatalogo(productos, saldos), [productos, saldos]);
  const sinPublicar = productos.filter((p) => !porProducto.has(p.id));
  const conStock = sinPublicar.filter((p) => (saldos.get(p.id) ?? 0) > 0);

  function alternar(id: string) {
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function publicarMarcados() {
    const m = Number(margen.replace(',', '.'));
    if (!(m >= 0)) return setAviso({ tipo: 'error', texto: tr('Poné un margen válido (0 o más).', 'Informe uma margem válida (0 ou mais).') });
    const filas: { empresa_id: string; producto_id: string; titulo: string; precio: number }[] = [];
    let sinCosto = 0;
    for (const prod of sinPublicar.filter((p) => marcados.has(p.id))) {
      const precio = precioConMargen(costos.get(prod.id) ?? 0, m);
      if (precio === null) sinCosto++;
      else filas.push({ empresa_id: empresaId, producto_id: prod.id, titulo: prod.nombre, precio });
    }
    setPublicando(true);
    try {
      await publicarVarios(filas);
      setMarcados(new Set());
      await onGuardado();
      setAviso({ tipo: sinCosto ? 'error' : 'ok', texto: `${tr('Publicados', 'Publicados')}: ${filas.length}.${sinCosto ? ` ${sinCosto} ${tr('no se publicaron porque no tienen costo (publicalos a mano con su precio).', 'não foram publicados por não terem custo (publique-os à mão com o preço).')}` : ''}` });
    } catch {
      setAviso({ tipo: 'error', texto: tr('No se pudo publicar.', 'Não foi possível publicar.') });
    }
    setPublicando(false);
  }

  if (productos.length === 0) return <p style={{ color: COLORES.gris }}>{tr('Todavía no hay productos en Mercadería. Cargalos primero para poder publicarlos.', 'Ainda não há produtos em Mercadoria. Cadastre-os primeiro para publicá-los.')}</p>;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, color: COLORES.gris, fontSize: 13 }}>{tr('Los productos son los de Mercadería (no hay una segunda base). Acá solo elegís cuáles publicar, con qué nombre, precio y foto.', 'Os produtos são os de Mercadoria (não há uma segunda base). Aqui você só escolhe quais publicar, com que nome, preço e foto.')}</p>
      {sinPublicar.length > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
          <strong style={{ color: COLORES.azul }}>{tr('Publicar varios a la vez (opcional)', 'Publicar vários de uma vez (opcional)')}</strong>
          <span style={{ fontSize: 13, color: COLORES.gris }}>{tr('Tildá los productos y se publican con precio = costo promedio + margen. Después podés ajustar precio y foto de cada uno. Los que querés cargar a mano, dejalos sin tildar.', 'Marque os produtos e eles são publicados com preço = custo médio + margem. Depois você ajusta preço e foto de cada um. Os que quiser cadastrar à mão, deixe sem marcar.')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setMarcados(new Set(conStock.map((p) => p.id)))} style={botonSecundario}>{tr('Tildar los que tienen stock', 'Marcar os com estoque')} ({conStock.length})</button>
            <button onClick={() => setMarcados(new Set(sinPublicar.map((p) => p.id)))} style={botonSecundario}>{tr('Tildar todos', 'Marcar todos')}</button>
            <button onClick={() => setMarcados(new Set())} style={botonSecundario}>{tr('Limpiar', 'Limpar')}</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
              {tr('Margen sobre el costo', 'Margem sobre o custo')} (%)
              <input value={margen} onChange={(e) => setMargen(e.target.value)} inputMode="decimal" style={{ ...campo, width: 80 }} />
            </label>
            <button onClick={publicarMarcados} disabled={publicando || marcados.size === 0} style={botonPrimario}>{publicando ? '…' : `${tr('Publicar tildados', 'Publicar marcados')} (${marcados.size})`}</button>
          </div>
        </div>
      )}
      {grupos.map(({ categoria, lista }) => {
        const abierta = abiertas.has(categoria);
        const publicados = lista.filter((p) => porProducto.has(p.id)).length;
        return (
          <div key={categoria || 'sin'}>
            <button
              onClick={() => setAbiertas((a) => { const n = new Set(a); if (n.has(categoria)) n.delete(categoria); else n.add(categoria); return n; })}
              aria-expanded={abierta}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid #d6dee5', background: '#f1f5f9', color: COLORES.azul, fontWeight: 700, fontSize: 15, cursor: 'pointer', textAlign: 'left' }}
            >
              <span>{abierta ? '▾' : '▸'} {categoria || tr('Sin categoría', 'Sem categoria')}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: COLORES.gris }}>{lista.length} {tr('productos', 'produtos')} · {publicados} {tr('publicados', 'publicados')}</span>
            </button>
            {abierta && (
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                {lista.map((prod) => {
        const pub = porProducto.get(prod.id);
        return (
          <div key={prod.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
            <div className="ml-fila" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {!pub && <input type="checkbox" aria-label={tr('Tildar para publicar', 'Marcar para publicar')} checked={marcados.has(prod.id)} onChange={() => alternar(prod.id)} style={{ width: 20, height: 20 }} />}
                {pub?.foto_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={pub.foto_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10 }} /> : <div style={{ width: 56, height: 56, borderRadius: 10, background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: COLORES.gris, textAlign: 'center' }}>{tr('Sin foto', 'Sem foto')}</div>}
                <div>
                <strong style={{ color: COLORES.azul }}>{prod.nombre}</strong>
                <div style={{ fontSize: 12, color: COLORES.gris }}>
                  {prod.categoria ?? tr('Sin categoría', 'Sem categoria')} · {tr('Stock', 'Estoque')}: {saldos.get(prod.id) ?? 0} {prod.unidad_medida ?? ''} · {tr('Costo', 'Custo')}: {formatearReales(costos.get(prod.id) ?? 0)}
                  {pub && ` · ${formatearReales(pub.precio)} · ${pub.publicado ? (pub.disponible ? tr('Publicado', 'Publicado') : tr('Publicado (agotado)', 'Publicado (esgotado)')) : tr('Borrador', 'Rascunho')}`}
                </div>
                </div>
              </div>
              <button onClick={() => setEditando(editando === prod.id ? null : prod.id)} style={botonSecundario}>{pub ? tr('Editar / foto', 'Editar / foto') : tr('Publicar y subir foto', 'Publicar e enviar foto')}</button>
            </div>
            {editando === prod.id && (
              <FormPublicacion empresaId={empresaId} producto={prod} pub={pub} costo={costos.get(prod.id) ?? 0} tr={tr} setAviso={setAviso} onListo={async () => { setEditando(null); await onGuardado(); }} />
            )}
          </div>
        );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormPublicacion({ empresaId, producto, pub, costo, tr, setAviso, onListo }: { empresaId: string; producto: ProductoBase; pub?: Publicacion; costo: number; tr: Tr; setAviso: SetAviso; onListo: () => Promise<void> }) {
  const [titulo, setTitulo] = useState(pub?.titulo ?? producto.nombre);
  const [descripcion, setDescripcion] = useState(pub?.descripcion ?? '');
  const [precio, setPrecio] = useState(pub ? String(pub.precio).replace('.', ',') : '');
  const [foto, setFoto] = useState(pub?.foto_url ?? '');
  const [publicado, setPublicado] = useState(pub?.publicado ?? true);
  const [disponible, setDisponible] = useState(pub?.disponible ?? true);
  const [controlaStock, setControlaStock] = useState(pub?.controla_stock ?? true);
  const [guardando, setGuardando] = useState(false);

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    try {
      setFoto(await subirFoto(empresaId, archivo));
    } catch {
      setAviso({ tipo: 'error', texto: tr('No se pudo subir la foto.', 'Não foi possível enviar a foto.') });
    }
  }

  async function guardar() {
    const valor = Number(precio.replace(/\./g, '').replace(',', '.'));
    if (!(valor > 0) || valor > 1_000_000) return setAviso({ tipo: 'error', texto: tr('Poné un precio mayor que cero.', 'Informe um preço maior que zero.') });
    if (titulo.trim().length < 2) return setAviso({ tipo: 'error', texto: tr('Poné un nombre comercial.', 'Informe um nome comercial.') });
    setGuardando(true);
    try {
      await guardarPublicacion({ empresa_id: empresaId, producto_id: producto.id, titulo: titulo.trim(), descripcion: descripcion.trim() || null, precio: valor, foto_url: foto || null, publicado, disponible, controla_stock: controlaStock });
      setAviso({ tipo: 'ok', texto: tr('Producto guardado.', 'Produto salvo.') });
      await onListo();
    } catch {
      setAviso({ tipo: 'error', texto: tr('No se pudo guardar.', 'Não foi possível salvar.') });
    }
    setGuardando(false);
  }

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px dashed #e5e7eb' }}>
      <label style={etiqueta}>{tr('Nombre comercial', 'Nome comercial')}<input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} style={campo} /></label>
      <label style={etiqueta}>{tr('Descripción', 'Descrição')}<textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={2000} rows={8} style={{ ...campo, resize: 'vertical' }} /><span style={{ fontWeight: 400, color: COLORES.gris }}>{descripcion.length}/2000</span></label>
      <label style={etiqueta}>{tr('Precio de venta (R$)', 'Preço de venda (R$)')}{costo > 0 && <span style={{ fontWeight: 400, color: COLORES.gris }}>{tr('Costo promedio', 'Custo médio')}: {formatearReales(costo)}</span>}<input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" placeholder="49,90" style={campo} /></label>
      <div style={etiqueta}>
        {tr('Foto', 'Foto')}
        {foto && /* eslint-disable-next-line @next/next/no-img-element */ <img src={foto} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12 }} />}
        <input type="file" accept="image/*" onChange={(e) => subir(e.target.files?.[0])} />
      </div>
      <label style={chk}><input type="checkbox" checked={publicado} onChange={(e) => setPublicado(e.target.checked)} /> {tr('Publicado en la tienda', 'Publicado na loja')}</label>
      <label style={chk}><input type="checkbox" checked={disponible} onChange={(e) => setDisponible(e.target.checked)} /> {tr('Disponible para pedir', 'Disponível para pedir')}</label>
      <label style={chk}><input type="checkbox" checked={controlaStock} onChange={(e) => setControlaStock(e.target.checked)} /> {tr('Ocultar cuando el stock llegue a cero', 'Ocultar quando o estoque chegar a zero')}</label>
      <div><button onClick={guardar} disabled={guardando} style={botonPrimario}>{guardando ? '…' : tr('Guardar producto', 'Salvar produto')}</button></div>
    </div>
  );
}

// ---------------- PEDIDOS ----------------

function PestanaPedidos({ empresaId, pedidos, esPT, tr, onCambio, setAviso }: { empresaId: string; pedidos: Pedido[]; esPT: boolean; tr: Tr; onCambio: () => Promise<void>; setAviso: SetAviso }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ventaDe, setVentaDe] = useState<Pedido | null>(null);

  async function mover(p: Pedido, estado: EstadoPedido) {
    setOcupado(p.id);
    try {
      await cambiarEstadoPedido(p.id, estado);
      await onCambio();
    } catch {
      setAviso({ tipo: 'error', texto: tr('No se pudo cambiar el estado (puede haber cambiado, o ya tiene venta registrada).', 'Não foi possível mudar o estado (pode ter mudado, ou já tem venda registrada).') });
      await onCambio();
    }
    setOcupado(null);
  }

  if (pedidos.length === 0) return <p style={{ color: COLORES.gris }}>{tr('Todavía no llegaron pedidos.', 'Ainda não chegaram pedidos.')}</p>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {pedidos.map((p) => (
        <div key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 16 }}>
          <div className="ml-fila" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ color: COLORES.azul }}>#{p.numero} · {formatearReales(p.total)}</strong>
            <span style={{ ...insignia, background: p.estado === 'cancelled' ? '#fee2e2' : p.estado === 'pending' ? '#fef3c7' : '#dcfce7' }}>{etiquetaEstado(p.estado, esPT)}</span>
          </div>
          <div style={{ fontSize: 13, color: COLORES.gris, margin: '4px 0 8px' }}>
            {new Date(p.creado_en).toLocaleString(esPT ? 'pt-BR' : 'es')} · {p.cliente_nombre} ·{' '}
            <a href={urlWhatsapp(p.cliente_whatsapp, `Olá ${p.cliente_nombre}! Sobre seu pedido #${p.numero}`)} target="_blank" rel="noreferrer">{p.cliente_whatsapp}</a>
          </div>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 14 }}>
            {p.mi_local_pedido_items.map((i) => (
              <li key={i.id}>{i.cantidad} × {i.nombre} — {formatearReales(i.precio_unitario)} = {formatearReales(i.subtotal)}</li>
            ))}
          </ul>
          {p.observaciones && <div style={{ fontSize: 13, background: '#f8fafc', padding: 8, borderRadius: 8, marginBottom: 8 }}>📝 {p.observaciones}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {transicionesValidas(p.estado).map((e) => (
              <button key={e} disabled={ocupado === p.id || (e === 'cancelled' && p.venta_estado !== 'NO')} onClick={() => mover(p, e)} style={e === 'cancelled' ? botonPeligro : botonSecundario}>
                {e === 'cancelled' ? tr('Cancelar', 'Cancelar') : `→ ${etiquetaEstado(e, esPT)}`}
              </button>
            ))}
            {puedeRegistrarVenta(p.estado, p.venta_estado) && (
              <button onClick={() => setVentaDe(p)} style={botonPrimario}>{p.venta_estado === 'REGISTRANDO' ? tr('Continuar venta', 'Continuar venda') : tr('Registrar venta', 'Registrar venda')}</button>
            )}
            {p.venta_estado === 'REGISTRADA' && <span style={{ fontSize: 13, color: '#047857' }}>✔ {tr('Venta registrada', 'Venda registrada')} ({p.ids_operacion.join(', ')})</span>}
          </div>
        </div>
      ))}
      {ventaDe && <ModalVenta empresaId={empresaId} pedido={ventaDe} tr={tr} onCerrar={() => setVentaDe(null)} onListo={async () => { setVentaDe(null); setAviso({ tipo: 'ok', texto: tr('Venta registrada en la contabilidad.', 'Venda registrada na contabilidade.') }); await onCambio(); }} setAviso={setAviso} />}
    </div>
  );
}

function ModalVenta({ empresaId, pedido, tr, onCerrar, onListo, setAviso }: { empresaId: string; pedido: Pedido; tr: Tr; onCerrar: () => void; onListo: () => Promise<void>; setAviso: SetAviso }) {
  const [categorias, setCategorias] = useState<{ categoria: string; medios: string[] }[]>([]);
  const [elegidos, setElegidos] = useState<Record<string, string>>({});
  const [trabajando, setTrabajando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('mi_local_pedido_items').select('categoria').eq('pedido_id', pedido.id);
      const nombres = Array.from(new Set((data ?? []).map((f) => f.categoria as string | null).filter(Boolean))) as string[];
      const lista = await Promise.all(nombres.map(async (categoria) => ({ categoria, medios: await obtenerFormasPagoOperacion(empresaId, 'VENTA', categoria) })));
      setCategorias(lista);
      setElegidos(Object.fromEntries(lista.map((c) => [c.categoria, c.medios[0] ?? ''])));
      setCargando(false);
    })();
  }, [empresaId, pedido.id]);

  async function confirmar() {
    setTrabajando(true);
    try {
      await registrarVentaDelPedido({ empresaId, pedidoId: pedido.id, formaPagoPorCategoria: elegidos });
      await onListo();
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      setAviso({ tipo: 'error', texto: m.includes('ML_VENTA_EN_CURSO') ? tr('Ya se está registrando esta venta. Esperá unos minutos.', 'Esta venda já está sendo registrada. Aguarde alguns minutos.') : m || tr('No se pudo registrar la venta.', 'Não foi possível registrar a venda.') });
      onCerrar();
    }
    setTrabajando(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 24, maxWidth: 460, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0, color: COLORES.azul }}>{tr('Registrar venta', 'Registrar venda')} · #{pedido.numero}</h3>
        <p style={{ fontSize: 13, color: COLORES.gris }}>{tr('Se registra una VENTA por categoría de producto, con fecha de hoy. Descuenta stock y contabiliza igual que una venta cargada a mano.', 'Registra-se uma VENDA por categoria de produto, com data de hoje. Baixa o estoque e contabiliza como uma venda lançada à mão.')}</p>
        {cargando ? <p>…</p> : categorias.length === 0 ? <p style={{ color: '#b91c1c' }}>{tr('Los productos del pedido no tienen categoría.', 'Os produtos do pedido não têm categoria.')}</p> : categorias.map((c) => (
          <label key={c.categoria} style={{ ...etiqueta, marginBottom: 10 }}>
            {c.categoria} — {tr('cobrado con', 'recebido com')}
            <select value={elegidos[c.categoria] ?? ''} onChange={(e) => setElegidos({ ...elegidos, [c.categoria]: e.target.value })} style={campo}>
              {c.medios.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        ))}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={onCerrar} disabled={trabajando} style={botonSecundario}>{tr('Cerrar', 'Fechar')}</button>
          <button onClick={confirmar} disabled={trabajando || cargando || categorias.some((c) => !elegidos[c.categoria])} style={botonPrimario}>{trabajando ? '…' : tr('Confirmar', 'Confirmar')}</button>
        </div>
      </div>
    </div>
  );
}

const botonPestana: React.CSSProperties = { background: 'none', border: 'none', padding: '10px 14px', fontWeight: 700, fontSize: 15, cursor: 'pointer' };
const etiqueta: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' };
const campo: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid #d6dee5', background: '#fbfcfd', fontSize: 15, width: '100%', boxSizing: 'border-box' };
const chk: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 };
const botonPrimario: React.CSSProperties = { background: COLORES.verde, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' };
const botonSecundario: React.CSSProperties = { background: '#f1f5f9', color: COLORES.azul, border: '1px solid #d6dee5', borderRadius: 10, padding: '9px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 14 };
const botonPeligro: React.CSSProperties = { ...botonSecundario, color: '#b91c1c', borderColor: '#fecaca' };
const insignia: React.CSSProperties = { padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 };
