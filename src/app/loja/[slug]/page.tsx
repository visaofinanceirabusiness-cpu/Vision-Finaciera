// Página pública de la tienda (Mi Local). Es un componente de servidor solo para
// publicar las etiquetas Open Graph: al compartir el link en WhatsApp/Instagram se
// ve la portada y el nombre del negocio en vez de un enlace pelado. La tienda
// interactiva vive en LojaCliente.tsx.

import type { Metadata } from 'next';
import LojaCliente from './LojaCliente';

type TiendaMeta = { nombre: string; descripcion: string | null; portada_url: string | null } | null;

async function cargarMeta(slug: string): Promise<TiendaMeta> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/mi_local_tienda_publica`, {
      method: 'POST',
      // Una clave sb_publishable_ no es un JWT: va solo en apikey.
      headers: { apikey: clave, ...(clave.startsWith('eyJ') ? { Authorization: `Bearer ${clave}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
      next: { revalidate: 60 },
    });
    if (!r.ok) return null;
    return (await r.json()) as TiendaMeta;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tienda = await cargarMeta(slug);
  if (!tienda) return { title: 'Loja' };

  const descripcion = (tienda.descripcion ?? `Conheça os produtos de ${tienda.nombre} e faça seu pedido online.`).replace(/\s+/g, ' ').slice(0, 200);
  return {
    title: tienda.nombre,
    description: descripcion,
    openGraph: {
      type: 'website',
      siteName: tienda.nombre,
      title: tienda.nombre,
      description: descripcion,
      locale: 'pt_BR',
      images: tienda.portada_url ? [{ url: tienda.portada_url }] : undefined,
    },
    twitter: {
      card: tienda.portada_url ? 'summary_large_image' : 'summary',
      title: tienda.nombre,
      description: descripcion,
      images: tienda.portada_url ? [tienda.portada_url] : undefined,
    },
  };
}

export default function LojaPage() {
  return <LojaCliente />;
}
