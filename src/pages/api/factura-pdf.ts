import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { clienteParaFacturacion } from '../../lib/portalAuth';
import { beelConfig, beelFetch } from '../../lib/beel';

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Descarga el PDF de una factura emitida. BeeL solo da el PDF con la clave de
// API (que no puede estar en el navegador), así que se hace de intermediario.
// Solo sirve facturas del propio cliente: se busca en facturas_emitidas por
// (id, cliente_id) y nunca se pasa a BeeL un id sin comprobar.
export const GET: APIRoute = async ({ request, url }) => {
  const cfg = beelConfig();
  const supabase = getSupabaseAdmin();
  if (!cfg || !supabase) return new Response('No disponible', { status: 503 });

  const cliente = await clienteParaFacturacion(request, supabase, cfg.sandbox);
  if (!cliente) return new Response('Sesión no válida', { status: 401 });

  const id = url.searchParams.get('id') ?? '';
  if (!UUID_PATTERN.test(id)) return new Response('Petición no válida', { status: 400 });

  const { data: factura } = await supabase
    .from('facturas_emitidas')
    .select('beel_invoice_id, beel_company_id, numero')
    .eq('id', id)
    .eq('cliente_id', cliente.id)
    .maybeSingle();
  if (!factura) return new Response('No encontrada', { status: 404 });

  let res: Response;
  try {
    res = await beelFetch(`/v1/companies/${factura.beel_company_id}/invoices/${factura.beel_invoice_id}/pdf`);
  } catch {
    return new Response('Servicio de facturación no disponible', { status: 502 });
  }
  if (!res.ok) return new Response('PDF no disponible todavía', { status: 502 });

  // BeeL no devuelve el PDF sino una URL firmada de unos 5 minutos
  // (`data.download_url`). Se descarga aquí y se reenvía, para que el
  // navegador nunca vea la URL de almacenamiento de BeeL.
  const meta = await res.json().catch(() => null);
  const downloadUrl: unknown = meta?.data?.download_url;
  if (typeof downloadUrl !== 'string') return new Response('PDF no disponible todavía', { status: 502 });

  let pdf: Response;
  try {
    pdf = await fetch(downloadUrl);
  } catch {
    return new Response('PDF no disponible todavía', { status: 502 });
  }
  if (!pdf.ok) return new Response('PDF no disponible todavía', { status: 502 });

  return new Response(pdf.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${String(factura.numero).replace(/[^\w.-]/g, '_')}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
};
