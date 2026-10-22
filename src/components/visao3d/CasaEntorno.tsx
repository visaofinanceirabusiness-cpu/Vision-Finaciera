'use client';

// Vida alrededor de la casa (Visão 3D, modelo Familia): montañas lejanas, nubes que se desplazan y autos que pasan por la calle.
// Todo es barato: un cilindro con textura, sprites y dos autos de pocas piezas; nada se calcula por pieza en cada cuadro salvo una posición.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PaletaCielo } from './Compartido3D';

const TINTE_MONTANAS: Record<PaletaCielo, [string, string]> = {
  dia: ['#8fb0cf', '#cfe0ee'],
  atardecer: ['#2a2549', '#6a4f78'],
  noche: ['#060a18', '#10183a'],
};

export function Montanas({ hora }: { hora: PaletaCielo }) {
  const textura = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 128;
    const g = c.getContext('2d')!;
    const [arriba, abajo] = TINTE_MONTANAS[hora];
    const degrade = g.createLinearGradient(0, 0, 0, 128);
    degrade.addColorStop(0, arriba);
    degrade.addColorStop(1, abajo);
    g.fillStyle = degrade;
    g.beginPath();
    g.moveTo(0, 128);
    for (let x = 0; x <= 1024; x += 8) {
      const a = x / 1024;
      const y = 52 + Math.sin(a * Math.PI * 6) * 16 + Math.sin(a * Math.PI * 17 + 1) * 9 + Math.sin(a * Math.PI * 41 + 2) * 4;
      g.lineTo(x, y);
    }
    g.lineTo(1024, 128);
    g.closePath();
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }, [hora]);
  useEffect(() => () => textura?.dispose(), [textura]);
  if (!textura) return null;
  return (
    <mesh position={[-1, 8, 0]}>
      <cylinderGeometry args={[125, 125, 28, 64, 1, true]} />
      <meshBasicMaterial map={textura} side={THREE.BackSide} transparent fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

const NUBES: Array<[number, number, number, number]> = [
  [-60, 30, -80, 40], [-20, 36, -95, 52], [25, 28, -85, 44], [62, 34, -90, 48], [-90, 26, -50, 36], [95, 30, -45, 38], [5, 42, -110, 60],
];

export function Nubes({ hora }: { hora: PaletaCielo }) {
  const textura = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d')!;
    [[70, 76, 46], [118, 60, 52], [166, 74, 46], [100, 88, 40], [150, 90, 38]].forEach(([x, y, r]) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 256, 128);
    });
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => textura?.dispose(), [textura]);
  const refs = useRef<Array<THREE.Sprite | null>>([]);
  const ajustes = hora === 'dia' ? { color: '#ffffff', opacity: 0.9 } : hora === 'atardecer' ? { color: '#ffb48f', opacity: 0.5 } : { color: '#46527a', opacity: 0.22 };

  useFrame((_, delta) => {
    refs.current.forEach((s, i) => {
      if (!s) return;
      s.position.x += delta * (0.5 + (i % 3) * 0.25);
      if (s.position.x > 130) s.position.x = -130;
    });
  });

  if (!textura) return null;
  return (
    <>
      {NUBES.map(([x, y, z, ancho], i) => (
        <sprite key={i} ref={(s) => { refs.current[i] = s; }} position={[x, y, z]} scale={[ancho, ancho / 2, 1]}>
          <spriteMaterial map={textura} color={ajustes.color} opacity={ajustes.opacity} transparent fog={false} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </>
  );
}

function AutoCalle({ x0, z, velocidad, color, noche }: { x0: number; z: number; velocidad: number; color: string; noche: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    g.position.x += velocidad * delta;
    if (g.position.x > 50) g.position.x = -50;
    if (g.position.x < -50) g.position.x = 50;
  });
  const sentido = Math.sign(velocidad);
  return (
    <group ref={ref} position={[x0, 0.05, z]} rotation={[0, sentido > 0 ? 0 : Math.PI, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[2.4, 0.6, 1.1]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[-0.1, 0.95, 0]}>
        <boxGeometry args={[1.3, 0.45, 0.95]} />
        <meshStandardMaterial color="#0e1420" roughness={0.1} metalness={0.8} />
      </mesh>
      {[-0.4, 0.4].map((dz) => (
        <mesh key={dz} position={[1.21, 0.5, dz]}>
          <boxGeometry args={[0.05, 0.12, 0.28]} />
          <meshBasicMaterial color={noche ? '#fff6d6' : '#cfc9b6'} toneMapped={false} />
        </mesh>
      ))}
      {[-0.4, 0.4].map((dz) => (
        <mesh key={`t${dz}`} position={[-1.21, 0.5, dz]}>
          <boxGeometry args={[0.05, 0.12, 0.28]} />
          <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
        </mesh>
      ))}
      {[-0.8, 0.8].flatMap((dx) => [-0.52, 0.52].map((dz) => (
        <mesh key={`${dx}${dz}`} position={[dx, 0.22, dz]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.2, 12]} />
          <meshStandardMaterial color="#14171f" roughness={0.9} />
        </mesh>
      )))}
    </group>
  );
}

// Calle: z = 17.5 (ver Exterior en EscenaCasa.tsx).
export function Trafico({ noche }: { noche: boolean }) {
  return (
    <>
      <AutoCalle x0={-30} z={16.5} velocidad={4.2} color="#d94a4a" noche={noche} />
      <AutoCalle x0={20} z={18.5} velocidad={-3.4} color="#e6e9ef" noche={noche} />
    </>
  );
}
