'use client';

// Casa ampliada (más cuartos que la base, ver lib/visao3dCasaPlano.ts): paredes, ventanas y decorado de los cuartos del plano.
// Los cuartos agregados llevan pisos y paredes del color de su grupo y un decorado elegido al azar (siempre el mismo para el
// mismo cuarto: la semilla sale de su id), con el frente libre para los pilares de las cuentas.

import { Alfombra, Archivero, Cuadro, Estante, Foco, Lampara, MesaLateral } from './Mobiliario';
import { Pared, Ventana, VentanaFondo, esInteriorEn, huecoInterior } from './Paredes';
import { Hora, V3 } from './estructura';
import { Z_ATRAS } from './layout';
import type { Cuarto } from '@/lib/visao3dCasaPlano';
import * as THREE from 'three';

export const IDS_BASE = ['garage', 'living', 'dormitorio', 'oficina', 'comedor'];
export const esCuartoAgregado = (c: Cuarto) => !IDS_BASE.includes(c.id);

// Dónde caen las ventanas del fondo en los cuartos de la base (las del resto van al centro del cuarto).
const VENTANA_FONDO_BASE: Record<string, number> = { garage: -8.65, living: -2.55, dormitorio: -2.55, oficina: 3.7, comedor: 5.4 };

function alAzar(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Un puñado de piezas elegidas al azar contra la pared del fondo y el centro; nada en el frente (z > 1), donde van los pilares.
export function Decorado({ cuarto }: { cuarto: Cuarto }) {
  const azar = alAzar(cuarto.id);
  const { x0, x1, y0 } = cuarto;
  const ancho = x1 - x0;
  const piezas: Array<'cuadros' | 'estante' | 'mesa' | 'alfombra' | 'archivero'> = ['cuadros', 'estante', 'mesa', 'alfombra', 'archivero'];
  const elegidas = piezas.filter(() => azar() < 0.62);
  if (elegidas.length === 0) elegidas.push('cuadros');
  const lado = azar() < 0.5 ? -1 : 1;
  const zFondo = Z_ATRAS + 0.07;
  const alAlzaFondo = (x: number, y: number): V3 => [x, y0 + y, zFondo + 0.04];
  const cx = (x0 + x1) / 2;
  return (
    <group>
      {elegidas.includes('cuadros') && (
        <>
          <Cuadro p={alAlzaFondo(cx - ancho * 0.18, 2.3)} s={[0.9 + azar() * 0.3, 0.7]} tono={Math.floor(azar() * 4)} />
          <Cuadro p={alAlzaFondo(cx + ancho * 0.1, 2.2)} s={[0.6, 0.8 + azar() * 0.2]} tono={Math.floor(azar() * 4)} />
        </>
      )}
      {elegidas.includes('estante') && <Estante p={[cx + lado * (ancho / 2 - 1.1), y0, Z_ATRAS + 0.35]} s={[1.1 + azar() * 0.3, 2.6, 0.4]} libros={azar() < 0.7} />}
      {elegidas.includes('mesa') && (
        <>
          <MesaLateral p={[cx - lado * (ancho / 2 - 0.8), y0, Z_ATRAS + 0.45]} />
          <Lampara p={[cx - lado * (ancho / 2 - 0.8), y0 + 0.6, Z_ATRAS + 0.45]} />
        </>
      )}
      {elegidas.includes('archivero') && <Archivero p={[cx + lado * 0.2, y0, Z_ATRAS + 0.45]} />}
      {elegidas.includes('alfombra') && <Alfombra p={[cx, y0 + 0.02, 0.2]} s={[Math.min(4.2, ancho - 1.4), 2.2]} color={['#7e8ba6', '#6f9b86', '#b58a6a', '#8d7fa8'][Math.floor(azar() * 4)]} />}
      {[-1.2, 1.4].map((z) => <Foco key={z} p={[cx - 1, y0 + 3.55, z]} />)}
      {[-1.2, 1.4].map((z) => <Foco key={`b${z}`} p={[cx + 1.4, y0 + 3.55, z]} />)}
    </group>
  );
}

// Paredes (exteriores con ventanas; interiores con paso) y ventanas de todos los cuartos del plano. Va dentro de un <Fundido>.
export function Cascaron({ cuartos, hora, reflejo }: { cuartos: Cuarto[]; hora: Hora; reflejo: THREE.Texture }) {
  const paredes = new Map<string, { x: number; y0: number; interior: boolean }>();
  cuartos.forEach((c) => {
    [c.x0, c.x1].forEach((x) => {
      const clave = `${x.toFixed(2)}|${c.y0}`;
      if (!paredes.has(clave)) paredes.set(clave, { x, y0: c.y0, interior: esInteriorEn(cuartos, c, x) });
    });
  });
  return (
    <group>
      {[...paredes.entries()].map(([clave, p]) => (
        <Pared key={clave} x={p.x} y0={p.y0} y1={p.y0 + (p.interior ? 3.6 : 3.68)} hueco={p.interior ? huecoInterior(p.x, p.y0) : undefined} />
      ))}
      {cuartos.map((c) => (
        <group key={c.id}>
          <VentanaFondo x={VENTANA_FONDO_BASE[c.id] ?? (c.x0 + c.x1) / 2} y={c.y0 + (c.y0 === 0 ? 1.9 : 1.7)} hora={hora} reflejo={reflejo} />
          {([[c.x0, 1], [c.x1, -1]] as Array<[number, 1 | -1]>)
            .filter(([x]) => !esInteriorEn(cuartos, c, x))
            .map(([x, lado]) => (
              <group key={x}>
                <Ventana x={x} y={c.y0 + (c.y0 === 0 ? 1.9 : 1.7)} z={-0.2} lado={lado} hora={hora} reflejo={reflejo} />
                <Ventana x={x} y={c.y0 + (c.y0 === 0 ? 1.9 : 1.7)} z={-0.2} lado={(-lado) as 1 | -1} desfase={0.03} hora={hora} reflejo={reflejo} />
              </group>
            ))}
        </group>
      ))}
    </group>
  );
}
