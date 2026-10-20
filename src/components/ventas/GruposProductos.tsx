'use client';

// Lista de productos agrupada igual en Mini-Juego y Central de Lanzamientos (ver lib/lineasProducto.ts):
// terminados e insumos por separado; dentro de cada uno, los que tienen saldo a la vista y los que no
// en un desplegable.

import { useEffect, useRef, useState } from 'react';
import { agruparProductos, type GrupoProductos, type ProductoAgrupable } from '@/lib/lineasProducto';

type Props<P extends ProductoAgrupable> = {
  productos: P[];
  saldos: Record<string, number>;
  operacion: string;
  // Sin datos de saldo (simulación): no se puede separar por saldo.
  ignorarSaldo?: boolean;
  idioma: string;
  // Con búsqueda activa todo se abre, para no esconder resultados.
  hayBusqueda?: boolean;
  oscuro?: boolean;
  disposicion: 'grilla' | 'lista';
  renderProducto: (producto: P, sinSaldo: boolean) => React.ReactNode;
};

function Encabezado({ abierto, onClick, texto, oscuro, nivel }: { abierto: boolean; onClick: () => void; texto: string; oscuro: boolean; nivel: 1 | 2 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={abierto}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: nivel === 1 ? '8px 2px' : '6px 2px',
        fontSize: nivel === 1 ? 13.5 : 12.5,
        fontWeight: 800,
        color: oscuro ? '#fff' : '#1f3a5f',
        opacity: nivel === 1 ? 1 : 0.8,
      }}
    >
      {abierto ? '▾' : '▸'} {texto}
    </button>
  );
}

function BloqueGrupo<P extends ProductoAgrupable>({
  grupo,
  idioma,
  hayBusqueda,
  oscuro,
  disposicion,
  renderProducto,
  mostrarTitulo,
}: {
  grupo: GrupoProductos<P>;
  idioma: string;
  hayBusqueda: boolean;
  oscuro: boolean;
  disposicion: 'grilla' | 'lista';
  renderProducto: (producto: P, sinSaldo: boolean) => React.ReactNode;
  mostrarTitulo: boolean;
}) {
  const esPT = idioma === 'PT';
  const [abierto, setAbierto] = useState(grupo.abiertoPorDefecto);
  const [sinSaldoAbierto, setSinSaldoAbierto] = useState(false);
  const total = grupo.conSaldo.length + grupo.sinSaldo.length;
  const titulo = grupo.clave === 'INSUMOS' ? (esPT ? 'Insumos' : 'Insumos') : esPT ? 'Produtos acabados' : 'Productos terminados';

  const contenedor: React.CSSProperties =
    disposicion === 'grilla'
      ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14, margin: '6px 0 10px' }
      : { display: 'flex', flexDirection: 'column', gap: 4, margin: '4px 0 8px' };

  const visible = abierto || hayBusqueda;

  return (
    <div>
      {mostrarTitulo && <Encabezado abierto={visible} onClick={() => setAbierto(!abierto)} texto={`${titulo} (${total})`} oscuro={oscuro} nivel={1} />}
      {visible && (
        <>
          {grupo.conSaldo.length > 0 && <div style={contenedor}>{grupo.conSaldo.map((p) => renderProducto(p, false))}</div>}
          {grupo.sinSaldo.length > 0 && (
            <>
              <Encabezado
                abierto={sinSaldoAbierto || hayBusqueda}
                onClick={() => setSinSaldoAbierto(!sinSaldoAbierto)}
                texto={`${esPT ? 'Sem saldo' : 'Sin saldo'} (${grupo.sinSaldo.length})`}
                oscuro={oscuro}
                nivel={2}
              />
              {(sinSaldoAbierto || hayBusqueda) && <div style={contenedor}>{grupo.sinSaldo.map((p) => renderProducto(p, true))}</div>}
            </>
          )}
        </>
      )}
    </div>
  );
}

export function GruposProductos<P extends ProductoAgrupable>({
  productos,
  saldos,
  operacion,
  ignorarSaldo,
  idioma,
  hayBusqueda = false,
  oscuro = false,
  disposicion,
  renderProducto,
}: Props<P>) {
  const grupos = agruparProductos(productos, saldos, { operacion, ignorarSaldo });
  // Un solo grupo (ej. solo terminados) no necesita título.
  const mostrarTitulo = grupos.length > 1;

  return (
    <div>
      {grupos.map((grupo) => (
        <BloqueGrupo
          key={`${grupo.clave}-${grupo.abiertoPorDefecto}`}
          grupo={grupo}
          idioma={idioma}
          hayBusqueda={hayBusqueda}
          oscuro={oscuro}
          disposicion={disposicion}
          renderProducto={renderProducto}
          mostrarTitulo={mostrarTitulo}
        />
      ))}
    </div>
  );
}

// Reemplaza al <select> de producto de la Central: botón que abre el panel agrupado.
export function SelectorProductoDesplegable<P extends ProductoAgrupable>({
  productos,
  saldos,
  operacion,
  valor,
  onElegir,
  placeholder,
  idioma,
  deshabilitarSinSaldo,
  etiquetaSaldo,
  estiloBoton,
}: {
  productos: P[];
  saldos: Record<string, number>;
  operacion: string;
  valor: string;
  onElegir: (id: string) => void;
  placeholder: string;
  idioma: string;
  deshabilitarSinSaldo: boolean;
  etiquetaSaldo: (saldo: number) => string;
  estiloBoton: React.CSSProperties;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const elegido = productos.find((p) => p.id === valor);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  return (
    <div ref={raiz} style={{ position: 'relative', flex: 2, minWidth: 0 }}>
      <button type="button" onClick={() => setAbierto(!abierto)} style={{ ...estiloBoton, width: '100%', textAlign: 'left', cursor: 'pointer', background: '#fff' }}>
        {elegido ? elegido.nombre : placeholder} <span style={{ float: 'right' }}>▾</span>
      </button>
      {abierto && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 30,
            marginTop: 4,
            maxHeight: 320,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 12,
            padding: '6px 10px',
            boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
          }}
        >
          <GruposProductos
            productos={productos}
            saldos={saldos}
            operacion={operacion}
            idioma={idioma}
            disposicion="lista"
            renderProducto={(p, sinSaldo) => {
              const bloqueado = deshabilitarSinSaldo && sinSaldo;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => {
                    onElegir(p.id);
                    setAbierto(false);
                  }}
                  style={{
                    textAlign: 'left',
                    border: 'none',
                    borderRadius: 8,
                    padding: '7px 8px',
                    fontSize: 13.5,
                    background: p.id === valor ? '#edf6f0' : 'transparent',
                    color: bloqueado ? '#9ca3af' : '#1f2937',
                    cursor: bloqueado ? 'not-allowed' : 'pointer',
                  }}
                >
                  {p.nombre}
                  {etiquetaSaldo(saldos[p.id] ?? 0)}
                </button>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
