'use client';

import { Fundido } from '../base/Compartido3D';
import { Caja } from './Mobiliario';
import { PinturaBorde, esInteriorEn } from './Paredes';
import { FONDO_PARED } from './estructura';
import { PROF, Z_ATRAS } from './layout';
import { COLOR_GRUPO } from '@/lib/visao3dLayout';
import type { Cuarto } from '@/lib/visao3dCasaPlano';
import * as THREE from 'three';

export function Habitacion({ zona, cuartos, piso, tinte }: { zona: Cuarto; cuartos: Cuarto[]; piso: THREE.Texture; tinte: number }) {
  const color = COLOR_GRUPO[zona.grupo];
  const ancho = zona.x1 - zona.x0;
  const alto = zona.y1 - zona.y0;
  const cx = (zona.x0 + zona.x1) / 2;
  const cy = (zona.y0 + zona.y1) / 2;
  const cz = Z_ATRAS + PROF / 2;

  return (
    <Fundido>
      {/* Piso. */}
      <mesh position={[cx, zona.y0 - 0.075, cz]}>
        <boxGeometry args={[ancho, 0.15, PROF]} />
        <meshStandardMaterial map={piso} emissive={color} emissiveIntensity={tinte * 2.1} roughness={0.28} metalness={0.08} envMapIntensity={1.35} />
      </mesh>
      {/* Borde fino de color en el perímetro del piso. */}
      {([[cx, Z_ATRAS + 0.04, ancho, 0.08], [cx, Z_ATRAS + PROF - 0.04, ancho, 0.08], [zona.x0 + 0.04, cz, 0.08, PROF], [zona.x1 - 0.04, cz, 0.08, PROF]] as const).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, zona.y0 + 0.012, z]}>
          <boxGeometry args={[w, 0.03, d]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {/* Pared del fondo y paredes laterales pintadas en pastel con el color de la zona; los vértices llevan un tono más marcado. */}
      <Caja p={[cx, cy, Z_ATRAS]} s={[ancho, alto, 0.12]} color={FONDO_PARED[zona.grupo]} rough={0.85} />
      {(([[zona.x0, 1], [zona.x1, -1]]) as Array<[number, 1 | -1]>)
        .filter(([xb]) => !esInteriorEn(cuartos, zona, xb))
        .map(([xb, lado]) => <PinturaBorde key={xb} zona={zona} xb={xb} lado={lado} />)}
    </Fundido>
  );
}
