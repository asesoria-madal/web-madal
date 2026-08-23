import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Mismo criterio de validación "deliberadamente laxa" que presupuesto.ts:
// basta para descartar entradas rotas, no pretende validar NIF/IBAN al
// 100% — eso ya lo revisa Edurne a mano antes de tramitar el alta.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const QUOTE_CODE_PATTERN = /^CC-\d{2}-\d{5}$/;
const NIF_NIE_PATTERN = /^[0-9XYZxyz][0-9]{7}[A-Za-z]$/;
const IBAN_PATTERN = /^[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}$/;
const TELEFONO_PATTERN = /^[+\d][\d\s-]{6,20}$/;
const FECHA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const IDENTIFICACION_VALUES = ['certificado', 'clave_pin', 'ninguno'];
const TIPO_LOCAL_VALUES = ['casa', 'oficina', 'sin_local'];
const REGIMEN_COTIZACION_VALUES = ['reta', 'mutualidad'];
const RETENCION_IRPF_VALUES = ['si', 'no', 'no_sabe'];

interface Body {
  quoteCode?: string;
  identificacionDigital: string;
  nombreCompleto: string;
  nifNie: string;
  email: string;
  telefono: string;
  domicilioFiscal: string;
  domicilioNotificaciones?: string;
  iban: string;
  epigrafesIae: string;
  fechaInicioActividad: string;
  tipoLocal: string;
  domicilioLocal?: string;
  multiplesLocales: boolean;
  detalleLocalesAdicionales?: string;
  profesionColegiada: boolean;
  regimenCotizacion?: string;
  operacionesIntracomunitarias: boolean;
  retencionIrpf: string;
  tendraTrabajadores: boolean;
  privacyAccepted: boolean;
}

function isNonEmptyString(v: unknown, maxLength: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLength;
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;

  if (b.quoteCode !== undefined && (typeof b.quoteCode !== 'string' || !QUOTE_CODE_PATTERN.test(b.quoteCode))) return false;
  if (!IDENTIFICACION_VALUES.includes(b.identificacionDigital as string)) return false;
  if (!isNonEmptyString(b.nombreCompleto, 150)) return false;
  if (typeof b.nifNie !== 'string' || !NIF_NIE_PATTERN.test(b.nifNie.trim())) return false;
  if (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254) return false;
  if (typeof b.telefono !== 'string' || !TELEFONO_PATTERN.test(b.telefono.trim())) return false;
  if (!isNonEmptyString(b.domicilioFiscal, 300)) return false;
  if (b.domicilioNotificaciones !== undefined && (typeof b.domicilioNotificaciones !== 'string' || b.domicilioNotificaciones.length > 300)) return false;
  if (typeof b.iban !== 'string' || !IBAN_PATTERN.test(b.iban.trim().replace(/\s+/g, ''))) return false;
  if (!isNonEmptyString(b.epigrafesIae, 500)) return false;
  if (typeof b.fechaInicioActividad !== 'string' || !FECHA_PATTERN.test(b.fechaInicioActividad)) return false;
  if (!TIPO_LOCAL_VALUES.includes(b.tipoLocal as string)) return false;
  // El domicilio del local es obligatorio salvo que la actividad sea "sin local".
  if (b.tipoLocal !== 'sin_local' && !isNonEmptyString(b.domicilioLocal, 300)) return false;
  if (b.domicilioLocal !== undefined && (typeof b.domicilioLocal !== 'string' || b.domicilioLocal.length > 300)) return false;
  if (typeof b.multiplesLocales !== 'boolean') return false;
  if (b.detalleLocalesAdicionales !== undefined && (typeof b.detalleLocalesAdicionales !== 'string' || b.detalleLocalesAdicionales.length > 300)) return false;
  if (typeof b.profesionColegiada !== 'boolean') return false;
  // El régimen de cotización solo tiene sentido (y solo se pregunta en el
  // formulario) cuando la profesión es colegiada.
  if (b.profesionColegiada) {
    if (!REGIMEN_COTIZACION_VALUES.includes(b.regimenCotizacion as string)) return false;
  } else if (b.regimenCotizacion !== undefined) {
    return false;
  }
  if (typeof b.operacionesIntracomunitarias !== 'boolean') return false;
  if (!RETENCION_IRPF_VALUES.includes(b.retencionIrpf as string)) return false;
  if (typeof b.tendraTrabajadores !== 'boolean') return false;
  if (b.privacyAccepted !== true) return false;

  return true;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

// Mismo limitador best-effort en memoria que presupuesto.ts — ver la nota
// ahí sobre por qué basta para esta fase del proyecto.
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

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Sin Supabase configurado no hay dónde persistir — respondemos en
    // degradado, igual que presupuesto.ts, para no romper la experiencia
    // mientras se termina de montar el proyecto.
    return json({ persisted: false });
  }

  const insertRow: Record<string, unknown> = {
    identificacion_digital: body.identificacionDigital,
    nombre_completo: body.nombreCompleto.trim(),
    nif_nie: body.nifNie.trim().toUpperCase(),
    email: body.email,
    telefono: body.telefono.trim(),
    domicilio_fiscal: body.domicilioFiscal.trim(),
    iban: body.iban.trim().replace(/\s+/g, '').toUpperCase(),
    epigrafes_iae: body.epigrafesIae.trim(),
    fecha_inicio_actividad: body.fechaInicioActividad,
    tipo_local: body.tipoLocal,
    multiples_locales: body.multiplesLocales,
    profesion_colegiada: body.profesionColegiada,
    operaciones_intracomunitarias: body.operacionesIntracomunitarias,
    retencion_irpf: body.retencionIrpf,
    tendra_trabajadores: body.tendraTrabajadores,
    privacy_accepted_at: new Date().toISOString(),
  };
  if (body.quoteCode) insertRow.quote_code = body.quoteCode;
  if (body.domicilioNotificaciones) insertRow.domicilio_notificaciones = body.domicilioNotificaciones.trim();
  if (body.tipoLocal !== 'sin_local' && body.domicilioLocal) insertRow.domicilio_local = body.domicilioLocal.trim();
  if (body.multiplesLocales && body.detalleLocalesAdicionales) insertRow.detalle_locales_adicionales = body.detalleLocalesAdicionales.trim();
  if (body.profesionColegiada) insertRow.regimen_cotizacion = body.regimenCotizacion;

  const { error: insertError } = await supabase.from('alta_nuevos_autonomos').insert(insertRow);
  if (insertError) {
    return json({ error: 'No se han podido guardar los datos' }, 500);
  }

  return json({ persisted: true });
};
