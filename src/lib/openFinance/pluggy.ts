// lib/openFinance/pluggy.ts
//
// Adaptador de Pluggy (agregador de Open Finance Brasil) para ProveedorOpenFinance.
// ⚠️ SIN VERIFICAR: se escribió sin acceso a la documentación de Pluggy (la sesión no tenía internet). Antes de activar hay que revisar
// cada endpoint, campo y paginación contra docs.pluggy.ai y probarlo en su modo sandbox. Variables de entorno (solo servidor):
//   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET.

import type { ConexionExterna, CuentaExterna, MovimientoExterno, ProveedorOpenFinance } from './proveedor';

const BASE = 'https://api.pluggy.ai';

async function claveDeApi(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Faltan PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET en el servidor.');
  const r = await fetch(`${BASE}/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId, clientSecret }) });
  if (!r.ok) throw new Error(`Pluggy rechazó las credenciales (${r.status}).`);
  return ((await r.json()) as { apiKey: string }).apiKey;
}

async function pedir<T>(ruta: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(`${BASE}${ruta}`, {
    method: init?.method ?? 'GET',
    headers: { 'content-type': 'application/json', 'X-API-KEY': await claveDeApi() },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!r.ok) throw new Error(`Pluggy respondió ${r.status} en ${ruta}.`);
  return (await r.json()) as T;
}

export const pluggy: ProveedorOpenFinance = {
  nombre: 'pluggy',

  async crearTokenDeConexion(empresaId, conexionExternaId) {
    const r = await pedir<{ accessToken: string }>('/connect_token', { method: 'POST', body: { itemId: conexionExternaId, clientUserId: empresaId } });
    return { token: r.accessToken };
  },

  async obtenerConexion(conexionExternaId): Promise<ConexionExterna> {
    const r = await pedir<{ id: string; status: string; connector?: { name?: string }; consentExpiresAt?: string | null }>(`/items/${conexionExternaId}`);
    const estado = r.status === 'UPDATED' ? 'ACTIVA' : r.status === 'LOGIN_ERROR' || r.status === 'OUTDATED' ? 'RENOVAR' : r.status === 'UPDATING' ? 'ACTIVA' : 'ERROR';
    return { conexionExternaId: r.id, bancoNombre: r.connector?.name ?? '', estado, consentimientoVence: r.consentExpiresAt ? r.consentExpiresAt.slice(0, 10) : null };
  },

  async listarCuentas(conexionExternaId): Promise<CuentaExterna[]> {
    const r = await pedir<{ results: Array<{ id: string; name: string; number?: string; balance: number; currencyCode?: string }> }>(`/accounts?itemId=${conexionExternaId}`);
    return r.results.map((c) => ({ cuentaExternaId: c.id, nombre: c.name, numeroMascara: c.number ? `…${c.number.slice(-4)}` : null, moneda: c.currencyCode ?? 'BRL', saldo: Number(c.balance) }));
  },

  async listarMovimientos(cuentaExternaId, desde, hasta): Promise<MovimientoExterno[]> {
    const salida: MovimientoExterno[] = [];
    for (let pagina = 1; ; pagina++) {
      const r = await pedir<{ results: Array<{ id: string; date: string; amount: number; description?: string; descriptionRaw?: string; paymentData?: { receiver?: { name?: string }; payer?: { name?: string } } }>; totalPages?: number }>(
        `/transactions?accountId=${cuentaExternaId}&from=${desde}&to=${hasta}&pageSize=500&page=${pagina}`
      );
      for (const m of r.results) {
        salida.push({
          idExterno: m.id,
          fecha: m.date.slice(0, 10),
          monto: Number(m.amount),
          descripcion: m.description ?? m.descriptionRaw ?? '',
          contraparte: (m.amount < 0 ? m.paymentData?.receiver?.name : m.paymentData?.payer?.name) ?? null,
        });
      }
      if (pagina >= (r.totalPages ?? 1)) break;
    }
    return salida;
  },
};
