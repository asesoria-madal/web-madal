// ID de conversión de Google Ads (formato "AW-XXXXXXXXX"). Se deja vacío
// hasta que exista una cuenta de Google Ads real con conversión configurada.
// Mientras esté vacío: el banner de cookies (CookieConsent.astro) no se
// muestra y no se carga ningún script de terceros — nada cambia para las
// visitas actuales. En cuanto se rellene, el banner aparece solo y, si el
// visitante acepta, carga el tag de Google Ads.
export const GOOGLE_ADS_CONVERSION_ID = '';

// Etiqueta de la conversión "clic en WhatsApp" (la parte tras la "/" en el
// fragmento de Google Ads: send_to: 'AW-XXXXXXXXX/ETIQUETA'). Se crea en
// Google Ads > Objetivos > Conversiones > Sitio web, tipo "Contacto" o
// "Clic en un enlace". Mientras esté vacía (o falte el ID de arriba), el
// botón de WhatsApp no envía ninguna conversión. Aun rellenada, solo se
// envía si el visitante aceptó las cookies de publicidad (el tag de Google
// no existe en la página si no aceptó).
export const GOOGLE_ADS_WHATSAPP_LABEL = '';
