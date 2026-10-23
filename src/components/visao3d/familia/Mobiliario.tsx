'use client';

// Mobiliario y detalles de la casa de Visão 3D (modelo Familia), todo con formas simples. Las AMENIDADES (auto,
// sofá, TV, cartera…, en CasaObjetos.tsx) reciben el color de su cuenta; la decoración (cuadros, sillas, lámparas) es natural.

import { createContext, useContext, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type V3 = [number, number, number];

// Texturas dibujadas (se crean una vez en la escena y se reparten por contexto; los contextos de React dentro del Canvas sí viajan).
export type TexturasCasa = { tela: THREE.Texture; tv: THREE.Texture; monitor: THREE.Texture; arte: THREE.Texture[] };
export const TexturasCtx = createContext<TexturasCasa | null>(null);

// De noche las luces de la casa (focos, lámparas) se encienden; de día quedan apagadas.
export const NocheCtx = createContext(false);

// Caja con material estándar: la pieza básica de todo el mobiliario.
export function Caja({ p, s, color, emissive, ei = 0, rough = 0.6, metal = 0.1, opacity = 1, map, rot, r }: { p: V3; s: V3; color: string; emissive?: string; ei?: number; rough?: number; metal?: number; opacity?: number; map?: THREE.Texture; rot?: V3; r?: number }) {
  // `r` redondea las aristas (muebles blandos); sin `r` queda la caja de siempre.
  const redondeada = useMemo(() => (r ? new RoundedBoxGeometry(s[0], s[1], s[2], 2, Math.min(r, s[0] / 2, s[1] / 2, s[2] / 2)) : null), [r, s[0], s[1], s[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => redondeada?.dispose(), [redondeada]);
  return (
    <mesh position={p} rotation={rot} geometry={redondeada ?? undefined}>
      {!redondeada && <boxGeometry args={s} />}
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

export function Cuadro({ p, s = [0.9, 0.7], tono = 0 }: { p: V3; s?: [number, number]; tono?: number }) {
  const tx = useContext(TexturasCtx);
  return (
    <group position={p}>
      <Caja p={[0, 0, 0]} s={[s[0] + 0.1, s[1] + 0.1, 0.05]} color="#1a1f2b" rough={0.4} />
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[s[0], s[1]]} />
        <meshBasicMaterial color="#ffffff" map={tx?.arte[tono % (tx?.arte.length || 1)]} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Lampara({ p, color = '#ffe2b0' }: { p: V3; color?: string }) {
  const noche = useContext(NocheCtx);
  return (
    <group position={p}>
      <Cilindro p={[0, 0.18, 0]} r={0.05} h={0.36} color="#2a2f3b" />
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.22, 0.28, 16, 1, true]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={noche ? 1.8 : 0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function LamparaColgante({ p, color = '#ffe2b0' }: { p: V3; color?: string }) {
  const noche = useContext(NocheCtx);
  return (
    <group position={p}>
      <Cilindro p={[0, 0.5, 0]} r={0.012} h={1} color="#222" />
      <mesh>
        <sphereGeometry args={[0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={noche ? 2 : 0.12} side={THREE.DoubleSide} />
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
  const tela = useContext(TexturasCtx)?.tela;
  return (
    <group position={p}>
      <Caja p={[0, 0.25, 0]} s={[2.2, 0.3, 2.4]} color="#d8dde8" />
      <Caja p={[0, 0.5, 0.05]} s={[2.1, 0.22, 2.2]} color="#eef2f8" rough={0.95} map={tela}  r={0.06} />
      <Caja p={[0, 0.62, 0.7]} s={[2.1, 0.06, 1.1]} color="#8fb0e0" rough={0.95} map={tela}  r={0.06} />
      <Caja p={[-0.55, 0.7, -0.85]} s={[0.8, 0.18, 0.45]} color="#ffffff" rough={0.95} map={tela}  r={0.06} />
      <Caja p={[0.55, 0.7, -0.85]} s={[0.8, 0.18, 0.45]} color="#ffffff" rough={0.95} map={tela}  r={0.06} />
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

// Pantalla que emite su propia luz (sin sombreado) con una imagen dibujada.
export function PantallaPlana({ p, s, textura, color = '#ffffff' }: { p: V3; s: [number, number]; textura: 'tv' | 'monitor'; color?: string }) {
  const tx = useContext(TexturasCtx);
  return (
    <mesh position={p}>
      <planeGeometry args={s} />
      <meshBasicMaterial color={color} map={tx ? tx[textura] : undefined} toneMapped={false} />
    </mesh>
  );
}

export function Escritorio({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Caja p={[0, 0.78, 0]} s={[2.6, 0.07, 1.0]} color="#c9a479" rough={0.5} />
      <Caja p={[-1.2, 0.39, 0]} s={[0.07, 0.78, 0.9]} color="#3a3f4d" />
      <Caja p={[1.2, 0.39, 0]} s={[0.07, 0.78, 0.9]} color="#3a3f4d" />
      {/* monitor + teclado */}
      <Caja p={[0, 1.3, -0.2]} s={[1.14, 0.69, 0.05]} color="#10141c" rough={0.3} />
      <PantallaPlana p={[0, 1.3, -0.17]} s={[1.05, 0.6]} textura="monitor" />
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
  const tela = useContext(TexturasCtx)?.tela;
  return (
    <group position={p}>
      <Caja p={[0, 0, 0]} s={[s[0], 0.03, s[1]]} color={color} rough={1} map={tela} />
      <Caja p={[0, 0.018, 0]} s={[s[0] - 0.4, 0.01, s[1] - 0.4]} color="#e8e2d4" rough={1} map={tela} />
    </group>
  );
}

// ---- Personas estilizadas, vegetación y detalles ----

export function Persona({ p, rot = 0, sentado = false, esc = 1, ropa = '#3e6fb0', pantalon = '#2a2f3b', piel = '#e0b08a', pelo = '#3a2a1e' }: { p: V3; rot?: number; sentado?: boolean; esc?: number; ropa?: string; pantalon?: string; piel?: string; pelo?: string }) {
  return (
    <group position={p} rotation={[0, rot, 0]} scale={esc}>
      {sentado ? (
        <>
          {[-0.1, 0.1].map((x) => (
            <group key={x}>
              <Caja p={[x, 0.09, 0.2]} s={[0.14, 0.14, 0.46]} color={pantalon} />
              <Caja p={[x, -0.18, 0.42]} s={[0.13, 0.46, 0.13]} color={pantalon} />
            </group>
          ))}
          <Caja p={[0, 0.5, 0]} s={[0.42, 0.62, 0.22]} color={ropa} rough={0.9} />
          {[-0.27, 0.27].map((x) => (
            <Caja key={x} p={[x, 0.42, 0.14]} s={[0.1, 0.1, 0.42]} color={ropa} rough={0.9} />
          ))}
          <mesh position={[0, 0.98, 0]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshStandardMaterial color={piel} roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.04, -0.02]} scale={[1.05, 0.7, 1.1]}>
            <sphereGeometry args={[0.15, 12, 10]} />
            <meshStandardMaterial color={pelo} roughness={0.9} />
          </mesh>
        </>
      ) : (
        <>
          {[-0.09, 0.09].map((x) => (
            <Caja key={x} p={[x, 0.4, 0]} s={[0.15, 0.8, 0.17]} color={pantalon} />
          ))}
          <Caja p={[0, 1.1, 0]} s={[0.42, 0.6, 0.22]} color={ropa} rough={0.9} />
          {[-0.28, 0.28].map((x) => (
            <Caja key={x} p={[x, 1.08, 0]} s={[0.1, 0.56, 0.12]} color={ropa} rough={0.9} />
          ))}
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshStandardMaterial color={piel} roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.61, -0.02]} scale={[1.05, 0.7, 1.1]}>
            <sphereGeometry args={[0.15, 12, 10]} />
            <meshStandardMaterial color={pelo} roughness={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
}

// Foco empotrado en el techo (emite luz propia sin costo de iluminación).
export function Foco({ p }: { p: V3 }) {
  const noche = useContext(NocheCtx);
  return (
    <mesh position={p}>
      <cylinderGeometry args={[0.13, 0.13, 0.03, 14]} />
      <meshBasicMaterial color={noche ? '#fff3d1' : '#bdb9ab'} toneMapped={false} />
    </mesh>
  );
}

export function Palmera({ p, escala = 1 }: { p: V3; escala?: number }) {
  return (
    <group position={p} scale={escala}>
      <Cilindro p={[0, 1.4, 0]} r={0.14} h={2.8} color="#7a5a3c" seg={8} />
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.55, 2.75, Math.sin(a) * 0.55]} rotation={[Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]}>
            <coneGeometry args={[0.2, 1.7, 5]} />
            <meshStandardMaterial color="#2f9e5b" emissive="#0f4a28" emissiveIntensity={0.35} roughness={0.8} flatShading />
          </mesh>
        );
      })}
    </group>
  );
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

// Para precargar texturas del piso en un solo lugar.
export function useTexturas<T extends Record<string, () => THREE.Texture>>(fabricas: T): { [K in keyof T]: THREE.Texture } {
  const texturas = useMemo(() => Object.fromEntries(Object.entries(fabricas).map(([k, f]) => [k, f()])) as { [K in keyof T]: THREE.Texture }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(texturas).forEach((t) => (t as THREE.Texture).dispose()), [texturas]);
  return texturas;
}
