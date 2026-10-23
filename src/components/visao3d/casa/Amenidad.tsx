'use client';

import { Fundido } from '../base/Compartido3D';
import { Lugar } from './estructura';
import { NodoEdificio } from '@/lib/visao3d';
import { ObjetoCasa } from '@/lib/visao3dCasa';
import { COLOR_GRUPO } from '@/lib/visao3dLayout';
import { colorDeSaldo } from '@/lib/visao3dObjetos';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// Punto rojo con borde blanco (el rojo solo lo usa el saldo negativo, el borde lo distingue); late y sube y baja para llamar la atención.
export function MarcadorCuenta({ y }: { y: number }) {
  const ref = useRef<THREE.Group>(null);
  const reducido = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const mundo = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock, camera }) => {
    const g = ref.current;
    if (!g) return;
    // Se achica al acercar la cámara para que no tape el objeto.
    const base = THREE.MathUtils.clamp(camera.position.distanceTo(g.getWorldPosition(mundo)) / 14, 0.35, 1.1);
    const t = reducido ? 0 : clock.elapsedTime * 2.4;
    g.position.y = y + Math.sin(t) * 0.07;
    g.scale.setScalar(base * (1 + Math.sin(t) * 0.14));
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      <mesh>
        <sphereGeometry args={[0.2, 14, 14]} />
        <meshBasicMaterial color="#e11d2e" toneMapped={false} />
      </mesh>
      <mesh scale={1.4}>
        <sphereGeometry args={[0.2, 14, 14]} />
        <meshBasicMaterial color="#ffffff" side={THREE.BackSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Amenidad({ objeto, lugar, hover, seleccionada, onHover, onSeleccionar, directo = false, children }: { directo?: boolean; objeto: ObjetoCasa; lugar: Lugar; hover: boolean; seleccionada: boolean; onHover: (id: string | null) => void; onSeleccionar: (n: NodoEdificio) => void; children: (p: { color: string; apagado: boolean; brillo: number; negativo: boolean }) => React.ReactNode }) {
  const { nodo } = objeto;
  const color = colorDeSaldo(nodo.saldo, COLOR_GRUPO[nodo.grupo]);
  const apagado = Math.round(nodo.saldo) === 0;
  const brillo = seleccionada ? 2.4 : hover ? 1.9 : 1;

  return (
    <group
      position={lugar.pos}
      rotation={[0, lugar.rot, 0]}
      scale={hover || seleccionada ? 1.04 : 1}
      onClick={(e) => {
        e.stopPropagation();
        onSeleccionar(nodo);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(objeto.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = '';
      }}
    >
      {/* Cada objeto se funde en pocas mallas; se rearma solo cuando cambia su color o su brillo. */}
      <group scale={lugar.escala}>
        <MarcadorCuenta y={objeto.modo === 'sofa' ? 1.5 : objeto.modo === 'plinto' ? 1.5 : 2.1} />
        {directo ? children({ color, apagado, brillo, negativo: nodo.saldo < 0 }) : <Fundido key={`${color}|${brillo}`}>{children({ color, apagado, brillo, negativo: nodo.saldo < 0 })}</Fundido>}
      </group>
    </group>
  );
}
