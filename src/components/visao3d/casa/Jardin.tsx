'use client';

// Jardín del frente de la casa (Visão 3D, modelo Familia) con relieve: matas de pasto con hojas, flores con pétalos y tallo,
// arbustos de varias masas, piedras y palmeras con tronco segmentado y hojas arqueadas. Lo repetido va instanciado
// (una llamada de dibujo por tipo) y lo demás se funde con <Fundido>.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type V3 = [number, number, number];

function alAzar(semilla: number) {
  let n = semilla;
  return () => ((n = (n * 16807) % 2147483647) / 2147483647);
}

// Geometría con color por vértice (degradé de la base a la punta) a partir de filas de puntos.
function tira(filas: Array<{ izq: V3; der: V3; centro?: V3; color: [number, number, number] }>): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const porFila = filas[0].centro ? 3 : 2;
  filas.forEach((f) => {
    const puntos = f.centro ? [f.izq, f.centro, f.der] : [f.izq, f.der];
    puntos.forEach((p, k) => {
      pos.push(...p);
      const oscuro = f.centro && k === 1 ? 0.72 : 1;
      col.push(f.color[0] * oscuro, f.color[1] * oscuro, f.color[2] * oscuro);
    });
  });
  for (let i = 0; i < filas.length - 1; i++) {
    const a = i * porFila;
    const b = (i + 1) * porFila;
    for (let k = 0; k < porFila - 1; k++) idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function fusionar(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const posiciones: number[] = [];
  const colores: number[] = [];
  const indices: number[] = [];
  let base = 0;
  gs.forEach((g) => {
    const p = g.getAttribute('position');
    const c = g.getAttribute('color');
    for (let i = 0; i < p.count; i++) {
      posiciones.push(p.getX(i), p.getY(i), p.getZ(i));
      colores.push(c.getX(i), c.getY(i), c.getZ(i));
    }
    g.index!.array.forEach((v) => indices.push(v + base));
    base += p.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
  out.setIndex(indices);
  out.computeVertexNormals();
  return out;
}

const verde = (t: number): [number, number, number] => {
  const a = new THREE.Color('#1c5f35');
  const b = new THREE.Color('#86d65f');
  const c = a.lerp(b, t);
  return [c.r, c.g, c.b];
};

// Una mata: hojas finas en abanico, curvadas hacia afuera, más oscuras en la base y claras en la punta.
function geometriaMata(): THREE.BufferGeometry {
  const azar = alAzar(5);
  const hojas: THREE.BufferGeometry[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + azar() * 0.5;
    const largo = 0.32 + azar() * 0.3;
    const curva = 0.25 + azar() * 0.35;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const filas = [0, 0.5, 1].map((t) => {
      const h = largo * t;
      const fuera = 0.03 + curva * largo * t * t;
      const ancho = 0.04 * (1 - t * 0.9);
      const cx = dx * fuera;
      const cz = dz * fuera;
      return { izq: [cx - dz * ancho, h, cz + dx * ancho] as V3, der: [cx + dz * ancho, h, cz - dx * ancho] as V3, color: verde(0.15 + t * 0.85) };
    });
    hojas.push(tira(filas));
  }
  return fusionar(hojas);
}

// Matas de pasto: una sola malla instanciada (cientos de matas = 1 llamada de dibujo).
export function Pasto({ matas }: { matas: Array<[number, number, number]> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(geometriaMata, []);
  useEffect(() => () => geo.dispose(), [geo]);

  useEffect(() => {
    const malla = ref.current;
    if (!malla) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    matas.forEach(([x, z, e], i) => {
      m.compose(new THREE.Vector3(x, -0.12, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 2.3, 0)), new THREE.Vector3(e, e * (0.8 + (i % 5) * 0.12), e));
      malla.setMatrixAt(i, m);
      malla.setColorAt(i, c.setHSL(0.27 + ((i * 7) % 9) * 0.006, 0.55, 0.62 + ((i * 3) % 5) * 0.045));
    });
    malla.instanceMatrix.needsUpdate = true;
    if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
  }, [matas]);

  return (
    <instancedMesh ref={ref} args={[geo, undefined, matas.length]} frustumCulled={false}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} />
    </instancedMesh>
  );
}

function geometriaEstrella(radio: number, puntas = 5): THREE.ExtrudeGeometry {
  const f = new THREE.Shape();
  for (let i = 0; i < puntas * 2; i++) {
    const r = i % 2 === 0 ? radio : radio * 0.48;
    const a = (i / (puntas * 2)) * Math.PI * 2;
    if (i === 0) f.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else f.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  f.closePath();
  const g = new THREE.ExtrudeGeometry(f, { depth: 0.025, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

const COLORES_FLOR = ['#ff6b8a', '#ffd166', '#ffffff', '#c77dff', '#ff9f5a'];

// Flores con tallo, pétalos en estrella y centro amarillo (tres mallas instanciadas).
export function Flores({ lugares }: { lugares: Array<{ x: number; z: number; e: number }> }) {
  const tallos = useRef<THREE.InstancedMesh>(null);
  const cabezas = useRef<THREE.InstancedMesh>(null);
  const centros = useRef<THREE.InstancedMesh>(null);
  const estrella = useMemo(() => geometriaEstrella(0.11), []);
  useEffect(() => () => estrella.dispose(), [estrella]);

  useEffect(() => {
    if (!tallos.current || !cabezas.current || !centros.current) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    lugares.forEach(({ x, z, e }, i) => {
      const alto = 0.28 + (i % 4) * 0.07;
      const s = e;
      m.compose(new THREE.Vector3(x, -0.12 + (alto * s) / 2, z), new THREE.Quaternion(), new THREE.Vector3(s, alto * s, s));
      tallos.current!.setMatrixAt(i, m);
      const inclina = new THREE.Quaternion().setFromEuler(new THREE.Euler(((i % 3) - 1) * 0.18, i, 0));
      m.compose(new THREE.Vector3(x, -0.12 + alto * s, z), inclina, new THREE.Vector3(s, s, s));
      cabezas.current!.setMatrixAt(i, m);
      cabezas.current!.setColorAt(i, c.set(COLORES_FLOR[i % COLORES_FLOR.length]));
      m.compose(new THREE.Vector3(x, -0.12 + alto * s + 0.02 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      centros.current!.setMatrixAt(i, m);
    });
    [tallos.current, cabezas.current, centros.current].forEach((malla) => {
      malla.instanceMatrix.needsUpdate = true;
      if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
    });
  }, [lugares]);

  return (
    <>
      <instancedMesh ref={tallos} args={[undefined, undefined, lugares.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.012, 0.016, 1, 5]} />
        <meshStandardMaterial color="#2f8a4a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={cabezas} args={[estrella, undefined, lugares.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.7} side={THREE.DoubleSide} emissive="#ffffff" emissiveIntensity={0.08} />
      </instancedMesh>
      <instancedMesh ref={centros} args={[undefined, undefined, lugares.length]} frustumCulled={false}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshStandardMaterial color="#ffcf33" emissive="#e6a100" emissiveIntensity={0.5} roughness={0.6} />
      </instancedMesh>
    </>
  );
}

const VERDES = ['#2f8f52', '#3aa35f', '#287a47', '#46b56b'];

// Arbusto con varias masas de hojas y algunas flores; dentro de un <Fundido>.
export function Arbusto({ p, r, flor }: { p: V3; r: number; flor: boolean }) {
  const estrella = useMemo(() => geometriaEstrella(0.075), []);
  useEffect(() => () => estrella.dispose(), [estrella]);
  const masas: Array<[number, number, number, number, number]> = [
    [0, 0, 0, r, 0],
    [r * 0.75, -r * 0.1, r * 0.3, r * 0.72, 1],
    [-r * 0.6, -r * 0.05, -r * 0.35, r * 0.68, 2],
    [r * 0.1, r * 0.45, -r * 0.1, r * 0.6, 3],
  ];
  return (
    <group position={p}>
      {masas.map(([x, y, z, rr, k], i) => (
        <mesh key={i} position={[x, y + rr * 0.55, z]} scale={[1, 0.85, 1]}>
          <icosahedronGeometry args={[rr, 1]} />
          <meshStandardMaterial color={VERDES[k]} roughness={0.95} flatShading />
        </mesh>
      ))}
      {flor &&
        [0, 1, 2, 3].map((i) => {
          const a = i * 1.7 + r * 10;
          return (
            <mesh key={i} geometry={estrella} position={[Math.cos(a) * r * 0.85, r * (0.7 + (i % 2) * 0.35), Math.sin(a) * r * 0.85]} rotation={[0.5, a, 0]}>
              <meshStandardMaterial color={COLORES_FLOR[(i + Math.round(r * 20)) % COLORES_FLOR.length]} roughness={0.7} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
    </group>
  );
}

export function Piedra({ p, e, giro }: { p: V3; e: number; giro: number }) {
  return (
    <mesh position={[p[0], p[1] + e * 0.18, p[2]]} rotation={[0, giro, 0]} scale={[e, e * 0.55, e * 0.8]}>
      <icosahedronGeometry args={[0.3, 0]} />
      <meshStandardMaterial color={giro > 1.5 ? '#8f98a8' : '#a3abb9'} roughness={1} flatShading />
    </mesh>
  );
}

// Hoja de palmera: tira arqueada (sube y cae) con borde aserrado y nervio central más oscuro.
function geometriaFronda(): THREE.BufferGeometry {
  const filas = [] as Array<{ izq: V3; der: V3; centro: V3; color: [number, number, number] }>;
  const L = 2.0;
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = L * t;
    const y = 0.55 * t - 1.05 * t * t;
    const aserrado = i % 2 === 0 ? 1 : 0.62;
    const ancho = (0.27 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.75) + 0.012) * aserrado;
    const c = new THREE.Color('#1f7a3d').lerp(new THREE.Color('#6cc65c'), t * 0.9);
    filas.push({ izq: [x, y - 0.05 * ancho, ancho], centro: [x, y + 0.03, 0], der: [x, y - 0.05 * ancho, -ancho], color: [c.r, c.g, c.b] });
  }
  return tira(filas);
}

const ALTO_SEG = 0.46;
const SEGMENTOS = 7;

// Posición de la copa (donde nacen las hojas) y datos de cada tramo del tronco, que se curva apenas.
function troncoPalmera() {
  const lista: Array<{ pos: V3; ang: number; rb: number; rt: number; color: string }> = [];
  let x = 0;
  let y = 0;
  let ang = 0;
  for (let i = 0; i < SEGMENTOS; i++) {
    const rb = 0.17 - i * 0.012;
    const rt = 0.17 - (i + 1) * 0.012;
    lista.push({ pos: [x + Math.sin(ang) * ALTO_SEG * 0.5, y + Math.cos(ang) * ALTO_SEG * 0.5, 0], ang, rb, rt, color: i % 2 ? '#7d5d3f' : '#8d6c49' });
    x += Math.sin(ang) * ALTO_SEG;
    y += Math.cos(ang) * ALTO_SEG;
    ang += 0.045;
  }
  return { segmentos: lista, copa: [x, y, 0] as V3 };
}

// Tronco segmentado con anillos y cocos. Va dentro de un <Fundido>; las hojas van aparte (HojasPalmera) para conservar su degradé.
export function PalmeraDetallada({ p, escala = 1 }: { p: V3; escala?: number }) {
  const { segmentos, copa } = useMemo(troncoPalmera, []);
  return (
    <group position={p} scale={escala}>
      {segmentos.map((s, i) => (
        <group key={i}>
          <mesh position={s.pos} rotation={[0, 0, -s.ang]}>
            <cylinderGeometry args={[s.rt, s.rb, ALTO_SEG, 9]} />
            <meshStandardMaterial color={s.color} roughness={0.95} flatShading />
          </mesh>
          <mesh position={[s.pos[0] - Math.sin(s.ang) * (ALTO_SEG / 2), s.pos[1] - Math.cos(s.ang) * (ALTO_SEG / 2), 0]} rotation={[0, 0, -s.ang]}>
            <cylinderGeometry args={[s.rb + 0.02, s.rb + 0.02, 0.035, 9]} />
            <meshStandardMaterial color="#5e442c" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
      <group position={copa}>
        {[[0.1, 0, 0.08], [-0.08, -0.04, 0.1], [0.02, -0.06, -0.12]].map(([cx, cy, cz], i) => (
          <mesh key={i} position={[cx, cy, cz]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshStandardMaterial color="#5b3f24" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Las 10 hojas de una palmera fundidas en UNA malla con color por vértice (una llamada de dibujo).
export function HojasPalmera({ p, escala = 1 }: { p: V3; escala?: number }) {
  const geo = useMemo(() => {
    const base = geometriaFronda();
    const { copa } = troncoPalmera();
    const partes = Array.from({ length: 10 }, (_, i) => {
      const g = base.clone();
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(copa[0], copa[1], copa[2]),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (i / 10) * Math.PI * 2 + (i % 2) * 0.2, 0.18 + (i % 3) * 0.2 - 0.2, 'YZX')),
        new THREE.Vector3(1, 1, 1).multiplyScalar(0.85 + (i % 3) * 0.1)
      );
      g.applyMatrix4(m);
      return g;
    });
    base.dispose();
    return fusionar(partes);
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={p} scale={escala}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.8} />
    </mesh>
  );
}
