'use client';

// Amenidades de la casa de Visão 3D: cada una representa cuentas y recibe el color de su saldo (gris en cero, rojo
// si es negativo). Con más forma que el mobiliario: los acentos son tonos del mismo color para que siga leyéndose "pintado".

import { useContext, useMemo } from 'react';
import * as THREE from 'three';
import { Caja, Cilindro, PantallaPlana, TexturasCtx } from './CasaMobiliario';

type V3 = [number, number, number];
export type Pintura = { color: string; apagado: boolean; brillo: number; negativo?: boolean };

const tono = (color: string, l: number) => new THREE.Color(color).offsetHSL(0, 0, l).getStyle();

// Cada objeto tiene sus colores propios (los de lo que representa). El saldo ya no los pinta: en cero se ven apagados
// (grises) y con saldo negativo se tiñen de rojo; con saldo se ven en color natural.
type Natural = { c: string; claro: string; oscuro: string };
const NAT: Record<string, Natural> = {
  auto: { c: '#c3c8d2', claro: '#e3e6ec', oscuro: '#8d94a3' },
  sofa: { c: '#c99a3e', claro: '#dcb35a', oscuro: '#a47a2a' },
  armario: { c: '#9b6a42', claro: '#bd8c5e', oscuro: '#6e4a2c' },
  tv: { c: '#7a5230', claro: '#9a6b3f', oscuro: '#5e3f24' },
  tarjeta: { c: '#262a33', claro: '#3d4350', oscuro: '#14161b' },
  casa: { c: '#efe3cf', claro: '#f8f0e2', oscuro: '#b8654a' },
  ahorro: { c: '#e8b83a', claro: '#f6d96e', oscuro: '#b98a1e' },
  billetes: { c: '#6db26f', claro: '#93d08d', oscuro: '#3f7d46' },
  banco: { c: '#ebe3d2', claro: '#f7f1e5', oscuro: '#b5a688' },
  doc0: { c: '#d9b878', claro: '#ecd6a2', oscuro: '#b08f4e' },
  doc1: { c: '#c0392b', claro: '#e0675a', oscuro: '#8f251b' },
  doc2: { c: '#e8812b', claro: '#f5a65d', oscuro: '#b85e14' },
  capital: { c: '#e6b739', claro: '#f7d86a', oscuro: '#b48a1c' },
  resultado: { c: '#3aa86d', claro: '#78d6a0', oscuro: '#1f7a4c' },
  otros: { c: '#c8a06a', claro: '#dcb985', oscuro: '#a47b45' },
};

function apagar(hex: string): string {
  const col = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  return col.setHSL(hsl.h, hsl.s * 0.06, 0.38 + hsl.l * 0.35).getStyle();
}

function teñir(hex: string): string {
  return new THREE.Color(hex).lerp(new THREE.Color('#d64545'), 0.35).getStyle();
}

function usar(p: Pintura, nat: Natural) {
  const f = p.apagado ? apagar : p.negativo ? teñir : (x: string) => x;
  const c = f(nat.c);
  return { c, e: c, ei: (p.apagado ? 0.02 : 0.08) * p.brillo, claro: f(nat.claro), oscuro: f(nat.oscuro) };
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
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.auto);
  const carroceria = { color: c, emissive: e, ei, rough: 0.2, metal: 0.65 };
  const vidrio = { color: '#0e1420', rough: 0.06, metal: 0.85, opacity: 0.8 };
  return (
    <group>
      {/* Chasis, faldones y pasos de rueda. */}
      <Caja p={[0, 0.3, 0]} s={[4.1, 0.14, 1.7]} color="#12151c" />
      <Caja p={[0, 0.58, 0]} s={[4.3, 0.56, 1.85]} {...carroceria} />
      {[-0.93, 0.93].map((z) => <Caja key={`fa${z}`} p={[0, 0.34, z]} s={[2.6, 0.1, 0.05]} color={oscuro} rough={0.5} />)}
      {[-1.35, 1.4].flatMap((x) => [-0.94, 0.94].map((z) => <Caja key={`pa${x}${z}`} p={[x, 0.78, z]} s={[1.06, 0.12, 0.05]} color={oscuro} rough={0.5} />))}
      {/* Capó y baúl con caída. */}
      <Caja p={[1.5, 0.98, 0]} s={[1.3, 0.12, 1.74]} {...carroceria} rot={[0, 0, -0.07]} />
      <Caja p={[1.5, 1.04, 0]} s={[1.1, 0.01, 0.06]} color={claro} />
      <Caja p={[-1.82, 0.99, 0]} s={[0.66, 0.12, 1.74]} {...carroceria} rot={[0, 0, 0.05]} />
      {/* Cabina. */}
      <Caja p={[-0.25, 1.28, 0]} s={[2.2, 0.55, 1.62]} {...carroceria} />
      <Caja p={[-0.25, 1.58, 0]} s={[2.0, 0.07, 1.5]} color={oscuro} rough={0.25} metal={0.6} />
      <Caja p={[-0.25, 1.64, 0]} s={[0.9, 0.012, 0.7]} color="#0e1420" rough={0.05} metal={0.9} />
      <Caja p={[0.95, 1.28, 0]} s={[0.05, 0.6, 1.52]} {...vidrio} rot={[0, 0, 0.62]} />
      <Caja p={[-1.45, 1.28, 0]} s={[0.05, 0.56, 1.52]} {...vidrio} rot={[0, 0, -0.5]} />
      {[-0.82, 0.82].map((z) => (
        <group key={`v${z}`}>
          <Caja p={[0.3, 1.3, z]} s={[0.78, 0.4, 0.02]} {...vidrio} />
          <Caja p={[-0.78, 1.3, z]} s={[0.92, 0.4, 0.02]} {...vidrio} />
          <Caja p={[-0.25, 1.3, z * 1.01]} s={[0.1, 0.46, 0.04]} color={oscuro} rough={0.3} />
        </group>
      ))}
      {/* Interior a la vista. */}
      {[0.1, -0.7].flatMap((x) => [-0.4, 0.4].map((z) => (
        <group key={`as${x}${z}`}>
          <Caja p={[x, 0.95, z]} s={[0.45, 0.12, 0.45]} color="#242a36" rough={0.9} />
          <Caja p={[x - 0.2, 1.2, z]} s={[0.1, 0.5, 0.42]} color="#2d3442" rough={0.9} />
        </group>
      )))}
      <Cilindro p={[0.62, 1.12, 0.4]} r={0.15} h={0.03} color="#1a1f29" rot={[0, 0, 1.0]} seg={14} />
      {/* Portaequipaje, aleta de antena y alerón. */}
      {[-0.7, 0.7].map((z) => <Caja key={`r${z}`} p={[-0.25, 1.67, z]} s={[1.8, 0.04, 0.05]} color="#c9d0db" metal={0.9} rough={0.2} />)}
      <Caja p={[-1.1, 1.66, 0]} s={[0.2, 0.06, 0.04]} color="#12151c" />
      <Caja p={[-2.0, 1.12, 0]} s={[0.22, 0.04, 1.6]} color={oscuro} rough={0.3} />
      {[-0.72, 0.72].map((z) => <Caja key={`ap${z}`} p={[-2.0, 1.06, z]} s={[0.08, 0.1, 0.05]} color="#12151c" />)}
      {/* Puertas: cortes, manijas y espejos. */}
      {[-0.93, 0.93].flatMap((z) => [0.62, -0.25, -1.1].map((x) => <Caja key={`s${x}${z}`} p={[x, 0.82, z]} s={[0.02, 0.66, 0.012]} color={oscuro} />))}
      {[-0.94, 0.94].flatMap((z) => [0.2, -0.65].map((x) => <Caja key={`h${x}${z}`} p={[x, 0.92, z]} s={[0.28, 0.04, 0.03]} color="#c9d0db" metal={0.9} rough={0.2} />))}
      {[-1.0, 1.0].map((z) => (
        <group key={`m${z}`}>
          <Caja p={[0.72, 1.08, z]} s={[0.16, 0.12, 0.14]} {...carroceria} />
          <Caja p={[0.72, 1.08, z * 1.07]} s={[0.12, 0.08, 0.01]} color="#c9d0db" metal={0.9} rough={0.1} />
        </group>
      ))}
      {/* Frente: parrilla, luces con tira, paragolpes, patente y puerto de carga. */}
      <Caja p={[2.16, 0.62, 0]} s={[0.04, 0.22, 1.0]} color="#0c0f16" metal={0.6} />
      {[0.46, 0.62, 0.78].map((y) => <Caja key={`g${y}`} p={[2.19, y - 0.02, 0]} s={[0.015, 0.02, 0.9]} color="#2a303c" metal={0.8} rough={0.3} />)}
      {[0.66, -0.66].map((z) => (
        <group key={`f${z}`}>
          <Caja p={[2.15, 0.8, z]} s={[0.06, 0.16, 0.4]} color="#e9eef6" rough={0.1} metal={0.5} />
          <Caja p={[2.18, 0.8, z]} s={[0.02, 0.1, 0.32]} color="#fff6d6" emissive="#fff2b8" ei={2} />
          <Caja p={[2.18, 0.72, z]} s={[0.02, 0.018, 0.34]} color="#cfe8ff" emissive="#9fd2ff" ei={1.6} />
        </group>
      ))}
      <Caja p={[2.18, 0.4, 0]} s={[0.12, 0.22, 1.8]} color="#20252f" rough={0.5} />
      <Caja p={[2.25, 0.4, 0]} s={[0.01, 0.12, 0.42]} color="#f4f6fa" rough={0.4} />
      <Caja p={[2.1, 0.78, -0.9]} s={[0.06, 0.1, 0.1]} color="#c9d0db" metal={0.9} rough={0.2} />
      {/* Trasera: tira de luces, patente, escape oculto, limpiaparabrisas. */}
      <Caja p={[-2.17, 0.84, 0]} s={[0.03, 0.08, 1.5]} color="#ff2b2b" emissive="#ff1f1f" ei={1.6} />
      {[0.7, -0.7].map((z) => <Caja key={`t${z}`} p={[-2.16, 0.76, z]} s={[0.05, 0.16, 0.34]} color="#ff3b3b" emissive="#ff1f1f" ei={1.4} />)}
      <Caja p={[-2.18, 0.4, 0]} s={[0.12, 0.22, 1.8]} color="#20252f" rough={0.5} />
      <Caja p={[-2.25, 0.5, 0]} s={[0.01, 0.12, 0.42]} color="#f4f6fa" rough={0.4} />
      <Caja p={[-1.5, 1.32, 0]} s={[0.02, 0.22, 0.02]} color="#12151c" rot={[0, 0, -0.5]} />
      {/* Ruedas con rin de rayos y pinza de freno. */}
      {[-1.35, 1.4].flatMap((x) => [-0.9, 0.9].map((z) => {
        const k = Math.sign(z);
        return (
          <group key={`w${x}${z}`}>
            <Cilindro p={[x, 0.4, z]} r={0.4} h={0.3} color="#12151c" rough={0.9} rot={[Math.PI / 2, 0, 0]} seg={22} />
            <Cilindro p={[x, 0.4, z + k * 0.02]} r={0.27} h={0.3} color="#cfd5df" metal={0.9} rough={0.2} rot={[Math.PI / 2, 0, 0]} seg={18} />
            <Cilindro p={[x, 0.4, z + k * 0.04]} r={0.2} h={0.3} color="#1b2029" rot={[Math.PI / 2, 0, 0]} seg={18} />
            {[0, 1, 2, 3, 4].map((i) => <Caja key={i} p={[x, 0.4, z + k * 0.17]} s={[0.04, 0.38, 0.015]} color="#e3e8f0" metal={0.9} rough={0.2} rot={[0, 0, (i * Math.PI) / 5]} />)}
            <Cilindro p={[x, 0.4, z + k * 0.18]} r={0.05} h={0.02} color={claro} emissive={e} ei={ei} rot={[Math.PI / 2, 0, 0]} seg={10} />
            <Caja p={[x + 0.14, 0.52, z + k * 0.1]} s={[0.12, 0.1, 0.04]} color={c} emissive={e} ei={ei} />
          </group>
        );
      }))}
    </group>
  );
}

export function Sofa({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.sofa);
  const tela = useContext(TexturasCtx)?.tela;
  const mat = { emissive: e, ei, rough: 0.95, map: tela };
  return (
    <group>
      {[-1.2, 1.2].flatMap((x) => [-0.4, 0.4].map((z) => <Cilindro key={`l${x}${z}`} p={[x, 0.07, z]} r={0.05} h={0.14} color="#3a2a1e" seg={8} />))}
      <Caja p={[0, 0.3, 0]} s={[2.8, 0.3, 1.05]} color={oscuro} {...mat}  r={0.07} />
      <Caja p={[0, 0.75, -0.42]} s={[2.8, 0.7, 0.24]} color={c} {...mat}  r={0.07} />
      {[-1.5, 1.5].map((x) => (
        <group key={x}>
          <Caja p={[x * 0.97, 0.5, 0]} s={[0.22, 0.45, 1.05]} color={c} {...mat}  r={0.07} />
          <Cilindro p={[x * 0.97, 0.74, 0]} r={0.12} h={1.05} color={c} emissive={e} ei={ei} rough={0.95} rot={[Math.PI / 2, 0, 0]} seg={12} />
        </group>
      ))}
      {[-0.88, 0, 0.88].map((x) => <Caja key={`a${x}`} p={[x, 0.55, 0.1]} s={[0.84, 0.22, 0.78]} color={claro} {...mat}  r={0.07} />)}
      {[-0.88, 0, 0.88].map((x) => <Caja key={`b${x}`} p={[x, 0.9, -0.28]} s={[0.82, 0.55, 0.2]} color={claro} {...mat} rot={[-0.18, 0, 0]} />)}
      <Caja p={[-1.0, 0.82, 0.05]} s={[0.46, 0.46, 0.14]} color="#fff4e0" rough={1} map={tela} rot={[-0.3, 0.35, 0.2]} />
      <Caja p={[1.05, 0.8, 0.05]} s={[0.42, 0.42, 0.14]} color="#2b3a55" rough={1} map={tela} rot={[-0.3, -0.3, -0.15]} />
      <Caja p={[1.25, 0.88, 0.35]} s={[0.5, 0.05, 0.7]} color={oscuro} rough={1} rot={[0.25, 0, -0.45]}  r={0.07} />
    </group>
  );
}

// Armario de dos puertas (cuenta Muebles y Útiles): cuerpo de madera, molduras, paneles, espejo, manijas y zócalo.
export function Armario({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.armario);
  const mat = { emissive: e, ei };
  return (
    <group>
      <Caja p={[0, 1.2, -0.02]} s={[1.9, 2.3, 0.6]} color={c} rough={0.55} {...mat} />
      <Caja p={[0, 0.07, 0.02]} s={[1.96, 0.14, 0.64]} color={oscuro} rough={0.6} />
      <Caja p={[0, 2.37, 0.0]} s={[2.0, 0.1, 0.68]} color={oscuro} rough={0.5} />
      <Caja p={[0, 2.44, 0.0]} s={[1.92, 0.05, 0.62]} color={claro} rough={0.5} />
      {[-0.46, 0.46].map((x) => (
        <group key={x}>
          <Caja p={[x, 1.2, 0.3]} s={[0.88, 2.1, 0.04]} color={claro} rough={0.5} {...mat} />
          <Caja p={[x, 1.55, 0.325]} s={[0.66, 1.2, 0.012]} color={c} rough={0.5} />
          <Caja p={[x, 0.55, 0.325]} s={[0.66, 0.6, 0.012]} color={c} rough={0.5} />
        </group>
      ))}
      <Caja p={[-0.46, 1.55, 0.334]} s={[0.56, 1.05, 0.006]} color="#cfe3f2" rough={0.08} metal={0.6} />
      <Caja p={[0, 1.2, 0.325]} s={[0.012, 2.1, 0.012]} color="#2b1b10" />
      {[-0.07, 0.07].map((x) => <Caja key={`m${x}`} p={[x, 1.2, 0.35]} s={[0.025, 0.28, 0.03]} color="#d9b872" metal={0.85} rough={0.3} />)}
      {[-0.82, 0.82].map((x) => <Caja key={`p${x}`} p={[x, 0.05, 0.28]} s={[0.1, 0.1, 0.1]} color="#2b1b10" />)}
      <Caja p={[-0.5, 2.5, -0.05]} s={[0.5, 0.12, 0.34]} color="#d9d2c4" rough={0.9} />
      <Caja p={[0.3, 2.52, -0.05]} s={[0.4, 0.16, 0.3]} color="#b9a27a" rough={0.9} />
    </group>
  );
}

export function TV({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.tv);
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
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.tarjeta);
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

// Prisma triangular (techo a dos aguas) con el eje a lo largo de x.
function Techo2Aguas({ p, largo, ancho, alto, color, emissive, ei }: { p: V3; largo: number; ancho: number; alto: number; color: string; emissive: string; ei: number }) {
  const geo = useMemo(() => {
    const f = new THREE.Shape();
    f.moveTo(-ancho / 2, 0);
    f.lineTo(ancho / 2, 0);
    f.lineTo(0, alto);
    f.closePath();
    const g = new THREE.ExtrudeGeometry(f, { depth: largo, bevelEnabled: false });
    g.translate(0, 0, -largo / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [largo, ancho, alto]);
  return (
    <mesh position={p} geometry={geo}>
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={ei} roughness={0.6} />
    </mesh>
  );
}

export function Maqueta({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.casa);
  const calido = { color: '#ffe9b8', emissive: '#ffd27a', ei: 0.9 };
  const ventana = (x: number, y: number, z: number, w = 0.2, h = 0.22) => (
    <group key={`${x}${y}${z}`} position={[x, y, z]}>
      <Caja p={[0, 0, 0]} s={[w + 0.05, h + 0.05, 0.02]} color="#f4f6fa" rough={0.4} />
      <Caja p={[0, 0, 0.012]} s={[w, h, 0.012]} {...calido} />
      <Caja p={[0, 0, 0.022]} s={[0.012, h, 0.006]} color="#f4f6fa" />
      <Caja p={[0, 0, 0.022]} s={[w, 0.012, 0.006]} color="#f4f6fa" />
      <Caja p={[0, -h / 2 - 0.035, 0.03]} s={[w + 0.1, 0.03, 0.06]} color={oscuro} />
    </group>
  );
  return (
    <group>
      {/* Base con jardín, camino y cerco. */}
      <Caja p={[0, 0.03, 0]} s={[1.9, 0.06, 1.4]} color="#e8ecf2" rough={0.5} />
      <Caja p={[0, 0.07, 0.15]} s={[1.8, 0.03, 1.2]} color="#7fbf8f" rough={1} />
      <Caja p={[0.05, 0.09, 0.62]} s={[0.22, 0.01, 0.52]} color="#d9dde5" />
      {[-0.86, 0.86].map((x) => <Caja key={`cx${x}`} p={[x, 0.15, 0.1]} s={[0.02, 0.12, 1.1]} color="#f4f6fa" />)}
      <Caja p={[0, 0.15, 0.7]} s={[1.74, 0.02, 0.02]} color="#f4f6fa" />
      {/* Cuerpo principal de dos plantas + garage. */}
      <Caja p={[-0.2, 0.4, -0.1]} s={[1.0, 0.62, 0.7]} color={c} emissive={e} ei={ei} rough={0.55} />
      <Caja p={[-0.2, 0.72, -0.1]} s={[1.04, 0.03, 0.74]} color="#f4f6fa" />
      <Caja p={[-0.2, 0.96, -0.12]} s={[0.9, 0.45, 0.6]} color={claro} emissive={e} ei={ei} rough={0.55} />
      <Caja p={[0.62, 0.3, 0.0]} s={[0.5, 0.42, 0.55]} color={claro} emissive={e} ei={ei} rough={0.55} />
      <Caja p={[0.62, 0.53, 0.0]} s={[0.56, 0.04, 0.6]} color={oscuro} />
      {/* Techo a dos aguas con alero, cumbrera, chimenea y paneles solares. */}
      <Techo2Aguas p={[-0.2, 1.19, -0.12]} largo={1.0} ancho={0.78} alto={0.34} color={oscuro} emissive={e} ei={ei} />
      <Caja p={[-0.2, 1.53, -0.12]} s={[1.02, 0.025, 0.04]} color="#f4f6fa" />
      <Caja p={[0.15, 1.45, -0.04]} s={[0.12, 0.34, 0.12]} color="#b8654a" rough={0.9} />
      <Caja p={[0.15, 1.64, -0.04]} s={[0.16, 0.03, 0.16]} color="#8f4b36" />
      {[-0.45, -0.2].map((x) => <Caja key={`ps${x}`} p={[x, 1.38, 0.1]} s={[0.22, 0.012, 0.28]} color="#1c3560" metal={0.8} rough={0.15} rot={[0.9, 0, 0]} />)}
      {/* Frente: puerta con porche y escalones, ventanas, balcón, garage. */}
      <Caja p={[-0.2, 0.22, 0.26]} s={[0.2, 0.3, 0.02]} color="#6b4a2f" rough={0.7} />
      <Cilindro p={[-0.13, 0.22, 0.285]} r={0.012} h={0.02} color="#d9b872" metal={0.9} rot={[Math.PI / 2, 0, 0]} seg={8} />
      <Caja p={[-0.2, 0.4, 0.34]} s={[0.4, 0.03, 0.18]} color="#f4f6fa" />
      {[-0.37, -0.03].map((x) => <Cilindro key={`pc${x}`} p={[x, 0.22, 0.4]} r={0.018} h={0.38} color="#f4f6fa" seg={8} />)}
      <Caja p={[-0.2, 0.065, 0.4]} s={[0.3, 0.02, 0.14]} color="#e0e4ea" />
      {ventana(-0.55, 0.45, 0.26)}
      {ventana(0.15, 0.45, 0.26)}
      {ventana(-0.45, 1.0, 0.19)}
      {ventana(-0.2, 1.0, 0.19)}
      {ventana(0.05, 1.0, 0.19)}
      <Caja p={[-0.2, 0.84, 0.28]} s={[0.7, 0.02, 0.1]} color="#f4f6fa" />
      {[-0.5, -0.35, -0.2, -0.05, 0.1].map((x) => <Caja key={`ba${x}`} p={[x, 0.9, 0.325]} s={[0.012, 0.1, 0.012]} color="#f4f6fa" />)}
      <Caja p={[0.62, 0.26, 0.285]} s={[0.4, 0.32, 0.02]} color="#f2f4f8" rough={0.3} />
      {[0.14, 0.22, 0.3, 0.38].map((y) => <Caja key={`gd${y}`} p={[0.62, y, 0.298]} s={[0.4, 0.008, 0.01]} color="#c4cad6" />)}
      <Caja p={[0.62, 0.45, 0.3]} s={[0.1, 0.02, 0.012]} {...calido} />
      <Caja p={[0.62, 0.075, 0.45]} s={[0.4, 0.015, 0.4]} color="#bfc6d2" />
      {/* Costado: ventana y luz de entrada. */}
      <Caja p={[-0.7, 0.45, -0.1]} s={[0.012, 0.2, 0.22]} {...calido} />
      <Cilindro p={[-0.42, 0.52, 0.29]} r={0.025} h={0.03} color={calido.color} emissive={calido.emissive} ei={2} seg={10} />
      {/* Árbol, arbustos, buzón y farol. */}
      <Cilindro p={[-0.78, 0.22, 0.45]} r={0.035} h={0.3} color="#6b4a2f" seg={6} />
      <mesh position={[-0.78, 0.5, 0.45]}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color="#3fae6a" roughness={0.9} flatShading />
      </mesh>
      {[[0.3, 0.38], [0.9, 0.0], [-0.5, 0.42]].map(([x, z], i) => (
        <mesh key={`ar${i}`} position={[x, 0.15, z]}>
          <icosahedronGeometry args={[0.09, 1]} />
          <meshStandardMaterial color="#58c27d" roughness={0.9} flatShading />
        </mesh>
      ))}
      <Cilindro p={[0.35, 0.18, 0.66]} r={0.012} h={0.2} color="#2a2f3b" seg={6} />
      <Caja p={[0.35, 0.3, 0.66]} s={[0.07, 0.05, 0.09]} color={c} emissive={e} ei={ei} />
      <Cilindro p={[0.78, 0.2, 0.62]} r={0.012} h={0.32} color="#2a2f3b" seg={6} />
      <mesh position={[0.78, 0.38, 0.62]}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <meshStandardMaterial color={calido.color} emissive={calido.emissive} emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

export function Ahorro({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.ahorro);
  const moneda = { color: c, emissive: e, ei, metal: 0.7, rough: 0.25 };
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.9, 20]} />
        <meshStandardMaterial color="#d8ecf5" transparent opacity={0.28} roughness={0.05} metalness={0.2} depthWrite={false} />
      </mesh>
      <Cilindro p={[0, 0.98, 0]} r={0.31} h={0.1} color={oscuro} emissive={e} ei={ei} seg={20} />
      <Caja p={[0, 1.05, 0]} s={[0.2, 0.03, 0.04]} color="#0c0f16" />
      {[0.12, 0.24, 0.36, 0.48, 0.6].map((y, i) => <Cilindro key={y} p={[i % 2 ? 0.04 : -0.03, y, i % 2 ? -0.03 : 0.04]} r={0.27} h={0.1} seg={18} {...moneda} />)}
      {([[-0.62, 0.2, 3], [0.62, 0.15, 5], [0.1, 0.62, 2]] as const).map(([x, z, n]) => [...Array(n)].map((_, i) => <Cilindro key={`${x}${i}`} p={[x, 0.05 + i * 0.09, z]} r={0.2} h={0.08} seg={16} {...moneda} />))}
      <Cilindro p={[-0.1, 0.22, 0.55]} r={0.2} h={0.05} rot={[Math.PI / 2 - 0.2, 0, 0]} seg={16} color={claro} emissive={e} ei={ei} metal={0.7} rough={0.25} />
    </group>
  );
}

export function Billetes({ pintura }: { pintura: Pintura }) {
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.billetes);
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
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.banco);
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
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT[`doc${variante}`]);
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
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.capital);
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
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.resultado);
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
  const { c, e, ei, claro, oscuro } = usar(pintura, NAT.otros);
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
