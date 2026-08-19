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
