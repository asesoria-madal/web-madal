import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n/ui';

export const BLOG_PAGE_SIZE = 9;

export interface PostPreview {
  slug: string;
  cat: string;
  title: string;
  desc: string;
  date: string;
}

const dateLocale: Record<Locale, string> = { es: 'es-ES', ca: 'ca-ES', en: 'en-GB' };

export function toPostPreview(entry: CollectionEntry<'blog'>, lang: Locale): PostPreview {
  return {
    slug: entry.data.slug,
    cat: entry.data.cat,
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
