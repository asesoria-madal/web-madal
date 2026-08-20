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

export const collections = { blog };
