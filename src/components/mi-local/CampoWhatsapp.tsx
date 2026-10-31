'use client';

// Campo de WhatsApp con selector de país: [🇦🇷 +54] [característica] [número]. Entrega al padre el número
// internacional completo (solo dígitos) o '' mientras falte la característica o el número. Ver lib/whatsappPais.ts.

import { useState } from 'react';
import { PAISES, componerWhatsapp, ejemploWhatsapp, separarWhatsapp, type CodigoPais } from '@/lib/whatsappPais';

export function CampoWhatsapp({
  valor,
  onChange,
  paisInicial,
  idioma,
  estiloCampo,
}: {
  valor: string;
  onChange: (internacional: string) => void;
  paisInicial: CodigoPais;
  idioma: 'ES' | 'PT';
  estiloCampo: React.CSSProperties;
}) {
  // Estado propio: el valor internacional pierde la característica mientras se escribe, así que no se puede derivar de él.
  const [inicial] = useState(() => separarWhatsapp(valor, paisInicial));
  const [pais, setPais] = useState<CodigoPais>(inicial.pais);
  const [area, setArea] = useState(inicial.area);
  const [numero, setNumero] = useState(inicial.numero);
  const es = idioma === 'ES';
  const ej = ejemploWhatsapp(pais);

  function cambiar(p: CodigoPais, a: string, n: string) {
    setPais(p);
    setArea(a);
    setNumero(n);
    onChange(componerWhatsapp(p, a, n));
  }

  return (
    // flexWrap: en pantallas angostas el número pasa solo a su propia línea, a todo el ancho, en vez de quedar cortado.
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' }}>
      <select
        value={pais}
        onChange={(e) => cambiar(e.target.value as CodigoPais, area, numero)}
        aria-label="País"
        title={es ? 'País' : 'País'}
        style={{ ...estiloCampo, width: 'auto', flex: '0 0 auto', paddingLeft: 8, paddingRight: 4 }}
      >
        {PAISES.map((p) => (
          <option key={p.codigo} value={p.codigo} title={es ? p.nombre.es : p.nombre.pt}>
            {p.bandera} +{p.marca}
          </option>
        ))}
      </select>
      <input
        value={area}
        onChange={(e) => cambiar(pais, e.target.value.replace(/\D/g, '').slice(0, 4), numero)}
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        aria-label={pais === 'BR' ? 'DDD' : es ? 'Característica' : 'Código de área'}
        placeholder={ej.area || (pais === 'BR' ? 'DDD' : es ? 'Carac.' : 'Cód.')}
        style={{ ...estiloCampo, width: 76, flex: '0 0 76px', textAlign: 'center' }}
      />
      <input
        value={numero}
        onChange={(e) => cambiar(pais, area, e.target.value.replace(/[^\d\s-]/g, '').slice(0, 12))}
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={es ? 'Número' : 'Número'}
        placeholder={ej.numero || (es ? 'Número' : 'Número')}
        style={{ ...estiloCampo, flex: '1 1 180px', minWidth: 160 }}
      />
    </div>
  );
}
