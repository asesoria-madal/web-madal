export const locales = ['es', 'ca', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';

export const localeNames: Record<Locale, string> = {
  es: 'Castellano',
  ca: 'Català',
  en: 'English',
};

// Traducción: el castellano es el texto ya revisado y aprobado.
// Catalán e inglés son un primer borrador (traducción propia, sin revisión
// nativa todavía) — pendiente de que alguien lo repase antes de tráfico real.
export const ui = {
  es: {
    nav: { home: 'Inicio', simulador: 'Simulador', alta: 'Altas', blog: 'FAQs', equipo: 'Quiénes somos' },
    header: { cta: 'Reservar llamada', portal: 'Área clientes' },
    contact: {
      trigger: 'Contacta con nosotros',
      emailLabel: 'Escríbenos por correo:',
      email: 'contacto@asesoriamadal.es',
      guarantee: 'Te responderemos en menos de 24h garantizado',
      orLabel: 'O si lo prefieres:',
      callLabel: 'Reserva una llamada',
      closing: 'Elige lo que te resulte más cómodo, correo o llamada: te atendemos con la misma cercanía.',
    },

    hero: {
      eyebrow: 'Gestoría online para autónomos y pymes',
      title: 'Presentamos tus impuestos, te lo explicamos todo y seguimos en contacto contigo.',
      dek: 'Contabilidad para autónomos y pymes, 100% online. Presentamos tus impuestos cada trimestre y te explicamos, paso a paso, qué significan tus números.',
      priceLabel: 'Cuota',
      priceAmount: 'desde 48,40 €',
      priceUnit: '/mes, IVA incluido',
      priceClaim: 'Incluye todas tus consultas y dudas, sin sorpresas ni letra pequeña.',
      ctaSim: 'Simula tu precio',
      ctaCall: 'Reservar llamada',
      trust: 'Toda España, excepto Canarias, Navarra y País Vasco (tienen regímenes fiscales propios).',
    },

    diferencia: {
      eyebrow: 'La diferencia',
      title: 'Una gestoría que solo presenta impuestos, y otra que te ayuda a crecer',
      sub: 'Una gestoría cualquiera se limita a presentar tus modelos a tiempo. Nosotros te los presentamos, te los explicamos, y te ayudamos a que tu negocio crezca.',
      colTraditional: 'Gestoría tradicional',
      colOnline: 'Gestoría online al uso',
      colMadal: 'Asesoría Madal',
      rows: [
        { trad: 'Poca digitalización', online: '100% digital', madal: '100% digital, con trato cercano' },
        { trad: 'Solo presenta tus impuestos', online: 'Presenta tus impuestos', madal: 'Presentamos tus impuestos y te explicamos qué dicen los números' },
        { trad: 'Solo se comunica cuando llamas tú', online: 'Solo automatizaciones, sin trato directo con personas', madal: 'Comunicación activa y continuada: somos tu referente fiscal' },
        { trad: 'Precio elevado', online: '100% digital, 0% personalizado', madal: 'Te enviamos tu balance y PyG explicados cada trimestre' },
        { trad: '', online: '', madal: 'Reporting y datos ajustados a tus necesidades, para que decidas mejor' },
        { trad: '', online: '', madal: 'Queremos crecer con tu empresa: si a ti te va bien, a nosotros también' },
      ],
    },

    proceso: {
      eyebrow: 'Cómo empezamos',
      title: 'Tres pasos y ya tienes gestoría',
      steps: [
        { title: 'Reserva una llamada de 20 minutos', desc: 'Nos cuentas tu actividad y resolvemos dudas. Sin compromiso.' },
        { title: 'Confirmamos tu cuota y damos de alta tu expediente', desc: 'Trámites y apoderamientos incluidos.' },
        { title: 'Cada trimestre, presentamos y te asesoramos para que tu negocio mejore', desc: 'Modelos presentados a tiempo, con tu balance y PyG explicados para que decidas con datos, no a ciegas.' },
      ],
    },

    precios: {
      eyebrow: 'Tarifas',
      title: 'Precios públicos, sin letra pequeña',
      sub: 'Precios con IVA incluido. Cifras orientativas mientras cerramos la web definitiva.',
      ivaLabel: 'IVA incluido',
      rows: [
        { title: 'Autónomo', amount: 'desde 48,40 €', unit: '/mes', incl: 'Trimestrales de IVA e IRPF · Balance trimestral · Declaración de la renta incluida' },
        { title: 'SL y pymes', amount: 'desde 121 €', unit: '/mes', incl: 'Balance trimestral' },
      ],
      note: 'Reporting y dashboards: +36,30 €/mes, IVA incluido, opcional. Sin permanencia.',
    },

    alta: {
      title: '¿Vas a darte de alta como autónomo?',
      desc: 'Nos encargamos del papeleo. Pagas la tarifa de alta y el primer mes de gestoría va gratis.',
      price: 'Alta desde 59,29 €',
      priceNote: '+ 1er mes de cuota, gratis · IVA incluido',
      link: 'Ver cómo funciona →',
    },

    altaPage: {
      eyebrow: 'Alta rápida',
      title: 'Alta de autónomos en menos de 3 días',
      intro: 'Nos encargamos de todo el papeleo para que puedas empezar a facturar cuanto antes. Pagas la tarifa de alta y el primer mes de gestoría ya va incluido, gratis.',
      autonomos: {
        title: 'Si vas a darte de alta como autónomo',
        desc: 'Presentamos tu alta en Hacienda y en el RETA de la Seguridad Social.',
        steps: [
          { title: 'Nos cuentas tu actividad', desc: 'Por llamada o por correo, sin compromiso.' },
          { title: 'Nos mandas tu DNI y los datos básicos', desc: 'Los que hagan falta según tu actividad.' },
          { title: 'Presentamos el alta', desc: 'En Hacienda (censo de actividades) y en la Seguridad Social (RETA).' },
        ],
      },
      timeline: 'En menos de 3 días tienes el alta hecha y ya puedes facturar, con el primer mes de gestoría incluido.',
      price: 'Alta desde 59,29 €',
      priceNote: '+ 1er mes de cuota, gratis · IVA incluido',
      ctaCall: 'Reservar llamada',
    },

    blogTeaser: { text: 'Te explicamos tus impuestos sin tecnicismos.', link: 'Ver el blog →' },

    ctaFinal: {
      title: 'Habla con nosotros antes de decidir nada',
      ctaCall: 'Reservar llamada de 20 minutos',
      ctaMail: 'Escríbenos por correo',
      fine: 'Sin compromiso · Respuesta en menos de 24 h',
    },

    sim: {
      eyebrow: 'Simulador de precio',
      title: '¿Cuánto te costaría con Asesoría Madal?',
      sub: 'Tres preguntas y tienes tu presupuesto. Lo confirmamos en la llamada.',
      stepRegimen: {
        q: '¿Eres autónomo o tienes una SL/pyme?',
        options: [
          { value: 'autonomo', label: 'Autónomo' },
          { value: 'pyme', label: 'SL o pyme' },
        ],
      },
      stepFacturas: {
        q: '¿Cuántas facturas emites al mes?',
        optionsAutonomo: [
          { value: 'bajo', label: 'Hasta 10 facturas' },
          { value: 'medio', label: 'De 10 a 25 facturas' },
          { value: 'alto', label: 'Más de 25 facturas' },
        ],
        optionsPyme: [
          { value: 't1', label: 'Hasta 25 facturas' },
          { value: 't2', label: 'De 25 a 50 facturas' },
          { value: 't3', label: 'De 50 a 75 facturas' },
          { value: 't4', label: 'Más de 75 facturas' },
        ],
      },
      stepReporting: {
        q: '¿Quieres reporting y dashboards de tu negocio?',
        options: [
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
          { value: 'nose', label: 'No lo tengo claro' },
        ],
      },
      resultEyebrow: 'Tu presupuesto',
      priceUnit: 'al mes, IVA incluido',
      quoteLabel: 'Presupuesto nº',
      breakdownBaseAutonomo: 'Cuota base, autónomo',
      breakdownBaseSl: 'Cuota base, SL y pymes',
      breakdownReporting: 'Reporting y dashboards *',
      breakdownReportingNose: 'Reporting y dashboards, opcional (no incluido en el total) *',
      breakdownIva: 'IVA (21%)',
      breakdownTotal: 'Total',
      monthlyNote: 'Precio mensual. Sin permanencia.',
      reportingExplain: '* A diferencia de otras gestorías, llevar una contabilidad enfocada al negocio y no solo a la presentación de impuestos nos permite hacer un seguimiento del estado de salud de tu empresa, para ayudarte a tomar mejores decisiones y no tener sustos financieros.',
      ctaCall: 'Reservar llamada',
      contactAlt: 'O escríbenos a',
      restart: 'Volver a calcular',
      back: '← Atrás',
      error: 'No hemos podido generar tu número de presupuesto. Prueba de nuevo o escríbenos directamente.',
      loading: 'Calculando…',
    },

    blog: {
      eyebrow: 'FAQs',
      title: 'Preguntas frecuentes: Respuestas transparentes',
      sub: 'FAQs y artículos sobre fiscalidad',
      postsTitle: 'Artículos',
      readMore: 'Leer artículo →',
      backToBlog: '← Volver a FAQs',
      searchPlaceholder: 'Busca tu pregunta (ej. "IVA", "coche", "SL"...)',
      searchEmpty: 'No hemos encontrado ninguna pregunta con eso. Prueba con otra palabra o escríbenos.',
      faqAutonomos: 'Autónomos',
      faqAutonomosItems: [
        { q: '¿Cuánto tarda el alta como autónomo?', a: 'Un día laborable, si tienes la documentación lista.' },
        { q: '¿Módulos o estimación directa?', a: 'Depende de tu actividad. Te lo explicamos en la primera llamada.' },
        { q: '¿Y si un trimestre no facturo nada?', a: 'Presentamos el modelo a cero. Va incluido en la cuota.' },
        { q: '¿La renta entra en la cuota?', a: 'No, se factura aparte, desde 40 €.' },
        { q: '¿Puedo elegir estar en módulos si mi actividad lo permite?', a: 'Sí, si tu actividad está entre las permitidas y no superas los límites de facturación. Si no lo indicas al darte de alta, se aplica estimación directa por defecto.' },
        { q: '¿Qué diferencia hay entre el balance y la cuenta de resultados?', a: 'La cuenta de resultados dice si has ganado o perdido dinero en un periodo; el balance dice si tu negocio es solvente en un momento concreto.' },
        { q: '¿Con qué frecuencia debería revisar el balance de mi negocio?', a: 'Trimestral es un buen ritmo: da tiempo a detectar un cambio de tendencia sin reaccionar tarde.' },
        { q: '¿Por qué varía tanto el precio de una gestoría de un negocio a otro?', a: 'Depende de tu régimen fiscal, del volumen de facturas, de si tienes empleados y de si quieres reporting además de la presentación de impuestos.' },
        { q: '¿A partir de cuándo es obligatorio Verifactu?', a: '1 de enero de 2027 para sociedades y 1 de julio de 2027 para autónomos, según el Real Decreto-ley 15/2025 — no julio de 2026, que es la fecha que aún circula desactualizada.' },
        { q: '¿A quién afecta Verifactu?', a: 'Solo a quien factura con un programa informático (un SIF). Si facturas a mano o en papel, esta obligación concreta no te afecta.' },
      ],
      faqSl: 'SL y pymes',
      faqSlItems: [
        { q: '¿Lleváis la contabilidad de una SL?', a: 'Sí, si es una pyme con contabilidad simple.' },
        { q: '¿Gestionáis nóminas?', a: 'Gestión laboral básica sí. Con plantillas grandes, te derivamos a un especialista.' },
        { q: '¿Podéis con una SL que ya funciona?', a: 'Sí, nos encargamos del traspaso con tu gestoría actual.' },
        { q: '¿Ayudáis a constituir una SL?', a: 'Todavía no. Te asesoramos, pero la constitución la lleva un notario.' },
      ],
      askTitle: '¿No está tu pregunta?',
      askDesc: 'Escríbenos y te respondemos el mismo día. Además, la añadimos aquí para que le sirva a más gente.',
      close: 'Cerrar',
      faqShowMore: 'Ver {count} preguntas más',
      paginationLabel: 'Paginación',
      paginationPrev: '← Anteriores',
      paginationNext: 'Siguientes →',
      paginationPageOf: 'Página {current} de {total}',
    },

    equipo: {
      eyebrow: 'Quiénes somos',
      title: 'Dos personas, sin departamentos',
      tags: ['Economía y Estadística', 'Colegiados', '100% online'],
      p1: 'Cuando nos escribes, hablas con una de nosotras. No hay buzón general ni departamento que no te conoce.',
      p2: 'Nos formamos en economía y estadística. Una lleva la contabilidad, con años de experiencia previa en gestoría. El otro viene de trabajar en empresas de sectores muy distintos, y eso ayuda a mirar tu negocio más allá de los números.',
      p3: 'Estamos colegiados.',
      p4: 'Queremos ser la gestoría cercana que ayuda, no la que solo archiva papeles.',
    },

    footer: {
      tagline: 'Gestoría y asesoría 100% online, para autónomos y pymes de toda España.',
      navTitle: 'Navegación',
      contactTitle: 'Contacto',
      contactCall: 'Reservar llamada',
      whereTitle: 'Dónde estamos',
      whereOnline: 'Servicio 100% online',
      whereSpain: 'Toda España, excepto Canarias, Navarra y País Vasco (regímenes forales)',
      legal: 'Asesoría Madal — nombre provisional, boceto de marca. Empresa en fase de constitución.',
      portal: 'Área clientes',
      avisoLegal: 'Aviso legal',
      privacidad: 'Privacidad',
      cookies: 'Cookies',
    },

    privacidad: {
      eyebrow: 'Legal',
      title: 'Política de privacidad',
    },
  },

  ca: {
    nav: { home: 'Inici', simulador: 'Simulador', alta: 'Altes', blog: 'FAQs', equipo: 'Qui som' },
    header: { cta: 'Reserva una trucada', portal: 'Àrea clients' },
    contact: {
      trigger: 'Contacta amb nosaltres',
      emailLabel: 'Escriu-nos per correu:',
      email: 'contacto@asesoriamadal.es',
      guarantee: 'Et responem en menys de 24h garantit',
      orLabel: 'O si ho prefereixes:',
      callLabel: 'Reserva una trucada',
      closing: 'Tria el que et resulti més còmode, correu o trucada: t’atenem amb la mateixa proximitat.',
    },

    hero: {
      eyebrow: 'Gestoria online per a autònoms i pimes',
      title: 'Presentem els teus impostos, te’ls expliquem tot i seguim en contacte amb tu.',
      dek: 'Comptabilitat per a autònoms i pimes, 100% online. Presentem els teus impostos cada trimestre i t’expliquem, pas a pas, què signifiquen els teus números.',
      priceLabel: 'Quota',
      priceAmount: 'des de 48,40 €',
      priceUnit: '/mes, IVA inclòs',
      priceClaim: 'Inclou totes les teves consultes i dubtes, sense sorpreses ni lletra petita.',
      ctaSim: 'Simula el teu preu',
      ctaCall: 'Reserva una trucada',
      trust: 'A tot Espanya, excepte Canàries, Navarra i el País Basc (tenen règims fiscals propis).',
    },

    diferencia: {
      eyebrow: 'La diferència',
      title: 'Una gestoria que només presenta impostos, i una altra que t’ajuda a créixer',
      sub: 'Una gestoria qualsevol es limita a presentar els teus models a temps. Nosaltres te’ls presentem, te’ls expliquem, i t’ajudem a fer créixer el teu negoci.',
      colTraditional: 'Gestoria tradicional',
      colOnline: 'Gestoria online habitual',
      colMadal: 'Asesoría Madal',
      rows: [
        { trad: 'Poca digitalització', online: '100% digital', madal: '100% digital, amb tracte proper' },
        { trad: 'Només presenta els teus impostos', online: 'Presenta els teus impostos', madal: 'Presentem els teus impostos i t’expliquem què diuen els números' },
        { trad: 'Només es comunica quan truques tu', online: 'Només automatitzacions, sense tracte directe amb persones', madal: 'Comunicació activa i continuada: som el teu referent fiscal' },
        { trad: 'Preu elevat', online: '100% digital, 0% personalitzat', madal: 'T’enviem el teu balanç i compte de resultats explicats cada trimestre' },
        { trad: '', online: '', madal: 'Reporting i dades ajustades a les teves necessitats, perquè decideixis millor' },
        { trad: '', online: '', madal: 'Volem créixer amb la teva empresa: si a tu et va bé, a nosaltres també' },
      ],
    },

    proceso: {
      eyebrow: 'Com comencem',
      title: 'Tres passos i ja tens gestoria',
      steps: [
        { title: 'Reserva una trucada de 20 minuts', desc: 'Ens expliques la teva activitat i resolem dubtes. Sense compromís.' },
        { title: 'Confirmem la teva quota i donem d’alta el teu expedient', desc: 'Tràmits i apoderaments inclosos.' },
        { title: 'Cada trimestre, presentem i t’assessorem perquè el teu negoci millori', desc: 'Models presentats a temps, amb el teu balanç i compte de resultats explicats perquè decideixis amb dades, no a cegues.' },
      ],
    },

    precios: {
      eyebrow: 'Tarifes',
      title: 'Preus públics, sense lletra petita',
      sub: 'Preus amb IVA inclòs. Xifres orientatives mentre tanquem la web definitiva.',
      ivaLabel: 'IVA inclòs',
      rows: [
        { title: 'Autònom', amount: 'des de 48,40 €', unit: '/mes', incl: 'Trimestrals d’IVA i IRPF · Balanç trimestral · Declaració de la renda inclosa' },
        { title: 'SL i pimes', amount: 'des de 121 €', unit: '/mes', incl: 'Balanç trimestral' },
      ],
      note: 'Reporting i dashboards: +36,30 €/mes, IVA inclòs, opcional. Sense permanència.',
    },

    alta: {
      title: 'Et donaràs d’alta com a autònom?',
      desc: 'Ens encarreguem del paperam. Pagues la tarifa d’alta i el primer mes de gestoria va gratis.',
      price: 'Alta des de 59,29 €',
      priceNote: '+ 1r mes de quota, gratis · IVA inclòs',
      link: 'Veure com funciona →',
    },

    altaPage: {
      eyebrow: 'Alta ràpida',
      title: 'Alta d’autònoms en menys de 3 dies',
      intro: 'Ens encarreguem de tot el paperam perquè puguis començar a facturar com més aviat millor. Pagues la tarifa d’alta i el primer mes de gestoria ja va inclòs, gratis.',
      autonomos: {
        title: 'Si et donaràs d’alta com a autònom',
        desc: 'Presentem la teva alta a Hisenda i al RETA de la Seguretat Social.',
        steps: [
          { title: 'Ens expliques la teva activitat', desc: 'Per trucada o per correu, sense compromís.' },
          { title: 'Ens envies el teu DNI i les dades bàsiques', desc: 'Les que calguin segons la teva activitat.' },
          { title: 'Presentem l’alta', desc: 'A Hisenda (cens d’activitats) i a la Seguretat Social (RETA).' },
        ],
      },
      timeline: 'En menys de 3 dies tens l’alta feta i ja pots facturar, amb el primer mes de gestoria inclòs.',
      price: 'Alta des de 59,29 €',
      priceNote: '+ 1r mes de quota, gratis · IVA inclòs',
      ctaCall: 'Reserva una trucada',
    },

    blogTeaser: { text: 'T’expliquem els teus impostos sense tecnicismes.', link: 'Veure el blog →' },

    ctaFinal: {
      title: 'Parla amb nosaltres abans de decidir res',
      ctaCall: 'Reserva una trucada de 20 minuts',
      ctaMail: 'Escriu-nos per correu',
      fine: 'Sense compromís · Resposta en menys de 24 h',
    },

    sim: {
      eyebrow: 'Simulador de preu',
      title: 'Quant et costaria amb Asesoría Madal?',
      sub: 'Tres preguntes i tens el teu pressupost. Ho confirmem a la trucada.',
      stepRegimen: {
        q: 'Ets autònom o tens una SL/pime?',
        options: [
          { value: 'autonomo', label: 'Autònom' },
          { value: 'pyme', label: 'SL o pime' },
        ],
      },
      stepFacturas: {
        q: 'Quantes factures emets al mes?',
        optionsAutonomo: [
          { value: 'bajo', label: 'Fins a 10 factures' },
          { value: 'medio', label: 'De 10 a 25 factures' },
          { value: 'alto', label: 'Més de 25 factures' },
        ],
        optionsPyme: [
          { value: 't1', label: 'Fins a 25 factures' },
          { value: 't2', label: 'De 25 a 50 factures' },
          { value: 't3', label: 'De 50 a 75 factures' },
          { value: 't4', label: 'Més de 75 factures' },
        ],
      },
      stepReporting: {
        q: 'Vols reporting i dashboards del teu negoci?',
        options: [
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
          { value: 'nose', label: 'No ho tinc clar' },
        ],
      },
      resultEyebrow: 'El teu pressupost',
      priceUnit: 'al mes, IVA inclòs',
      quoteLabel: 'Pressupost núm.',
      breakdownBaseAutonomo: 'Quota base, autònom',
      breakdownBaseSl: 'Quota base, SL i pimes',
      breakdownReporting: 'Reporting i dashboards *',
      breakdownReportingNose: 'Reporting i dashboards, opcional (no inclòs al total) *',
      breakdownIva: 'IVA (21%)',
      breakdownTotal: 'Total',
      monthlyNote: 'Preu mensual. Sense permanència.',
      reportingExplain: '* A diferència d’altres gestories, portar una comptabilitat enfocada al negoci i no només a la presentació d’impostos ens permet fer un seguiment de l’estat de salut de la teva empresa, per ajudar-te a prendre millors decisions i no tenir ensurts financers.',
      ctaCall: 'Reserva una trucada',
      contactAlt: 'O escriu-nos a',
      restart: 'Tornar a calcular',
      back: '← Enrere',
      error: 'No hem pogut generar el teu número de pressupost. Torna-ho a provar o escriu-nos directament.',
      loading: 'Calculant…',
    },

    blog: {
      eyebrow: 'FAQs',
      title: 'Preguntes freqüents: Respostes transparents',
      sub: 'FAQs i articles sobre fiscalitat',
      postsTitle: 'Articles',
      readMore: 'Llegir l’article →',
      backToBlog: '← Tornar a les FAQ',
      searchPlaceholder: 'Busca la teva pregunta (ex. "IVA", "cotxe", "SL"...)',
      searchEmpty: 'No hem trobat cap pregunta amb això. Prova amb una altra paraula o escriu-nos.',
      faqAutonomos: 'Autònoms',
      faqAutonomosItems: [
        { q: 'Quant triga l’alta com a autònom?', a: 'Un dia laborable, si tens la documentació preparada.' },
        { q: 'Mòduls o estimació directa?', a: 'Depèn de la teva activitat. T’ho expliquem a la primera trucada.' },
        { q: 'I si un trimestre no facturo res?', a: 'Presentem el model a zero. Va inclòs a la quota.' },
        { q: 'La renda entra a la quota?', a: 'No, es factura a part, des de 40 €.' },
        { q: 'Puc estar en mòduls si la meva activitat ho permet?', a: 'Sí, si la teva activitat és de les permeses i no superes els límits de facturació. Si no ho indiques en donar-te d’alta, s’aplica estimació directa per defecte.' },
        { q: 'Quina diferència hi ha entre el balanç i el compte de resultats?', a: 'El compte de resultats diu si has guanyat o perdut diners en un període; el balanç diu si el teu negoci és solvent en un moment concret.' },
        { q: 'Amb quina freqüència hauria de revisar el balanç del meu negoci?', a: 'Trimestral és un bon ritme: dona temps a detectar un canvi de tendència sense reaccionar tard.' },
        { q: 'Per què varia tant el preu d’una gestoria d’un negoci a un altre?', a: 'Depèn del teu règim fiscal, del volum de factures, de si tens empleats i de si vols reporting a més de la presentació d’impostos.' },
        { q: 'A partir de quan és obligatori Verifactu?', a: '1 de gener de 2027 per a societats i 1 de juliol de 2027 per a autònoms, segons el Reial decret llei 15/2025 — no juliol de 2026, que és la data que encara circula desactualitzada.' },
        { q: 'A qui afecta Verifactu?', a: 'Només a qui factura amb un programa informàtic (un SIF). Si factures a mà o en paper, aquesta obligació concreta no t’afecta.' },
      ],
      faqSl: 'SL i pimes',
      faqSlItems: [
        { q: 'Porteu la comptabilitat d’una SL?', a: 'Sí, si és una pime amb comptabilitat simple.' },
        { q: 'Gestioneu nòmines?', a: 'Gestió laboral bàsica sí. Amb plantilles grans, et derivem a un especialista.' },
        { q: 'Podeu amb una SL que ja funciona?', a: 'Sí, ens encarreguem del traspàs amb la teva gestoria actual.' },
        { q: 'Ajudeu a constituir una SL?', a: 'Encara no. T’assessorem, però la constitució la porta un notari.' },
      ],
      askTitle: 'No hi és la teva pregunta?',
      askDesc: 'Escriu-nos i et responem el mateix dia. A més, l’afegim aquí perquè serveixi a més gent.',
      close: 'Tancar',
      faqShowMore: 'Veure {count} preguntes més',
      paginationLabel: 'Paginació',
      paginationPrev: '← Anteriors',
      paginationNext: 'Següents →',
      paginationPageOf: 'Pàgina {current} de {total}',
    },

    equipo: {
      eyebrow: 'Qui som',
      title: 'Dues persones, sense departaments',
      tags: ['Economia i Estadística', 'Col·legiats', '100% online'],
      p1: 'Quan ens escrius, parles amb una de nosaltres. No hi ha bústia general ni departament que no et conegui.',
      p2: 'Ens vam formar en economia i estadística. Una porta la comptabilitat, amb anys d’experiència prèvia en gestoria. L’altre ve de treballar en empreses de sectors molt diferents, i això ajuda a mirar el teu negoci més enllà dels números.',
      p3: 'Estem col·legiats.',
      p4: 'Volem ser la gestoria propera que ajuda, no la que només arxiva papers.',
    },

    footer: {
      tagline: 'Gestoria i assessoria 100% online, per a autònoms i pimes de tot Espanya.',
      navTitle: 'Navegació',
      contactTitle: 'Contacte',
      contactCall: 'Reserva una trucada',
      whereTitle: 'On som',
      whereOnline: 'Servei 100% online',
      whereSpain: 'A tot Espanya, excepte Canàries, Navarra i el País Basc (règims forals)',
      legal: 'Asesoría Madal — nom provisional, esbós de marca. Empresa en fase de constitució.',
      portal: 'Àrea clients',
      avisoLegal: 'Avís legal',
      privacidad: 'Privadesa',
      cookies: 'Cookies',
    },

    privacidad: {
      eyebrow: 'Legal',
      title: 'Política de privadesa',
    },
  },

  en: {
    nav: { home: 'Home', simulador: 'Price simulator', alta: 'Registration', blog: 'FAQs', equipo: 'About us' },
    header: { cta: 'Book a call', portal: 'Client area' },
    contact: {
      trigger: 'Contact us',
      emailLabel: 'Email us at:',
      email: 'contacto@asesoriamadal.es',
      guarantee: 'We reply within 24h, guaranteed',
      orLabel: "Or if you'd rather:",
      callLabel: 'Book a call',
      closing: 'Pick whatever works best for you, email or a call: you get the same personal attention either way.',
    },

    hero: {
      eyebrow: 'Online accounting for freelancers and small businesses',
      title: 'We file your taxes, explain everything clearly, and stay in touch with you.',
      dek: 'Accounting for freelancers and small businesses in Spain, fully online. We file your taxes every quarter and explain, step by step, what your numbers mean.',
      priceLabel: 'Fee',
      priceAmount: 'from €48.40',
      priceUnit: '/month, VAT included',
      priceClaim: 'Includes every question and call you need, no surprises, no fine print.',
      ctaSim: 'Get your price',
      ctaCall: 'Book a call',
      trust: 'All of Spain, except the Canary Islands, Navarre, and the Basque Country (they have their own regional tax systems).',
    },

    diferencia: {
      eyebrow: 'The difference',
      title: 'One firm just files your taxes. The other helps you grow.',
      sub: 'A typical accounting firm just files your tax forms on time. We file them, explain them, and help your business grow.',
      colTraditional: 'Traditional accounting firm',
      colOnline: 'Typical online accounting firm',
      colMadal: 'Asesoría Madal',
      rows: [
        { trad: 'Little digitalization', online: '100% digital', madal: '100% digital, with a personal touch' },
        { trad: 'Just files your taxes', online: 'Files your taxes', madal: 'Files your taxes and explains what the numbers mean' },
        { trad: 'Only talks to you when you call', online: 'Automated messages only, no direct contact with a person', madal: 'Active, ongoing communication: we’re your go-to for tax questions' },
        { trad: 'High fees', online: '100% digital, 0% personalized', madal: 'We send you your balance sheet and P&L, explained, every quarter' },
        { trad: '', online: '', madal: 'Reporting and data tailored to your needs, to help you decide' },
        { trad: '', online: '', madal: 'We want to grow with your business: if you do well, so do we' },
      ],
    },

    proceso: {
      eyebrow: 'How we start',
      title: 'Three steps and you have an accounting firm',
      steps: [
        { title: 'Book a 20-minute call', desc: 'Tell us about your business and get your questions answered. No commitment.' },
        { title: 'We confirm your fee and open your file', desc: 'Paperwork and power of attorney included.' },
        { title: 'Every quarter, we file and advise you on how to improve', desc: 'Forms filed on time, with your balance sheet and P&L explained so you decide with data, not guesswork.' },
      ],
    },

    precios: {
      eyebrow: 'Pricing',
      title: 'Public pricing, no fine print',
      sub: 'Prices include VAT. Figures are indicative while we finalize the site.',
      ivaLabel: 'VAT included',
      rows: [
        { title: 'Freelancer', amount: 'from €48.40', unit: '/month', incl: 'Quarterly VAT & income tax filings · Quarterly balance sheet · Annual income tax return included' },
        { title: 'SL and small businesses', amount: 'from €121', unit: '/month', incl: 'Quarterly balance sheet' },
      ],
      note: 'Reporting & dashboards: +€36.30/month, VAT included, optional. No lock-in.',
    },

    alta: {
      title: 'Registering as a freelancer?',
      desc: 'We handle the paperwork. You pay the registration fee, and your first month of accounting is free.',
      price: 'Registration from €59.29',
      priceNote: '+ 1st month free · VAT included',
      link: 'See how it works →',
    },

    altaPage: {
      eyebrow: 'Fast registration',
      title: 'Freelancer registration in under 3 days',
      intro: 'We handle the paperwork so you can start invoicing as soon as possible. You pay the registration fee, and your first month of accounting is already included, free.',
      autonomos: {
        title: 'If you’re registering as a freelancer',
        desc: 'We file your registration with the Spanish Tax Agency and with Social Security (RETA).',
        steps: [
          { title: 'Tell us about your activity', desc: 'By call or email, no commitment.' },
          { title: 'Send us your ID and basic details', desc: 'Whatever your specific activity requires.' },
          { title: 'We file the registration', desc: 'With the Tax Agency and with Social Security (RETA).' },
        ],
      },
      timeline: 'In under 3 days your registration is done and you can start invoicing, with your first month of accounting included.',
      price: 'Registration from €59.29',
      priceNote: '+ 1st month free · VAT included',
      ctaCall: 'Book a call',
    },

    blogTeaser: { text: 'We explain your taxes without the jargon.', link: 'Read the blog →' },

    ctaFinal: {
      title: 'Talk to us before deciding anything',
      ctaCall: 'Book a 20-minute call',
      ctaMail: 'Email us',
      fine: 'No commitment · We reply within 24 h',
    },

    sim: {
      eyebrow: 'Price simulator',
      title: 'How much would Asesoría Madal cost you?',
      sub: 'Three questions and you get your quote. We confirm it on the call.',
      stepRegimen: {
        q: 'Are you a freelancer, or do you have an SL?',
        options: [
          { value: 'autonomo', label: 'Freelancer' },
          { value: 'pyme', label: 'SL or small business' },
        ],
      },
      stepFacturas: {
        q: 'How many invoices do you issue per month?',
        optionsAutonomo: [
          { value: 'bajo', label: 'Up to 10 invoices' },
          { value: 'medio', label: '10 to 25 invoices' },
          { value: 'alto', label: 'More than 25 invoices' },
        ],
        optionsPyme: [
          { value: 't1', label: 'Up to 25 invoices' },
          { value: 't2', label: '25 to 50 invoices' },
          { value: 't3', label: '50 to 75 invoices' },
          { value: 't4', label: 'More than 75 invoices' },
        ],
      },
      stepReporting: {
        q: 'Do you want reporting and dashboards for your business?',
        options: [
          { value: 'si', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'nose', label: 'Not sure yet' },
        ],
      },
      resultEyebrow: 'Your quote',
      priceUnit: 'per month, VAT included',
      quoteLabel: 'Quote No.',
      breakdownBaseAutonomo: 'Base fee, freelancer',
      breakdownBaseSl: 'Base fee, SL and small businesses',
      breakdownReporting: 'Reporting and dashboards *',
      breakdownReportingNose: 'Reporting and dashboards, optional (not included in the total) *',
      breakdownIva: 'VAT (21%)',
      breakdownTotal: 'Total',
      monthlyNote: 'Monthly price. No lock-in.',
      reportingExplain: '* Unlike other accounting firms, keeping accounts focused on your business, not just on filing taxes, lets us track your company’s financial health, to help you make better decisions and avoid financial surprises.',
      ctaCall: 'Book a call',
      contactAlt: 'Or email us at',
      restart: 'Recalculate',
      back: '← Back',
      error: 'We couldn’t generate your quote number. Try again or email us directly.',
      loading: 'Calculating…',
    },

    blog: {
      eyebrow: 'FAQs',
      title: 'Frequently asked questions: Transparent answers',
      sub: 'FAQs and articles about taxes',
      postsTitle: 'Articles',
      readMore: 'Read article →',
      backToBlog: '← Back to FAQs',
      searchPlaceholder: 'Search your question (e.g. "VAT", "car", "SL"...)',
      searchEmpty: 'No questions matched that. Try another word, or write to us.',
      faqAutonomos: 'Freelancers',
      faqAutonomosItems: [
        { q: 'How long does freelancer registration take?', a: 'One business day, if your paperwork is ready.' },
        { q: 'Flat-rate or direct estimation regime?', a: 'It depends on your activity. We explain it on the first call.' },
        { q: 'What if I don’t invoice anything in a quarter?', a: 'We file a zero return. It’s included in your fee.' },
        { q: 'Is the annual income tax return included?', a: 'No, it’s billed separately, from €40.' },
        { q: 'Can I opt for the flat-rate (módulos) regime if my activity qualifies?', a: 'Yes, if your activity is on the allowed list and you stay under the invoicing limits. If you don’t request it when registering, direct estimation applies by default.' },
        { q: 'What’s the difference between a balance sheet and a profit and loss statement?', a: 'The profit and loss statement shows whether you made or lost money over a period; the balance sheet shows whether your business is solvent at a specific moment.' },
        { q: 'How often should I check my business’s balance sheet?', a: 'Quarterly is a good rhythm — enough time to spot a trend without reacting too late.' },
        { q: 'Why does the price of an accounting firm vary so much between businesses?', a: 'It depends on your tax regime, how many invoices you issue, whether you have employees, and whether you want reporting on top of tax filing.' },
        { q: 'When does Verifactu actually become mandatory?', a: '1 January 2027 for companies and 1 July 2027 for freelancers, per Royal Decree-Law 15/2025 — not July 2026, which is the outdated date still circulating.' },
        { q: 'Who does Verifactu affect?', a: 'Only people who invoice through billing software (a SIF). If you invoice by hand or on paper, this specific obligation doesn’t apply to you.' },
      ],
      faqSl: 'Companies (SL)',
      faqSlItems: [
        { q: 'Do you handle accounting for an SL?', a: 'Yes, if it’s a company with simple accounting.' },
        { q: 'Do you manage payroll?', a: 'Basic payroll, yes. For larger teams, we refer you to a specialist.' },
        { q: 'Can you take over an SL that’s already running?', a: 'Yes, we handle the handover with your current accounting firm.' },
        { q: 'Do you help incorporate an SL?', a: 'Not yet. We advise you, but incorporation is handled by a notary.' },
      ],
      askTitle: 'Don’t see your question?',
      askDesc: 'Email us and we’ll reply the same day. We’ll also add it here so it helps other people too.',
      close: 'Close',
      faqShowMore: 'Show {count} more questions',
      paginationLabel: 'Pagination',
      paginationPrev: '← Previous',
      paginationNext: 'Next →',
      paginationPageOf: 'Page {current} of {total}',
    },

    equipo: {
      eyebrow: 'About us',
      title: 'Two people, no departments',
      tags: ['Economics & Statistics', 'Registered professionals', '100% online'],
      p1: 'When you write to us, you talk to one of us directly. No general inbox, no department that doesn’t know you.',
      p2: 'We both studied economics and statistics. One of us runs the accounting side, with years of prior experience at an accounting firm. The other has worked across very different kinds of companies, which helps in looking at your business beyond the numbers.',
      p3: 'We’re registered with our professional association.',
      p4: 'We want to be the accounting firm that actually helps, not the one that just files paperwork.',
    },

    footer: {
      tagline: 'Fully online accounting and advisory for freelancers and small businesses across Spain.',
      navTitle: 'Navigation',
      contactTitle: 'Contact',
      contactCall: 'Book a call',
      whereTitle: 'Where we are',
      whereOnline: '100% online service',
      whereSpain: 'All of Spain, except the Canary Islands, Navarre, and the Basque Country (regional tax systems)',
      legal: 'Asesoría Madal — provisional name, brand sketch. Company in the process of incorporation.',
      portal: 'Client area',
      avisoLegal: 'Legal notice',
      privacidad: 'Privacy',
      cookies: 'Cookies',
    },

    privacidad: {
      eyebrow: 'Legal',
      title: 'Privacy policy',
    },
  },
} as const;
