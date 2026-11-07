import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Recibe el formulario completo de constitución de SL y lo guarda en
// `constituciones_formulario` (ver supabase/schema.sql). Validación laxa, como el resto:
// el equipo revisa cada respuesta. Se puede enviar más de una vez y cada envío es una fila.
// El campo oculto `web` es una trampa para bots.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAMANO_MAXIMO = 300_000;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (isRateLimited(clientAddress)) return json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.' }, 429);

  const cuerpo = await request.text();
  if (cuerpo.length > TAMANO_MAXIMO) return json({ error: 'Demasiados datos' }, 413);
  let b: Record<string, any>;
  try {
    b = JSON.parse(cuerpo);
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (typeof b !== 'object' || b === null) return json({ error: 'Datos no válidos' }, 400);
  if (typeof b.web === 'string' && b.web.trim()) return json({ ok: true });

  const f = b.datos?.f;
  const nombre = texto(f?.c_nombre, 150);
  const email = texto(f?.c_email, 254)?.toLowerCase();
  const resumen = texto(b.resumen, TAMANO_MAXIMO);
  if (!nombre) return json({ error: 'Datos no válidos', field: 'c_nombre' }, 400);
  if (!email || !EMAIL_PATTERN.test(email)) return json({ error: 'Datos no válidos', field: 'c_email' }, 400);
  if (!f?.rgpd) return json({ error: 'Datos no válidos', field: 'rgpd' }, 400);
  if (!resumen) return json({ error: 'Datos no válidos', field: 'resumen' }, 400);

  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ persisted: false });

  // Un enlace alterado no debe impedir guardar el formulario: sin lead válido, se asocia por correo.
  let leadId: string | null = null;
  if (typeof b.lead === 'string' && UUID_PATTERN.test(b.lead)) {
    const { data } = await supabase.from('leads').select('id').eq('id', b.lead).maybeSingle();
    leadId = data?.id ?? null;
  }

  const { error } = await supabase.from('constituciones_formulario').insert({
    lead_id: leadId,
    idioma: ['es', 'ca', 'en'].includes(b.idioma) ? b.idioma : 'es',
    nombre,
    email,
    telefono: texto(f.c_tel, 30),
    denominacion: texto(f.den1, 150),
    resumen,
    datos: b.datos,
    privacy_accepted_at: new Date().toISOString(),
  });
  if (error) {
    console.error('Error guardando el formulario de constitución', error.message);
    return json({ error: 'No se pudo guardar' }, 500);
  }
  return json({ ok: true });
};
