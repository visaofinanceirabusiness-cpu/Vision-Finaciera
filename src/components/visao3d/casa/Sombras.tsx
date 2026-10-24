'use client';

// Sombras "horneadas" de la casa: se dibujan UNA vez en un canvas (huella de cada mueble difuminada + oscurecimiento
// en los rincones junto a las paredes) y se pegan sobre el piso. Dan la sensación de luz real sin sombras en tiempo real.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TV } from './Objetos';
import { Lugar } from './estructura';
import type { TipoMuebles } from './temas';
import { ObjetoCasa } from '@/lib/visao3dCasa';
import type { PlanoCasa } from '@/lib/visao3dCasaPlano';
import { PROF, X_CENTRO, X_COCHERA, X_DER, X_IZQ, Z_ATRAS as Z0 } from './layout';

type Huella = { x: number; z: number; w: number; d: number; r?: number; fuerza?: number };

const PX = 80; // píxeles por unidad del mundo


// Huellas fijas del mobiliario de los 5 cuartos base, en coordenadas finales del mundo: cada tema tiene su propio mobiliario
// (Muebles.tsx), así que cada uno su lista (una sombra de cama donde ya no hay cama se ve como una mancha negra). Las de los objetos
// de cuentas llegan por `extra`.
const silla = (x: number, z: number): Huella => ({ x, z, w: 0.6, d: 0.6, r: 0.3 });
const HUELLAS_MUEBLES: Record<TipoMuebles, { baja: Huella[]; alta: Huella[] }> = {
  familia: {
    baja: [
      { x: -6.1, z: -3.25, w: 0.4, d: 0.25 }, // cargador
      { x: -2.4, z: 0.7, w: 1.5, d: 0.8, fuerza: 0.7 }, // mesa de centro
      { x: -0.45, z: -3.1, w: 1.0, d: 0.4 }, // estante
      { x: 3.7, z: 0.3, w: 3.2, d: 1.5, fuerza: 0.8 }, // mesa del comedor
      ...[-1.1, 0, 1.1].flatMap((dx) => [-1, 1].map((s) => ({ x: 3.7 + dx, z: 0.3 + s * 1.05, w: 0.5, d: 0.5, fuerza: 0.8 }))),
    ],
    alta: [
      { x: -2.9, z: -2.1, w: 2.4, d: 2.6 }, // cama
      { x: -4.5, z: -3.0, w: 0.5, d: 0.5 },
      { x: -1.3, z: -3.0, w: 0.5, d: 0.5 },
      { x: 3.7, z: -2.6, w: 2.6, d: 1.0, fuerza: 0.8 }, // escritorio
      { x: 3.7, z: -1.5, w: 0.7, d: 0.7, r: 0.35 }, // silla
      { x: 5.7, z: -3.0, w: 0.7, d: 0.6 }, // archivero
      { x: 1.85, z: -3.15, w: 1.3, d: 0.4 }, // estante
    ],
  },
  comercial: {
    baja: [
      { x: -0.8, z: -3.1, w: 1.5, d: 0.4 }, { x: -3.9, z: -3.1, w: 1.5, d: 0.4 }, // góndolas
      { x: -1.6, z: -0.4, w: 2.8, d: 0.8, fuerza: 0.8 }, // mostrador
      { x: 3.7, z: 0.3, w: 3.0, d: 1.3, fuerza: 0.8 }, // mesa
      ...[-1, 0, 1].map((x) => silla(3.7 + x, 1.3)),
    ],
    alta: [
      { x: -4.6, z: -3.1, w: 1.5, d: 0.4 }, { x: -2.9, z: -3.1, w: 1.5, d: 0.4 }, // estantes del depósito
      { x: -2.9, z: -1.5, w: 2.6, d: 1.2, fuerza: 0.8 }, // mesa de trabajo
      { x: -0.9, z: -2.7, w: 0.8, d: 0.8 }, // cajas
      { x: 3.0, z: -2.6, w: 2.6, d: 1.0, fuerza: 0.8 }, silla(3.0, -1.5), { x: 5.6, z: -3.0, w: 0.7, d: 0.6 },
    ],
  },
  oficina: {
    baja: [
      { x: -0.9, z: -2.6, w: 2.6, d: 0.8, fuerza: 0.8 }, // recepción
      { x: 2.4, z: -2.6, w: 2.6, d: 1.0, fuerza: 0.8 }, silla(2.4, -1.5), { x: 5.0, z: -2.6, w: 2.6, d: 1.0, fuerza: 0.8 }, silla(5.0, -1.5),
    ],
    alta: [
      { x: -2.55, z: -1.0, w: 3.4, d: 1.4, fuerza: 0.8 }, // sala de reuniones
      ...[-1.2, -0.4, 0.4, 1.2].map((x) => silla(-2.55 + x, 0.0)),
      { x: 2.4, z: -2.6, w: 2.6, d: 1.0, fuerza: 0.8 }, silla(2.4, -1.5), { x: 5.0, z: -2.6, w: 2.6, d: 1.0, fuerza: 0.8 }, silla(5.0, -1.5), { x: 6.3, z: -3.0, w: 0.7, d: 0.6 },
    ],
  },
  taller: {
    baja: [
      { x: -0.9, z: -3.1, w: 1.6, d: 0.4 }, { x: -1.4, z: 0.6, w: 1.2, d: 1.2 }, // depósito
      { x: 3.7, z: -0.4, w: 3.4, d: 1.2, fuerza: 0.8 }, { x: 5.6, z: 0.9, w: 1.0, d: 1.0 }, { x: 1.4, z: 1.0, w: 1.0, d: 1.0 }, // empaque
    ],
    alta: [
      { x: -2.9, z: -1.6, w: 3.6, d: 1.0, fuerza: 0.8 }, { x: -2.9, z: 0.2, w: 3.6, d: 1.0, fuerza: 0.8 }, { x: -0.8, z: -2.9, w: 0.8, d: 0.8 },
      { x: 2.8, z: -2.6, w: 2.6, d: 1.0, fuerza: 0.8 }, silla(2.8, -1.5), { x: 5.6, z: -3.0, w: 0.7, d: 0.6 }, { x: 1.35, z: -3.15, w: 1.3, d: 0.4 },
    ],
  },
};

// Bordes de los cuartos donde el piso se oscurece (pared del fondo y tabiques).

function dibujar(planta: { x0: number; x1: number }, huellas: Huella[], tabiques: number[]): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const W = Math.round((planta.x1 - planta.x0) * PX);
  const H = Math.round(PROF * PX);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, W, H);

  // Oclusión en rincones: pared del fondo y tabiques.
  const fondo = ctx.createLinearGradient(0, 0, 0, 1.1 * PX);
  fondo.addColorStop(0, 'rgba(0,0,0,0.6)');
  fondo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, 1.1 * PX);
  tabiques.forEach((x) => {
    const px = (x - planta.x0) * PX;
    [1, -1].forEach((lado) => {
      const g = ctx.createLinearGradient(px, 0, px + lado * 0.7 * PX, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lado > 0 ? px : px - 0.7 * PX, 0, 0.7 * PX, H);
    });
  });

  // Huellas: la sombra se dibuja desplazada fuera del canvas y solo entra su difuminado.
  const lejos = W + 400;
  ctx.fillStyle = '#000';
  huellas.forEach((h) => {
    const cx = (h.x - planta.x0) * PX;
    const cy = (h.z - Z0) * PX;
    [[1.1, 0.9], [0.3, 0.8]].forEach(([blur, alfa]) => {
      ctx.shadowColor = `rgba(0,0,0,${alfa * (h.fuerza ?? 0.85)})`;
      ctx.shadowBlur = blur * PX;
      ctx.shadowOffsetX = lejos - 6;
      ctx.shadowOffsetY = -6;
      ctx.beginPath();
      if (h.r) ctx.arc(cx - lejos, cy, h.r * PX, 0, Math.PI * 2);
      else ctx.rect(cx - lejos - (h.w * PX) / 2, cy - (h.d * PX) / 2, h.w * PX, h.d * PX);
      ctx.fill();
    });
  });
  return canvas;
}

function Piso({ planta, huellas, tabiques }: { planta: { x0: number; x1: number; y: number }; huellas: Huella[]; tabiques: number[] }) {
  const textura = useMemo(() => {
    const canvas = dibujar(planta, huellas, tabiques);
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [planta, huellas, tabiques]);
  useEffect(() => () => textura?.dispose(), [textura]);
  if (!textura) return null;
  const ancho = planta.x1 - planta.x0;
  return (
    <mesh position={[(planta.x0 + planta.x1) / 2, planta.y + 0.05, Z0 + PROF / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[ancho, PROF]} />
      <meshBasicMaterial map={textura} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  );
}

export function SombrasCasa({ plano, extra, muebles }: { plano: PlanoCasa; extra: Huella[][]; muebles: TipoMuebles }) {
  // Una "planta" por piso del plano (sus cuartos van pegados). Las huellas fijas de la casa base son de los pisos 0 y 1.
  const plantas = useMemo(
    () =>
      Array.from({ length: plano.pisos }, (_, piso) => {
        const cuartos = plano.cuartos.filter((c) => c.piso === piso);
        const x0 = Math.min(...cuartos.map((c) => c.x0));
        const x1 = Math.max(...cuartos.map((c) => c.x1));
        const tabiques = [...new Set(cuartos.flatMap((c) => [c.x0, c.x1]))];
        const fijas = HUELLAS_MUEBLES[muebles];
        const huellas = [...(piso === 0 ? fijas.baja : piso === 1 ? fijas.alta : []), ...(extra[piso] ?? [])];
        return { planta: { x0, x1, y: piso * 3.75 }, tabiques, huellas };
      }),
    [plano, extra, muebles]
  );
  return (
    <>
      {plantas.map((p) => (
        <Piso key={p.planta.y} planta={p.planta} huellas={p.huellas} tabiques={p.tabiques} />
      ))}
    </>
  );
}

// Huellas de sombra de los objetos que dependen de las cuentas (pilares, sofá y TV), en coordenadas del mundo, por piso.
export function huellasDeObjetos(objetos: ObjetoCasa[], lugares: Map<string, Lugar>): Huella[][] {
  const porPiso: Huella[][] = [];
  const agregar = (piso: number, h: Huella) => {
    while (porPiso.length <= piso) porPiso.push([]);
    porPiso[piso].push(h);
  };
  for (const o of objetos) {
    const { pos } = lugares.get(o.id)!;
    if (o.modo === 'plinto') agregar(Math.floor(pos[1] / 3.75), { x: pos[0], z: pos[2], w: 1, d: 1, r: 0.5 });
    else if (o.modo === 'sofa') agregar(0, { x: pos[0], z: pos[2], w: 0.95, d: 2.4, fuerza: 0.9 });
    else if (o.modo === 'tv') agregar(0, { x: pos[0], z: pos[2], w: 2, d: 0.5 });
  }
  return porPiso;
}
