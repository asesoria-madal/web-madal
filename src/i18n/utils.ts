import { ui, defaultLocale, locales, type Locale } from './ui';

export function getLangFromUrl(url: URL): Locale {
  const [, maybeLocale] = url.pathname.split('/');
  if (locales.includes(maybeLocale as Locale)) return maybeLocale as Locale;
  return defaultLocale;
}

export function useTranslations(lang: Locale) {
  return ui[lang];
}

// Construye la misma ruta en otro idioma, respetando que el español no lleva prefijo.
export function localizedPath(path: string, lang: Locale): string {
  const clean = path.replace(/^\/(es|ca|en)(\/|$)/, '/');
  if (lang === defaultLocale) return clean === '' ? '/' : clean;
  return `/${lang}${clean === '/' ? '' : clean}`;
}

// <title> de una página de contenido (p.ej. un artículo del blog): añade el
// sufijo de marca solo si el resultado se queda dentro de la banda de 60
// caracteres que espera Google, para no truncar títulos largos en el SERP.
export function pageTitle(base: string, suffix = 'Asesoría Madal'): string {
  const full = `${base} · ${suffix}`;
  return full.length <= 60 ? full : base;
}
