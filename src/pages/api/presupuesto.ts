import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Tarifas base SIN IVA, por tramo de facturas/mes. El total que se guarda
// y se devuelve va siempre CON IVA (21%) — así coincide con lo que se
// muestra en el simulador y en la web.
const RATES_AUTONOMO: Record<string, number> = { bajo: 40, medio: 50, alto: 60 };
const RATES_PYME: Record<string, number> = { t1: 100, t2: 115, t3: 130, t4: 150 };
// "nose" (no lo tiene claro) no suma nada al total: el reporting solo se
// cobra si el cliente lo confirma con "si". Ver Simulador.astro (duplicado
// deliberado del cálculo, para que coincidan front y back).
const REPORTING: Record<string, number> = { si: 30, no: 0, nose: 0 };
const IVA_RATE = 0.21;

// Validación deliberadamente laxa (longitud + forma "algo@algo.algo"): basta
// para descartar entradas rotas, no pretende validar el correo al 100% —
// para eso ya está la confirmación por email cuando el equipo responda.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const QUOTE_CODE_PATTERN = /^CC-\d{2}-\d{5}$/;

interface Body {
  regimen: string;
  facturas: string;
  reporting: string;
  alta?: string;
  certificado?: string;
  actividad?: string;
  fechaInicio?: string;
  email?: string;
  privacyAccepted?: boolean;
}

const FECHA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Los cuatro campos solo existen en la rama "autónomo sin dar de alta" del
// simulador (ver Simulador.astro, branchSteps): si vienen, deben tener forma
// válida; si no vienen, se guardan como NULL igual que para el resto de ramas.
function isValidAltaFields(b: Record<string, unknown>): boolean {
  if (b.alta !== undefined && (typeof b.alta !== 'string' || (b.alta !== 'si' && b.alta !== 'no'))) return false;
  if (b.certificado !== undefined && (typeof b.certificado !== 'string' || (b.certificado !== 'si' && b.certificado !== 'no'))) return false;
  if (b.actividad !== undefined && (typeof b.actividad !== 'string' || b.actividad.length === 0 || b.actividad.length > 100)) return false;
  if (b.fechaInicio !== undefined && (typeof b.fechaInicio !== 'string' || !FECHA_PATTERN.test(b.fechaInicio))) return false;
  return true;
}

function isValidEmailPair(b: Record<string, unknown>): boolean {
  // El email es opcional (el visitante puede omitir ese paso), pero si viene
  // relleno, exigimos que también venga el consentimiento explícito: nunca
  // guardamos un correo sin constancia de que se aceptó la política de
  // privacidad para recogerlo.
  if (b.email === undefined) return true;
  if (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254) return false;
  return b.privacyAccepted === true;
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.regimen !== 'string' || typeof b.facturas !== 'string' || typeof b.reporting !== 'string') return false;
  if (!(b.reporting in REPORTING)) return false;
  if (!isValidEmailPair(b)) return false;
  if (!isValidAltaFields(b)) return false;
  if (b.regimen === 'autonomo') return b.facturas in RATES_AUTONOMO;
  if (b.regimen === 'pyme') return b.facturas in RATES_PYME;
  return false;
}

interface EmailBody {
  quote: string;
  email: string;
  privacyAccepted: boolean;
}

function isValidEmailBody(body: unknown): body is EmailBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.quote !== 'string' || !QUOTE_CODE_PATTERN.test(b.quote)) return false;
  if (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254) return false;
  return b.privacyAccepted === true;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

// Limitador best-effort en memoria: vive mientras la función serverless esté
// caliente, se reinicia en cada cold start y no se comparte entre instancias.
// No es una defensa robusta, pero basta para frenar el spam trivial a este
// endpoint público sin montar infraestructura nueva (Redis, etc.) en esta
// fase del proyecto — ver auditoría de escalabilidad.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  if (!isValid(body)) {
    return json({ error: 'Respuestas no válidas' }, 400);
  }

  const rates = body.regimen === 'pyme' ? RATES_PYME : RATES_AUTONOMO;
  const subtotal = rates[body.facturas] + REPORTING[body.reporting];
  const total = round2(subtotal * (1 + IVA_RATE));
  const year = new Date().getFullYear();
  const yy = String(year).slice(-2);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Todavía no hay Supabase configurado: devolvemos un ID de demo, sin persistir,
    // para que el simulador siga funcionando mientras se crea el proyecto real.
    const demo = `CC-${yy}-DEMO${Math.floor(10000 + Math.random() * 90000)}`;
    return json({ quote: demo, total, persisted: false });
  }

  const { data: seq, error: seqError } = await supabase.rpc('next_quote_number', { p_year: year });
  if (seqError || seq == null) {
    return json({ error: 'No se ha podido generar el número de presupuesto' }, 500);
  }

  const quote = `CC-${yy}-${String(seq).padStart(5, '0')}`;

  // Solo incluimos email/privacy_accepted_at en el insert cuando hay un
  // correo que guardar: así, si esas columnas todavía no existen en la
  // tabla (falta ejecutar el alter table de supabase/schema.sql), el
  // presupuesto se sigue generando con normalidad para el caso sin email
  // — el error queda aislado al caso que realmente las necesita.
  const hasEmail = typeof body.email === 'string';
  const insertRow: Record<string, unknown> = {
    quote_code: quote,
    regimen: body.regimen,
    facturas: body.facturas,
    reporting: body.reporting,
    total,
  };
  if (typeof body.alta === 'string') insertRow.alta = body.alta;
  if (typeof body.certificado === 'string') insertRow.certificado = body.certificado;
  if (typeof body.actividad === 'string') insertRow.actividad = body.actividad;
  if (typeof body.fechaInicio === 'string') insertRow.fecha_inicio = body.fechaInicio;
  if (hasEmail) {
    insertRow.email = body.email;
    insertRow.privacy_accepted_at = new Date().toISOString();
  }

  const { error: insertError } = await supabase.from('presupuestos').insert(insertRow);
  if (insertError) {
    return json({ error: 'No se ha podido guardar el presupuesto' }, 500);
  }

  return json({ quote, total, persisted: true });
};

// Cuando el visitante omite el paso de email en el simulador pero luego
// cambia de opinión ya viendo el resultado, este endpoint le añade el
// correo (con su consentimiento) al presupuesto que ya se generó, en vez
// de crear uno nuevo.
export const PATCH: APIRoute = async ({ request, clientAddress }) => {
  if (isRateLimited(clientAddress)) {
    return json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.' }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  if (!isValidEmailBody(body)) {
    return json({ error: 'Datos no válidos' }, 400);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Sin Supabase configurado no hay nada que actualizar (el presupuesto
    // original tampoco se persistió) — respondemos igualmente en éxito para
    // no romper la experiencia mientras se termina de montar el proyecto.
    return json({ persisted: false });
  }

  const { error: updateError, count } = await supabase
    .from('presupuestos')
    .update({ email: body.email, privacy_accepted_at: new Date().toISOString() }, { count: 'exact' })
    .eq('quote_code', body.quote);

  if (updateError) {
    return json({ error: 'No se ha podido guardar el correo' }, 500);
  }
  if (!count) {
    return json({ error: 'No existe ese número de presupuesto' }, 404);
  }

  return json({ persisted: true });
};
