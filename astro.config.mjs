// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://asesoriamadal.es',
  output: 'server',
  // Sin esto, Google indexaba /ruta y /ruta/ como URLs distintas (con el
  // mismo canonical, pero dos entradas separadas en Search Console). Con
  // output "server" y el adaptador de Vercel, Astro redirige en servidor
  // (301) la variante con barra final a la que no la lleva, así que no
  // hace falta configurar la redirección aparte en Vercel.
  trailingSlash: 'never',
  adapter: vercel(),
  build: {
    // Una sola hoja de estilos global de ~7 KB para todo el sitio: meterla
    // inline en el <head> quita una petición bloqueante de la ruta crítica
    // de renderizado (ver hallazgo de PageSpeed sobre "Solicitudes que
    // bloquean el renderizado").
    inlineStylesheets: 'always',
  },
  integrations: [
    sitemap({
      // /solicitud no se indexa (llega solo por enlace directo); las páginas
      // de paginación del blog (/blog/pagina/N) llevan noindex porque no
      // deben competir con los artículos; aviso-legal/privacidad/cookies
      // llevan noindex a propósito (ver Layout), así que tampoco tiene
      // sentido listar ninguna de ellas en el sitemap.
      filter: (page) =>
        !page.includes('/solicitud') &&
        !page.includes('/pagina/') &&
        !page.includes('/aviso-legal') &&
        !page.includes('/privacidad') &&
        !page.includes('/cookies'),
      // Sin esto el sitemap no llevaba <lastmod> en ninguna URL. Usamos la
      // fecha de este build: es un dato real (cuándo se generó este HTML
      // exacto), no inventado, aunque no distinga qué páginas cambiaron de
      // verdad de las que no.
      serialize(item) {
        item.lastmod = new Date().toISOString();
        return item;
      },
    }),
  ],
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'ca', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
