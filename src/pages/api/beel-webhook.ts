import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Receptor de webhooks de BeeL. Hoy solo atiende `verifactu.status.updated`:
// la AEAT contesta unos segundos/minutos después de emitir y BeeL avisa aquí,
// para que el portal muestre "aceptada" / "rechazada" sin consultar a BeeL.
//
// Variables de entorno:
//   BEEL_WEBHOOK_SECRET      secreto que BeeL devuelve UNA SOLA VEZ al crear la
//                            suscripción (POST /v1/accounts/{id}/webhooks).
//   N8N_ALERT_WEBHOOK_URL    opcional; webhook de n8n al que se avisa cuando la
//                            AEAT rechaza una factura (ver n8n-workflows/workflows/alerta-factura-rechazada.json).
//   N8N_ALERT_TOKEN          valor de la cabecera X-Alert-Token que exige ese webhook.

const REPLAY_WINDOW_SECONDS = 300;

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=', 2) as [string, string]));
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;

  // Protección ante repeticiones: una firma vieja no vale.
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(t, 10)) > REPLAY_WINDOW_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest();
  const received = Buffer.from(v1, 'hex');
  // timingSafeEqual lanza si las longitudes difieren.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.BEEL_WEBHOOK_SECRET as string | undefined;
  const supabase = getSupabaseAdmin();
  if (!secret || !supabase) return new Response('No configurado', { status: 503 });

  // El cuerpo en crudo: la firma se calcula sobre los bytes recibidos, no
  // sobre el JSON re-serializado.
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get('beel-signature'), secret)) {
    return new Response('Firma no válida', { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }

  // Cualquier otro tipo de evento se acepta (2xx) sin hacer nada, para que
  // BeeL no lo reintente.
  if (event.type !== 'verifactu.status.updated' || event.test === true) {
    return new Response('OK', { status: 200 });
  }

  const data = event.data ?? {};
  const invoiceId: unknown = data.invoice_id ?? data.id;
  const newStatus: unknown = data.new_status ?? data.status;
  if (typeof invoiceId !== 'string' || typeof newStatus !== 'string') {
    // El esquema exacto de `data` no estaba publicado al escribir esto; si
    // BeeL lo cambia, esta línea es la pista.
    console.error('beel-webhook: evento sin invoice_id/new_status', JSON.stringify(data).slice(0, 500));
    return new Response('OK', { status: 200 });
  }

  const errorCode = typeof data.error_code === 'string' ? data.error_code : null;
  const errorMessage = typeof data.error_message === 'string' ? data.error_message : null;

  const { data: fila, error } = await supabase
    .from('facturas_emitidas')
    .update({
      verifactu_estado: newStatus,
      verifactu_error_codigo: errorCode,
      verifactu_error_mensaje: errorMessage,
    })
    .eq('beel_invoice_id', invoiceId)
    .select('numero, cliente_id')
    .maybeSingle();

  if (error) {
    // 500: BeeL reintenta la entrega, que es lo que queremos si Supabase falla.
    console.error('beel-webhook update error:', error);
    return new Response('Error', { status: 500 });
  }

  // Aviso al equipo cuando la AEAT rechaza: el cliente no puede arreglarlo
  // solo (una factura emitida no se edita; se corrige con una rectificativa).
  const alertUrl = import.meta.env.N8N_ALERT_WEBHOOK_URL as string | undefined;
  if (newStatus === 'REJECTED' && fila && alertUrl) {
    try {
      await fetch(alertUrl, {
        method: 'POST',
        // El webhook de n8n va protegido con Header Auth (convención de
        // n8n-workflows/CLAUDE.md): sin este token n8n responde 403.
        headers: {
          'Content-Type': 'application/json',
          'X-Alert-Token': (import.meta.env.N8N_ALERT_TOKEN as string | undefined) ?? '',
        },
        body: JSON.stringify({
          numero: fila.numero,
          cliente_id: fila.cliente_id,
          error_codigo: errorCode,
          error_mensaje: errorMessage,
        }),
      });
    } catch (e) {
      // El estado ya está guardado; un fallo del aviso no debe hacer que
      // BeeL reintente toda la entrega.
      console.error('beel-webhook: no se pudo avisar a n8n', e);
    }
  }

  return new Response('OK', { status: 200 });
};
