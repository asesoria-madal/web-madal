import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Mismo criterio "deliberadamente laxo" que presupuesto.ts / alta-autonomo.ts.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// NIF (12345678A), NIE (X1234567L) y CIF (B12345678) tienen los tres 9
// caracteres: uno inicial alfanumérico, 7 dígitos, y un carácter de
// control alfanumérico al final.
const NIF_CIF_PATTERN = /^[0-9A-Za-z][0-9]{7}[A-Za-z0-9]$/;
const IBAN_PATTERN = /^[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}$/;
const TELEFONO_PATTERN = /^[+\d][\d\s-]{6,20}$/;
const FECHA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TIPO_VALUES = ['autonomo', 'sl'];
const IDENTIFICACION_VALUES = ['certificado', 'clave_pin', 'ninguno'];

interface Body {
  tipo: string;
  identificacionDigital: string;
  nombreRazonSocial: string;
  nifCif: string;
  email: string;
  telefono: string;
  domicilioFiscal: string;
  domicilioSocial?: string;
  domicilioNotificaciones?: string;
  iban: string;
  fechaAltaActividad?: string;
  epigrafesIaeActuales?: string;
  regimenIvaActual?: string;
  regimenIrpfActual?: string;
  facturaConRetencion?: boolean;
  porcentajeRetencion?: number;
  tieneTrabajadores: boolean;
  numeroTrabajadores?: number;
  operacionesIntracomunitarias: boolean;
  tieneRequerimientosAeat: boolean;
  detalleRequerimientosAeat?: string;
  contactoGestoriaAnterior: string;
  autorizaSolicitarHistorico: boolean;
  privacyAccepted: boolean;
}

function isNonEmptyString(v: unknown, maxLength: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLength;
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;

  if (!TIPO_VALUES.includes(b.tipo as string)) return false;
  const isAutonomo = b.tipo === 'autonomo';

  if (!IDENTIFICACION_VALUES.includes(b.identificacionDigital as string)) return false;
  if (!isNonEmptyString(b.nombreRazonSocial, 150)) return false;
  if (typeof b.nifCif !== 'string' || !NIF_CIF_PATTERN.test(b.nifCif.trim())) return false;
  if (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254) return false;
  if (typeof b.telefono !== 'string' || !TELEFONO_PATTERN.test(b.telefono.trim())) return false;
  if (!isNonEmptyString(b.domicilioFiscal, 300)) return false;
  if (b.domicilioNotificaciones !== undefined && (typeof b.domicilioNotificaciones !== 'string' || b.domicilioNotificaciones.length > 300)) return false;
  if (typeof b.iban !== 'string' || !IBAN_PATTERN.test(b.iban.trim().replace(/\s+/g, ''))) return false;

  // Domicilio social: obligatorio en SL, no se pregunta en autónomo.
  if (!isAutonomo && !isNonEmptyString(b.domicilioSocial, 300)) return false;
  if (isAutonomo && b.domicilioSocial !== undefined) return false;

  // Situación fiscal actual, exclusiva de autónomo — ver comentario en schema.sql.
  if (isAutonomo) {
    if (typeof b.fechaAltaActividad !== 'string' || !FECHA_PATTERN.test(b.fechaAltaActividad)) return false;
    if (!isNonEmptyString(b.epigrafesIaeActuales, 500)) return false;
    if (!isNonEmptyString(b.regimenIvaActual, 100)) return false;
    if (!isNonEmptyString(b.regimenIrpfActual, 100)) return false;
    if (typeof b.facturaConRetencion !== 'boolean') return false;
    if (b.facturaConRetencion) {
      if (typeof b.porcentajeRetencion !== 'number' || b.porcentajeRetencion < 0 || b.porcentajeRetencion > 100) return false;
    } else if (b.porcentajeRetencion !== undefined) {
      return false;
    }
  } else {
    if (b.fechaAltaActividad !== undefined || b.epigrafesIaeActuales !== undefined || b.regimenIvaActual !== undefined ||
        b.regimenIrpfActual !== undefined || b.facturaConRetencion !== undefined || b.porcentajeRetencion !== undefined) {
      return false;
    }
  }

  if (typeof b.tieneTrabajadores !== 'boolean') return false;
  if (b.tieneTrabajadores) {
    if (typeof b.numeroTrabajadores !== 'number' || !Number.isInteger(b.numeroTrabajadores) || b.numeroTrabajadores < 1) return false;
  } else if (b.numeroTrabajadores !== undefined) {
    return false;
  }
  if (typeof b.operacionesIntracomunitarias !== 'boolean') return false;

  if (typeof b.tieneRequerimientosAeat !== 'boolean') return false;
  if (b.tieneRequerimientosAeat) {
    if (!isNonEmptyString(b.detalleRequerimientosAeat, 500)) return false;
  } else if (b.detalleRequerimientosAeat !== undefined) {
    return false;
  }
  if (!isNonEmptyString(b.contactoGestoriaAnterior, 300)) return false;
  if (b.autorizaSolicitarHistorico !== true) return false;

  if (b.privacyAccepted !== true) return false;

  return true;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

// Mismo limitador best-effort en memoria que presupuesto.ts / alta-autonomo.ts.
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
    return json({ persisted: false });
  }

  const isAutonomo = body.tipo === 'autonomo';
  const insertRow: Record<string, unknown> = {
    tipo: body.tipo,
    identificacion_digital: body.identificacionDigital,
    nombre_razon_social: body.nombreRazonSocial.trim(),
    nif_cif: body.nifCif.trim().toUpperCase(),
    email: body.email,
    telefono: body.telefono.trim(),
    domicilio_fiscal: body.domicilioFiscal.trim(),
    iban: body.iban.trim().replace(/\s+/g, '').toUpperCase(),
    tiene_trabajadores: body.tieneTrabajadores,
    operaciones_intracomunitarias: body.operacionesIntracomunitarias,
    tiene_requerimientos_aeat: body.tieneRequerimientosAeat,
    contacto_gestoria_anterior: body.contactoGestoriaAnterior.trim(),
    autoriza_solicitar_historico: body.autorizaSolicitarHistorico,
    privacy_accepted_at: new Date().toISOString(),
  };

  if (body.domicilioNotificaciones) insertRow.domicilio_notificaciones = body.domicilioNotificaciones.trim();
  if (!isAutonomo) insertRow.domicilio_social = body.domicilioSocial!.trim();

  if (isAutonomo) {
    insertRow.fecha_alta_actividad = body.fechaAltaActividad;
    insertRow.epigrafes_iae_actuales = body.epigrafesIaeActuales!.trim();
    insertRow.regimen_iva_actual = body.regimenIvaActual!.trim();
    insertRow.regimen_irpf_actual = body.regimenIrpfActual!.trim();
    insertRow.factura_con_retencion = body.facturaConRetencion;
    if (body.facturaConRetencion) insertRow.porcentaje_retencion = body.porcentajeRetencion;
  }

  if (body.tieneTrabajadores) insertRow.numero_trabajadores = body.numeroTrabajadores;
  if (body.tieneRequerimientosAeat) insertRow.detalle_requerimientos_aeat = body.detalleRequerimientosAeat!.trim();

  const { error: insertError } = await supabase.from('traspasos_nuevos').insert(insertRow);
  if (insertError) {
    return json({ error: 'No se han podido guardar los datos' }, 500);
  }

  return json({ persisted: true });
};
