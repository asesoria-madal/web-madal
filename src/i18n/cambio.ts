// Página "Cambiar de gestoría" (2026-11-13). Listas de documentos validadas por Edurne:
// la de SL la escribió ella; la de autónomo la revisó. Los modelos presentados y la Renta no se
// piden: los descargamos con el apoderamiento o el certificado digital.
// Catalán e inglés, primer borrador.
import type { Locale } from './ui';

type Grupo = { titulo: string; items: string[] };

export const CAMBIO: Record<Locale, {
  metaTitle: string; metaDesc: string; eyebrow: string; title: string; dek: string;
  ctaAutonomo: string; ctaSl: string; ctaLlamada: string;
  pasosTitle: string; pasos: { title: string; desc: string }[];
  momentoTitle: string; momento: string;
  docsTitle: string; docsIntro: string; docsNota: string;
  tabAutonomo: string; tabSl: string; autonomo: Grupo[]; sl: Grupo[];
  condicionesTitle: string; condiciones: string;
  finalTitle: string; finalDesc: string;
}> = {
  es: {
    metaTitle: 'Cambiar de gestoría sin hacer nada · Asesoría Madal',
    metaDesc: 'Cámbiate a Asesoría Madal: rellenas un formulario y nos encargamos de pedir tu documentación a tu gestoría y de coordinar los trimestres. Gratis si te quedas 6 meses.',
    eyebrow: 'Cambiar de gestoría',
    title: 'Cámbiate de gestoría sin hacer nada',
    dek: 'Rellenas un formulario de cinco minutos y nos encargamos del resto. Tú no tienes que hablar con tu gestoría anterior.',
    ctaAutonomo: 'Soy autónomo: empezar el cambio',
    ctaSl: 'Tengo una SL: empezar el cambio',
    ctaLlamada: 'Prefiero hablarlo antes',
    pasosTitle: 'Cómo funciona',
    pasos: [
      { title: 'Nos dices quién te lleva los impuestos', desc: 'Con el formulario: tus datos, tu situación fiscal y el contacto de tu gestoría actual.' },
      { title: 'Pedimos tu documentación a tu gestoría', desc: 'Con tu autorización, hablamos nosotros con ellos. Los modelos ya presentados los descargamos con tu apoderamiento o tu certificado digital.' },
      { title: 'Acordamos quién presenta cada trimestre', desc: 'Para que no se pierda ni se duplique ningún impuesto. A partir de ahí, te llevamos nosotros.' },
    ],
    momentoTitle: '¿Cuándo es buen momento?',
    momento: 'Lo más limpio es al empezar un trimestre (enero, abril, julio u octubre): tu gestoría anterior presenta el trimestre que ha llevado y nosotros empezamos con el siguiente. Pero puedes cambiarte en cualquier momento: acordamos con ellos quién presenta qué.',
    docsTitle: 'Qué documentación necesitamos',
    docsIntro: 'Te la pedimos nosotros a tu gestoría. Te la dejamos aquí para que sepas qué es y la tengas a mano si la tienes tú.',
    docsNota: 'Los modelos presentados y la declaración de la Renta los descargamos nosotros con tu apoderamiento o tu certificado digital.',
    tabAutonomo: 'Autónomos',
    tabSl: 'Sociedades (SL)',
    autonomo: [
      { titulo: 'Situación censal y Seguridad Social', items: ['Alta en Hacienda (modelo 036 o 037) y sus modificaciones, o certificado de situación censal', 'Alta en el RETA y última base de cotización'] },
      { titulo: 'Contabilidad', items: ['Libros registro de ingresos (facturas emitidas) y de gastos (facturas recibidas) del año en curso', 'Libro registro de bienes de inversión (amortizaciones), si los tienes', 'Facturas del año en curso que no estén en los libros'] },
      { titulo: 'Situación laboral (solo si tienes trabajadores)', items: ['Contratos, DNI o NIE, nóminas del año en curso y ficheros RLC/RNT', 'Altas y bajas en la Seguridad Social, e incidencias activas'] },
      { titulo: 'Situación con organismos públicos', items: ['Requerimientos, inspecciones, sanciones, recursos, aplazamientos o fraccionamientos activos con la Agencia Tributaria o la Seguridad Social'] },
      { titulo: 'Otros (si aplica)', items: ['Contrato de alquiler del local, si lo deduces', 'Préstamos o financiación vinculados a la actividad', 'Vehículo afecto a la actividad (factura de compra o contrato de renting o leasing)'] },
    ],
    sl: [
      { titulo: 'Documentación societaria', items: ['Escritura de constitución y estatutos sociales vigentes', 'Escrituras de modificaciones posteriores, si las hay (cambio de objeto social, ampliaciones de capital, cambio de administrador…)', 'Libro de socios actualizado, si ha habido cambios (compraventa de participaciones, ampliación de capital…)'] },
      { titulo: 'Documentación mercantil', items: ['Justificantes de presentación de los libros legalizados y copia de los documentos presentados', 'Actas realizadas hasta la fecha', 'Cuentas anuales depositadas en el Registro Mercantil'] },
      { titulo: 'Situación censal', items: ['Alta en el RETA del administrador, si aplica'] },
      { titulo: 'Contabilidad', items: ['Diario de movimientos del año en curso', 'Sumas y saldos del año en curso', 'Libros de facturas emitidas y recibidas del año en curso', 'Registro de bienes amortizables e inmovilizado material e intangible', 'Balance de cierre del año anterior'] },
      { titulo: 'Situación laboral', items: ['Contratos de trabajo del personal actual y de los trabajadores contratados durante el año', 'DNI o NIE de todos los trabajadores actuales', 'Nóminas del año en curso y ficheros RLC/RNT (o equivalente en el Sistema RED)', 'Situación de altas y bajas en la Seguridad Social y, si ha habido bajas durante el año, duplicados de los TA.2/S', 'ERTE, bajas o cualquier incidencia laboral activa'] },
      { titulo: 'Situación con organismos públicos', items: ['Cualquier proceso abierto con la Agencia Tributaria o la Seguridad Social: requerimientos, inspecciones, sanciones, recursos, aplazamientos o fraccionamientos activos'] },
      { titulo: 'Otros (si aplica)', items: ['Préstamos o financiación bancaria con impacto fiscal o contable', 'Operaciones vinculadas con socios, administradores u otras sociedades del grupo'] },
    ],
    condicionesTitle: 'Condiciones',
    condiciones: 'Sin permanencia. El cambio es gratis si te quedas con nosotros al menos 6 meses; si te vas antes, se cobra el trabajo del traspaso: 80 € + IVA si eres autónomo y 150 € + IVA si es una SL.',
    finalTitle: '¿Lo hablamos antes?',
    finalDesc: 'Reserva una llamada o escríbenos, y te contamos cómo sería en tu caso.',
  },
  ca: {
    metaTitle: 'Canviar de gestoria sense fer res · Asesoría Madal',
    metaDesc: 'Passa’t a Asesoría Madal: omples un formulari i ens encarreguem de demanar la documentació a la teva gestoria i de coordinar els trimestres. Gratuït si et quedes 6 mesos.',
    eyebrow: 'Canviar de gestoria',
    title: 'Canvia de gestoria sense fer res',
    dek: 'Omples un formulari de cinc minuts i ens encarreguem de la resta. No has de parlar amb la teva gestoria anterior.',
    ctaAutonomo: 'Sóc autònom: començar el canvi',
    ctaSl: 'Tinc una SL: començar el canvi',
    ctaLlamada: 'Prefereixo parlar-ne abans',
    pasosTitle: 'Com funciona',
    pasos: [
      { title: 'Ens dius qui et porta els impostos', desc: 'Amb el formulari: les teves dades, la teva situació fiscal i el contacte de la teva gestoria actual.' },
      { title: 'Demanem la documentació a la teva gestoria', desc: 'Amb la teva autorització, hi parlem nosaltres. Els models ja presentats els descarreguem amb el teu apoderament o el teu certificat digital.' },
      { title: 'Acordem qui presenta cada trimestre', desc: 'Perquè no es perdi ni es dupliqui cap impost. A partir d’aquí, et portem nosaltres.' },
    ],
    momentoTitle: 'Quan és un bon moment?',
    momento: 'El més net és en començar un trimestre (gener, abril, juliol o octubre): la gestoria anterior presenta el trimestre que ha portat i nosaltres comencem amb el següent. Però et pots canviar en qualsevol moment: acordem amb ells qui presenta què.',
    docsTitle: 'Quina documentació necessitem',
    docsIntro: 'La demanem nosaltres a la teva gestoria. Te la deixem aquí perquè sàpigues què és i la tinguis a mà si la tens tu.',
    docsNota: 'Els models presentats i la declaració de la Renda els descarreguem nosaltres amb el teu apoderament o el teu certificat digital.',
    tabAutonomo: 'Autònoms',
    tabSl: 'Societats (SL)',
    autonomo: [
      { titulo: 'Situació censal i Seguretat Social', items: ['Alta a Hisenda (model 036 o 037) i les seves modificacions, o certificat de situació censal', 'Alta al RETA i darrera base de cotització'] },
      { titulo: 'Comptabilitat', items: ['Llibres registre d’ingressos (factures emeses) i de despeses (factures rebudes) de l’any en curs', 'Llibre registre de béns d’inversió (amortitzacions), si en tens', 'Factures de l’any en curs que no siguin als llibres'] },
      { titulo: 'Situació laboral (només si tens treballadors)', items: ['Contractes, DNI o NIE, nòmines de l’any en curs i fitxers RLC/RNT', 'Altes i baixes a la Seguretat Social, i incidències actives'] },
      { titulo: 'Situació amb organismes públics', items: ['Requeriments, inspeccions, sancions, recursos, ajornaments o fraccionaments actius amb l’Agència Tributària o la Seguretat Social'] },
      { titulo: 'Altres (si escau)', items: ['Contracte de lloguer del local, si el dedueixes', 'Préstecs o finançament vinculats a l’activitat', 'Vehicle afecte a l’activitat (factura de compra o contracte de rènting o lísing)'] },
    ],
    sl: [
      { titulo: 'Documentació societària', items: ['Escriptura de constitució i estatuts socials vigents', 'Escriptures de modificacions posteriors, si n’hi ha (canvi d’objecte social, ampliacions de capital, canvi d’administrador…)', 'Llibre de socis actualitzat, si hi ha hagut canvis (compravenda de participacions, ampliació de capital…)'] },
      { titulo: 'Documentació mercantil', items: ['Justificants de presentació dels llibres legalitzats i còpia dels documents presentats', 'Actes fetes fins ara', 'Comptes anuals dipositats al Registre Mercantil'] },
      { titulo: 'Situació censal', items: ['Alta al RETA de l’administrador, si escau'] },
      { titulo: 'Comptabilitat', items: ['Diari de moviments de l’any en curs', 'Sumes i saldos de l’any en curs', 'Llibres de factures emeses i rebudes de l’any en curs', 'Registre de béns amortitzables i immobilitzat material i intangible', 'Balanç de tancament de l’any anterior'] },
      { titulo: 'Situació laboral', items: ['Contractes de treball del personal actual i dels treballadors contractats durant l’any', 'DNI o NIE de tots els treballadors actuals', 'Nòmines de l’any en curs i fitxers RLC/RNT (o equivalent al Sistema RED)', 'Situació d’altes i baixes a la Seguretat Social i, si hi ha hagut baixes durant l’any, duplicats dels TA.2/S', 'ERTO, baixes o qualsevol incidència laboral activa'] },
      { titulo: 'Situació amb organismes públics', items: ['Qualsevol procés obert amb l’Agència Tributària o la Seguretat Social: requeriments, inspeccions, sancions, recursos, ajornaments o fraccionaments actius'] },
      { titulo: 'Altres (si escau)', items: ['Préstecs o finançament bancari amb impacte fiscal o comptable', 'Operacions vinculades amb socis, administradors o altres societats del grup'] },
    ],
    condicionesTitle: 'Condicions',
    condiciones: 'Sense permanència. El canvi és gratuït si et quedes amb nosaltres com a mínim 6 mesos; si te’n vas abans, es cobra la feina del traspàs: 80 € + IVA si ets autònom i 150 € + IVA si és una SL.',
    finalTitle: 'En parlem abans?',
    finalDesc: 'Reserva una trucada o escriu-nos, i t’expliquem com seria en el teu cas.',
  },
  en: {
    metaTitle: 'Switch accountants without lifting a finger · Asesoría Madal',
    metaDesc: 'Switch to Asesoría Madal: fill in a form and we request your records from your current accountant and coordinate the quarters. Free if you stay 6 months.',
    eyebrow: 'Switching accountants',
    title: 'Switch accountants without lifting a finger',
    dek: 'You fill in a five-minute form and we handle the rest. You don’t need to talk to your previous accountant.',
    ctaAutonomo: 'I’m a freelancer: start switching',
    ctaSl: 'I have an SL: start switching',
    ctaLlamada: 'I’d rather talk first',
    pasosTitle: 'How it works',
    pasos: [
      { title: 'Tell us who handles your taxes now', desc: 'Through the form: your details, your tax situation and your current accountant’s contact.' },
      { title: 'We request your records from your accountant', desc: 'With your authorisation, we talk to them. We download the returns already filed ourselves, with your authorisation or your digital certificate.' },
      { title: 'We agree who files each quarter', desc: 'So no return is missed or duplicated. From then on, we take care of you.' },
    ],
    momentoTitle: 'When is a good time?',
    momento: 'The cleanest moment is at the start of a quarter (January, April, July or October): your previous accountant files the quarter they handled and we start with the next one. But you can switch at any time: we agree with them who files what.',
    docsTitle: 'What records we need',
    docsIntro: 'We request them from your accountant ourselves. They are listed here so you know what they are and can have them to hand if you keep them.',
    docsNota: 'We download the returns already filed and your annual income tax return ourselves, with your authorisation or your digital certificate.',
    tabAutonomo: 'Freelancers',
    tabSl: 'Companies (SL)',
    autonomo: [
      { titulo: 'Tax registration and Social Security', items: ['Tax Agency registration (form 036 or 037) and its changes, or a certificate of tax registration status', 'Self-employed (RETA) registration and latest contribution base'] },
      { titulo: 'Bookkeeping', items: ['Income (invoices issued) and expense (invoices received) ledgers for the current year', 'Capital assets ledger (depreciation), if you have any', 'Invoices for the current year not yet in the ledgers'] },
      { titulo: 'Employment (only if you have staff)', items: ['Contracts, DNI or NIE, payslips for the current year and RLC/RNT files', 'Social Security registrations and terminations, and any open issues'] },
      { titulo: 'Dealings with public bodies', items: ['Requests, inspections, penalties, appeals, deferrals or instalment plans open with the Tax Agency or Social Security'] },
      { titulo: 'Other (if applicable)', items: ['Lease of your premises, if you deduct it', 'Loans or financing linked to the business', 'Business vehicle (purchase invoice or renting or leasing contract)'] },
    ],
    sl: [
      { titulo: 'Corporate documents', items: ['Deed of incorporation and current articles of association', 'Later amendment deeds, if any (change of corporate purpose, capital increases, change of director…)', 'Up-to-date register of shareholders, if there have been changes (sale of shares, capital increase…)'] },
      { titulo: 'Commercial documents', items: ['Proof of filing of the legalised books and a copy of the documents filed', 'Minutes to date', 'Annual accounts filed with the Commercial Registry'] },
      { titulo: 'Tax registration', items: ['Director’s self-employed (RETA) registration, if applicable'] },
      { titulo: 'Bookkeeping', items: ['Journal for the current year', 'Trial balance for the current year', 'Ledgers of invoices issued and received for the current year', 'Register of depreciable assets and tangible and intangible fixed assets', 'Closing balance sheet for the previous year'] },
      { titulo: 'Employment', items: ['Employment contracts of current staff and of anyone hired during the year', 'DNI or NIE of all current employees', 'Payslips for the current year and RLC/RNT files (or the equivalent in the RED system)', 'Social Security registrations and terminations and, if anyone left during the year, copies of the TA.2/S forms', 'Furlough schemes (ERTE), sick leave or any open employment issue'] },
      { titulo: 'Dealings with public bodies', items: ['Any open process with the Tax Agency or Social Security: requests, inspections, penalties, appeals, deferrals or instalment plans'] },
      { titulo: 'Other (if applicable)', items: ['Bank loans or financing with a tax or accounting impact', 'Related-party transactions with shareholders, directors or other group companies'] },
    ],
    condicionesTitle: 'Terms',
    condiciones: 'No lock-in. Switching is free if you stay with us at least 6 months; if you leave earlier, the switching work is charged: €80 + VAT for freelancers and €150 + VAT for companies.',
    finalTitle: 'Shall we talk first?',
    finalDesc: 'Book a call or write to us, and we will explain how it would work in your case.',
  },
};
