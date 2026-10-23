// Catálogo de objetos 3D reutilizables de Visão 3D (muebles, vehículos, puertas, ventanas, maquinaria y decoración).
// La arquitectura sigue siendo procedural; el catálogo solo dice, para cada objeto, si hay un modelo GLB que lo reemplace.
// Sin GLB (o si falla la carga) se usa el objeto procedural de siempre, así nada se rompe.
//
// Para sumar un modelo no hace falta tocar código: se copia el .glb a public/visao3d/modelos/ y se declara en
// public/visao3d/catalogo.json (ver public/visao3d/README.md).

export type TipoObjeto3D = 'mueble' | 'vehiculo' | 'puerta' | 'ventana' | 'maquinaria' | 'decoracion';
type V3 = [number, number, number];
export type HoraCatalogo = 'dia' | 'atardecer' | 'noche';

export type EntradaCatalogo = {
  id: string;
  tipo: TipoObjeto3D;
  nombre: string;
  glb?: string; // ruta (desde la raíz del sitio) del modelo normal
  glbLiviano?: string; // ruta del modelo liviano para calidad baja (teléfonos)
  draco?: boolean; // el GLB viene comprimido con Draco
  contorno?: number; // grosor del contorno oscuro (estilo ilustración); sin valor = sin contorno
  suavizar?: boolean; // recalcula las normales (modelos exportados sin ellas se ven facetados)
  escala?: number;
  pos?: V3;
  rot?: V3;
};

export type TexturaPBR = { color: string; normal?: string; rugosidad?: string; ao?: string; repetir?: number };

export type ConfigCatalogo = {
  objetos?: Array<Partial<EntradaCatalogo> & { id: string }>;
  hdri?: Partial<Record<HoraCatalogo, string>>; // HDRI por hora del día (Poly Haven, .hdr de 1k–2k)
  pbr?: Record<string, TexturaPBR>; // materiales PBR por nombre (p. ej. "piso_madera")
};

export const CATALOGO_BASE: EntradaCatalogo[] = [
  { id: 'auto', tipo: 'vehiculo', nombre: 'Auto SUV' },
  { id: 'armario', tipo: 'mueble', nombre: 'Armario de dos puertas' },
  { id: 'sofa', tipo: 'mueble', nombre: 'Sofá' },
  { id: 'cama', tipo: 'mueble', nombre: 'Cama' },
  { id: 'mesa_comedor', tipo: 'mueble', nombre: 'Mesa de comedor' },
  { id: 'escritorio', tipo: 'mueble', nombre: 'Escritorio' },
  { id: 'tv', tipo: 'mueble', nombre: 'TV con mueble' },
  { id: 'puerta', tipo: 'puerta', nombre: 'Puerta' },
  { id: 'ventana', tipo: 'ventana', nombre: 'Ventana' },
  { id: 'maquina', tipo: 'maquinaria', nombre: 'Maquinaria' },
  { id: 'planta', tipo: 'decoracion', nombre: 'Planta' },
];

// El JSON puede redefinir campos de un objeto existente o agregar objetos nuevos; una ruta vacía lo deja sin modelo.
export function fusionarCatalogo(base: EntradaCatalogo[], config: ConfigCatalogo | null): Map<string, EntradaCatalogo> {
  const mapa = new Map(base.map((e) => [e.id, { ...e }]));
  for (const o of config?.objetos ?? []) {
    const actual = mapa.get(o.id);
    const unido = { ...(actual ?? { id: o.id, tipo: 'decoracion' as TipoObjeto3D, nombre: o.id }), ...o } as EntradaCatalogo;
    if (unido.glb === '') delete unido.glb;
    if (unido.glbLiviano === '') delete unido.glbLiviano;
    mapa.set(o.id, unido);
  }
  return mapa;
}

// Qué archivo corresponde cargar según la calidad del equipo (en calidad baja se prefiere el liviano; sin ninguno → procedural).
export function rutaModelo(entrada: EntradaCatalogo | undefined, calidad: 'bajo' | 'medio' | 'alto'): string | null {
  if (!entrada) return null;
  if (calidad === 'bajo') return entrada.glbLiviano ?? null;
  return entrada.glb ?? entrada.glbLiviano ?? null;
}
