'use client';

// Mobiliario y detalles de la casa de Visão 3D (modelo Familia), todo con formas simples. Las AMENIDADES (auto,
// sofá, TV, cartera…) reciben el color de su cuenta; la decoración (plantas, cuadros, sillas, lámparas) es natural.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ObjetoCuenta } from './Objetos';
import type { TipoObjeto } from '@/lib/visao3dObjetos';

type V3 = [number, number, number];

// Caja con material estándar: la pieza básica de todo el mobiliario.
export function Caja({ p, s, color, emissive, ei = 0, rough = 0.6, metal = 0.1, opacity = 1, map }: { p: V3; s: V3; color: string; emissive?: string; ei?: number; rough?: number; metal?: number; opacity?: number; map?: THREE.Texture }) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} emissive={emissive ?? '#000000'} emissiveIntensity={ei} roughness={rough} metalness={metal} transparent={opacity < 1} opacity={opacity} map={map} />
    </mesh>
  );
}

export function Cilindro({ p, r, h, color, emissive, ei = 0, seg = 16, rough = 0.6, metal = 0.1, rot }: { p: V3; r: number; h: number; color: string; emissive?: string; ei?: number; seg?: number; rough?: number; metal?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot}>
      <cylinderGeometry args={[r, r, h, seg]} />
      <meshStandardMaterial color={color} emissive={emissive ?? '#000000'} emissiveIntensity={ei} roughness={rough} metalness={metal} />
    </mesh>
  );
}

// ---- Decoración (no son cuentas) ----

export function Planta({ p, escala = 1, variante = 0 }: { p: V3; escala?: number; variante?: number }) {
  const hojas: Array<[number, number, number, number]> = variante % 2 === 0
    ? [[0, 0.95, 0, 0.38], [0.18, 0.7, 0.1, 0.28], [-0.2, 0.75, -0.08, 0.3], [0.05, 1.25, 0.04, 0.26]]
    : [[0, 0.8, 0, 0.42], [0.22, 0.6, 0.1, 0.3], [-0.22, 0.62, -0.1, 0.3]];
  return (
    <group position={p} scale={escala}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.26, 0.19, 0.5, 14]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.7} />
      </mesh>
      <Cilindro p={[0, 0.55, 0]} r={0.24} h={0.04} color="#3b2a1e" />
      {hojas.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 ? '#3fae63' : '#2f8f52'} emissive="#0f4a28" emissiveIntensity={0.35} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export function Cuadro({ p, s = [0.9, 0.7], tono = 0 }: { p: V3; s?: [number, number]; tono?: number }) {
  const colores = ['#4b7bb5', '#c98b4b', '#5da37f', '#a76ba8'];
  const color = colores[tono % colores.length];
  return (
    <group position={p}>
      <Caja p={[0, 0, 0]} s={[s[0] + 0.1, s[1] + 0.1, 0.05]} color="#1a1f2b" rough={0.4} />
      <Caja p={[0, 0, 0.03]} s={[s[0], s[1], 0.02]} color={color} emissive={color} ei={0.12} />
      <Caja p={[-s[0] * 0.15, -s[1] * 0.1, 0.045]} s={[s[0] * 0.35, s[1] * 0.45, 0.01]} color="#ffffff" opacity={0.55} />
    </group>
  );
}

export function Lampara({ p, color = '#ffe2b0' }: { p: V3; color?: string }) {
  return (
    <group position={p}>
      <Cilindro p={[0, 0.18, 0]} r={0.05} h={0.36} color="#2a2f3b" />
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.22, 0.28, 16, 1, true]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function LamparaColgante({ p, color = '#ffe2b0' }: { p: V3; color?: string }) {
  return (
    <group position={p}>
      <Cilindro p={[0, 0.5, 0]} r={0.012} h={1} color="#222" />
      <mesh>
        <sphereGeometry args={[0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Silla({ p, rot = 0, color = '#c9d3e0' }: { p: V3; rot?: number; color?: string }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Caja p={[0, 0.46, 0]} s={[0.5, 0.07, 0.5]} color={color} />
      <Caja p={[0, 0.8, -0.22]} s={[0.5, 0.65, 0.06]} color={color} />
      {[-0.2, 0.2].flatMap((x) => [-0.2, 0.2].map((z) => <Caja key={`${x}${z}`} p={[x, 0.23, z]} s={[0.05, 0.46, 0.05]} color="#2a2f3b" />))}
    </group>
  );
}

export function SillaOficina({ p, rot = 0 }: { p: V3; rot?: number }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Caja p={[0, 0.5, 0]} s={[0.6, 0.1, 0.6]} color="#232936" />
      <Caja p={[0, 0.95, -0.27]} s={[0.55, 0.75, 0.08]} color="#232936" />
      <Cilindro p={[0, 0.25, 0]} r={0.05} h={0.5} color="#9aa3b2" metal={0.6} />
      <Cilindro p={[0, 0.03, 0]} r={0.3} h={0.05} color="#232936" />
    </group>
  );
}

export function Estante({ p, s = [1.4, 2.2, 0.4], libros = true }: { p: V3; s?: V3; libros?: boolean }) {
  const niveles = 4;
  const colores = ['#c1463b', '#3e6fb0', '#e0b43c', '#4c9a6a', '#8d5fb0', '#d97a3a'];
  return (
    <group position={p}>
      <Caja p={[-s[0] / 2, s[1] / 2, 0]} s={[0.05, s[1], s[2]]} color="#3a3f4d" />
      <Caja p={[s[0] / 2, s[1] / 2, 0]} s={[0.05, s[1], s[2]]} color="#3a3f4d" />
      {Array.from({ length: niveles + 1 }, (_, i) => (
        <Caja key={i} p={[0, (i * s[1]) / niveles, 0]} s={[s[0], 0.05, s[2]]} color="#3a3f4d" />
      ))}
      {libros &&
        Array.from({ length: niveles }, (_, n) =>
          Array.from({ length: 6 }, (_, i) => (
            <Caja key={`${n}${i}`} p={[-s[0] / 2 + 0.2 + i * ((s[0] - 0.4) / 6), (n * s[1]) / niveles + 0.22, 0]} s={[0.12, 0.28 + ((i * 7 + n * 3) % 4) * 0.04, s[2] * 0.7]} color={colores[(i + n * 2) % colores.length]} />
          ))
        )}
    </group>
  );
}

export function Cama({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Caja p={[0, 0.25, 0]} s={[2.2, 0.3, 2.4]} color="#d8dde8" />
      <Caja p={[0, 0.5, 0.05]} s={[2.1, 0.22, 2.2]} color="#eef2f8" rough={0.9} />
      <Caja p={[0, 0.62, 0.7]} s={[2.1, 0.06, 1.1]} color="#8fb0e0" rough={0.9} />
      <Caja p={[-0.55, 0.7, -0.85]} s={[0.8, 0.18, 0.45]} color="#ffffff" rough={0.9} />
      <Caja p={[0.55, 0.7, -0.85]} s={[0.8, 0.18, 0.45]} color="#ffffff" rough={0.9} />
      <Caja p={[0, 0.85, -1.22]} s={[2.4, 1.1, 0.12]} color="#6f7f99" rough={0.8} />
    </group>
  );
}

export function MesaLateral({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Caja p={[0, 0.3, 0]} s={[0.55, 0.6, 0.45]} color="#c9a479" />
      <Caja p={[0, 0.34, 0.23]} s={[0.4, 0.05, 0.02]} color="#3a2f26" />
    </group>
  );
}

export function Escritorio({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Caja p={[0, 0.78, 0]} s={[2.6, 0.07, 1.0]} color="#c9a479" rough={0.5} />
      <Caja p={[-1.2, 0.39, 0]} s={[0.07, 0.78, 0.9]} color="#3a3f4d" />
      <Caja p={[1.2, 0.39, 0]} s={[0.07, 0.78, 0.9]} color="#3a3f4d" />
      {/* monitor + teclado */}
      <Caja p={[0, 1.3, -0.2]} s={[1.1, 0.65, 0.05]} color="#10141c" emissive="#6aa7ff" ei={0.35} rough={0.3} />
      <Caja p={[0, 0.95, -0.2]} s={[0.1, 0.28, 0.1]} color="#1b2030" />
      <Caja p={[0, 0.83, 0.2]} s={[0.65, 0.03, 0.2]} color="#d5d9e2" />
    </group>
  );
}

export function Archivero({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Caja p={[0, 0.65, 0]} s={[0.7, 1.3, 0.6]} color="#aab3c2" metal={0.4} />
      {[0.25, 0.65, 1.05].map((y) => (
        <Caja key={y} p={[0, y, 0.31]} s={[0.55, 0.3, 0.02]} color="#8791a3" metal={0.4} />
      ))}
    </group>
  );
}

export function Cajas({ p, n = 3 }: { p: V3; n?: number }) {
  return (
    <group position={p}>
      {Array.from({ length: n }, (_, i) => (
        <Caja key={i} p={[(i % 2) * 0.5 - 0.2, 0.2 + Math.floor(i / 2) * 0.4, 0]} s={[0.5, 0.4, 0.45]} color="#b48a5a" rough={0.9} />
      ))}
    </group>
  );
}

export function Mesa({ p, ancho = 3, fondo = 1.5 }: { p: V3; ancho?: number; fondo?: number }) {
  return (
    <group position={p}>
      <Caja p={[0, 0.78, 0]} s={[ancho, 0.07, fondo]} color="#e6d7bf" rough={0.4} />
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Caja key={`${x}${z}`} p={[x * (ancho / 2 - 0.15), 0.39, z * (fondo / 2 - 0.15)]} s={[0.08, 0.78, 0.08]} color="#3a3f4d" />))}
    </group>
  );
}

export function MesaCentro({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Caja p={[0, 0.32, 0]} s={[1.5, 0.06, 0.8]} color="#e6d7bf" rough={0.4} />
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Caja key={`${x}${z}`} p={[x * 0.65, 0.16, z * 0.3]} s={[0.06, 0.32, 0.06]} color="#3a3f4d" />))}
    </group>
  );
}

export function Alfombra({ p, s, color = '#8d99ae' }: { p: V3; s: [number, number]; color?: string }) {
  return <Caja p={p} s={[s[0], 0.03, s[1]]} color={color} rough={1} />;
}

export function CargadorEV({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Caja p={[0, 1.1, 0]} s={[0.32, 0.55, 0.14]} color="#f1f4f9" rough={0.3} />
      <Caja p={[0, 1.18, 0.08]} s={[0.1, 0.1, 0.02]} color="#3ddc97" emissive="#3ddc97" ei={1.2} />
      <Cilindro p={[0.18, 0.7, 0.1]} r={0.025} h={0.8} color="#222831" />
    </group>
  );
}

// ---- Amenidades: reciben el color de su cuenta ----

type Pintura = { color: string; apagado: boolean; brillo: number };

const matPintado = (p: Pintura) => ({ color: p.color, emissive: p.color, ei: (p.apagado ? 0.04 : 0.28) * p.brillo });

export function AutoSUV({ pintura }: { pintura: Pintura }) {
  const m = matPintado(pintura);
  return (
    <group>
      <Caja p={[0, 0.62, 0]} s={[4.3, 0.62, 1.85]} color={m.color} emissive={m.emissive} ei={m.ei} rough={0.25} metal={0.6} />
      <Caja p={[-0.15, 1.18, 0]} s={[2.5, 0.62, 1.7]} color={m.color} emissive={m.emissive} ei={m.ei} rough={0.25} metal={0.6} />
      <Caja p={[-0.15, 1.2, 0]} s={[2.38, 0.5, 1.74]} color="#0e1420" rough={0.1} metal={0.8} />
      {[-1.35, 1.4].flatMap((x) => [-0.9, 0.9].map((z) => (
        <Cilindro key={`${x}${z}`} p={[x, 0.36, z]} r={0.38} h={0.28} color="#141821" rot={[Math.PI / 2, 0, 0]} />
      )))}
      <Caja p={[2.16, 0.7, 0.55]} s={[0.04, 0.14, 0.32]} color="#fff6d6" emissive="#fff2b8" ei={2} />
      <Caja p={[2.16, 0.7, -0.55]} s={[0.04, 0.14, 0.32]} color="#fff6d6" emissive="#fff2b8" ei={2} />
      <Caja p={[-2.16, 0.7, 0.6]} s={[0.04, 0.14, 0.3]} color="#ff3b3b" emissive="#ff1f1f" ei={1.4} />
      <Caja p={[-2.16, 0.7, -0.6]} s={[0.04, 0.14, 0.3]} color="#ff3b3b" emissive="#ff1f1f" ei={1.4} />
    </group>
  );
}

export function Sofa({ pintura }: { pintura: Pintura }) {
  const m = matPintado(pintura);
  return (
    <group>
      <Caja p={[0, 0.3, 0]} s={[2.8, 0.4, 1.05]} color={m.color} emissive={m.emissive} ei={m.ei} rough={0.9} />
      <Caja p={[0, 0.72, -0.4]} s={[2.8, 0.55, 0.28]} color={m.color} emissive={m.emissive} ei={m.ei} rough={0.9} />
      <Caja p={[-1.45, 0.45, 0]} s={[0.2, 0.7, 1.05]} color={m.color} emissive={m.emissive} ei={m.ei} rough={0.9} />
      <Caja p={[1.45, 0.45, 0]} s={[0.2, 0.7, 1.05]} color={m.color} emissive={m.emissive} ei={m.ei} rough={0.9} />
      {[-0.85, 0, 0.85].map((x) => (
        <Caja key={x} p={[x, 0.58, 0.08]} s={[0.8, 0.14, 0.8]} color="#ffffff" opacity={0.18} />
      ))}
    </group>
  );
}

export function TV({ pintura }: { pintura: Pintura }) {
  const m = matPintado(pintura);
  return (
    <group>
      <Caja p={[0, 0.3, 0]} s={[1.9, 0.6, 0.45]} color="#2a2f3b" rough={0.5} />
      <Caja p={[0, 1.25, 0]} s={[1.7, 0.95, 0.05]} color="#0a0d14" rough={0.2} />
      <Caja p={[0, 1.25, 0.03]} s={[1.6, 0.86, 0.02]} color={m.color} emissive={m.emissive} ei={pintura.apagado ? 0.08 : 0.9 * pintura.brillo} />
      <Caja p={[0, 0.78, 0]} s={[0.12, 0.3, 0.08]} color="#1b2030" />
    </group>
  );
}

export function Tarjeta({ pintura }: { pintura: Pintura }) {
  const m = matPintado(pintura);
  return (
    <group rotation={[-0.3, 0.3, 0]}>
      <Caja p={[0, 0.2, 0]} s={[0.62, 0.4, 0.03]} color={m.color} emissive={m.emissive} ei={m.ei} rough={0.3} metal={0.5} />
      <Caja p={[0, 0.26, 0.02]} s={[0.62, 0.07, 0.01]} color="#10141c" />
      <Caja p={[-0.17, 0.1, 0.02]} s={[0.14, 0.1, 0.01]} color="#f2d27a" metal={0.8} />
    </group>
  );
}

export function Maqueta({ pintura }: { pintura: Pintura }) {
  const m = matPintado(pintura);
  return (
    <group>
      <Caja p={[0, 0.17, 0]} s={[0.62, 0.34, 0.5]} color={m.color} emissive={m.emissive} ei={m.ei} rough={0.5} />
      <mesh position={[0, 0.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.52, 0.3, 4]} />
        <meshStandardMaterial color={m.color} emissive={m.emissive} emissiveIntensity={m.ei} roughness={0.5} />
      </mesh>
    </group>
  );
}

// Objetos genéricos de cuenta (monedas, billetes, papeles, banco, capital, gráfico) con el color de su cuenta.
export function ObjetoPintado({ tipo, pintura, escala = 1 }: { tipo: TipoObjeto; pintura: Pintura; escala?: number }) {
  return (
    <group scale={escala}>
      <ObjetoCuenta tipo={tipo} color={pintura.color} apagado={pintura.apagado} />
    </group>
  );
}

// Para precargar texturas del piso en un solo lugar.
export function useTexturas<T extends Record<string, () => THREE.Texture>>(fabricas: T): { [K in keyof T]: THREE.Texture } {
  const texturas = useMemo(() => Object.fromEntries(Object.entries(fabricas).map(([k, f]) => [k, f()])) as { [K in keyof T]: THREE.Texture }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(texturas).forEach((t) => (t as THREE.Texture).dispose()), [texturas]);
  return texturas;
}
