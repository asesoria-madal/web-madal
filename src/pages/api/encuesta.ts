import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Recibe la respuesta de la encuesta de satisfacción (EncuestaSatisfaccion.astro).
// La fila ya existe (la crea el workflow n8n "Encuesta de satisfacción" al
// mandar el correo) — este endpoint solo puede RELLENARLA, nunca crearla,
// y solo una vez (respondida_at is null evita que un enlace reenviado o
// reabierto pise una respuesta ya dada).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// Mismo limitador best-effort en memoria que el resto de endpoints públicos.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (isRateLimited(clientAddress)) {
    return json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.' }, 429);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const b = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  if (typeof b.id !== 'string' || !UUID_PATTERN.test(b.id)) {
    return json({ error: 'Enlace no válido' }, 404);
  }
  if (typeof b.estrellas !== 'number' || !Number.isInteger(b.estrellas) || b.estrellas < 1 || b.estrellas > 5) {
    return json({ error: 'Puntuación no válida', field: 'estrellas' }, 400);
  }
  const comentario = typeof b.comentario === 'string' && b.comentario.trim() ? b.comentario.trim().slice(0, 2000) : null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ persisted: false });

  // Sin "select" previo a propósito: el update con las dos condiciones
  // (id exacto y respondida_at is null) ya hace de guarda atómica contra
  // una respuesta repetida, sin una carrera entre leer y escribir.
  const { data, error } = await supabase
    .from('encuestas_satisfaccion')
    .update({ estrellas: b.estrellas, comentario, respondida_at: new Date().toISOString() })
    .eq('id', b.id)
    .is('respondida_at', null)
    .select('id');

  if (error) return json({ error: 'No se ha podido guardar la respuesta' }, 500);
  if (!data || data.length === 0) return json({ error: 'Enlace no válido o ya respondido' }, 409);

  return json({ ok: true });
};
