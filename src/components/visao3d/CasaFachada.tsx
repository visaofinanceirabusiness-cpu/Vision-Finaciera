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

// Prisma triangular (hastial) con el eje a lo largo de x; el ladrillo se mapea con UV en unidades del mundo.
function Hastial({ p, largo, ancho, alto, map }: { p: V3; largo: number; ancho: number; alto: number; map: THREE.Texture }) {
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
      <meshStandardMaterial map={map} roughness={0.9} />
    </mesh>
  );
}

// Cuña lateral (polígono en el plano z-y, delgada en x) que cierra el hueco bajo un techo inclinado; con ladrillo.
function Cuna({ x, puntos, grosor, map }: { x: number; puntos: Array<[number, number]>; grosor: number; map: THREE.Texture }) {
  const geo = useMemo(() => {
    const f = new THREE.Shape(puntos.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(f, { depth: grosor, bevelEnabled: false });
    g.rotateY(-Math.PI / 2);
    g.translate(grosor / 2, 0, 0);
    return g;
  }, [puntos, grosor]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh position={[x, 0, 0]} geometry={geo}>
      <meshStandardMaterial map={map} roughness={0.9} />
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
  // Para los triángulos las UV salen en unidades del mundo: una repetición por unidad, así que se escala a 1 cada `lado`.
  const ladrilloMundo = useMemo(() => {
    if (!ladrillo) return null;
    const t = ladrillo.clone();
    t.repeat.set(1 / 1.6, 1 / 1.6);
    t.needsUpdate = true;
    return t;
  }, [ladrillo]);
  useEffect(() => () => ladrilloMundo?.dispose(), [ladrilloMundo]);
  const puntosCuna = useMemo<Array<[number, number]>>(() => [[-3.6, 3.08], [4.25, 3.08], [4.25, 3.17], [-3.6, 3.93]], []);
  if (!ladrillo || !tejas || !ladrilloMundo) return null;

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

      {/* Cierre de ladrillo bajo el borde trasero del techo de la cochera. */}
      <Panel p={[(X_IZQ + X_COCHERA) / 2, 3.5, zFondo]} s={[X_COCHERA - X_IZQ, 0.85, PANEL]} map={ladrillo} lado={1.6} />
      {/* Techo de la cochera: una sola agua que cae hacia el frente. */}
      <Panel p={[(X_IZQ - 0.45 + X_COCHERA - 0.07) / 2, 3.6, 0.325]} s={[X_COCHERA - 0.07 - (X_IZQ - 0.45), 0.12, 7.85]} rot={[0.09, 0, 0]} map={tejas} lado={1.6} />

      {/* Techo de la casa a dos aguas, con hastiales de ladrillo en los extremos. */}
      <Hastial p={[xTecho, yAlero, 0]} largo={anchoTecho - 0.2} ancho={avance * 2 - 0.1} alto={subida - 0.05} map={ladrilloMundo} />
      {/* Remate de los hastiales: ventana redonda y cantos blancos sobre las aguas. */}
      {[-1, 1].map((lado) => {
        const xe = xTecho + lado * ((anchoTecho - 0.2) / 2 + 0.012);
        return (
          <group key={lado}>
            <mesh position={[xe, yAlero + 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.3, 0.3, 0.05, 20]} />
              <meshStandardMaterial color="#f4f6fa" roughness={0.5} />
            </mesh>
            <mesh position={[xe + lado * 0.018, yAlero + 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.23, 0.23, 0.05, 20]} />
              <meshStandardMaterial color="#9fc8ea" emissive="#9fc8ea" emissiveIntensity={0.7} roughness={0.1} />
            </mesh>
            {[1, -1].map((agua) => (
              <mesh key={agua} position={[xe + lado * 0.04, yAlero + subida / 2 + 0.02, (agua * avance) / 2]} rotation={[agua * angulo, 0, 0]}>
                <boxGeometry args={[0.1, 0.1, largoAgua]} />
                <meshStandardMaterial color="#f4f6fa" roughness={0.6} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Cochera: cuña de ladrillo que cierra el costado bajo el techo inclinado y canto blanco. */}
      <Cuna x={X_IZQ - 0.1} puntos={puntosCuna} grosor={0.1} map={ladrilloMundo} />
      <mesh position={[X_IZQ - 0.45 + 0.03, 3.6, 0.325]} rotation={[0.09, 0, 0]}>
        <boxGeometry args={[0.1, 0.16, 7.85]} />
        <meshStandardMaterial color="#f4f6fa" roughness={0.6} />
      </mesh>
      <Panel p={[xTecho, yAlero + subida / 2 + 0.05, avance / 2]} s={[anchoTecho, 0.12, largoAgua]} rot={[angulo, 0, 0]} map={tejas} lado={1.6} />
      <Panel p={[xTecho, yAlero + subida / 2 + 0.05, -avance / 2]} s={[anchoTecho, 0.12, largoAgua]} rot={[-angulo, 0, 0]} map={tejas} lado={1.6} />
      <mesh position={[xTecho, yAlero + subida + 0.08, 0]}>
        <boxGeometry args={[anchoTecho + 0.05, 0.1, 0.34]} />
        <meshStandardMaterial color="#2a2f39" roughness={0.7} />
      </mesh>
    </group>
  );
}
