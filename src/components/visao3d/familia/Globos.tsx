'use client';

import { Letrero } from '../base/Compartido3D';
import { V3 } from './estructura';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// Hilo fino que une un globo con la casa (cilindro delgado entre dos puntos).
export function Hilo({ a, b, color }: { a: V3; b: V3; color: string }) {
  const { pos, quat, largo } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    return { pos: va.clone().add(vb).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), largo: dir.length() };
  }, [a, b]);
  return (
    <group>
      <mesh position={pos} quaternion={quat}>
        <cylinderGeometry args={[0.018, 0.018, largo, 5]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={b}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Globo flotante con el total de una zona; sube y baja apenas. Va afuera de la casa para dejar la escena limpia.
export function Globo({ pos, ancla, lineas, color, fase }: { pos: V3; ancla: V3; lineas: string[]; color: string; fase: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock, camera }) => {
    const g = ref.current;
    if (!g) return;
    g.position.y = pos[1] + Math.sin(clock.elapsedTime * 0.9 + fase) * 0.12;
    g.rotation.y = Math.atan2(camera.position.x - pos[0], camera.position.z - pos[2]); // siempre de frente a la cámara
  });
  return (
    <>
      <Hilo a={[pos[0], pos[1] - 0.7, pos[2]]} b={ancla} color={color} />
      <group ref={ref} position={pos}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[4.32, 1.52]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <Letrero lineas={lineas} brillo={color} ancho={4.2} alto={1.4} posicion={[0, 0, 0]} fondo={`${color}dd`} />
      </group>
    </>
  );
}
