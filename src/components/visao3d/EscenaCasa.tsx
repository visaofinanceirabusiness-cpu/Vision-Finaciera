'use client';

// Escena 3D del modelo Familia de Visão 3D: "la casa". Ya viene amueblada: cada amenidad (auto, sofá, TV, cama,
// escritorio, mesa del comedor…) representa una cuenta y se pinta con el color de su grupo cuando tiene saldo
// (gris en cero, rojo si es negativa). Las tres zonas del balance son habitaciones de la casa, con neón de su color:
// Ativo (azul): cochera, living y dormitorio · Passivo (naranja): oficina · Patrimônio (verde): comedor.
// Se carga con import dinámico (ssr: false).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { colorDeSaldo } from '@/lib/visao3dObjetos';
import { COLOR_GRUPO } from '@/lib/visao3dLayout';
import type { GrupoId, NodoEdificio } from '@/lib/visao3d';
import type { SlotId } from '@/lib/visao3dCasa';
import { CamaraGuiada, Cielo, Fundido, GrupoAnimado, Letrero, Proyector, texturaArte, texturaProcedural, texturaTela, type Etiqueta } from './Compartido3D';
import {
  Alfombra, Archivero, Caja, CargadorEV, Cajas, Cama, Cilindro, Cuadro, Escritorio, Estante, Lampara, LamparaColgante,
  Foco, Mesa, MesaCentro, MesaLateral, Palmera, Persona, Silla, SillaOficina, TexturasCtx, useTexturas,
  type TexturasCasa,
} from './CasaMobiliario';
import { Ahorro, AutoSUV, Banco, Billetes, CajaOtros, Capital, Documentos, Maqueta, Plinto, Resultado, Sofa, Tarjeta, TV } from './CasaObjetos';

type V3 = [number, number, number];

type Props = {
  nodos: Record<SlotId, NodoEdificio>;
  totales: Record<GrupoId, { nombre: string; saldo: number }>;
  slotSeleccionado: SlotId | null;
  onSeleccionar: (nodo: NodoEdificio) => void;
  formatear: (valor: number) => string;
  movimientoReducido: boolean;
  periodoClave: string;
};

// Dónde vive cada amenidad dentro de la casa (coordenadas del mundo; el frente de la casa mira a +z).
const AMENIDADES: Record<SlotId, { pos: V3; escala?: number }> = {
  auto: { pos: [-7.7, 0, 0.4] },
  inmueble: { pos: [-2.25, 0.35, 0.7], escala: 0.68 },
  muebles: { pos: [-1.5, 0, -2.75] },
  electro: { pos: [-3.9, 0, -3.0] },
  otros: { pos: [-9.3, 0, 2.2], escala: 0.9 },
  capital: { pos: [3.2, 0.82, 0.3], escala: 0.75 },
  // Las amenidades chicas se exhiben al frente de cada cuarto sobre un plinto (la altura del plinto va en PLINTOS).
  cobrar: { pos: [-0.5, 0.7, 2.3], escala: 0.8 },
  ahorro: { pos: [-3.9, 3.85, 2.3], escala: 0.8 },
  efectivo: { pos: [-2.5, 3.85, 2.3], escala: 0.8 },
  banco: { pos: [-1.1, 3.85, 2.3], escala: 0.7 },
  tarjeta: { pos: [1.9, 3.85, 2.3], escala: 0.8 },
  prestamo: { pos: [3.3, 3.85, 2.3], escala: 0.8 },
  apagar: { pos: [4.7, 3.85, 2.3], escala: 0.8 },
  resultado: { pos: [3.2, 0.7, 2.4], escala: 0.9 },
};

const PLINTOS: Array<{ id: SlotId; grupo: GrupoId }> = [
  { id: 'cobrar', grupo: 'ACTIVO' }, { id: 'ahorro', grupo: 'ACTIVO' }, { id: 'efectivo', grupo: 'ACTIVO' }, { id: 'banco', grupo: 'ACTIVO' },
  { id: 'tarjeta', grupo: 'PASIVO' }, { id: 'prestamo', grupo: 'PASIVO' }, { id: 'apagar', grupo: 'PASIVO' }, { id: 'resultado', grupo: 'PATRIMONIO' },
];

const ZONAS = {
  garage: { x0: -10.6, x1: -4.7, y0: 0, y1: 3, grupo: 'ACTIVO' as GrupoId },
  living: { x0: -4.7, x1: 0.6, y0: 0, y1: 3, grupo: 'ACTIVO' as GrupoId },
  dormitorio: { x0: -4.7, x1: 0.6, y0: 3.15, y1: 6.15, grupo: 'ACTIVO' as GrupoId },
  oficina: { x0: 0.6, x1: 5.8, y0: 3.15, y1: 6.15, grupo: 'PASIVO' as GrupoId },
  comedor: { x0: 0.6, x1: 5.8, y0: 0, y1: 3, grupo: 'PATRIMONIO' as GrupoId },
};

const FONDO_PARED: Record<GrupoId, string> = { ACTIVO: '#dfe9ff', PASIVO: '#ffe6d1', PATRIMONIO: '#efe3fb' };
const PROF = 6.9;
const Z_ATRAS = -3.45;

function Habitacion({ zona, piso }: { zona: (typeof ZONAS)[keyof typeof ZONAS]; piso: THREE.Texture }) {
  const color = COLOR_GRUPO[zona.grupo];
  const ancho = zona.x1 - zona.x0;
  const alto = zona.y1 - zona.y0;
  const cx = (zona.x0 + zona.x1) / 2;
  const cy = (zona.y0 + zona.y1) / 2;
  const cz = Z_ATRAS + PROF / 2;

  return (
    <group>
      {/* Piso. */}
      <mesh position={[cx, zona.y0 - 0.075, cz]}>
        <boxGeometry args={[ancho, 0.15, PROF]} />
        <meshStandardMaterial map={piso} emissive={color} emissiveIntensity={0.3} roughness={0.28} metalness={0.08} envMapIntensity={1.35} />
      </mesh>
      {/* Borde fino de color en el perímetro del piso. */}
      {([[cx, Z_ATRAS + 0.04, ancho, 0.08], [cx, Z_ATRAS + PROF - 0.04, ancho, 0.08], [zona.x0 + 0.04, cz, 0.08, PROF], [zona.x1 - 0.04, cz, 0.08, PROF]] as const).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, zona.y0 + 0.012, z]}>
          <boxGeometry args={[w, 0.03, d]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {/* Pared del fondo teñida con el color de la zona. */}
      <Caja p={[cx, cy, Z_ATRAS]} s={[ancho, alto, 0.12]} color={FONDO_PARED[zona.grupo]} emissive={color} ei={0.14} rough={0.85} />
    </group>
  );
}

// Punto rojo con borde blanco (el rojo solo lo usa el saldo negativo, el borde lo distingue); late y sube y baja para llamar la atención.
function MarcadorCuenta({ y }: { y: number }) {
  const ref = useRef<THREE.Group>(null);
  const reducido = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useFrame(({ clock }) => {
    if (!ref.current || reducido) return;
    const t = clock.elapsedTime * 2.4;
    ref.current.position.y = y + Math.sin(t) * 0.07;
    ref.current.scale.setScalar(1 + Math.sin(t) * 0.14);
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

function Amenidad({ id, nodo, hover, seleccionada, onHover, onSeleccionar, children }: { id: SlotId; nodo: NodoEdificio; hover: boolean; seleccionada: boolean; onHover: (id: SlotId | null) => void; onSeleccionar: (n: NodoEdificio) => void; children: (p: { color: string; apagado: boolean; brillo: number }) => React.ReactNode }) {
  const { pos, escala = 1 } = AMENIDADES[id];
  const color = colorDeSaldo(nodo.saldo, COLOR_GRUPO[nodo.grupo]);
  const apagado = Math.round(nodo.saldo) === 0;
  const brillo = seleccionada ? 2.4 : hover ? 1.9 : 1;

  return (
    <group
      position={pos}
      scale={hover || seleccionada ? 1.04 : 1}
      onClick={(e) => {
        e.stopPropagation();
        onSeleccionar(nodo);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = '';
      }}
    >
      {/* Cada amenidad se funde en pocas mallas; se rearma solo cuando cambia su color o su brillo. */}
      <group scale={escala}>
        <MarcadorCuenta y={PLINTOS.some((x) => x.id === id) ? 1.5 : 2.1} />
        <Fundido key={`${color}|${brillo}`}>{children({ color, apagado, brillo })}</Fundido>
      </group>
    </group>
  );
}

function Matas({ matas }: { matas: Array<[number, number, number]> }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const malla = ref.current;
    if (!malla) return;
    const m = new THREE.Matrix4();
    matas.forEach(([x, z, e], i) => {
      m.compose(new THREE.Vector3(x, 0.1 * e, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i, 0)), new THREE.Vector3(e, e, e));
      malla.setMatrixAt(i, m);
    });
    malla.instanceMatrix.needsUpdate = true;
  }, [matas]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matas.length]} frustumCulled={false}>
      <coneGeometry args={[0.07, 0.34, 4]} />
      <meshStandardMaterial color="#3f9d58" emissive="#16532b" emissiveIntensity={0.35} roughness={1} flatShading />
    </instancedMesh>
  );
}

function Exterior() {
  const t = useTexturas({
    pasto: () => texturaProcedural('pasto', 18),
    concreto: () => texturaProcedural('concreto', 6),
    asfalto: () => texturaProcedural('asfalto', 8),
    madera: () => texturaProcedural('madera', 5),
    agua: () => texturaProcedural('agua', 2),
  });
  const arbustos = useMemo(() => Array.from({ length: 13 }, (_, i) => ({ x: -4.2 + i * 0.85, z: 5.0 + ((i * 5) % 3) * 0.12, r: 0.24 + ((i * 7) % 4) * 0.05, flor: i % 4 === 0 })), []);
  const arboles: Array<[number, number, number]> = [[-11, -7.6, 1.1], [-6, -8, 1.3], [-0.5, -7.6, 1], [5, -8, 1.25], [10.5, -7.4, 1.1]];
  const faroles: Array<[number, number]> = [[-4.1, 4.9], [1.2, 4.7], [6.4, 4.9], [-9.6, 4.8], [10.2, 11]];
  // Matas de pasto y flores en una sola malla instanciada cada una (cientos de piezas = 1 llamada de dibujo).
  const matas = useMemo(() => {
    const lista: Array<[number, number, number]> = [];
    let n = 7;
    const azar = () => ((n = (n * 16807) % 2147483647) / 2147483647);
    while (lista.length < 520) {
      const x = -20 + azar() * 36;
      const z = 4.6 + azar() * 10;
      const enCamino = x > -10.6 && x < -4.2 && z < 13; // entrada de autos
      const enPileta = x > 0.8 && x < 11 && z > 4.8 && z < 11.4;
      const enSendero = x > -2.5 && x < -0.3 && z < 17;
      if (!enCamino && !enPileta && !enSendero) lista.push([x, z, 0.6 + azar() * 0.8]);
    }
    return lista;
  }, []);
  const flores = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ x: -4 + ((i * 37) % 100) * 0.115, z: 5.4 + ((i * 53) % 10) * 0.12, c: ['#ff6b8a', '#ffd166', '#ffffff', '#c77dff'][i % 4] })), []);

  return (
    <Fundido>
      <mesh position={[-1, -0.17, 5]}>
        <boxGeometry args={[70, 0.1, 40]} />
        <meshStandardMaterial map={t.pasto} roughness={1} />
      </mesh>
      <mesh position={[-7.4, -0.1, 8.5]}>
        <boxGeometry args={[6.2, 0.1, 9]} />
        <meshStandardMaterial map={t.concreto} roughness={0.85} />
      </mesh>
      <mesh position={[-1, -0.19, 17.5]}>
        <boxGeometry args={[70, 0.08, 4.4]} />
        <meshStandardMaterial map={t.asfalto} roughness={0.55} metalness={0.1} />
      </mesh>
      {/* Sendero de piedras hasta la entrada. */}
      <Matas matas={matas} />
      {flores.map((f, i) => (
        <mesh key={i} position={[f.x, 0.12, f.z]}>
          <sphereGeometry args={[0.07, 6, 5]} />
          <meshStandardMaterial color={f.c} emissive={f.c} emissiveIntensity={0.5} />
        </mesh>
      ))}
      <Palmera p={[1.0, -0.05, 6.4]} escala={1.1} />
      <Palmera p={[11.2, -0.05, 9.6]} escala={1.3} />
      <Palmera p={[11.4, -0.05, 5.0]} escala={1.0} />
      {Array.from({ length: 6 }, (_, i) => (
        <Caja key={i} p={[-1.8 + (i % 2) * 0.35, -0.08, 5.3 + i * 1.8]} s={[1.3, 0.08, 1.0]} color="#9aa3b5" rough={0.8} />
      ))}

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

      {arbustos.map((a, i) => (
        <group key={i} position={[a.x, 0.1, a.z]}>
          <mesh>
            <icosahedronGeometry args={[a.r, 1]} />
            <meshStandardMaterial color="#2f8f52" emissive="#0f4a28" emissiveIntensity={0.4} roughness={0.9} flatShading />
          </mesh>
          {a.flor && (
            <mesh position={[0.1, a.r * 0.7, a.r * 0.6]}>
              <sphereGeometry args={[0.07, 8, 6]} />
              <meshStandardMaterial color="#ffd166" emissive="#ffb703" emissiveIntensity={1.2} />
            </mesh>
          )}
        </group>
      ))}

      {faroles.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cilindro p={[0, 0.35, 0]} r={0.045} h={0.7} color="#1c2231" />
          <mesh position={[0, 0.75, 0]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshBasicMaterial color="#ffd89a" toneMapped={false} />
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
  );
}

function Casa({ nodos, totales, slotSeleccionado, hover, setHover, onSeleccionar }: { nodos: Record<SlotId, NodoEdificio>; totales: Props['totales']; slotSeleccionado: SlotId | null; hover: SlotId | null; setHover: (id: SlotId | null) => void; onSeleccionar: (n: NodoEdificio) => void }) {
  const piso = useTexturas({ madera: () => texturaProcedural('madera', 3), concreto: () => texturaProcedural('concreto', 3) });
  const arte = useTexturas({ a0: () => texturaArte('abstracto', 1), a1: () => texturaArte('paisaje', 2), a2: () => texturaArte('abstracto', 3), a3: () => texturaArte('paisaje', 4) });
  const pantallas = useTexturas({ tela: texturaTela, tv: () => texturaArte('tv', 5), monitor: () => texturaArte('grafico', 6) });
  const texturas = useMemo<TexturasCasa>(() => ({ ...pantallas, arte: [arte.a0, arte.a1, arte.a2, arte.a3] }), [pantallas, arte]);
  const amen = (id: SlotId, hijo: (p: { color: string; apagado: boolean; brillo: number }) => React.ReactNode) => (
    <Amenidad key={id} id={id} nodo={nodos[id]} hover={hover === id} seleccionada={slotSeleccionado === id} onHover={setHover} onSeleccionar={onSeleccionar}>
      {hijo}
    </Amenidad>
  );

  return (
    <TexturasCtx.Provider value={texturas}>
    <group>
      {/* Habitaciones. */}
      <Habitacion zona={ZONAS.garage} piso={piso.concreto} />
      <Habitacion zona={ZONAS.living} piso={piso.madera} />
      <Habitacion zona={ZONAS.dormitorio} piso={piso.madera} />
      <Habitacion zona={ZONAS.oficina} piso={piso.madera} />
      <Habitacion zona={ZONAS.comedor} piso={piso.madera} />

      <Fundido>
      {/* Techos. */}
      <Caja p={[0.55, 6.3, 0.0]} s={[11.4, 0.16, 8]} color="#e9edf3" rough={0.6} />
      <Caja p={[-7.7, 3.08, 0.0]} s={[6.6, 0.16, 8]} color="#e9edf3" rough={0.6} />

      {PLINTOS.map(({ id, grupo }) => {
        const [x, y, z] = AMENIDADES[id].pos;
        const h = 0.7;
        return <Plinto key={id} p={[x, y - h, z]} h={h} acento={COLOR_GRUPO[grupo]} />;
      })}

      {/* Cochera: cargador del auto eléctrico. */}
      <CargadorEV p={[-5.1, 0, -3.25]} />

      {/* Living. */}
      <Alfombra p={[-2.1, 0.02, 0.5]} s={[3.8, 2.6]} color="#7e8ba6" />
      <Estante p={[0.05, 0, -3.1]} s={[1.0, 2.3, 0.4]} />
      <Cuadro p={[-1.5, 2.0, -3.37]} s={[1.0, 0.7]} tono={0} />
      <Cuadro p={[-0.2, 1.9, -3.37]} s={[0.6, 0.8]} tono={1} />
      <MesaCentro p={[-1.9, 0, 0.7]} />

      {/* Dormitorio. */}
      <Cama p={[-2.4, 3.15, -2.1]} />
      <MesaLateral p={[-4.0, 3.15, -3.0]} />
      <MesaLateral p={[-0.8, 3.15, -3.0]} />
      <Lampara p={[-4.0, 3.75, -3.0]} />
      <Lampara p={[-0.8, 3.75, -3.0]} />
      <Cuadro p={[-3.2, 5.2, -3.37]} s={[0.7, 0.9]} tono={2} />
      <Cuadro p={[-1.6, 5.2, -3.37]} s={[0.7, 0.9]} tono={3} />

      {/* Oficina. */}
      <Escritorio p={[3.2, 3.15, -2.6]} />
      <SillaOficina p={[3.2, 3.15, -1.5]} rot={Math.PI} />
      <Archivero p={[5.2, 3.15, -3.0]} />
      <Estante p={[1.35, 3.15, -3.15]} s={[1.3, 2.3, 0.4]} libros={false} />
      <Cajas p={[1.3, 4.1, -3.15]} n={3} />
      <Cajas p={[1.3, 5.0, -3.15]} n={2} />
      <Cuadro p={[4.3, 5.4, -3.37]} s={[0.9, 0.6]} tono={0} />

      {/* Comedor. */}
      <Mesa p={[3.2, 0, 0.3]} ancho={3.2} fondo={1.5} />
      {[-1.1, 0, 1.1].flatMap((x) => [-1, 1].map((s) => <Silla key={`${x}${s}`} p={[3.2 + x, 0, 0.3 + s * 1.05]} rot={s > 0 ? Math.PI : 0} color="#cfe9d8" />))}
      <LamparaColgante p={[2.4, 2.2, 0.3]} />
      <LamparaColgante p={[4.0, 2.2, 0.3]} />
      <Caja p={[3.2, 1.55, -3.37]} s={[2.5, 1.45, 0.05]} color="#0e1814" emissive="#b57bff" ei={0.18} />
      <Alfombra p={[3.2, 0.02, 0.3]} s={[4.2, 2.8]} color="#6f9b86" />

      {/* Focos empotrados en el techo de cada habitación. */}
      {[[-7.7, 2.95], [-3.0, 2.95], [-1.0, 2.95], [-3.0, 6.1], [-1.0, 6.1], [2.2, 6.1], [4.4, 6.1], [2.2, 2.95], [4.4, 2.95]].flatMap(([x, y]) => [-1.2, 1.4].map((z) => <Foco key={`${x}${y}${z}`} p={[x, y, z]} />))}

      {/* Personas: la familia en su casa. */}
      <Persona p={[-1.3, 3.15, 0.3]} rot={Math.PI * 0.85} ropa="#c9647f" pantalon="#2f3a52" pelo="#5b3a22" />
      <Persona p={[-2.0, 0.5, -2.45]} sentado ropa="#3d7a5a" pantalon="#2a2f3b" pelo="#2a1c12" />
      <Persona p={[-1.15, 0.5, -2.45]} sentado ropa="#e0a63c" pantalon="#364763" piel="#c98f66" pelo="#1c1410" />
      <Persona p={[3.2, 3.65, -1.45]} rot={Math.PI} sentado ropa="#4a6fb5" pantalon="#232936" pelo="#3a2a1e" />
      <Persona p={[2.1, 0.46, 1.4]} rot={Math.PI} sentado ropa="#c9647f" pantalon="#2a2f3b" pelo="#8a5a2b" />
      <Persona p={[3.2, 0.46, -0.8]} sentado ropa="#5da3c9" pantalon="#364763" piel="#c98f66" pelo="#1c1410" />
      <Persona p={[4.3, 0.46, 1.4]} rot={Math.PI} sentado esc={0.7} ropa="#e0a63c" pantalon="#364763" pelo="#5b3a22" />
      <Persona p={[9.0, 0, 4.6]} rot={Math.PI * 0.85} ropa="#f2f2f2" pantalon="#3e5a8a" pelo="#2a1c12" />
      <Persona p={[8.2, 0, 4.7]} rot={Math.PI * 0.9} esc={0.62} ropa="#ff8a5c" pantalon="#364763" pelo="#8a5a2b" />
      </Fundido>

      {/* Amenidades: son interactivas y cambian de color con el saldo, por eso no se funden. */}
      {amen('otros', (p) => <CajaOtros pintura={p} />)}
      {amen('auto', (p) => <AutoSUV pintura={p} />)}
      {amen('electro', (p) => <TV pintura={p} />)}
      {amen('muebles', (p) => <Sofa pintura={p} />)}
      {amen('inmueble', (p) => <Maqueta pintura={p} />)}
      {amen('cobrar', (p) => <Documentos pintura={p} variante={0} />)}
      {amen('ahorro', (p) => <Ahorro pintura={p} />)}
      {amen('efectivo', (p) => <Billetes pintura={p} />)}
      {amen('banco', (p) => <Banco pintura={p} />)}
      {amen('tarjeta', (p) => <Tarjeta pintura={p} />)}
      {amen('prestamo', (p) => <Documentos pintura={p} variante={1} />)}
      {amen('apagar', (p) => <Documentos pintura={p} variante={2} />)}
      {amen('capital', (p) => <Capital pintura={p} />)}
      {amen('resultado', (p) => <Resultado pintura={p} />)}
    </group>
    </TexturasCtx.Provider>
  );
}

export default function EscenaCasa({ nodos, totales, slotSeleccionado, onSeleccionar, formatear, movimientoReducido, periodoClave }: Props) {
  const [hover, setHover] = useState<SlotId | null>(null);
  // En teléfonos se baja la resolución interna: es lo que más pesa al dibujar.
  const [dprMax] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.75));
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const { objetivo, distancia } = useMemo(() => {
    if (slotSeleccionado) {
      const [x, y, z] = AMENIDADES[slotSeleccionado].pos;
      return { objetivo: new THREE.Vector3(x, y + 0.6, z), distancia: 12 };
    }
    return { objetivo: new THREE.Vector3(-2.3, 3.0, 1.2), distancia: 23 };
  }, [slotSeleccionado]);

  const etiquetas = useMemo<Etiqueta[]>(
    () =>
      (Object.keys(AMENIDADES) as SlotId[]).map((id) => {
        const { pos } = AMENIDADES[id];
        const nodo = nodos[id];
        return {
          id,
          x: pos[0],
          y: pos[1] + 1.0,
          z: pos[2] + 0.6,
          titulo: nodo.nombre,
          saldo: nodo.saldo,
          color: COLOR_GRUPO[nodo.grupo],
          fija: false,
          seleccionada: slotSeleccionado === id,
          alAlado: false,
        };
      }),
    [nodos, slotSeleccionado]
  );

  const placas = useMemo(
    () =>
      (['ACTIVO', 'PASIVO', 'PATRIMONIO'] as GrupoId[]).map((g) => ({
        g,
        lineas: [totales[g].nombre.toUpperCase(), formatear(totales[g].saldo)],
        pos: (g === 'ACTIVO' ? [-2.1, 5.55, 2.6] : g === 'PASIVO' ? [3.2, 5.55, 2.6] : [3.2, 2.4, 2.6]) as V3,
      })),
    [totales, formatear]
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        dpr={[1, dprMax]}
        camera={{ position: [3, 8, 27], fov: 40 }}
        style={{ touchAction: 'none' }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
      >
        <Cielo activo />
        <fog attach="fog" args={['#2a2f55', 45, 120]} />
        <ambientLight intensity={1.15} />
        <hemisphereLight args={['#bcd0ff', '#3a2f26', 0.5]} />
        <directionalLight position={[10, 16, 14]} intensity={1.1}  />
        <Environment frames={1} resolution={256} background={false}>
          <Lightformer form="rect" intensity={4} color="#ffd2a0" position={[-8, 5, 9]} scale={[12, 5, 1]} />
          <Lightformer form="rect" intensity={3} color="#8fb4ff" position={[10, 6, -5]} scale={[10, 5, 1]} />
          <Lightformer form="ring" intensity={2} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={8} />
        </Environment>
        <ContactShadows key={`${periodoClave}|${slotSeleccionado ?? ''}`} position={[0, -0.01, 0]} opacity={0.6} scale={50} blur={2.6} far={9} resolution={384} frames={40} color="#000000" />

        <GrupoAnimado clave={`casa|${periodoClave}`} movimientoReducido={movimientoReducido}>
          <Exterior />
          <Casa nodos={nodos} totales={totales} slotSeleccionado={slotSeleccionado} hover={hover} setHover={setHover} onSeleccionar={onSeleccionar} />
          {placas.map(({ g, lineas, pos }) => (
            <Letrero key={g} lineas={lineas} brillo={COLOR_GRUPO[g]} ancho={2.8} alto={1.0} posicion={pos} fondo={`${COLOR_GRUPO[g]}cc`} />
          ))}
        </GrupoAnimado>

        <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={55} minPolarAngle={0.3} maxPolarAngle={Math.PI / 2 - 0.04} enableDamping dampingFactor={0.08} />
        <CamaraGuiada objetivo={objetivo} distancia={distancia} focoId="casa" movimientoReducido={movimientoReducido} />
        <Proyector etiquetas={etiquetas} refs={refs} />
      </Canvas>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {etiquetas
          .filter((e) => e.fija || e.seleccionada || hover === e.id)
          .map((e) => (
            <div
              key={e.id}
              ref={(nodo) => {
                refs.current[e.id] = nodo;
              }}
              style={{ position: 'absolute', left: 0, top: 0, display: 'none', whiteSpace: 'nowrap', fontSize: 11, color: '#fff', background: 'rgba(8,16,32,0.82)', borderRadius: 8, padding: '3px 8px', border: e.seleccionada ? `1px solid ${e.color}` : '1px solid rgba(255,255,255,0.2)', lineHeight: 1.25, textAlign: 'center' }}
            >
              <b style={{ display: 'block' }}>{e.titulo}</b>
              <span style={{ color: e.saldo < 0 ? '#fca5a5' : '#fff' }}>{formatear(e.saldo)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
