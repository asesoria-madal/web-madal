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
//
// Identificación (docs.beel.es/customers/createCompanyCustomer):
// - Con NIF español (`tipoId` = NIF) va en `nif`. BeeL lo comprueba en el
//   censo de la AEAT y, si es persona física, que el nombre coincida
//   (si no, 422 NIF_NOT_IN_CENSUS). No hay NIF "de prueba", ni en sandbox.
// - Sin NIF español va en `alternative_id` { type, number, country_code }:
//   NIF_IVA (empresa de otro país de la UE), PASSPORT, COUNTRY_ID,
//   RESIDENCE_CERTIFICATE, OTHER_DOCUMENT, o NOT_REGISTERED (DNI/NIE español
//   que no está en el censo). Las combinaciones tipo/país las valida BeeL.
// - Fuera de España el código postal es libre y la provincia, opcional.
const TIPOS_ID = ['NIF', 'NIF_IVA', 'PASSPORT', 'COUNTRY_ID', 'RESIDENCE_CERTIFICATE', 'OTHER_DOCUMENT', 'NOT_REGISTERED'];
const TIPOS_SOLO_ESPANA = ['NIF', 'NOT_REGISTERED'];
const TIPOS_SOLO_EXTRANJERO = ['NIF_IVA', 'COUNTRY_ID', 'RESIDENCE_CERTIFICATE', 'OTHER_DOCUMENT'];
const PAIS_PATTERN = /^[A-Z]{2}$/;
// Documentos extranjeros: letras, cifras y separadores habituales, sin espacios.
const ID_ALTERNATIVO_PATTERN = /^[A-Z0-9][A-Z0-9.\-/]{1,29}$/;
const CP_EXTRANJERO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,11}$/;

interface Body {
  idempotencyKey: string;
  nombre: string;
  // País del cliente (ISO 3166-1 alfa-2). Si falta, España.
  pais?: string;
  // Tipo de identificación. Si falta, NIF español.
  tipoId?: string;
  // Número de identificación (NIF o el documento alternativo).
  nif: string;
  email?: string;
  direccion: string;
  codigoPostal: string;
  ciudad: string;
  provincia?: string;
}

const normalizarId = (v: string) => v.replace(/\s/g, '').toUpperCase();

// Devuelve el nombre del primer campo inválido, o null si todo está bien. El
// nombre del campo viaja en el error para que el portal diga qué corregir.
function campoInvalido(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'cuerpo';
  const b = body as Record<string, any>;
  if (typeof b.idempotencyKey !== 'string' || !UUID_PATTERN.test(b.idempotencyKey)) return 'idempotencyKey';
  // BeeL limita el nombre a 120 caracteres.
  if (!str(b.nombre, 120)) return 'nombre';

  const pais = b.pais ?? 'ES';
  if (typeof pais !== 'string' || !PAIS_PATTERN.test(pais)) return 'pais';
  const tipoId = b.tipoId ?? 'NIF';
  if (typeof tipoId !== 'string' || !TIPOS_ID.includes(tipoId)) return 'tipoId';
  if (pais === 'ES' && TIPOS_SOLO_EXTRANJERO.includes(tipoId)) return 'tipoId';
  if (pais !== 'ES' && TIPOS_SOLO_ESPANA.includes(tipoId)) return 'tipoId';

  if (typeof b.nif !== 'string') return 'nif';
  const id = normalizarId(b.nif);
  if (tipoId === 'NIF' || tipoId === 'NOT_REGISTERED') {
    if (!NIF_CIF_PATTERN.test(id)) return 'nif';
  } else if (!ID_ALTERNATIVO_PATTERN.test(id)) {
    return 'nif';
  }

  if (!str(b.direccion, 200)) return 'direccion';
  if (typeof b.codigoPostal !== 'string') return 'codigoPostal';
  const cp = b.codigoPostal.trim();
  if (pais === 'ES' ? !CP_PATTERN.test(cp) : !CP_EXTRANJERO_PATTERN.test(cp)) return 'codigoPostal';
  if (!str(b.ciudad, 100)) return 'ciudad';
  if (pais === 'ES') {
    if (!str(b.provincia, 100)) return 'provincia';
  } else if (b.provincia !== undefined && b.provincia !== '' && !str(b.provincia, 100)) {
    return 'provincia';
  }
  if (b.email !== undefined && (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254)) return 'email';
  return null;
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
    // Un cliente sin NIF español se identifica con su documento alternativo.
    nif: c.nif ?? c.alternative_id?.number ?? null,
    email: c.email ?? null,
    direccion: [c.address?.street, c.address?.postal_code, c.address?.city, c.address?.country_code ?? c.address?.country]
      .filter((v) => v && v !== 'ES' && v !== 'España')
      .join(', '),
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
  const invalido = campoInvalido(body);
  if (invalido) return json({ error: `Datos del cliente no válidos (campo: ${invalido})`, campo: invalido }, 400);
  const b = body as Body;

  const pais = b.pais ?? 'ES';
  const tipoId = b.tipoId ?? 'NIF';
  const id = normalizarId(b.nif);
  const provincia = b.provincia?.trim();
  const payload = {
    legal_name: b.nombre.trim(),
    ...(tipoId === 'NIF' ? { nif: id } : { alternative_id: { type: tipoId, number: id, country_code: pais } }),
    address: {
      street: b.direccion.trim(),
      postal_code: b.codigoPostal.trim(),
      city: b.ciudad.trim(),
      ...(provincia ? { province: provincia } : {}),
      country_code: pais,
    },
    ...(b.email ? { email: b.email.trim() } : {}),
  };

  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${ctx.companyId}/customers`, {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey: b.idempotencyKey,
    });
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación.' }, 502);
  }
  if (!res.ok) return errorBeel(res, 'clientes-crear');

  const result = await res.json().catch(() => null);
  const c = result?.data;
  if (!c?.id) return json({ error: 'Respuesta inesperada del servicio de facturación.' }, 502);
  return json({ id: c.id, nombre: c.legal_name, nif: c.nif ?? c.alternative_id?.number ?? null, email: c.email ?? null }, 201);
};
