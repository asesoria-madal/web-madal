// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://asesoriamadal.es',
  output: 'server',
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
      filter: (page) => !page.includes('/solicitud'),
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
