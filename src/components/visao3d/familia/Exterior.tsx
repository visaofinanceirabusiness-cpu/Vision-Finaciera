'use client';

import { Fundido, texturaProcedural } from '../base/Compartido3D';
import { Arbusto, Flores, HojasPalmera, PalmeraDetallada, Pasto } from './Jardin';
import { Caja, Cilindro, useTexturas } from './Mobiliario';
import { Sabio } from './Sabio';
import { CAMINO_ANCHO, CAMINO_X, V3, enSabio, sobreCamino } from './estructura';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// Palmera que se mece apenas con el viento; tiene su propio Fundido (se mueve entera, sigue siendo pocas mallas).
export function PalmeraViva({ p, escala, fase }: { p: V3; escala: number; fase: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.7 + fase;
    g.rotation.z = Math.sin(t) * 0.025;
    g.rotation.x = Math.cos(t * 0.8) * 0.018;
  });
  return (
    <group ref={ref} position={p}>
      <Fundido>
        <PalmeraDetallada p={[0, 0, 0]} escala={escala} />
      </Fundido>
      <HojasPalmera p={[0, 0, 0]} escala={escala} />
    </group>
  );
}

export function Exterior({ noche }: { noche: boolean }) {
  const t = useTexturas({
    pasto: () => texturaProcedural('pasto', 18),
    concreto: () => texturaProcedural('concreto', 6),
    asfalto: () => texturaProcedural('asfalto', 8),
    madera: () => texturaProcedural('madera', 5),
    agua: () => texturaProcedural('agua', 2),
  });
  // Corriente suave del agua de la pileta: se desplaza la textura compartida (no cambia la geometría fundida).
  useFrame((_, delta) => {
    t.agua.offset.x += delta * 0.012;
    t.agua.offset.y += delta * 0.006;
  });
  const arbustos = useMemo(() => Array.from({ length: 13 }, (_, i) => ({ x: -4.2 + i * 0.85, z: 5.0 + ((i * 5) % 3) * 0.12, r: 0.24 + ((i * 7) % 4) * 0.05, flor: i % 4 === 0 })).filter((a) => !sobreCamino(a.x)), []);
  const arboles: Array<[number, number, number]> = [[-11, -7.6, 1.1], [-6, -8, 1.3], [-0.5, -7.6, 1], [5, -8, 1.25], [10.5, -7.4, 1.1]];
  const faroles: Array<[number, number]> = [[6.4, 4.9], [-12.6, 6.6], [10.2, 11]];
  // Matas de pasto y flores en una sola malla instanciada cada una (cientos de piezas = 1 llamada de dibujo).
  const matas = useMemo(() => {
    const lista: Array<[number, number, number]> = [];
    let n = 7;
    const azar = () => ((n = (n * 16807) % 2147483647) / 2147483647);
    while (lista.length < 460) {
      const x = -20 + azar() * 36;
      const z = 4.6 + azar() * 9.6;
      const enCamino = x > -11.9 && x < -5.4 && z < 15.5; // entrada de autos
      const enPileta = x > 0.8 && x < 11 && z > 4.8 && z < 11.4;
      const enSendero = sobreCamino(x) || enSabio(x, z);
      if (!enCamino && !enPileta && !enSendero) lista.push([x, z, 0.6 + azar() * 0.8]);
    }
    return lista;
  }, []);
  const flores = useMemo(() => {
    const azar = (() => { let n = 31; return () => ((n = (n * 16807) % 2147483647) / 2147483647); })();
    const lista: Array<{ x: number; z: number; e: number }> = [];
    while (lista.length < 80) {
      // Canteros a ambos lados del camino y delante de la casa; nunca sobre el camino ni donde está Sabio.
      const x = -5.2 + azar() * 6.2;
      const z = 4.4 + azar() * 7.4;
      if (sobreCamino(x) || enSabio(x, z)) continue;
      lista.push({ x, z, e: 0.85 + azar() * 0.5 });
    }
    return lista;
  }, []);

  return (
    <>
    <Fundido key={noche ? 'n' : 'd'}>
      <mesh position={[-1, -0.17, 5]}>
        <boxGeometry args={[70, 0.1, 40]} />
        <meshStandardMaterial map={t.pasto} roughness={1} />
      </mesh>
      <mesh position={[-8.65, -0.06, 9.45]}>
        <boxGeometry args={[5.9, 0.1, 11.95]} />
        <meshStandardMaterial map={t.concreto} roughness={0.85} />
      </mesh>
      {/* La calle va por encima del pasto (antes quedaba tapada por él), con vereda y línea central. */}
      <mesh position={[-1, -0.07, 17.5]}>
        <boxGeometry args={[70, 0.1, 4.4]} />
        <meshStandardMaterial map={t.asfalto} roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[-1, -0.06, 14.85]}>
        <boxGeometry args={[70, 0.1, 1.0]} />
        <meshStandardMaterial map={t.concreto} roughness={0.85} />
      </mesh>
      {Array.from({ length: 24 }, (_, i) => <Caja key={`ln${i}`} p={[-33 + i * 3, 0.0, 17.5]} s={[1.4, 0.02, 0.12]} color="#f3f0d8" rough={0.6} />)}
      {[15.5, 19.5].map((z) => <Caja key={`bo${z}`} p={[-1, -0.0, z]} s={[70, 0.02, 0.1]} color="#e9e9ef" rough={0.6} />)}
      {/* Sendero de piedras hasta la entrada. */}
      <Pasto matas={matas} />
      <Flores lugares={flores} />
      {/* Camino de entrada: base, losas en dos columnas, cordones a los lados y balizas. */}
      <Caja p={[CAMINO_X, -0.085, 9.05]} s={[CAMINO_ANCHO, 0.07, 11]} color="#c3c9d4" rough={0.9} />
      {Array.from({ length: 9 }, (_, i) =>
        [-0.45, 0.45].map((dx, k) => (
          <Caja key={`lo${i}${k}`} p={[CAMINO_X + dx, -0.04, 4.2 + i * 1.2]} s={[0.84, 0.05, 1.05]} color={(i + k) % 2 ? '#d4d9e2' : '#dde1e9'} rough={0.75} />
        ))
      )}
      {[-1, 1].map((l) => <Caja key={`cd${l}`} p={[CAMINO_X + l * (CAMINO_ANCHO / 2 + 0.06), -0.03, 9.05]} s={[0.12, 0.14, 11]} color="#8f98a8" rough={0.8} />)}
      {[5.4, 9.0, 12.6].flatMap((z) => [-1, 1].map((l) => (
        <group key={`ba${z}${l}`} position={[CAMINO_X + l * (CAMINO_ANCHO / 2 + 0.55), 0, z]}>
          <Cilindro p={[0, 0.25, 0]} r={0.05} h={0.5} color="#2a303c" />
          <mesh position={[0, 0.55, 0]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshBasicMaterial color={noche ? '#ffd89a' : '#8a8575'} toneMapped={false} />
          </mesh>
        </group>
      )))}

      {/* Pileta con deck de madera, agua y reposeras. */}
      <mesh position={[5.8, -0.09, 8]}>
        <boxGeometry args={[9, 0.1, 5.6]} />
        <meshStandardMaterial map={t.madera} roughness={0.6} />
      </mesh>
      <mesh position={[5.8, -0.03, 8]}>
        <boxGeometry args={[7.6, 0.06, 4.2]} />
        <meshStandardMaterial map={t.agua} emissive="#38b6ff" emissiveIntensity={0.5} roughness={0.05} metalness={0.4} envMapIntensity={1.6} transparent opacity={0.92} />
      </mesh>
      {[[-0.3, 0], [1.3, 0]].map(([dx], i) => (
        <group key={i} position={[10.9 + dx, 0, 6.6 + i * 1.6]}>
          <Caja p={[0, 0.3, 0]} s={[0.8, 0.12, 1.9]} color="#e8e2d6" rough={0.8} />
          <Caja p={[0, 0.55, -0.7]} s={[0.8, 0.5, 0.1]} color="#e8e2d6" rough={0.8} />
          {[-0.35, 0.35].flatMap((x) => [-0.8, 0.8].map((z) => <Caja key={`${x}${z}`} p={[x, 0.14, z]} s={[0.06, 0.28, 0.06]} color="#2a2f3b" />))}
        </group>
      ))}

      {arbustos.map((a, i) => <Arbusto key={i} p={[a.x, -0.1, a.z]} r={a.r} flor={a.flor} />)}

      {faroles.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cilindro p={[0, 0.35, 0]} r={0.045} h={0.7} color="#1c2231" />
          <mesh position={[0, 0.75, 0]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshBasicMaterial color={noche ? '#ffd89a' : '#8a8575'} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <Caja p={[-1, 1.2, -6]} s={[44, 2.4, 0.3]} color="#cfd3dc" rough={0.9} />
      {arboles.map(([x, z, e], i) => (
        <group key={i} position={[x, 0, z]} scale={e}>
          <Cilindro p={[0, 1.2, 0]} r={0.18} h={2.4} color="#4a3626" />
          <mesh position={[0, 3.2, 0]}>
            <icosahedronGeometry args={[1.5, 1]} />
            <meshStandardMaterial color="#2b7a49" emissive="#0f3d22" emissiveIntensity={0.45} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0.6, 2.4, 0.3]}>
            <icosahedronGeometry args={[1.1, 1]} />
            <meshStandardMaterial color="#35905a" emissive="#0f3d22" emissiveIntensity={0.4} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </Fundido>
    <PalmeraViva p={[-14.5, -0.05, 6.2]} escala={1.1} fase={0} />
    <PalmeraViva p={[11.2, -0.05, 9.6]} escala={1.3} fase={1.7} />
    <PalmeraViva p={[11.4, -0.05, 5.0]} escala={1.0} fase={3.1} />
    </>
  );
}
