'use client';

// Exterior de la casa de Visão 3D: tapiz de ladrillo en las paredes de afuera y techo de tejas oscuras. Los paneles
// llevan las UV escaladas por tamaño, así todos comparten UNA textura y UN material (una sola llamada de dibujo).

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Letrero } from '../base/Compartido3D';
import { esInteriorEn } from './Paredes';
import type { TemaCasa } from './temas';
import { PROF, X_COCHERA, X_DER, X_IZQ, Z_ATRAS } from './layout';
import type { Cuarto } from '@/lib/visao3dCasaPlano';

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

type MapasTecho = { ladrilloMundo: THREE.Texture; tejas: THREE.Texture };

// Techo a dos aguas con tejas oscuras y hastiales de ladrillo (mismas medidas que el de la casa base) sobre un tramo de cuartos
// [x0, x1] cuyo cielorraso está en `yCielo` (y1 de sus cuartos). Se usa en las casas ampliadas, un tejado por tramo.
export function Tejado({ x0, x1, yCielo, mapas }: { x0: number; x1: number; yCielo: number; mapas: MapasTecho }) {
  const avance = 4.4;
  const subida = 0.95;
  const angulo = Math.atan2(subida, avance);
  const largoAgua = Math.hypot(avance, subida) + 0.08;
  const anchoTecho = x1 - x0 + 0.9;
  const xTecho = (x0 + x1) / 2;
  const yAlero = yCielo + 0.23;
  const { ladrilloMundo, tejas } = mapas;
  return (
    <group>
      <Hastial p={[xTecho, yAlero, 0]} largo={anchoTecho - 0.2} ancho={avance * 2 - 0.1} alto={subida - 0.05} map={ladrilloMundo} />
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
      <Panel p={[xTecho, yAlero + subida / 2 + 0.05, avance / 2]} s={[anchoTecho, 0.12, largoAgua]} rot={[angulo, 0, 0]} map={tejas} lado={1.6} />
      <Panel p={[xTecho, yAlero + subida / 2 + 0.05, -avance / 2]} s={[anchoTecho, 0.12, largoAgua]} rot={[-angulo, 0, 0]} map={tejas} lado={1.6} />
      <mesh position={[xTecho, yAlero + subida + 0.08, 0]}>
        <boxGeometry args={[anchoTecho + 0.05, 0.1, 0.34]} />
        <meshStandardMaterial color="#2a2f39" roughness={0.7} />
      </mesh>
    </group>
  );
}

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
  const puntosCuna = useMemo<Array<[number, number]>>(() => [[-3.6, 3.68], [4.25, 3.68], [4.25, 3.77], [-3.6, 4.53]], []);
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
  const yAlero = 7.58;

  return (
    <group>
      {/* Tapiz de ladrillo por fuera. */}
      <Panel p={[X_IZQ - afuera, 1.84, cz]} s={[PANEL, 3.68, PROF]} map={ladrillo} lado={1.6} />
      <Panel p={[X_COCHERA - afuera, 5.585, cz]} s={[PANEL, 3.67, PROF]} map={ladrillo} lado={1.6} />
      <Panel p={[X_DER + afuera, 1.8, cz]} s={[PANEL, 3.6, PROF]} map={ladrillo} lado={1.6} />
      <Panel p={[X_DER + afuera, 5.585, cz]} s={[PANEL, 3.67, PROF]} map={ladrillo} lado={1.6} />
      <Panel p={[(X_IZQ + X_DER) / 2, 1.84, zFondo]} s={[X_DER - X_IZQ, 3.68, PANEL]} map={ladrillo} lado={1.6} />
      <Panel p={[(X_COCHERA + X_DER) / 2, 5.585, zFondo]} s={[X_DER - X_COCHERA, 3.67, PANEL]} map={ladrillo} lado={1.6} />

      {/* Cierre de ladrillo bajo el borde trasero del techo de la cochera. */}
      <Panel p={[(X_IZQ + X_COCHERA) / 2, 4.1, zFondo]} s={[X_COCHERA - X_IZQ, 0.85, PANEL]} map={ladrillo} lado={1.6} />
      {/* Techo de la cochera: una sola agua que cae hacia el frente. */}
      <Panel p={[(X_IZQ - 0.45 + X_COCHERA - 0.07) / 2, 4.2, 0.325]} s={[X_COCHERA - 0.07 - (X_IZQ - 0.45), 0.12, 7.85]} rot={[0.09, 0, 0]} map={tejas} lado={1.6} />

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
      <mesh position={[X_IZQ - 0.45 + 0.03, 4.2, 0.325]} rotation={[0.09, 0, 0]}>
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

// Concreto en paneles (muros de negocios y talleres) y vidrio azulado con perfiles (oficinas): mismas UV por unidades que el ladrillo.
function texturaConcretoPaneles(): THREE.Texture {
  const [c, g] = lienzo(256);
  g.fillStyle = '#b9bdc4';
  g.fillRect(0, 0, 256, 256);
  const azar = alAzar(41);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${azar() > 0.5 ? '255,255,255' : '40,45,55'},${0.03 + azar() * 0.05})`;
    g.fillRect(azar() * 256, azar() * 256, 2 + azar() * 6, 2 + azar() * 6);
  }
  g.fillStyle = 'rgba(40,45,55,0.35)';
  g.fillRect(0, 0, 256, 3);
  g.fillRect(0, 0, 3, 256);
  g.fillRect(126, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function texturaVidrioOficina(): THREE.Texture {
  const [c, g] = lienzo(256);
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#5a86a8');
  grad.addColorStop(0.5, '#7aa6c6');
  grad.addColorStop(1, '#4c7595');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.beginPath();
  g.moveTo(0, 200);
  g.lineTo(130, 0);
  g.lineTo(190, 0);
  g.lineTo(0, 290);
  g.fill();
  g.fillStyle = '#e8edf2';
  g.fillRect(0, 0, 256, 5);
  g.fillRect(0, 0, 5, 256);
  g.fillRect(126, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Techo plano con antepecho (negocios y oficinas): losa clara y un borde oscuro.
function TechoPlano({ x0, x1, yCielo, volIzq, volDer }: { x0: number; x1: number; yCielo: number; volIzq: number; volDer: number }) {
  const xa = x0 - volIzq;
  const xb = x1 + volDer;
  const cx = (xa + xb) / 2;
  const ancho = xb - xa;
  return (
    <group>
      <mesh position={[cx, yCielo + 0.08, 0]}>
        <boxGeometry args={[ancho, 0.16, PROF + 1.1]} />
        <meshStandardMaterial color="#e3e6ec" roughness={0.6} />
      </mesh>
      <mesh position={[cx, yCielo + 0.3, 3.9]}>
        <boxGeometry args={[ancho, 0.4, 0.14]} />
        <meshStandardMaterial color="#2f3640" roughness={0.7} />
      </mesh>
      <mesh position={[cx, yCielo + 0.3, -3.9]}>
        <boxGeometry args={[ancho, 0.4, 0.14]} />
        <meshStandardMaterial color="#2f3640" roughness={0.7} />
      </mesh>
    </group>
  );
}

// Techo de taller en dientes de sierra: cada diente es una chapa inclinada con su lado vertical vidriado, y una chimenea.
function TechoSierra({ x0, x1, yCielo, volIzq, volDer }: { x0: number; x1: number; yCielo: number; volIzq: number; volDer: number }) {
  const dientes = Math.max(2, Math.round((x1 - x0) / 3.1));
  const paso = (x1 - x0) / dientes;
  const y = yCielo + 0.16;
  return (
    <group>
      <mesh position={[(x0 + x1 + volDer - volIzq) / 2, yCielo + 0.08, 0]}>
        <boxGeometry args={[x1 - x0 + volIzq + volDer, 0.16, PROF + 1.0]} />
        <meshStandardMaterial color="#9aa1ab" roughness={0.7} />
      </mesh>
      {Array.from({ length: dientes }, (_, i) => {
        const xi = x0 + paso * (i + 0.5);
        return (
          <group key={i} position={[xi, y, 0]}>
            <mesh position={[paso * 0.08, 0.55, 0]} rotation={[0, 0, -0.38]}>
              <boxGeometry args={[paso * 0.98, 0.1, PROF + 0.9]} />
              <meshStandardMaterial color="#5d6570" roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[-paso * 0.46, 0.5, 0]}>
              <boxGeometry args={[0.06, 1.0, PROF + 0.6]} />
              <meshStandardMaterial color="#9fc8ea" emissive="#9fc8ea" emissiveIntensity={0.45} roughness={0.1} transparent opacity={0.85} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[x1 - 0.9, yCielo + 1.7, -1.6]}>
        <cylinderGeometry args={[0.28, 0.34, 3.0, 14]} />
        <meshStandardMaterial color="#8a8f98" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Toldo a rayas pegado al frente de la planta baja (el frente de la casa está en z = Z_ATRAS + PROF): arranca en la fachada, cae hacia
// afuera, lleva volado y dos columnas, y llega exactamente de pared a pared.
function Toldo({ x0, x1, color }: { x0: number; x1: number; color: string }) {
  const tiras = Math.max(4, Math.round((x1 - x0) / 0.8));
  const ancho = (x1 - x0) / tiras;
  const zFrente = Z_ATRAS + PROF;
  const largo = 1.3;
  const caida = 0.38;
  // Arranca justo bajo el borde del piso de arriba (el piso 1 empieza en 3,675): así queda pegado a la casa y no flotando.
  const yAlto = 3.62;
  const yBajo = yAlto - largo * Math.sin(caida);
  return (
    <group position={[0, 0, zFrente]}>
      {Array.from({ length: tiras }, (_, i) => (
        <mesh key={i} position={[x0 + ancho * (i + 0.5), (yAlto + yBajo) / 2, (largo * Math.cos(caida)) / 2]} rotation={[caida, 0, 0]}>
          <boxGeometry args={[ancho, 0.05, largo]} />
          <meshStandardMaterial color={i % 2 ? '#f4f1ea' : color} roughness={0.85} />
        </mesh>
      ))}
      {/* Riel de anclaje contra el frente, a todo lo ancho. */}
      <mesh position={[(x0 + x1) / 2, yAlto - 0.02, 0.04]}>
        <boxGeometry args={[x1 - x0, 0.16, 0.08]} />
        <meshStandardMaterial color="#2a2f39" roughness={0.6} />
      </mesh>
      <mesh position={[(x0 + x1) / 2, yBajo - 0.07, largo * Math.cos(caida)]}>
        <boxGeometry args={[x1 - x0, 0.14, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {[x0 + 0.05, x1 - 0.05].map((x) => (
        <group key={x}>
          <mesh position={[x, (yBajo - 0.07) / 2, largo * Math.cos(caida) - 0.05]}>
            <cylinderGeometry args={[0.045, 0.045, yBajo - 0.07, 8]} />
            <meshStandardMaterial color="#2a2f39" roughness={0.6} />
          </mesh>
          <mesh position={[x, yAlto - 0.03, 0.03]}>
            <boxGeometry args={[0.08, 0.1, 0.08]} />
            <meshStandardMaterial color="#2a2f39" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Techo de una sola agua que cae hacia el frente, para los tramos con un cuarto más alto al lado (el tejado a dos aguas se metía en ese cuarto).
function TechoUnaAgua({ x0, x1, yCielo, volIzq, volDer, mapas }: { x0: number; x1: number; yCielo: number; volIzq: number; volDer: number; mapas: MapasTecho }) {
  const xa = x0 - volIzq;
  const xb = x1 + volDer;
  const dy = yCielo - 3.6;
  const puntos: Array<[number, number]> = [[-3.6, 3.68 + dy], [4.25, 3.68 + dy], [4.25, 3.77 + dy], [-3.6, 4.53 + dy]];
  return (
    <group>
      <Panel p={[(xa + xb) / 2, 4.2 + dy, 0.325]} s={[xb - xa, 0.12, 7.85]} rot={[0.09, 0, 0]} map={mapas.tejas} lado={1.6} />
      {volIzq > 0 && <Cuna x={x0 - 0.1} puntos={puntos} grosor={0.1} map={mapas.ladrilloMundo} />}
      {volDer > 0 && <Cuna x={x1 + 0.1} puntos={puntos} grosor={0.1} map={mapas.ladrilloMundo} />}
    </group>
  );
}

// Exterior de una casa ampliada o de un negocio: revestimiento por tema (ladrillo, concreto o vidrio) en cada cuarto y un techo por
// tramo de cuartos sin piso encima (dos aguas, plano o dientes de sierra), con toldo y cartel con el nombre de la empresa.
// La casa base de Familia conserva su fachada propia (Fachada).
export function FachadaPlano({ cuartos, tema, nombre }: { cuartos: Cuarto[]; tema: TemaCasa; nombre: string }) {
  const revestimiento = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return tema.fachada === 'concreto' ? texturaConcretoPaneles() : tema.fachada === 'vidrio' ? texturaVidrioOficina() : texturaLadrillo();
  }, [tema.fachada]);
  const tejas = useMemo(() => (typeof document === 'undefined' ? null : texturaTejas()), []);
  const ladrilloMundo = useMemo(() => {
    if (!revestimiento) return null;
    const t = revestimiento.clone();
    t.repeat.set(1 / 1.6, 1 / 1.6);
    t.needsUpdate = true;
    return t;
  }, [revestimiento]);
  useEffect(() => () => { revestimiento?.dispose(); tejas?.dispose(); ladrilloMundo?.dispose(); }, [revestimiento, tejas, ladrilloMundo]);
  // Tramos de cuartos sin piso encima (y a la misma altura) que se tocan: cada uno lleva su techo.
  const tramos = useMemo(() => {
    const libres = cuartos.filter((c) => !cuartos.some((o) => o.y0 > c.y0 && o.x0 < c.x1 - 0.05 && o.x1 > c.x0 + 0.05)).sort((a, b) => a.y1 - b.y1 || a.x0 - b.x0);
    const resultado: Array<{ x0: number; x1: number; y1: number }> = [];
    for (const c of libres) {
      const ultimo = resultado[resultado.length - 1];
      if (ultimo && ultimo.y1 === c.y1 && Math.abs(ultimo.x1 - c.x0) < 0.05) ultimo.x1 = c.x1;
      else resultado.push({ x0: c.x0, x1: c.x1, y1: c.y1 });
    }
    // Un lado con un cuarto más alto pegado no tiene volado (el techo no puede meterse en ese cuarto).
    return resultado.map((t) => ({
      ...t,
      volIzq: cuartos.some((o) => o.y1 > t.y1 + 0.01 && Math.abs(o.x1 - t.x0) < 0.05) ? 0 : 1,
      volDer: cuartos.some((o) => o.y1 > t.y1 + 0.01 && Math.abs(o.x0 - t.x1) < 0.05) ? 0 : 1,
    }));
  }, [cuartos]);
  if (!revestimiento || !tejas || !ladrilloMundo) return null;

  const cz = Z_ATRAS + PROF / 2;
  const afuera = GROSOR_PARED / 2 + PANEL / 2;
  const zFondo = Z_ATRAS - 0.06 - PANEL / 2;
  const x0 = Math.min(...cuartos.map((c) => c.x0));
  const x1 = Math.max(...cuartos.map((c) => c.x1));
  const alto = Math.max(...cuartos.map((c) => c.y1));
  const planta = cuartos.filter((c) => c.y0 === 0);
  return (
    <group>
      {cuartos.map((c) => {
        const altura = c.y1 - c.y0 + 0.08;
        const cy = c.y0 + altura / 2 - 0.04;
        const cx = (c.x0 + c.x1) / 2;
        return (
          <group key={c.id}>
            <Panel p={[cx, cy, zFondo]} s={[c.x1 - c.x0, altura, PANEL]} map={revestimiento} lado={1.6} />
            {!esInteriorEn(cuartos, c, c.x0) && <Panel p={[c.x0 - afuera, cy, cz]} s={[PANEL, altura, PROF]} map={revestimiento} lado={1.6} />}
            {!esInteriorEn(cuartos, c, c.x1) && <Panel p={[c.x1 + afuera, cy, cz]} s={[PANEL, altura, PROF]} map={revestimiento} lado={1.6} />}
          </group>
        );
      })}
      {tramos.map((t) => {
        const clave = `${t.y1}|${t.x0}`;
        const vi = t.volIzq * 0.3;
        const vd = t.volDer * 0.3;
        if (tema.techo === 'plano') return <TechoPlano key={clave} x0={t.x0} x1={t.x1} yCielo={t.y1} volIzq={vi} volDer={vd} />;
        if (tema.techo === 'sierra') return <TechoSierra key={clave} x0={t.x0} x1={t.x1} yCielo={t.y1} volIzq={vi} volDer={vd} />;
        // Dos aguas solo si no hay un cuarto más alto al lado; si lo hay, una sola agua.
        if (t.volIzq === 0 || t.volDer === 0) return <TechoUnaAgua key={clave} x0={t.x0} x1={t.x1} yCielo={t.y1} volIzq={t.volIzq * 0.4} volDer={t.volDer * 0.4} mapas={{ ladrilloMundo, tejas }} />;
        return <Tejado key={clave} x0={t.x0} x1={t.x1} yCielo={t.y1} mapas={{ ladrilloMundo, tejas }} />;
      })}
      {tema.toldo && planta.length > 0 && <Toldo x0={Math.min(...planta.map((c) => c.x0)) + 0.4} x1={Math.max(...planta.map((c) => c.x1)) - 0.4} color={tema.toldo} />}
      {tema.cartel && nombre && (
        <group position={[(x0 + x1) / 2, alto + (tema.techo === 'dosAguas' ? 2.6 : 1.3), 3.7]}>
          <mesh>
            <boxGeometry args={[Math.min(7, (x1 - x0) * 0.4), 1.3, 0.14]} />
            <meshStandardMaterial color={tema.fondoCartel} roughness={0.5} />
          </mesh>
          <Letrero lineas={[nombre.toUpperCase().slice(0, 28)]} brillo="#ffffff" ancho={Math.min(6.6, (x1 - x0) * 0.38)} alto={1.1} posicion={[0, 0, 0.08]} fondo={tema.fondoCartel} />
          {[-1, 1].map((l) => (
            <mesh key={l} position={[l * Math.min(3.1, (x1 - x0) * 0.18), -0.9, 0]}>
              <boxGeometry args={[0.12, 0.6, 0.12]} />
              <meshStandardMaterial color="#2a2f39" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
