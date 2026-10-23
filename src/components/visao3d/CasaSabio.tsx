'use client';

// "Sabio": la lechuza mascota de Visão Financeira da la bienvenida junto al camino de entrada de la casa (modelo Familia).
// Todo procedural: cuerpo, cabeza con anteojos redondos, saco azul con el logo y un dedo en alto (el lema vive en el cuadro de la cochera).
// Tres <Fundido> (cuerpo, cabeza y brazo en alto) para que se mueva con muy pocas llamadas de dibujo.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Fundido, Letrero } from './Compartido3D';
import { ObjetoCatalogo } from './catalogo/ObjetoCatalogo';

type V3 = [number, number, number];

const MARRON = '#7a4326';
const MARRON_OSCURO = '#5b3119';
const CREMA = '#f1dfba';
const AZUL = '#1b2f6b';
const AZUL_OSCURO = '#142556';
const NARANJA = '#e8892a';

// Esferas con degradé vertical y un leve ruido por vértice: el plumaje y la ropa tienen matices en vez de un color plano.
const cacheGeo = new Map<string, THREE.SphereGeometry>();
function geoDegradada(color: string): THREE.SphereGeometry {
  let g = cacheGeo.get(color);
  if (g) return g;
  g = new THREE.SphereGeometry(1, 22, 16);
  const top = new THREE.Color(color).offsetHSL(0, 0.0, 0.045);
  const bottom = new THREE.Color(color).offsetHSL(0, 0.02, -0.075);
  const pos = g.attributes.position;
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (y + 1) / 2;
    const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1;
    c.copy(bottom).lerp(top, t).multiplyScalar(1 + (n - 0.5) * 0.12 + z * 0.05);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  cacheGeo.set(color, g);
  return g;
}

function Elipsoide({ p, s, color, rough = 0.85, rot }: { p: V3; s: V3; color: string; rough?: number; rot?: V3 }) {
  return (
    <mesh position={p} scale={s} rotation={rot} geometry={geoDegradada(color)}>
      <meshStandardMaterial vertexColors roughness={rough} />
    </mesh>
  );
}

function Cono({ p, r, h, color, rot }: { p: V3; r: number; h: number; color: string; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot}>
      <coneGeometry args={[r, h, 10]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Caja({ p, s, color, rot, rough = 0.8 }: { p: V3; s: V3; color: string; rot?: V3; rough?: number }) {
  return (
    <mesh position={p} rotation={rot}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

// Logo de Visão Financeira: dos tildes y la flecha verde que sube.
// Logo real de Visão Financeira (coordenadas del arte original, 1256 px): dos tildes y la flecha en zigzag que sube.
// `tilde` = color de los tildes (blanco sobre el saco azul, azul sobre claro).
const TILDE_IZQ: Array<[number, number]> = [[335, 318], [400, 318], [441, 392], [580, 270], [588, 182], [437, 482]];
const TILDE_DER: Array<[number, number]> = [[465, 552], [528, 552], [580, 633], [805, 265], [863, 265], [580, 728]];
const FLECHA: Array<[number, number]> = [[372, 626], [466, 484], [518, 498], [606, 372], [658, 412], [820, 214]];
const PUNTA: Array<[number, number]> = [[778, 160], [878, 117], [852, 219], [826, 206]];

export function dibujarLogo(g: CanvasRenderingContext2D, x: number, y: number, ancho: number, tilde: string) {
  // Caja del logo en el arte: x 330..880, y 110..735.
  const k = ancho / 550;
  const pt = ([px, py]: [number, number]): [number, number] => [x + (px - 330) * k, y + (py - 110) * k];
  const poli = (pts: Array<[number, number]>, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    pts.forEach((q, i) => {
      const [qx, qy] = pt(q);
      if (i === 0) g.moveTo(qx, qy);
      else g.lineTo(qx, qy);
    });
    g.closePath();
    g.fill();
  };
  poli(TILDE_IZQ, tilde);
  poli(TILDE_DER, tilde);
  g.strokeStyle = '#2f9e4f';
  g.lineWidth = 30 * k;
  g.lineJoin = 'miter';
  g.lineCap = 'butt';
  g.beginPath();
  FLECHA.forEach((q, i) => {
    const [qx, qy] = pt(q);
    if (i === 0) g.moveTo(qx, qy);
    else g.lineTo(qx, qy);
  });
  g.stroke();
  poli(PUNTA, '#2f9e4f');
}

function texturaLogo(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 580;
  const g = c.getContext('2d')!;
  dibujarLogo(g, 16, 12, 480, '#ffffff');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Ojo: iris ámbar con aro oscuro, pupila y dos reflejos (se pega sobre la esclerótica).
function texturaOjo(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const iris = g.createRadialGradient(64, 64, 8, 64, 64, 56);
  iris.addColorStop(0, '#f0b13a');
  iris.addColorStop(0.55, '#c27a1c');
  iris.addColorStop(0.9, '#6b3c0c');
  iris.addColorStop(1, 'rgba(60,30,5,0)');
  g.fillStyle = iris;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0a0a0c';
  g.beginPath();
  g.arc(64, 64, 25, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.arc(48, 46, 11, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath();
  g.arc(82, 82, 5, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Cuadro de la cochera: logo de Visão Financeira y el lema de la marca.
export function texturaCuadro(esPT: boolean): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const g = c.getContext('2d')!;
  const fondo = g.createLinearGradient(0, 0, 1024, 640);
  fondo.addColorStop(0, '#142556');
  fondo.addColorStop(1, '#1b2f6b');
  g.fillStyle = fondo;
  g.fillRect(0, 0, 1024, 640);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(0, 0, 1024, 12);
  dibujarLogo(g, 70, 90, 300, '#ffffff');
  g.textAlign = 'left';
  g.fillStyle = '#ffffff';
  g.font = '800 96px system-ui, sans-serif';
  g.fillText('VISÃO', 430, 190);
  g.fillStyle = '#35c25f';
  g.font = '800 58px system-ui, sans-serif';
  g.fillText('FINANCEIRA', 432, 262);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(432, 292, 520, 4);
  g.font = '700 44px system-ui, sans-serif';
  const lineas = esPT ? [['CLAREZA PARA DECIDIR,', '#ffffff'], ['SEGURANÇA PARA', '#ffffff'], ['CRESCER.', '#35c25f']] : [['CLARIDAD PARA DECIDIR,', '#ffffff'], ['SEGURIDAD PARA', '#ffffff'], ['CRECER.', '#35c25f']];
  lineas.forEach(([t, col], i) => {
    g.fillStyle = col;
    g.fillText(t, 432, 366 + i * 62);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Cuadro enmarcado para la pared (el frente mira a +z).
export function CuadroLogo({ p, ancho = 2.8, esPT = false }: { p: V3; ancho?: number; esPT?: boolean }) {
  const textura = useMemo(() => (typeof document === 'undefined' ? null : texturaCuadro(esPT)), [esPT]);
  useEffect(() => () => textura?.dispose(), [textura]);
  if (!textura) return null;
  const alto = (ancho * 640) / 1024;
  return (
    <group position={p}>
      <Caja p={[0, 0, 0]} s={[ancho + 0.22, alto + 0.22, 0.06]} color="#6b4a2f" rough={0.55} />
      <Caja p={[0, 0, 0.032]} s={[ancho + 0.1, alto + 0.1, 0.02]} color="#d9b872" rough={0.35} />
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[ancho, alto]} />
        <meshStandardMaterial map={textura} roughness={0.5} />
      </mesh>
    </group>
  );
}

function texturaSombra(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(0,0,0,0.55)');
  r.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Cápsula entre dos puntos (brazos): se orienta con un cuaternión desde el eje y.
function Segmento({ a, b, r, color }: { a: V3; b: V3; r: number; color: string }) {
  const { pos, quat, largo } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    return { pos: va.clone().add(vb).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), largo: Math.max(0.001, d.length() - 2 * r) };
  }, [a, b, r]);
  return (
    <mesh position={pos} quaternion={quat}>
      <capsuleGeometry args={[r, largo, 6, 14]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

// Dedo con dos falanges que se doblan: `base` es donde nace, `dir` hacia dónde apunta (se normaliza), `doblez` cuánto cae la segunda falange.
function Dedo({ base, dir, largo = 0.1, r = 0.03, doblez = 0.5, color = '#7a4326', punta = '#6a381c', uña }: { base: V3; dir: V3; largo?: number; r?: number; doblez?: number; color?: string; punta?: string; uña?: string }) {
  const d = new THREE.Vector3(...dir).normalize();
  const b = new THREE.Vector3(...base);
  const j = b.clone().addScaledVector(d, largo);
  const abajo = new THREE.Vector3(0, -1, 0);
  const d2 = d.clone().lerp(abajo, doblez).normalize();
  const t = j.clone().addScaledVector(d2, largo * 0.85);
  const a: V3 = [b.x, b.y, b.z];
  const m: V3 = [j.x, j.y, j.z];
  const e: V3 = [t.x, t.y, t.z];
  return (
    <group>
      <Segmento a={a} b={m} r={r} color={color} />
      <Elipsoide p={m} s={[r * 1.12, r * 1.12, r * 1.12]} color={punta} />
      <Segmento a={m} b={e} r={r * 0.88} color={color} />
      <Elipsoide p={e} s={[r * 0.95, r * 0.95, r * 0.95]} color={punta} />
      {uña && <Elipsoide p={[e[0], e[1] - r * 0.2, e[2] + r * 0.55]} s={[r * 0.55, r * 0.4, r * 0.3]} color={uña} />}
    </group>
  );
}

// Solapa del saco (polígono extruido con muesca) y camisa en V: el pecho se lee como un saco de verdad.
function Solapa({ lado }: { lado: 1 | -1 }) {
  const geo = useMemo(() => {
    const pts: Array<[number, number]> = [[0.035, 1.12], [0.16, 1.14], [0.22, 1.02], [0.15, 0.96], [0.17, 0.78], [0.03, 0.6]];
    const f = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * lado, y)));
    return new THREE.ExtrudeGeometry(f, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
  }, [lado]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={[0, 0, 0.47]} rotation={[0, lado * 0.1, 0]}>
      <meshStandardMaterial color="#15275d" roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Camisa() {
  const geo = useMemo(() => {
    const f = new THREE.Shape([new THREE.Vector2(-0.075, 1.14), new THREE.Vector2(0.075, 1.14), new THREE.Vector2(0.0, 0.6)]);
    return new THREE.ExtrudeGeometry(f, { depth: 0.02, bevelEnabled: false });
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo} position={[0, 0, 0.455]}>
        <meshStandardMaterial color="#f6ecd6" roughness={0.9} />
      </mesh>
      {[-1, 1].map((l) => <Caja key={l} p={[l * 0.07, 1.15, 0.47]} s={[0.11, 0.04, 0.04]} color="#f6ecd6" rot={[0, 0, l * -0.5]} />)}
    </group>
  );
}

export function Sabio({ p, esc = 1, esPT = false, rot = 0 }: { p: V3; esc?: number; esPT?: boolean; rot?: number }) {
  const cuerpo = useRef<THREE.Group>(null);
  const cabeza = useRef<THREE.Group>(null);
  const brazo = useRef<THREE.Group>(null);
  const mano = useRef<THREE.Group>(null);
  const cartel = useRef<THREE.Group>(null);
  const parpados = useRef<THREE.Group>(null);
  const sombra = useMemo(() => (typeof document === 'undefined' ? null : texturaSombra()), []);
  const logo = useMemo(() => (typeof document === 'undefined' ? null : texturaLogo()), []);
  const ojo = useMemo(() => (typeof document === 'undefined' ? null : texturaOjo()), []);
  const reducido = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useEffect(() => () => { logo?.dispose(); sombra?.dispose(); ojo?.dispose(); }, [logo, sombra, ojo]);

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    if (cartel.current) cartel.current.rotation.y = Math.atan2(camera.position.x - p[0], camera.position.z - p[2]) - rot;
    if (reducido) return;
    if (parpados.current) {
      // Parpadeo cada ~4 s: los párpados bajan y suben en una fracción de segundo.
      const ciclo = t % 4.2;
      const cerrando = ciclo > 4.0;
      parpados.current.visible = cerrando;
      parpados.current.scale.y = cerrando ? Math.max(0.05, Math.sin(((ciclo - 4.0) / 0.2) * Math.PI)) : 0.05;
    }
    if (cuerpo.current) cuerpo.current.position.y = Math.sin(t * 1.6) * 0.012;
    if (cabeza.current) {
      cabeza.current.rotation.y = Math.sin(t * 0.7) * 0.22;
      cabeza.current.rotation.z = Math.sin(t * 0.5 + 1) * 0.05;
    }
    if (brazo.current) brazo.current.rotation.z = -0.25 + Math.sin(t * 2.2) * 0.06;
    if (mano.current) mano.current.rotation.z = Math.sin(t * 5.5) * 0.4; // saludo: la muñeca va y viene
  });

  if (!logo || !sombra || !ojo) return null;
  const ojos = [-1, 1] as const;

  return (
    <group position={p} scale={esc} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.012, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.2]} />
        <meshBasicMaterial map={sombra} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      {/* Si hay un modelo GLB de Sabio en el catálogo se usa ese; si no, el procedural de abajo (con su animación). */}
      <ObjetoCatalogo id="sabio" estado={{ apagado: false }} claveFundido="sabio" sinFundir procedural={<>
      <group ref={cuerpo}>
        <Fundido>
          {/* Patas: plumón en el tarso, pie ancho y cuatro dedos (tres al frente, uno atrás) con falanges y garras curvas. */}
          {ojos.map((l) => (
            <group key={`pie${l}`}>
              <Elipsoide p={[l * 0.2, 0.05, 0.12]} s={[0.17, 0.06, 0.2]} color={NARANJA} />
              <Elipsoide p={[l * 0.2, 0.22, 0.05]} s={[0.13, 0.19, 0.13]} color={CREMA} />
              {[0.14, 0.2, 0.26].map((y, i) => <Elipsoide key={`pl${i}`} p={[l * 0.2 + (i % 2 ? 0.05 : -0.05), y, 0.12]} s={[0.05, 0.035, 0.03]} color="#e4cf9f" />)}
              {[-1, 0, 1].map((k) => {
                const x = l * 0.2 + k * 0.085;
                return (
                  <group key={k}>
                    <Segmento a={[x, 0.05, 0.2]} b={[x + k * 0.012, 0.045, 0.31]} r={0.036} color={NARANJA} />
                    <Elipsoide p={[x + k * 0.012, 0.045, 0.31]} s={[0.042, 0.04, 0.042]} color="#e07a1a" />
                    <Segmento a={[x + k * 0.012, 0.045, 0.31]} b={[x + k * 0.02, 0.035, 0.38]} r={0.03} color={NARANJA} />
                    <Cono p={[x + k * 0.022, 0.03, 0.42]} r={0.022} h={0.08} color={MARRON_OSCURO} rot={[Math.PI / 2 + 0.5, 0, 0]} />
                  </group>
                );
              })}
              <Segmento a={[l * 0.2, 0.05, 0.02]} b={[l * 0.2, 0.04, -0.1]} r={0.03} color={NARANJA} />
              <Cono p={[l * 0.2, 0.03, -0.15]} r={0.02} h={0.07} color={MARRON_OSCURO} rot={[-Math.PI / 2 - 0.5, 0, 0]} />
            </group>
          ))}
          {/* Cuerpo emplumado y cola. */}
          <Elipsoide p={[0, 0.78, 0]} s={[0.52, 0.6, 0.46]} color={MARRON} />
          <Elipsoide p={[0, 0.4, -0.3]} s={[0.22, 0.1, 0.3]} color={MARRON_OSCURO} rot={[0.5, 0, 0]} />
          {[-1, 0, 1].map((k) => <Elipsoide key={`cola${k}`} p={[k * 0.12, 0.42, -0.52]} s={[0.07, 0.04, 0.22]} color={k === 0 ? MARRON : MARRON_OSCURO} rot={[0.7, k * 0.25, 0]} />)}
          {/* Saco azul: cubre el torso hasta la altura del cuello, con hombreras, solapas, camisa en V, botones y bolsillo. */}
          <Elipsoide p={[0, 0.74, 0.0]} s={[0.575, 0.56, 0.5]} color={AZUL} />
          <Elipsoide p={[-0.47, 1.0, 0.04]} s={[0.15, 0.11, 0.15]} color={AZUL} />
          <Elipsoide p={[0.47, 1.0, 0.04]} s={[0.15, 0.11, 0.15]} color={AZUL} />
          <Solapa lado={-1} />
          <Solapa lado={1} />
          <Camisa />
          <Caja p={[0.0, 1.27, -0.2]} s={[0.46, 0.1, 0.12]} color={AZUL_OSCURO} rot={[0.3, 0, 0]} />
          <Elipsoide p={[0.0, 0.58, 0.485]} s={[0.032, 0.032, 0.02]} color="#111111" />
          <Elipsoide p={[0.0, 0.4, 0.5]} s={[0.032, 0.032, 0.02]} color="#111111" />
          <Caja p={[0.26, 0.56, 0.482]} s={[0.17, 0.02, 0.02]} color={AZUL_OSCURO} rot={[0, 0.35, 0.05]} />
          <Caja p={[0.265, 0.6, 0.486]} s={[0.075, 0.04, 0.012]} color="#ffffff" rot={[0, 0.35, 0.3]} />
          {/* Plumón del pecho sobre el cuello. */}
          {[-1, 0, 1].map((k) => <Elipsoide key={`pl${k}`} p={[k * 0.14, 1.2, 0.3]} s={[0.1, 0.07, 0.08]} color={CREMA} />)}
        </Fundido>
        {/* Logo en el pecho del saco, siguiendo la curva del torso. */}
        <mesh position={[0.34, 0.78, 0.5]} rotation={[0, 0.48, 0]}>
          <planeGeometry args={[0.33, 0.374]} />
          <meshBasicMaterial map={logo} transparent toneMapped={false} />
        </mesh>

        {/* Brazo izquierdo: hombro → codo → muñeca, con puño de camisa y mano relajada. */}
        <Fundido>
          <Segmento a={[-0.48, 1.0, 0.08]} b={[-0.66, 0.68, 0.18]} r={0.115} color={AZUL} />
          <Elipsoide p={[-0.66, 0.68, 0.18]} s={[0.12, 0.12, 0.12]} color={AZUL} />
          <Segmento a={[-0.66, 0.68, 0.18]} b={[-0.36, 0.52, 0.5]} r={0.1} color={AZUL} />
          <Elipsoide p={[-0.34, 0.51, 0.51]} s={[0.105, 0.06, 0.105]} color="#f6ecd6" rot={[0.6, 0.6, 0.4]} />
          {/* Mano relajada: palma con almohadilla, cuatro dedos de dos falanges apenas curvados y pulgar. */}
          <Elipsoide p={[-0.31, 0.49, 0.56]} s={[0.12, 0.085, 0.11]} color={MARRON} />
          <Elipsoide p={[-0.3, 0.46, 0.6]} s={[0.075, 0.045, 0.06]} color="#c98f66" />
          {[0, 1, 2, 3].map((i) => (
            <Dedo key={`df${i}`} base={[-0.37 + i * 0.045, 0.47 - Math.abs(i - 1.5) * 0.008, 0.62]} dir={[0.2, -0.3, 0.9]} largo={0.085 - Math.abs(i - 1.5) * 0.008} r={0.027} doblez={0.7} uña="#3f2210" />
          ))}
          <Dedo base={[-0.4, 0.5, 0.55]} dir={[-0.5, -0.35, 0.8]} largo={0.075} r={0.03} doblez={0.5} uña="#3f2210" />
        </Fundido>
        {/* Brazo en alto saludando: hombro → codo → antebrazo vertical. */}
        <group ref={brazo} position={[0.48, 1.0, 0.08]}>
          <Fundido>
            <Segmento a={[0, 0, 0]} b={[0.3, -0.2, 0.05]} r={0.115} color={AZUL} />
            <Elipsoide p={[0.3, -0.2, 0.05]} s={[0.12, 0.12, 0.12]} color={AZUL} />
            <Segmento a={[0.3, -0.2, 0.05]} b={[0.38, 0.2, 0.06]} r={0.1} color={AZUL} />
            <Elipsoide p={[0.385, 0.23, 0.06]} s={[0.1, 0.045, 0.1]} color="#f6ecd6" rot={[0, 0, -0.2]} />
          </Fundido>
          {/* Mano saludando 👋: palma abierta hacia el frente, cinco dedos en abanico; la muñeca se mueve de lado a lado. */}
          <group ref={mano} position={[0.4, 0.26, 0.06]}>
            <Fundido>
              <Elipsoide p={[0, 0.1, 0]} s={[0.115, 0.125, 0.07]} color={MARRON} />
              <Elipsoide p={[0, 0.1, 0.045]} s={[0.085, 0.09, 0.03]} color="#c98f66" />
              {[-0.075, -0.025, 0.025, 0.075].map((x, i) => (
                <Dedo key={`dm${i}`} base={[x, 0.18, 0.0]} dir={[x * 3.2, 1, 0.05]} largo={0.115 - Math.abs(i - 1.5) * 0.012} r={0.03} doblez={0.12} uña="#3f2210" />
              ))}
              <Dedo base={[-0.1, 0.07, 0.0]} dir={[-1, 0.7, 0.1]} largo={0.085} r={0.033} doblez={0.2} uña="#3f2210" />
            </Fundido>
          </group>
        </group>
      </group>

      {/* Cabeza: cráneo con degradé, discos faciales con aro, ojos con textura, anteojos redondos, pico y penachos suaves. */}
      <group ref={cabeza} position={[0, 1.52, 0.03]}>
        <Fundido>
          <Elipsoide p={[0, 0.02, 0]} s={[0.5, 0.45, 0.44]} color={MARRON} />
          <Elipsoide p={[0, 0.17, -0.02]} s={[0.46, 0.3, 0.4]} color="#5e3319" />
          {[-2, -1, 0, 1, 2].map((i) => <Elipsoide key={`fr${i}`} p={[i * 0.11, 0.33 - Math.abs(i) * 0.03, 0.17]} s={[0.075, 0.05, 0.05]} color={i % 2 ? '#7a4326' : '#6a3a20'} rot={[0.5, 0, i * 0.12]} />)}
          {ojos.map((l) => (
            <group key={l}>
              <Elipsoide p={[l * 0.34, 0.37, 0.0]} s={[0.07, 0.12, 0.055]} color="#4f2a14" rot={[0, 0, -l * 0.45]} />
              <Elipsoide p={[l * 0.26, 0.41, 0.03]} s={[0.05, 0.08, 0.04]} color="#5e3319" rot={[0, 0, -l * 0.3]} />
              <Elipsoide p={[l * 0.21, -0.01, 0.3]} s={[0.26, 0.25, 0.13]} color={CREMA} />
              <mesh position={[l * 0.21, -0.01, 0.37]} scale={[1, 0.96, 1]}>
                <torusGeometry args={[0.25, 0.028, 10, 36]} />
                <meshStandardMaterial color="#cfae7c" roughness={0.9} />
              </mesh>
              <Elipsoide p={[l * 0.21, 0.03, 0.4]} s={[0.13, 0.13, 0.08]} color="#ffffff" rough={0.3} />
              <mesh position={[l * 0.21, 0.03, 0.485]}>
                <planeGeometry args={[0.215, 0.215]} />
                <meshStandardMaterial map={ojo} transparent roughness={0.3} />
              </mesh>
              <mesh position={[l * 0.21, 0.03, 0.515]}>
                <torusGeometry args={[0.175, 0.026, 12, 40]} />
                <meshStandardMaterial color="#0f0f12" roughness={0.3} />
              </mesh>
              <mesh position={[l * 0.21, 0.03, 0.518]}>
                <circleGeometry args={[0.168, 28]} />
                <meshStandardMaterial color="#cfe6ff" transparent opacity={0.14} roughness={0.05} metalness={0.2} depthWrite={false} />
              </mesh>
              <Elipsoide p={[l * 0.385, 0.06, 0.48]} s={[0.025, 0.03, 0.025]} color="#1a1a1f" />
              <Caja p={[l * 0.39, 0.06, 0.28]} s={[0.012, 0.02, 0.4]} color="#0f0f12" rot={[0, l * -0.12, 0]} />
              <Elipsoide p={[l * 0.21, 0.23, 0.43]} s={[0.1, 0.03, 0.04]} color="#4f2a14" rot={[0, 0, l * 0.2]} />
              <Elipsoide p={[l * 0.33, -0.17, 0.37]} s={[0.09, 0.06, 0.07]} color="#eaa98f" />
            </group>
          ))}
          <Caja p={[0, 0.045, 0.515]} s={[0.07, 0.024, 0.024]} color="#0f0f12" />
          {/* Cara: párpados superiores, plumas de la ceja, cera de la nariz y mechón del mentón. */}
          {ojos.map((l) => (
            <group key={`cr${l}`}>
              <Elipsoide p={[l * 0.21, 0.145, 0.46]} s={[0.15, 0.035, 0.05]} color="#5e3319" rot={[0.3, 0, l * 0.12]} />
              <Elipsoide p={[l * 0.21, -0.1, 0.45]} s={[0.12, 0.022, 0.04]} color="#d8c294" rot={[-0.2, 0, 0]} />
              {[0, 1, 2, 3].map((k) => <Elipsoide key={`pc${k}`} p={[l * (0.12 + k * 0.07), 0.2 + k * 0.01, 0.4]} s={[0.04, 0.075, 0.03]} color={k % 2 ? '#7a4326' : '#5e3319'} rot={[0.5, 0, -l * (0.25 + k * 0.2)]} />)}
            </group>
          ))}
          <Elipsoide p={[0, -0.025, 0.545]} s={[0.032, 0.022, 0.02]} color="#f1dfba" />
          <Elipsoide p={[0, -0.36, 0.28]} s={[0.07, 0.07, 0.07]} color="#f1dfba" />
          {/* Pico con boca y lengua. */}
          <Elipsoide p={[0, -0.02, 0.36]} s={[0.11, 0.2, 0.1]} color={CREMA} />
          <Cono p={[0, -0.075, 0.55]} r={0.085} h={0.23} color={NARANJA} rot={[Math.PI / 2 + 0.35, 0, 0]} />
          <Cono p={[0, -0.16, 0.53]} r={0.06} h={0.14} color="#d9791f" rot={[Math.PI / 2 - 0.05, 0, 0]} />
          <Cono p={[0, -0.145, 0.665]} r={0.032} h={0.075} color="#c97a1d" rot={[Math.PI - 0.5, 0, 0]} />
          <Elipsoide p={[0, -0.135, 0.56]} s={[0.045, 0.012, 0.05]} color="#7a1f1f" />
          <Elipsoide p={[0, -0.14, 0.565]} s={[0.025, 0.008, 0.03]} color="#e07a86" />
          {[-1, 0, 1].map((k) => <Elipsoide key={k} p={[k * 0.2, -0.3, 0.3]} s={[0.1, 0.07, 0.1]} color={CREMA} />)}
        </Fundido>
        <group ref={parpados} visible={false} scale={[1, 0.05, 1]}>
          {ojos.map((l) => (
            <mesh key={`pa${l}`} position={[l * 0.21, 0.03, 0.48]}>
              <sphereGeometry args={[0.15, 14, 10]} />
              <meshStandardMaterial color={MARRON} roughness={0.9} />
            </mesh>
          ))}
        </group>
      </group>

      </>} />

      {/* Saludo flotante, siempre de frente a la cámara. */}
      <group ref={cartel} position={[0, 2.75, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.62, 0.48]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <Letrero lineas={[esPT ? 'Bem-vindo!' : '¡Bienvenido!']} brillo="#ffffff" ancho={1.54} alto={0.4} posicion={[0, 0, 0]} fondo="#1f3a5fee" />
      </group>
    </group>
  );
}
