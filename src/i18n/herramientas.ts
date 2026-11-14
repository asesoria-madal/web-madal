// Herramientas de la web (Edurne, 2026-11-14): calculadora de factura, cuota de autónomos 2026 y
// "¿qué impuestos tengo que presentar?". Atraen búsquedas y llevan a contactar.
//
// Datos fiscales y de dónde salen (comprobar cada enero):
// - Cuota de autónomos 2026: Orden PJC/297/2026 (BOE-A-2026-7296), art. 18 (tramos y bases mínimas) y
//   art. 37 (tipos): 28,30 % contingencias comunes + 1,30 % profesionales + 0,90 % cese + 0,10 % FP
//   + 0,90 % MEI = 31,5 %. Cuota mínima del tramo 1: 653,59 × 31,5 % = 205,88 €.
// - Rendimiento computable para la Seguridad Social: rendimiento neto (sin restar la cuota de autónomos)
//   menos un 7 % de gastos genéricos (3 % autónomos societarios). LGSS art. 308.
// - Retenciones: Reglamento del IRPF (RD 439/2007), art. 95: 15 %, o 7 % el año de inicio y los dos
//   siguientes si no hubo actividad el año anterior.
// - Plazos: calendario del contribuyente de la AEAT. Modelo 130: no obligatorio si el año anterior al
//   menos el 70 % de los ingresos de la actividad profesional llevaron retención (RIRPF art. 109).
// Catalán e inglés, primer borrador sin revisión nativa.
import type { Locale } from './ui';

type Opcion = { v: string; t: string };

export const HERRAMIENTAS: Record<Locale, {
  nav: string;
  indice: { metaTitle: string; metaDesc: string; eyebrow: string; title: string; dek: string; abrir: string };
  comun: { aviso: string; ctaTitle: string; ctaText: string; ctaBtn: string; ctaLlamada: string; volver: string };
  factura: {
    metaTitle: string; metaDesc: string; card: string; title: string; dek: string;
    modo: string; modos: Opcion[]; importe: string; iva: string; ivas: Opcion[]; ret: string; rets: Opcion[]; otro: string;
    base: string; cuotaIva: string; retencion: string; total: string; cobras: string;
    explicaIva: string; explicaRet: string;
    infoTitle: string; info: { q: string; a: string }[];
  };
  cuota: {
    metaTitle: string; metaDesc: string; card: string; title: string; dek: string;
    ingresos: string; gastos: string; gastosHint: string; societario: string;
    rendimiento: string; tramo: string; tablaReducida: string; tablaGeneral: string; base: string; cuotaMes: string; cuotaAno: string;
    tarifaPlana: string; nota: string; tablaTitle: string; colTramo: string; colRend: string; colBase: string; colCuota: string;
    infoTitle: string; info: { q: string; a: string }[];
  };
  impuestos: {
    metaTitle: string; metaDesc: string; card: string; title: string; dek: string;
    preguntas: { id: string; q: string; opciones: Opcion[]; solo?: string }[];
    resultadoTitle: string; trimestrales: string; anuales: string; ninguno: string;
    modelos: Record<string, { nombre: string; cuando: string }>;
    notaSl: string; nota130: string;
  };
}> = {
  es: {
    nav: 'Herramientas',
    indice: {
      metaTitle: 'Herramientas gratis para autónomos y pymes · Asesoría Madal',
      metaDesc: 'Calculadora de factura con IVA y retención, cuota de autónomos 2026 por tramos y qué impuestos tienes que presentar. Gratis y sin registrarte.',
      eyebrow: 'Herramientas',
      title: 'Calculadoras para tus números, gratis',
      dek: 'Haz tus cuentas en un minuto, sin registrarte. Son orientativas: si quieres que lo miremos con tus datos, escríbenos.',
      abrir: 'Abrir',
    },
    comun: {
      aviso: 'Cálculo orientativo con la normativa vigente en 2026. No sustituye el asesoramiento de tu caso concreto.',
      ctaTitle: '¿Lo revisamos con tus números?',
      ctaText: 'Te decimos qué te toca de verdad y cómo pagar menos dentro de la ley. Respondemos en menos de 24 horas laborables.',
      ctaBtn: 'Escríbenos',
      ctaLlamada: 'Reservar llamada',
      volver: 'Todas las herramientas',
    },
    factura: {
      metaTitle: 'Calculadora de factura con IVA y retención de IRPF · Asesoría Madal',
      metaDesc: 'Calcula el total de tu factura con IVA y retención de IRPF (15 % o 7 %), o al revés: cuánto facturar para cobrar una cantidad. Gratis.',
      card: 'Calcula el total con IVA y retención de IRPF, o cuánto facturar para cobrar lo que quieres.',
      title: 'Calculadora de factura con IVA y retención',
      dek: 'Pon el importe y te decimos el IVA, la retención de IRPF y el total. También al revés: cuánto tienes que facturar para cobrar una cantidad.',
      modo: '¿Qué importe tienes?',
      modos: [{ v: 'base', t: 'El precio sin IVA (base)' }, { v: 'cobro', t: 'Lo que quiero cobrar' }],
      importe: 'Importe (€)',
      iva: 'IVA',
      ivas: [{ v: '21', t: '21 % (general)' }, { v: '10', t: '10 % (reducido)' }, { v: '4', t: '4 % (superreducido)' }, { v: '0', t: 'Sin IVA (exenta)' }],
      ret: 'Retención de IRPF',
      rets: [{ v: '15', t: '15 % (general)' }, { v: '7', t: '7 % (nuevo autónomo)' }, { v: '0', t: 'Sin retención' }, { v: 'otro', t: 'Otro porcentaje' }],
      otro: 'Porcentaje de retención',
      base: 'Base imponible',
      cuotaIva: 'IVA',
      retencion: 'Retención de IRPF',
      total: 'Total de la factura',
      cobras: 'Lo que te ingresa el cliente',
      explicaIva: 'El IVA no es tuyo: lo cobras y lo ingresas en Hacienda con el modelo 303.',
      explicaRet: 'La retención tampoco la cobras: tu cliente la ingresa en Hacienda a cuenta de tu IRPF, y la recuperas en la renta.',
      infoTitle: 'Preguntas frecuentes',
      info: [
        { q: '¿Cuándo tengo que poner retención en la factura?', a: 'Cuando eres profesional (por ejemplo, diseñador, consultor o abogado) y facturas a una empresa o a otro autónomo. Si facturas a un particular, o tu actividad es empresarial (comercio, hostelería…), normalmente no hay retención.' },
        { q: '¿Quién puede aplicar el 7 %?', a: 'Los profesionales que empiezan: el año de alta y los dos siguientes, siempre que no hayan ejercido ninguna actividad el año anterior. Tienes que avisar a tu cliente por escrito de que te corresponde.' },
        { q: '¿Qué tipo de IVA me toca?', a: 'La mayoría de servicios llevan el 21 %. El 10 % y el 4 % son para casos concretos (hostelería, algunos alimentos, libros…), y algunas actividades están exentas, como la sanitaria o la formación reglada.' },
      ],
    },
    cuota: {
      metaTitle: 'Calculadora de cuota de autónomos 2026 por tramos · Asesoría Madal',
      metaDesc: 'Calcula tu cuota de autónomos en 2026 según tus ingresos y gastos: tramo, base mínima y cuota mensual con la tabla oficial del BOE.',
      card: 'Tu tramo y tu cuota mensual en 2026 según lo que vas a ganar, con la tabla oficial.',
      title: 'Calculadora de cuota de autónomos 2026',
      dek: 'Desde 2023 pagas según lo que ganas. Pon tus ingresos y gastos previstos para el año y te decimos tu tramo y tu cuota mínima, con la tabla oficial de 2026.',
      ingresos: 'Ingresos previstos en el año (€, sin IVA)',
      gastos: 'Gastos previstos en el año (€, sin IVA)',
      gastosHint: 'Sin contar la propia cuota de autónomos.',
      societario: 'Soy autónomo societario (administrador o socio de mi SL)',
      rendimiento: 'Rendimiento neto mensual para la Seguridad Social',
      tramo: 'Tu tramo',
      tablaReducida: 'Tabla reducida',
      tablaGeneral: 'Tabla general',
      base: 'Base mínima',
      cuotaMes: 'Cuota mínima al mes',
      cuotaAno: 'Al año',
      tarifaPlana: 'Si es tu primera alta (o no has sido autónomo en los dos últimos años), el primer año puedes pagar la tarifa plana: unos 88 € al mes.',
      nota: 'A lo que ganas se le resta un 7 % de gastos genéricos (3 % si eres societario). Puedes elegir una base más alta que la mínima de tu tramo; al año siguiente la Seguridad Social regulariza con tus ingresos reales.',
      tablaTitle: 'Tabla de tramos de 2026',
      colTramo: 'Tramo',
      colRend: 'Rendimiento neto al mes',
      colBase: 'Base mínima',
      colCuota: 'Cuota mínima',
      infoTitle: 'Preguntas frecuentes',
      info: [
        { q: '¿Qué pasa si me equivoco de tramo?', a: 'Al año siguiente la Seguridad Social compara con tus ingresos reales: si ganaste más, te reclama la diferencia; si ganaste menos, te devuelve lo que pagaste de más. Puedes cambiar de tramo hasta 6 veces al año.' },
        { q: '¿El 31,5 % de dónde sale?', a: 'Es la suma de los tipos de 2026: 28,3 % de contingencias comunes, 1,3 % de profesionales, 0,9 % de cese de actividad, 0,1 % de formación profesional y 0,9 % del MEI.' },
        { q: '¿Y si mi rendimiento es negativo o muy bajo?', a: 'Pagas como mínimo la cuota del primer tramo de la tabla reducida. Si acabas de empezar, mira primero si puedes pedir la tarifa plana.' },
      ],
    },
    impuestos: {
      metaTitle: '¿Qué impuestos tengo que presentar? Modelos para autónomos y SL · Asesoría Madal',
      metaDesc: 'Responde 6 preguntas y descubre qué modelos tienes que presentar (303, 130, 111, 115, 349, 347, 200…) y en qué plazos. Para autónomos y SL.',
      card: 'Responde unas preguntas y te decimos qué modelos te tocan y cuándo se presentan.',
      title: '¿Qué impuestos tengo que presentar?',
      dek: 'Responde unas preguntas sobre tu actividad y te decimos qué modelos te tocan cada trimestre y cada año, con sus plazos.',
      preguntas: [
        { id: 'forma', q: '¿Cómo trabajas?', opciones: [{ v: 'autonomo', t: 'Como autónomo' }, { v: 'sl', t: 'Con una sociedad (SL)' }] },
        { id: 'estimacion', q: '¿Cómo tributas en el IRPF?', solo: 'autonomo', opciones: [{ v: 'directa', t: 'Estimación directa (lo normal)' }, { v: 'modulos', t: 'Módulos' }, { v: 'directa', t: 'No lo sé' }] },
        { id: 'iva', q: '¿Tus facturas llevan IVA?', opciones: [{ v: 'si', t: 'Sí' }, { v: 'no', t: 'No, mi actividad está exenta (sanidad, formación reglada…)' }] },
        { id: 'retenciones', q: '¿Más del 70 % de lo que facturas lleva retención de IRPF?', solo: 'directa', opciones: [{ v: 'no', t: 'No, o no lo sé' }, { v: 'si', t: 'Sí, casi todo lo facturo a empresas con retención' }] },
        { id: 'trabajadores', q: '¿Tienes trabajadores o pagas a profesionales con retención?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Sí' }] },
        { id: 'alquiler', q: '¿Alquilas un local u oficina?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Sí' }] },
        { id: 'ue', q: '¿Compras o vendes a empresas de otros países de la UE?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Sí' }] },
        { id: 'grandes', q: '¿Superas los 3.005,06 € en el año con algún cliente o proveedor?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Sí, o no lo sé' }] },
      ],
      resultadoTitle: 'Lo que tienes que presentar',
      trimestrales: 'Cada trimestre',
      anuales: 'Una vez al año',
      ninguno: 'Responde las preguntas para ver tus modelos.',
      modelos: {
        '303': { nombre: 'Modelo 303 · IVA trimestral', cuando: 'Del 1 al 20 de abril, julio y octubre, y del 1 al 30 de enero' },
        '130': { nombre: 'Modelo 130 · Pago a cuenta del IRPF', cuando: 'Del 1 al 20 de abril, julio y octubre, y del 1 al 30 de enero' },
        '131': { nombre: 'Modelo 131 · Pago a cuenta del IRPF en módulos', cuando: 'Del 1 al 20 de abril, julio y octubre, y del 1 al 30 de enero' },
        '111': { nombre: 'Modelo 111 · Retenciones de trabajadores y profesionales', cuando: 'Del 1 al 20 de abril, julio y octubre, y del 1 al 20 de enero' },
        '115': { nombre: 'Modelo 115 · Retenciones del alquiler', cuando: 'Del 1 al 20 de abril, julio y octubre, y del 1 al 20 de enero' },
        '349': { nombre: 'Modelo 349 · Operaciones con la UE', cuando: 'Normalmente trimestral, del 1 al 20 del mes siguiente (enero, hasta el 30)' },
        '202': { nombre: 'Modelo 202 · Pago fraccionado del Impuesto de Sociedades', cuando: 'Del 1 al 20 de abril, octubre y diciembre' },
        '390': { nombre: 'Modelo 390 · Resumen anual del IVA', cuando: 'Del 1 al 30 de enero' },
        '190': { nombre: 'Modelo 190 · Resumen anual de retenciones', cuando: 'Del 1 al 31 de enero' },
        '180': { nombre: 'Modelo 180 · Resumen anual del alquiler', cuando: 'Del 1 al 31 de enero' },
        '347': { nombre: 'Modelo 347 · Operaciones de más de 3.005,06 €', cuando: 'Durante febrero' },
        '100': { nombre: 'Modelo 100 · Declaración de la renta', cuando: 'De abril al 30 de junio' },
        '200': { nombre: 'Modelo 200 · Impuesto de Sociedades', cuando: 'Del 1 al 25 de julio' },
      },
      notaSl: 'El modelo 202 solo es obligatorio si el Impuesto de Sociedades del año anterior salió a pagar. Además, la SL deposita cada año sus cuentas en el Registro Mercantil.',
      nota130: 'Como más del 70 % de tus ingresos lleva retención, no tienes que presentar el modelo 130.',
    },
  },
  ca: {
    nav: 'Eines',
    indice: {
      metaTitle: 'Eines gratuïtes per a autònoms i pimes · Asesoría Madal',
      metaDesc: 'Calculadora de factura amb IVA i retenció, quota d’autònoms 2026 per trams i quins impostos has de presentar. Gratis i sense registrar-te.',
      eyebrow: 'Eines',
      title: 'Calculadores per als teus números, gratis',
      dek: 'Fes els teus comptes en un minut, sense registrar-te. Són orientatives: si vols que ho mirem amb les teves dades, escriu-nos.',
      abrir: 'Obrir',
    },
    comun: {
      aviso: 'Càlcul orientatiu amb la normativa vigent el 2026. No substitueix l’assessorament del teu cas concret.',
      ctaTitle: 'Ho revisem amb els teus números?',
      ctaText: 'Et diem què et toca de veritat i com pagar menys dins de la llei. Responem en menys de 24 hores laborables.',
      ctaBtn: 'Escriu-nos',
      ctaLlamada: 'Reservar trucada',
      volver: 'Totes les eines',
    },
    factura: {
      metaTitle: 'Calculadora de factura amb IVA i retenció d’IRPF · Asesoría Madal',
      metaDesc: 'Calcula el total de la teva factura amb IVA i retenció d’IRPF (15 % o 7 %), o al revés: quant facturar per cobrar una quantitat. Gratis.',
      card: 'Calcula el total amb IVA i retenció d’IRPF, o quant facturar per cobrar el que vols.',
      title: 'Calculadora de factura amb IVA i retenció',
      dek: 'Posa l’import i et diem l’IVA, la retenció d’IRPF i el total. També al revés: quant has de facturar per cobrar una quantitat.',
      modo: 'Quin import tens?',
      modos: [{ v: 'base', t: 'El preu sense IVA (base)' }, { v: 'cobro', t: 'El que vull cobrar' }],
      importe: 'Import (€)',
      iva: 'IVA',
      ivas: [{ v: '21', t: '21 % (general)' }, { v: '10', t: '10 % (reduït)' }, { v: '4', t: '4 % (superreduït)' }, { v: '0', t: 'Sense IVA (exempta)' }],
      ret: 'Retenció d’IRPF',
      rets: [{ v: '15', t: '15 % (general)' }, { v: '7', t: '7 % (nou autònom)' }, { v: '0', t: 'Sense retenció' }, { v: 'otro', t: 'Un altre percentatge' }],
      otro: 'Percentatge de retenció',
      base: 'Base imposable',
      cuotaIva: 'IVA',
      retencion: 'Retenció d’IRPF',
      total: 'Total de la factura',
      cobras: 'El que t’ingressa el client',
      explicaIva: 'L’IVA no és teu: el cobres i l’ingresses a Hisenda amb el model 303.',
      explicaRet: 'La retenció tampoc la cobres: el teu client l’ingressa a Hisenda a compte del teu IRPF, i la recuperes a la renda.',
      infoTitle: 'Preguntes freqüents',
      info: [
        { q: 'Quan he de posar retenció a la factura?', a: 'Quan ets professional (per exemple, dissenyador, consultor o advocat) i factures a una empresa o a un altre autònom. Si factures a un particular, o la teva activitat és empresarial (comerç, hostaleria…), normalment no hi ha retenció.' },
        { q: 'Qui pot aplicar el 7 %?', a: 'Els professionals que comencen: l’any d’alta i els dos següents, sempre que no hagin exercit cap activitat l’any anterior. Has d’avisar el teu client per escrit que et correspon.' },
        { q: 'Quin tipus d’IVA em toca?', a: 'La majoria de serveis porten el 21 %. El 10 % i el 4 % són per a casos concrets (hostaleria, alguns aliments, llibres…), i algunes activitats estan exemptes, com la sanitària o la formació reglada.' },
      ],
    },
    cuota: {
      metaTitle: 'Calculadora de quota d’autònoms 2026 per trams · Asesoría Madal',
      metaDesc: 'Calcula la teva quota d’autònoms el 2026 segons els teus ingressos i despeses: tram, base mínima i quota mensual amb la taula oficial del BOE.',
      card: 'El teu tram i la teva quota mensual el 2026 segons el que guanyaràs, amb la taula oficial.',
      title: 'Calculadora de quota d’autònoms 2026',
      dek: 'Des del 2023 pagues segons el que guanyes. Posa els ingressos i despeses previstos per a l’any i et diem el teu tram i la teva quota mínima, amb la taula oficial del 2026.',
      ingresos: 'Ingressos previstos a l’any (€, sense IVA)',
      gastos: 'Despeses previstes a l’any (€, sense IVA)',
      gastosHint: 'Sense comptar la mateixa quota d’autònoms.',
      societario: 'Soc autònom societari (administrador o soci de la meva SL)',
      rendimiento: 'Rendiment net mensual per a la Seguretat Social',
      tramo: 'El teu tram',
      tablaReducida: 'Taula reduïda',
      tablaGeneral: 'Taula general',
      base: 'Base mínima',
      cuotaMes: 'Quota mínima al mes',
      cuotaAno: 'A l’any',
      tarifaPlana: 'Si és la teva primera alta (o no has estat autònom els dos últims anys), el primer any pots pagar la tarifa plana: uns 88 € al mes.',
      nota: 'Al que guanyes se li resta un 7 % de despeses genèriques (3 % si ets societari). Pots triar una base més alta que la mínima del teu tram; l’any següent la Seguretat Social regularitza amb els teus ingressos reals.',
      tablaTitle: 'Taula de trams del 2026',
      colTramo: 'Tram',
      colRend: 'Rendiment net al mes',
      colBase: 'Base mínima',
      colCuota: 'Quota mínima',
      infoTitle: 'Preguntes freqüents',
      info: [
        { q: 'Què passa si m’equivoco de tram?', a: 'L’any següent la Seguretat Social compara amb els teus ingressos reals: si vas guanyar més, et reclama la diferència; si vas guanyar menys, et retorna el que vas pagar de més. Pots canviar de tram fins a 6 vegades l’any.' },
        { q: 'D’on surt el 31,5 %?', a: 'És la suma dels tipus del 2026: 28,3 % de contingències comunes, 1,3 % de professionals, 0,9 % de cessament d’activitat, 0,1 % de formació professional i 0,9 % del MEI.' },
        { q: 'I si el meu rendiment és negatiu o molt baix?', a: 'Pagues com a mínim la quota del primer tram de la taula reduïda. Si acabes de començar, mira primer si pots demanar la tarifa plana.' },
      ],
    },
    impuestos: {
      metaTitle: 'Quins impostos he de presentar? Models per a autònoms i SL · Asesoría Madal',
      metaDesc: 'Respon 6 preguntes i descobreix quins models has de presentar (303, 130, 111, 115, 349, 347, 200…) i en quins terminis. Per a autònoms i SL.',
      card: 'Respon unes preguntes i et diem quins models et toquen i quan es presenten.',
      title: 'Quins impostos he de presentar?',
      dek: 'Respon unes preguntes sobre la teva activitat i et diem quins models et toquen cada trimestre i cada any, amb els seus terminis.',
      preguntas: [
        { id: 'forma', q: 'Com treballes?', opciones: [{ v: 'autonomo', t: 'Com a autònom' }, { v: 'sl', t: 'Amb una societat (SL)' }] },
        { id: 'estimacion', q: 'Com tributes a l’IRPF?', solo: 'autonomo', opciones: [{ v: 'directa', t: 'Estimació directa (el normal)' }, { v: 'modulos', t: 'Mòduls' }, { v: 'directa', t: 'No ho sé' }] },
        { id: 'iva', q: 'Les teves factures porten IVA?', opciones: [{ v: 'si', t: 'Sí' }, { v: 'no', t: 'No, la meva activitat està exempta (sanitat, formació reglada…)' }] },
        { id: 'retenciones', q: 'Més del 70 % del que factures porta retenció d’IRPF?', solo: 'directa', opciones: [{ v: 'no', t: 'No, o no ho sé' }, { v: 'si', t: 'Sí, gairebé tot ho facturo a empreses amb retenció' }] },
        { id: 'trabajadores', q: 'Tens treballadors o pagues a professionals amb retenció?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Sí' }] },
        { id: 'alquiler', q: 'Llogues un local o oficina?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Sí' }] },
        { id: 'ue', q: 'Compres o vens a empreses d’altres països de la UE?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Sí' }] },
        { id: 'grandes', q: 'Superes els 3.005,06 € a l’any amb algun client o proveïdor?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Sí, o no ho sé' }] },
      ],
      resultadoTitle: 'El que has de presentar',
      trimestrales: 'Cada trimestre',
      anuales: 'Un cop l’any',
      ninguno: 'Respon les preguntes per veure els teus models.',
      modelos: {
        '303': { nombre: 'Model 303 · IVA trimestral', cuando: 'De l’1 al 20 d’abril, juliol i octubre, i de l’1 al 30 de gener' },
        '130': { nombre: 'Model 130 · Pagament a compte de l’IRPF', cuando: 'De l’1 al 20 d’abril, juliol i octubre, i de l’1 al 30 de gener' },
        '131': { nombre: 'Model 131 · Pagament a compte de l’IRPF en mòduls', cuando: 'De l’1 al 20 d’abril, juliol i octubre, i de l’1 al 30 de gener' },
        '111': { nombre: 'Model 111 · Retencions de treballadors i professionals', cuando: 'De l’1 al 20 d’abril, juliol i octubre, i de l’1 al 20 de gener' },
        '115': { nombre: 'Model 115 · Retencions del lloguer', cuando: 'De l’1 al 20 d’abril, juliol i octubre, i de l’1 al 20 de gener' },
        '349': { nombre: 'Model 349 · Operacions amb la UE', cuando: 'Normalment trimestral, de l’1 al 20 del mes següent (gener, fins al 30)' },
        '202': { nombre: 'Model 202 · Pagament fraccionat de l’Impost de Societats', cuando: 'De l’1 al 20 d’abril, octubre i desembre' },
        '390': { nombre: 'Model 390 · Resum anual de l’IVA', cuando: 'De l’1 al 30 de gener' },
        '190': { nombre: 'Model 190 · Resum anual de retencions', cuando: 'De l’1 al 31 de gener' },
        '180': { nombre: 'Model 180 · Resum anual del lloguer', cuando: 'De l’1 al 31 de gener' },
        '347': { nombre: 'Model 347 · Operacions de més de 3.005,06 €', cuando: 'Durant el febrer' },
        '100': { nombre: 'Model 100 · Declaració de la renda', cuando: 'D’abril al 30 de juny' },
        '200': { nombre: 'Model 200 · Impost de Societats', cuando: 'De l’1 al 25 de juliol' },
      },
      notaSl: 'El model 202 només és obligatori si l’Impost de Societats de l’any anterior va sortir a pagar. A més, la SL diposita cada any els seus comptes al Registre Mercantil.',
      nota130: 'Com que més del 70 % dels teus ingressos porta retenció, no has de presentar el model 130.',
    },
  },
  en: {
    nav: 'Tools',
    indice: {
      metaTitle: 'Free tools for freelancers and small businesses in Spain · Asesoría Madal',
      metaDesc: 'Invoice calculator with VAT and income tax withholding, 2026 self-employed contribution by bracket, and which tax returns you need to file. Free, no sign-up.',
      eyebrow: 'Tools',
      title: 'Free calculators for your numbers',
      dek: 'Do the maths in a minute, no sign-up needed. The results are a guide: if you want us to look at your own figures, get in touch.',
      abrir: 'Open',
    },
    comun: {
      aviso: 'Guide figures based on the rules in force in 2026. Not a substitute for advice on your specific case.',
      ctaTitle: 'Shall we check it with your numbers?',
      ctaText: 'We’ll tell you what really applies to you and how to pay less, legally. We reply in under 24 working hours.',
      ctaBtn: 'Write to us',
      ctaLlamada: 'Book a call',
      volver: 'All tools',
    },
    factura: {
      metaTitle: 'Spanish invoice calculator with VAT and IRPF withholding · Asesoría Madal',
      metaDesc: 'Work out your invoice total with Spanish VAT and IRPF withholding (15% or 7%), or the other way round: how much to invoice to receive a set amount. Free.',
      card: 'Work out the total with VAT and income tax withholding, or how much to invoice to get paid what you want.',
      title: 'Invoice calculator with VAT and withholding',
      dek: 'Enter the amount and we’ll show the VAT, the income tax (IRPF) withholding and the total. Or the other way round: how much you need to invoice to receive a set amount.',
      modo: 'Which amount do you have?',
      modos: [{ v: 'base', t: 'The price before VAT (net)' }, { v: 'cobro', t: 'What I want to receive' }],
      importe: 'Amount (€)',
      iva: 'VAT',
      ivas: [{ v: '21', t: '21% (standard)' }, { v: '10', t: '10% (reduced)' }, { v: '4', t: '4% (super-reduced)' }, { v: '0', t: 'No VAT (exempt)' }],
      ret: 'IRPF withholding',
      rets: [{ v: '15', t: '15% (standard)' }, { v: '7', t: '7% (new freelancer)' }, { v: '0', t: 'No withholding' }, { v: 'otro', t: 'Other percentage' }],
      otro: 'Withholding percentage',
      base: 'Net amount (tax base)',
      cuotaIva: 'VAT',
      retencion: 'IRPF withholding',
      total: 'Invoice total',
      cobras: 'What your client pays you',
      explicaIva: 'The VAT isn’t yours: you collect it and pay it to the tax office with form 303.',
      explicaRet: 'You don’t receive the withholding either: your client pays it to the tax office on account of your income tax, and you get it back in your annual return.',
      infoTitle: 'Frequently asked questions',
      info: [
        { q: 'When do I need to add withholding to an invoice?', a: 'When you are a professional (for example a designer, consultant or lawyer) and you invoice a company or another freelancer. If you invoice a private individual, or your activity is a business one (retail, hospitality…), there is usually no withholding.' },
        { q: 'Who can apply the 7% rate?', a: 'Professionals who are starting out: in the year they register and the following two, as long as they did not carry out any activity the year before. You must tell your client in writing that it applies to you.' },
        { q: 'Which VAT rate applies to me?', a: 'Most services carry 21%. The 10% and 4% rates are for specific cases (hospitality, some foods, books…), and some activities are exempt, such as healthcare or officially recognised education.' },
      ],
    },
    cuota: {
      metaTitle: 'Spain self-employed contribution calculator 2026 by bracket · Asesoría Madal',
      metaDesc: 'Work out your 2026 self-employed Social Security contribution from your income and expenses: bracket, minimum base and monthly payment, using the official BOE table.',
      card: 'Your bracket and monthly contribution in 2026 based on what you expect to earn, using the official table.',
      title: 'Self-employed contribution calculator 2026',
      dek: 'Since 2023 you pay according to what you earn. Enter your expected income and expenses for the year and we’ll show your bracket and minimum contribution, using the official 2026 table.',
      ingresos: 'Expected income for the year (€, before VAT)',
      gastos: 'Expected expenses for the year (€, before VAT)',
      gastosHint: 'Not counting the self-employed contribution itself.',
      societario: 'I am a company self-employed worker (director or partner of my SL)',
      rendimiento: 'Monthly net earnings for Social Security',
      tramo: 'Your bracket',
      tablaReducida: 'Reduced table',
      tablaGeneral: 'General table',
      base: 'Minimum base',
      cuotaMes: 'Minimum monthly contribution',
      cuotaAno: 'Per year',
      tarifaPlana: 'If this is your first registration (or you haven’t been self-employed in the last two years), in your first year you can pay the flat rate: about €88 a month.',
      nota: 'A 7% allowance for general expenses is deducted from your earnings (3% for company self-employed workers). You can choose a higher base than your bracket’s minimum; the following year Social Security adjusts it to your actual income.',
      tablaTitle: '2026 bracket table',
      colTramo: 'Bracket',
      colRend: 'Monthly net earnings',
      colBase: 'Minimum base',
      colCuota: 'Minimum contribution',
      infoTitle: 'Frequently asked questions',
      info: [
        { q: 'What if I pick the wrong bracket?', a: 'The following year Social Security compares it with your actual income: if you earned more, it claims the difference; if you earned less, it refunds what you overpaid. You can change bracket up to 6 times a year.' },
        { q: 'Where does the 31.5% come from?', a: 'It is the sum of the 2026 rates: 28.3% common contingencies, 1.3% occupational contingencies, 0.9% cessation of activity, 0.1% vocational training and 0.9% for the MEI (intergenerational equity mechanism).' },
        { q: 'What if my earnings are negative or very low?', a: 'You pay at least the contribution of the first bracket of the reduced table. If you are just starting, first check whether you can apply for the flat rate.' },
      ],
    },
    impuestos: {
      metaTitle: 'Which tax returns do I need to file in Spain? Freelancers and SL · Asesoría Madal',
      metaDesc: 'Answer 6 questions and find out which Spanish tax forms you must file (303, 130, 111, 115, 349, 347, 200…) and when. For freelancers and SLs.',
      card: 'Answer a few questions and we’ll tell you which forms apply to you and when they are due.',
      title: 'Which tax returns do I need to file?',
      dek: 'Answer a few questions about your activity and we’ll tell you which forms you need to file each quarter and each year, with their deadlines.',
      preguntas: [
        { id: 'forma', q: 'How do you work?', opciones: [{ v: 'autonomo', t: 'As a freelancer (autónomo)' }, { v: 'sl', t: 'Through a company (SL)' }] },
        { id: 'estimacion', q: 'How are you taxed for income tax?', solo: 'autonomo', opciones: [{ v: 'directa', t: 'Direct assessment (the usual)' }, { v: 'modulos', t: 'Modules (módulos)' }, { v: 'directa', t: 'I don’t know' }] },
        { id: 'iva', q: 'Do your invoices include VAT?', opciones: [{ v: 'si', t: 'Yes' }, { v: 'no', t: 'No, my activity is exempt (healthcare, recognised education…)' }] },
        { id: 'retenciones', q: 'Does more than 70% of what you invoice carry income tax withholding?', solo: 'directa', opciones: [{ v: 'no', t: 'No, or I don’t know' }, { v: 'si', t: 'Yes, I invoice almost everything to companies with withholding' }] },
        { id: 'trabajadores', q: 'Do you have employees or pay professionals with withholding?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Yes' }] },
        { id: 'alquiler', q: 'Do you rent premises or an office?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Yes' }] },
        { id: 'ue', q: 'Do you buy from or sell to businesses in other EU countries?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Yes' }] },
        { id: 'grandes', q: 'Do you exceed €3,005.06 in the year with any client or supplier?', opciones: [{ v: 'no', t: 'No' }, { v: 'si', t: 'Yes, or I don’t know' }] },
      ],
      resultadoTitle: 'What you need to file',
      trimestrales: 'Every quarter',
      anuales: 'Once a year',
      ninguno: 'Answer the questions to see your forms.',
      modelos: {
        '303': { nombre: 'Form 303 · Quarterly VAT', cuando: '1–20 April, July and October, and 1–30 January' },
        '130': { nombre: 'Form 130 · Income tax payment on account', cuando: '1–20 April, July and October, and 1–30 January' },
        '131': { nombre: 'Form 131 · Income tax payment on account (modules)', cuando: '1–20 April, July and October, and 1–30 January' },
        '111': { nombre: 'Form 111 · Withholding for employees and professionals', cuando: '1–20 April, July and October, and 1–20 January' },
        '115': { nombre: 'Form 115 · Rent withholding', cuando: '1–20 April, July and October, and 1–20 January' },
        '349': { nombre: 'Form 349 · Intra-EU transactions', cuando: 'Usually quarterly, 1–20 of the following month (January, until the 30th)' },
        '202': { nombre: 'Form 202 · Corporate tax instalment', cuando: '1–20 April, October and December' },
        '390': { nombre: 'Form 390 · Annual VAT summary', cuando: '1–30 January' },
        '190': { nombre: 'Form 190 · Annual withholding summary', cuando: '1–31 January' },
        '180': { nombre: 'Form 180 · Annual rent summary', cuando: '1–31 January' },
        '347': { nombre: 'Form 347 · Transactions over €3,005.06', cuando: 'During February' },
        '100': { nombre: 'Form 100 · Annual income tax return', cuando: 'April to 30 June' },
        '200': { nombre: 'Form 200 · Corporate income tax', cuando: '1–25 July' },
      },
      notaSl: 'Form 202 is only mandatory if the previous year’s corporate tax came out payable. The SL also files its annual accounts with the Companies Registry every year.',
      nota130: 'As more than 70% of your income carries withholding, you don’t need to file form 130.',
    },
  },
};

// Tramos de 2026 (Orden PJC/297/2026, art. 18): [hasta (rendimiento mensual), base mínima]. El último no tiene tope.
export const TRAMOS_2026: { tabla: 'reducida' | 'general'; n: number; desde: number; hasta: number | null; base: number }[] = [
  { tabla: 'reducida', n: 1, desde: 0, hasta: 670, base: 653.59 },
  { tabla: 'reducida', n: 2, desde: 670, hasta: 900, base: 718.95 },
  { tabla: 'reducida', n: 3, desde: 900, hasta: 1166.7, base: 849.67 },
  { tabla: 'general', n: 1, desde: 1166.7, hasta: 1300, base: 950.98 },
  { tabla: 'general', n: 2, desde: 1300, hasta: 1500, base: 960.78 },
  { tabla: 'general', n: 3, desde: 1500, hasta: 1700, base: 960.78 },
  { tabla: 'general', n: 4, desde: 1700, hasta: 1850, base: 1143.79 },
  { tabla: 'general', n: 5, desde: 1850, hasta: 2030, base: 1209.15 },
  { tabla: 'general', n: 6, desde: 2030, hasta: 2330, base: 1274.51 },
  { tabla: 'general', n: 7, desde: 2330, hasta: 2760, base: 1356.21 },
  { tabla: 'general', n: 8, desde: 2760, hasta: 3190, base: 1437.91 },
  { tabla: 'general', n: 9, desde: 3190, hasta: 3620, base: 1519.61 },
  { tabla: 'general', n: 10, desde: 3620, hasta: 4050, base: 1601.31 },
  { tabla: 'general', n: 11, desde: 4050, hasta: 6000, base: 1732.03 },
  { tabla: 'general', n: 12, desde: 6000, hasta: null, base: 1928.1 },
];
export const TIPO_RETA_2026 = 0.315;

export const RUTAS_HERRAMIENTAS = {
  factura: '/herramientas/calculadora-factura',
  cuota: '/herramientas/cuota-autonomos',
  impuestos: '/herramientas/que-impuestos-presento',
} as const;
