'use client';

// Escena 3D de Visão Financeira 3D (React Three Fiber). Solo dibuja lo que calcula lib/visao3dLayout.ts.
// Desde lejos se ve la FACHADA (vidrio con ventanas iluminadas); al acercarse la cámara el vidrio se vuelve
// transparente y aparece el INTERIOR: pisos neutros con un objeto por cuenta (auto, casa, mesa, billetes…),
// del color del grupo, gris si la cuenta está en cero y rojo si es negativa. Se carga con import dinámico
// (ssr: false) para no sumar three al resto de la aplicación.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { COLOR_GRUPO, type Piso, type Volumen } from '@/lib/visao3dLayout';
import type { NodoEdificio } from '@/lib/visao3d';
import { colorDeSaldo, tipoObjeto } from '@/lib/visao3dObjetos';
import { ObjetoCuenta } from './Objetos';

type Props = {
  volumenes: Volumen[];
  // Nodo cuyo interior se muestra (cambia al "entrar"): dispara la animación de entrada.
  focoId: string;
  // Cambia con el período elegido: el edificio "crece" o se achica a su nueva medida.
  periodoClave: string;
  seleccionadoId: string | null;
  onSeleccionar: (nodo: NodoEdificio) => void;
  onEntrar: (nodo: NodoEdificio) => void;
  formatear: (valor: number) => string;
  movimientoReducido: boolean;
  vistaArquitecto: boolean;
  nombreEmpresa: string;
};

// Dos apariencias: la oscura de siempre y la "vista de arquitecto" (maqueta clara, corte del edificio con todos
// los pisos a la vista, sombras y cámara en perspectiva casi isométrica).
type Tema = {
  fondo: string;
  suelo: string;
  grilla: [string, string];
  piso: string;
  bordePiso: string;
  bordeEncima: string;
  losa: string;
  base: string;
  techo: string;
  luzAmbiente: number;
  etiquetaFondo: string;
  etiquetaTexto: string;
  etiquetaBorde: string;
};

const TEMAS: Record<'oscuro' | 'arquitecto', Tema> = {
  oscuro: { fondo: '#0b1424', suelo: '#101c33', grilla: ['#22385f', '#16253f'], piso: '#dbe7ff', bordePiso: '#7f93b8', bordeEncima: '#ffffff', losa: '#cbd5e1', base: '#1b2a44', techo: '#cbd5e1', luzAmbiente: 0.9, etiquetaFondo: 'rgba(8,16,32,0.8)', etiquetaTexto: '#ffffff', etiquetaBorde: 'rgba(255,255,255,0.2)' },
  arquitecto: { fondo: '#eef2f7', suelo: '#ffffff', grilla: ['#c3cedd', '#dde4ee'], piso: '#ffffff', bordePiso: '#334155', bordeEncima: '#0f172a', losa: '#ffffff', base: '#94a3b8', techo: '#e2e8f0', luzAmbiente: 1.15, etiquetaFondo: 'rgba(255,255,255,0.92)', etiquetaTexto: '#0f172a', etiquetaBorde: 'rgba(15,23,42,0.25)' },
};

// Qué tan cerca (respecto de la distancia normal de la vista) el vidrio pasa de fachada a transparente.
// En la vista de empresa se arranca viendo la fachada y se revela el interior al acercarse; ya dentro de un
// grupo o rubro, el interior se ve de entrada.
const UMBRALES = { raiz: { interior: 0.7, fachada: 0.95 }, dentro: { interior: 1.05, fachada: 1.6 } };

function factorAncho(ancho: number, alto: number): number {
  return Math.min(1.9, Math.max(1, 1.1 / (ancho / Math.max(alto, 1))));
}

function centroDe(volumenes: Volumen[], seleccionadoId: string | null): { centro: THREE.Vector3; distancia: number } {
  const total = volumenes.reduce((m, v) => ({ x0: Math.min(m.x0, v.x - v.ancho / 2), x1: Math.max(m.x1, v.x + v.ancho / 2), y1: Math.max(m.y1, v.y + v.alto) }), { x0: Infinity, x1: -Infinity, y1: 0 });
  const baseCentro = new THREE.Vector3((total.x0 + total.x1) / 2, total.y1 / 2, 0);
  const baseDistancia = volumenes.length > 1 ? 16 : Math.max(11.5, volumenes[0].alto * 1.5 + 3);

  if (!seleccionadoId) return { centro: baseCentro, distancia: baseDistancia };

  for (const v of volumenes) {
    if (v.id === seleccionadoId) return { centro: new THREE.Vector3(v.x, v.y + v.alto / 2, 0), distancia: 12 };
    const piso = v.pisos.find((p) => p.id === seleccionadoId);
    if (piso) return { centro: new THREE.Vector3(v.x, v.y + piso.y, 0), distancia: 9 };
  }

  return { centro: baseCentro, distancia: baseDistancia };
}

// Lleva la cámara hacia el área elegida (zoom) y, al entrar en un nodo, arranca más lejos y más abajo y "sube"
// (efecto ascensor). Solo guía mientras dura el movimiento: apenas la persona toca la escena (arrastrar,
// rueda, pellizco) se suelta el control, para que el zoom y el giro manuales no se pisen cada cuadro.
function CamaraGuiada({ objetivo, distancia, focoId, movimientoReducido, vistaArquitecto }: { objetivo: THREE.Vector3; distancia: number; focoId: string; movimientoReducido: boolean; vistaArquitecto: boolean }) {
  const { camera, controls, size } = useThree();
  const guiando = useRef(true);
  // En pantallas angostas (teléfono vertical) el edificio no entra a la misma distancia: se aleja.
  const distanciaMeta = distancia * factorAncho(size.width, size.height) * (vistaArquitecto ? 1.55 : 1);
  const distanciaActual = useRef(distanciaMeta * 1.7);

  useEffect(() => {
    distanciaActual.current = movimientoReducido ? distanciaMeta : distanciaMeta * 1.7;
    const orbit = controls as unknown as { target: THREE.Vector3 } | null;
    if (orbit && !movimientoReducido) orbit.target.y -= 3;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoId, movimientoReducido]);

  // Vista de arquitecto: cámara en perspectiva casi isométrica (lente más larga, un poco más lejos) y desde arriba.
  useEffect(() => {
    const perspectiva = camera as THREE.PerspectiveCamera;
    perspectiva.fov = vistaArquitecto ? 26 : 42;
    perspectiva.updateProjectionMatrix();
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit) {
      const direccion = vistaArquitecto ? new THREE.Vector3(0.75, 0.8, 1) : new THREE.Vector3(0.64, 0.5, 1);
      camera.position.copy(orbit.target.clone().add(direccion.setLength(distanciaActual.current)));
      orbit.update();
    }
    guiando.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaArquitecto]);

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

// Texto sobre una superficie (letreros, nombre del grupo sobre el vidrio): se dibuja en un canvas 2D, así no hace
// falta cargar fuentes ni modelos.
function crearTexturaTexto(lineas: string[], brillo: string, ancho: number, alto: number, fondo?: string): THREE.CanvasTexture {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const g = lienzo.getContext('2d')!;
  if (fondo) {
    g.fillStyle = fondo;
    g.fillRect(0, 0, ancho, alto);
  }
  let fuente = Math.floor(alto / (lineas.length + 0.6));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${fuente}px Arial, Helvetica, sans-serif`;
  const masAncha = Math.max(...lineas.map((t) => g.measureText(t).width));
  if (masAncha > ancho * 0.9) {
    fuente = Math.floor((fuente * ancho * 0.9) / masAncha);
    g.font = `800 ${fuente}px Arial, Helvetica, sans-serif`;
  }
  g.shadowColor = brillo;
  g.shadowBlur = fuente * 0.35;
  g.fillStyle = '#ffffff';
  lineas.forEach((t, i) => g.fillText(t, ancho / 2, (alto * (i + 1)) / (lineas.length + 1)));
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function Letrero({ lineas, brillo, ancho, alto, posicion, fondo, material }: { lineas: string[]; brillo: string; ancho: number; alto: number; posicion: [number, number, number]; fondo?: string; material?: React.RefObject<THREE.MeshBasicMaterial | null> }) {
  const textura = useMemo(() => crearTexturaTexto(lineas, brillo, 1024, Math.round((1024 * alto) / ancho), fondo), [lineas, brillo, alto, ancho, fondo]);
  useEffect(() => () => textura.dispose(), [textura]);

  return (
    <mesh position={posicion}>
      <planeGeometry args={[ancho, alto]} />
      <meshBasicMaterial ref={material} map={textura} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// Parteluces de la vidriera (barras verticales finas): dan la idea de un frente de vidrio de local.
function Parteluces({ volumen, material, lado }: { volumen: Volumen; material: React.RefObject<THREE.MeshBasicMaterial | null>; lado: 'frente' | 'lateral' }) {
  const ancho = lado === 'frente' ? volumen.ancho : volumen.profundidad;
  const columnas = Math.max(2, Math.round(ancho / 1.1));
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const malla = ref.current;
    if (!malla) return;
    const matriz = new THREE.Matrix4();
    for (let c = 0; c <= columnas; c++) {
      matriz.setPosition(-ancho / 2 + (c * ancho) / columnas, volumen.alto / 2, 0);
      malla.setMatrixAt(c, matriz);
    }
    malla.count = columnas + 1;
    malla.instanceMatrix.needsUpdate = true;
  }, [columnas, ancho, volumen.alto]);

  const posicion: [number, number, number] =
    lado === 'frente' ? [volumen.x, volumen.y, volumen.profundidad / 2 + 0.02] : [volumen.x + volumen.ancho / 2 + 0.02, volumen.y, 0];

  return (
    <group position={posicion} rotation={[0, lado === 'frente' ? 0 : Math.PI / 2, 0]}>
      <instancedMesh ref={ref} args={[undefined, undefined, columnas + 1]} frustumCulled={false}>
        <boxGeometry args={[0.05, volumen.alto, 0.04]} />
        <meshBasicMaterial ref={material} color="#0a1020" transparent opacity={0.7} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function Interior({ piso }: { piso: Piso }) {
  const nodo = piso.nodo;
  // Un piso de rubro muestra los objetos de sus cuentas más grandes; uno de cuenta, el suyo.
  const nodos = nodo.hijos.length === 0 ? [nodo] : nodo.hijos.slice().sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)).slice(0, 3);
  const escala = Math.min(1.5, Math.max(0.3, piso.altura * 0.9)) * (nodos.length > 1 ? 0.75 : 1);

  return (
    <group position={[0, -piso.altura / 2 + 0.05, 0]}>
      {nodos.map((n, i) => (
        <group key={n.id} position={[(i - (nodos.length - 1) / 2) * 1.9 * Math.max(escala, 0.7), 0, 0]} scale={escala}>
          <ObjetoCuenta tipo={tipoObjeto(n.nombre, n.sintetico)} color={colorDeSaldo(n.saldo, COLOR_GRUPO[n.grupo])} apagado={Math.round(n.saldo) === 0} />
        </group>
      ))}
    </group>
  );
}

function PisoCaja({ piso, volumen, seleccionado, tema, arquitecto, onSeleccionar, onEntrar, onHover, interactivo }: { piso: Piso; volumen: Volumen; seleccionado: boolean; tema: Tema; arquitecto: boolean; onSeleccionar: (n: NodoEdificio) => void; onEntrar: (n: NodoEdificio) => void; onHover: (id: string | null) => void; interactivo: boolean }) {
  const [encima, setEncima] = useState(false);
  const colorGrupo = COLOR_GRUPO[piso.nodo.grupo];
  const ancho = volumen.ancho - 0.35;
  const profundidad = volumen.profundidad - 0.35;
  const alto = Math.max(piso.altura - 0.06, 0.05);

  return (
    <group
      position={[volumen.x, volumen.y + piso.y, 0]}
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
      {/* Estructura neutra y transparente: el color queda para las cuentas. */}
      <mesh>
        <boxGeometry args={[ancho, alto, profundidad]} />
        <meshStandardMaterial color={tema.piso} transparent opacity={seleccionado ? 0.24 : encima ? 0.16 : arquitecto ? 0.05 : 0.07} depthWrite={false} roughness={0.2} />
        <Edges color={seleccionado ? colorGrupo : encima ? tema.bordeEncima : tema.bordePiso} />
      </mesh>
      <mesh position={[0, -alto / 2 + 0.025, 0]}>
        <boxGeometry args={[ancho, 0.05, profundidad]} />
        <meshStandardMaterial color={tema.losa} transparent opacity={arquitecto ? 0.95 : 0.5} roughness={0.6} />
      </mesh>
      <Interior piso={piso} />
    </group>
  );
}

function VolumenVidrio({ volumen, seleccionadoId, esRaiz, distanciaBase, tema, arquitecto, onSeleccionar, onEntrar, onHover }: { volumen: Volumen; seleccionadoId: string | null; esRaiz: boolean; distanciaBase: number; tema: Tema; arquitecto: boolean; onSeleccionar: (n: NodoEdificio) => void; onEntrar: (n: NodoEdificio) => void; onHover: (id: string | null) => void }) {
  const [encima, setEncima] = useState(false);
  const color = COLOR_GRUPO[volumen.nodo.grupo];
  const seleccionado = seleccionadoId === volumen.id;
  const casco = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const parentesFrente = useRef<THREE.MeshBasicMaterial>(null);
  const parentesLado = useRef<THREE.MeshBasicMaterial>(null);
  const puerta = useRef<THREE.MeshBasicMaterial>(null);
  const rotulo = useRef<THREE.MeshBasicMaterial>(null);
  const resaltado = seleccionado ? 0.1 : encima ? 0.05 : 0;
  const lineasRotulo = useMemo(() => [volumen.nodo.nombre.toUpperCase()], [volumen.nodo.nombre]);

  // Fachada ↔ interior: según qué tan cerca está la cámara, el vidrio, los parteluces y el rótulo se desvanecen.
  useFrame((estado) => {
    const orbit = estado.controls as unknown as { target: THREE.Vector3 } | null;
    if (!orbit) return;
    const distancia = estado.camera.position.distanceTo(orbit.target) / factorAncho(estado.size.width, estado.size.height);
    const { interior, fachada } = esRaiz ? UMBRALES.raiz : UMBRALES.dentro;
    // En la vista de arquitecto el edificio siempre está "cortado": sin fachada, todos los pisos a la vista.
    const t = arquitecto ? 0 : Math.min(1, Math.max(0, (distancia / distanciaBase - interior) / (fachada - interior)));
    if (casco.current) casco.current.opacity = (arquitecto ? 0.02 : 0.04) + 0.3 * t + resaltado;
    if (halo.current) halo.current.opacity = arquitecto ? 0 : 0.1 + 0.12 * t + resaltado;
    if (parentesFrente.current) parentesFrente.current.opacity = 0.7 * t;
    if (parentesLado.current) parentesLado.current.opacity = 0.7 * t;
    if (puerta.current) puerta.current.opacity = 0.9 * t;
    if (rotulo.current) rotulo.current.opacity = 0.95 * t;
  });

  return (
    <group>
      {/* Luz cálida adentro, del color del grupo (como la vidriera iluminada de un local). */}
      {!arquitecto && <pointLight position={[volumen.x, volumen.y + volumen.alto * 0.55, 0]} intensity={esRaiz ? 14 : 18} distance={9} color={color} />}

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
        <meshStandardMaterial ref={casco} color={color} transparent opacity={0.3} roughness={0.05} metalness={0.25} depthWrite={false} />
        <Edges color={color} />
      </mesh>

      {/* Resplandor de neón del borde. */}
      <mesh position={[volumen.x, volumen.y + volumen.alto / 2, 0]} scale={[1.035, 1.02, 1.035]}>
        <boxGeometry args={[volumen.ancho, volumen.alto, volumen.profundidad]} />
        <meshBasicMaterial ref={halo} color={color} transparent opacity={0.16} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Base y techo del edificio. */}
      <mesh position={[volumen.x, volumen.y - 0.1, 0]}>
        <boxGeometry args={[volumen.ancho + 0.5, 0.2, volumen.profundidad + 0.5]} />
        <meshStandardMaterial color={tema.base} roughness={0.8} />
      </mesh>
      <mesh position={[volumen.x, volumen.y + volumen.alto + 0.05, 0]}>
        <boxGeometry args={[volumen.ancho + 0.2, 0.1, volumen.profundidad + 0.2]} />
        <meshStandardMaterial color={tema.techo} transparent opacity={arquitecto ? 0.35 : 0.55} roughness={0.5} />
      </mesh>

      <Parteluces volumen={volumen} material={parentesFrente} lado="frente" />
      <Parteluces volumen={volumen} material={parentesLado} lado="lateral" />

      {/* El nombre del grupo "pintado" en el vidrio de la vidriera. */}
      {esRaiz && volumen.alto > 1.2 && (
        <Letrero lineas={lineasRotulo} brillo={color} ancho={volumen.ancho * 0.86} alto={Math.min(1.1, volumen.alto * 0.4)} posicion={[volumen.x, volumen.y + volumen.alto * 0.72, volumen.profundidad / 2 + 0.05]} material={rotulo} />
      )}

      {volumen.y === 0 && (
        <mesh position={[volumen.x, 0.5, volumen.profundidad / 2 + 0.03]}>
          <boxGeometry args={[0.8, 1, 0.03]} />
          <meshBasicMaterial ref={puerta} color="#fff2c9" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}

      {volumen.pisos.map((piso) => (
        <PisoCaja key={piso.id} piso={piso} volumen={volumen} seleccionado={seleccionadoId === piso.id} tema={tema} arquitecto={arquitecto} onSeleccionar={onSeleccionar} onEntrar={onEntrar} onHover={onHover} interactivo={!esRaiz} />
      ))}
    </group>
  );
}

// Sombras solo en la vista de arquitecto (cuestan en teléfonos): los objetos y las losas las proyectan; el vidrio no.
function Sombras({ activas, cambio }: { activas: boolean; cambio: string }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    gl.shadowMap.enabled = activas;
    gl.shadowMap.type = THREE.PCFShadowMap;
    scene.traverse((o) => {
      const malla = o as THREE.Mesh;
      if (!malla.isMesh) return;
      const material = malla.material as THREE.Material;
      // Ni el vidrio ni las ventanas / puerta (materiales sin luz) proyectan sombra.
      const vidrio = material.transparent && material.opacity < 0.6;
      const sinLuz = (material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial;
      malla.castShadow = activas && !vidrio && !sinLuz && !(malla as THREE.InstancedMesh).isInstancedMesh;
      malla.receiveShadow = activas;
      material.needsUpdate = true;
    });
  }, [activas, cambio, gl, scene]);

  return null;
}

// Al entrar en otro nivel o cambiar de período el edificio aparece escalando desde abajo: se siente que
// se mete en él (nivel) o que crece / se achica a su nueva medida (período).
function GrupoAnimado({ clave, movimientoReducido, children }: { clave: string; movimientoReducido: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    if (ref.current) ref.current.scale.set(movimientoReducido ? 1 : 0.9, movimientoReducido ? 1 : 0.55, movimientoReducido ? 1 : 0.9);
  }, [clave, movimientoReducido]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const k = 1 - Math.pow(0.001, delta);
    ref.current.scale.x += (1 - ref.current.scale.x) * k;
    ref.current.scale.y += (1 - ref.current.scale.y) * k;
    ref.current.scale.z += (1 - ref.current.scale.z) * k;
  });

  return <group ref={ref}>{children}</group>;
}

type Etiqueta = { id: string; x: number; y: number; z: number; titulo: string; saldo: number; color: string; fija: boolean; seleccionada: boolean; alAlado: boolean };

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
      const px = (punto.current.x * 0.5 + 0.5) * size.width;
      const py = (-punto.current.y * 0.5 + 0.5) * size.height;
      if (e.alAlado) {
        // Al costado izquierdo del edificio (sin tapar el objeto), sin salirse de la pantalla.
        const izquierda = Math.min(Math.max(4, px - nodo.offsetWidth - 10), Math.max(4, size.width - nodo.offsetWidth - 4));
        nodo.style.transform = `translate(${izquierda}px, ${py}px) translate(0, -50%)`;
      } else {
        nodo.style.transform = `translate(-50%, -50%) translate(${px}px, ${py}px)`;
      }
    }
  });

  return null;
}

// Cielo del atardecer (degradé), como en las imágenes de referencia. Solo en la apariencia oscura.
function Cielo({ activo }: { activo: boolean }) {
  const { scene } = useThree();

  useEffect(() => {
    if (!activo) return;
    const lienzo = document.createElement('canvas');
    lienzo.width = 4;
    lienzo.height = 256;
    const g = lienzo.getContext('2d')!;
    const degrade = g.createLinearGradient(0, 0, 0, 256);
    degrade.addColorStop(0, '#0a1226');
    degrade.addColorStop(0.55, '#1b2c55');
    degrade.addColorStop(0.85, '#5b4a78');
    degrade.addColorStop(1, '#c27d5a');
    g.fillStyle = degrade;
    g.fillRect(0, 0, 4, 256);
    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace;
    const anterior = scene.background;
    scene.background = textura;
    return () => {
      scene.background = anterior;
      textura.dispose();
    };
  }, [activo, scene]);

  return null;
}

// Entorno del local: vereda, calle, macetas y faroles con luz cálida. Solo en la vista de empresa y apariencia oscura.
function Escenario({ volumenes }: { volumenes: Volumen[] }) {
  const frente = Math.max(...volumenes.map((v) => v.profundidad / 2)) + 0.25;
  const x0 = Math.min(...volumenes.map((v) => v.x - v.ancho / 2));
  const x1 = Math.max(...volumenes.map((v) => v.x + v.ancho / 2));
  const macetas: Array<[number, number]> = [[x0 - 0.9, frente + 0.5], [x1 + 0.9, frente + 0.5], [(x0 + x1) / 2, frente + 0.7]];
  const faroles: Array<[number, number]> = [[x0 - 1.8, frente + 2.4], [x1 + 1.8, frente + 2.4]];

  return (
    <group>
      <mesh position={[(x0 + x1) / 2, -0.12, frente + 1.6]}>
        <boxGeometry args={[x1 - x0 + 7, 0.1, 3.6]} />
        <meshStandardMaterial color="#3b4660" roughness={0.9} />
      </mesh>
      <mesh position={[(x0 + x1) / 2, -0.2, frente + 5.2]}>
        <boxGeometry args={[x1 - x0 + 22, 0.06, 3.8]} />
        <meshStandardMaterial color="#0e1424" roughness={1} />
      </mesh>
      {macetas.map(([x, z], i) => (
        <group key={i} position={[x, -0.07, z]}>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.28, 0.2, 0.45, 12]} />
            <meshStandardMaterial color="#5b3a29" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.42, 12, 10]} />
            <meshStandardMaterial color="#2f9e5b" emissive="#145a32" emissiveIntensity={0.35} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {faroles.map(([x, z], i) => (
        <group key={i} position={[x, -0.07, z]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 3, 8]} />
            <meshStandardMaterial color="#1c2437" />
          </mesh>
          <mesh position={[0, 3.05, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshBasicMaterial color="#ffd89a" toneMapped={false} />
          </mesh>
          <pointLight position={[0, 3, 0.2]} intensity={10} distance={9} color="#ffcf8a" />
        </group>
      ))}
    </group>
  );
}

// Cartel de la empresa sobre el edificio (como el letrero "CAFETERIA" de la imagen de referencia).
function CartelEmpresa({ volumenes, nombre }: { volumenes: Volumen[]; nombre: string }) {
  const base = volumenes[0];
  const lineas = useMemo(() => [nombre.toUpperCase()], [nombre]);
  const ancho = Math.min(base.ancho + 1.2, 6);
  const y = base.y + base.alto + 0.95;
  const z = base.profundidad / 2 - 0.2;

  return (
    <group>
      <mesh position={[base.x, y, z]}>
        <boxGeometry args={[ancho, 0.95, 0.16]} />
        <meshStandardMaterial color="#141b2d" roughness={0.6} metalness={0.3} />
        <Edges color="#8aa4d6" />
      </mesh>
      <Letrero lineas={lineas} brillo="#9ec5ff" ancho={ancho - 0.3} alto={0.7} posicion={[base.x, y, z + 0.09]} />
    </group>
  );
}

export default function Escena({ volumenes, focoId, periodoClave, seleccionadoId, onSeleccionar, onEntrar, formatear, movimientoReducido, vistaArquitecto, nombreEmpresa }: Props) {
  const tema = TEMAS[vistaArquitecto ? 'arquitecto' : 'oscuro'];
  const esRaiz = focoId === 'empresa';
  const { centro, distancia } = useMemo(() => centroDe(volumenes, seleccionadoId), [volumenes, seleccionadoId]);
  const distanciaBase = useMemo(() => centroDe(volumenes, null).distancia, [volumenes]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const etiquetas = useMemo<Etiqueta[]>(
    () =>
      volumenes.flatMap((v): Etiqueta[] => {
        if (esRaiz) {
          return [{ id: v.id, x: v.x, y: v.y + v.alto / 2, z: v.profundidad / 2 + 0.05, titulo: v.nodo.nombre, saldo: v.nodo.saldo, color: COLOR_GRUPO[v.nodo.grupo], fija: true, seleccionada: seleccionadoId === v.id, alAlado: false }];
        }
        return v.pisos.map((p) => ({
          id: p.id,
          x: v.x - v.ancho / 2,
          y: v.y + p.y,
          z: v.profundidad / 2 + 0.05,
          titulo: p.nodo.nombre,
          saldo: p.nodo.saldo,
          color: COLOR_GRUPO[p.nodo.grupo],
          // Todos los pisos tienen alto mínimo: el nombre y el saldo (aunque sea 0) siempre se leen.
          fija: true,
          seleccionada: seleccionadoId === p.id,
          alAlado: true,
        }));
      }),
    [volumenes, esRaiz, seleccionadoId]
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [9, 7, 14], fov: 42 }} style={{ touchAction: 'none' }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={[tema.fondo]} />
        <Cielo activo={!vistaArquitecto} />
        <fog attach="fog" args={[vistaArquitecto ? tema.fondo : '#1a2547', 30, 80]} />
        <ambientLight intensity={tema.luzAmbiente} />
        <directionalLight position={[8, 14, 10]} intensity={vistaArquitecto ? 1.6 : 1.4} castShadow={vistaArquitecto} shadow-mapSize={[1536, 1536]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-bias={-0.0005} />
        <pointLight position={[-9, 5, -6]} intensity={0.9} color="#6aa7ff" />
        <pointLight position={[0, 4, 6]} intensity={0.6} color="#ffe2a3" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
          <circleGeometry args={[18, 64]} />
          <meshStandardMaterial color={tema.suelo} roughness={0.9} />
        </mesh>
        {!(esRaiz && !vistaArquitecto) && <gridHelper key={tema.fondo} args={[36, 36, tema.grilla[0], tema.grilla[1]]} position={[0, -0.21, 0]} />}
        <Sombras activas={vistaArquitecto} cambio={`${focoId}|${periodoClave}|${volumenes.length}`} />

        {esRaiz && !vistaArquitecto && <Escenario volumenes={volumenes} />}

        <GrupoAnimado clave={`${focoId}|${periodoClave}`} movimientoReducido={movimientoReducido}>
          {esRaiz && !vistaArquitecto && nombreEmpresa && <CartelEmpresa volumenes={volumenes} nombre={nombreEmpresa} />}
          {volumenes.map((v) => (
            <VolumenVidrio key={v.id} volumen={v} seleccionadoId={seleccionadoId} esRaiz={esRaiz} distanciaBase={distanciaBase} tema={tema} arquitecto={vistaArquitecto} onSeleccionar={onSeleccionar} onEntrar={onEntrar} onHover={setHoverId} />
          ))}
        </GrupoAnimado>

        <OrbitControls makeDefault enablePan={false} minDistance={4} maxDistance={48} minPolarAngle={0.25} maxPolarAngle={Math.PI / 2 - 0.05} enableDamping dampingFactor={0.08} />
        <CamaraGuiada objetivo={centro} distancia={distancia} focoId={focoId} movimientoReducido={movimientoReducido} vistaArquitecto={vistaArquitecto} />
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
                background: esRaiz ? e.color : tema.etiquetaFondo,
                borderRadius: esRaiz ? 999 : 8,
                padding: esRaiz ? '4px 12px' : '3px 8px',
                border: e.seleccionada ? `1px solid ${e.color}` : `1px solid ${tema.etiquetaBorde}`,
                fontWeight: esRaiz ? 800 : 400,
                color: esRaiz ? '#fff' : tema.etiquetaTexto,
                maxWidth: esRaiz ? undefined : '46%',
                lineHeight: 1.25,
                textAlign: esRaiz ? 'center' : 'right',
              }}
            >
              <b style={{ display: esRaiz ? 'inline' : 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.titulo}</b>
              <span style={{ opacity: 0.9, marginLeft: esRaiz ? 6 : 0, display: esRaiz ? 'inline' : 'block', color: e.saldo < 0 ? '#dc2626' : esRaiz ? '#fff' : tema.etiquetaTexto }}>{formatear(e.saldo)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
