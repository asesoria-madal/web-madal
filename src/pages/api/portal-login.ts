import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Body {
  email: string;
  redirectTo?: string;
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254) return false;
  if (b.redirectTo !== undefined && typeof b.redirectTo !== 'string') return false;
  return true;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

// Limitador best-effort en memoria, mismo criterio que api/presupuesto.ts:
// no sobrevive a un cold start ni se comparte entre instancias, pero basta
// para frenar el intento trivial de adivinar emails por fuerza bruta.
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

// Respuesta siempre idéntica se encuentre o no el email en `clientes`:
// así el formulario de login no sirve para averiguar qué emails son
// clientes vuestros (protección contra enumeración).
const GENERIC_OK = { ok: true };

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (isRateLimited(clientAddress)) {
    return json({ error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  if (!isValid(body)) {
    return json({ error: 'Email no válido' }, 400);
  }

  const origin = new URL(request.url).origin;
  const redirectTo = body.redirectTo && body.redirectTo.startsWith(origin) ? body.redirectTo : `${origin}/portal`;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Sin Supabase configurado no hay nada que comprobar ni enlace que
    // mandar; respondemos igual en éxito para no romper la experiencia
    // mientras se termina de montar el proyecto.
    return json(GENERIC_OK);
  }

  // Solo un email ya dado de alta por el equipo en `clientes` puede
  // llegar a tener cuenta de Auth: si no está, no llamamos a Supabase
  // Auth en absoluto (no se crea usuario, no se manda correo).
  // ilike en vez de eq: la comparación es insensible a mayúsculas, igual
  // que el índice único en lower(email) y el trigger de vinculación.
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .ilike('email', body.email)
    .maybeSingle();

  if (cliente) {
    await supabase.auth.signInWithOtp({
      email: body.email,
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    });
  }

  return json(GENERIC_OK);
};
