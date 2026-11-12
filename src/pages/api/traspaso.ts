import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { MODELOS_AUTONOMO, MODELOS_SL } from '../../i18n/formularios';
import { useTranslations } from '../../i18n/utils';
import { limpiarIban, ibanValido } from '../../lib/iban';

export const prerender = false;

// Mismo criterio "deliberadamente laxo" que presupuesto.ts / alta-autonomo.ts.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// NIF (12345678A), NIE (X1234567L) y CIF (B12345678) tienen los tres 9
// caracteres: uno inicial alfanumérico, 7 dígitos, y un carácter de
// control alfanumérico al final.
const NIF_CIF_PATTERN = /^[0-9A-Za-z][0-9]{7}[A-Za-z0-9]$/;
const DNI_NIE_PATTERN = /^[0-9XYZxyz][0-9]{7}[A-Za-z]$/;
const TELEFONO_PATTERN = /^[+\d][\d\s-]{6,20}$/;
const FECHA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TIPO_VALUES = ['autonomo', 'sl'];
// La SL solo puede tener o no tener certificado de representante: el Cl@ve no sirve para una sociedad.
const IDENTIFICACION_VALUES: Record<string, string[]> = { autonomo: ['certificado', 'clave_pin', 'ninguno'], sl: ['certificado', 'ninguno'] };
const SII_VALUES = ['si', 'no', 'no_sabe'];
const QUIEN_LLEVA = ['gestoria', 'propia', 'empieza'];
const FACTURACION_VALUES = ['si', 'no', 'no_sabe'];const IDIOMAS = ['es', 'ca', 'en'];
// Planes: los mismos de la web (ui.ts), más "no lo sé".
const precios = useTranslations('es').precios;
const PLANES: Record<string, string[]> = {
  autonomo: [...precios.autonomoTiers.map((p) => p.key), 'no_sabe'],
  sl: [...precios.pymeTiers.map((p) => p.key), 'no_sabe'],
};
const MODELOS: Record<string, string[]> = { autonomo: MODELOS_AUTONOMO, sl: MODELOS_SL };

function isNonEmptyString(v: unknown, maxLength: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLength;
}
const opcional = (v: unknown, maxLength: number) => v === undefined || (typeof v === 'string' && v.length <= maxLength);

// Devuelve el nombre del primer campo que no valida (o null si todo está bien),
// para poder decirle al cliente exactamente cuál corregir.
function primerCampoInvalido(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'datos';
  const b = body as Record<string, unknown>;

  if (!TIPO_VALUES.includes(b.tipo as string)) return 'tipo';
  const tipo = b.tipo as string;
  const isAutonomo = tipo === 'autonomo';

  if (!IDENTIFICACION_VALUES[tipo].includes(b.identificacionDigital as string)) return 'identificacionDigital';
  if (!isAutonomo) {
    if (!isNonEmptyString(b.adminNombre, 150)) return 'adminNombre';
    if (typeof b.adminDni !== 'string' || !DNI_NIE_PATTERN.test(b.adminDni.trim())) return 'adminDni';
  }
  if (!isNonEmptyString(b.nombreRazonSocial, 150)) return 'nombreRazonSocial';
  if (typeof b.nifCif !== 'string' || !NIF_CIF_PATTERN.test(b.nifCif.trim())) return 'nifCif';
  if (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254) return 'email';
  if (typeof b.telefono !== 'string' || !TELEFONO_PATTERN.test(b.telefono.trim())) return 'telefono';
  if (!isNonEmptyString(b.domicilioFiscal, 300)) return 'domicilioFiscal';
  // Cuenta para domiciliar los impuestos: obligatoria y con dígito de control correcto (2026-11-12).
  if (typeof b.ibanImpuestos !== 'string' || !ibanValido(b.ibanImpuestos)) return 'ibanImpuestos';
  if (!opcional(b.domicilioNotificaciones, 300)) return 'domicilioNotificaciones';
  // Domicilio social: solo SL y solo si es distinto del fiscal.
  if (isAutonomo ? b.domicilioSocial !== undefined : !opcional(b.domicilioSocial, 300)) return 'domicilioSocial';

  if (!isNonEmptyString(b.regimenIvaActual, 100)) return 'regimenIvaActual';
  if (isAutonomo) {
    if (typeof b.fechaAltaActividad !== 'string' || !FECHA_PATTERN.test(b.fechaAltaActividad)) return 'fechaAltaActividad';
    if (!isNonEmptyString(b.epigrafesIaeActuales, 500)) return 'epigrafesIaeActuales';
    if (!isNonEmptyString(b.regimenIrpfActual, 100)) return 'regimenIrpfActual';
    if (typeof b.facturaConRetencion !== 'boolean') return 'porcentajeRetencion';
    if (b.facturaConRetencion) {
      if (typeof b.porcentajeRetencion !== 'number' || b.porcentajeRetencion < 0 || b.porcentajeRetencion > 100) return 'porcentajeRetencion';
    } else if (b.porcentajeRetencion !== undefined) return 'porcentajeRetencion';
    if (b.sii !== undefined || b.adminNombre !== undefined || b.adminDni !== undefined) return 'tipo';
  } else {
    if (!SII_VALUES.includes(b.sii as string)) return 'sii';
    if (b.fechaAltaActividad !== undefined || b.epigrafesIaeActuales !== undefined || b.regimenIrpfActual !== undefined ||
        b.facturaConRetencion !== undefined || b.porcentajeRetencion !== undefined) return 'tipo';
  }

  if (typeof b.tieneTrabajadores !== 'boolean') return 'numeroTrabajadores';
  if (b.tieneTrabajadores) {
    if (typeof b.numeroTrabajadores !== 'number' || !Number.isInteger(b.numeroTrabajadores) || b.numeroTrabajadores < 1) return 'numeroTrabajadores';
  } else if (b.numeroTrabajadores !== undefined) return 'numeroTrabajadores';
  if (typeof b.operacionesIntracomunitarias !== 'boolean') return 'datos';

  // Quién le lleva ahora la contabilidad: otra gestoría, él mismo (o la propia sociedad) o
  // acaba de empezar. Los datos de la gestoría, la autorización y los modelos, solo con gestoría.
  if (!QUIEN_LLEVA.includes(b.quienLleva as string)) return 'quienLleva';
  if (b.quienLleva === 'gestoria') {
    if (!isNonEmptyString(b.contactoGestoriaAnterior, 300)) return 'contactoGestoriaAnterior';
    const m = b.modelos;
    if (!Array.isArray(m) || m.length === 0 || m.some((x) => x !== 'no_sabe' && !MODELOS[tipo].includes(x as string)) ||
        (m.includes('no_sabe') && m.length > 1)) return 'modelos';
    if (b.autorizaSolicitarHistorico !== true) return 'autorizaSolicitarHistorico';
  } else if (b.contactoGestoriaAnterior !== undefined || b.modelos !== undefined || b.autorizaSolicitarHistorico !== undefined) {
    return 'quienLleva';
  }

  if (typeof b.tieneRequerimientosAeat !== 'boolean') return 'detalleRequerimientosAeat';
  if (b.tieneRequerimientosAeat) {
    if (!isNonEmptyString(b.detalleRequerimientosAeat, 500)) return 'detalleRequerimientosAeat';
  } else if (b.detalleRequerimientosAeat !== undefined) return 'detalleRequerimientosAeat';

  if (!PLANES[tipo].includes(b.plan as string)) return 'plan';
  // Programa de facturación: se pregunta siempre. En los planes de SL Equipo y Expansión va
  // incluido, pero solo se activa si lo pide.
  if (!FACTURACION_VALUES.includes(b.programaFacturacion as string)) return 'programaFacturacion';
  if (b.privacyAccepted !== true) return 'privacyAccepted';

  return null;
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const campoInvalido = primerCampoInvalido(raw);
  if (campoInvalido) {
    return json({ error: 'Respuestas no válidas', field: campoInvalido }, 400);
  }
  const b = raw as Record<string, any>;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return json({ persisted: false });
  }

  const isAutonomo = b.tipo === 'autonomo';
  const fila: Record<string, unknown> = {
    tipo: b.tipo,
    identificacion_digital: b.identificacionDigital,
    nombre_razon_social: b.nombreRazonSocial.trim(),
    nif_cif: b.nifCif.trim().toUpperCase(),
    email: b.email.trim().toLowerCase(),
    telefono: b.telefono.trim(),
    domicilio_fiscal: b.domicilioFiscal.trim(),
    // En el traspaso es la única cuenta que se pide, así que va también a `iban`, que es la que
    // ya leen la hoja de clientes y la Empresa de HubSpot (Número de cuenta).
    iban: limpiarIban(b.ibanImpuestos),
    iban_impuestos: limpiarIban(b.ibanImpuestos),
    regimen_iva_actual: b.regimenIvaActual.trim(),
    tiene_trabajadores: b.tieneTrabajadores,
    operaciones_intracomunitarias: b.operacionesIntracomunitarias,
    quien_lleva: b.quienLleva,
    tiene_gestoria: b.quienLleva === 'gestoria',
    autoriza_solicitar_historico: b.quienLleva === 'gestoria',
    programa_facturacion: b.programaFacturacion,
    tiene_requerimientos_aeat: b.tieneRequerimientosAeat,
    // "no_sabe" se guarda como null: la ficha se queda sin plan y lo completáis vosotros.
    plan: b.plan === 'no_sabe' ? null : b.plan,
    privacy_accepted_at: new Date().toISOString(),
    // Idioma de la página del formulario: si aún no hay ficha, n8n la crea con este idioma.
    idioma: IDIOMAS.includes(b.idioma) ? b.idioma : 'es',
  };

  if (b.domicilioNotificaciones) fila.domicilio_notificaciones = b.domicilioNotificaciones.trim();
  if (isAutonomo) {
    fila.fecha_alta_actividad = b.fechaAltaActividad;
    fila.epigrafes_iae_actuales = b.epigrafesIaeActuales.trim();
    fila.regimen_irpf_actual = b.regimenIrpfActual.trim();
    fila.factura_con_retencion = b.facturaConRetencion;
    if (b.facturaConRetencion) fila.porcentaje_retencion = b.porcentajeRetencion;
  } else {
    fila.admin_nombre = b.adminNombre.trim();
    fila.admin_dni = b.adminDni.trim().toUpperCase();
    if (b.domicilioSocial) fila.domicilio_social = b.domicilioSocial.trim();
    fila.sii = b.sii;
  }
  if (b.tieneTrabajadores) fila.numero_trabajadores = b.numeroTrabajadores;
  if (b.quienLleva === 'gestoria') {
    fila.contacto_gestoria_anterior = b.contactoGestoriaAnterior.trim();
    // "No lo sé" se guarda como null (con tiene_gestoria = true): los modelos los miráis vosotros.
    fila.modelos = b.modelos.includes('no_sabe') ? null : b.modelos;
  }
  if (b.tieneRequerimientosAeat) fila.detalle_requerimientos_aeat = b.detalleRequerimientosAeat.trim();

  const { error: insertError } = await supabase.from('traspasos_nuevos').insert(fila);
  if (insertError) {
    return json({ error: 'No se han podido guardar los datos' }, 500);
  }

  return json({ persisted: true });
};
