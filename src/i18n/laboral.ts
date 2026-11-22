// Textos del apartado Laboral del portal (incidencias mensuales, altas y bajas de trabajadores).
// es / ca / en, como el resto del portal. Los nombres de los tipos de incidencia viven en
// src/lib/incidenciasLaborales.ts. Marcadores {nombre} se sustituyen en el navegador.

export interface TextosLaboral {
  nav: string;
  title: string;
  intro: string;
  soloLectura: string;
  // Incidencias del mes
  inc: {
    title: string; intro: string; mesLabel: string; mesActual: string; mesAnterior: string;
    plazo: string; plazoVencido: string;
    estado: { sinEnviar: string; pendiente: string; cargada: string; conErrores: string; sinIncidencias: string };
    descargar: string; subir: string; sinIncidencias: string; confirmarSin: string; sinTrabajadores: string;
    leyendo: string; subiendo: string; hecho: string; sustituye: string; resultado: string;
    cols: { fila: string; trabajador: string; tipo: string; estado: string; detalle: string };
    estadoLinea: { pendiente: string; cargada: string; revisar: string; error: string };
    notaRevisar: string; errorGenerico: string; erroresPlantilla: string; ultimaCarga: string;
  };
  // Errores al leer la plantilla ({fila}, {mes})
  err: {
    sinHoja: string; otraEmpresa: string; trabajador: string; tipo: string; desde: string; hasta: string; hastaAntes: string;
    cantidad: string; importe: string; sinFilas: string; demasiadas: string;
  };
  // Trabajadores y bajas
  trab: {
    title: string; vacio: string; cols: { nombre: string; nif: string; alta: string; estado: string };
    activo: string; deBaja: string; pedirBaja: string; cargando: string;
  };
  baja: {
    pedidas: string; estado: { enviada: string; cargada: string; tramitada: string; revision: string };
  };
  // Altas
  alta: {
    title: string; introConTrabajadores: string; boton: string; botonOtro: string;
    vacioTitle: string; vacioIntro: string; pasos: string[]; nota: string;
    enviadas: string; estado: { recibida: string; cargada: string; tramitada: string; revision: string };
  };
  // Plantilla Excel
  xlsx: {
    hojaIncidencias: string; hojaInstrucciones: string; hojaListas: string; archivo: string;
    cols: { trabajador: string; tipo: string; desde: string; hasta: string; cantidad: string; importe: string; comentario: string; ayuda: string };
    titulo: string; instrucciones: string[];
    tablaTipo: string; tablaCantidad: string; tablaImporte: string; tablaFechas: string;
    unidad: { horas: string; dias: string; km: string; euros: string; veces: string };
    importeConvenio: string; importeObligatorio: string; importeNinguno: string; si: string; no: string;
    sinTrabajadores: string;
  };
}

const MESES = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  ca: ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
export const MESES_LABORAL = MESES;

export const LABORAL: Record<'es' | 'ca' | 'en', TextosLaboral> = {
  es: {
    nav: 'Laboral',
    title: 'Laboral',
    intro: 'Aquí gestionas lo laboral de tu empresa: las incidencias de cada mes para las nóminas, las altas de trabajadores nuevos y las bajas.',
    soloLectura: 'Estás viendo el área de este cliente como administrador: no se puede subir ni pedir nada en su nombre.',
    inc: {
      title: 'Incidencias del mes',
      intro: 'Cada mes, ya cerrado, necesitamos las incidencias para preparar las nóminas: horas extra, dietas, vacaciones, bajas médicas, anticipos… Descarga la plantilla (ya lleva a tus trabajadores), rellénala y súbela aquí.',
      mesLabel: 'Nómina de',
      mesActual: '{mes} (el mes que acaba de terminar)',
      mesAnterior: '{mes} (si se te pasó)',
      plazo: 'Plazo para enviarlas: hasta el {fecha}.',
      plazoVencido: 'El plazo terminó el {fecha}. Puedes subirlas igualmente, pero no podemos garantizar que entren en la nómina de este mes.',
      estado: {
        sinEnviar: 'Sin enviar',
        pendiente: 'Recibida, procesándose…',
        cargada: 'Recibida y cargada',
        conErrores: 'Recibida, con filas por corregir',
        sinIncidencias: 'Nos has indicado que este mes no hay incidencias',
      },
      descargar: 'Descargar plantilla de {mes}',
      subir: 'Subir plantilla rellena',
      sinIncidencias: 'Este mes no hay incidencias',
      confirmarSin: '¿Confirmas que en {mes} no hay ninguna incidencia (horas extra, dietas, vacaciones, bajas…)?',
      sinTrabajadores: 'Todavía no tienes trabajadores dados de alta en nómina, así que este mes no hay nada que enviar. Cuando contrates a alguien, empieza por el alta (más abajo).',
      leyendo: 'Leyendo la plantilla…',
      subiendo: 'Enviando…',
      hecho: 'Plantilla recibida. La estamos cargando: en un par de minutos verás aquí el resultado.',
      sustituye: 'Si ya habías enviado la de este mes, esta la sustituye.',
      resultado: 'Resultado de tu último envío',
      cols: { fila: 'Fila', trabajador: 'Trabajador', tipo: 'Incidencia', estado: 'Estado', detalle: 'Detalle' },
      estadoLinea: { pendiente: 'Pendiente', cargada: 'Cargada', revisar: 'La revisamos nosotros', error: 'Por corregir' },
      notaRevisar: '«La revisamos nosotros» no es un error: algo (por ejemplo una baja médica) necesita que lo comprobemos a mano.',
      errorGenerico: 'No hemos podido enviar la plantilla. Inténtalo de nuevo y, si sigue fallando, escríbenos.',
      erroresPlantilla: 'La plantilla tiene filas que corregir antes de enviarla:',
      ultimaCarga: 'Enviada el {fecha}',
    },
    err: {
      sinHoja: 'No encuentro la hoja «Incidencias». Usa la plantilla que descargas aquí, sin cambiarle el nombre a las hojas.',
      otraEmpresa: 'Esta plantilla es de otra empresa. Descarga la tuya desde aquí.',
      trabajador: 'Fila {fila}: elige el trabajador de la lista desplegable.',
      tipo: 'Fila {fila}: elige el tipo de incidencia de la lista desplegable.',
      desde: 'Fila {fila}: falta la fecha «Desde» (o no es una fecha válida).',
      hasta: 'Fila {fila}: la fecha «Hasta» no es válida.',
      hastaAntes: 'Fila {fila}: «Hasta» es anterior a «Desde».',
      cantidad: 'Fila {fila}: falta la cantidad (un número mayor que 0).',
      importe: 'Fila {fila}: el importe no es un número válido.',
      sinFilas: 'La plantilla no tiene ninguna fila rellena. Si este mes no hay incidencias, usa el botón «Este mes no hay incidencias».',
      demasiadas: 'La plantilla tiene demasiadas filas (máximo 500).',
    },
    trab: {
      title: 'Mis trabajadores',
      vacio: 'Todavía no tienes trabajadores dados de alta en nómina.',
      cols: { nombre: 'Nombre', nif: 'NIF', alta: 'Alta', estado: 'Estado' },
      activo: 'En activo', deBaja: 'De baja', pedirBaja: 'Pedir baja', cargando: 'Cargando…',
    },
    baja: {
      pedidas: 'Bajas pedidas',
      estado: { enviada: 'Recibida', cargada: 'Recibida, la estamos tramitando', tramitada: 'Tramitada', revision: 'La estamos revisando' }
    },
    alta: {
      title: 'Alta de un trabajador',
      introConTrabajadores: '¿Vas a contratar a alguien? Rellena el formulario de alta con los datos del trabajador y del contrato. Hazlo antes de que empiece a trabajar: el alta en la Seguridad Social tiene que estar hecha antes del primer día.',
      boton: 'Dar de alta a un trabajador',
      botonOtro: 'Dar de alta a otro trabajador',
      vacioTitle: 'Todavía no tienes trabajadores',
      vacioIntro: 'Cuando vayas a contratar a alguien, empieza por aquí. Es sencillo y nosotros nos encargamos del resto:',
      pasos: [
        'Rellenas el formulario de alta con los datos del trabajador y del contrato (unos 10 minutos, y mejor con 3 días o más de antelación).',
        'Nosotros lo damos de alta en nómina, hacemos el alta en la Seguridad Social y el contrato.',
        'Desde el mes siguiente, cada mes nos mandas aquí las incidencias (horas extra, vacaciones, bajas…) y preparamos las nóminas.',
      ],
      nota: 'Las altas de trabajador se cobran aparte, según tu tarifa. Si tienes dudas antes de contratar, escríbenos.',
      enviadas: 'Altas enviadas',
      estado: { recibida: 'Recibida', cargada: 'En nómina, falta el trámite oficial', tramitada: 'Tramitada', revision: 'La estamos revisando' },
    },
    xlsx: {
      hojaIncidencias: 'Incidencias', hojaInstrucciones: 'Instrucciones', hojaListas: 'Listas', archivo: 'Incidencias-{mes}-{anio}.xlsx',
      cols: { trabajador: 'Trabajador', tipo: 'Tipo de incidencia', desde: 'Desde', hasta: 'Hasta', cantidad: 'Cantidad', importe: 'Importe (€)', comentario: 'Comentario', ayuda: 'Qué poner en «Cantidad»' },
      titulo: 'Incidencias de {mes} de {anio} · {empresa}',
      instrucciones: [
        'Una fila por incidencia. Elige el trabajador y el tipo en las listas desplegables de la hoja «Incidencias».',
        'Cantidad: horas, días, kilómetros, número de dietas… según el tipo (la última columna de la hoja te lo dice). En los tipos «en euros» pon directamente el importe en «Cantidad».',
        'Importe (€): déjalo vacío si la incidencia se paga según el convenio (horas extra, dietas, kilometraje). Escríbelo solo si pagas otra cantidad, o cuando el tipo lo pida.',
        'Desde / Hasta: obligatorias en vacaciones, permisos, faltas y bajas médicas. Hasta puede quedar vacío en una baja médica que sigue abierta.',
        'Varias filas del mismo tipo y trabajador en el mismo mes se suman.',
        'Súbela en el portal (Laboral) antes del día 15. Si te equivocas, corrige y vuelve a subirla: la nueva sustituye a la anterior.',
        'No cambies el nombre de las hojas ni borres la hoja «Listas»: la necesitamos para leer la plantilla.',
      ],
      tablaTipo: 'Tipo', tablaCantidad: 'En «Cantidad» pon…', tablaImporte: '¿Importe?', tablaFechas: '¿Fechas?',
      unidad: { horas: 'las horas', dias: 'los días', km: 'los kilómetros', euros: 'el importe en euros', veces: 'cuántas veces' },
      importeConvenio: 'Opcional (si no, el del convenio)', importeObligatorio: 'Obligatorio', importeNinguno: 'No lleva', si: 'Sí', no: 'No',
      sinTrabajadores: '(sin trabajadores)',
    },
  },

  ca: {
    nav: 'Laboral',
    title: 'Laboral',
    intro: "Aquí gestiones el laboral de la teva empresa: les incidències de cada mes per a les nòmines, les altes de treballadors nous i les baixes.",
    soloLectura: "Estàs veient l'àrea d'aquest client com a administrador: no es pot pujar ni demanar res en nom seu.",
    inc: {
      title: 'Incidències del mes',
      intro: 'Cada mes, ja tancat, necessitem les incidències per preparar les nòmines: hores extra, dietes, vacances, baixes mèdiques, avançaments… Descarrega la plantilla (ja porta els teus treballadors), omple-la i puja-la aquí.',
      mesLabel: 'Nòmina de',
      mesActual: '{mes} (el mes que acaba de acabar)',
      mesAnterior: '{mes} (si se’t va passar)',
      plazo: "Termini per enviar-les: fins al {fecha}.",
      plazoVencido: "El termini va acabar el {fecha}. Les pots pujar igualment, però no podem garantir que entrin a la nòmina d'aquest mes.",
      estado: {
        sinEnviar: 'Sense enviar',
        pendiente: 'Rebuda, processant-se…',
        cargada: 'Rebuda i carregada',
        conErrores: 'Rebuda, amb files per corregir',
        sinIncidencias: "Ens has indicat que aquest mes no hi ha incidències",
      },
      descargar: 'Descarregar plantilla de {mes}',
      subir: 'Pujar plantilla omplerta',
      sinIncidencias: 'Aquest mes no hi ha incidències',
      confirmarSin: 'Confirmes que a {mes} no hi ha cap incidència (hores extra, dietes, vacances, baixes…)?',
      sinTrabajadores: "Encara no tens treballadors donats d'alta a nòmina, així que aquest mes no hi ha res a enviar. Quan contractis algú, comença per l'alta (més avall).",
      leyendo: 'Llegint la plantilla…',
      subiendo: 'Enviant…',
      hecho: "Plantilla rebuda. L'estem carregant: d'aquí a un parell de minuts hi veuràs el resultat.",
      sustituye: "Si ja havies enviat la d'aquest mes, aquesta la substitueix.",
      resultado: "Resultat de l'últim enviament",
      cols: { fila: 'Fila', trabajador: 'Treballador', tipo: 'Incidència', estado: 'Estat', detalle: 'Detall' },
      estadoLinea: { pendiente: 'Pendent', cargada: 'Carregada', revisar: 'La revisem nosaltres', error: 'Per corregir' },
      notaRevisar: "«La revisem nosaltres» no és un error: alguna cosa (per exemple una baixa mèdica) necessita que ho comprovem a mà.",
      errorGenerico: "No hem pogut enviar la plantilla. Torna-ho a provar i, si continua fallant, escriu-nos.",
      erroresPlantilla: 'La plantilla té files per corregir abans d’enviar-la:',
      ultimaCarga: 'Enviada el {fecha}',
    },
    err: {
      sinHoja: "No trobo el full «Incidencias». Fes servir la plantilla que descarregues aquí, sense canviar el nom dels fulls.",
      otraEmpresa: "Aquesta plantilla és d'una altra empresa. Descarrega la teva des d'aquí.",
      trabajador: 'Fila {fila}: tria el treballador de la llista desplegable.',
      tipo: "Fila {fila}: tria el tipus d'incidència de la llista desplegable.",
      desde: "Fila {fila}: falta la data «Des de» (o no és una data vàlida).",
      hasta: "Fila {fila}: la data «Fins a» no és vàlida.",
      hastaAntes: "Fila {fila}: «Fins a» és anterior a «Des de».",
      cantidad: 'Fila {fila}: falta la quantitat (un número més gran que 0).',
      importe: "Fila {fila}: l'import no és un número vàlid.",
      sinFilas: "La plantilla no té cap fila omplerta. Si aquest mes no hi ha incidències, fes servir el botó «Aquest mes no hi ha incidències».",
      demasiadas: 'La plantilla té massa files (màxim 500).',
    },
    trab: {
      title: 'Els meus treballadors',
      vacio: "Encara no tens treballadors donats d'alta a nòmina.",
      cols: { nombre: 'Nom', nif: 'NIF', alta: 'Alta', estado: 'Estat' },
      activo: 'En actiu', deBaja: 'De baixa', pedirBaja: 'Demanar baixa', cargando: 'Carregant…',
    },
    baja: {
      pedidas: 'Baixes demanades',
      estado: { enviada: 'Rebuda', cargada: 'Rebuda, la estem tramitant', tramitada: 'Tramitada', revision: "L'estem revisant" }
    },
    alta: {
      title: "Alta d'un treballador",
      introConTrabajadores: "Vas a contractar algú? Omple el formulari d'alta amb les dades del treballador i del contracte. Fes-ho abans que comenci a treballar: l'alta a la Seguretat Social ha d'estar feta abans del primer dia.",
      boton: "Donar d'alta un treballador",
      botonOtro: "Donar d'alta un altre treballador",
      vacioTitle: 'Encara no tens treballadors',
      vacioIntro: 'Quan vagis a contractar algú, comença per aquí. És senzill i nosaltres ens encarreguem de la resta:',
      pasos: [
        "Omples el formulari d'alta amb les dades del treballador i del contracte (uns 10 minuts, i millor amb 3 dies o més d'antelació).",
        "Nosaltres el donem d'alta a nòmina, fem l'alta a la Seguretat Social i el contracte.",
        "A partir del mes següent, cada mes ens envies aquí les incidències (hores extra, vacances, baixes…) i preparem les nòmines.",
      ],
      nota: "Les altes de treballador es cobren a part, segons la teva tarifa. Si tens dubtes abans de contractar, escriu-nos.",
      enviadas: 'Altes enviades',
      estado: { recibida: 'Rebuda', cargada: 'A nòmina, falta el tràmit oficial', tramitada: 'Tramitada', revision: "L'estem revisant" },
    },
    xlsx: {
      hojaIncidencias: 'Incidencias', hojaInstrucciones: 'Instruccions', hojaListas: 'Listas', archivo: 'Incidencies-{mes}-{anio}.xlsx',
      cols: { trabajador: 'Treballador', tipo: "Tipus d'incidència", desde: 'Des de', hasta: 'Fins a', cantidad: 'Quantitat', importe: 'Import (€)', comentario: 'Comentari', ayuda: 'Què posar a «Quantitat»' },
      titulo: 'Incidències de {mes} de {anio} · {empresa}',
      instrucciones: [
        "Una fila per incidència. Tria el treballador i el tipus a les llistes desplegables del full «Incidencias».",
        "Quantitat: hores, dies, quilòmetres, nombre de dietes… segons el tipus (l'última columna del full t'ho diu). En els tipus «en euros» posa directament l'import a «Quantitat».",
        "Import (€): deixa'l buit si la incidència es paga segons el conveni (hores extra, dietes, quilometratge). Escriu-lo només si pagues una altra quantitat, o quan el tipus ho demani.",
        "Des de / Fins a: obligatòries en vacances, permisos, faltes i baixes mèdiques. Fins a pot quedar buit en una baixa mèdica que continua oberta.",
        'Diverses files del mateix tipus i treballador en el mateix mes se sumen.',
        "Puja-la al portal (Laboral) abans del dia 15. Si t'equivoques, corregeix i torna-la a pujar: la nova substitueix l'anterior.",
        "No canviïs el nom dels fulls ni esborris el full «Listas»: la necessitem per llegir la plantilla.",
      ],
      tablaTipo: 'Tipus', tablaCantidad: 'A «Quantitat» posa…', tablaImporte: 'Import?', tablaFechas: 'Dates?',
      unidad: { horas: 'les hores', dias: 'els dies', km: 'els quilòmetres', euros: "l'import en euros", veces: 'quantes vegades' },
      importeConvenio: 'Opcional (si no, el del conveni)', importeObligatorio: 'Obligatori', importeNinguno: 'No en porta', si: 'Sí', no: 'No',
      sinTrabajadores: '(sense treballadors)',
    },
  },

  en: {
    nav: 'Labour',
    title: 'Labour',
    intro: 'Manage the employment side of your business here: the monthly payroll changes, new hires and leavers.',
    soloLectura: "You are viewing this client's area as an administrator: nothing can be uploaded or requested on their behalf.",
    inc: {
      title: 'This month’s payroll changes',
      intro: 'Each month, once it has closed, we need the payroll changes to prepare payslips: overtime, per diems, holidays, sick leave, advances… Download the template (it already lists your employees), fill it in and upload it here.',
      mesLabel: 'Payroll for',
      mesActual: '{mes} (the month that just ended)',
      mesAnterior: '{mes} (if you missed it)',
      plazo: 'Deadline to send them: {fecha}.',
      plazoVencido: 'The deadline was {fecha}. You can still upload them, but we cannot guarantee they will be included in this month’s payroll.',
      estado: {
        sinEnviar: 'Not sent',
        pendiente: 'Received, being processed…',
        cargada: 'Received and loaded',
        conErrores: 'Received, some rows need fixing',
        sinIncidencias: 'You told us there are no changes this month',
      },
      descargar: 'Download {mes} template',
      subir: 'Upload completed template',
      sinIncidencias: 'No changes this month',
      confirmarSin: 'Do you confirm there are no changes in {mes} (overtime, per diems, holidays, sick leave…)?',
      sinTrabajadores: 'You have no employees on payroll yet, so there is nothing to send this month. When you hire someone, start with the hiring form (below).',
      leyendo: 'Reading the template…',
      subiendo: 'Sending…',
      hecho: 'Template received. We are loading it: in a couple of minutes you will see the result here.',
      sustituye: 'If you already sent this month’s, this one replaces it.',
      resultado: 'Result of your last submission',
      cols: { fila: 'Row', trabajador: 'Employee', tipo: 'Change', estado: 'Status', detalle: 'Details' },
      estadoLinea: { pendiente: 'Pending', cargada: 'Loaded', revisar: 'We will check it', error: 'To fix' },
      notaRevisar: '“We will check it” is not an error: something (for example sick leave) needs to be checked by hand.',
      errorGenerico: 'We could not send the template. Please try again and, if it keeps failing, write to us.',
      erroresPlantilla: 'The template has rows to fix before it can be sent:',
      ultimaCarga: 'Sent on {fecha}',
    },
    err: {
      sinHoja: 'I cannot find the “Incidencias” sheet. Use the template you download here, without renaming its sheets.',
      otraEmpresa: 'This template belongs to another company. Download yours from here.',
      trabajador: 'Row {fila}: pick the employee from the drop-down list.',
      tipo: 'Row {fila}: pick the type of change from the drop-down list.',
      desde: 'Row {fila}: the “From” date is missing (or is not a valid date).',
      hasta: 'Row {fila}: the “To” date is not valid.',
      hastaAntes: 'Row {fila}: “To” is before “From”.',
      cantidad: 'Row {fila}: the quantity is missing (a number greater than 0).',
      importe: 'Row {fila}: the amount is not a valid number.',
      sinFilas: 'The template has no completed rows. If there are no changes this month, use the “No changes this month” button.',
      demasiadas: 'The template has too many rows (maximum 500).',
    },
    trab: {
      title: 'My employees',
      vacio: 'You have no employees on payroll yet.',
      cols: { nombre: 'Name', nif: 'ID', alta: 'Start', estado: 'Status' },
      activo: 'Active', deBaja: 'Left', pedirBaja: 'Request leaver', cargando: 'Loading…',
    },
    baja: {
      pedidas: 'Leavers requested',
      estado: { enviada: 'Received', cargada: 'Received, we are processing it', tramitada: 'Completed', revision: 'We are reviewing it' }
    },
    alta: {
      title: 'Hire an employee',
      introConTrabajadores: 'Are you going to hire someone? Fill in the hiring form with the employee’s and contract details. Do it before they start: the Social Security registration must be done before the first day.',
      boton: 'Hire an employee',
      botonOtro: 'Hire another employee',
      vacioTitle: 'You have no employees yet',
      vacioIntro: 'When you are about to hire someone, start here. It is simple and we take care of the rest:',
      pasos: [
        'You fill in the hiring form with the employee’s and contract details (about 10 minutes, ideally 3 or more days in advance).',
        'We register them in payroll, do the Social Security registration and the contract.',
        'From the following month, you send us the payroll changes here each month (overtime, holidays, sick leave…) and we prepare the payslips.',
      ],
      nota: 'Hiring registrations are charged separately, according to your plan. If you have questions before hiring, write to us.',
      enviadas: 'Hires submitted',
      estado: { recibida: 'Received', cargada: 'In payroll, official filing pending', tramitada: 'Completed', revision: 'We are reviewing it' },
    },
    xlsx: {
      hojaIncidencias: 'Incidencias', hojaInstrucciones: 'Instructions', hojaListas: 'Listas', archivo: 'Payroll-changes-{mes}-{anio}.xlsx',
      cols: { trabajador: 'Employee', tipo: 'Type of change', desde: 'From', hasta: 'To', cantidad: 'Quantity', importe: 'Amount (€)', comentario: 'Comment', ayuda: 'What to put in “Quantity”' },
      titulo: 'Payroll changes for {mes} {anio} · {empresa}',
      instrucciones: [
        'One row per change. Pick the employee and the type from the drop-down lists in the “Incidencias” sheet.',
        'Quantity: hours, days, kilometres, number of per diems… depending on the type (the last column tells you). For “in euros” types, put the amount directly in “Quantity”.',
        'Amount (€): leave it empty if the item is paid according to the collective agreement (overtime, per diems, mileage). Fill it in only if you pay a different amount, or when the type requires it.',
        'From / To: required for holidays, leave, absences and sick leave. “To” can stay empty for sick leave that is still open.',
        'Several rows of the same type for the same employee in the same month are added together.',
        'Upload it in the portal (Labour) before the 15th. If you make a mistake, fix it and upload again: the new one replaces the previous one.',
        'Do not rename the sheets or delete the “Listas” sheet: we need it to read the template.',
      ],
      tablaTipo: 'Type', tablaCantidad: 'In “Quantity” put…', tablaImporte: 'Amount?', tablaFechas: 'Dates?',
      unidad: { horas: 'the hours', dias: 'the days', km: 'the kilometres', euros: 'the amount in euros', veces: 'how many times' },
      importeConvenio: 'Optional (otherwise the agreement’s)', importeObligatorio: 'Required', importeNinguno: 'None', si: 'Yes', no: 'No',
      sinTrabajadores: '(no employees)',
    },
  },
};
