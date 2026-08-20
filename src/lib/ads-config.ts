// ID de conversión de Google Ads (formato "AW-XXXXXXXXX"). Se deja vacío
// hasta que exista una cuenta de Google Ads real con conversión configurada.
// Mientras esté vacío: el banner de cookies (CookieConsent.astro) no se
// muestra y no se carga ningún script de terceros — nada cambia para las
// visitas actuales. En cuanto se rellene, el banner aparece solo y, si el
// visitante acepta, carga el tag de Google Ads.
export const GOOGLE_ADS_CONVERSION_ID = '';
