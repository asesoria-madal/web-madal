// Textos del formulario de respuesta a los borradores de impuestos (Borradores.astro), en castellano, catalán e inglés.
// Lo abre el cliente desde el correo «Tus impuestos del …» que manda n8n («Enviar borradores»), con /borradores?t=<token>.
// Los consejos de pago se comprobaron con NotebookLM (fuentes: LGT y AEAT) el 2026-11-27:
//  - no se pueden aplazar las retenciones (111, 115, 123; art. 65.2.b LGT) ni los pagos fraccionados del Impuesto sobre
//    Sociedades (202; art. 65.2.g); sí el IVA (303) y los pagos fraccionados del IRPF (130, 131);
//  - si el cargo domiciliado falla, la deuda pasa a periodo ejecutivo con recargo del 5 % (art. 28);
//  - presentar en plazo pidiendo aplazamiento no lleva recargo: solo interés de demora (4,0625 % en 2026) y se puede
//    pagar antes (art. 65.5 y 26.6);
//  - presentar fuera de plazo sin requerimiento: 1 % más 1 % por mes completo (art. 27); si Hacienda requiere antes,
//    hay sanción.
// Catalán e inglés: primer borrador sin revisión nativa, como el resto de la web.

export type BorradoresLang = 'es' | 'ca' | 'en';

export const RUTA_BORRADORES: Record<BorradoresLang, string> = { es: '/borradores', ca: '/ca/borradores', en: '/en/borradores' };

const es = {
  metaTitle: 'Tus impuestos del trimestre · Asesoría Madal',
  metaDesc: 'Revisa los borradores de tus impuestos y dinos cómo quieres pagarlos.',
  eyebrow: 'Impuestos del trimestre',
  titulo: (t: number, a: number) => `Tus impuestos del ${t}T de ${a}`,
  intro: 'Te hemos preparado los borradores (los tienes en el correo). Revísalos y dinos, en cada uno, qué quieres hacer.',
  limite: (fecha: string) => `Respóndenos antes del ${fecha}. Si no nos dices nada, lo presentaremos de la forma que mejor encaje según el importe.`,
  cargando: 'Cargando…',
  noValido: 'Este enlace no es válido. Usa el del último correo que te hemos enviado o escríbenos.',
  caducado: 'Este enlace es de un envío anterior. Usa el del último correo que te hemos enviado.',
  nombres: {
    '303': 'IVA (modelo 303)', '130': 'Pago fraccionado del IRPF (modelo 130)', '131': 'Pago fraccionado del IRPF, módulos (modelo 131)',
    '111': 'Retenciones de profesionales y trabajadores (modelo 111)', '115': 'Retenciones del alquiler (modelo 115)',
    '123': 'Retenciones del capital mobiliario (modelo 123)', '202': 'Pago fraccionado del Impuesto sobre Sociedades (modelo 202)',
    '349': 'Operaciones intracomunitarias (modelo 349, informativo)',
  } as Record<string, string>,
  resultado: {
    ingresar: (i: string) => `A pagar: ${i}`,
    devolver: (i: string) => `A devolver: ${i}`,
    compensar: (i: string) => `A compensar: ${i}. No pagas nada: se descuenta de los próximos trimestres.`,
    cero: () => 'Sale a cero: no pagas nada.',
  },
  opciones: {
    domiciliar: 'Domiciliarlo: Hacienda lo cargará en tu cuenta el último día del plazo',
    aplazar: 'Aplazarlo',
    conforme: 'De acuerdo',
    mal: 'Veo algo mal o tengo dudas',
  },
  meses: 'Meses',
  mesesUno: '1 mes',
  mesesVarios: (n: number) => `${n} meses`,
  noAplazable: 'Este impuesto no se puede aplazar.',
  comentarioModelo: '¿Qué ves mal o qué dudas tienes?',
  devolverNota: 'Hacienda lo ingresa en la cuenta que consta en la declaración. Si quieres otra, dínoslo en el comentario.',
  consejosTitulo: 'Antes de elegir',
  consejos: [
    'Domicilia solo si tendrás saldo el último día del plazo. Si el cargo falla, Hacienda añade un recargo del 5 %.',
    'Si te falta dinero y el impuesto se puede aplazar, aplazarlo es lo más barato: lo presentamos en plazo, sin recargo, y solo pagas intereses de demora (un 4 % anual, aproximadamente) por el tiempo del aplazamiento. Puedes pagarlo antes cuando quieras: avísanos y lo adelantamos.',
    'Las retenciones (111, 115 y 123) y el pago fraccionado del Impuesto sobre Sociedades (202) no se pueden aplazar. Si no tendrás el dinero a tiempo, dínoslo: puede salir más barato presentarlo unos días tarde (recargo del 1 %, y un 1 % más por cada mes completo) que domiciliarlo sin saldo (5 %).',
  ],
  comentarioGeneral: 'Algo más que quieras decirnos',
  opcional: '(opcional)',
  enviar: 'Enviar respuesta',
  enviando: 'Enviando…',
  faltaOpcion: (m: string) => `Elige qué quieres hacer con el ${m}.`,
  faltaComentario: (m: string) => `Cuéntanos qué ves mal en el ${m}.`,
  faltaMeses: (m: string) => `Elige en cuántos meses quieres aplazar el ${m}.`,
  error: 'No se ha podido enviar. Vuelve a probar o escríbenos a contacto@asesoriamadal.es.',
  graciasTitulo: '¡Gracias! Ya tenemos tu respuesta',
  graciasSub: 'Lo presentaremos como nos has dicho. Si has marcado alguna duda, te escribimos antes de presentar nada.',
  yaRespondido: (fecha: string) => `Nos respondiste el ${fecha}. Si quieres cambiar algo, hazlo y vuelve a enviarlo.`,
};

type T = typeof es;

const ca: T = {
  metaTitle: 'Els teus impostos del trimestre · Asesoría Madal',
  metaDesc: 'Revisa els esborranys dels teus impostos i digues-nos com els vols pagar.',
  eyebrow: 'Impostos del trimestre',
  titulo: (t, a) => `Els teus impostos del ${t}T de ${a}`,
  intro: 'T’hem preparat els esborranys (els tens al correu). Revisa’ls i digues-nos, en cadascun, què vols fer.',
  limite: (fecha) => `Respon-nos abans del ${fecha}. Si no ens dius res, el presentarem de la manera que millor encaixi segons l’import.`,
  cargando: 'Carregant…',
  noValido: 'Aquest enllaç no és vàlid. Fes servir el de l’últim correu que t’hem enviat o escriu-nos.',
  caducado: 'Aquest enllaç és d’un enviament anterior. Fes servir el de l’últim correu que t’hem enviat.',
  nombres: {
    '303': 'IVA (model 303)', '130': 'Pagament fraccionat de l’IRPF (model 130)', '131': 'Pagament fraccionat de l’IRPF, mòduls (model 131)',
    '111': 'Retencions de professionals i treballadors (model 111)', '115': 'Retencions del lloguer (model 115)',
    '123': 'Retencions del capital mobiliari (model 123)', '202': 'Pagament fraccionat de l’Impost sobre Societats (model 202)',
    '349': 'Operacions intracomunitàries (model 349, informatiu)',
  },
  resultado: {
    ingresar: (i) => `A pagar: ${i}`,
    devolver: (i) => `A retornar: ${i}`,
    compensar: (i) => `A compensar: ${i}. No pagues res: es descompta dels propers trimestres.`,
    cero: () => 'Surt a zero: no pagues res.',
  },
  opciones: {
    domiciliar: 'Domiciliar-lo: Hisenda el carregarà al teu compte l’últim dia del termini',
    aplazar: 'Ajornar-lo',
    conforme: 'D’acord',
    mal: 'Hi veig alguna cosa malament o tinc dubtes',
  },
  meses: 'Mesos',
  mesesUno: '1 mes',
  mesesVarios: (n) => `${n} mesos`,
  noAplazable: 'Aquest impost no es pot ajornar.',
  comentarioModelo: 'Què hi veus malament o quins dubtes tens?',
  devolverNota: 'Hisenda l’ingressa al compte que consta a la declaració. Si en vols un altre, digues-nos-ho al comentari.',
  consejosTitulo: 'Abans de triar',
  consejos: [
    'Domicilia només si tindràs saldo l’últim dia del termini. Si el càrrec falla, Hisenda hi afegeix un recàrrec del 5 %.',
    'Si et falten diners i l’impost es pot ajornar, ajornar-lo és el més barat: el presentem dins de termini, sense recàrrec, i només pagues interessos de demora (un 4 % anual, aproximadament) pel temps de l’ajornament. El pots pagar abans quan vulguis: avisa’ns i l’avancem.',
    'Les retencions (111, 115 i 123) i el pagament fraccionat de l’Impost sobre Societats (202) no es poden ajornar. Si no tindràs els diners a temps, digues-nos-ho: pot sortir més barat presentar-lo uns dies tard (recàrrec de l’1 %, i un 1 % més per cada mes complet) que domiciliar-lo sense saldo (5 %).',
  ],
  comentarioGeneral: 'Alguna cosa més que ens vulguis dir',
  opcional: '(opcional)',
  enviar: 'Enviar la resposta',
  enviando: 'Enviant…',
  faltaOpcion: (m) => `Tria què vols fer amb el ${m}.`,
  faltaComentario: (m) => `Explica’ns què hi veus malament al ${m}.`,
  faltaMeses: (m) => `Tria en quants mesos vols ajornar el ${m}.`,
  error: 'No s’ha pogut enviar. Torna-ho a provar o escriu-nos a contacto@asesoriamadal.es.',
  graciasTitulo: 'Gràcies! Ja tenim la teva resposta',
  graciasSub: 'El presentarem com ens has dit. Si has marcat algun dubte, t’escriurem abans de presentar res.',
  yaRespondido: (fecha) => `Ens vas respondre el ${fecha}. Si vols canviar alguna cosa, fes-ho i torna-ho a enviar.`,
};

const en: T = {
  metaTitle: 'Your taxes for the quarter · Asesoría Madal',
  metaDesc: 'Review your tax return drafts and tell us how you want to pay them.',
  eyebrow: 'Taxes for the quarter',
  titulo: (t, a) => `Your taxes for Q${t} ${a}`,
  intro: 'We have prepared your tax return drafts (they are attached to our email). Please review them and tell us what you want to do with each one.',
  limite: (fecha) => `Please reply before ${fecha}. If we don’t hear from you, we will file them in the way that best fits the amount.`,
  cargando: 'Loading…',
  noValido: 'This link is not valid. Please use the one in our latest email or write to us.',
  caducado: 'This link belongs to an earlier email. Please use the one in our latest email.',
  nombres: {
    '303': 'VAT (form 303)', '130': 'Income tax instalment (form 130)', '131': 'Income tax instalment, flat-rate scheme (form 131)',
    '111': 'Withholdings on professionals and employees (form 111)', '115': 'Withholdings on rent (form 115)',
    '123': 'Withholdings on investment income (form 123)', '202': 'Corporate income tax instalment (form 202)',
    '349': 'Intra-EU transactions (form 349, information only)',
  },
  resultado: {
    ingresar: (i) => `To pay: ${i}`,
    devolver: (i) => `Refund: ${i}`,
    compensar: (i) => `To offset: ${i}. You pay nothing: it is deducted in the coming quarters.`,
    cero: () => 'Nil return: you pay nothing.',
  },
  opciones: {
    domiciliar: 'Direct debit: the tax office will charge your account on the last day of the deadline',
    aplazar: 'Defer payment',
    conforme: 'Agreed',
    mal: 'Something looks wrong or I have questions',
  },
  meses: 'Months',
  mesesUno: '1 month',
  mesesVarios: (n) => `${n} months`,
  noAplazable: 'This tax cannot be deferred.',
  comentarioModelo: 'What looks wrong, or what would you like to ask?',
  devolverNota: 'The tax office pays it into the account shown on the return. If you want a different one, tell us in the comment.',
  consejosTitulo: 'Before you choose',
  consejos: [
    'Only choose direct debit if you will have enough money on the last day of the deadline. If the charge fails, the tax office adds a 5% surcharge.',
    'If you are short of money and the tax can be deferred, deferring is the cheapest option: we file it on time, with no surcharge, and you only pay late-payment interest (about 4% a year) for the deferral period. You can pay it off early whenever you like: just let us know.',
    'Withholdings (111, 115 and 123) and the corporate income tax instalment (202) cannot be deferred. If you won’t have the money in time, tell us: filing a few days late (a 1% surcharge, plus 1% for each full month) can be cheaper than a direct debit that fails (5%).',
  ],
  comentarioGeneral: 'Anything else you’d like to tell us',
  opcional: '(optional)',
  enviar: 'Send my answer',
  enviando: 'Sending…',
  faltaOpcion: (m) => `Choose what you want to do with ${m}.`,
  faltaComentario: (m) => `Tell us what looks wrong in ${m}.`,
  faltaMeses: (m) => `Choose over how many months you want to defer ${m}.`,
  error: 'It could not be sent. Please try again or write to contacto@asesoriamadal.es.',
  graciasTitulo: 'Thank you! We have your answer',
  graciasSub: 'We will file as you told us. If you raised any question, we will write to you before filing anything.',
  yaRespondido: (fecha) => `You answered on ${fecha}. If you want to change anything, do it and send it again.`,
};

export const BORRADORES: Record<BorradoresLang, T> = { es, ca, en };
// Modelos que no se pueden aplazar (art. 65.2 LGT). Lo mismo en api/borrador.ts y en n8n "Enviar borradores".
export const NO_APLAZABLES = ['111', '115', '123', '202'];
