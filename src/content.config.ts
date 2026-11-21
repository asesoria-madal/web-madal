import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/blog',
    // El basename (sin la carpeta de idioma) se repite entre locales a propósito:
    // usamos la ruta completa como id para que no colisionen.
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    lang: z.enum(['es', 'ca', 'en']),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    // Solo para buscadores (<title> y meta description): el título visible (H1 y tarjetas)
    // y la descripción de las tarjetas siguen siendo title y description.
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    cat: z.enum(['fiscalidad', 'contabilidad', 'laboral', 'finanzas']),
    date: z.coerce.date(),
    // Fecha de la última revisión de contenido. Opcional: si no se indica,
    // se asume que la fecha de publicación sigue siendo la vigente.
    updatedDate: z.coerce.date().optional(),
    // Normativa oficial citada (BOE, AEAT, Seguridad Social...). Opcional a
    // propósito: solo se rellena cuando aporta valor citar la norma exacta,
    // y siempre tras verificarla (ver "Verificación de contenido fiscal" en CLAUDE.md).
    sources: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
    draft: z.boolean().default(false),
  }),
});

// Blog de la línea Madal Pricing (2026-11-21): colección aparte a propósito, para
// que sus artículos no se mezclen con el blog de gestoría (/blog, relacionados,
// buscador, all.json). Solo español de momento; viven en /pricing/blog.
const pricing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pricing' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    sources: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
    // Los artículos con dato fiscal se dejan en draft hasta pasarlos por el
    // notebook "Blog y FAQs AM" (ver web/CLAUDE.md). En desarrollo se ven igualmente.
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, pricing };
