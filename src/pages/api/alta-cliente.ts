import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Alta manual de un cliente desde el panel de administrador del portal.
// Hace exactamente lo que hacía el equipo a mano en el Table Editor: insertar
// la fila en `clientes`. Todo lo demás (correo con el formulario, enlace de
// acceso al portal, contacto y tarea en HubSpot) lo dispara el workflow de n8n
// "Onboarding" a partir de ese INSERT; este endpoint no envía nada por sí mismo.
//
// Autorización: la service role se salta RLS, así que la comprobación real es
// esta — el token de sesión se valida contra Supabase Auth y el usuario tiene
// que estar en `portal_admins`. Nunca se confía en nada que venga en el cuerpo.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Misma forma laxa que el resto de endpoints (NIF/NIE/CIF): longitud y forma,
// no corrección fiscal.
const NIF_PATTERN = /^[0-9A-Za-z][0-9]{7}[A-Za-z0-9]$/;
// Teléfono: forma laxa (dígitos, espacios, +, paréntesis y guiones), sin validar prefijo.
const TELEFONO_PATTERN = /^[+0-9 ()-]{6,20}$/;
// Mismos valores que el desplegable de HubSpot (ver n8n-workflows/hubspot/setup-hubspot.mjs).
const PLANES = ['debut', 'esencial', 'crece', 'total', 'sl'] as const;
// Idioma del cliente: decide el idioma de los correos automáticos de n8n.
const IDIOMAS = ['es', 'ca', 'en'] as const;

interface Body {
  nif: string;
  nombre: string;
  empresa?: string;
  email?: string;
  tipoPersona: 'autonomo' | 'sl';
  // Solo autónomos: true = el alta de autónomo la tramitamos nosotros
  // (clientes.alta_hecha = true), false = ya estaba dado de alta (traspaso).
  tramitamosAlta?: boolean;
  reporting: boolean;
  // Contrata la facturación (BeeL) con nosotros. Opcional: por defecto, no.
  beelContratado?: boolean;
  // Opcionales. Se sincronizan con HubSpot (workflow n8n "Sync HubSpot").
  telefono?: string;
  plan?: (typeof PLANES)[number];
  // Por defecto 'es'.
  idioma?: (typeof IDIOMAS)[number];
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.nif !== 'string' || !NIF_PATTERN.test(b.nif.trim())) return false;
  if (typeof b.nombre !== 'string' || b.nombre.trim().length === 0 || b.nombre.length > 150) return false;
  if (b.empresa !== undefined && (typeof b.empresa !== 'string' || b.empresa.length > 150)) return false;
  if (b.email !== undefined && b.email !== '' && (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254)) return false;
  if (b.tipoPersona !== 'autonomo' && b.tipoPersona !== 'sl') return false;
  if (b.tipoPersona === 'autonomo' && typeof b.tramitamosAlta !== 'boolean') return false;
  if (typeof b.reporting !== 'boolean') return false;
  if (b.beelContratado !== undefined && typeof b.beelContratado !== 'boolean') return false;
  if (b.telefono !== undefined && (typeof b.telefono !== 'string' || !TELEFONO_PATTERN.test(b.telefono.trim()))) return false;
  if (b.plan !== undefined && !(PLANES as readonly unknown[]).includes(b.plan)) return false;
  if (b.idioma !== undefined && !(IDIOMAS as readonly unknown[]).includes(b.idioma)) return false;
  return true;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: 'Supabase no está configurado.' }, 503);

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: 'Sesión no válida' }, 401);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Sesión no válida' }, 401);

  const { data: admin } = await supabase
    .from('portal_admins')
    .select('auth_user_id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (!admin) return json({ error: 'No tienes permisos de administrador' }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (!isValid(body)) return json({ error: 'Revisa los datos: NIF, nombre, email y tipo son obligatorios y deben tener formato válido.' }, 400);

  const id = body.nif.trim().toUpperCase();
  const email = body.email?.trim().toLowerCase() || null;

  // Un cliente provisional (PENDIENTE-…) es el que crea n8n al detectar la
  // respuesta a un presupuesto, antes de conocer el NIF. Si el equipo da de
  // alta a esa misma persona a mano, se sustituye por la ficha real — así el
  // INSERT dispara el onboarding completo (formulario + acceso). Solo se
  // sustituye si no tiene facturas subidas, para no perder datos.
  if (email) {
    const { data: provisional } = await supabase
      .from('clientes')
      .select('id')
      .ilike('email', email)
      .like('id', 'PENDIENTE-%')
      .maybeSingle();
    if (provisional) {
      const { count, error: countError } = await supabase
        .from('facturas_subidas')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', provisional.id);
      if (countError) return json({ error: 'No se ha podido comprobar la ficha provisional.' }, 500);
      if ((count ?? 0) > 0) {
        return json({ error: 'Ese email tiene una ficha provisional con facturas subidas. Corrígela a mano en Supabase.' }, 409);
      }
      const { error: delError } = await supabase.from('clientes').delete().eq('id', provisional.id);
      if (delError) return json({ error: 'No se ha podido sustituir la ficha provisional.' }, 500);
    }
  }

  const { error } = await supabase.from('clientes').insert({
    id,
    nombre: body.nombre.trim(),
    empresa: body.empresa?.trim() || null,
    email,
    tipo_persona: body.tipoPersona,
    alta_hecha: body.tipoPersona === 'autonomo' ? body.tramitamosAlta : null,
    reporting: body.reporting,
    beel_contratado: body.beelContratado === true,
    telefono: body.telefono?.trim() || null,
    plan: body.plan ?? null,
    idioma: body.idioma ?? 'es',
  });

  if (error) {
    // 23505 = unique_violation: NIF repetido (clave primaria) o email repetido
    // (índice único en lower(email)).
    if (error.code === '23505') {
      return json({ error: 'Ya existe un cliente con ese NIF o con ese email.' }, 409);
    }
    console.error('[alta-cliente] insert falló', error.message);
    return json({ error: 'No se ha podido crear el cliente.' }, 500);
  }

  return json({ ok: true, id });
};
