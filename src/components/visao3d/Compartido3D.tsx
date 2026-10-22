'use client';

// Piezas 3D compartidas por las escenas de Visão 3D (edificio y casa): cámara guiada, letreros con texto, cielo del
// atardecer, sombras, animación de entrada, proyección de etiquetas y texturas procedurales (canvas 2D).

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function factorAncho(ancho: number, alto: number): number {
  return Math.min(1.9, Math.max(1, 1.1 / (ancho / Math.max(alto, 1))));
}

// Lleva la cámara hacia el área elegida (zoom) y, al entrar en un nodo, arranca más lejos y más abajo y "sube"
// (efecto ascensor). Solo guía mientras dura el movimiento: apenas la persona toca la escena (arrastrar,
// rueda, pellizco) se suelta el control, para que el zoom y el giro manuales no se pisen cada cuadro.
export function CamaraGuiada({ objetivo, distancia, focoId, movimientoReducido }: { objetivo: THREE.Vector3; distancia: number; focoId: string; movimientoReducido: boolean }) {
  const { camera, controls, size } = useThree();
  const guiando = useRef(true);
  // En pantallas angostas (teléfono vertical) el edificio no entra a la misma distancia: se aleja.
  const distanciaMeta = distancia * factorAncho(size.width, size.height);
  const distanciaActual = useRef(distanciaMeta * 1.7);

  useEffect(() => {
    distanciaActual.current = movimientoReducido ? distanciaMeta : distanciaMeta * 1.7;
    const orbit = controls as unknown as { target: THREE.Vector3 } | null;
    if (orbit && !movimientoReducido) orbit.target.y -= 3;
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

// Texto sobre una superficie (letreros, nombre del grupo sobre el vidrio): se dibuja en un canvas 2D, así no hace
// falta cargar fuentes ni modelos.
export function crearTexturaTexto(lineas: string[], brillo: string, ancho: number, alto: number, fondo?: string): THREE.CanvasTexture {
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

export function Letrero({ lineas, brillo, ancho, alto, posicion, fondo, material }: { lineas: string[]; brillo: string; ancho: number; alto: number; posicion: [number, number, number]; fondo?: string; material?: React.RefObject<THREE.MeshBasicMaterial | null> }) {
  const textura = useMemo(() => crearTexturaTexto(lineas, brillo, 1024, Math.round((1024 * alto) / ancho), fondo), [lineas, brillo, alto, ancho, fondo]);
  useEffect(() => () => textura.dispose(), [textura]);

  return (
    <mesh position={posicion}>
      <planeGeometry args={[ancho, alto]} />
      <meshBasicMaterial ref={material} map={textura} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// Sombras proyectadas de verdad solo en equipos con mouse (cuestan en teléfonos; ahí quedan las sombras de contacto): los objetos y las losas las proyectan; el vidrio no.
export function Sombras({ activas, cambio }: { activas: boolean; cambio: string }) {
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
export function GrupoAnimado({ clave, movimientoReducido, children }: { clave: string; movimientoReducido: boolean; children: React.ReactNode }) {
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

export type Etiqueta = { id: string; x: number; y: number; z: number; titulo: string; saldo: number; color: string; fija: boolean; seleccionada: boolean; alAlado: boolean };

// Las etiquetas son DOM común (no objetos de la escena): se reubican cada cuadro proyectando su punto 3D a la pantalla.
export function Proyector({ etiquetas, refs }: { etiquetas: Etiqueta[]; refs: React.MutableRefObject<Record<string, HTMLDivElement | null>> }) {
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

// Texturas procedurales del entorno (canvas 2D): asfalto con la línea de la calle y vereda embaldosada.
export function texturaProcedural(tipo: 'asfalto' | 'vereda' | 'madera' | 'concreto' | 'pasto' | 'agua', repeticiones: number): THREE.CanvasTexture {
  const lado = 256;
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const g = lienzo.getContext('2d')!;
  if (tipo === 'asfalto') {
    g.fillStyle = '#161b27';
    g.fillRect(0, 0, lado, lado);
    for (let i = 0; i < 2200; i++) {
      const gris = 28 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgb(${gris},${gris},${gris + 6})`;
      g.fillRect(Math.random() * lado, Math.random() * lado, 1.6, 1.6);
    }
    g.fillStyle = 'rgba(235,235,225,0.85)';
    g.fillRect(0, lado / 2 - 3, lado * 0.55, 6);
  } else if (tipo === 'madera') {
    g.fillStyle = '#b98a5b';
    g.fillRect(0, 0, lado, lado);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(${90 + Math.random() * 40},${55 + Math.random() * 25},30,0.18)`;
      g.fillRect(0, (i * lado) / 8, lado, lado / 8 - 2);
      g.fillStyle = 'rgba(60,35,20,0.55)';
      g.fillRect(0, (i * lado) / 8, lado, 2);
      for (let k = 0; k < 14; k++) {
        g.fillStyle = `rgba(70,40,20,${0.05 + Math.random() * 0.08})`;
        g.fillRect(Math.random() * lado, (i * lado) / 8 + Math.random() * (lado / 8), 30 + Math.random() * 60, 1);
      }
    }
  } else if (tipo === 'concreto') {
    g.fillStyle = '#8a90a0';
    g.fillRect(0, 0, lado, lado);
    for (let i = 0; i < 1800; i++) {
      const gris = 120 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgba(${gris},${gris},${gris + 6},0.5)`;
      g.fillRect(Math.random() * lado, Math.random() * lado, 2, 2);
    }
    g.strokeStyle = 'rgba(40,45,60,0.5)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, lado - 2, lado - 2);
  } else if (tipo === 'pasto') {
    g.fillStyle = '#245a34';
    g.fillRect(0, 0, lado, lado);
    for (let i = 0; i < 3500; i++) {
      g.fillStyle = `rgba(${30 + Math.random() * 40},${90 + Math.random() * 70},${40 + Math.random() * 30},0.6)`;
      g.fillRect(Math.random() * lado, Math.random() * lado, 1.5, 3);
    }
  } else if (tipo === 'agua') {
    const degrade = g.createLinearGradient(0, 0, lado, lado);
    degrade.addColorStop(0, '#2a8fd6');
    degrade.addColorStop(1, '#52c3e8');
    g.fillStyle = degrade;
    g.fillRect(0, 0, lado, lado);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo(0, (i * lado) / 9 + 6);
      g.bezierCurveTo(lado * 0.3, (i * lado) / 9 - 8, lado * 0.6, (i * lado) / 9 + 18, lado, (i * lado) / 9 + 4);
      g.stroke();
    }
  } else {
    g.fillStyle = '#4a556e';
    g.fillRect(0, 0, lado, lado);
    g.strokeStyle = 'rgba(15,20,35,0.55)';
    g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      g.beginPath();
      g.moveTo((i * lado) / 2, 0);
      g.lineTo((i * lado) / 2, lado);
      g.moveTo(0, (i * lado) / 2);
      g.lineTo(lado, (i * lado) / 2);
      g.stroke();
    }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      g.fillRect(Math.random() * lado, Math.random() * lado, 2, 2);
    }
  }
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.repeat.set(repeticiones, tipo === 'asfalto' ? 1 : Math.max(1, repeticiones / 3));
  textura.anisotropy = 4;
  return textura;
}

// Cielo del atardecer (degradé), como en las imágenes de referencia. Solo en la apariencia oscura.
export function Cielo({ activo }: { activo: boolean }) {
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

