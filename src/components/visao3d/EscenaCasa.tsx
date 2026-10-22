'use client';

// Escena 3D del modelo Familia de Visão 3D: "la casa". Ya viene amueblada: cada amenidad (auto, sofá, TV, cama,
// escritorio, mesa del comedor…) representa una cuenta y se pinta con el color de su grupo cuando tiene saldo
// (gris en cero, rojo si es negativa). Las tres zonas del balance son habitaciones de la casa, con neón de su color:
// Ativo (azul): cochera, living y dormitorio · Passivo (naranja): oficina · Patrimônio (verde): comedor.
// Se carga con import dinámico (ssr: false).

import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Edges, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { colorDeSaldo } from '@/lib/visao3dObjetos';
import { COLOR_GRUPO } from '@/lib/visao3dLayout';
import type { GrupoId, NodoEdificio } from '@/lib/visao3d';
import type { SlotId } from '@/lib/visao3dCasa';
import { CamaraGuiada, Cielo, GrupoAnimado, Letrero, Proyector, Sombras, texturaProcedural, type Etiqueta } from './Compartido3D';
import {
  Alfombra, Archivero, AutoSUV, Caja, CargadorEV, Cajas, Cama, Cilindro, Cuadro, Escritorio, Estante, Lampara, LamparaColgante,
  Maqueta, Mesa, MesaCentro, MesaLateral, ObjetoPintado, Planta, Silla, SillaOficina, Sofa, Tarjeta, TV, useTexturas,
} from './CasaMobiliario';

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
  inmueble: { pos: [-2.25, 0.35, 0.7] },
  cobrar: { pos: [-1.55, 0.35, 0.7], escala: 0.6 },
  muebles: { pos: [-1.5, 0, -2.75] },
  electro: { pos: [-3.9, 0, -3.0] },
  ahorro: { pos: [-4.0, 3.75, -3.0], escala: 0.6 },
  efectivo: { pos: [-0.8, 3.75, -3.0], escala: 0.6 },
  banco: { pos: [-4.3, 5.0, -3.1], escala: 0.5 },
  otros: { pos: [-10.0, 0, -2.6] },
  tarjeta: { pos: [2.55, 3.95, -2.0] },
  prestamo: { pos: [3.9, 3.95, -2.2], escala: 0.7 },
  apagar: { pos: [5.2, 4.5, -3.0], escala: 0.6 },
  capital: { pos: [3.2, 0.82, 0.3], escala: 0.9 },
  resultado: { pos: [3.2, 1.55, -3.3], escala: 1.3 },
};

const ZONAS = {
  garage: { x0: -10.6, x1: -4.7, y0: 0, y1: 3, grupo: 'ACTIVO' as GrupoId },
  living: { x0: -4.7, x1: 0.6, y0: 0, y1: 3, grupo: 'ACTIVO' as GrupoId },
  dormitorio: { x0: -4.7, x1: 0.6, y0: 3.15, y1: 6.15, grupo: 'ACTIVO' as GrupoId },
  oficina: { x0: 0.6, x1: 5.8, y0: 3.15, y1: 6.15, grupo: 'PASIVO' as GrupoId },
  comedor: { x0: 0.6, x1: 5.8, y0: 0, y1: 3, grupo: 'PATRIMONIO' as GrupoId },
};

const FONDO_PARED: Record<GrupoId, string> = { ACTIVO: '#dfe9ff', PASIVO: '#ffe6d1', PATRIMONIO: '#d9f5e4' };
const PROF = 6.9;
const Z_ATRAS = -3.45;

function Habitacion({ zona, piso, luz }: { zona: (typeof ZONAS)[keyof typeof ZONAS]; piso: THREE.Texture; luz: boolean }) {
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
        <meshStandardMaterial map={piso} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Pared del fondo teñida con el color de la zona. */}
      <Caja p={[cx, cy, Z_ATRAS]} s={[ancho, alto, 0.12]} color={FONDO_PARED[zona.grupo]} emissive={color} ei={0.14} rough={0.85} />
      {/* Vidrio de la habitación con borde de neón. */}
      <mesh position={[cx, cy, cz]}>
        <boxGeometry args={[ancho, alto, PROF]} />
        <meshPhysicalMaterial color={color} transparent opacity={0.05} roughness={0.04} clearcoat={1} envMapIntensity={1.4} depthWrite={false} />
        <Edges color={color} lineWidth={2} />
      </mesh>
      <mesh position={[cx, cy, cz]} scale={[1.012, 1.015, 1.012]}>
        <boxGeometry args={[ancho, alto, PROF]} />
        <meshBasicMaterial color={color} transparent opacity={0.13} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {luz && <pointLight position={[cx, y1Luz(zona), cz - 0.5]} intensity={70} distance={11} color={color} />}
    </group>
  );
}

const y1Luz = (z: (typeof ZONAS)[keyof typeof ZONAS]) => z.y1 - 0.6;

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
      <group scale={escala}>{children({ color, apagado, brillo })}</group>
    </group>
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

  return (
    <group>
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
        <meshStandardMaterial map={t.agua} emissive="#38b6ff" emissiveIntensity={0.55} roughness={0.08} metalness={0.2} transparent opacity={0.92} />
      </mesh>
      <pointLight position={[5.8, 0.5, 8]} intensity={9} distance={9} color="#46b8ff" />
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
          {i < 2 && <pointLight position={[0, 0.8, 0]} intensity={5} distance={5} color="#ffcf8a" />}
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
    </group>
  );
}

function Casa({ nodos, totales, slotSeleccionado, hover, setHover, onSeleccionar }: { nodos: Record<SlotId, NodoEdificio>; totales: Props['totales']; slotSeleccionado: SlotId | null; hover: SlotId | null; setHover: (id: SlotId | null) => void; onSeleccionar: (n: NodoEdificio) => void }) {
  const piso = useTexturas({ madera: () => texturaProcedural('madera', 3), concreto: () => texturaProcedural('concreto', 3) });
  const amen = (id: SlotId, hijo: (p: { color: string; apagado: boolean; brillo: number }) => React.ReactNode) => (
    <Amenidad key={id} id={id} nodo={nodos[id]} hover={hover === id} seleccionada={slotSeleccionado === id} onHover={setHover} onSeleccionar={onSeleccionar}>
      {hijo}
    </Amenidad>
  );

  return (
    <group>
      {/* Habitaciones. */}
      <Habitacion zona={ZONAS.garage} piso={piso.concreto} luz />
      <Habitacion zona={ZONAS.living} piso={piso.madera} luz />
      <Habitacion zona={ZONAS.dormitorio} piso={piso.madera} luz />
      <Habitacion zona={ZONAS.oficina} piso={piso.madera} luz />
      <Habitacion zona={ZONAS.comedor} piso={piso.madera} luz />

      {/* Techos con jardín. */}
      <Caja p={[0.55, 6.3, 0.0]} s={[11.4, 0.16, 8]} color="#e9edf3" rough={0.6} />
      <Caja p={[-7.7, 3.08, 0.0]} s={[6.6, 0.16, 8]} color="#e9edf3" rough={0.6} />
      <Planta p={[-1.5, 6.38, -1.5]} escala={1.3} variante={1} />
      <Planta p={[3.8, 6.38, -2.0]} escala={1.1} />
      <Planta p={[-8.5, 3.16, -1.8]} escala={1.1} variante={1} />
      <Planta p={[-6.0, 3.16, -2.4]} escala={0.9} />

      {/* Cochera: cargador del auto eléctrico. */}
      <CargadorEV p={[-5.1, 0, -3.25]} />
      {amen('otros', (p) => <ObjetoPintado tipo="caja" pintura={p} />)}
      {amen('auto', (p) => <AutoSUV pintura={p} />)}

      {/* Living. */}
      <Alfombra p={[-2.1, 0.02, 0.5]} s={[3.8, 2.6]} color="#7e8ba6" />
      <Estante p={[0.05, 0, -3.1]} s={[1.0, 2.3, 0.4]} />
      <Cuadro p={[-1.5, 2.0, -3.37]} s={[1.0, 0.7]} tono={0} />
      <Cuadro p={[-0.2, 1.9, -3.37]} s={[0.6, 0.8]} tono={1} />
      <MesaCentro p={[-1.9, 0, 0.7]} />
      <Planta p={[-4.3, 0, 1.9]} escala={1.5} />
      <Planta p={[0.2, 0, 2.2]} escala={1.2} variante={1} />
      {amen('electro', (p) => <TV pintura={p} />)}
      {amen('muebles', (p) => <Sofa pintura={p} />)}
      {amen('inmueble', (p) => <Maqueta pintura={p} />)}
      {amen('cobrar', (p) => <ObjetoPintado tipo="documento" pintura={p} />)}

      {/* Dormitorio. */}
      <Cama p={[-2.4, 3.15, -2.1]} />
      <MesaLateral p={[-4.0, 3.15, -3.0]} />
      <MesaLateral p={[-0.8, 3.15, -3.0]} />
      <Lampara p={[-4.0, 3.75, -3.0]} />
      <Lampara p={[-0.8, 3.75, -3.0]} />
      <Cuadro p={[-3.2, 5.2, -3.37]} s={[0.7, 0.9]} tono={2} />
      <Cuadro p={[-1.6, 5.2, -3.37]} s={[0.7, 0.9]} tono={3} />
      <Caja p={[-4.3, 4.9, -3.25]} s={[0.7, 0.05, 0.3]} color="#3a3f4d" />
      <Planta p={[0.2, 3.15, 1.8]} escala={1.3} />
      {amen('ahorro', (p) => <ObjetoPintado tipo="ahorro" pintura={p} />)}
      {amen('efectivo', (p) => <ObjetoPintado tipo="billetes" pintura={p} />)}
      {amen('banco', (p) => <ObjetoPintado tipo="banco" pintura={p} />)}

      {/* Oficina. */}
      <Escritorio p={[3.2, 3.15, -2.6]} />
      <SillaOficina p={[3.2, 3.15, -1.5]} rot={Math.PI} />
      <Archivero p={[5.2, 3.15, -3.0]} />
      <Estante p={[1.35, 3.15, -3.15]} s={[1.3, 2.3, 0.4]} libros={false} />
      <Cajas p={[1.3, 4.1, -3.15]} n={3} />
      <Cajas p={[1.3, 5.0, -3.15]} n={2} />
      <Planta p={[0.9, 3.15, 1.9]} escala={1.3} variante={1} />
      <Cuadro p={[4.3, 5.4, -3.37]} s={[0.9, 0.6]} tono={0} />
      {amen('tarjeta', (p) => <Tarjeta pintura={p} />)}
      {amen('prestamo', (p) => <ObjetoPintado tipo="documento" pintura={p} />)}
      {amen('apagar', (p) => <ObjetoPintado tipo="documento" pintura={p} />)}

      {/* Comedor. */}
      <Mesa p={[3.2, 0, 0.3]} ancho={3.2} fondo={1.5} />
      {[-1.1, 0, 1.1].flatMap((x) => [-1, 1].map((s) => <Silla key={`${x}${s}`} p={[3.2 + x, 0, 0.3 + s * 1.05]} rot={s > 0 ? Math.PI : 0} color="#cfe9d8" />))}
      <LamparaColgante p={[2.4, 2.2, 0.3]} />
      <LamparaColgante p={[4.0, 2.2, 0.3]} />
      <Caja p={[3.2, 1.55, -3.37]} s={[2.5, 1.45, 0.05]} color="#0e1814" emissive="#27e17f" ei={0.18} />
      <Planta p={[5.3, 0, -2.4]} escala={1.6} />
      <Planta p={[1.1, 0, 2.3]} escala={1.2} variante={1} />
      {amen('capital', (p) => <ObjetoPintado tipo="capital" pintura={p} />)}
      {amen('resultado', (p) => <ObjetoPintado tipo="resultado" pintura={p} />)}
    </group>
  );
}

export default function EscenaCasa({ nodos, totales, slotSeleccionado, onSeleccionar, formatear, movimientoReducido, periodoClave }: Props) {
  const [hover, setHover] = useState<SlotId | null>(null);
  const [sombrasReales] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches);
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
        dpr={[1, 1.75]}
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
        <ambientLight intensity={0.95} />
        <directionalLight position={[10, 16, 14]} intensity={1.1} castShadow={sombrasReales} shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-0.0005} />
        <Environment frames={1} resolution={256} background={false}>
          <Lightformer form="rect" intensity={4} color="#ffd2a0" position={[-8, 5, 9]} scale={[12, 5, 1]} />
          <Lightformer form="rect" intensity={3} color="#8fb4ff" position={[10, 6, -5]} scale={[10, 5, 1]} />
          <Lightformer form="ring" intensity={2} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={8} />
        </Environment>
        <ContactShadows key={`${periodoClave}|${slotSeleccionado ?? ''}`} position={[0, -0.01, 0]} opacity={0.6} scale={50} blur={2.6} far={9} resolution={512} frames={70} color="#000000" />
        <Sombras activas={sombrasReales} cambio={`${periodoClave}|${nodos.auto.saldo}`} />

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
