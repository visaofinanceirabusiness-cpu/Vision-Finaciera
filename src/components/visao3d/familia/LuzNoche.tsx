'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Charco de luz: gradiente radial aditivo que se apoya en el piso bajo cada foco o farol de noche.
export function useTexturaLuz() {
  const t = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,226,170,0.85)');
    r.addColorStop(0.45, 'rgba(255,200,120,0.3)');
    r.addColorStop(1, 'rgba(255,190,100,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => t?.dispose(), [t]);
  return t;
}

export function Estrellas() {
  const geo = useMemo(() => {
    const pos: number[] = [];
    let n = 11;
    const azar = () => ((n = (n * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const a = azar() * Math.PI * 2;
      const e = 0.12 + azar() * 0.75;
      pos.push(Math.cos(a) * Math.cos(e) * 140, Math.sin(e) * 140, Math.sin(a) * Math.cos(e) * 140 - 30);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} toneMapped={false} fog={false} />
    </points>
  );
}
