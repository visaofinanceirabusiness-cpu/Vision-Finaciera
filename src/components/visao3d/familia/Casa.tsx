'use client';

import { Fundido, texturaArte, texturaProcedural, texturaTela } from '../base/Compartido3D';
import { ObjetoCatalogo } from '../base/catalogo/ObjetoCatalogo';
import { Amenidad } from './Amenidad';
import { Fachada } from './Fachada';
import { Habitacion } from './Habitacion';
import { useTexturaLuz } from './LuzNoche';
import { Alfombra, Archivero, Caja, Cajas, Cama, Cuadro, Escritorio, Estante, Foco, Lampara, LamparaColgante, Mesa, MesaCentro, MesaLateral, NocheCtx, Persona, Silla, SillaOficina, TexturasCasa, TexturasCtx, useTexturas } from './Mobiliario';
import { Ahorro, AutoSUV, Banco, Billetes, CajaOtros, Capital, Documentos, Maqueta, Plinto, Resultado, Sofa, TV, Tarjeta } from './Objetos';
import { Pared, PuertaFondo, Tabiques, Ventana, VentanaFondo, huecoEn, texturaReflejo } from './Paredes';
import { PersonaViva } from './Personas';
import { CuadroLogo } from './Sabio';
import { SombrasCasa, huellasDeObjetos } from './Sombras';
import { ALTO_PILAR, HORAS, Hora, ZONAS, lugarDe } from './estructura';
import { X_CENTRO, X_COCHERA, X_DER, X_IZQ, Z_ATRAS, desplazarX } from './layout';
import { normalizar } from '@/lib/gruposActivo';
import { NodoEdificio } from '@/lib/visao3d';
import { ObjetoCasa } from '@/lib/visao3dCasa';
import { COLOR_GRUPO } from '@/lib/visao3dLayout';
import { useMemo } from 'react';
import * as THREE from 'three';

export function Casa({ hora, noche, esPT, objetos, seleccionadoId, hover, setHover, onSeleccionar }: { hora: Hora; noche: boolean; esPT: boolean; objetos: ObjetoCasa[]; seleccionadoId: string | null; hover: string | null; setHover: (id: string | null) => void; onSeleccionar: (n: NodoEdificio) => void }) {
  const piso = useTexturas({ madera: () => texturaProcedural('madera', 3), concreto: () => texturaProcedural('concreto', 3) });
  const arte = useTexturas({ a0: () => texturaArte('abstracto', 1), a1: () => texturaArte('paisaje', 2), a2: () => texturaArte('abstracto', 3), a3: () => texturaArte('paisaje', 4) });
  const pantallas = useTexturas({ tela: texturaTela, tv: () => texturaArte('tv', 5), monitor: () => texturaArte('grafico', 6) });
  const texturas = useMemo<TexturasCasa>(() => ({ ...pantallas, arte: [arte.a0, arte.a1, arte.a2, arte.a3] }), [pantallas, arte]);
  const luz = useTexturaLuz();
  const { reflejo } = useTexturas({ reflejo: texturaReflejo });
  type Pintura = { color: string; apagado: boolean; brillo: number; negativo: boolean };
  const lugares = useMemo(() => new Map(objetos.map((o) => [o.id, lugarDe(o)])), [objetos]);
  const huellas = useMemo(() => huellasDeObjetos(objetos, lugares), [objetos, lugares]);
  // Variante de cada objeto entre los de su mismo tipo (frascos, alcancía, cofre…): que los repetidos no se vean todos iguales.
  const variantes = useMemo(() => {
    const cuenta = new Map<string, number>();
    return new Map(objetos.map((o) => {
      const k = cuenta.get(o.tipo) ?? 0;
      cuenta.set(o.tipo, k + 1);
      return [o.id, k] as const;
    }));
  }, [objetos]);
  const amen = (o: ObjetoCasa, hijo: (p: Pintura) => React.ReactNode, directo = false) => (
    <Amenidad key={o.id} objeto={o} lugar={lugares.get(o.id)!} hover={hover === o.id} seleccionada={seleccionadoId === o.id} onHover={setHover} onSeleccionar={onSeleccionar} directo={directo}>
      {hijo}
    </Amenidad>
  );
  // Objeto que puede reemplazarse por un modelo GLB del catálogo (si no hay, se ve el procedural de siempre).
  const amenCatalogo = (o: ObjetoCasa, idCatalogo: string, procedural: (p: Pintura) => React.ReactNode) =>
    amen(o, (p) => <ObjetoCatalogo id={idCatalogo} estado={p} claveFundido={`${p.color}|${p.brillo}`} procedural={procedural(p)} />, true);
  const objetoPorCuenta = (o: ObjetoCasa) => {
    if (o.modo === 'auto') return amenCatalogo(o, 'auto', (p) => <AutoSUV pintura={p} />);
    if (o.modo === 'sofa') return amenCatalogo(o, 'sofa', (p) => <Sofa pintura={p} />);
    if (o.modo === 'tv') return amen(o, (p) => <TV pintura={p} />);
    switch (o.tipo) {
      case 'casa': return amen(o, (p) => <Maqueta pintura={p} />);
      case 'ahorro': return amen(o, (p) => <Ahorro pintura={p} variante={variantes.get(o.id) ?? 0} />);
      case 'banco': return amen(o, (p) => <Banco pintura={p} />);
      case 'billetes': return amen(o, (p) => <Billetes pintura={p} />);
      case 'capital': return amen(o, (p) => <Capital pintura={p} />);
      case 'resultado': return amen(o, (p) => <Resultado pintura={p} />);
      case 'documento': {
        if (/TARJETA|CARTAO|CREDITO/.test(normalizar(o.nodo.nombre))) return amen(o, (p) => <Tarjeta pintura={p} />);
        const variante = o.grupoPanel === 'POR_COBRAR' ? 0 : o.grupoPanel === 'DEUDAS' || o.grupoPanel === 'LARGO_PLAZO' ? 1 : 2;
        return amen(o, (p) => <Documentos pintura={p} variante={variante} />);
      }
      default: return amen(o, (p) => <CajaOtros pintura={p} />);
    }
  };

  return (
    <NocheCtx.Provider value={noche}>
    <TexturasCtx.Provider value={texturas}>
    <group>
      {/* Habitaciones. */}
      <Habitacion zona={ZONAS.garage} piso={piso.concreto} tinte={HORAS[hora].piso} />
      <Habitacion zona={ZONAS.living} piso={piso.madera} tinte={HORAS[hora].piso} />
      <Habitacion zona={ZONAS.dormitorio} piso={piso.madera} tinte={HORAS[hora].piso} />
      <Habitacion zona={ZONAS.oficina} piso={piso.madera} tinte={HORAS[hora].piso} />
      <Habitacion zona={ZONAS.comedor} piso={piso.madera} tinte={HORAS[hora].piso} />
      <SombrasCasa extra={huellas} />
      {/* Cuadro con el logo y el lema de Visão Financeira en la pared del fondo de la cochera. */}
      <CuadroLogo p={[(X_IZQ + X_COCHERA) / 2, 2.1, Z_ATRAS + 0.12]} esPT={esPT} />
      <Tabiques />

      <Fundido key={hora}>
      {/* Techos. */}
      <Caja p={[(X_COCHERA + X_DER) / 2, 7.5, 0.0]} s={[X_DER - X_COCHERA + 0.4, 0.16, 8.4]} color="#e9edf3" rough={0.6} />
      <Caja p={[(X_IZQ + X_COCHERA) / 2, 3.68, 0.325]} s={[X_COCHERA - X_IZQ + 0.1, 0.16, 7.75]} color="#e9edf3" rough={0.6} />
      <Fachada />

      {objetos.filter((o) => o.modo === 'plinto').map((o) => {
        const [x, y, z] = lugares.get(o.id)!.pos;
        return <Plinto key={o.id} p={[x, y - ALTO_PILAR, z]} h={ALTO_PILAR} acento={COLOR_GRUPO[o.zona]} />;
      })}

      {/* Paredes exteriores e interiores (con pasos entre cuartos) y ventanas. */}
      <Pared x={X_IZQ} y0={0} y1={3.68} />
      <Pared x={X_COCHERA} y0={0} y1={3.6} hueco={huecoEn(X_COCHERA, 0)} />
      <Pared x={X_CENTRO} y0={0} y1={3.6} hueco={huecoEn(X_CENTRO, 0)} />
      <Pared x={X_DER} y0={0} y1={3.6} />
      <Pared x={X_COCHERA} y0={3.75} y1={7.42} />
      <Pared x={X_CENTRO} y0={3.75} y1={7.42} hueco={huecoEn(X_CENTRO, 3.75)} />
      <Pared x={X_DER} y0={3.75} y1={7.42} />
      <Ventana x={X_IZQ} y={1.9} z={-1.0} lado={1} hora={hora} reflejo={reflejo} />
      <Ventana x={X_DER} y={1.9} z={-0.2} lado={-1} hora={hora} reflejo={reflejo} />
      <Ventana x={X_DER} y={5.5} z={-0.2} lado={-1} hora={hora} reflejo={reflejo} />
      <Ventana x={X_COCHERA} y={5.5} z={0.2} lado={1} hora={hora} reflejo={reflejo} />
      {/* Las mismas ventanas vistas desde afuera, sobre el ladrillo. */}
      <Ventana x={X_IZQ} y={1.9} z={-1.0} lado={-1} desfase={0.03} hora={hora} reflejo={reflejo} />
      <Ventana x={X_DER} y={1.9} z={-0.2} lado={1} desfase={0.03} hora={hora} reflejo={reflejo} />
      <Ventana x={X_DER} y={5.5} z={-0.2} lado={1} desfase={0.03} hora={hora} reflejo={reflejo} />
      <Ventana x={X_COCHERA} y={5.5} z={0.2} lado={-1} desfase={0.03} hora={hora} reflejo={reflejo} />
      {/* Fondo de la casa: ventanas y puerta trasera. */}
      <VentanaFondo x={-8.65} y={1.9} hora={hora} reflejo={reflejo} />
      <VentanaFondo x={-2.55} y={1.9} hora={hora} reflejo={reflejo} />
      <VentanaFondo x={5.4} y={1.9} hora={hora} reflejo={reflejo} />
      <PuertaFondo x={2.4} noche={noche} />
      <VentanaFondo x={-2.55} y={5.45} ancho={2.0} hora={hora} reflejo={reflejo} />
      <VentanaFondo x={3.7} y={5.45} ancho={2.0} hora={hora} reflejo={reflejo} />


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

      {/* Focos empotrados en el techo de cada habitación. */}
      {[[-7.7, 3.55], [-3.0, 3.55], [-1.0, 3.55], [-3.0, 7.3], [-1.0, 7.3], [2.2, 7.3], [4.4, 7.3], [2.2, 3.55], [4.4, 3.55]].flatMap(([x, y]) => [-1.2, 1.4].map((z) => <Foco key={`${x}${y}${z}`} p={[desplazarX(x), y, z]} />))}

      {noche && luz && [[-7.7, 0], [-3.0, 0], [-1.0, 0], [-3.0, 3.75], [-1.0, 3.75], [2.2, 3.75], [4.4, 3.75], [2.2, 0], [4.4, 0]].flatMap(([x, y]) => [-1.2, 1.4].map((z) => (
        <mesh key={`lz${x}${y}${z}`} position={[desplazarX(x), y + 0.058, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.2, 3.2]} />
          <meshBasicMaterial map={luz} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      )))}

      {/* Familia: 3 adultos (dormitorio, oficina y la mamá que camina living ↔ cochera) y 2 niños jugando en el jardín. */}
      <Persona p={[desplazarX(3.2), 4.25, -1.45]} rot={Math.PI} sentado ropa="#4a6fb5" pantalon="#232936" pelo="#3a2a1e" />
      </Fundido>

      {/* Personas con movimiento: cada una con su propio Fundido (pocas mallas) y solo se anima su grupo. */}
      <PersonaViva modo="quieta" p={[desplazarX(-1.3), 3.75, 0.3]} rot={Math.PI * 0.85} ropa="#c9647f" pantalon="#2f3a52" pelo="#5b3a22" fase={0} />
      {/* La mamá camina del living a la cochera por el paso entre cuartos; los dos niños juegan a perseguirse en el jardín. */}
      <PersonaViva modo="paseo" p={[-1.6, 0, 1.45]} hasta={-10.3} ropa="#c9647f" pantalon="#2a2f3b" pelo="#8a5a2b" fase={0.2} />
      <PersonaViva modo="juego" p={[4.6, 0, 12.7]} radio={1.4} esc={0.62} ropa="#ff8a5c" pantalon="#364763" pelo="#8a5a2b" fase={0} />
      <PersonaViva modo="juego" p={[4.6, 0, 12.7]} radio={1.4} esc={0.62} ropa="#e0a63c" pantalon="#364763" pelo="#5b3a22" fase={0.42} />

      {/* Amenidades: son interactivas y cambian de color con el saldo, por eso no se funden. */}
      {objetos.map(objetoPorCuenta)}
    </group>
    </TexturasCtx.Provider>
    </NocheCtx.Provider>
  );
}
