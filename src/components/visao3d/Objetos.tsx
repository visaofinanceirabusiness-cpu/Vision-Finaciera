'use client';

// Objetos 3D de las cuentas (hechos con formas simples, sin modelos externos): auto, casa, mesa, billetes…
// Todos miden aproximadamente 1 × 1 × 1 apoyados en y = 0. El color lo decide quien los usa (grupo / gris / rojo).

import type { TipoObjeto } from '@/lib/visao3dObjetos';

type Props = { color: string; apagado: boolean };

function Material({ color, apagado, oscuro = false }: { color: string; apagado: boolean; oscuro?: boolean }) {
  return (
    <meshStandardMaterial
      color={oscuro ? '#1e293b' : color}
      emissive={oscuro ? '#000000' : color}
      emissiveIntensity={apagado ? 0.03 : 0.22}
      roughness={0.38}
      metalness={0.35}
      envMapIntensity={1.3}
    />
  );
}

function Auto({ color, apagado }: Props) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.3, 0.3, 0.62]} />
        <Material color={color} apagado={apagado} />
      </mesh>
      <mesh position={[-0.05, 0.56, 0]}>
        <boxGeometry args={[0.68, 0.26, 0.54]} />
        <Material color={color} apagado={apagado} />
      </mesh>
      {[-0.42, 0.42].flatMap((x) => [-0.3, 0.3].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 0.15, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.12, 14]} />
          <Material color={color} apagado={apagado} oscuro />
        </mesh>
      )))}
    </group>
  );
}

function Casa({ color, apagado }: Props) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.95, 0.6, 0.85]} />
        <Material color={color} apagado={apagado} />
      </mesh>
      <mesh position={[0, 0.84, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.82, 0.48, 4]} />
        <Material color={color} apagado={apagado} oscuro />
      </mesh>
    </group>
  );
}

function Mesa({ color, apagado }: Props) {
  return (
    <group>
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[1.15, 0.08, 0.75]} />
        <Material color={color} apagado={apagado} />
      </mesh>
      {[-0.5, 0.5].flatMap((x) => [-0.3, 0.3].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 0.26, z]}>
          <boxGeometry args={[0.08, 0.52, 0.08]} />
          <Material color={color} apagado={apagado} />
        </mesh>
      )))}
    </group>
  );
}

function Equipo({ color, apagado }: Props) {
  return (
    <group>
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[0.95, 0.58, 0.07]} />
        <Material color={color} apagado={apagado} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.12, 0.36, 0.1]} />
        <Material color={color} apagado={apagado} oscuro />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.55, 0.06, 0.32]} />
        <Material color={color} apagado={apagado} oscuro />
      </mesh>
    </group>
  );
}

function Cajas({ color, apagado }: Props) {
  const posiciones: Array<[number, number, number]> = [[-0.28, 0.22, 0], [0.28, 0.22, 0], [0, 0.66, 0]];
  return (
    <group>
      {posiciones.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.52, 0.44, 0.52]} />
          <Material color={color} apagado={apagado} />
        </mesh>
      ))}
    </group>
  );
}

function Banco({ color, apagado }: Props) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.15, 0.1, 0.75]} />
        <Material color={color} apagado={apagado} />
      </mesh>
      {[-0.42, -0.14, 0.14, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.4, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.6, 10]} />
          <Material color={color} apagado={apagado} />
        </mesh>
      ))}
      <mesh position={[0, 0.74, 0]}>
        <boxGeometry args={[1.25, 0.1, 0.85]} />
        <Material color={color} apagado={apagado} />
      </mesh>
      <mesh position={[0, 0.94, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.8, 3]} />
        <Material color={color} apagado={apagado} oscuro />
      </mesh>
    </group>
  );
}

function Monedas({ color, apagado }: Props) {
  return (
    <group>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, 0.06 + i * 0.1, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.09, 20]} />
          <Material color={color} apagado={apagado} />
        </mesh>
      ))}
      <mesh position={[0.5, 0.06, 0.1]}>
        <cylinderGeometry args={[0.2, 0.2, 0.09, 16]} />
        <Material color={color} apagado={apagado} />
      </mesh>
    </group>
  );
}

function Billetes({ color, apagado }: Props) {
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[(i % 2) * 0.04, 0.05 + i * 0.1, 0]} rotation={[0, (i - 1.5) * 0.12, 0]}>
          <boxGeometry args={[0.95, 0.08, 0.5]} />
          <Material color={color} apagado={apagado} />
        </mesh>
      ))}
    </group>
  );
}

function Documento({ color, apagado }: Props) {
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.03 + i * 0.07, 0]} rotation={[0, (i - 1.5) * 0.1, 0]}>
          <boxGeometry args={[0.7, 0.05, 0.92]} />
          <Material color={color} apagado={apagado} />
        </mesh>
      ))}
      <mesh position={[0, 0.38, 0.35]}>
        <boxGeometry args={[0.3, 0.08, 0.08]} />
        <Material color={color} apagado={apagado} oscuro />
      </mesh>
    </group>
  );
}

function Capital({ color, apagado }: Props) {
  // Pila grande de monedas con una más arriba: lo aportado por los dueños.
  return (
    <group>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh key={i} position={[0, 0.06 + i * 0.1, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.09, 24]} />
          <Material color={color} apagado={apagado} />
        </mesh>
      ))}
    </group>
  );
}

function Resultado({ color, apagado }: Props) {
  return (
    <group>
      {[0.3, 0.55, 0.85].map((h, i) => (
        <mesh key={i} position={[(i - 1) * 0.36, h / 2, 0]}>
          <boxGeometry args={[0.28, h, 0.5]} />
          <Material color={color} apagado={apagado} />
        </mesh>
      ))}
    </group>
  );
}

function Caja({ color, apagado }: Props) {
  return (
    <mesh position={[0, 0.3, 0]}>
      <boxGeometry args={[0.7, 0.6, 0.7]} />
      <Material color={color} apagado={apagado} />
    </mesh>
  );
}

const COMPONENTES: Record<TipoObjeto, (p: Props) => React.ReactElement> = {
  auto: Auto,
  casa: Casa,
  mesa: Mesa,
  equipo: Equipo,
  mercaderia: Cajas,
  banco: Banco,
  ahorro: Monedas,
  billetes: Billetes,
  documento: Documento,
  capital: Capital,
  resultado: Resultado,
  caja: Caja,
};

export function ObjetoCuenta({ tipo, color, apagado }: { tipo: TipoObjeto; color: string; apagado: boolean }) {
  const Componente = COMPONENTES[tipo];
  return <Componente color={color} apagado={apagado} />;
}
