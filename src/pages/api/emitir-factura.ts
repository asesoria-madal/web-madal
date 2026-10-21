import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { clienteDesdeRequest } from '../../lib/portalAuth';
import { beelConfig, beelFetch, resolveCompanyId } from '../../lib/beel';

export const prerender = false;

// Mismo criterio "deliberadamente laxo" que el resto de endpoints: forma y
// longitud, no corrección fiscal. La validación fiscal real (NIF, IVA,
// dirección obligatoria) la hace BeeL y su error se devuelve al cliente.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIF_CIF_PATTERN = /^[0-9A-Za-z][0-9]{7}[A-Za-z0-9]$/;
const CP_PATTERN = /^\d{5}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tipos de IVA permitidos desde el portal. El 0 % no está: exige indicar la
// causa de exención y eso no se resuelve con un desplegable; esos casos los
// emite el equipo.
const IVA_VALUES = [21, 10, 4];
// Retenciones habituales de un autónomo (7 % inicio de actividad, 15 %
// general). 0 = sin retención.
const IRPF_VALUES = [0, 7, 15];

const MAX_LINEAS = 20;

interface Linea {
  descripcion: string;
  cantidad: number;
  precio: number;
  iva: number;
  irpf: number;
}

interface Body {
  idempotencyKey: string;
  enviarEmail: boolean;
  receptor: {
    nombre: string;
    nif: string;
    email?: string;
    direccion: string;
    codigoPostal: string;
    ciudad: string;
    provincia: string;
  };
  lineas: Linea[];
}

function str(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function num(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, any>;

  if (typeof b.idempotencyKey !== 'string' || !UUID_PATTERN.test(b.idempotencyKey)) return false;
  if (typeof b.enviarEmail !== 'boolean') return false;

  const r = b.receptor;
  if (typeof r !== 'object' || r === null) return false;
  if (!str(r.nombre, 150)) return false;
  if (typeof r.nif !== 'string' || !NIF_CIF_PATTERN.test(r.nif.trim())) return false;
  if (!str(r.direccion, 200)) return false;
  if (typeof r.codigoPostal !== 'string' || !CP_PATTERN.test(r.codigoPostal.trim())) return false;
  if (!str(r.ciudad, 100) || !str(r.provincia, 100)) return false;
  if (r.email !== undefined && (typeof r.email !== 'string' || !EMAIL_PATTERN.test(r.email) || r.email.length > 254)) return false;
  // Enviar por email sin destinatario no tiene sentido.
  if (b.enviarEmail && !r.email) return false;

  if (!Array.isArray(b.lineas) || b.lineas.length < 1 || b.lineas.length > MAX_LINEAS) return false;
  for (const l of b.lineas) {
    if (typeof l !== 'object' || l === null) return false;
    if (!str(l.descripcion, 300)) return false;
    if (!num(l.cantidad, 1_000_000) || !num(l.precio, 10_000_000)) return false;
    if (!IVA_VALUES.includes(l.iva) || !IRPF_VALUES.includes(l.irpf)) return false;
  }
  return true;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
// Por cliente (ya autenticado), no por IP. Best-effort en memoria, como el resto.
const requestLog = new Map<string, number[]>();

function isRateLimited(clienteId: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(clienteId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(clienteId, recent);
  return recent.length > RATE_LIMIT_MAX;
}

export const POST: APIRoute = async ({ request }) => {
  const cfg = beelConfig();
  const supabase = getSupabaseAdmin();
  if (!cfg || !supabase) {
    return json({ error: 'La facturación no está disponible ahora mismo.' }, 503);
  }

  const cliente = await clienteDesdeRequest(request, supabase);
  if (!cliente) return json({ error: 'Sesión no válida' }, 401);

  if (isRateLimited(cliente.id)) {
    return json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.' }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (!isValid(body)) return json({ error: 'Datos de la factura no válidos' }, 400);

  const companyId = resolveCompanyId(cliente.beelCompanyId);
  if (!companyId) {
    return json({ error: 'La facturación todavía no está activada para tu cuenta. Escríbenos y la activamos.' }, 409);
  }

  const r = body.receptor;
  const payload = {
    type: 'STANDARD',
    recipient: {
      legal_name: r.nombre.trim(),
      nif: r.nif.trim().toUpperCase(),
      address: {
        street: r.direccion.trim(),
        postal_code: r.codigoPostal.trim(),
        city: r.ciudad.trim(),
        province: r.provincia.trim(),
      },
      ...(r.email ? { email: r.email.trim() } : {}),
    },
    lines: body.lineas.map((l) => ({
      description: l.descripcion.trim(),
      quantity: l.cantidad,
      unit_price: l.precio,
      main_tax: { type: 'IVA', percentage: l.iva, regime_key: '01' },
      irpf_rate: l.irpf,
    })),
    // issue_directly: numera y registra en la AEAT en la misma llamada. Sin
    // borrador intermedio: el portal no ofrece editar antes de emitir.
    options: { issue_directly: true, send_automatically: body.enviarEmail },
  };

  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${companyId}/invoices`, {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey: body.idempotencyKey,
    });
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación. Inténtalo de nuevo.' }, 502);
  }

  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) {
    // Errores de validación de BeeL (dirección, NIF inexistente…) son
    // accionables por el cliente: se devuelve el código y el mensaje.
    const code = result?.error?.code ?? 'BEEL_ERROR';
    console.error('BeeL emitir-factura error:', res.status, code, result?.error?.message);
    const status = res.status >= 400 && res.status < 500 ? 422 : 502;
    return json({ error: 'No se ha podido emitir la factura.', code, detail: result?.error?.message ?? null }, status);
  }

  const inv = result.data;
  const { error: insertError } = await supabase.from('facturas_emitidas').upsert(
    {
      cliente_id: cliente.id,
      beel_invoice_id: inv.id,
      beel_company_id: companyId,
      numero: inv.invoice_number,
      fecha_emision: inv.issue_date,
      receptor_nombre: inv.recipient.legal_name,
      receptor_nif: inv.recipient.nif,
      receptor_email: inv.recipient.email ?? null,
      base_imponible: inv.totals.taxable_base,
      total_iva: inv.totals.total_vat,
      total_irpf: inv.totals.total_irpf ?? 0,
      total: inv.totals.total_to_pay ?? inv.totals.invoice_total,
      verifactu_estado: inv.verifactu?.submission_status ?? null,
      sandbox: cfg.sandbox,
    },
    // El mismo Idempotency-Key devuelve la misma factura: upsert evita un
    // error de duplicado en el reintento.
    { onConflict: 'beel_invoice_id' },
  );
  if (insertError) {
    // La factura YA está emitida y registrada en la AEAT; no se puede
    // "deshacer" devolviendo un error. Se avisa en logs para recuperarla de BeeL.
    console.error('facturas_emitidas insert error (factura emitida en BeeL):', inv.invoice_number, insertError);
  }

  return json({ numero: inv.invoice_number, id: inv.id, total: inv.totals.invoice_total, persisted: !insertError });
};
