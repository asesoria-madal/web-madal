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
