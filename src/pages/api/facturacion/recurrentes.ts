import type { APIRoute } from 'astro';
import { beelFetch } from '../../../lib/beel';
import {
  UUID_PATTERN,
  contextoFacturacion,
  errorBeel,
  fechaValida,
  json,
  lineaARecurrente,
  lineasValidas,
  pagoValido,
  str,
  type Linea,
  type Pago,
} from '../../../lib/facturacion';

export const prerender = false;

// Facturas recurrentes (suscripciones): plantillas que BeeL convierte en una
// factura cada mes/trimestre/año, ya emitida y registrada en la AEAT sin que
// nadie pulse nada. No tienen tabla propia: la plantilla vive en BeeL, en la
// company del cliente. Las facturas que genera BeeL por su cuenta NO pasan
// por facturas_emitidas (se ven en BeeL); si hiciera falta listarlas en el
// portal habría que sincronizarlas (ver DOCS/BEEL.md).
//   GET  → lista las plantillas
//   POST → crea una
//   PUT  → cambia el estado: ACTIVE (reanudar), PAUSED (pausar) o
//          COMPLETED (terminar para siempre; no se puede deshacer)
const FRECUENCIAS = ['MONTHLY', 'QUARTERLY', 'YEARLY'];
const ESTADOS = ['ACTIVE', 'PAUSED', 'COMPLETED'];

interface Body {
  idempotencyKey: string;
  nombre: string;
  frecuencia: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  diaMes: number;
  fechaInicio: string;
  tipo: 'STANDARD' | 'SIMPLIFIED';
  customerId?: string;
  ivaIncluido: boolean;
  // Cómo termina: nunca, en una fecha o tras N facturas (BeeL no admite las
  // dos a la vez).
  fin: { modo: 'NEVER' } | { modo: 'DATE'; fecha: string } | { modo: 'COUNT'; numero: number };
  enviarAuto: boolean;
  notas?: string;
  pago?: Pago;
  lineas: Linea[];
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, any>;
  if (typeof b.idempotencyKey !== 'string' || !UUID_PATTERN.test(b.idempotencyKey)) return false;
  if (!str(b.nombre, 255)) return false;
  if (!FRECUENCIAS.includes(b.frecuencia)) return false;
  if (!Number.isInteger(b.diaMes) || b.diaMes < 1 || b.diaMes > 31) return false;
  if (!fechaValida(b.fechaInicio)) return false;
  if (b.tipo !== 'STANDARD' && b.tipo !== 'SIMPLIFIED') return false;
  if (typeof b.ivaIncluido !== 'boolean' || typeof b.enviarAuto !== 'boolean') return false;

  if (b.tipo === 'STANDARD') {
    if (typeof b.customerId !== 'string' || !UUID_PATTERN.test(b.customerId)) return false;
  } else if (b.customerId !== undefined || b.enviarAuto) {
    return false;
  }

  const fin = b.fin;
  if (typeof fin !== 'object' || fin === null) return false;
  if (fin.modo === 'DATE') {
    if (!fechaValida(fin.fecha)) return false;
  } else if (fin.modo === 'COUNT') {
    // BeeL: de 2 a 600 facturas.
    if (!Number.isInteger(fin.numero) || fin.numero < 2 || fin.numero > 600) return false;
  } else if (fin.modo !== 'NEVER') {
    return false;
  }

  if (b.notas !== undefined && !str(b.notas, 2000)) return false;
  if (b.pago !== undefined && !pagoValido(b.pago)) return false;
  return lineasValidas(b.lineas);
}

export const GET: APIRoute = async ({ request }) => {
  const ctx = await contextoFacturacion(request);
  if (ctx instanceof Response) return ctx;

  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${ctx.companyId}/recurring-invoices?limit=100&sort_by=created_at&sort_order=desc`);
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación.' }, 502);
  }
  if (!res.ok) return errorBeel(res, 'recurrentes-listar');

  const result = await res.json().catch(() => null);
  const recurrentes = (result?.data?.recurring_invoices ?? []).map((r: any) => ({
    id: r.id,
    nombre: r.name,
    estado: r.status,
    frecuencia: r.frequency,
    diaMes: r.day_of_month,
    proxima: r.next_generation ?? null,
    importe: r.amount ?? null,
    cliente: r.recipient_fiscal_name ?? null,
    fallando: r.is_failing === true,
    motivoPausa: r.pause?.reason ?? null,
    generadas: r.generated_invoices ?? null,
  }));
  return json({ recurrentes });
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
  if (!isValid(body)) return json({ error: 'Datos de la factura recurrente no válidos' }, 400);

  // La plantilla exige `series_id` (confirmado por BeeL, 26-oct-2026: no
  // coge la predeterminada si se omite). Se usa la predeterminada del tipo.
  // Listar las series exige el permiso `series:read` en la clave de API
  // (DOCS/BEEL.md §5). BeeL también ofrece GET …/series/defaults.
  let seriesRes: Response;
  try {
    seriesRes = await beelFetch(`/v1/companies/${ctx.companyId}/series`);
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación.' }, 502);
  }
  if (!seriesRes.ok) return errorBeel(seriesRes, 'recurrentes-series');
  const series = (await seriesRes.json().catch(() => null))?.data?.series ?? [];
  const serie = series.find((s: any) => s.document_type === body.tipo && s.default_series && s.active);
  if (!serie) return json({ error: 'No hay una serie de facturación predeterminada para este tipo.', code: 'SERIES_DEFAULT_NOT_FOUND' }, 422);

  const payload = {
    name: body.nombre.trim(),
    frequency: body.frecuencia,
    day_of_month: body.diaMes,
    start_date: body.fechaInicio,
    series_id: serie.id,
    invoice_type: body.tipo,
    ...(body.customerId ? { customer_id: body.customerId } : {}),
    lines: body.lineas.map((l) => lineaARecurrente(l, body.ivaIncluido)),
    ...(body.fin.modo === 'DATE' ? { end_date: body.fin.fecha } : {}),
    ...(body.fin.modo === 'COUNT' ? { max_invoices: body.fin.numero } : {}),
    send_automatically: body.enviarAuto,
    ...(body.notas ? { notes: body.notas.trim() } : {}),
    // BeeL exige `payment_method` en cuanto se manda IBAN, SWIFT o plazo.
    ...(body.pago
      ? {
          payment_method: body.pago.metodo,
          ...(body.pago.iban ? { payment_iban: body.pago.iban.replace(/\s/g, '').toUpperCase() } : {}),
          ...(body.pago.swift ? { payment_swift: body.pago.swift.toUpperCase() } : {}),
          ...(body.pago.plazoDias !== undefined ? { payment_term_days: body.pago.plazoDias } : {}),
        }
      : {}),
  };

  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${ctx.companyId}/recurring-invoices`, {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey: body.idempotencyKey,
    });
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación.' }, 502);
  }
  if (!res.ok) return errorBeel(res, 'recurrentes-crear');

  const r = (await res.json().catch(() => null))?.data;
  if (!r?.id) return json({ error: 'Respuesta inesperada del servicio de facturación.' }, 502);
  return json({ id: r.id, proxima: r.next_generation ?? null, importe: r.amount ?? null }, 201);
};

export const PUT: APIRoute = async ({ request }) => {
  const ctx = await contextoFacturacion(request);
  if (ctx instanceof Response) return ctx;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (typeof body?.id !== 'string' || !UUID_PATTERN.test(body.id) || !ESTADOS.includes(body.estado)) {
    return json({ error: 'Petición no válida' }, 400);
  }

  // El id va dentro de la ruta de la company del propio cliente: BeeL no
  // deja tocar plantillas de otra company.
  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${ctx.companyId}/recurring-invoices/${body.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: body.estado }),
    });
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación.' }, 502);
  }
  if (!res.ok) return errorBeel(res, 'recurrentes-estado');
  return json({ ok: true });
};
