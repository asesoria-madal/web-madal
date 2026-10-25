import type { APIRoute } from 'astro';
import { beelFetch } from '../../../lib/beel';
import { contextoFacturacion, json } from '../../../lib/facturacion';
import { CABECERA_CLIENTE_ADMIN } from '../../../lib/portalAuth';

export const prerender = false;

// Pone al día el estado de Hacienda (Verifactu) de las facturas que aún no
// tienen respuesta definitiva. Lo normal es que lo actualice el webhook de
// BeeL (api/beel-webhook.ts), pero si el webhook no está creado, falla o se
// pierde un evento, la factura se quedaría "pendiente de envío" para siempre
// en el portal. El portal llama aquí al pintar la lista si ve alguna pendiente.
//
// Estados que todavía pueden cambiar: PENDING y NOT_SUBMITTED
// (docs.beel.es/verifactu/submission-states); el resto son definitivos.
//
// Un administrador que prueba como un cliente (solo sandbox, ver
// clienteParaFacturacion) recibe además un diagnóstico: el estado de cada
// factura en BeeL con su motivo y el request_id (para el soporte de BeeL), y
// si la empresa está lista para emitir (issuing-readiness).
const MAX_POR_LLAMADA = 10;

export const POST: APIRoute = async ({ request }) => {
  const ctx = await contextoFacturacion(request);
  if (ctx instanceof Response) return ctx;
  // contextoFacturacion solo acepta la cabecera de admin a un administrador
  // con clave de test: si ha llegado hasta aquí con ella, es un admin.
  const admin = Boolean(request.headers.get(CABECERA_CLIENTE_ADMIN)?.trim());

  const { data: filas, error } = await ctx.supabase
    .from('facturas_emitidas')
    .select('id, numero, beel_invoice_id, beel_company_id, verifactu_estado')
    .eq('cliente_id', ctx.cliente.id)
    .or('verifactu_estado.is.null,verifactu_estado.in.(PENDING,NOT_SUBMITTED)')
    .order('created_at', { ascending: false })
    .limit(MAX_POR_LLAMADA);
  if (error) {
    console.error('[sincronizar] no se pudieron leer las facturas', error.message);
    return json({ error: 'No se han podido leer las facturas.' }, 500);
  }

  // Al admin también le interesa el motivo de las rechazadas o aceptadas con
  // avisos (definitivas, así que no se actualizan): se consultan las últimas.
  let revisar: typeof filas = [];
  if (admin) {
    const { data } = await ctx.supabase
      .from('facturas_emitidas')
      .select('id, numero, beel_invoice_id, beel_company_id, verifactu_estado')
      .eq('cliente_id', ctx.cliente.id)
      .in('verifactu_estado', ['REJECTED', 'ACCEPTED_WITH_ERRORS'])
      .order('created_at', { ascending: false })
      .limit(5);
    revisar = data ?? [];
  }

  const actualizadas: { id: string; estado: string }[] = [];
  const diagnostico: Record<string, unknown>[] = [];
  for (const f of [...(filas ?? []), ...(revisar ?? [])]) {
    let res: Response;
    try {
      res = await beelFetch(`/v1/companies/${f.beel_company_id}/invoices/${f.beel_invoice_id}`);
    } catch (e) {
      console.error('[sincronizar] sin conexión con BeeL', f.numero, e);
      continue;
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('[sincronizar] BeeL', f.numero, res.status, body?.error?.code, body?.error?.message);
      if (admin) diagnostico.push({ numero: f.numero, error: body?.error?.code ?? res.status, request_id: body?.meta?.request_id ?? null });
      continue;
    }
    const inv = body?.data;
    const estado: string | null = inv?.verifactu?.submission_status ?? null;
    if (admin) {
      diagnostico.push({
        numero: f.numero,
        factura: inv?.status ?? null,
        hacienda: estado,
        codigo: inv?.verifactu?.error_code ?? null,
        motivo: inv?.verifactu?.error_message ?? null,
        omitida: inv?.verifactu?.skip_reason ?? null,
        registrada: inv?.verifactu?.registered_at ?? null,
        pdf: Boolean(inv?.pdf_download_url),
        request_id: body?.meta?.request_id ?? null,
      });
    }
    if (estado && estado !== f.verifactu_estado) {
      const { error: upd } = await ctx.supabase.from('facturas_emitidas').update({ verifactu_estado: estado }).eq('id', f.id);
      if (upd) console.error('[sincronizar] no se pudo guardar el estado', f.numero, upd.message);
      else actualizadas.push({ id: f.id, estado });
    }
  }

  if (!admin) return json({ actualizadas });

  let empresa: unknown = null;
  try {
    const r = await beelFetch(`/v1/companies/${ctx.companyId}/issuing-readiness`);
    const b = await r.json().catch(() => null);
    empresa = r.ok ? { companyId: ctx.companyId, ...b?.data } : { companyId: ctx.companyId, error: b?.error?.code ?? r.status };
  } catch {
    empresa = { companyId: ctx.companyId, error: 'SIN_CONEXION' };
  }
  return json({ actualizadas, diagnostico, empresa });
};
