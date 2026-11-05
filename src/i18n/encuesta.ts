// Textos de la encuesta de satisfacción (2026-11-05), igual que
// formularioTrabajador.ts: fichero propio en vez de ui.ts porque es una
// página suelta, sin enlazar desde el menú, mandada por enlace directo
// (?id=<uuid de encuestas_satisfaccion>) y disponible en los tres idiomas.
export type EncuestaLang = 'es' | 'ca' | 'en';

export const ENCUESTA: Record<EncuestaLang, Record<string, string>> = {
  es: {
    metaTitle: 'Tu opinión — Asesoría Madal',
    metaDesc: 'Cuéntanos qué tal estás con nosotros.',
    eyebrow: 'Tu opinión',
    title: '¿Qué tal estás con nosotros?',
    intro: 'Dos minutos, nada más: una puntuación y, si quieres, un comentario. Nos ayuda a saber qué estamos haciendo bien y qué podemos mejorar.',
    estrellasLabel: 'Tu puntuación',
    comentarioLabel: 'Comentario (opcional)',
    comentarioPlaceholder: 'Lo que quieras contarnos — qué va bien, qué cambiarías...',
    enviar: 'Enviar',
    error: 'No se ha podido enviar. Inténtalo de nuevo o escríbenos a ',
    errorSinPuntuacion: 'Elige una puntuación de 1 a 5 antes de enviar.',
    errorNoValido: 'Este enlace ya no es válido o ya has respondido. Si quieres contarnos algo, escríbenos a ',
    recibido: 'Gracias',
    gracias: 'Recibido, gracias por tu tiempo',
    graciasSub: 'Tu opinión nos ayuda de verdad. Si alguna vez quieres contarnos algo más, ya sabes dónde estamos.',
  },
  ca: {
    metaTitle: 'La teva opinió — Asesoría Madal',
    metaDesc: 'Explica’ns com estàs amb nosaltres.',
    eyebrow: 'La teva opinió',
    title: 'Com estàs amb nosaltres?',
    intro: 'Dos minuts, res més: una puntuació i, si vols, un comentari. Ens ajuda a saber què estem fent bé i què podem millorar.',
    estrellasLabel: 'La teva puntuació',
    comentarioLabel: 'Comentari (opcional)',
    comentarioPlaceholder: 'El que vulguis explicar-nos — què va bé, què canviaries...',
    enviar: 'Enviar',
    error: 'No s’ha pogut enviar. Torna-ho a provar o escriu-nos a ',
    errorSinPuntuacion: 'Tria una puntuació d’1 a 5 abans d’enviar.',
    errorNoValido: 'Aquest enllaç ja no és vàlid o ja has respost. Si vols explicar-nos alguna cosa, escriu-nos a ',
    recibido: 'Gràcies',
    gracias: 'Rebut, gràcies pel teu temps',
    graciasSub: 'La teva opinió ens ajuda de veritat. Si mai vols explicar-nos alguna cosa més, ja saps on som.',
  },
  en: {
    metaTitle: 'Your feedback — Asesoría Madal',
    metaDesc: 'Tell us how things are going with us.',
    eyebrow: 'Your feedback',
    title: 'How are things going with us?',
    intro: "Two minutes, nothing more: a rating and, if you'd like, a comment. It helps us know what we're doing well and what we can improve.",
    estrellasLabel: 'Your rating',
    comentarioLabel: 'Comment (optional)',
    comentarioPlaceholder: "Anything you'd like to tell us — what's working, what you'd change...",
    enviar: 'Send',
    error: "Couldn't be sent. Try again or write to us at ",
    errorSinPuntuacion: 'Choose a rating from 1 to 5 before sending.',
    errorNoValido: "This link is no longer valid, or you've already replied. If you'd like to tell us something, write to us at ",
    recibido: 'Thank you',
    gracias: 'Received, thanks for your time',
    graciasSub: "Your feedback really helps us. If you'd ever like to tell us more, you know where to find us.",
  },
};
