'use client';

// Amenidades de la casa de Visão 3D: cada una representa cuentas y recibe el color de su saldo (gris en cero, rojo
// si es negativo). Con más forma que el mobiliario: los acentos son tonos del mismo color para que siga leyéndose "pintado".

import { useContext } from 'react';
import * as THREE from 'three';
import { Caja, Cilindro, PantallaPlana, TexturasCtx } from './CasaMobiliario';

type V3 = [number, number, number];
export type Pintura = { color: string; apagado: boolean; brillo: number };

const tono = (color: string, l: number) => new THREE.Color(color).offsetHSL(0, 0, l).getStyle();

function usar(p: Pintura) {
  return { c: p.color, e: p.color, ei: (p.apagado ? 0.04 : 0.28) * p.brillo, claro: tono(p.color, 0.16), oscuro: tono(p.color, -0.16) };
}

// Plinto sobre el que se exhiben las amenidades chicas (altura = lo que sube el objeto).
export function Plinto({ p, h, r = 0.46, acento }: { p: V3; h: number; r?: number; acento: string }) {
  return (
    <group position={p}>
      <Cilindro p={[0, 0.05, 0]} r={r + 0.06} h={0.1} color="#dfe5ee" rough={0.4} seg={24} />
      <Cilindro p={[0, h / 2, 0]} r={r - 0.1} h={h - 0.12} color="#f3f5f9" rough={0.35} seg={24} />
      <Cilindro p={[0, h - 0.03, 0]} r={r + 0.04} h={0.06} color="#e6ebf2" rough={0.3} seg={24} />
      <Cilindro p={[0, h - 0.075, 0]} r={r + 0.045} h={0.02} color={acento} emissive={acento} ei={0.9} seg={24} />
    </group>
  );
}

export function AutoSUV({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, oscuro } = usar(pintura);
  const vidrio = '#0e1420';
  return (
    <group>
      <Caja p={[0, 0.6, 0]} s={[4.3, 0.6, 1.85]} color={c} emissive={e} ei={ei} rough={0.22} metal={0.6} />
      <Caja p={[1.55, 0.97, 0]} s={[1.2, 0.14, 1.72]} color={c} emissive={e} ei={ei} rough={0.22} metal={0.6} />
      <Caja p={[-1.85, 0.97, 0]} s={[0.6, 0.14, 1.72]} color={c} emissive={e} ei={ei} rough={0.22} metal={0.6} />
      <Caja p={[-0.2, 1.3, 0]} s={[2.3, 0.56, 1.62]} color={c} emissive={e} ei={ei} rough={0.22} metal={0.6} />
      <Caja p={[-0.2, 1.6, 0]} s={[2.1, 0.07, 1.5]} color={oscuro} rough={0.3} metal={0.5} />
      {[-0.82, 0.82].map((z) => <Caja key={`v${z}`} p={[-0.2, 1.3, z]} s={[2.1, 0.4, 0.02]} color={vidrio} rough={0.08} metal={0.8} />)}
      <Caja p={[1.02, 1.3, 0]} s={[0.04, 0.58, 1.5]} color={vidrio} rough={0.08} metal={0.8} rot={[0, 0, 0.55]} />
      <Caja p={[-1.42, 1.3, 0]} s={[0.04, 0.54, 1.5]} color={vidrio} rough={0.08} metal={0.8} rot={[0, 0, -0.45]} />
      {[0.4, -0.75].flatMap((x) => [-0.83, 0.83].map((z) => <Caja key={`p${x}${z}`} p={[x, 1.3, z]} s={[0.08, 0.5, 0.03]} color={c} emissive={e} ei={ei} />))}
      {[-0.7, 0.7].map((z) => <Caja key={`r${z}`} p={[-0.2, 1.67, z]} s={[1.8, 0.04, 0.05]} color="#c9d0db" metal={0.9} rough={0.2} />)}
      {[-0.93, 0.93].flatMap((z) => [0.5, -1.0].map((x) => <Caja key={`s${x}${z}`} p={[x, 0.85, z]} s={[0.02, 0.62, 0.01]} color={oscuro} />))}
      {[-0.93, 0.93].map((z) => <Caja key={`h${z}`} p={[0.0, 0.88, z]} s={[0.3, 0.04, 0.03]} color="#c9d0db" metal={0.9} rough={0.2} />)}
      {[-0.98, 0.98].map((z) => <Caja key={`m${z}`} p={[0.6, 1.08, z]} s={[0.16, 0.1, 0.1]} color={c} emissive={e} ei={ei} />)}
      {[-1.35, 1.4].flatMap((x) => [-0.9, 0.9].map((z) => (
        <group key={`w${x}${z}`}>
          <Cilindro p={[x, 0.4, z]} r={0.4} h={0.3} color="#141821" rot={[Math.PI / 2, 0, 0]} seg={20} />
          <Cilindro p={[x, 0.4, z + Math.sign(z) * 0.02]} r={0.24} h={0.3} color="#d3d9e3" metal={0.9} rough={0.2} rot={[Math.PI / 2, 0, 0]} seg={14} />
          <Cilindro p={[x, 0.4, z + Math.sign(z) * 0.04]} r={0.07} h={0.3} color="#2a303c" rot={[Math.PI / 2, 0, 0]} seg={8} />
          <Caja p={[x, 0.82, z + Math.sign(z) * 0.03]} s={[0.98, 0.1, 0.03]} color="#0c0f16" />
        </group>
      )))}
      <Caja p={[2.17, 0.62, 0]} s={[0.03, 0.2, 0.95]} color="#0c0f16" metal={0.6} />
      <Caja p={[2.18, 0.4, 0]} s={[0.12, 0.2, 1.75]} color="#20252f" rough={0.5} />
      <Caja p={[-2.18, 0.4, 0]} s={[0.12, 0.2, 1.75]} color="#20252f" rough={0.5} />
      {[0.62, -0.62].map((z) => <Caja key={`f${z}`} p={[2.16, 0.78, z]} s={[0.04, 0.14, 0.34]} color="#fff6d6" emissive="#fff2b8" ei={2} />)}
      {[0.64, -0.64].map((z) => <Caja key={`t${z}`} p={[-2.16, 0.78, z]} s={[0.04, 0.14, 0.32]} color="#ff3b3b" emissive="#ff1f1f" ei={1.4} />)}
      <Caja p={[-2.17, 0.62, 0]} s={[0.02, 0.1, 0.3]} color="#e8ecf3" />
    </group>
  );
}

export function Sofa({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  const tela = useContext(TexturasCtx)?.tela;
  const mat = { emissive: e, ei, rough: 0.95, map: tela };
  return (
    <group>
      {[-1.2, 1.2].flatMap((x) => [-0.4, 0.4].map((z) => <Cilindro key={`l${x}${z}`} p={[x, 0.07, z]} r={0.05} h={0.14} color="#3a2a1e" seg={8} />))}
      <Caja p={[0, 0.3, 0]} s={[2.8, 0.3, 1.05]} color={oscuro} {...mat} />
      <Caja p={[0, 0.75, -0.42]} s={[2.8, 0.7, 0.24]} color={c} {...mat} />
      {[-1.5, 1.5].map((x) => (
        <group key={x}>
          <Caja p={[x * 0.97, 0.5, 0]} s={[0.22, 0.45, 1.05]} color={c} {...mat} />
          <Cilindro p={[x * 0.97, 0.74, 0]} r={0.12} h={1.05} color={c} emissive={e} ei={ei} rough={0.95} rot={[Math.PI / 2, 0, 0]} seg={12} />
        </group>
      ))}
      {[-0.88, 0, 0.88].map((x) => <Caja key={`a${x}`} p={[x, 0.55, 0.1]} s={[0.84, 0.22, 0.78]} color={claro} {...mat} />)}
      {[-0.88, 0, 0.88].map((x) => <Caja key={`b${x}`} p={[x, 0.9, -0.28]} s={[0.82, 0.55, 0.2]} color={claro} {...mat} rot={[-0.18, 0, 0]} />)}
      <Caja p={[-1.0, 0.82, 0.05]} s={[0.46, 0.46, 0.14]} color="#fff4e0" rough={1} map={tela} rot={[-0.3, 0.35, 0.2]} />
      <Caja p={[1.05, 0.8, 0.05]} s={[0.42, 0.42, 0.14]} color="#2b3a55" rough={1} map={tela} rot={[-0.3, -0.3, -0.15]} />
      <Caja p={[1.25, 0.88, 0.35]} s={[0.5, 0.05, 0.7]} color={oscuro} rough={1} rot={[0.25, 0, -0.45]} />
    </group>
  );
}

export function TV({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  return (
    <group>
      {[-0.8, 0.8].map((x) => <Cilindro key={x} p={[x, 0.09, 0]} r={0.04} h={0.18} color="#c9a86a" metal={0.8} rough={0.3} seg={8} />)}
      <Caja p={[0, 0.42, 0]} s={[2.0, 0.46, 0.46]} color={c} emissive={e} ei={ei} rough={0.4} />
      <Caja p={[0, 0.66, 0]} s={[2.04, 0.04, 0.5]} color={claro} emissive={e} ei={ei * 0.6} rough={0.3} />
      {[-0.5, 0.5].map((x) => (
        <group key={x}>
          <Caja p={[x, 0.42, 0.235]} s={[0.92, 0.38, 0.01]} color={oscuro} emissive={e} ei={ei * 0.5} />
          <Caja p={[x * 0.2 + x * 0.4, 0.46, 0.25]} s={[0.12, 0.03, 0.02]} color="#d9b872" metal={0.9} rough={0.25} />
        </group>
      ))}
      <Caja p={[0, 0.74, 0.02]} s={[0.12, 0.1, 0.1]} color="#1b2030" />
      <Caja p={[0, 1.4, 0]} s={[1.9, 1.05, 0.06]} color="#0a0d14" rough={0.2} />
      <PantallaPlana p={[0, 1.4, 0.035]} s={[1.8, 0.96]} textura="tv" color={pintura.apagado ? '#4a4f5c' : '#ffffff'} />
      <Caja p={[0, 0.88, 0.1]} s={[1.3, 0.07, 0.1]} color="#1b2030" rough={0.4} />
      <Caja p={[0, 0.88, 0.152]} s={[1.0, 0.012, 0.01]} color={claro} emissive={e} ei={1.2} />
      <Cilindro p={[-1.0, 0.95, 0.05]} r={0.07} h={0.55} color="#2a2f3b" seg={10} />
      <Cilindro p={[1.0, 0.95, 0.05]} r={0.07} h={0.55} color="#2a2f3b" seg={10} />
    </group>
  );
}

export function Tarjeta({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  return (
    <group>
      <Caja p={[0, 0.05, 0.05]} s={[1.0, 0.1, 0.5]} color="#2a2f3b" rough={0.4} />
      <group position={[0, 0.58, 0]} rotation={[-0.18, 0.28, 0]}>
        <Caja p={[0, 0, 0]} s={[1.0, 0.63, 0.04]} color={c} emissive={e} ei={ei} rough={0.25} metal={0.5} />
        <Caja p={[0, 0.11, 0.025]} s={[1.0, 0.1, 0.006]} color="#10141c" />
        <Caja p={[-0.3, -0.04, 0.025]} s={[0.17, 0.13, 0.008]} color="#f2d27a" metal={0.9} rough={0.25} />
        <Caja p={[-0.3, -0.04, 0.03]} s={[0.17, 0.012, 0.004]} color="#b8953f" />
        {[-0.3, -0.12, 0.06, 0.24].map((x) => <Caja key={x} p={[x, -0.2, 0.025]} s={[0.12, 0.025, 0.006]} color="#ffffff" />)}
        <Cilindro p={[0.3, -0.22, 0.026]} r={0.07} h={0.008} color={claro} rot={[Math.PI / 2, 0, 0]} seg={16} />
        <Cilindro p={[0.37, -0.22, 0.03]} r={0.07} h={0.008} color={oscuro} rot={[Math.PI / 2, 0, 0]} seg={16} />
        <Caja p={[0.3, 0.12, 0.03]} s={[0.22, 0.018, 0.004]} color={claro} />
      </group>
      <Caja p={[0, 0.2, -0.08]} s={[1.0, 0.24, 0.05]} color="#2a2f3b" rough={0.4} rot={[-0.18, 0.28, 0]} />
    </group>
  );
}

export function Maqueta({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  return (
    <group>
      <Caja p={[0, 0.03, 0]} s={[1.5, 0.06, 1.1]} color="#e8ecf2" rough={0.5} />
      <Caja p={[0, 0.34, 0]} s={[0.78, 0.5, 0.6]} color={c} emissive={e} ei={ei} rough={0.5} />
      <Caja p={[0.55, 0.22, 0.05]} s={[0.4, 0.32, 0.5]} color={claro} emissive={e} ei={ei} rough={0.5} />
      <mesh position={[0, 0.78, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.2, 1, 0.9]}>
        <coneGeometry args={[0.6, 0.38, 4]} />
        <meshStandardMaterial color={oscuro} emissive={e} emissiveIntensity={ei} roughness={0.5} />
      </mesh>
      <Caja p={[0.55, 0.44, 0.05]} s={[0.46, 0.04, 0.56]} color={oscuro} emissive={e} ei={ei} />
      <Caja p={[-0.2, 0.62, 0]} s={[0.1, 0.26, 0.1]} color="#8a5a44" />
      <Caja p={[0, 0.2, 0.305]} s={[0.16, 0.3, 0.012]} color="#5b3a22" />
      {[-0.26, 0.26].map((x) => <Caja key={x} p={[x, 0.4, 0.305]} s={[0.15, 0.15, 0.012]} color="#bfe3ff" emissive="#9fd2ff" ei={0.8} />)}
      <Caja p={[0.55, 0.2, 0.305]} s={[0.26, 0.22, 0.012]} color="#f2f4f8" rough={0.3} />
      <Cilindro p={[-0.6, 0.15, 0.4]} r={0.03} h={0.2} color="#6b4a2f" seg={6} />
      <mesh position={[-0.6, 0.38, 0.4]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#3fae6a" roughness={0.9} />
      </mesh>
      <Caja p={[0.05, 0.065, 0.55]} s={[0.2, 0.01, 0.4]} color="#b8c0cc" />
    </group>
  );
}

export function Ahorro({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  const moneda = { color: c, emissive: e, ei, metal: 0.7, rough: 0.25 };
  return (
    <group>
      <Cilindro p={[0, 0.5, 0]} r={0.36} h={0.9} color="#d8ecf5" rough={0.1} seg={20} />
      <Cilindro p={[0, 0.98, 0]} r={0.31} h={0.1} color={oscuro} emissive={e} ei={ei} seg={20} />
      <Caja p={[0, 1.05, 0]} s={[0.2, 0.03, 0.04]} color="#0c0f16" />
      {[0.12, 0.24, 0.36, 0.48, 0.6].map((y, i) => <Cilindro key={y} p={[i % 2 ? 0.04 : -0.03, y, i % 2 ? -0.03 : 0.04]} r={0.27} h={0.1} seg={18} {...moneda} />)}
      {([[-0.62, 0.2, 3], [0.62, 0.15, 5], [0.1, 0.62, 2]] as const).map(([x, z, n]) => [...Array(n)].map((_, i) => <Cilindro key={`${x}${i}`} p={[x, 0.05 + i * 0.09, z]} r={0.2} h={0.08} seg={16} {...moneda} />))}
      <Cilindro p={[-0.1, 0.22, 0.55]} r={0.2} h={0.05} rot={[Math.PI / 2 - 0.2, 0, 0]} seg={16} color={claro} emissive={e} ei={ei} metal={0.7} rough={0.25} />
    </group>
  );
}

export function Billetes({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  const pila = (x: number, z: number, h: number, rot: number) => (
    <group key={`${x}${z}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Caja p={[0, h / 2 + 0.01, 0]} s={[0.82, h, 0.4]} color={claro} emissive={e} ei={ei * 0.7} rough={0.9} />
      <Caja p={[0, h / 2 + 0.01, 0]} s={[0.1, h + 0.02, 0.42]} color={oscuro} />
      <Caja p={[0, h + 0.015, 0]} s={[0.78, 0.01, 0.36]} color={c} emissive={e} ei={ei} />
      <Cilindro p={[-0.18, h + 0.025, 0]} r={0.09} h={0.006} color={oscuro} seg={14} />
    </group>
  );
  return (
    <group>
      {pila(-0.1, 0.25, 0.3, 0.1)}
      {pila(0.15, -0.2, 0.36, -0.12)}
      {pila(-0.2, -0.2, 0.2, 0.2)}
      <Caja p={[0.3, 0.45, 0.32]} s={[0.8, 0.01, 0.4]} color={c} emissive={e} ei={ei} rough={0.9} rot={[0.1, 0.5, 0.35]} />
      <Caja p={[-0.25, 0.7, 0.05]} s={[0.8, 0.01, 0.4]} color={claro} emissive={e} ei={ei} rough={0.9} rot={[0.3, -0.7, -0.25]} />
    </group>
  );
}

export function Banco({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  return (
    <group>
      {[0, 1, 2].map((i) => <Caja key={i} p={[0, 0.04 + i * 0.08, 0]} s={[1.5 - i * 0.12, 0.08, 0.95 - i * 0.1]} color="#e8ecf2" rough={0.5} />)}
      <Caja p={[0, 0.3, 0]} s={[1.2, 0.12, 0.75]} color={claro} emissive={e} ei={ei} />
      {[-0.5, -0.25, 0, 0.25, 0.5].map((x) => <Cilindro key={x} p={[x, 0.65, 0.12]} r={0.065} h={0.6} color={c} emissive={e} ei={ei} rough={0.3} seg={12} />)}
      <Caja p={[0, 1.0, 0]} s={[1.28, 0.12, 0.75]} color={claro} emissive={e} ei={ei} />
      <mesh position={[0, 1.2, 0.02]} rotation={[0, Math.PI / 4, 0]} scale={[1.05, 1, 0.55]}>
        <coneGeometry args={[0.7, 0.3, 4]} />
        <meshStandardMaterial color={oscuro} emissive={e} emissiveIntensity={ei} roughness={0.4} />
      </mesh>
      <Cilindro p={[0, 1.18, 0.4]} r={0.11} h={0.02} color="#f2d27a" metal={0.9} rough={0.25} rot={[Math.PI / 2, 0, 0]} seg={18} />
      <Caja p={[0, 0.5, -0.3]} s={[1.0, 0.6, 0.08]} color={oscuro} emissive={e} ei={ei} />
    </group>
  );
}

// Papeles: 0 = por cobrar (carpeta con broche), 1 = préstamo (contrato con sello), 2 = cuentas por pagar (facturas con etiqueta).
export function Documentos({ pintura, variante = 0 }: { pintura: Pintura; variante?: 0 | 1 | 2 }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  const lineas = [0.22, 0.1, -0.02, -0.14].map((z, i) => <Caja key={z} p={[i === 3 ? -0.1 : 0, 0.215, z]} s={[i === 3 ? 0.4 : 0.6, 0.004, 0.035]} color="#6b7385" />);
  return (
    <group>
      <Caja p={[0.04, 0.03, 0.02]} s={[0.78, 0.04, 1.0]} color="#f2f4f8" rough={0.9} rot={[0, 0.12, 0]} />
      <Caja p={[-0.03, 0.07, 0]} s={[0.78, 0.04, 1.0]} color="#ffffff" rough={0.9} rot={[0, -0.08, 0]} />
      <Caja p={[0, 0.12, 0]} s={[0.78, 0.05, 1.0]} color={claro} emissive={e} ei={ei} rough={0.8} />
      <Caja p={[0, 0.18, 0]} s={[0.74, 0.04, 0.96]} color="#ffffff" rough={0.9} />
      {lineas}
      {variante === 0 && (
        <group>
          <Caja p={[0, 0.21, -0.5]} s={[0.3, 0.12, 0.08]} color="#c9d0db" metal={0.9} rough={0.25} />
          <Caja p={[0.22, 0.23, 0.18]} s={[0.22, 0.01, 0.22]} color={c} emissive={e} ei={ei} />
        </group>
      )}
      {variante === 1 && (
        <group>
          <Cilindro p={[0.2, 0.225, 0.3]} r={0.14} h={0.03} color={oscuro} emissive={e} ei={ei} seg={18} />
          <Cilindro p={[0.2, 0.245, 0.3]} r={0.08} h={0.02} color={c} emissive={e} ei={ei} seg={14} />
          <Caja p={[0.12, 0.215, 0.46]} s={[0.07, 0.01, 0.22]} color={c} emissive={e} ei={ei} rot={[0, 0, 0]} />
          <Caja p={[0.28, 0.215, 0.46]} s={[0.07, 0.01, 0.22]} color={oscuro} emissive={e} ei={ei} />
        </group>
      )}
      {variante === 2 && (
        <group>
          <Caja p={[0.24, 0.3, 0.2]} s={[0.3, 0.2, 0.01]} color={c} emissive={e} ei={ei} rot={[-0.6, 0.2, 0]} />
          <Caja p={[0.24, 0.35, 0.1]} s={[0.12, 0.012, 0.012]} color="#ffffff" rot={[-0.6, 0.2, 0]} />
          <Cilindro p={[-0.25, 0.22, 0.3]} r={0.05} h={0.02} color="#c9d0db" metal={0.9} seg={10} />
        </group>
      )}
    </group>
  );
}

export function Capital({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  const lingote = (p: V3, i: number) => (
    <group key={i} position={p}>
      <Caja p={[0, 0, 0]} s={[0.62, 0.18, 0.3]} color={c} emissive={e} ei={ei} metal={0.8} rough={0.2} />
      <Caja p={[0, 0.095, 0]} s={[0.5, 0.02, 0.22]} color={claro} emissive={e} ei={ei} metal={0.8} rough={0.15} />
      <Caja p={[0, -0.09, 0]} s={[0.66, 0.02, 0.34]} color={oscuro} />
    </group>
  );
  return (
    <group>
      {[[-0.33, 0.1, 0.17], [0.33, 0.1, 0.17], [-0.33, 0.1, -0.17], [0.33, 0.1, -0.17]].map((p, i) => lingote(p as V3, i))}
      {[[0, 0.3, 0.17], [0, 0.3, -0.17]].map((p, i) => lingote(p as V3, i + 4))}
      {lingote([0, 0.5, 0], 6)}
      <Cilindro p={[0, 0.7, 0]} r={0.2} h={0.05} color={claro} emissive={e} ei={ei * 1.4} metal={0.9} rough={0.15} rot={[Math.PI / 2 - 0.5, 0, 0]} seg={22} />
      <Cilindro p={[0.55, 0.06, 0.5]} r={0.16} h={0.04} color={c} emissive={e} ei={ei} metal={0.8} rough={0.2} seg={16} />
      <Cilindro p={[0.55, 0.1, 0.5]} r={0.16} h={0.04} color={claro} emissive={e} ei={ei} metal={0.8} rough={0.2} seg={16} />
    </group>
  );
}

export function Resultado({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  const alturas = [0.3, 0.5, 0.42, 0.72, 0.98];
  return (
    <group>
      <Caja p={[0, 0.04, 0]} s={[1.5, 0.08, 0.7]} color="#dfe5ee" rough={0.4} />
      <Caja p={[0, 0.7, -0.28]} s={[1.4, 1.2, 0.05]} color="#161c2b" rough={0.3} />
      {[0.35, 0.65, 0.95, 1.25].map((y) => <Caja key={y} p={[0, y - 0.08, -0.25]} s={[1.3, 0.008, 0.01]} color="#3b4560" />)}
      {alturas.map((h, i) => (
        <Caja key={i} p={[-0.52 + i * 0.26, 0.08 + h / 2, -0.05]} s={[0.17, h, 0.2]} color={i % 2 ? claro : c} emissive={e} ei={ei} rough={0.3} metal={0.3} />
      ))}
      <Caja p={[0.0, 1.05, -0.1]} s={[1.25, 0.045, 0.04]} color={oscuro} emissive={e} ei={ei * 1.4} rot={[0, 0, 0.42]} />
      <mesh position={[0.57, 1.28, -0.1]} rotation={[0, 0, -1.15]}>
        <coneGeometry args={[0.1, 0.22, 10]} />
        <meshStandardMaterial color={claro} emissive={e} emissiveIntensity={ei * 1.4} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function CajaOtros({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura);
  return (
    <group>
      <Caja p={[-0.2, 0.3, 0]} s={[1.3, 0.6, 1.0]} color={c} emissive={e} ei={ei} rough={0.8} />
      <Caja p={[-0.2, 0.3, 0]} s={[0.16, 0.62, 1.02]} color={claro} rough={0.5} />
      <Caja p={[-0.2, 0.61, 0]} s={[1.34, 0.04, 1.04]} color={oscuro} />
      <Caja p={[-0.2, 0.32, 0.51]} s={[0.46, 0.26, 0.01]} color="#ffffff" rough={0.8} />
      <Caja p={[-0.2, 0.36, 0.52]} s={[0.3, 0.025, 0.01]} color="#6b7385" />
      <Caja p={[-0.2, 0.28, 0.52]} s={[0.22, 0.025, 0.01]} color="#6b7385" />
      <Caja p={[0.6, 0.22, 0.2]} s={[0.7, 0.44, 0.7]} color={claro} emissive={e} ei={ei} rough={0.8} rot={[0, 0.25, 0]} />
      <Caja p={[0.6, 0.45, 0.2]} s={[0.12, 0.012, 0.72]} color={oscuro} rot={[0, 0.25, 0]} />
      <Caja p={[-0.4, 0.82, -0.05]} s={[0.7, 0.42, 0.6]} color={oscuro} emissive={e} ei={ei} rough={0.8} rot={[0, -0.2, 0]} />
      <Caja p={[-0.4, 1.04, -0.05]} s={[0.12, 0.012, 0.62]} color={claro} rot={[0, -0.2, 0]} />
    </group>
  );
}
