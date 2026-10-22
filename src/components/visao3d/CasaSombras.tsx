'use client';

// Sombras "horneadas" de la casa: se dibujan UNA vez en un canvas (huella de cada mueble difuminada + oscurecimiento
// en los rincones junto a las paredes) y se pegan sobre el piso. Dan la sensación de luz real sin sombras en tiempo real.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { desplazarX, PROF, X_CENTRO, X_COCHERA, X_DER, X_IZQ, Z_ATRAS as Z0 } from './CasaLayout';

type Huella = { x: number; z: number; w: number; d: number; r?: number; fuerza?: number };

const PX = 80; // píxeles por unidad del mundo

const PLANTA_BAJA = { x0: X_IZQ, x1: X_DER, y: 0 };
const PLANTA_ALTA = { x0: X_COCHERA, x1: X_DER, y: 3.15 };

const HUELLAS_BAJA: Huella[] = [
  { x: -7.7, z: 0.4, w: 4.3, d: 1.85, fuerza: 1 }, // auto
  { x: -1.5, z: -2.75, w: 2.8, d: 1.05 }, // sofá
  { x: -3.9, z: -3.0, w: 2.0, d: 0.5 }, // TV
  { x: -1.9, z: 0.7, w: 1.5, d: 0.8, fuerza: 0.7 }, // mesa de centro
  { x: 0.05, z: -3.1, w: 1.0, d: 0.4 }, // estante
  { x: -5.1, z: -3.25, w: 0.4, d: 0.25 }, // cargador
  { x: -9.3, z: 2.2, w: 1.6, d: 1.3 }, // cajas
  { x: 3.2, z: 0.3, w: 3.2, d: 1.5, fuerza: 0.8 }, // mesa del comedor
  ...[-1.1, 0, 1.1].flatMap((dx) => [-1, 1].map((s) => ({ x: 3.2 + dx, z: 0.3 + s * 1.05, w: 0.5, d: 0.5, fuerza: 0.8 }))),
  { x: -0.5, z: 2.3, w: 1, d: 1, r: 0.5 }, // plinto
  { x: 3.2, z: 2.4, w: 1, d: 1, r: 0.5 }, // plinto
  { x: 2.1, z: 1.4, w: 0.6, d: 0.6, r: 0.3 }, // personas
  { x: 4.3, z: 1.4, w: 0.5, d: 0.5, r: 0.25 },
];

const HUELLAS_ALTA: Huella[] = [
  { x: -2.4, z: -2.1, w: 2.4, d: 2.6 }, // cama
  { x: -4.0, z: -3.0, w: 0.5, d: 0.5 },
  { x: -0.8, z: -3.0, w: 0.5, d: 0.5 },
  { x: -1.3, z: 0.3, w: 0.6, d: 0.6, r: 0.3 }, // persona
  { x: 3.2, z: -2.6, w: 2.6, d: 1.0, fuerza: 0.8 }, // escritorio
  { x: 3.2, z: -1.5, w: 0.7, d: 0.7, r: 0.35 }, // silla
  { x: 5.2, z: -3.0, w: 0.7, d: 0.6 }, // archivero
  { x: 1.35, z: -3.15, w: 1.3, d: 0.4 }, // estante
  ...[-4.1, -2.05, 0.0, 1.4, 3.2, 5.0].map((x) => ({ x, z: 2.3, w: 1, d: 1, r: 0.5 })), // plintos
];

// Bordes de los cuartos donde el piso se oscurece (pared del fondo y tabiques).
const TABIQUES_BAJA = [X_IZQ, X_COCHERA, X_CENTRO, X_DER];
const TABIQUES_ALTA = [X_COCHERA, X_CENTRO, X_DER];

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
    const cx = (desplazarX(h.x) - planta.x0) * PX;
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
    <mesh position={[(planta.x0 + planta.x1) / 2, planta.y + 0.02, Z0 + PROF / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[ancho, PROF]} />
      <meshBasicMaterial map={textura} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

export function SombrasCasa() {
  return (
    <>
      <Piso planta={PLANTA_BAJA} huellas={HUELLAS_BAJA} tabiques={TABIQUES_BAJA} />
      <Piso planta={PLANTA_ALTA} huellas={HUELLAS_ALTA} tabiques={TABIQUES_ALTA} />
    </>
  );
}
