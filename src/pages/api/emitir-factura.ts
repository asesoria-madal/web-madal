import type { APIRoute } from 'astro';
import { beelFetch } from '../../lib/beel';
import {
  UUID_PATTERN,
  contextoFacturacion,
  errorBeel,
  fechaValida,
  json,
  lineaABeel,
  lineasValidas,
  pagoABeel,
  pagoValido,
  str,
  type Linea,
  type Pago,
} from '../../lib/facturacion';

export const prerender = false;

// Emite una factura ordinaria (F1) o simplificada (F2) desde el portal. Las
// rectificativas van en rectificar-factura.ts y las periódicas en
// facturacion/recurrentes.ts. El destinatario de una ordinaria es siempre un
// cliente ya guardado en BeeL (`customerId`, ver facturacion/clientes.ts):
// así los datos fiscales (NIF, dirección) se validan una vez al crearlo y no
// en cada factura.
interface Body {
  idempotencyKey: string;
  tipo: 'STANDARD' | 'SIMPLIFIED';
  customerId?: string;
  enviarEmail: boolean;
  ivaIncluido: boolean;
  fechaOperacion?: string;
  notas?: string;
  pago?: Pago;
  lineas: Linea[];
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, any>;

  if (typeof b.idempotencyKey !== 'string' || !UUID_PATTERN.test(b.idempotencyKey)) return false;
  if (b.tipo !== 'STANDARD' && b.tipo !== 'SIMPLIFIED') return false;
  if (typeof b.enviarEmail !== 'boolean' || typeof b.ivaIncluido !== 'boolean') return false;

  if (b.tipo === 'STANDARD') {
    if (typeof b.customerId !== 'string' || !UUID_PATTERN.test(b.customerId)) return false;
  } else if (b.customerId !== undefined || b.enviarEmail) {
    // Una simplificada no identifica al destinatario: ni cliente ni email.
    return false;
  }

  if (b.fechaOperacion !== undefined && !fechaValida(b.fechaOperacion)) return false;
  if (b.notas !== undefined && !str(b.notas, 2000)) return false;
  if (b.pago !== undefined && !pagoValido(b.pago)) return false;
  return lineasValidas(b.lineas);
}

export const POST: APIRoute = async ({ request }) => {
  const ctx = await contextoFacturacion(request);
  if (ctx instanceof Response) return ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (!isValid(body)) return json({ error: 'Datos de la factura no válidos' }, 400);

  const payload = {
    type: body.tipo,
    recipient: body.tipo === 'STANDARD' ? { customer_id: body.customerId } : {},
    lines: body.lineas.map((l) => lineaABeel(l, body.ivaIncluido)),
    ...(body.fechaOperacion ? { operation_date: body.fechaOperacion } : {}),
    ...(body.notas ? { notes: body.notas.trim() } : {}),
    ...(body.pago ? { payment_info: pagoABeel(body.pago) } : {}),
    // issue_directly: numera y registra en la AEAT en la misma llamada. Sin
    // borrador intermedio: el portal no ofrece editar antes de emitir.
    options: { issue_directly: true, send_automatically: body.enviarEmail },
  };

  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${ctx.companyId}/invoices`, {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey: body.idempotencyKey,
    });
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación. Inténtalo de nuevo.' }, 502);
  }
  if (!res.ok) return errorBeel(res, 'emitir-factura');

  const result = await res.json().catch(() => null);
  if (!result?.success) return json({ error: 'Respuesta inesperada del servicio de facturación.' }, 502);

  const inv = result.data;
  const { error: insertError } = await ctx.supabase.from('facturas_emitidas').upsert(
    {
      cliente_id: ctx.cliente.id,
      beel_invoice_id: inv.id,
      beel_company_id: ctx.companyId,
      numero: inv.invoice_number,
      tipo: body.tipo,
      fecha_emision: inv.issue_date,
      receptor_nombre: inv.recipient?.legal_name ?? '',
      receptor_nif: inv.recipient?.nif ?? null,
      receptor_email: inv.recipient?.email ?? null,
      base_imponible: inv.totals.taxable_base,
      total_iva: inv.totals.total_vat,
      total_irpf: inv.totals.total_irpf ?? 0,
      total: inv.totals.total_to_pay ?? inv.totals.invoice_total,
      verifactu_estado: inv.verifactu?.submission_status ?? null,
      sandbox: ctx.sandbox,
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
