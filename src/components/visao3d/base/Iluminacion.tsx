'use client';

// Iluminación de la escena de la casa: ambiente, hemisferio, sol y entorno de reflejos. El entorno es un HDRI (Poly Haven u otro,
// declarado por hora en public/visao3d/catalogo.json) o, sin HDRI, un set de pantallas de estudio generado en código.
// Con `sombras` el sol proyecta sombras suaves (PCSS de drei): solo en equipos no táctiles de calidad alta.

import { Component, Suspense, type ReactNode } from 'react';
import { Environment, Lightformer, SoftShadows } from '@react-three/drei';

type Config = { ambiente: number; hemisferio: [string, string, number]; sol: [string, number]; formas: [number, number, number] };

function Estudio({ formas }: { formas: [number, number, number] }) {
  return (
    <Environment frames={1} resolution={256} background={false}>
      <Lightformer form="rect" intensity={formas[0]} color="#ffd2a0" position={[-8, 5, 9]} scale={[12, 5, 1]} />
      <Lightformer form="rect" intensity={formas[1]} color="#8fb4ff" position={[10, 6, -5]} scale={[10, 5, 1]} />
      <Lightformer form="ring" intensity={formas[2]} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={8} />
    </Environment>
  );
}

class Limite extends Component<{ alFallar: ReactNode; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    return this.state.fallo ? this.props.alFallar : this.props.children;
  }
}

export function Iluminacion({ cfg, hora, sombras, hdri }: { cfg: Config; hora: string; sombras: boolean; hdri?: string }) {
  const estudio = <Estudio key={`e${hora}`} formas={cfg.formas} />;
  return (
    <>
      <ambientLight intensity={cfg.ambiente} />
      <hemisphereLight args={cfg.hemisferio} />
      <directionalLight
        position={[10, 16, 14]}
        color={cfg.sol[0]}
        intensity={cfg.sol[1]}
        castShadow={sombras}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      {sombras && <SoftShadows size={14} samples={10} focus={0.5} />}
      {hdri ? (
        <Limite alFallar={estudio} key={hdri}>
          <Suspense fallback={estudio}>
            <Environment files={hdri} background={false} />
          </Suspense>
        </Limite>
      ) : (
        estudio
      )}
    </>
  );
}
