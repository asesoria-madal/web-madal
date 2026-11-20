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
// Datos que pide la API de DiezNom (Cegid nóminas) y que antes se recogían como
// texto libre: apellidos y domicilio por separado, estado civil, y el modelo 145
// con descendientes/ascendientes uno a uno. Los textos libres de siempre
// (nombre_completo, domicilio, detalle_*) se siguen rellenando, compuestos, para
// que el correo de aviso y las filas antiguas no cambien.
const ESTADO_CIVIL_VALUES = ['soltero', 'casado', 'viudo', 'divorciado'];
const TIPO_VIA_LABELS: Record<string, string> = {
  calle: 'Calle', avenida: 'Avenida', plaza: 'Plaza', paseo: 'Paseo', camino: 'Camino', carretera: 'Carretera',
  travesia: 'Travesía', ronda: 'Ronda', urbanizacion: 'Urbanización', otro: '',
};
const CP_PATTERN = /^\d{5}$/;
const DISCAPACIDAD_HIJO_VALUES = ['no', 'd33', 'd33_ayuda', 'd65']; // tramos del modelo 145
const DISCAPACIDAD_LABELS: Record<string, string> = {
  no: 'sin discapacidad', d33: 'discapacidad 33-64 %', d33_ayuda: 'discapacidad 33-64 % con movilidad reducida o ayuda de terceros', d65: 'discapacidad ≥ 65 %',
};
const PRUEBA_UNIDAD_VALUES = ['meses', 'dias'];

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
const anioActual = () => new Date().getFullYear();
function isAnio(v: unknown, min = 1900): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= anioActual();
}
function isListaDe(v: unknown, max: number, item: (x: Record<string, unknown>) => boolean): boolean {
  return Array.isArray(v) && v.length >= 1 && v.length <= max && v.every((x) => typeof x === 'object' && x !== null && item(x as Record<string, unknown>));
}

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
  if (!isNonEmptyString(b.nombre, 60)) return 'nombre';
  if (!isNonEmptyString(b.apellido1, 60)) return 'apellido1';
  if (!isOptionalString(b.apellido2, 60)) return 'apellido2';
  if (!ESTADO_CIVIL_VALUES.includes(b.estadoCivil as string)) return 'estadoCivil';
  if (typeof b.nifNie !== 'string' || !NIF_NIE_PATTERN.test(b.nifNie.trim())) return 'nifNie';
  if (!isFecha(b.fechaNacimiento)) return 'fechaNacimiento';
  if (!SEXO_VALUES.includes(b.sexo as string)) return 'sexo';
  if (!isNonEmptyString(b.nacionalidad, 60)) return 'nacionalidad';
  if (typeof b.tipoVia !== 'string' || !Object.hasOwn(TIPO_VIA_LABELS, b.tipoVia)) return 'tipoVia';
  if (!isNonEmptyString(b.nombreVia, 100)) return 'nombreVia';
  if (!isNonEmptyString(b.numeroVia, 10)) return 'numeroVia';
  for (const c of ['escalera', 'piso', 'puerta']) if (!isOptionalString(b[c], 10)) return c;
  if (typeof b.codigoPostal !== 'string' || !CP_PATTERN.test(b.codigoPostal.trim())) return 'codigoPostal';
  if (!isNonEmptyString(b.poblacion, 60)) return 'poblacion';
  if (!isNonEmptyString(b.provincia, 40)) return 'provincia';
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
    // Situación 2 (casado con cónyuge de rentas bajas): el modelo 145 pide su NIF.
    if (b.situacionFamiliar === '2' && (typeof b.nifConyuge !== 'string' || !NIF_NIE_PATTERN.test(b.nifConyuge.trim()))) return 'nifConyuge';
    if (b.descendientes && !isListaDe(b.descendientesLista, 15, (x) =>
      isAnio(x.anioNacimiento) &&
      (x.anioAdopcion === undefined || x.anioAdopcion === null || (isAnio(x.anioAdopcion) && x.anioAdopcion >= (x.anioNacimiento as number))) &&
      DISCAPACIDAD_HIJO_VALUES.includes(x.discapacidad as string) &&
      typeof x.porEntero === 'boolean')) return 'descendientesLista';
    if (b.ascendientes && !isListaDe(b.ascendientesLista, 10, (x) =>
      isAnio(x.anioNacimiento) &&
      DISCAPACIDAD_HIJO_VALUES.includes(x.discapacidad as string) &&
      isNumberBetween(x.compartidoCon, 1, 20) && Number.isInteger(x.compartidoCon))) return 'ascendientesLista';
    if (b.pensiones) {
      const okImporte = (v: unknown) => v === undefined || isNumberBetween(v, 0, 10_000_000);
      if (!okImporte(b.pensionCompensatoria)) return 'pensionCompensatoria';
      if (!okImporte(b.anualidadesAlimentos)) return 'anualidadesAlimentos';
      if (!(Number(b.pensionCompensatoria) > 0) && !(Number(b.anualidadesAlimentos) > 0)) return 'pensionCompensatoria';
    }
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
  // Periodo de prueba: cantidad y unidad juntas o ninguna (n8n calcula la fecha de fin).
  if (b.periodoPruebaCantidad !== undefined || b.periodoPruebaUnidad !== undefined) {
    if (!isNumberBetween(b.periodoPruebaCantidad, 1, 365) || !Number.isInteger(b.periodoPruebaCantidad)) return 'periodoPruebaCantidad';
    if (!PRUEBA_UNIDAD_VALUES.includes(b.periodoPruebaUnidad as string)) return 'periodoPruebaUnidad';
  }
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

// Textos compuestos para las columnas de siempre (el correo de aviso las lee).
const eur = (v: unknown) => Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/año';
function domicilioCompuesto(b: Record<string, unknown>): string {
  const via = [TIPO_VIA_LABELS[b.tipoVia as string], txt(b.nombreVia)].filter(Boolean).join(' ');
  const extra = [txt(b.escalera) && `esc. ${txt(b.escalera)}`, txt(b.piso) && `piso ${txt(b.piso)}`, txt(b.puerta) && `puerta ${txt(b.puerta)}`].filter(Boolean).join(', ');
  return `${via}, ${txt(b.numeroVia)}${extra ? ', ' + extra : ''}, ${(b.codigoPostal as string).trim()} ${txt(b.poblacion)} (${txt(b.provincia)})`;
}
type Hijo = { anioNacimiento: unknown; anioAdopcion: unknown; discapacidad: unknown; porEntero: unknown };
type Asc = { anioNacimiento: unknown; discapacidad: unknown; compartidoCon: unknown };
function textoDescendientes(l: Hijo[]): string {
  return l.map((x, i) => `Hijo/descendiente ${i + 1}: nacido en ${x.anioNacimiento}${x.anioAdopcion ? `, adoptado en ${x.anioAdopcion}` : ''}, ${DISCAPACIDAD_LABELS[x.discapacidad as string]}, ${x.porEntero ? 'computa por entero' : 'se reparte con el otro progenitor'}`).join('\n');
}
function textoAscendientes(l: Asc[]): string {
  return l.map((x, i) => `Ascendiente ${i + 1}: nacido en ${x.anioNacimiento}, ${DISCAPACIDAD_LABELS[x.discapacidad as string]}, a cargo de ${x.compartidoCon} persona(s)`).join('\n');
}
function textoPensiones(b: Record<string, unknown>): string {
  return [
    Number(b.pensionCompensatoria) > 0 ? `Pensión compensatoria al excónyuge: ${eur(b.pensionCompensatoria)}` : '',
    Number(b.anualidadesAlimentos) > 0 ? `Pensión de alimentos a los hijos: ${eur(b.anualidadesAlimentos)}` : '',
  ].filter(Boolean).join('\n');
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
  const b = raw as Record<string, unknown>;

  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ persisted: false });

  const tipo = b.tipoContrato as string;
  const temporal = tipo.startsWith('temporal_');
  const formativo = tipo.startsWith('formativo_');
  const facilita145 = b.datos145 === 'facilita';

  // Listas del modelo 145, recortadas a los campos conocidos (nada de lo que
  // venga de más acaba en la base).
  const descendientes = facilita145 && b.descendientes
    ? (b.descendientesLista as Record<string, unknown>[]).map((x) => ({
        anioNacimiento: x.anioNacimiento, anioAdopcion: x.anioAdopcion ?? null, discapacidad: x.discapacidad, porEntero: x.porEntero,
      }))
    : null;
  const ascendientes = facilita145 && b.ascendientes
    ? (b.ascendientesLista as Record<string, unknown>[]).map((x) => ({
        anioNacimiento: x.anioNacimiento, discapacidad: x.discapacidad, compartidoCon: x.compartidoCon,
      }))
    : null;

  const row = {
    // Empresa (nuestro cliente)
    empresa_nombre: txt(b.empresaNombre),
    empresa_nif: (b.empresaNif as string).trim().toUpperCase(),
    empresa_email: (b.empresaEmail as string).trim().toLowerCase(),
    ccc: txt(b.ccc),
    centro_trabajo: txt(b.centroTrabajo),
    convenio: txt(b.convenio),

    // Trabajador
    nombre: txt(b.nombre),
    apellido1: txt(b.apellido1),
    apellido2: txt(b.apellido2),
    nombre_completo: [txt(b.nombre), txt(b.apellido1), txt(b.apellido2)].filter(Boolean).join(' '),
    estado_civil: b.estadoCivil,
    nif_nie: (b.nifNie as string).trim().toUpperCase(),
    fecha_nacimiento: b.fechaNacimiento,
    sexo: b.sexo,
    nacionalidad: txt(b.nacionalidad),
    tipo_via: b.tipoVia,
    nombre_via: txt(b.nombreVia),
    numero_via: txt(b.numeroVia),
    escalera: txt(b.escalera),
    piso: txt(b.piso),
    puerta: txt(b.puerta),
    codigo_postal: (b.codigoPostal as string).trim(),
    poblacion: txt(b.poblacion),
    provincia: txt(b.provincia),
    domicilio: domicilioCompuesto(b),
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
    nif_conyuge: facilita145 && b.situacionFamiliar === '2' ? (b.nifConyuge as string).trim().toUpperCase() : null,
    descendientes,
    ascendientes,
    pension_compensatoria: facilita145 && b.pensiones && Number(b.pensionCompensatoria) > 0 ? b.pensionCompensatoria : null,
    anualidades_alimentos: facilita145 && b.pensiones && Number(b.anualidadesAlimentos) > 0 ? b.anualidadesAlimentos : null,
    detalle_descendientes: descendientes ? textoDescendientes(descendientes) : null,
    detalle_ascendientes: ascendientes ? textoAscendientes(ascendientes) : null,
    detalle_pensiones: facilita145 && b.pensiones ? textoPensiones(b) : null,
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
    periodo_prueba: b.periodoPruebaCantidad !== undefined ? `${b.periodoPruebaCantidad} ${b.periodoPruebaUnidad === 'dias' ? 'días' : 'meses'}` : null,
    periodo_prueba_cantidad: b.periodoPruebaCantidad !== undefined ? b.periodoPruebaCantidad : null,
    periodo_prueba_unidad: b.periodoPruebaCantidad !== undefined ? b.periodoPruebaUnidad : null,
    vacaciones: txt(b.vacaciones),
    bonificaciones: txt(b.bonificaciones),
    observaciones: txt(b.observaciones),

    privacy_accepted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('altas_trabajadores').insert(row);
  if (error) return json({ error: 'No se han podido guardar los datos' }, 500);

  return json({ persisted: true });
};
