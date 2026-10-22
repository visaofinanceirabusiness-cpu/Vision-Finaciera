'use client';

// Un objeto del catálogo en la escena: si hay un GLB declarado se carga con useGLTF (con el procedural visible mientras
// llega y si falla); si no, se muestra directamente el procedural. El estado de la cuenta (cero → apagado, negativo → rojo)
// se aplica también a los materiales del modelo para que siga leyéndose igual.

import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { leerCalidad, type Calidad } from '@/lib/visao3dCalidad';
import { Fundido } from '../Compartido3D';
import { CATALOGO_BASE, fusionarCatalogo, rutaModelo, type ConfigCatalogo, type EntradaCatalogo } from './catalogo';

const RUTA_CONFIG = '/visao3d/catalogo.json';

let promesaConfig: Promise<ConfigCatalogo | null> | null = null;
function cargarConfig(): Promise<ConfigCatalogo | null> {
  promesaConfig ??= fetch(RUTA_CONFIG, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<ConfigCatalogo>) : null))
    .catch(() => null);
  return promesaConfig;
}

// Configuración del catálogo (archivo JSON opcional en public/visao3d/). Mientras llega, o si no existe, rige el catálogo base.
export function useConfigCatalogo(): ConfigCatalogo | null {
  const [config, setConfig] = useState<ConfigCatalogo | null>(null);
  useEffect(() => {
    let vivo = true;
    void cargarConfig().then((c) => vivo && setConfig(c));
    return () => {
      vivo = false;
    };
  }, []);
  return config;
}

export type EstadoObjeto = { apagado: boolean; negativo?: boolean; brillo?: number };

class Limite extends Component<{ alFallar: ReactNode; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    return this.state.fallo ? this.props.alFallar : this.props.children;
  }
}

function Modelo({ url, entrada, estado }: { url: string; entrada: EntradaCatalogo; estado: EstadoObjeto }) {
  const gltf = useGLTF(url, Boolean(entrada.draco));
  const escena = useMemo(() => {
    const copia = clone(gltf.scene);
    // Cada instancia con materiales propios, para poder apagarla o teñirla sin afectar a las demás.
    copia.traverse((o) => {
      const malla = o as THREE.Mesh;
      if (!malla.isMesh) return;
      malla.material = Array.isArray(malla.material) ? malla.material.map((m) => m.clone()) : malla.material.clone();
      malla.castShadow = true;
      malla.receiveShadow = true;
    });
    return copia;
  }, [gltf]);

  useEffect(() => {
    escena.traverse((o) => {
      const malla = o as THREE.Mesh;
      if (!malla.isMesh) return;
      (Array.isArray(malla.material) ? malla.material : [malla.material]).forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial;
        if (!mat.color) return;
        const original = (mat.userData.colorOriginal ??= mat.color.clone()) as THREE.Color;
        mat.color.copy(original);
        if (estado.apagado) {
          const hsl = { h: 0, s: 0, l: 0 };
          original.getHSL(hsl);
          mat.color.setHSL(hsl.h, hsl.s * 0.06, 0.38 + hsl.l * 0.35);
        } else if (estado.negativo) {
          mat.color.lerp(new THREE.Color('#d64545'), 0.35);
        }
        if ('emissive' in mat) {
          mat.emissive = estado.brillo && estado.brillo > 1 ? mat.color.clone() : new THREE.Color(0, 0, 0);
          mat.emissiveIntensity = estado.brillo && estado.brillo > 1 ? 0.08 * estado.brillo : 0;
        }
      });
    });
  }, [escena, estado.apagado, estado.negativo, estado.brillo]);

  return <primitive object={escena} position={entrada.pos} rotation={entrada.rot} scale={entrada.escala ?? 1} />;
}

// `procedural` se funde en pocas mallas (Fundido) y se rearma cuando cambia `claveFundido`; el GLB, en cambio, va suelto.
export function ObjetoCatalogo({ id, estado, procedural, claveFundido, sinFundir = false, calidad: calidadForzada }: { id: string; estado: EstadoObjeto; procedural: ReactNode; claveFundido: string; sinFundir?: boolean; calidad?: Calidad }) {
  const config = useConfigCatalogo();
  const calidad = useMemo(() => calidadForzada ?? leerCalidad().calidad, [calidadForzada]);
  const entrada = useMemo(() => fusionarCatalogo(CATALOGO_BASE, config).get(id), [config, id]);
  const url = rutaModelo(entrada, calidad);

  const proc = sinFundir ? <>{procedural}</> : <Fundido key={claveFundido}>{procedural}</Fundido>;
  if (!entrada || !url) return proc;
  return (
    <Limite alFallar={proc} key={url}>
      <Suspense fallback={proc}>
        <Modelo url={url} entrada={entrada} estado={estado} />
      </Suspense>
    </Limite>
  );
}
