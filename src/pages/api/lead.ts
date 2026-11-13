import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Recibe el formulario de contacto y el de constitución de SL (LeadForm.astro) y los
// guarda en `leads` (ver supabase/schema.sql). Validación deliberadamente laxa, como
// el resto: el equipo responde a cada uno. El campo oculto `web` es una trampa para
// bots: quien lo rellena recibe un OK sin que se guarde nada.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO_PATTERN = /^[+\d][\d\s-]{6,20}$/;
const TIPOS = ['contacto', 'constituir_sl'];
const IDIOMAS = ['es', 'ca', 'en'];
const PERFILES = ['empezar', 'autonomo', 'sl', 'constituir_sl', 'otra'];
const COMUNIDADES = ['andalucia', 'aragon', 'asturias', 'baleares', 'cantabria', 'castilla_la_mancha', 'castilla_y_leon', 'cataluna', 'ceuta', 'extremadura', 'galicia', 'madrid', 'melilla', 'murcia', 'la_rioja', 'valencia'];
const PLAZO = ['ya', 'este_mes', '1_3_meses', 'mas_adelante'];

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const opcion = (v: unknown, lista: string[]) => (typeof v === 'string' && lista.includes(v) ? v : null);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function primerCampoInvalido(b: Record<string, unknown>): string | null {
  if (!TIPOS.includes(b.tipo as string)) return 'tipo';
  if (!IDIOMAS.includes(b.idioma as string)) return 'idioma';
  // Nombre: obligatorio solo en constitución de SL. En el formulario general es opcional y el
  // motivo (mensaje) es obligatorio (2026-11-13).
  if (b.nombre !== undefined && (typeof b.nombre !== 'string' || b.nombre.length > 150)) return 'nombre';
  if (b.tipo === 'constituir_sl' && (typeof b.nombre !== 'string' || !b.nombre.trim())) return 'nombre';
  if (b.tipo !== 'constituir_sl' && (typeof b.mensaje !== 'string' || !b.mensaje.trim())) return 'mensaje';
  if (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email.trim()) || b.email.length > 254) return 'email';
  if (b.privacidad !== true) return 'privacidad';
  const hayTelefono = typeof b.telefono === 'string' && b.telefono.trim() !== '';
  if (hayTelefono && !TELEFONO_PATTERN.test((b.telefono as string).trim())) return 'telefono';
  if (b.tipo === 'constituir_sl') {
    if (!COMUNIDADES.includes(b.comunidad as string)) return 'comunidad';
    if (typeof b.actividad !== 'string' || !b.actividad.trim()) return 'actividad';
  }
  return null;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (isRateLimited(clientAddress)) return json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.' }, 429);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (typeof raw !== 'object' || raw === null) return json({ error: 'Datos no válidos' }, 400);
  const b = raw as Record<string, unknown>;

  if (typeof b.web === 'string' && b.web.trim()) return json({ ok: true });

  const campo = primerCampoInvalido(b);
  if (campo) return json({ error: 'Datos no válidos', field: campo }, 400);

  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ persisted: false });

  const { error } = await supabase.from('leads').insert({
    tipo: b.tipo,
    idioma: b.idioma,
    // La columna no admite null: sin nombre se guarda vacío (n8n saluda sin nombre).
    nombre: typeof b.nombre === 'string' ? b.nombre.trim() : '',
    email: (b.email as string).trim().toLowerCase(),
    telefono: texto(b.telefono, 20),
    perfil: opcion(b.perfil, PERFILES),
    mensaje: texto(b.mensaje, 2000),
    comunidad: opcion(b.comunidad, COMUNIDADES),
    actividad: texto(b.actividad, 500),
    denominacion: texto(b.denominacion, 150),
    plazo: opcion(b.plazo, PLAZO),
    origen: texto(b.origen, 100),
    pagina: texto(b.pagina, 300),
    privacy_accepted_at: new Date().toISOString(),
  });
  if (error) {
    console.error('Error guardando lead', error.message);
    return json({ error: 'No se pudo guardar' }, 500);
  }
  return json({ ok: true });
};
