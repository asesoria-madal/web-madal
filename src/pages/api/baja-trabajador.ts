import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { nifValido } from '../../lib/nif';

export const prerender = false;

// Recibe el formulario «baja de trabajador» (FormularioBajaTrabajador.astro), que rellena nuestro cliente con
// los datos de la baja, y lo guarda en `bajas_trabajadores` (ver supabase/schema.sql, bloque 2026-11-22).
// El workflow de n8n «Baja de trabajador» (cada 5 min) crea el cobro en la facturación de Cegid y avisa al
// equipo. Nada de esto toca DiezNom.
//
// Mismo criterio de validación «deliberadamente laxa» que alta-trabajador.ts: descarta entradas rotas y exige lo
// necesario para tramitar. Devuelve `field` con el primer campo que falla para que el formulario lo nombre.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIF_CIF_PATTERN = /^[0-9A-Za-z][0-9]{7}[A-Za-z0-9]$/;
const NIF_NIE_PATTERN = /^[0-9XYZxyz][0-9]{7}[A-Za-z]$/;
const TELEFONO_PATTERN = /^[+\d][\d\s-]{6,20}$/;
const FECHA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CAUSAS = ['voluntaria', 'fin_contrato', 'prueba_no_superada', 'mutuo_acuerdo', 'despido_disciplinario', 'despido_objetivo', 'jubilacion', 'fallecimiento', 'otra'];
const PREAVISO = ['si', 'no', 'no_se'];
const CARTA = ['tiene', 'redactar'];
const CAUSA_OBJETIVO = ['economica', 'tecnica', 'organizativa', 'productiva'];
const JUBILACION = ['ordinaria', 'anticipada', 'parcial'];
const SITUACIONES = ['baja_medica', 'embarazo', 'excedencia', 'reduccion_jornada', 'representante'];

// Mínimo de caracteres de los hechos o la causa de un despido: una descripción de una palabra no sirve.
const DESPIDO_MIN = 30;

const isNonEmptyString = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isOptionalString = (v: unknown, max: number) => v === undefined || (typeof v === 'string' && v.length <= max);
const isFecha = (v: unknown): v is string => typeof v === 'string' && FECHA_PATTERN.test(v) && !Number.isNaN(Date.parse(v));
const isNumberBetween = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isOptionalBool = (v: unknown) => v === undefined || typeof v === 'boolean';

function primerCampoInvalido(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'datos';
  const b = body as Record<string, unknown>;

  // Empresa y quien comunica
  if (!isNonEmptyString(b.empresaNombre, 150)) return 'empresaNombre';
  if (typeof b.empresaNif !== 'string' || !NIF_CIF_PATTERN.test(b.empresaNif.trim()) || !nifValido(b.empresaNif)) return 'empresaNif';
  if (typeof b.empresaEmail !== 'string' || !EMAIL_PATTERN.test(b.empresaEmail) || b.empresaEmail.length > 254) return 'empresaEmail';
  if (!isNonEmptyString(b.comunicanteNombre, 120)) return 'comunicanteNombre';
  if (!isOptionalString(b.comunicanteCargo, 100)) return 'comunicanteCargo';
  if (typeof b.comunicanteTelefono !== 'string' || !TELEFONO_PATTERN.test(b.comunicanteTelefono.trim())) return 'comunicanteTelefono';

  // Trabajador
  if (!isNonEmptyString(b.trabajadorNombre, 150)) return 'trabajadorNombre';
  if (typeof b.trabajadorNif !== 'string' || !NIF_NIE_PATTERN.test(b.trabajadorNif.trim())) return 'trabajadorNif';
  if (b.trabajadorCodigo !== undefined && (typeof b.trabajadorCodigo !== 'number' || !Number.isInteger(b.trabajadorCodigo) || b.trabajadorCodigo < 1)) return 'trabajadorNombre';

  // La baja
  if (!isFecha(b.fechaBaja)) return 'fechaBaja';
  if (!CAUSAS.includes(b.causa as string)) return 'causa';
  const causa = b.causa as string;
  if (causa === 'voluntaria') {
    if (!isFecha(b.fechaAviso)) return 'fechaAviso';
    if (b.preavisoCumplido !== undefined && !PREAVISO.includes(b.preavisoCumplido as string)) return 'preavisoCumplido';
  }
  if (causa === 'prueba_no_superada' && !isFecha(b.pruebaFin)) return 'pruebaFin';
  if (b.importePactado !== undefined && !isNumberBetween(b.importePactado, 0, 10_000_000)) return 'importePactado';
  if (causa === 'despido_disciplinario') {
    if (!isNonEmptyString(b.hechos, 2000) || b.hechos.trim().length < DESPIDO_MIN) return 'hechos';
    if (!isFecha(b.fechaHechos)) return 'fechaHechos';
    if (!isFecha(b.fechaConocimiento)) return 'fechaConocimiento';
    if (!CARTA.includes(b.carta as string)) return 'carta';
  }
  if (causa === 'despido_objetivo') {
    if (!CAUSA_OBJETIVO.includes(b.causaObjetivo as string)) return 'causaObjetivo';
    if (!isNonEmptyString(b.descripcionCausa, 2000) || b.descripcionCausa.trim().length < DESPIDO_MIN) return 'descripcionCausa';
  }
  if (causa === 'jubilacion' && !JUBILACION.includes(b.jubilacionTipo as string)) return 'jubilacionTipo';
  if (causa === 'otra' && !isNonEmptyString(b.causaOtra, 1000)) return 'causaOtra';
  for (const c of ['avisoEscrito', 'finComunicado', 'pruebaEscrito', 'acuerdoFirmado', 'preaviso15', 'indemnizacion']) {
    if (!isOptionalBool(b[c])) return c;
  }

  // Liquidación y situación
  if (b.vacacionesPendientes !== undefined && !isNumberBetween(b.vacacionesPendientes, 0, 365)) return 'vacacionesPendientes';
  if (!Array.isArray(b.situaciones) || b.situaciones.length > SITUACIONES.length || !b.situaciones.every((s) => SITUACIONES.includes(s as string))) return 'situaciones';
  if (!isOptionalString(b.observaciones, 1000)) return 'observaciones';

  if (b.privacyAccepted !== true) return 'privacyAccepted';
  return null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// Mismo limitador best-effort en memoria que alta-trabajador.ts.
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

// Texto recortado, o null si viene vacío o no viene.
const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

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
  if (campoInvalido) return json({ error: 'Respuestas no válidas', field: campoInvalido }, 400);
  const b = raw as Record<string, unknown>;

  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ persisted: false });

  const causa = b.causa as string;
  const nif = (b.empresaNif as string).trim().toUpperCase();

  // La ficha del cliente se busca por NIF (clientes.id). Si no existe, la fila se guarda igualmente sin cliente_id
  // y n8n lo avisa: así un NIF mal escrito no hace perder la petición.
  const { data: ficha } = await supabase.from('clientes').select('id').eq('id', nif).maybeSingle();

  // Respuestas propias de cada motivo: solo las del motivo elegido, recortadas a los campos conocidos.
  const detalle: Record<string, unknown> = {};
  const poner = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== '') detalle[k] = v; };
  if (causa === 'voluntaria') {
    poner('fechaAviso', b.fechaAviso); poner('avisoEscrito', b.avisoEscrito === true); poner('preavisoCumplido', b.preavisoCumplido);
  }
  if (causa === 'fin_contrato') poner('finComunicado', b.finComunicado === true);
  if (causa === 'prueba_no_superada') { poner('pruebaFin', b.pruebaFin); poner('pruebaEscrito', b.pruebaEscrito === true); }
  if (causa === 'mutuo_acuerdo') { poner('importePactado', b.importePactado); poner('acuerdoFirmado', b.acuerdoFirmado === true); }
  if (causa === 'despido_disciplinario') {
    poner('hechos', txt(b.hechos)); poner('fechaHechos', b.fechaHechos); poner('fechaConocimiento', b.fechaConocimiento); poner('carta', b.carta);
  }
  if (causa === 'despido_objetivo') {
    poner('causaObjetivo', b.causaObjetivo); poner('descripcionCausa', txt(b.descripcionCausa));
    poner('preaviso15', b.preaviso15 === true); poner('indemnizacion', b.indemnizacion === true);
  }
  if (causa === 'jubilacion') poner('jubilacionTipo', b.jubilacionTipo);
  if (causa === 'otra') poner('causaOtra', txt(b.causaOtra));

  const row = {
    cliente_id: ficha?.id ?? null,
    empresa_nombre: txt(b.empresaNombre),
    empresa_nif: nif,
    empresa_email: (b.empresaEmail as string).trim().toLowerCase(),
    comunicante_nombre: txt(b.comunicanteNombre),
    comunicante_cargo: txt(b.comunicanteCargo),
    comunicante_telefono: (b.comunicanteTelefono as string).trim(),
    trabajador_codigo: typeof b.trabajadorCodigo === 'number' ? b.trabajadorCodigo : null,
    trabajador_nombre: txt(b.trabajadorNombre),
    trabajador_nif: (b.trabajadorNif as string).trim().toUpperCase(),
    fecha_baja: b.fechaBaja,
    causa,
    detalle,
    vacaciones_pendientes: typeof b.vacacionesPendientes === 'number' ? b.vacacionesPendientes : null,
    situaciones: b.situaciones,
    observaciones: txt(b.observaciones),
    privacy_accepted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('bajas_trabajadores').insert(row);
  if (error) return json({ error: 'No se han podido guardar los datos' }, 500);

  return json({ persisted: true });
};
