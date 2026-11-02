import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Recibe el formulario "alta de trabajador" (FormularioAltaTrabajador.astro),
// que rellena nuestro cliente con los datos de la persona que va a contratar,
// y lo guarda en la tabla `altas_trabajadores` (ver supabase/schema.sql).
//
// Mismo criterio de validación "deliberadamente laxa" que alta-autonomo.ts:
// descarta entradas rotas y obliga a lo que hace falta para tramitar; no
// pretende validar NIF/IBAN/NUSS al 100 %, eso lo revisa Edurne antes de
// tramitar. Devuelve `field` con el primer campo que falla para que el
// formulario lo nombre.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIF_CIF_PATTERN = /^[0-9A-Za-z][0-9]{7}[A-Za-z0-9]$/; // empresa: NIF de autónomo o CIF de sociedad
const NIF_NIE_PATTERN = /^[0-9XYZxyz][0-9]{7}[A-Za-z]$/; // trabajador
const IBAN_PATTERN = /^[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}$/;
const TELEFONO_PATTERN = /^[+\d][\d\s-]{6,20}$/;
const FECHA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUSS_PATTERN = /^\d{12}$/; // se comprueba tras quitar espacios, barras y guiones

const SEXO_VALUES = ['mujer', 'hombre'];
const NIVEL_ESTUDIOS_VALUES = ['sin_estudios', 'primaria', 'eso', 'bachillerato', 'fp_grado_medio', 'fp_grado_superior', 'universitarios', 'master_doctorado'];
const DATOS_145_VALUES = ['facilita', 'no_facilita'];
const SITUACION_FAMILIAR_VALUES = ['1', '2', '3']; // las tres situaciones del modelo 145
const TIPO_CONTRATO_VALUES = ['indefinido', 'fijo_discontinuo', 'temporal_produccion', 'temporal_sustitucion', 'formativo_alternancia', 'formativo_practica'];
const JORNADA_VALUES = ['completa', 'parcial'];

// Mínimo de caracteres de la causa del contrato temporal: desde la reforma
// laboral de 2021 tiene que ser concreta, así que no se acepta un «pico de
// trabajo» a secas.
const CAUSA_MIN = 30;

function isNonEmptyString(v: unknown, maxLength: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLength;
}
function isOptionalString(v: unknown, maxLength: number): boolean {
  return v === undefined || (typeof v === 'string' && v.length <= maxLength);
}
function isFecha(v: unknown): v is string {
  return typeof v === 'string' && FECHA_PATTERN.test(v);
}
function isNumberBetween(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}
const soloDigitos = (s: string) => s.replace(/[\s/.-]/g, '');

function primerCampoInvalido(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'datos';
  const b = body as Record<string, unknown>;

  // Empresa
  if (!isNonEmptyString(b.empresaNombre, 150)) return 'empresaNombre';
  if (typeof b.empresaNif !== 'string' || !NIF_CIF_PATTERN.test(b.empresaNif.trim())) return 'empresaNif';
  if (typeof b.empresaEmail !== 'string' || !EMAIL_PATTERN.test(b.empresaEmail) || b.empresaEmail.length > 254) return 'empresaEmail';
  if (!isOptionalString(b.ccc, 20)) return 'ccc';
  if (!isNonEmptyString(b.centroTrabajo, 300)) return 'centroTrabajo';
  if (!isOptionalString(b.convenio, 200)) return 'convenio';

  // Trabajador
  if (!isNonEmptyString(b.nombreCompleto, 150)) return 'nombreCompleto';
  if (typeof b.nifNie !== 'string' || !NIF_NIE_PATTERN.test(b.nifNie.trim())) return 'nifNie';
  if (!isFecha(b.fechaNacimiento)) return 'fechaNacimiento';
  if (!SEXO_VALUES.includes(b.sexo as string)) return 'sexo';
  if (!isNonEmptyString(b.nacionalidad, 60)) return 'nacionalidad';
  if (!isNonEmptyString(b.domicilio, 300)) return 'domicilio';
  if (typeof b.telefono !== 'string' || !TELEFONO_PATTERN.test(b.telefono.trim())) return 'telefono';
  if (typeof b.email !== 'string' || !EMAIL_PATTERN.test(b.email) || b.email.length > 254) return 'email';
  // NUSS obligatorio salvo que se marque que no tiene (se solicita en el alta).
  if (typeof b.sinNuss !== 'boolean') return 'nuss';
  if (!b.sinNuss && (typeof b.nuss !== 'string' || !NUSS_PATTERN.test(soloDigitos(b.nuss)))) return 'nuss';
  if (typeof b.extracomunitario !== 'boolean') return 'vigenciaPermiso';
  if (b.extracomunitario && !isFecha(b.vigenciaPermiso)) return 'vigenciaPermiso';
  if (typeof b.iban !== 'string' || !IBAN_PATTERN.test(b.iban.trim().replace(/\s+/g, ''))) return 'iban';
  if (!NIVEL_ESTUDIOS_VALUES.includes(b.nivelEstudios as string)) return 'nivelEstudios';
  if (!isOptionalString(b.titulacion, 150)) return 'titulacion';
  if (typeof b.discapacidad !== 'boolean') return 'gradoDiscapacidad';
  if (b.discapacidad && !isNumberBetween(b.gradoDiscapacidad, 33, 100)) return 'gradoDiscapacidad';

  // IRPF (modelo 145): solo se exige el detalle si el trabajador lo facilita.
  if (!DATOS_145_VALUES.includes(b.datos145 as string)) return 'datos145';
  if (b.datos145 === 'facilita') {
    if (!SITUACION_FAMILIAR_VALUES.includes(b.situacionFamiliar as string)) return 'situacionFamiliar';
    for (const c of ['descendientes', 'ascendientes', 'pensiones', 'prestamoViviendaAnterior2013', 'movilidadGeografica']) {
      if (typeof b[c] !== 'boolean') return 'datos145';
    }
    if (b.descendientes && !isNonEmptyString(b.detalleDescendientes, 500)) return 'detalleDescendientes';
    if (b.ascendientes && !isNonEmptyString(b.detalleAscendientes, 500)) return 'detalleAscendientes';
    if (b.pensiones && !isNonEmptyString(b.detallePensiones, 300)) return 'detallePensiones';
  }

  // Contrato
  if (!isFecha(b.fechaInicio)) return 'fechaInicio';
  if (!TIPO_CONTRATO_VALUES.includes(b.tipoContrato as string)) return 'tipoContrato';
  const tipo = b.tipoContrato as string;
  if (tipo.startsWith('temporal_')) {
    // En una sustitución a menudo no se sabe cuándo vuelve la persona
    // sustituida: la fecha de fin solo es obligatoria por producción.
    if (tipo === 'temporal_produccion' && !isFecha(b.fechaFin)) return 'fechaFin';
    if (b.fechaFin !== undefined && !isFecha(b.fechaFin)) return 'fechaFin';
    if (isFecha(b.fechaFin) && b.fechaFin < (b.fechaInicio as string)) return 'fechaFin';
    if (!isNonEmptyString(b.causaTemporal, 1000) || b.causaTemporal.trim().length < CAUSA_MIN) return 'causaTemporal';
  }
  if (tipo.startsWith('formativo_')) {
    if (!isNonEmptyString(b.tutor, 150)) return 'tutor';
    if (!isNonEmptyString(b.planFormativo, 1000)) return 'planFormativo';
  }
  if (!JORNADA_VALUES.includes(b.jornada as string)) return 'jornada';
  // Con jornada parcial hay que registrar las horas: horas y distribución obligatorias.
  if (b.jornada === 'parcial' && !isNumberBetween(b.horasSemanales, 1, 39.5)) return 'horasSemanales';
  if (b.horasSemanales !== undefined && !isNumberBetween(b.horasSemanales, 1, 40)) return 'horasSemanales';
  if (b.jornada === 'parcial' && !isNonEmptyString(b.distribucionJornada, 500)) return 'distribucionJornada';
  if (!isOptionalString(b.distribucionJornada, 500)) return 'distribucionJornada';
  if (!isNonEmptyString(b.puesto, 150)) return 'puesto';
  if (!isNonEmptyString(b.funciones, 1000)) return 'funciones';
  if (!isOptionalString(b.categoria, 150)) return 'categoria';
  if (b.grupoCotizacion !== undefined && !/^(?:[1-9]|1[01])$/.test(String(b.grupoCotizacion))) return 'grupoCotizacion';
  if (!isOptionalString(b.cno, 20)) return 'cno';

  // Retribución y condiciones
  if (!isNumberBetween(b.salarioBrutoAnual, 1, 10_000_000)) return 'salarioBrutoAnual';
  if (!isOptionalString(b.complementos, 500)) return 'complementos';
  if (!isNumberBetween(b.numeroPagas, 12, 16) || !Number.isInteger(b.numeroPagas)) return 'numeroPagas';
  if (typeof b.pagasProrrateadas !== 'boolean') return 'numeroPagas';
  if (!isOptionalString(b.periodoPrueba, 100)) return 'periodoPrueba';
  if (!isOptionalString(b.vacaciones, 150)) return 'vacaciones';
  if (!isOptionalString(b.bonificaciones, 500)) return 'bonificaciones';
  if (!isOptionalString(b.observaciones, 1000)) return 'observaciones';

  if (b.privacyAccepted !== true) return 'privacyAccepted';
  return null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// Mismo limitador best-effort en memoria que alta-autonomo.ts.
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
  if (campoInvalido) {
    return json({ error: 'Respuestas no válidas', field: campoInvalido }, 400);
  }
  const b = raw as Record<string, unknown>;

  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ persisted: false });

  const tipo = b.tipoContrato as string;
  const temporal = tipo.startsWith('temporal_');
  const formativo = tipo.startsWith('formativo_');
  const facilita145 = b.datos145 === 'facilita';

  const row = {
    // Empresa (nuestro cliente)
    empresa_nombre: txt(b.empresaNombre),
    empresa_nif: (b.empresaNif as string).trim().toUpperCase(),
    empresa_email: (b.empresaEmail as string).trim().toLowerCase(),
    ccc: txt(b.ccc),
    centro_trabajo: txt(b.centroTrabajo),
    convenio: txt(b.convenio),

    // Trabajador
    nombre_completo: txt(b.nombreCompleto),
    nif_nie: (b.nifNie as string).trim().toUpperCase(),
    fecha_nacimiento: b.fechaNacimiento,
    sexo: b.sexo,
    nacionalidad: txt(b.nacionalidad),
    domicilio: txt(b.domicilio),
    telefono: (b.telefono as string).trim(),
    email: (b.email as string).trim().toLowerCase(),
    nuss: b.sinNuss ? null : soloDigitos(b.nuss as string),
    extracomunitario: b.extracomunitario,
    vigencia_permiso: b.extracomunitario ? b.vigenciaPermiso : null,
    iban: (b.iban as string).trim().replace(/\s+/g, '').toUpperCase(),
    nivel_estudios: b.nivelEstudios,
    titulacion: txt(b.titulacion),
    grado_discapacidad: b.discapacidad ? b.gradoDiscapacidad : null,

    // IRPF (modelo 145)
    datos_145: b.datos145,
    situacion_familiar: facilita145 ? b.situacionFamiliar : null,
    detalle_descendientes: facilita145 && b.descendientes ? txt(b.detalleDescendientes) : null,
    detalle_ascendientes: facilita145 && b.ascendientes ? txt(b.detalleAscendientes) : null,
    detalle_pensiones: facilita145 && b.pensiones ? txt(b.detallePensiones) : null,
    prestamo_vivienda_anterior_2013: facilita145 ? b.prestamoViviendaAnterior2013 : false,
    movilidad_geografica: facilita145 ? b.movilidadGeografica : false,

    // Contrato
    fecha_inicio: b.fechaInicio,
    tipo_contrato: tipo,
    fecha_fin: temporal && b.fechaFin ? b.fechaFin : null,
    causa_temporal: temporal ? txt(b.causaTemporal) : null,
    tutor: formativo ? txt(b.tutor) : null,
    plan_formativo: formativo ? txt(b.planFormativo) : null,
    jornada: b.jornada,
    horas_semanales: typeof b.horasSemanales === 'number' ? b.horasSemanales : null,
    distribucion_jornada: txt(b.distribucionJornada),
    puesto: txt(b.puesto),
    funciones: txt(b.funciones),
    categoria: txt(b.categoria),
    grupo_cotizacion: b.grupoCotizacion !== undefined ? Number(b.grupoCotizacion) : null,
    cno: txt(b.cno),

    // Retribución y condiciones
    salario_bruto_anual: b.salarioBrutoAnual,
    complementos: txt(b.complementos),
    numero_pagas: b.numeroPagas,
    pagas_prorrateadas: b.pagasProrrateadas,
    periodo_prueba: txt(b.periodoPrueba),
    vacaciones: txt(b.vacaciones),
    bonificaciones: txt(b.bonificaciones),
    observaciones: txt(b.observaciones),

    privacy_accepted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('altas_trabajadores').insert(row);
  if (error) return json({ error: 'No se han podido guardar los datos' }, 500);

  return json({ persisted: true });
};
