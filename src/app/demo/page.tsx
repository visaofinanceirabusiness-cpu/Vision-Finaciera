import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { DemoClient } from './DemoClient';

// La pestaña del navegador (y el enlace compartido) dice "Visão Financeira - <empresa demo>".
async function nombreEmpresaDemo(codigo: string | undefined): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave || !codigo) return null;

  try {
    const admin = createClient(url, clave);
    const { data: acceso } = await admin.from('demo_accesos').select('empresa_id').eq('codigo', codigo.trim().toUpperCase()).maybeSingle();
    if (!acceso) return null;
    const { data: empresa } = await admin.from('empresas').select('nombre').eq('id', acceso.empresa_id).maybeSingle();
    return empresa?.nombre ?? null;
  } catch {
    return null;
  }
}

type Props = { searchParams: Promise<{ c?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { c } = await searchParams;
  const empresa = await nombreEmpresaDemo(c);
  const titulo = empresa ? `Visão Financeira - ${empresa}` : 'Visão Financeira';
  // openGraph reemplaza al del layout completo, por eso se repite la imagen.
  return {
    title: titulo,
    openGraph: { type: 'website', siteName: 'Visão Financeira', title: titulo, description: 'Conheça a Visão Financeira: clareza para decidir, segurança para crescer.', locale: 'pt_BR', images: [{ url: '/logo.jpeg', width: 1254, height: 1254 }] },
    twitter: { card: 'summary', title: titulo, images: ['/logo.jpeg'] },
  };
}

export default async function DemoPage({ searchParams }: Props) {
  const { c } = await searchParams;
  return <DemoClient empresa={await nombreEmpresaDemo(c)} />;
}
