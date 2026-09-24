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
      // deben competir con los artículos, así que tampoco tiene sentido
      // listarlas en el sitemap.
      filter: (page) => !page.includes('/solicitud') && !page.includes('/pagina/'),
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
