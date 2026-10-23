'use client';

import { Fundido } from '../base/Compartido3D';
import { Caja, Cilindro } from './Mobiliario';
import { Hora } from './estructura';
import { useTema } from './temas';
import { PROF, X_CENTRO, X_COCHERA, Z_ATRAS } from './layout';
import { GrupoId } from '@/lib/visao3d';
import type { Cuarto } from '@/lib/visao3dCasaPlano';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

export const GROSOR = 0.14;
export const COLOR_PARED = '#eef1f6';
export function Pared({ x, y0, y1, hueco, grosor = GROSOR, color = COLOR_PARED }: { x: number; y0: number; y1: number; hueco?: [number, number, number]; grosor?: number; color?: string }) {
  const zA = Z_ATRAS;
  const zB = Z_ATRAS + PROF;
  const tramo = (za: number, zb: number, ya: number, yb: number, k: string) => (
    <Caja key={k} p={[x, (ya + yb) / 2, (za + zb) / 2]} s={[grosor, yb - ya, zb - za]} color={color} rough={0.9} />
  );
  if (!hueco) return tramo(zA, zB, y0, y1, 'p');
  const [h0, h1, hAlto] = hueco;
  const marco = grosor + 0.06;
  return (
    <>
      {/* Marco de la puerta: así el paso entre cuartos se lee como una puerta. */}
      {grosor > 0.05 && [h0, h1].map((z) => <Caja key={`mj${z}`} p={[x, y0 + hAlto / 2, z]} s={[marco, hAlto, 0.1]} color="#f7f8fb" rough={0.5} />)}
      {grosor > 0.05 && <Caja p={[x, y0 + hAlto + 0.04, (h0 + h1) / 2]} s={[marco, 0.1, h1 - h0 + 0.1]} color="#f7f8fb" rough={0.5} />}
      {tramo(zA, h0, y0, y1, 'a')}
      {tramo(h1, zB, y0, y1, 'b')}
      {tramo(h0, h1, y0 + hAlto, y1, 'c')}
    </>
  );
}

// Pasos entre cuartos (mismo hueco en la pared y en su pintura): [z desde, z hasta, alto].
export function huecoEn(xBorde: number, y0: number): [number, number, number] | undefined {
  if (xBorde === X_COCHERA && y0 === 0) return [0.3, 1.7, 2.5];
  if (xBorde === X_CENTRO) return [0.3, 2.0, 2.6];
  return undefined;
}

// Paso entre cuartos de las paredes interiores que no son de la casa base (cuartos agregados).
export const HUECO_GENERICO: [number, number, number] = [0.3, 2.0, 2.6];
export const huecoInterior = (xBorde: number, y0: number) => huecoEn(xBorde, y0) ?? HUECO_GENERICO;

type Rect = { x0: number; x1: number; y0: number };

// Una pared lateral de un cuarto es interior si al otro lado, en el mismo piso, hay otro cuarto; si no, da al exterior.
export function esInteriorEn(cuartos: Rect[], c: Rect, xBorde: number): boolean {
  return cuartos.some((o) => o !== c && o.y0 === c.y0 && Math.abs((xBorde === c.x0 ? o.x1 : o.x0) - xBorde) < 0.05);
}

// Pintura pastel de una pared lateral de un cuarto, con los vértices (cantos de pared) en un tono más marcado.
export function PinturaBorde({ zona, xb, lado, hueco }: { zona: { y0: number; y1: number; grupo: GrupoId }; xb: number; lado: 1 | -1; hueco?: [number, number, number] }) {
  const alto = zona.y1 - zona.y0;
  const cy = (zona.y0 + zona.y1) / 2;
  const { pared } = useTema();
  const { fondo, vertice } = pared[zona.grupo];
  return (
    <group>
      <Pared x={xb + lado * (GROSOR / 2 + 0.01)} y0={zona.y0} y1={zona.y1} grosor={0.02} color={fondo} hueco={hueco ?? huecoEn(xb, zona.y0)} />
      {[Z_ATRAS + 0.06 + 0.14, Z_ATRAS + PROF - 0.14].map((zv) => (
        <Caja key={zv} p={[xb + lado * (GROSOR / 2 + 0.013), cy, zv]} s={[0.024, alto, 0.28]} color={vertice} rough={0.85} />
      ))}
      <Caja p={[xb + lado * (GROSOR / 2 + 0.14), cy, Z_ATRAS + 0.06 + 0.013]} s={[0.28, alto, 0.024]} color={vertice} rough={0.85} />
    </group>
  );
}

// Tabiques interiores con su pintura: un Fundido transparente cuya opacidad baja con el zoom (se ve lo que hay en el cuarto de al lado).
export function Tabiques({ cuartos }: { cuartos: Cuarto[] }) {
  const materiales = useRef<THREE.MeshStandardMaterial[]>([]);
  const opacidad = useRef(1);
  const { camera, controls } = useThree();
  useFrame((_, delta) => {
    const objetivo = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    const d = objetivo ? camera.position.distanceTo(objetivo) : 25;
    const meta = THREE.MathUtils.clamp((d - 7) / 9, 0.06, 1);
    opacidad.current += (meta - opacidad.current) * Math.min(1, delta * 6);
    materiales.current.forEach((m) => {
      m.opacity = opacidad.current;
    });
  });
  return (
    <Fundido desvanecibles={materiales}>
      {cuartos.flatMap((c) =>
        (([[c.x0, 1], [c.x1, -1]]) as Array<[number, 1 | -1]>)
          .filter(([xb]) => esInteriorEn(cuartos, c, xb))
          .map(([xb, lado]) => <PinturaBorde key={`${c.id}${xb}`} zona={c} xb={xb} lado={lado} hueco={huecoInterior(xb, c.y0)} />)
      )}
    </Fundido>
  );
}

export const VENTANA: Record<Hora, { color: string; emi: number }> = {
  dia: { color: '#a8d6ff', emi: 0.9 },
  atardecer: { color: '#ffb48f', emi: 0.7 },
  noche: { color: '#16224a', emi: 0.35 },
};

// Ventana en una pared exterior: marco, vidrio con el color del cielo de la hora, cruz y reflejo en diagonal.
export function Ventana({ x, y, z, lado, ancho = 1.8, alto = 1.1, hora, reflejo, desfase = 0 }: { x: number; y: number; z: number; lado: 1 | -1; ancho?: number; alto?: number; hora: Hora; reflejo: THREE.Texture; desfase?: number }) {
  const v = VENTANA[hora];
  const xi = x + lado * (GROSOR / 2 + 0.005 + desfase);
  return (
    <group>
      <Caja p={[xi, y, z]} s={[0.03, alto + 0.16, ancho + 0.16]} color="#f7f8fb" rough={0.5} />
      <Caja p={[xi + lado * 0.012, y, z]} s={[0.02, alto, ancho]} color={v.color} emissive={v.color} ei={v.emi} rough={0.1} metal={0.3} />
      <Caja p={[xi + lado * 0.03, y, z]} s={[0.012, alto, 0.05]} color="#f7f8fb" />
      <Caja p={[xi + lado * 0.03, y, z]} s={[0.012, 0.05, ancho]} color="#f7f8fb" />
      <mesh position={[xi + lado * 0.026, y, z]} rotation={[0, lado > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <planeGeometry args={[ancho, alto]} />
        <meshBasicMaterial map={reflejo} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <Caja p={[xi + lado * 0.02, y - alto / 2 - 0.1, z]} s={[0.1, 0.04, ancho + 0.25]} color="#e4e8ef" rough={0.5} />
    </group>
  );
}

// Ventana en la cara trasera (mira a -z) de la casa, sobre el ladrillo.
export function VentanaFondo({ x, y, ancho = 1.6, alto = 1.1, hora, reflejo }: { x: number; y: number; ancho?: number; alto?: number; hora: Hora; reflejo: THREE.Texture }) {
  const v = VENTANA[hora];
  const zi = Z_ATRAS - 0.06 - 0.03 - 0.005;
  return (
    <group>
      <Caja p={[x, y, zi]} s={[ancho + 0.16, alto + 0.16, 0.03]} color="#f7f8fb" rough={0.5} />
      <Caja p={[x, y, zi - 0.012]} s={[ancho, alto, 0.02]} color={v.color} emissive={v.color} ei={v.emi} rough={0.1} metal={0.3} />
      <Caja p={[x, y, zi - 0.03]} s={[0.05, alto, 0.012]} color="#f7f8fb" />
      <Caja p={[x, y, zi - 0.03]} s={[ancho, 0.05, 0.012]} color="#f7f8fb" />
      <mesh position={[x, y, zi - 0.026]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[ancho, alto]} />
        <meshBasicMaterial map={reflejo} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <Caja p={[x, y - alto / 2 - 0.1, zi - 0.02]} s={[ancho + 0.25, 0.04, 0.1]} color="#e4e8ef" rough={0.5} />
    </group>
  );
}

// Puerta trasera: hoja de madera con marco, picaporte, vidrio alto, escalón y farol.
export function PuertaFondo({ x, noche }: { x: number; noche: boolean }) {
  const zi = Z_ATRAS - 0.06 - 0.03 - 0.005;
  return (
    <group>
      <Caja p={[x, 1.1, zi]} s={[1.2, 2.2, 0.03]} color="#f7f8fb" rough={0.5} />
      <Caja p={[x, 1.05, zi - 0.015]} s={[1.0, 2.1, 0.03]} color="#6b4a2f" rough={0.7} />
      <Caja p={[x, 1.55, zi - 0.036]} s={[0.55, 0.9, 0.012]} color="#9fc8ea" emissive="#9fc8ea" ei={0.5} rough={0.1} />
      <Caja p={[x, 0.55, zi - 0.036]} s={[0.7, 0.7, 0.012]} color="#5a3d26" rough={0.8} />
      <Cilindro p={[x + 0.36, 1.05, zi - 0.05]} r={0.03} h={0.05} color="#d9b872" metal={0.9} rough={0.3} rot={[Math.PI / 2, 0, 0]} />
      <Caja p={[x, 0.04, zi - 0.35]} s={[1.5, 0.08, 0.7]} color="#c9ced8" rough={0.8} />
      <Caja p={[x + 0.85, 2.15, zi - 0.1]} s={[0.12, 0.2, 0.12]} color={noche ? '#fff0c0' : '#8a8575'} emissive={noche ? '#ffd27a' : '#000000'} ei={noche ? 1.6 : 0} />
    </group>
  );
}

export function texturaReflejo(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0)';
  g.fillRect(0, 0, 128, 128);
  [[10, 28, 0.28], [60, 14, 0.18], [96, 8, 0.22]].forEach(([x, w, a]) => {
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + w, 0);
    g.lineTo(x + w - 50, 128);
    g.lineTo(x - 50, 128);
    g.closePath();
    g.fill();
  });
  return new THREE.CanvasTexture(c);
}
