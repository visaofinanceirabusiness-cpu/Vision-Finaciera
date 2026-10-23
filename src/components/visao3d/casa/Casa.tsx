'use client';

import { Fundido, texturaArte, texturaProcedural, texturaTela } from '../base/Compartido3D';
import { ObjetoCatalogo } from '../base/catalogo/ObjetoCatalogo';
import { Amenidad } from './Amenidad';
import { Cascaron, Decorado, IDS_BASE, esCuartoAgregado } from './Ampliacion';
import { Fachada, FachadaPlano } from './Fachada';
import { Habitacion } from './Habitacion';
import { useTexturaLuz } from './LuzNoche';
import { Caja, Foco, NocheCtx, Persona, TexturasCasa, TexturasCtx, useTexturas } from './Mobiliario';
import { MueblesBase } from './Muebles';
import { TemaCtx, type TemaCasa } from './temas';
import { Ahorro, AutoSUV, Banco, Billetes, CajaOtros, Capital, Documentos, Maqueta, Plinto, Resultado, Sofa, TV, Tarjeta } from './Objetos';
import { Pared, PuertaFondo, Tabiques, Ventana, VentanaFondo, huecoEn, texturaReflejo } from './Paredes';
import { PersonaViva } from './Personas';
import { CuadroLogo } from './Sabio';
import { SombrasCasa, huellasDeObjetos } from './Sombras';
import { ALTO_PILAR, HORAS, Hora, lugarDe } from './estructura';
import { X_CENTRO, X_COCHERA, X_DER, X_IZQ, Z_ATRAS, desplazarX } from './layout';
import { normalizar } from '@/lib/gruposActivo';
import { NodoEdificio } from '@/lib/visao3d';
import { ObjetoCasa } from '@/lib/visao3dCasa';
import type { PlanoCasa } from '@/lib/visao3dCasaPlano';
import { COLOR_GRUPO } from '@/lib/visao3dLayout';
import { useMemo } from 'react';
import * as THREE from 'three';

export function Casa({ hora, noche, esPT, tema, nombreEmpresa, plano, objetos, seleccionadoId, hover, setHover, onSeleccionar }: { hora: Hora; noche: boolean; esPT: boolean; tema: TemaCasa; nombreEmpresa: string; plano: PlanoCasa; objetos: ObjetoCasa[]; seleccionadoId: string | null; hover: string | null; setHover: (id: string | null) => void; onSeleccionar: (n: NodoEdificio) => void }) {
  const piso = useTexturas({ madera: () => texturaProcedural('madera', 3), concreto: () => texturaProcedural('concreto', 3) });
  const arte = useTexturas({ a0: () => texturaArte('abstracto', 1), a1: () => texturaArte('paisaje', 2), a2: () => texturaArte('abstracto', 3), a3: () => texturaArte('paisaje', 4) });
  const pantallas = useTexturas({ tela: texturaTela, tv: () => texturaArte('tv', 5), monitor: () => texturaArte('grafico', 6) });
  const texturas = useMemo<TexturasCasa>(() => ({ ...pantallas, arte: [arte.a0, arte.a1, arte.a2, arte.a3] }), [pantallas, arte]);
  const luz = useTexturaLuz();
  const { reflejo } = useTexturas({ reflejo: texturaReflejo });
  type Pintura = { color: string; apagado: boolean; brillo: number; negativo: boolean };
  const lugares = useMemo(() => new Map(objetos.map((o) => [o.id, lugarDe(o, plano)])), [objetos, plano]);
  const huellas = useMemo(() => huellasDeObjetos(objetos, lugares), [objetos, lugares]);
  // Los negocios usan siempre la fachada genérica (la de la casa base, con ladrillo y tejado, es solo de Familia).
  const ampliada = plano.cuartos.length > IDS_BASE.length || tema.id !== 'familia';
  const agregados = useMemo(() => plano.cuartos.filter(esCuartoAgregado), [plano]);
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
    <TemaCtx.Provider value={tema}>
    <NocheCtx.Provider value={noche}>
    <TexturasCtx.Provider value={texturas}>
    <group>
      {/* Habitaciones. */}
      {plano.cuartos.map((c) => <Habitacion key={c.id} zona={c} cuartos={plano.cuartos} piso={c.id === 'garage' ? piso.concreto : piso.madera} tinte={HORAS[hora].piso} />)}
      <SombrasCasa plano={plano} extra={huellas} />
      {/* Cuadro con el logo y el lema de Visão Financeira en la pared del fondo de la cochera. */}
      <CuadroLogo p={[(X_IZQ + X_COCHERA) / 2, 2.1, Z_ATRAS + 0.12]} esPT={esPT} />
      <Tabiques cuartos={plano.cuartos} />

      <Fundido key={hora}>
      {ampliada ? (
        <FachadaPlano cuartos={plano.cuartos} tema={tema} nombre={nombreEmpresa} />
      ) : (
        <>
      {/* Techos. */}
      <Caja p={[(X_COCHERA + X_DER) / 2, 7.5, 0.0]} s={[X_DER - X_COCHERA + 0.4, 0.16, 8.4]} color="#e9edf3" rough={0.6} />
      <Caja p={[(X_IZQ + X_COCHERA) / 2, 3.68, 0.325]} s={[X_COCHERA - X_IZQ + 0.1, 0.16, 7.75]} color="#e9edf3" rough={0.6} />
      <Fachada />

        </>
      )}

      {objetos.filter((o) => o.modo === 'plinto').map((o) => {
        const [x, y, z] = lugares.get(o.id)!.pos;
        return <Plinto key={o.id} p={[x, y - ALTO_PILAR, z]} h={ALTO_PILAR} acento={COLOR_GRUPO[o.zona]} />;
      })}

      {ampliada ? (
        <Cascaron cuartos={plano.cuartos} hora={hora} reflejo={reflejo} />
      ) : (
        <>
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


        </>
      )}

      {ampliada && <PuertaFondo x={2.4} noche={noche} />}
      <MueblesBase tipo={tema.muebles} />

      {agregados.map((c) => <Decorado key={c.id} cuarto={c} tipo={tema.muebles} />)}

      {/* Focos empotrados en el techo de cada habitación. */}
      {[[-7.7, 3.55], [-3.0, 3.55], [-1.0, 3.55], [-3.0, 7.3], [-1.0, 7.3], [2.2, 7.3], [4.4, 7.3], [2.2, 3.55], [4.4, 3.55]].flatMap(([x, y]) => [-1.2, 1.4].map((z) => <Foco key={`${x}${y}${z}`} p={[desplazarX(x), y, z]} />))}

      {noche && luz && agregados.map((c) => (
        <mesh key={`lza${c.id}`} position={[(c.x0 + c.x1) / 2, c.y0 + 0.058, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.min(c.x1 - c.x0, 6), 5]} />
          <meshBasicMaterial map={luz} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      ))}

      {noche && luz && [[-7.7, 0], [-3.0, 0], [-1.0, 0], [-3.0, 3.75], [-1.0, 3.75], [2.2, 3.75], [4.4, 3.75], [2.2, 0], [4.4, 0]].flatMap(([x, y]) => [-1.2, 1.4].map((z) => (
        <mesh key={`lz${x}${y}${z}`} position={[desplazarX(x), y + 0.058, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.2, 3.2]} />
          <meshBasicMaterial map={luz} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      )))}

      {/* Familia: 3 adultos (dormitorio, oficina y la mamá que camina living ↔ cochera) y 2 niños jugando en el jardín. */}
      {tema.personas && <Persona p={[desplazarX(3.2), 4.25, -1.45]} rot={Math.PI} sentado ropa="#4a6fb5" pantalon="#232936" pelo="#3a2a1e" />}
      </Fundido>

      {tema.personas && (
        <>
      {/* Personas con movimiento: cada una con su propio Fundido (pocas mallas) y solo se anima su grupo. */}
      <PersonaViva modo="quieta" p={[desplazarX(-1.3), 3.75, 0.3]} rot={Math.PI * 0.85} ropa="#c9647f" pantalon="#2f3a52" pelo="#5b3a22" fase={0} />
      {/* La mamá camina del living a la cochera por el paso entre cuartos; los dos niños juegan a perseguirse en el jardín. */}
      <PersonaViva modo="paseo" p={[-1.6, 0, 1.45]} hasta={-10.3} ropa="#c9647f" pantalon="#2a2f3b" pelo="#8a5a2b" fase={0.2} />
      <PersonaViva modo="juego" p={[4.6, 0, 12.7]} radio={1.4} esc={0.62} ropa="#ff8a5c" pantalon="#364763" pelo="#8a5a2b" fase={0} />
      <PersonaViva modo="juego" p={[4.6, 0, 12.7]} radio={1.4} esc={0.62} ropa="#e0a63c" pantalon="#364763" pelo="#5b3a22" fase={0.42} />

        </>
      )}

      {/* Amenidades: son interactivas y cambian de color con el saldo, por eso no se funden. */}
      {objetos.map(objetoPorCuenta)}
    </group>
    </TexturasCtx.Provider>
    </NocheCtx.Provider>
    </TemaCtx.Provider>
  );
}
