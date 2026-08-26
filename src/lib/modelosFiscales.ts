// Calendario fiscal por modelo, usado por el portal de clientes para
// mostrar "próximos impuestos a pagar" filtrado a los modelos que cada
// cliente presenta (clientes.modelos, ver schema.sql).
//
// Fechas verificadas por Edurne contra el notebook de NotebookLM ("Blog y
// FAQs AM") el 2026-08-26 — mismo procedimiento que el resto de contenido
// fiscal del proyecto (ver web/CLAUDE.md).

export interface Presentacion {
  modelo: string;
  nombre: string;
  fecha: Date;
}

interface ModeloFiscal {
  nombre: string;
  // Fechas límite de presentación de este modelo para el año natural dado.
  fechasLimite: (anio: number) => Date[];
}

function fecha(anio: number, mes: number, dia: number): Date {
  return new Date(anio, mes - 1, dia);
}

// 1T/2T/3T dentro del año, 4T se presenta en enero del año siguiente.
const trimestralEstandar = (anio: number): Date[] => [
  fecha(anio, 4, 20),
  fecha(anio, 7, 20),
  fecha(anio, 10, 20),
  fecha(anio + 1, 1, 30),
];

// A diferencia del IRPF trimestral, el pago fraccionado de Sociedades tiene
// tres plazos (no cuatro) y el de diciembre no se traslada a enero.
const pagoFraccionadoIS = (anio: number): Date[] => [
  fecha(anio, 4, 20),
  fecha(anio, 10, 20),
  fecha(anio, 12, 20),
];

export const MODELOS_FISCALES: Record<string, ModeloFiscal> = {
  '130': { nombre: 'Modelo 130 — pago fraccionado IRPF (estimación directa)', fechasLimite: trimestralEstandar },
  '131': { nombre: 'Modelo 131 — pago fraccionado IRPF (módulos)', fechasLimite: trimestralEstandar },
  '111': { nombre: 'Modelo 111 — retenciones IRPF', fechasLimite: trimestralEstandar },
  '115': { nombre: 'Modelo 115 — retenciones de alquiler', fechasLimite: trimestralEstandar },
  '303': { nombre: 'Modelo 303 — IVA trimestral', fechasLimite: trimestralEstandar },
  // Asume régimen trimestral (el habitual para nuestros clientes: aplica si
  // no se superan los 50.000 € de entregas/prestaciones intracomunitarias en
  // el trimestre ni en los cuatro anteriores). Existe un régimen mensual con
  // fechas distintas y una excepción propia en julio/agosto — no modelado
  // aquí porque no tenemos forma de saber en qué régimen está cada cliente;
  // si algún cliente pasa a mensual, revisar este modelo a mano ese trimestre.
  '349': { nombre: 'Modelo 349 — operaciones intracomunitarias (informativo)', fechasLimite: trimestralEstandar },
  '202': { nombre: 'Modelo 202 — pago fraccionado Impuesto de Sociedades', fechasLimite: pagoFraccionadoIS },
  '200': { nombre: 'Modelo 200 — Impuesto de Sociedades (anual)', fechasLimite: (anio) => [fecha(anio, 7, 25)] },
  // Verificado: se presenta el 1 de marzo del año siguiente al ejercicio declarado.
  '347': {
    nombre: 'Modelo 347 — operaciones con terceras personas (informativo, no supone pago)',
    fechasLimite: (anio) => [fecha(anio, 3, 1)],
  },
  '390': { nombre: 'Modelo 390 — resumen anual de IVA (informativo)', fechasLimite: (anio) => [fecha(anio, 1, 30)] },
  '190': { nombre: 'Modelo 190 — resumen anual de retenciones IRPF (informativo)', fechasLimite: (anio) => [fecha(anio, 1, 31)] },
  '180': { nombre: 'Modelo 180 — resumen anual de retenciones de alquiler (informativo)', fechasLimite: (anio) => [fecha(anio, 1, 31)] },
};

/**
 * De entre los modelos indicados, la próxima fecha límite de presentación
 * (mira el año en curso y el siguiente, para no quedarse sin resultado en
 * diciembre). Devuelve null si `modelos` está vacío o no contiene ningún
 * código reconocido.
 */
export function proximaPresentacion(
  modelos: string[],
  hoy: Date = new Date(),
): (Presentacion & { dias: number }) | null {
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const candidatas: Presentacion[] = [];

  for (const codigo of modelos) {
    const modelo = MODELOS_FISCALES[codigo];
    if (!modelo) continue;
    for (const anio of [hoySinHora.getFullYear(), hoySinHora.getFullYear() + 1]) {
      for (const f of modelo.fechasLimite(anio)) {
        if (f >= hoySinHora) candidatas.push({ modelo: codigo, nombre: modelo.nombre, fecha: f });
      }
    }
  }

  if (candidatas.length === 0) return null;

  candidatas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const proxima = candidatas[0];
  const dias = Math.round((proxima.fecha.getTime() - hoySinHora.getTime()) / 86_400_000);
  return { ...proxima, dias };
}
