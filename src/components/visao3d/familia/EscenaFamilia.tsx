'use client';

import { CamaraGuiada, Cielo, Etiqueta, GrupoAnimado, Proyector, SombrasCtx } from '../base/Compartido3D';
import { Iluminacion } from '../base/Iluminacion';
import { useConfigCatalogo } from '../base/catalogo/ObjetoCatalogo';
import { Casa } from './Casa';
import { Montanas, Nubes, Trafico } from './Entorno';
import { Exterior } from './Exterior';
import { Globo } from './Globos';
import { Estrellas } from './LuzNoche';
import { Sabio } from './Sabio';
import { CLAVE_HORA, HORAS, Hora, SABIO_POS, V3, encuadreDe, lugarDe } from './estructura';
import { GrupoId, NodoEdificio } from '@/lib/visao3d';
import { leerCalidad, usaSombras } from '@/lib/visao3dCalidad';
import { ObjetoCasa } from '@/lib/visao3dCasa';
import { COLOR_GRUPO } from '@/lib/visao3dLayout';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Props = {
  objetos: ObjetoCasa[];
  totales: Record<GrupoId, { nombre: string; saldo: number }>;
  seleccionadoId: string | null;
  onSeleccionar: (nodo: NodoEdificio) => void;
  formatear: (valor: number) => string;
  movimientoReducido: boolean;
  periodoClave: string;
  esPT?: boolean;
};

// Con dos dedos (o botón derecho) se puede desplazar la vista, sin salirse de la escena.
const LIMITE_PAN = new THREE.Box3(new THREE.Vector3(-17, 0, -6), new THREE.Vector3(13, 9, 8));

export default function EscenaCasa({ objetos, totales, seleccionadoId, onSeleccionar, formatear, movimientoReducido, periodoClave, esPT }: Props) {
  const [hora, setHoraEstado] = useState<Hora>('atardecer');
  useEffect(() => {
    try {
      const guardada = localStorage.getItem(CLAVE_HORA);
      if (guardada === 'dia' || guardada === 'atardecer' || guardada === 'noche') setHoraEstado(guardada);
    } catch {
      // sin almacenamiento: queda el atardecer
    }
  }, []);
  const setHora = (h: Hora) => {
    setHoraEstado(h);
    try {
      localStorage.setItem(CLAVE_HORA, h);
    } catch {
      // no pasa nada si no se puede recordar
    }
  };
  const cfg = HORAS[hora];
  const config = useConfigCatalogo();
  // Calidad del equipo: sombras suaves en tiempo real solo en equipos no táctiles de calidad alta.
  const [{ calidad, tactil }] = useState(leerCalidad);
  const sombras = usaSombras(calidad, tactil);
  const noche = hora === 'noche';
  const [hover, setHover] = useState<string | null>(null);
  // En teléfonos se baja la resolución interna: es lo que más pesa al dibujar.
  const [dprMax] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.75));
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const lugares = useMemo(() => new Map(objetos.map((o) => [o.id, lugarDe(o)])), [objetos]);
  const { objetivo, distancia } = useMemo(() => {
    const sel = objetos.find((o) => o.id === seleccionadoId);
    if (sel) {
      const [x, y, z] = lugares.get(sel.id)!.pos;
      const { dist, alto } = encuadreDe(sel);
      return { objetivo: new THREE.Vector3(x, y + alto, z), distancia: dist };
    }
    return { objetivo: new THREE.Vector3(-0.6, 4.0, 1.2), distancia: 29 };
  }, [objetos, lugares, seleccionadoId]);

  const etiquetas = useMemo<Etiqueta[]>(
    () =>
      objetos.map((o) => {
        const { pos } = lugares.get(o.id)!;
        return {
          id: o.id,
          x: pos[0],
          y: pos[1] + 1.0,
          z: pos[2] + 0.6,
          titulo: o.nodo.nombre,
          saldo: o.nodo.saldo,
          color: COLOR_GRUPO[o.zona],
          fija: false,
          seleccionada: seleccionadoId === o.id,
          alAlado: false,
        };
      }),
    [objetos, lugares, seleccionadoId]
  );

  const placas = useMemo(
    () =>
      (['ACTIVO', 'PASIVO', 'PATRIMONIO'] as GrupoId[]).map((g) => ({
        g,
        lineas: [totales[g].nombre.toUpperCase(), formatear(totales[g].saldo)],
        pos: (g === 'ACTIVO' ? [-9.6, 9.6, 1.0] : g === 'PASIVO' ? [9.9, 9.8, 1.0] : [10.2, 5.4, 0.6]) as V3,
        ancla: (g === 'ACTIVO' ? [-5.7, 5.5, 0.6] : g === 'PASIVO' ? [6.8, 5.5, 0.6] : [6.8, 1.7, 0.2]) as V3,
      })),
    [totales, formatear]
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows={sombras}
        dpr={[1, dprMax]}
        camera={{ position: [3, 8, 27], fov: 40, near: 0.5, far: 500 }}
        style={{ touchAction: 'none' }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
      >
        <Cielo activo paleta={hora} />
        {noche && <Estrellas />}
        <Montanas hora={hora} />
        <Nubes hora={hora} />
        <Trafico noche={noche} />
        <fog attach="fog" args={[cfg.niebla, 45, 120]} />
        <Iluminacion cfg={cfg} hora={hora} sombras={sombras} hdri={config?.hdri?.[hora]} />
        <ContactShadows key={`${periodoClave}|${seleccionadoId ?? ''}`} position={[0, -0.06, 0]} opacity={0.6} scale={50} blur={2.6} far={9} resolution={384} frames={40} color="#000000" />

        <SombrasCtx.Provider value={sombras}>
        <GrupoAnimado clave={`casa|${periodoClave}`} movimientoReducido={movimientoReducido}>
          <Exterior noche={noche} />
          <Sabio p={SABIO_POS} esc={1.2} rot={-0.35} esPT={esPT} />
          <Casa hora={hora} noche={noche} esPT={Boolean(esPT)} objetos={objetos} seleccionadoId={seleccionadoId} hover={hover} setHover={setHover} onSeleccionar={onSeleccionar} />
          {placas.map(({ g, lineas, pos, ancla }, i) => (
            <Globo key={g} pos={pos} ancla={ancla} lineas={lineas} color={COLOR_GRUPO[g]} fase={i * 2.1} />
          ))}
        </GrupoAnimado>
        </SombrasCtx.Provider>

        <OrbitControls makeDefault enablePan screenSpacePanning={false} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} onChange={(e) => e?.target.target.clamp(LIMITE_PAN.min, LIMITE_PAN.max)} minDistance={2.5} maxDistance={55} minPolarAngle={0.3} maxPolarAngle={Math.PI / 2 - 0.04} enableDamping dampingFactor={0.08} />
        <CamaraGuiada objetivo={objetivo} distancia={distancia} focoId="casa" movimientoReducido={movimientoReducido} />
        <Proyector etiquetas={etiquetas} refs={refs} />
      </Canvas>
      <div style={{ position: 'absolute', right: 12, top: 84, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 5 }}>
        {([['dia', '☀️', esPT ? 'Dia' : 'Día'], ['atardecer', '🌇', esPT ? 'Entardecer' : 'Atardecer'], ['noche', '🌙', 'Noche']] as const).map(([h, emoji, nombre]) => (
          <button
            key={h}
            type="button"
            title={nombre}
            aria-label={nombre}
            aria-pressed={hora === h}
            onClick={() => setHora(h)}
            style={{ width: 38, height: 38, borderRadius: 12, border: hora === h ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.35)', background: hora === h ? 'rgba(31,58,95,0.95)' : 'rgba(15,23,42,0.7)', fontSize: 18, cursor: 'pointer' }}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {etiquetas
          .filter((e) => e.fija || e.seleccionada || hover === e.id)
          .map((e) => (
            <div
              key={e.id}
              ref={(nodo) => {
                refs.current[e.id] = nodo;
              }}
              style={{ position: 'absolute', left: 0, top: 0, display: 'none', whiteSpace: 'nowrap', fontSize: 11, color: '#fff', background: 'rgba(8,16,32,0.82)', borderRadius: 8, padding: '3px 8px', border: e.seleccionada ? `1px solid ${e.color}` : '1px solid rgba(255,255,255,0.2)', lineHeight: 1.25, textAlign: 'center' }}
            >
              <b style={{ display: 'block' }}>{e.titulo}</b>
              <span style={{ color: e.saldo < 0 ? '#fca5a5' : '#fff' }}>{formatear(e.saldo)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
