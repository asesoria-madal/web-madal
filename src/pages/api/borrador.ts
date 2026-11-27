import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { NO_APLAZABLES } from '../../i18n/borradores';

export const prerender = false;

// Respuesta del cliente a los borradores de impuestos (2026-11-27). La usa la página /borradores?t=<token>
// (components/pages/Borradores.astro). El envío lo crea n8n «Enviar borradores» en `borradores_envios` y lo
// procesa n8n «Respuestas de borradores» (hoja de la campaña y aviso a contacto@). El token es el único acceso:
// 32 caracteres aleatorios, que solo llevan el correo del cliente y la copia oculta a contacto@.
//
// GET ?t=…  → los modelos de ese envío (sin el NIF), si sigue vigente (es el último de ese cliente y trimestre)
//             y lo que respondió, si ya respondió.
// POST { t, modelos: [{ modelo, opcion, meses?, comentario? }], comentario? } → guarda la respuesta. Se puede
//             cambiar mientras el envío esté vigente: vuelve a marcarla como pendiente de procesar.
// Validación: un elemento por cada modelo del envío; opción según el resultado (a pagar: domiciliar, aplazar o
// mal; los demás: conforme o mal); aplazar solo si el modelo se puede aplazar, de 1 a 12 meses (SL) o de 1 a 24
// (autónomos), decisión de Edurne del 2026-11-07; «mal» con comentario.
const TOKEN = /^[A-Za-z0-9_-]{24,64}$/;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

type Modelo = { modelo: string; importe: number; resultado: string; aplazable?: boolean };

async function leer(token: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: json({ error: 'No disponible' }, 503) };
  const { data: envio } = await supabase.from('borradores_envios')
    .select('id, cliente_id, anio, trimestre, idioma, modelos, enviado_at, respuesta, respondido_at, clientes(tipo_persona)')
    .eq('token', token).maybeSingle();
  if (!envio) return { error: json({ error: 'No encontrado' }, 404) };
  const { data: ultimo } = await supabase.from('borradores_envios').select('id')
    .eq('cliente_id', envio.cliente_id).eq('anio', envio.anio).eq('trimestre', envio.trimestre)
    .order('enviado_at', { ascending: false }).limit(1).maybeSingle();
  return { supabase, envio, vigente: ultimo?.id === envio.id };
}

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('t') || '';
  if (!TOKEN.test(token)) return json({ error: 'No válido' }, 400);
  const r = await leer(token);
  if (r.error) return r.error;
  const e = r.envio!;
  const tipo = (e.clientes as unknown as { tipo_persona?: string } | null)?.tipo_persona || 'autonomo';
  return json({ anio: e.anio, trimestre: e.trimestre, tipo, idioma: e.idioma, enviado_at: e.enviado_at, modelos: e.modelos,
    vigente: r.vigente, respondido_at: e.respondido_at, respuesta: e.respuesta });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.t !== 'string' || !TOKEN.test(body.t)) return json({ error: 'No válido' }, 400);
  const r = await leer(body.t);
  if (r.error) return r.error;
  if (!r.vigente) return json({ error: 'Este enlace es de un envío anterior' }, 409);
  const e = r.envio!;
  const tipo = (e.clientes as unknown as { tipo_persona?: string } | null)?.tipo_persona || 'autonomo';
  const maxMeses = tipo === 'sl' ? 12 : 24;
  const modelos = (e.modelos || []) as Modelo[];
  const resp = Array.isArray(body.modelos) ? body.modelos as Record<string, unknown>[] : [];
  if (resp.length !== modelos.length) return json({ error: 'Faltan modelos', field: 'modelos' }, 400);
  const limpio = [];
  for (const m of modelos) {
    const x = resp.find((y) => y && y.modelo === m.modelo);
    if (!x) return json({ error: 'Falta el ' + m.modelo, field: m.modelo }, 400);
    const aplazable = m.aplazable !== false && !NO_APLAZABLES.includes(m.modelo);
    const validas = m.resultado === 'ingresar' ? ['domiciliar', ...(aplazable ? ['aplazar'] : []), 'mal'] : ['conforme', 'mal'];
    if (!validas.includes(x.opcion as string)) return json({ error: 'Opción no válida en el ' + m.modelo, field: m.modelo }, 400);
    const item: { modelo: string; opcion: string; meses?: number; comentario?: string } = { modelo: m.modelo, opcion: x.opcion as string };
    if (x.opcion === 'aplazar') {
      if (typeof x.meses !== 'number' || !Number.isInteger(x.meses) || x.meses < 1 || x.meses > maxMeses) return json({ error: 'Meses no válidos en el ' + m.modelo, field: m.modelo }, 400);
      item.meses = x.meses;
    }
    if (x.opcion === 'mal') {
      if (typeof x.comentario !== 'string' || !x.comentario.trim() || x.comentario.length > 1000) return json({ error: 'Falta el comentario del ' + m.modelo, field: m.modelo }, 400);
      item.comentario = x.comentario.trim();
    }
    limpio.push(item);
  }
  if (body.comentario !== undefined && (typeof body.comentario !== 'string' || body.comentario.length > 1000)) return json({ error: 'Comentario demasiado largo', field: 'comentario' }, 400);
  const respuesta = { modelos: limpio, ...(typeof body.comentario === 'string' && body.comentario.trim() ? { comentario: body.comentario.trim() } : {}) };
  const { error } = await r.supabase!.from('borradores_envios').update({ respuesta, respondido_at: new Date().toISOString(), procesado_at: null }).eq('id', e.id);
  if (error) return json({ error: 'No se ha podido guardar' }, 500);
  return json({ ok: true });
};
