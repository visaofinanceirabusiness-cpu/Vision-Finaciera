'use client';

// Escena 3D de Visão Financeira 3D (React Three Fiber). Solo dibuja lo que calcula
// lib/visao3dLayout.ts: volúmenes de vidrio con pisos adentro. Se carga con import dinámico
// (ssr: false) para no sumar three al resto de la aplicación.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { COLOR_GRUPO, type Piso, type Volumen } from '@/lib/visao3dLayout';
import type { NodoEdificio } from '@/lib/visao3d';

type Props = {
  volumenes: Volumen[];
  // Nodo cuyo interior se muestra (cambia al "entrar"): dispara la animación de entrada.
  focoId: string;
  seleccionadoId: string | null;
  onSeleccionar: (nodo: NodoEdificio) => void;
  onEntrar: (nodo: NodoEdificio) => void;
  formatear: (valor: number) => string;
  movimientoReducido: boolean;
};

const claro = (hex: string, factor: number) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), factor);

function centroDe(volumenes: Volumen[], seleccionadoId: string | null): { centro: THREE.Vector3; distancia: number } {
  const total = volumenes.reduce((m, v) => ({ x0: Math.min(m.x0, v.x - v.ancho / 2), x1: Math.max(m.x1, v.x + v.ancho / 2), y1: Math.max(m.y1, v.y + v.alto) }), { x0: Infinity, x1: -Infinity, y1: 0 });
  const baseCentro = new THREE.Vector3((total.x0 + total.x1) / 2, total.y1 / 2, 0);
  const baseDistancia = volumenes.length > 1 ? 16 : 14;

  if (!seleccionadoId) return { centro: baseCentro, distancia: baseDistancia };

  for (const v of volumenes) {
    if (v.id === seleccionadoId) return { centro: new THREE.Vector3(v.x, v.y + v.alto / 2, 0), distancia: 13 };
    const piso = v.pisos.find((p) => p.id === seleccionadoId);
    if (piso) return { centro: new THREE.Vector3(v.x, v.y + piso.y, 0), distancia: 12 };
  }

  return { centro: baseCentro, distancia: baseDistancia };
}

// Lleva la cámara hacia el área elegida (zoom) y, al entrar en un nodo, arranca más lejos y se acerca.
// Solo guía mientras dura el movimiento: apenas la persona toca la escena (arrastrar, rueda, pellizco)
// se suelta el control, para que el zoom y el giro manuales no se pisen cada cuadro.
function CamaraGuiada({ objetivo, distancia, focoId, movimientoReducido }: { objetivo: THREE.Vector3; distancia: number; focoId: string; movimientoReducido: boolean }) {
  const { camera, controls, size } = useThree();
  const guiando = useRef(true);
  // En pantallas angostas (teléfono vertical) el edificio no entra a la misma distancia: se aleja.
  const factorAncho = Math.min(1.9, Math.max(1, 1.1 / (size.width / Math.max(size.height, 1))));
  const distanciaMeta = distancia * factorAncho;
  const distanciaActual = useRef(distanciaMeta * 1.7);

  useEffect(() => {
    distanciaActual.current = movimientoReducido ? distanciaMeta : distanciaMeta * 1.7;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoId, movimientoReducido]);

  // Cada selección nueva (o cambio de nivel) vuelve a guiar la cámara.
  useEffect(() => {
    guiando.current = true;
  }, [objetivo.x, objetivo.y, objetivo.z, distanciaMeta, focoId]);

  useEffect(() => {
    const orbit = controls as unknown as { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } | null;
    if (!orbit) return;
    const soltar = () => {
      guiando.current = false;
    };
    orbit.addEventListener('start', soltar);
    return () => orbit.removeEventListener('start', soltar);
  }, [controls]);

  useFrame((_, delta) => {
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (!orbit || !guiando.current) return;

    const paso = movimientoReducido ? 1 : 1 - Math.pow(0.0008, delta);
    orbit.target.lerp(objetivo, paso);
    distanciaActual.current += (distanciaMeta - distanciaActual.current) * paso;

    const direccion = camera.position.clone().sub(orbit.target);
    if (direccion.lengthSq() < 1e-6) direccion.set(0.5, 0.35, 1);
    direccion.setLength(distanciaActual.current);
    camera.position.copy(orbit.target.clone().add(direccion));
    orbit.update();

    if (orbit.target.distanceTo(objetivo) < 0.02 && Math.abs(distanciaMeta - distanciaActual.current) < 0.05) guiando.current = false;
  });

  return null;
}

function PisoCaja({ piso, volumen, seleccionado, onSeleccionar, onEntrar, onHover, interactivo }: { piso: Piso; volumen: Volumen; seleccionado: boolean; onSeleccionar: (n: NodoEdificio) => void; onEntrar: (n: NodoEdificio) => void; onHover: (id: string | null) => void; interactivo: boolean }) {
  const [encima, setEncima] = useState(false);
  const color = COLOR_GRUPO[piso.nodo.grupo];
  const ancho = volumen.ancho - 0.35;
  const profundidad = volumen.profundidad - 0.35;
  const alto = Math.max(piso.altura - 0.06, 0.05);
  const negativo = piso.nodo.saldo < 0;

  return (
    <group position={[volumen.x, volumen.y + piso.y, 0]}>
      <mesh
        onClick={
          interactivo
            ? (e) => {
                e.stopPropagation();
                if (seleccionado && piso.nodo.hijos.length > 0) onEntrar(piso.nodo);
                else onSeleccionar(piso.nodo);
              }
            : undefined
        }
        onPointerOver={
          interactivo
            ? (e) => {
                e.stopPropagation();
                setEncima(true);
                onHover(piso.id);
                document.body.style.cursor = 'pointer';
              }
            : undefined
        }
        onPointerOut={
          interactivo
            ? () => {
                setEncima(false);
                onHover(null);
                document.body.style.cursor = '';
              }
            : undefined
        }
      >
        <boxGeometry args={[ancho, alto, profundidad]} />
        <meshStandardMaterial
          color={claro(color, negativo ? 0.55 : 0.12)}
          emissive={color}
          emissiveIntensity={seleccionado ? 0.45 : encima ? 0.4 : 0.18}
          transparent
          opacity={seleccionado ? 0.9 : 0.72}
          roughness={0.25}
          metalness={0.1}
        />
        <Edges color={seleccionado ? '#ffffff' : claro(color, 0.5)} />
      </mesh>

    </group>
  );
}

function VolumenVidrio({ volumen, seleccionadoId, esRaiz, onSeleccionar, onEntrar, onHover }: { volumen: Volumen; seleccionadoId: string | null; esRaiz: boolean; onSeleccionar: (n: NodoEdificio) => void; onEntrar: (n: NodoEdificio) => void; onHover: (id: string | null) => void }) {
  const [encima, setEncima] = useState(false);
  const color = COLOR_GRUPO[volumen.nodo.grupo];
  const seleccionado = seleccionadoId === volumen.id;

  return (
    <group>
      {/* Cáscara de vidrio. En la vista de empresa es el área seleccionable; adentro, un contenedor. */}
      <mesh
        position={[volumen.x, volumen.y + volumen.alto / 2, 0]}
        onClick={
          esRaiz
            ? (e) => {
                e.stopPropagation();
                if (seleccionado) onEntrar(volumen.nodo);
                else onSeleccionar(volumen.nodo);
              }
            : undefined
        }
        onPointerOver={esRaiz ? (e) => (e.stopPropagation(), setEncima(true), onHover(volumen.id), (document.body.style.cursor = 'pointer')) : undefined}
        onPointerOut={esRaiz ? () => (setEncima(false), onHover(null), (document.body.style.cursor = '')) : undefined}
      >
        <boxGeometry args={[volumen.ancho, volumen.alto, volumen.profundidad]} />
        <meshStandardMaterial color={color} transparent opacity={seleccionado ? 0.3 : encima ? 0.24 : 0.14} roughness={0.05} metalness={0.2} depthWrite={false} />
        <Edges color={color} />
      </mesh>

      {volumen.pisos.map((piso) => (
        <PisoCaja key={piso.id} piso={piso} volumen={volumen} seleccionado={seleccionadoId === piso.id} onSeleccionar={onSeleccionar} onEntrar={onEntrar} onHover={onHover} interactivo={!esRaiz} />
      ))}

    </group>
  );
}

// Aparece escalando suavemente cada vez que se entra en otro nodo: la sensación de "meterse" en el edificio.
function GrupoAnimado({ clave, movimientoReducido, children }: { clave: string; movimientoReducido: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    if (ref.current) ref.current.scale.setScalar(movimientoReducido ? 1 : 0.82);
  }, [clave, movimientoReducido]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const s = ref.current.scale.x + (1 - ref.current.scale.x) * (1 - Math.pow(0.001, delta));
    ref.current.scale.setScalar(s);
  });

  return <group ref={ref}>{children}</group>;
}

type Etiqueta = { id: string; x: number; y: number; z: number; titulo: string; saldo: number; color: string; fija: boolean; seleccionada: boolean };

// Las etiquetas son DOM común (no objetos de la escena): se reubican cada cuadro proyectando su punto 3D a la pantalla.
function Proyector({ etiquetas, refs }: { etiquetas: Etiqueta[]; refs: React.MutableRefObject<Record<string, HTMLDivElement | null>> }) {
  const { camera, size } = useThree();
  const punto = useRef(new THREE.Vector3());

  useFrame(() => {
    for (const e of etiquetas) {
      const nodo = refs.current[e.id];
      if (!nodo) continue;
      punto.current.set(e.x, e.y, e.z).project(camera);
      const detras = punto.current.z > 1;
      nodo.style.display = detras ? 'none' : 'block';
      nodo.style.transform = `translate(-50%, -50%) translate(${(punto.current.x * 0.5 + 0.5) * size.width}px, ${(-punto.current.y * 0.5 + 0.5) * size.height}px)`;
    }
  });

  return null;
}

export default function Escena({ volumenes, focoId, seleccionadoId, onSeleccionar, onEntrar, formatear, movimientoReducido }: Props) {
  const esRaiz = focoId === 'empresa';
  const { centro, distancia } = useMemo(() => centroDe(volumenes, seleccionadoId), [volumenes, seleccionadoId]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const etiquetas = useMemo<Etiqueta[]>(
    () =>
      volumenes.flatMap((v) => {
        if (esRaiz) {
          return [{ id: v.id, x: v.x, y: v.y + v.alto / 2, z: v.profundidad / 2 + 0.05, titulo: v.nodo.nombre, saldo: v.nodo.saldo, color: COLOR_GRUPO[v.nodo.grupo], fija: true, seleccionada: seleccionadoId === v.id }];
        }
        return v.pisos.map((p) => ({
          id: p.id,
          x: v.x,
          y: v.y + p.y,
          z: v.profundidad / 2 + 0.05,
          titulo: p.nodo.nombre,
          saldo: p.nodo.saldo,
          color: COLOR_GRUPO[p.nodo.grupo],
          // Los pisos finitos muestran su nombre siempre; los más finos solo al pasar o seleccionarlos.
          fija: p.altura >= 0.5,
          seleccionada: seleccionadoId === p.id,
        }));
      }),
    [volumenes, esRaiz, seleccionadoId]
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [9, 7, 14], fov: 42 }} style={{ touchAction: 'none' }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#0b1424']} />
        <fog attach="fog" args={['#0b1424', 26, 60]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[8, 14, 10]} intensity={1.4} />
        <pointLight position={[-9, 5, -6]} intensity={0.9} color="#6aa7ff" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[16, 64]} />
          <meshStandardMaterial color="#101c33" roughness={0.9} />
        </mesh>
        <gridHelper args={[32, 32, '#22385f', '#16253f']} position={[0, 0, 0]} />

        <GrupoAnimado clave={focoId} movimientoReducido={movimientoReducido}>
          {volumenes.map((v) => (
            <VolumenVidrio key={v.id} volumen={v} seleccionadoId={seleccionadoId} esRaiz={esRaiz} onSeleccionar={onSeleccionar} onEntrar={onEntrar} onHover={setHoverId} />
          ))}
        </GrupoAnimado>

        <OrbitControls makeDefault enablePan={false} minDistance={5} maxDistance={48} minPolarAngle={0.25} maxPolarAngle={Math.PI / 2 - 0.05} enableDamping dampingFactor={0.08} />
        <CamaraGuiada objetivo={centro} distancia={distancia} focoId={focoId} movimientoReducido={movimientoReducido} />
        <Proyector etiquetas={etiquetas} refs={refs} />
      </Canvas>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {etiquetas
          .filter((e) => e.fija || e.seleccionada || hoverId === e.id)
          .map((e) => (
            <div
              key={e.id}
              ref={(nodo) => {
                refs.current[e.id] = nodo;
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                display: 'none',
                whiteSpace: 'nowrap',
                fontSize: 11.5,
                color: '#fff',
                background: esRaiz ? e.color : 'rgba(8,16,32,0.8)',
                borderRadius: esRaiz ? 999 : 8,
                padding: esRaiz ? '4px 12px' : '3px 8px',
                border: e.seleccionada ? '1px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                fontWeight: esRaiz ? 800 : 400,
              }}
            >
              <b>{e.titulo}</b>
              <span style={{ opacity: 0.9, marginLeft: 6, color: e.saldo < 0 ? '#fca5a5' : '#fff' }}>{formatear(e.saldo)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
