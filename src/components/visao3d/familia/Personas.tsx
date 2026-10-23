'use client';

import { Fundido } from '../base/Compartido3D';
import { Persona } from './Mobiliario';
import { V3 } from './estructura';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// Persona con movimiento barato: un grupo propio (su Fundido la deja en pocas mallas) y solo se mueve ese grupo.
// "quieta" gira apenas la cabeza/cuerpo y respira; "paseo" camina de ida y vuelta en x girando al llegar a cada extremo.
export function PersonaViva({ modo, p, hasta, radio = 1.3, rot = 0, esc = 1, fase, ropa, pantalon, pelo }: { modo: 'quieta' | 'paseo' | 'juego'; p: V3; hasta?: number; radio?: number; rot?: number; esc?: number; fase: number; ropa: string; pantalon: string; pelo: string }) {
  const ref = useRef<THREE.Group>(null);
  const reducido = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g || reducido) return;
    const t = clock.elapsedTime;
    if (modo === 'quieta') {
      g.rotation.y = rot + Math.sin(t * 0.5 + fase) * 0.4;
      g.scale.y = 1 + Math.sin(t * 1.8) * 0.012;
      return;
    }
    if (modo === 'juego') {
      // Corre en círculos alrededor de p (los dos niños se persiguen con distinta fase).
      const ang = t * 0.9 + fase * Math.PI * 2;
      g.position.x = p[0] + Math.cos(ang) * radio;
      g.position.z = p[2] + Math.sin(ang) * radio;
      g.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang));
      g.position.y = p[1] + Math.abs(Math.sin(t * 6 + fase * 5)) * 0.09 * esc;
      return;
    }
    const a = p[0];
    const b = hasta ?? a;
    const ciclo = t * 0.3 + fase * 3;
    g.position.x = a + (b - a) * (0.5 - 0.5 * Math.cos(ciclo));
    const sentido = Math.sin(ciclo) * (b - a) >= 0 ? 1 : -1;
    const meta = sentido * Math.PI / 2;
    g.rotation.y += (meta - g.rotation.y) * 0.08;
    g.position.y = p[1] + Math.abs(Math.sin(t * 4.2 + fase)) * 0.05 * esc;
  });
  return (
    <group ref={ref} position={p} rotation={[0, rot, 0]}>
      <Fundido>
        <Persona p={[0, 0, 0]} esc={esc} ropa={ropa} pantalon={pantalon} pelo={pelo} />
      </Fundido>
    </group>
  );
}
