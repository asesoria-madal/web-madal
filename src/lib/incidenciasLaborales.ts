// Catálogo de incidencias laborales de la plantilla mensual (apartado Laboral del portal).
//
// Cada tipo se corresponde con una llamada de la API de DiezNom (Cegid nóminas), comprobada en el
// swagger el 2026-11-21 y con la empresa de pruebas 5:
//   via 'importe'    -> POST /api/IncidenceAmounts/AddIncidenciaImportes  (concepto salarial)
//   via 'asistencia' -> POST /api/IncidenceTime/AddIncidenciaDeAsistencia (tipoIncidencia)
//   via 'it'         -> POST /api/EmploymentDiseaseOrAccident/AddBajaIT   (tipoBaja)
//
// OJO: este archivo tiene una COPIA LITERAL en n8n-workflows/workflows/incidencias-cegid.js (n8n no
// puede importar de la web). Si se cambia aquí, cambiar allí y volver a montar el workflow.
//
// importe:
//   'convenio'    = el convenio trae el precio (importesGenerales); si el cliente no escribe uno, se usa ese.
//   'obligatorio' = lo pone siempre el cliente (bonus, comisiones, anticipos…).
//   'ninguno'     = no lleva importe (faltas, vacaciones, bajas).
// unidad: lo que cuenta la columna «Cantidad» de la plantilla.

export type ViaIncidencia = 'importe' | 'asistencia' | 'it';
export type UnidadIncidencia = 'horas' | 'dias' | 'km' | 'euros' | 'veces';
export type ImporteIncidencia = 'convenio' | 'obligatorio' | 'ninguno';
export type IdiomaPortal = 'es' | 'ca' | 'en';

export interface TipoIncidencia {
  clave: string;
  via: ViaIncidencia;
  /** Código del concepto salarial de DiezNom (via 'importe'). */
  concepto?: number;
  /** Código del importe general del convenio, si el convenio trae el precio (importesGenerales.codigoConcepto). */
  convenio?: number;
  /** tipoIncidencia de asistencia (via 'asistencia') o tipoBaja de la IT (via 'it'). */
  codigo?: number;
  unidad: UnidadIncidencia;
  importe: ImporteIncidencia;
  /** Descuenta de la nómina (anticipos, cuota sindical, embargos). */
  deduccion?: boolean;
  /** No se carga sola: se avisa al equipo para teclearla (su efecto en la nómina no está claro en la API). */
  manual?: boolean;
  /** Pide fechas Desde / Hasta. */
  fechas: boolean;
  /** Grupo del desplegable, para ordenar la plantilla. */
  grupo: 'ausencias' | 'bajas' | 'variables' | 'pluses' | 'deducciones';
  nombre: Record<IdiomaPortal, string>;
}

const n = (es: string, ca: string, en: string) => ({ es, ca, en });

export const TIPOS_INCIDENCIA: TipoIncidencia[] = [
  // --- Ausencias (asistencia)
  { clave: 'falta', via: 'asistencia', codigo: 1, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'ausencias', nombre: n('Falta de asistencia', "Falta d'assistència", 'Unjustified absence') },
  { clave: 'vacaciones', via: 'asistencia', codigo: 3, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'ausencias', nombre: n('Vacaciones', 'Vacances', 'Holiday') },
  { clave: 'ingreso_familiar', via: 'asistencia', codigo: 4, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'ausencias', nombre: n('Permiso por ingreso de familiar', 'Permís per ingrés de familiar', 'Leave: family hospitalisation') },
  { clave: 'matrimonio', via: 'asistencia', codigo: 5, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'ausencias', nombre: n('Permiso por matrimonio', 'Permís per matrimoni', 'Leave: marriage') },
  { clave: 'lactancia', via: 'asistencia', codigo: 6, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'ausencias', nombre: n('Permiso por lactancia', 'Permís per lactància', 'Leave: breastfeeding') },
  { clave: 'mudanza', via: 'asistencia', codigo: 7, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'ausencias', nombre: n('Permiso por mudanza', 'Permís per mudança', 'Leave: house move') },
  { clave: 'asuntos_propios', via: 'importe', concepto: 61, unidad: 'dias', importe: 'ninguno', manual: true, fechas: true, grupo: 'ausencias', nombre: n('Asuntos propios', 'Assumptes propis', 'Personal days') },
  { clave: 'compensacion_horas', via: 'importe', concepto: 62, unidad: 'horas', importe: 'ninguno', manual: true, fechas: true, grupo: 'ausencias', nombre: n('Compensación de horas', "Compensació d'hores", 'Time off in lieu') },

  // --- Bajas médicas (it)
  { clave: 'it_enfermedad', via: 'it', codigo: 1, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'bajas', nombre: n('Baja por enfermedad común', 'Baixa per malaltia comuna', 'Sick leave (common illness)') },
  { clave: 'it_accidente_laboral', via: 'it', codigo: 2, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'bajas', nombre: n('Baja por accidente laboral', 'Baixa per accident laboral', 'Sick leave (work accident)') },
  { clave: 'it_accidente_no_laboral', via: 'it', codigo: 3, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'bajas', nombre: n('Baja por accidente no laboral', 'Baixa per accident no laboral', 'Sick leave (non-work accident)') },
  { clave: 'it_maternidad', via: 'it', codigo: 4, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'bajas', nombre: n('Nacimiento y cuidado del menor (madre)', 'Naixement i cura del menor (mare)', 'Birth and childcare (mother)') },
  { clave: 'it_paternidad', via: 'it', codigo: 6, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'bajas', nombre: n('Nacimiento y cuidado del menor (otro progenitor)', 'Naixement i cura del menor (altre progenitor)', 'Birth and childcare (other parent)') },
  { clave: 'it_riesgo_embarazo', via: 'it', codigo: 7, unidad: 'dias', importe: 'ninguno', fechas: true, grupo: 'bajas', nombre: n('Riesgo durante el embarazo', "Risc durant l'embaràs", 'Risk during pregnancy') },

  // --- Variables de la nómina (importe)
  { clave: 'horas_extra', via: 'importe', concepto: 5, convenio: 713, unidad: 'horas', importe: 'convenio', fechas: false, grupo: 'variables', nombre: n('Horas extra ordinarias', 'Hores extra ordinàries', 'Overtime hours') },
  { clave: 'horas_extra_festivo', via: 'importe', concepto: 6, convenio: 766, unidad: 'horas', importe: 'convenio', fechas: false, grupo: 'variables', nombre: n('Horas extra en festivo', 'Hores extra en festiu', 'Overtime on a public holiday') },
  { clave: 'horas_extra_nocturnas', via: 'importe', concepto: 6, unidad: 'horas', importe: 'obligatorio', fechas: false, grupo: 'variables', nombre: n('Horas extra nocturnas', 'Hores extra nocturnes', 'Night overtime') },
  { clave: 'horas_complementarias', via: 'importe', concepto: 9, unidad: 'horas', importe: 'obligatorio', fechas: false, grupo: 'variables', nombre: n('Horas complementarias', 'Hores complementàries', 'Additional hours (part-time)') },
  { clave: 'dieta_completa', via: 'importe', concepto: 23, convenio: 706, unidad: 'veces', importe: 'convenio', fechas: false, grupo: 'variables', nombre: n('Dieta completa', 'Dieta completa', 'Full per diem') },
  { clave: 'media_dieta', via: 'importe', concepto: 23, convenio: 707, unidad: 'veces', importe: 'convenio', fechas: false, grupo: 'variables', nombre: n('Media dieta / dieta de comida', 'Mitja dieta / dieta de dinar', 'Half per diem / lunch') },
  { clave: 'kilometraje', via: 'importe', concepto: 12, convenio: 705, unidad: 'km', importe: 'convenio', fechas: false, grupo: 'variables', nombre: n('Kilometraje', 'Quilometratge', 'Mileage') },
  { clave: 'desplazamiento', via: 'importe', concepto: 23, unidad: 'euros', importe: 'obligatorio', fechas: false, grupo: 'variables', nombre: n('Desplazamiento (importe)', 'Desplaçament (import)', 'Travel allowance (amount)') },
  { clave: 'comision', via: 'importe', concepto: 11, unidad: 'euros', importe: 'obligatorio', fechas: false, grupo: 'variables', nombre: n('Comisión, bonus o complemento puntual', 'Comissió, bonus o complement puntual', 'Commission, bonus or one-off pay') },

  // --- Pluses
  { clave: 'plus_transporte', via: 'importe', concepto: 7, unidad: 'euros', importe: 'obligatorio', fechas: false, grupo: 'pluses', nombre: n('Plus de transporte', 'Plus de transport', 'Transport allowance') },
  { clave: 'plus_asistencia', via: 'importe', concepto: 8, unidad: 'euros', importe: 'obligatorio', fechas: false, grupo: 'pluses', nombre: n('Plus de asistencia', "Plus d'assistència", 'Attendance bonus') },
  { clave: 'plus_distancia', via: 'importe', concepto: 22, unidad: 'euros', importe: 'obligatorio', fechas: false, grupo: 'pluses', nombre: n('Plus de distancia', 'Plus de distància', 'Distance allowance') },
  { clave: 'plus_mecanizacion', via: 'importe', concepto: 10, unidad: 'euros', importe: 'obligatorio', fechas: false, grupo: 'pluses', nombre: n('Plus de mecanización', 'Plus de mecanització', 'Mechanisation allowance') },
  { clave: 'quebranto_moneda', via: 'importe', concepto: 20, unidad: 'euros', importe: 'obligatorio', fechas: false, grupo: 'pluses', nombre: n('Quebranto de moneda', 'Trencament de moneda', 'Cash handling allowance') },
  { clave: 'desgaste_herramientas', via: 'importe', concepto: 21, unidad: 'euros', importe: 'obligatorio', fechas: false, grupo: 'pluses', nombre: n('Desgaste de herramientas', "Desgast d'eines", 'Tool wear allowance') },

  // --- Deducciones
  { clave: 'anticipo', via: 'importe', concepto: 31, unidad: 'euros', importe: 'obligatorio', deduccion: true, fechas: false, grupo: 'deducciones', nombre: n('Anticipo', 'Avançament', 'Salary advance') },
  { clave: 'cuota_sindical', via: 'importe', concepto: 30, unidad: 'euros', importe: 'obligatorio', deduccion: true, fechas: false, grupo: 'deducciones', nombre: n('Cuota sindical', 'Quota sindical', 'Union fee') },
  { clave: 'embargo', via: 'importe', concepto: 90, unidad: 'euros', importe: 'obligatorio', deduccion: true, fechas: false, grupo: 'deducciones', nombre: n('Embargo', 'Embargament', 'Wage garnishment') },
];

export const TIPO_POR_CLAVE: Record<string, TipoIncidencia> = Object.fromEntries(TIPOS_INCIDENCIA.map((t) => [t.clave, t]));

/** Nombre mostrado en la plantilla; es el valor del desplegable y por eso se usa también para leerla. */
export function nombreTipo(clave: string, lang: IdiomaPortal): string {
  return TIPO_POR_CLAVE[clave]?.nombre[lang] ?? clave;
}

/** Tipo a partir del texto del desplegable, en cualquiera de los tres idiomas. */
export function tipoPorNombre(texto: string): TipoIncidencia | undefined {
  const x = String(texto ?? '').trim().toLowerCase();
  if (!x) return undefined;
  return TIPOS_INCIDENCIA.find((t) => t.clave === x || Object.values(t.nombre).some((v) => v.toLowerCase() === x));
}

/** Día del mes límite para entregar la plantilla (decisión de Hugo, 2026-11-21). */
export const DIA_LIMITE_INCIDENCIAS = 15;

/** Fin de plazo de la nómina de un mes: el día límite del mes SIGUIENTE (las nóminas se preparan con el mes ya cerrado). */
export function plazoIncidencias(anio: number, mes: number): Date {
  return new Date(anio, mes, DIA_LIMITE_INCIDENCIAS, 23, 59, 59); // mes (1-12) como índice = mes siguiente
}

// Las causas de baja ya no viven aquí: las pide el formulario /formulario-laboral-baja (i18n/formularioBaja.ts)
// y las valida el endpoint api/baja-trabajador.
