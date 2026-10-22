// Cliente mínimo de la API de BeeL (facturación Verifactu). Solo servidor:
// la clave nunca debe llegar al navegador (la propia documentación de BeeL
// lo prohíbe). Sin SDK a propósito: son dos llamadas y así no hay una
// dependencia más que mantener (criterio "boring", ver DOCS/OPERACIONES.md).
//
// Variables de entorno (Vercel):
//   BEEL_API_KEY             beel_sk_test_… (sandbox) o beel_sk_live_… (real)
//   BEEL_DEFAULT_COMPANY_ID  company de sandbox que usan TODOS los clientes
//                            mientras no tengan `clientes.beel_company_id`.
//                            Solo se aplica con clave de test (ver abajo).
//   BEEL_BASE_URL            opcional; por defecto producción de BeeL.

const DEFAULT_BASE_URL = 'https://app.beel.es/api';

export function beelConfig() {
  const apiKey = import.meta.env.BEEL_API_KEY as string | undefined;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: ((import.meta.env.BEEL_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    sandbox: apiKey.startsWith('beel_sk_test_'),
    defaultCompanyId: import.meta.env.BEEL_DEFAULT_COMPANY_ID as string | undefined,
  };
}

// La company por defecto SOLO vale en sandbox: con una clave real, emitir
// con la company equivocada sería una factura real con el emisor de otro
// cliente. Con clave live, cada cliente necesita su propia company.
export function resolveCompanyId(clienteCompanyId: string | null | undefined): string | null {
  const cfg = beelConfig();
  if (!cfg) return null;
  if (clienteCompanyId) return clienteCompanyId;
  return cfg.sandbox ? cfg.defaultCompanyId ?? null : null;
}

export async function beelFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const cfg = beelConfig();
  if (!cfg) throw new Error('BEEL_API_KEY no configurada');
  const { idempotencyKey, headers, ...rest } = init;
  return fetch(`${cfg.baseUrl}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      // Con FormData (subida de la representación firmada) no se fija el
      // Content-Type: fetch añade solo el multipart con su boundary.
      ...(rest.body && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      // Obligatoria en toda llamada que crea: si el navegador reintenta
      // (doble clic, red caída), BeeL devuelve la factura original en vez de
      // emitir otra con número nuevo.
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...headers,
    },
  });
}
