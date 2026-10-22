'use client';

// Exterior de la casa de Visão 3D: tapiz de ladrillo en las paredes de afuera y techo de tejas oscuras. Los paneles
// llevan las UV escaladas por tamaño, así todos comparten UNA textura y UN material (una sola llamada de dibujo).

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { PROF, X_COCHERA, X_DER, X_IZQ, Z_ATRAS } from './CasaLayout';

type V3 = [number, number, number];

function lienzo(n: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return [c, c.getContext('2d')!];
}

function alAzar(semilla: number) {
  let n = semilla;
  return () => ((n = (n * 16807) % 2147483647) / 2147483647);
}

function texturaLadrillo(): THREE.Texture {
  const [c, g] = lienzo(256);
  g.fillStyle = '#d8d0c4';
  g.fillRect(0, 0, 256, 256);
  const azar = alAzar(23);
  const paleta = ['#b5654a', '#a85a42', '#c2735a', '#9e5440', '#b96d4f'];
  for (let fila = 0; fila < 8; fila++) {
    const desfase = fila % 2 ? 32 : 0;
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + desfase;
      g.fillStyle = paleta[Math.floor(azar() * paleta.length)];
      g.fillRect(x + 2, fila * 32 + 2, 60, 28);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x + 2, fila * 32 + 2, 60, 5);
      g.fillStyle = 'rgba(0,0,0,0.1)';
      g.fillRect(x + 2, fila * 32 + 25, 60, 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function texturaTejas(): THREE.Texture {
  const [c, g] = lienzo(256);
  g.fillStyle = '#1d2129';
  g.fillRect(0, 0, 256, 256);
  const azar = alAzar(41);
  const paleta = ['#343a46', '#3d4452', '#2e333e', '#394050'];
  for (let fila = 0; fila < 8; fila++) {
    const desfase = fila % 2 ? 32 : 0;
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + desfase;
      const y = fila * 32;
      g.fillStyle = paleta[Math.floor(azar() * paleta.length)];
      g.beginPath();
      g.roundRect(x + 1, y + 1, 62, 34, [2, 2, 14, 14]);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.1)';
      g.fillRect(x + 4, y + 2, 56, 3);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x + 4, y + 30, 56, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Caja con UV en unidades del mundo (1 repetición de la textura cada `lado` unidades).
function geometriaUV(w: number, h: number, d: number, lado: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const caras: Array<[number, number]> = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * caras[f][0]) / lado, (uv.getY(i) * caras[f][1]) / lado);
    }
  }
  return g;
}

function Panel({ p, s, rot, map, lado }: { p: V3; s: V3; rot?: V3; map: THREE.Texture; lado: number }) {
  const geo = useMemo(() => geometriaUV(s[0], s[1], s[2], lado), [s[0], s[1], s[2], lado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh position={p} rotation={rot} geometry={geo}>
      <meshStandardMaterial map={map} roughness={0.85} />
    </mesh>
  );
}

// Prisma triangular (hastial) con el eje a lo largo de x.
function Hastial({ p, largo, ancho, alto, color }: { p: V3; largo: number; ancho: number; alto: number; color: string }) {
  const geo = useMemo(() => {
    const f = new THREE.Shape();
    f.moveTo(-ancho / 2, 0);
    f.lineTo(ancho / 2, 0);
    f.lineTo(0, alto);
    f.closePath();
    const g = new THREE.ExtrudeGeometry(f, { depth: largo, bevelEnabled: false });
    g.translate(0, 0, -largo / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [largo, ancho, alto]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh position={p} geometry={geo}>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

const GROSOR_PARED = 0.14;
const PANEL = 0.03;

// Debe ir dentro de un <Fundido> para fundirse en pocas mallas.
export function Fachada() {
  const ladrillo = useMemo(() => (typeof document === 'undefined' ? null : texturaLadrillo()), []);
  const tejas = useMemo(() => (typeof document === 'undefined' ? null : texturaTejas()), []);
  useEffect(() => () => { ladrillo?.dispose(); tejas?.dispose(); }, [ladrillo, tejas]);
  if (!ladrillo || !tejas) return null;

  const cz = Z_ATRAS + PROF / 2;
  const afuera = GROSOR_PARED / 2 + PANEL / 2;
  const zFondo = Z_ATRAS - 0.06 - PANEL / 2;

  // Techo de la casa: dos aguas bajo, tejas oscuras. Pendiente = subida / avance.
  const avance = 4.4;
  const subida = 0.95;
  const angulo = Math.atan2(subida, avance);
  const largoAgua = Math.hypot(avance, subida) + 0.08;
  const anchoTecho = X_DER - X_COCHERA + 0.9;
  const xTecho = (X_DER + X_COCHERA) / 2;
  const yAlero = 6.38;

  return (
    <group>
      {/* Tapiz de ladrillo por fuera. */}
      <Panel p={[X_IZQ - afuera, 1.54, cz]} s={[PANEL, 3.08, PROF]} map={ladrillo} lado={1.6} />
      <Panel p={[X_COCHERA - afuera, 4.685, cz]} s={[PANEL, 3.07, PROF]} map={ladrillo} lado={1.6} />
      <Panel p={[X_DER + afuera, 1.5, cz]} s={[PANEL, 3.0, PROF]} map={ladrillo} lado={1.6} />
      <Panel p={[X_DER + afuera, 4.685, cz]} s={[PANEL, 3.07, PROF]} map={ladrillo} lado={1.6} />
      <Panel p={[(X_IZQ + X_DER) / 2, 1.54, zFondo]} s={[X_DER - X_IZQ, 3.08, PANEL]} map={ladrillo} lado={1.6} />
      <Panel p={[(X_COCHERA + X_DER) / 2, 4.685, zFondo]} s={[X_DER - X_COCHERA, 3.07, PANEL]} map={ladrillo} lado={1.6} />

      {/* Techo de la cochera: una sola agua que cae hacia el frente. */}
      <Panel p={[(X_IZQ + X_COCHERA) / 2 - 0.1, 3.6, 0]} s={[X_COCHERA - X_IZQ + 0.7, 0.12, 8.5]} rot={[0.09, 0, 0]} map={tejas} lado={1.6} />

      {/* Techo de la casa a dos aguas, con hastiales de ladrillo en los extremos. */}
      <Hastial p={[xTecho, yAlero, 0]} largo={anchoTecho - 0.2} ancho={avance * 2 - 0.1} alto={subida - 0.05} color="#9c5238" />
      <Panel p={[xTecho, yAlero + subida / 2 + 0.05, avance / 2]} s={[anchoTecho, 0.12, largoAgua]} rot={[angulo, 0, 0]} map={tejas} lado={1.6} />
      <Panel p={[xTecho, yAlero + subida / 2 + 0.05, -avance / 2]} s={[anchoTecho, 0.12, largoAgua]} rot={[-angulo, 0, 0]} map={tejas} lado={1.6} />
      <mesh position={[xTecho, yAlero + subida + 0.08, 0]}>
        <boxGeometry args={[anchoTecho + 0.05, 0.1, 0.34]} />
        <meshStandardMaterial color="#2a2f39" roughness={0.7} />
      </mesh>
    </group>
  );
}
