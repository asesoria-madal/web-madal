import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Peticiones de correo de acceso al portal (2026-11-17). El portal entra con correo y contraseña
// (supabase.auth.signInWithPassword, en el navegador); este endpoint solo se usa para pedir un
// correo:
//   tipo 'contrasena' -> "¿Has olvidado tu contraseña?": enlace para elegir una nueva
//   tipo 'entrar'     -> "Entrar sin contraseña": enlace de acceso directo
// No manda nada: apunta la petición en `portal_accesos` y n8n ("Accesos del portal", cada minuto)
// genera el enlace y lo envía en el idioma del cliente, solo si el correo es de una ficha o de un
// administrador. Antes llamaba a signInWithOtp y salía la plantilla única de Supabase.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS = ['entrar', 'contrasena'];
const IDIOMAS = ['es', 'ca', 'en'];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
// Limitador best-effort en memoria: no sobrevive a un cold start ni se comparte entre instancias,
// pero basta para frenar el intento trivial de adivinar correos por fuerza bruta.
const requestLog = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

// Respuesta siempre idéntica, sea o no el correo de un cliente: el formulario no sirve para
// averiguar qué correos son clientes vuestros (protección contra enumeración).
const GENERIC_OK = { ok: true };

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (isRateLimited(clientAddress)) {
    return json({ error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' }, 429);
  }
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (typeof b !== 'object' || b === null) return json({ error: 'Datos no válidos' }, 400);
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return json({ error: 'Email no válido' }, 400);
  const tipo = typeof b.tipo === 'string' && TIPOS.includes(b.tipo) ? b.tipo : 'entrar';
  const idioma = typeof b.idioma === 'string' && IDIOMAS.includes(b.idioma) ? b.idioma : 'es';

  const supabase = getSupabaseAdmin();
  // Sin Supabase configurado no hay nada que apuntar; misma respuesta para no romper la página.
  if (!supabase) return json(GENERIC_OK);

  const { error } = await supabase.from('portal_accesos').insert({ email, tipo, idioma });
  if (error) console.error('portal_accesos insert error:', error.message);
  return json(GENERIC_OK);
};
