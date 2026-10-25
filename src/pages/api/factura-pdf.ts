import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { clienteParaFacturacion } from '../../lib/portalAuth';
import { beelConfig, beelFetch } from '../../lib/beel';
import { json } from '../../lib/facturacion';

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Segundos que BeeL espera a que el PDF esté listo antes de contestar 202.
// Poco a propósito: la función de Vercel no debe agotar su tiempo esperando;
// si no está listo, el navegador reintenta (ver EmitirFacturas.astro).
const ESPERA_BEEL_S = 5;

// Descarga el PDF de una factura emitida. BeeL solo da el PDF con la clave de
// API (que no puede estar en el navegador), así que se hace de intermediario.
// Solo sirve facturas del propio cliente: se busca en facturas_emitidas por
// (id, cliente_id) y nunca se pasa a BeeL un id sin comprobar.
//
// Respuestas: 200 con el PDF; 202 { pendiente, retryAfter } si BeeL aún lo
// está generando; JSON { error, code, detail } en cualquier fallo (el código
// de BeeL va en `code`, p. ej. INVOICE_NOT_REGISTERED_NO_PDF).
export const GET: APIRoute = async ({ request, url }) => {
  const cfg = beelConfig();
  const supabase = getSupabaseAdmin();
  if (!cfg || !supabase) return json({ error: 'No disponible' }, 503);

  const cliente = await clienteParaFacturacion(request, supabase, cfg.sandbox);
  if (!cliente) return json({ error: 'Sesión no válida' }, 401);

  const id = url.searchParams.get('id') ?? '';
  if (!UUID_PATTERN.test(id)) return json({ error: 'Petición no válida' }, 400);

  const { data: factura } = await supabase
    .from('facturas_emitidas')
    .select('beel_invoice_id, beel_company_id, numero')
    .eq('id', id)
    .eq('cliente_id', cliente.id)
    .maybeSingle();
  if (!factura) return json({ error: 'No encontrada' }, 404);

  // BeeL genera el PDF después de emitir. `Prefer: wait=N` le dice cuánto
  // esperar; si no llega a tiempo contesta 202 sin cuerpo y `Retry-After`
  // (docs.beel.es/guides/branding-and-pdf).
  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${factura.beel_company_id}/invoices/${factura.beel_invoice_id}/pdf`, {
      headers: { Prefer: `wait=${ESPERA_BEEL_S}` },
    });
  } catch (e) {
    console.error('[factura-pdf] sin conexión con BeeL', factura.numero, e);
    return json({ error: 'Servicio de facturación no disponible' }, 502);
  }

  if (res.status === 202) {
    const retryAfter = Math.min(Math.max(Number(res.headers.get('retry-after')) || 3, 1), 10);
    return json({ pendiente: true, retryAfter }, 202);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? null;
    const detail = body?.error?.message ?? null;
    console.error('[factura-pdf] BeeL rechazó el PDF', factura.numero, res.status, code, detail);
    return json({ error: 'PDF no disponible', code, detail }, res.status >= 400 && res.status < 500 ? 422 : 502);
  }

  // BeeL no devuelve el PDF sino una URL firmada de unos 5 minutos
  // (`data.download_url`). Se descarga aquí y se reenvía, para que el
  // navegador nunca vea la URL de almacenamiento de BeeL.
  const meta = await res.json().catch(() => null);
  const downloadUrl: unknown = meta?.data?.download_url;
  if (typeof downloadUrl !== 'string') {
    console.error('[factura-pdf] respuesta sin download_url', factura.numero, res.status, JSON.stringify(meta)?.slice(0, 300));
    return json({ error: 'PDF no disponible', code: 'PDF_SIN_URL' }, 502);
  }

  let pdf: Response;
  try {
    pdf = await fetch(downloadUrl);
  } catch (e) {
    console.error('[factura-pdf] no se pudo descargar el PDF firmado', factura.numero, e);
    return json({ error: 'PDF no disponible', code: 'PDF_DESCARGA' }, 502);
  }
  if (!pdf.ok) {
    console.error('[factura-pdf] descarga del PDF firmado', factura.numero, pdf.status);
    return json({ error: 'PDF no disponible', code: 'PDF_DESCARGA' }, 502);
  }

  return new Response(pdf.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${String(factura.numero).replace(/[^\w.-]/g, '_')}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
};
