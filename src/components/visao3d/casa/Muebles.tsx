'use client';

// Mobiliario de los 5 cuartos de la casa base según el tema (perfil de la empresa). Las coordenadas son del mundo: el living y el
// dormitorio ocupan x de -5,7 a 0,6; la oficina y el comedor, de 0,6 a 6,8; la pared del fondo está en z = -3,45 y el frente
// (z > 1,5) queda libre para los pilares de las cuentas. El sofá y la TV de las cuentas van en el living (x < -2).

import { Alfombra, Archivero, Caja, Cajas, Cama, Cuadro, Escritorio, Estante, Lampara, LamparaColgante, Mesa, MesaCentro, MesaLateral, Silla, SillaOficina } from './Mobiliario';
import type { TipoMuebles } from './temas';

function MueblesFamilia() {
  return (
    <>
      <group position={[-0.5, 0, 0]}>
      {/* Living. */}
      <Alfombra p={[-2.1, 0.02, 0.5]} s={[3.8, 2.6]} color="#7e8ba6" />
      <Estante p={[0.05, 0, -3.1]} s={[1.0, 2.8, 0.4]} />
      <Cuadro p={[-1.5, 2.3, -3.37]} s={[1.0, 0.7]} tono={0} />
      <Cuadro p={[-0.2, 2.2, -3.37]} s={[0.6, 0.8]} tono={1} />
      <MesaCentro p={[-1.9, 0, 0.7]} />

      {/* Dormitorio. */}
      <Cama p={[-2.4, 3.75, -2.1]} />
      <MesaLateral p={[-4.0, 3.75, -3.0]} />
      <MesaLateral p={[-0.8, 3.75, -3.0]} />
      <Lampara p={[-4.0, 4.35, -3.0]} />
      <Lampara p={[-0.8, 4.35, -3.0]} />
      <Cuadro p={[-3.2, 5.8, -3.37]} s={[0.7, 0.9]} tono={2} />
      <Cuadro p={[-1.6, 5.8, -3.37]} s={[0.7, 0.9]} tono={3} />
      </group>
      <group position={[0.5, 0, 0]}>

      {/* Oficina. */}
      <Escritorio p={[3.2, 3.75, -2.6]} />
      <SillaOficina p={[3.2, 3.75, -1.5]} rot={Math.PI} />
      <Archivero p={[5.2, 3.75, -3.0]} />
      <Estante p={[1.35, 3.75, -3.15]} s={[1.3, 2.8, 0.4]} libros={false} />
      <Cajas p={[1.3, 4.7, -3.15]} n={3} />
      <Cajas p={[1.3, 5.6, -3.15]} n={2} />
      <Cuadro p={[4.3, 6.0, -3.37]} s={[0.9, 0.6]} tono={0} />

      {/* Comedor. */}
      <Mesa p={[3.2, 0, 0.3]} ancho={3.2} fondo={1.5} />
      {[-1.1, 0, 1.1].flatMap((x) => [-1, 1].map((s) => <Silla key={`${x}${s}`} p={[3.2 + x, 0, 0.3 + s * 1.05]} rot={s > 0 ? Math.PI : 0} color="#cfe9d8" />))}
      <LamparaColgante p={[2.4, 2.8, 0.3]} />
      <LamparaColgante p={[4.0, 2.8, 0.3]} />
      <Caja p={[3.2, 1.55, -3.37]} s={[2.5, 1.45, 0.05]} color="#0e1814" emissive="#b57bff" ei={0.18} />
      <Alfombra p={[3.2, 0.02, 0.3]} s={[4.2, 2.8]} color="#6f9b86" />
      </group>
    </>
  );
}

// Mostrador con caja registradora.
function Mostrador({ p, ancho = 3 }: { p: [number, number, number]; ancho?: number }) {
  return (
    <group position={p}>
      <Caja p={[0, 0.5, 0]} s={[ancho, 1.0, 0.8]} color="#8c6a4a" rough={0.55} />
      <Caja p={[0, 1.03, 0]} s={[ancho + 0.1, 0.06, 0.9]} color="#e9e2d4" rough={0.4} />
      <Caja p={[ancho / 2 - 0.5, 1.2, 0]} s={[0.5, 0.28, 0.4]} color="#2f3744" />
      <Caja p={[ancho / 2 - 0.5, 1.4, -0.08]} s={[0.4, 0.14, 0.06]} color="#6ee7b7" emissive="#34d399" ei={0.5} />
    </group>
  );
}

function MueblesComercial() {
  return (
    <>
      {/* Salón de ventas (living): góndolas con mercadería y mostrador. */}
      <Estante p={[-0.8, 0, -3.1]} s={[1.5, 2.6, 0.4]} libros={false} />
      <Cajas p={[-0.8, 0.55, -3.1]} n={3} />
      <Estante p={[-3.9, 0, -3.1]} s={[1.5, 2.6, 0.4]} libros={false} />
      <Mostrador p={[-1.6, 0, -0.4]} ancho={2.8} />
      <Cuadro p={[-2.6, 2.4, -3.37]} s={[1.1, 0.7]} tono={1} />
      {/* Depósito (dormitorio): estantes y pilas de cajas. */}
      <Estante p={[-4.6, 3.75, -3.1]} s={[1.5, 2.8, 0.4]} libros={false} />
      <Estante p={[-2.9, 3.75, -3.1]} s={[1.5, 2.8, 0.4]} libros={false} />
      <Cajas p={[-4.6, 4.7, -3.1]} n={3} />
      <Cajas p={[-0.9, 3.75, -2.7]} n={4} />
      <Cajas p={[-0.9, 4.25, -2.7]} n={2} />
      {/* Administración (oficina). */}
      <Escritorio p={[3.0, 3.75, -2.6]} />
      <SillaOficina p={[3.0, 3.75, -1.5]} rot={Math.PI} />
      <Archivero p={[5.6, 3.75, -3.0]} />
      <Cuadro p={[4.4, 6.0, -3.37]} s={[0.9, 0.6]} tono={2} />
      {/* Atención y cobranza (comedor): mesa de trabajo. */}
      <Mesa p={[3.7, 0, 0.3]} ancho={3.0} fondo={1.3} />
      {[-1, 0, 1].map((x) => <Silla key={x} p={[3.7 + x * 1.0, 0, 1.3]} rot={Math.PI} color="#c9d3e0" />)}
      <Caja p={[3.7, 1.55, -3.37]} s={[2.5, 1.45, 0.05]} color="#10151c" emissive="#7aa7ff" ei={0.18} />
      <Alfombra p={[3.7, 0.02, 0.3]} s={[4.2, 2.6]} color="#8d99ae" />
    </>
  );
}

function MueblesOficina() {
  const puesto = (x: number, y: number, k: string) => (
    <group key={k}>
      <Escritorio p={[x, y, -2.6]} />
      <SillaOficina p={[x, y, -1.5]} rot={Math.PI} />
    </group>
  );
  return (
    <>
      {/* Recepción (living). */}
      <Mostrador p={[-0.9, 0, -2.6]} ancho={2.6} />
      <Cuadro p={[-2.8, 2.4, -3.37]} s={[1.2, 0.8]} tono={0} />
      <Alfombra p={[-1.8, 0.02, 0.5]} s={[3.4, 2.2]} color="#6b7a99" />
      {/* Sala de reuniones (dormitorio). */}
      <Mesa p={[-2.55, 3.75, -1.0]} ancho={3.4} fondo={1.4} />
      {[-1.2, -0.4, 0.4, 1.2].map((x) => <Silla key={x} p={[-2.55 + x, 3.75, 0.0]} rot={Math.PI} color="#aab7cc" />)}
      <Caja p={[-2.55, 5.55, -3.37]} s={[2.6, 1.4, 0.05]} color="#0e1420" emissive="#7aa7ff" ei={0.22} />
      {/* Puestos de trabajo (oficina y comedor). */}
      {puesto(2.4, 3.75, 'a')}
      {puesto(5.0, 3.75, 'b')}
      <Archivero p={[6.3, 3.75, -3.0]} />
      {puesto(2.4, 0, 'c')}
      {puesto(5.0, 0, 'd')}
      <Cuadro p={[3.7, 2.4, -3.37]} s={[1.0, 0.7]} tono={3} />
    </>
  );
}

function MueblesTaller() {
  return (
    <>
      {/* Depósito de insumos (living). */}
      <Estante p={[-0.9, 0, -3.1]} s={[1.6, 2.8, 0.4]} libros={false} />
      <Cajas p={[-0.9, 0.55, -3.1]} n={3} />
      <Cajas p={[-0.9, 1.5, -3.1]} n={2} />
      <Cajas p={[-1.4, 0, 0.6]} n={4} />
      <Cajas p={[-1.4, 0.5, 0.6]} n={2} />
      {/* Línea de producción (dormitorio): mesas de trabajo largas. */}
      <Mesa p={[-2.9, 3.75, -1.6]} ancho={3.6} fondo={1.0} />
      <Mesa p={[-2.9, 3.75, 0.2]} ancho={3.6} fondo={1.0} />
      <Cajas p={[-0.8, 3.75, -2.9]} n={3} />
      {/* Oficina de planta. */}
      <Escritorio p={[2.8, 3.75, -2.6]} />
      <SillaOficina p={[2.8, 3.75, -1.5]} rot={Math.PI} />
      <Archivero p={[5.6, 3.75, -3.0]} />
      <Estante p={[1.35, 3.75, -3.15]} s={[1.3, 2.8, 0.4]} libros={false} />
      {/* Empaque y despacho (comedor). */}
      <Mesa p={[3.7, 0, -0.4]} ancho={3.4} fondo={1.2} />
      <Cajas p={[2.4, 0.8, -0.4]} n={2} />
      <Cajas p={[5.6, 0, 0.9]} n={4} />
      <Cajas p={[1.4, 0, 1.0]} n={3} />
    </>
  );
}

export function MueblesBase({ tipo }: { tipo: TipoMuebles }) {
  if (tipo === 'comercial') return <MueblesComercial />;
  if (tipo === 'oficina') return <MueblesOficina />;
  if (tipo === 'taller') return <MueblesTaller />;
  return <MueblesFamilia />;
}
