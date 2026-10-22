import type { APIRoute } from 'astro';
import { beelFetch } from '../../lib/beel';
import {
  UUID_PATTERN,
  contextoFacturacion,
  errorBeel,
  json,
  lineaABeel,
  lineasValidas,
  str,
  type Linea,
} from '../../lib/facturacion';

export const prerender = false;

// Rectifica una factura emitida desde el portal (una factura emitida no se
// edita ni se borra: se corrige con otra rectificativa, que se emite al
// momento y se registra en la AEAT).
//   TOTAL   → sustitución: anula la original (no lleva líneas).
//   PARTIAL → diferencias: las líneas expresan el cambio (una cantidad
//             negativa es una reducción).
// Códigos: R1 (los habituales: importes, descuentos, devoluciones), R2
// (concurso del cliente), R3 (impago), R4 (otras causas) y R5 (única que vale
// para una simplificada). R2/R3 exigen PARTIAL (lo comprueba BeeL).
const CODIGOS = ['R1', 'R2', 'R3', 'R4'];

interface Body {
  idempotencyKey: string;
  facturaId: string; // facturas_emitidas.id (no el id de BeeL)
  codigo: string;
  tipo: 'TOTAL' | 'PARTIAL';
  motivo: string;
  ivaIncluido: boolean;
  lineas?: Linea[];
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, any>;
  if (typeof b.idempotencyKey !== 'string' || !UUID_PATTERN.test(b.idempotencyKey)) return false;
  if (typeof b.facturaId !== 'string' || !UUID_PATTERN.test(b.facturaId)) return false;
  if (typeof b.codigo !== 'string' || ![...CODIGOS, 'R5'].includes(b.codigo)) return false;
  if (b.tipo !== 'TOTAL' && b.tipo !== 'PARTIAL') return false;
  if (typeof b.ivaIncluido !== 'boolean') return false;
  // BeeL exige un motivo de 10 a 1.000 caracteres.
  if (!str(b.motivo, 1000) || b.motivo.trim().length < 10) return false;
  if (b.tipo === 'TOTAL') return b.lineas === undefined;
  return lineasValidas(b.lineas, true);
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
  if (!isValid(body)) return json({ error: 'Datos de la rectificación no válidos' }, 400);

  // Solo facturas del propio cliente: se busca por (id, cliente_id) y nunca se
  // pasa a BeeL un id sin comprobar.
  const { data: original } = await ctx.supabase
    .from('facturas_emitidas')
    .select('beel_invoice_id, beel_company_id, tipo')
    .eq('id', body.facturaId)
    .eq('cliente_id', ctx.cliente.id)
    .maybeSingle();
  if (!original) return json({ error: 'Factura no encontrada' }, 404);
  if (original.tipo === 'CORRECTIVE') {
    return json({ error: 'Una rectificativa no se puede volver a rectificar desde el portal. Escríbenos.' }, 422);
  }
  // R5 es el único código válido para una simplificada, y solo para ella.
  if ((original.tipo === 'SIMPLIFIED') !== (body.codigo === 'R5')) {
    return json({ error: 'Código de rectificación no válido para este tipo de factura' }, 400);
  }

  const payload = {
    rectification_type: body.tipo,
    rectification_code: body.codigo,
    reason: body.motivo.trim(),
    ...(body.tipo === 'PARTIAL' ? { lines: body.lineas!.map((l) => lineaABeel(l, body.ivaIncluido)) } : {}),
  };

  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${original.beel_company_id}/invoices/${original.beel_invoice_id}/corrective`, {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey: body.idempotencyKey,
    });
  } catch {
    return json({ error: 'No se ha podido contactar con el servicio de facturación. Inténtalo de nuevo.' }, 502);
  }
  if (!res.ok) return errorBeel(res, 'rectificar-factura');

  const result = await res.json().catch(() => null);
  if (!result?.success) return json({ error: 'Respuesta inesperada del servicio de facturación.' }, 502);

  const inv = result.data;
  const { error: insertError } = await ctx.supabase.from('facturas_emitidas').upsert(
    {
      cliente_id: ctx.cliente.id,
      beel_invoice_id: inv.id,
      beel_company_id: original.beel_company_id,
      numero: inv.invoice_number,
      tipo: 'CORRECTIVE',
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
    { onConflict: 'beel_invoice_id' },
  );
  if (insertError) {
    console.error('facturas_emitidas insert error (rectificativa emitida en BeeL):', inv.invoice_number, insertError);
  }

  return json({ numero: inv.invoice_number, id: inv.id, total: inv.totals.invoice_total, persisted: !insertError });
};
