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
    cat: z.enum(['fiscalidad', 'contabilidad', 'laboral', 'finanzas']),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
