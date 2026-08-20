import { getCollection, type CollectionEntry } from 'astro:content';
import { useTranslations } from '../i18n/utils';
import type { Locale } from '../i18n/ui';

export const BLOG_PAGE_SIZE = 9;

export interface PostPreview {
  slug: string;
  catId: string;
  cat: string;
  title: string;
  desc: string;
  date: string;
}

const dateLocale: Record<Locale, string> = { es: 'es-ES', ca: 'ca-ES', en: 'en-GB' };

export function toPostPreview(entry: CollectionEntry<'blog'>, lang: Locale): PostPreview {
  const t = useTranslations(lang);
  const catLabel = t.blog.categories.find((c) => c.id === entry.data.cat)?.label ?? entry.data.cat;
  return {
    slug: entry.data.slug,
    catId: entry.data.cat,
    cat: catLabel,
    title: entry.data.title,
    desc: entry.data.description,
    date: entry.data.date.toLocaleDateString(dateLocale[lang], { year: 'numeric', month: 'long' }),
  };
}

export async function getSortedBlogPosts(lang: Locale): Promise<CollectionEntry<'blog'>[]> {
  const entries = await getCollection('blog', (e) => e.data.lang === lang && !e.data.draft);
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function totalBlogPages(count: number): number {
  return Math.max(1, Math.ceil(count / BLOG_PAGE_SIZE));
}

// Construido con códigos de carácter (en vez del rango literal) para no
// embeber marcas diacríticas combinantes directamente en el fuente, igual
// que en Blog.astro.
const DIACRITICS_PATTERN = new RegExp(String.fromCharCode(91, 0x0300, 45, 0x036f, 93), 'g');

// Palabras demasiado comunes en es/ca/en para que un solape cuente como
// señal real de tema compartido entre dos artículos.
const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'que', 'del', 'las', 'los', 'un', 'una', 'para', 'con', 'por',
  'tu', 'tus', 'es', 'o', 'se', 'al', 'como', 'si', 'no', 'me', 'mi', 'su', 'sus', 'lo', 'te', 'ya',
  'cada', 'cómo', 'qué', 'cuánto', 'cuándo', 'entre', 'sobre', 'hay', 'ser', 'este', 'esta', 'esto',
  'da', 'de', 'i', 'els', 'les', 'del', 'dels', 'una', 'un', 'per', 'amb', 'què', 'com', 'quan', 'quant',
  'the', 'of', 'to', 'in', 'and', 'for', 'on', 'is', 'how', 'what', 'you', 'your', 'we', 'do', 'does',
  'can', 'it', 'when', 'this', 'that', 'are', 'be', 'or', 'if', 'so', 'not', 'my', 'from',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(DIACRITICS_PATTERN, '')
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word)),
  );
}

// Relacionados = misma categoría (señal fuerte) + palabras compartidas en
// título/descripción/slug (señal de tema), con empate roto por fecha más
// reciente. Si no hay suficientes con señal real, se rellena con los
// artículos más recientes para que la sección nunca salga vacía.
export function getRelatedPosts(
  entries: CollectionEntry<'blog'>[],
  current: CollectionEntry<'blog'>,
  lang: Locale,
  limit = 3,
): PostPreview[] {
  const currentTokens = tokenize(
    `${current.data.title} ${current.data.description} ${current.data.slug.replace(/-/g, ' ')}`,
  );

  const candidates = entries.filter((e) => e.id !== current.id);

  const scored = candidates
    .map((entry) => {
      const catScore = entry.data.cat === current.data.cat ? 3 : 0;
      const tokens = tokenize(
        `${entry.data.title} ${entry.data.description} ${entry.data.slug.replace(/-/g, ' ')}`,
      );
      let overlap = 0;
      tokens.forEach((token) => {
        if (currentTokens.has(token)) overlap += 1;
      });
      return { entry, score: catScore + overlap };
    })
    .sort((a, b) => b.score - a.score || b.entry.data.date.valueOf() - a.entry.data.date.valueOf());

  const picked = scored.filter((s) => s.score > 0).slice(0, limit);
  if (picked.length < limit) {
    const pickedIds = new Set(picked.map((s) => s.entry.id));
    for (const s of scored) {
      if (picked.length >= limit) break;
      if (pickedIds.has(s.entry.id)) continue;
      picked.push(s);
    }
  }

  return picked.map((s) => toPostPreview(s.entry, lang));
}
