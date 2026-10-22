'use client';

// "Sabio": la lechuza mascota de Visão Financeira da la bienvenida junto al camino de entrada de la casa (modelo Familia).
// Todo procedural: cuerpo, cabeza con anteojos redondos, saco azul con el logo, libro con el lema y un dedo en alto.
// Tres <Fundido> (cuerpo, cabeza y brazo en alto) para que se mueva con muy pocas llamadas de dibujo.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Fundido, Letrero } from './Compartido3D';

type V3 = [number, number, number];

const MARRON = '#7a4326';
const MARRON_OSCURO = '#5b3119';
const CREMA = '#f1dfba';
const AZUL = '#1b2f6b';
const AZUL_OSCURO = '#142556';
const NARANJA = '#e8892a';

function Elipsoide({ p, s, color, rough = 0.85, rot }: { p: V3; s: V3; color: string; rough?: number; rot?: V3 }) {
  return (
    <mesh position={p} scale={s} rotation={rot}>
      <sphereGeometry args={[1, 18, 14]} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

function Cono({ p, r, h, color, rot }: { p: V3; r: number; h: number; color: string; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot}>
      <coneGeometry args={[r, h, 10]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Caja({ p, s, color, rot, rough = 0.8 }: { p: V3; s: V3; color: string; rot?: V3; rough?: number }) {
  return (
    <mesh position={p} rotation={rot}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

// Logo de Visão Financeira: dos tildes y la flecha verde que sube.
function texturaLogo(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 11;
  [[14, 0], [46, 0]].forEach(([dx]) => {
    g.beginPath();
    g.moveTo(dx + 6, 58);
    g.lineTo(dx + 22, 98);
    g.lineTo(dx + 46, 30);
    g.stroke();
  });
  g.strokeStyle = '#2fa84f';
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(24, 92);
  g.lineTo(52, 62);
  g.lineTo(66, 76);
  g.lineTo(104, 24);
  g.stroke();
  g.fillStyle = '#2fa84f';
  g.beginPath();
  g.moveTo(112, 14);
  g.lineTo(88, 22);
  g.lineTo(106, 40);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Tapa del libro: el lema en tres líneas, "CRECER." en verde, y el logo abajo.
function texturaLibro(logo: THREE.Texture): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const g = c.getContext('2d')!;
  g.fillStyle = AZUL;
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillRect(0, 0, 14, 320);
  g.textAlign = 'center';
  g.font = '700 27px system-ui, sans-serif';
  g.fillStyle = '#ffffff';
  ['CLARIDAD', 'PARA DECIDIR,', 'SEGURIDAD'].forEach((t, i) => g.fillText(t, 134, 70 + i * 36));
  g.fillText('PARA ', 96, 180);
  g.fillStyle = '#35c25f';
  g.fillText('CRECER.', 178, 180);
  g.drawImage(logo.image as CanvasImageSource, 88, 208, 80, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function Sabio({ p, esc = 1, esPT = false, rot = 0 }: { p: V3; esc?: number; esPT?: boolean; rot?: number }) {
  const cuerpo = useRef<THREE.Group>(null);
  const cabeza = useRef<THREE.Group>(null);
  const brazo = useRef<THREE.Group>(null);
  const cartel = useRef<THREE.Group>(null);
  const logo = useMemo(() => (typeof document === 'undefined' ? null : texturaLogo()), []);
  const libro = useMemo(() => (logo ? texturaLibro(logo) : null), [logo]);
  const reducido = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useEffect(() => () => { logo?.dispose(); libro?.dispose(); }, [logo, libro]);

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    if (cartel.current) cartel.current.rotation.y = Math.atan2(camera.position.x - p[0], camera.position.z - p[2]) - rot;
    if (reducido) return;
    if (cuerpo.current) cuerpo.current.position.y = Math.sin(t * 1.6) * 0.012;
    if (cabeza.current) {
      cabeza.current.rotation.y = Math.sin(t * 0.7) * 0.22;
      cabeza.current.rotation.z = Math.sin(t * 0.5 + 1) * 0.05;
    }
    if (brazo.current) brazo.current.rotation.z = -0.35 + Math.sin(t * 2.2) * 0.1;
  });

  if (!logo || !libro) return null;
  const ojos = [-1, 1] as const;

  return (
    <group position={p} scale={esc} rotation={[0, rot, 0]}>
      <group ref={cuerpo}>
        <Fundido>
          {/* Patas y garras. */}
          {ojos.map((l) => (
            <group key={`pie${l}`}>
              <Elipsoide p={[l * 0.2, 0.05, 0.14]} s={[0.17, 0.06, 0.2]} color={NARANJA} />
              {[-1, 0, 1].map((k) => (
                <group key={k}>
                  <Elipsoide p={[l * 0.2 + k * 0.09, 0.04, 0.32]} s={[0.045, 0.04, 0.09]} color={NARANJA} />
                  <Cono p={[l * 0.2 + k * 0.09, 0.035, 0.41]} r={0.018} h={0.06} color={MARRON_OSCURO} rot={[Math.PI / 2, 0, 0]} />
                </group>
              ))}
            </group>
          ))}
          {/* Cuerpo emplumado, panza clara y cola. */}
          <Elipsoide p={[0, 0.78, 0]} s={[0.52, 0.6, 0.46]} color={MARRON} />
          <Elipsoide p={[0, 0.78, 0.2]} s={[0.4, 0.5, 0.3]} color={CREMA} />
          <Elipsoide p={[0, 0.35, -0.28]} s={[0.22, 0.1, 0.3]} color={MARRON_OSCURO} rot={[0.5, 0, 0]} />
          {[0.58, 0.72, 0.86].map((y, i) => [-1, 0, 1].map((k) => (
            <Elipsoide key={`${i}${k}`} p={[k * 0.14 + (i % 2) * 0.07 - 0.035, y, 0.46]} s={[0.07, 0.05, 0.025]} color="#e4cf9f" />
          )))}
          {/* Saco azul: cuerpo, solapas, camisa, botón y bolsillo. */}
          <Elipsoide p={[0, 0.66, 0.02]} s={[0.56, 0.4, 0.5]} color={AZUL} />
          <Caja p={[-0.17, 0.92, 0.49]} s={[0.16, 0.42, 0.03]} color={AZUL_OSCURO} rot={[0, 0, 0.42]} />
          <Caja p={[0.17, 0.92, 0.49]} s={[0.16, 0.42, 0.03]} color={AZUL_OSCURO} rot={[0, 0, -0.42]} />
          <Caja p={[0, 0.97, 0.47]} s={[0.2, 0.32, 0.02]} color="#f6ecd6" rot={[0, 0, 0]} />
          <Elipsoide p={[0.02, 0.5, 0.52]} s={[0.03, 0.03, 0.02]} color="#111111" />
          <Caja p={[0.24, 0.5, 0.5]} s={[0.17, 0.05, 0.025]} color={AZUL_OSCURO} rot={[0, 0, 0.1]} />
        </Fundido>
        {/* Logo en el pecho del saco. */}
        <mesh position={[0.22, 0.74, 0.512]} rotation={[0, 0.1, 0]}>
          <planeGeometry args={[0.17, 0.17]} />
          <meshBasicMaterial map={logo} transparent toneMapped={false} />
        </mesh>

        {/* Brazo que sostiene el libro. */}
        <Fundido>
          <Elipsoide p={[-0.55, 0.68, 0.12]} s={[0.15, 0.3, 0.15]} color={AZUL} rot={[0, 0, 0.35]} />
          <Elipsoide p={[-0.5, 0.45, 0.32]} s={[0.13, 0.12, 0.13]} color={MARRON} />
          {[-0.05, 0.03, 0.1].map((d, i) => <Elipsoide key={i} p={[-0.43 + d * 0.3, 0.42 + d, 0.42]} s={[0.04, 0.045, 0.05]} color={MARRON} />)}
          {/* Libro: tapa azul, canto de hojas y lomo. */}
          <group position={[-0.3, 0.62, 0.5]} rotation={[0, 0.55, -0.1]}>
            <Caja p={[0, 0, 0]} s={[0.4, 0.5, 0.08]} color={AZUL} rough={0.6} />
            <Caja p={[0.21, 0, 0]} s={[0.025, 0.47, 0.07]} color="#f3e8cc" />
            <Caja p={[-0.2, 0, 0]} s={[0.02, 0.5, 0.09]} color={AZUL_OSCURO} />
          </group>
        </Fundido>
        <mesh position={[-0.3 + Math.sin(0.55) * 0.045, 0.62, 0.5 + Math.cos(0.55) * 0.045]} rotation={[0, 0.55, -0.1]}>
          <planeGeometry args={[0.38, 0.48]} />
          <meshStandardMaterial map={libro} roughness={0.6} />
        </mesh>

        {/* Brazo en alto con el dedo índice señalando. */}
        <group ref={brazo} position={[0.5, 0.95, 0.12]} rotation={[0, 0, -0.35]}>
          <Fundido>
            <Elipsoide p={[0.12, 0.14, 0]} s={[0.15, 0.3, 0.15]} color={AZUL} rot={[0, 0, -0.35]} />
            <Elipsoide p={[0.22, 0.42, 0]} s={[0.15, 0.14, 0.14]} color={MARRON} />
            <mesh position={[0.2, 0.64, 0]}>
              <capsuleGeometry args={[0.045, 0.18, 4, 8]} />
              <meshStandardMaterial color={MARRON} roughness={0.8} />
            </mesh>
            {[-0.07, 0.0, 0.07].map((d, i) => <Elipsoide key={i} p={[0.27 + d * 0.5, 0.4 + (i % 2) * 0.02, 0.1]} s={[0.045, 0.05, 0.045]} color={MARRON} />)}
            <Caja p={[0.12, 0.3, 0.02]} s={[0.12, 0.04, 0.1]} color="#f6ecd6" rot={[0, 0, -0.35]} />
          </Fundido>
        </group>
      </group>

      {/* Cabeza: plumaje, disco facial, ojos, anteojos redondos, pico y penachos. */}
      <group ref={cabeza} position={[0, 1.52, 0.03]}>
        <Fundido>
          <Elipsoide p={[0, 0, 0]} s={[0.48, 0.43, 0.42]} color={MARRON} />
          {ojos.map((l) => (
            <group key={l}>
              <Elipsoide p={[l * 0.18, 0.0, 0.3]} s={[0.25, 0.25, 0.14]} color={CREMA} />
              <Elipsoide p={[l * 0.18, 0.04, 0.4]} s={[0.15, 0.15, 0.09]} color="#ffffff" rough={0.3} />
              <Elipsoide p={[l * 0.18, 0.04, 0.46]} s={[0.1, 0.1, 0.05]} color="#b8741a" rough={0.3} />
              <Elipsoide p={[l * 0.18, 0.04, 0.5]} s={[0.058, 0.058, 0.03]} color="#0b0b0b" rough={0.2} />
              <Elipsoide p={[l * 0.18 + 0.025, 0.075, 0.53]} s={[0.022, 0.022, 0.015]} color="#ffffff" rough={0.1} />
              <mesh position={[l * 0.18, 0.04, 0.5]}>
                <torusGeometry args={[0.2, 0.026, 8, 28]} />
                <meshStandardMaterial color="#0f0f12" roughness={0.35} />
              </mesh>
              <Caja p={[l * 0.355, 0.07, 0.3]} s={[0.012, 0.02, 0.36]} color="#0f0f12" rot={[0, l * -0.12, 0]} />
              <Cono p={[l * 0.2, 0.3, 0.38]} r={0.06} h={0.2} color={MARRON_OSCURO} rot={[0.4, 0, l * 0.9]} />
              <Cono p={[l * 0.28, 0.36, 0.08]} r={0.07} h={0.28} color={MARRON_OSCURO} rot={[0.1, 0, -l * 0.55]} />
              <Cono p={[l * 0.18, 0.4, 0.04]} r={0.05} h={0.2} color={MARRON} rot={[0.1, 0, -l * 0.25]} />
            </group>
          ))}
          <Caja p={[0, 0.05, 0.5]} s={[0.12, 0.024, 0.024]} color="#0f0f12" />
          <Cono p={[0, -0.06, 0.52]} r={0.075} h={0.2} color={NARANJA} rot={[Math.PI / 2 + 0.25, 0, 0]} />
          <Elipsoide p={[0, -0.13, 0.5]} s={[0.05, 0.03, 0.03]} color="#c95a3a" />
          {[-1, 0, 1].map((k) => <Elipsoide key={k} p={[k * 0.2, -0.3, 0.3]} s={[0.1, 0.07, 0.1]} color={CREMA} />)}
        </Fundido>
      </group>

      {/* Saludo flotante, siempre de frente a la cámara. */}
      <group ref={cartel} position={[0, 2.55, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.62, 0.48]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <Letrero lineas={[esPT ? 'Bem-vindo!' : '¡Bienvenido!']} brillo="#ffffff" ancho={1.54} alto={0.4} posicion={[0, 0, 0]} fondo="#1f3a5fee" />
      </group>
    </group>
  );
}
