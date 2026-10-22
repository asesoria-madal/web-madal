import type { APIRoute } from 'astro';
import { beelFetch } from '../../../lib/beel';
import {
  CP_PATTERN,
  EMAIL_PATTERN,
  NIF_CIF_PATTERN,
  UUID_PATTERN,
  contextoFacturacion,
  errorBeel,
  json,
  str,
} from '../../../lib/facturacion';

export const prerender = false;

// Clientes del emisor (a quien factura el cliente de la asesoría), guardados
// en la company del propio cliente en BeeL: no tienen tabla propia en
// Supabase. GET lista (hasta 100, con búsqueda opcional) y POST crea.
interface Body {
  idempotencyKey: string;
  nombre: string;
  nif: string;
  email?: string;
  direccion: string;
  codigoPostal: string;
  ciudad: string;
  provincia: string;
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, any>;
  if (typeof b.idempotencyKey !== 'string' || !UUID_PATTERN.test(b.idempotencyKey)) return false;
  // BeeL limita el nombre a 120 caracteres.
  if (!str(b.nombre, 120)) return false;
  if (typeof b.nif !== 'string' || !NIF_CIF_PATTERN.test(b.nif.trim())) return false;
  if (!str(b.direccion, 200)) return false;
  if (typeof b.codigoPostal !== 'string' || !CP_PATTERN.test(b.codigoPostal.trim())) return false;
  if (!str(b.ciudad, 100) || !str(b.provincia, 100)) return false;
  if (b.email !== undefined && (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254)) return false;
  return true;
}

export const GET: APIRoute = async ({ request, url }) => {
  const ctx = await contextoFacturacion(request);
  if (ctx instanceof Response) return ctx;

  const q = (url.searchParams.get('q') ?? '').slice(0, 100);
  const params = new URLSearchParams({ limit: '100', sort_by: 'legal_name', sort_order: 'asc' });
  if (q) params.set('search', q);

  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${ctx.companyId}/customers?${params}`);
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación.' }, 502);
  }
  if (!res.ok) return errorBeel(res, 'clientes-listar');

  const result = await res.json().catch(() => null);
  const clientes = (result?.data?.customers ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.legal_name,
    nif: c.nif ?? null,
    email: c.email ?? null,
    direccion: [c.address?.street, c.address?.postal_code, c.address?.city].filter(Boolean).join(', '),
  }));
  return json({ clientes });
};

export const POST: APIRoute = async ({ request }) => {
  const ctx = await contextoFacturacion(request);
  if (ctx instanceof Response) return ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (!isValid(body)) return json({ error: 'Datos del cliente no válidos' }, 400);

  const payload = {
    legal_name: body.nombre.trim(),
    nif: body.nif.trim().toUpperCase(),
    address: {
      street: body.direccion.trim(),
      postal_code: body.codigoPostal.trim(),
      city: body.ciudad.trim(),
      province: body.provincia.trim(),
    },
    ...(body.email ? { email: body.email.trim() } : {}),
  };

  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${ctx.companyId}/customers`, {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey: body.idempotencyKey,
    });
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación.' }, 502);
  }
  if (!res.ok) return errorBeel(res, 'clientes-crear');

  const result = await res.json().catch(() => null);
  const c = result?.data;
  if (!c?.id) return json({ error: 'Respuesta inesperada del servicio de facturación.' }, 502);
  return json({ id: c.id, nombre: c.legal_name, nif: c.nif ?? null, email: c.email ?? null }, 201);
};
