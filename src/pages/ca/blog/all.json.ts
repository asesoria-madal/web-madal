import type { APIRoute } from 'astro';
import { getSortedBlogPosts, toPostPreview } from '../../../lib/blog';

export const prerender = true;

// Ver src/pages/blog/all.json.ts (misma idea, para el idioma catalán).
export const GET: APIRoute = async () => {
  const entries = await getSortedBlogPosts('ca');
  const posts = entries.map((e) => toPostPreview(e, 'ca'));
  return new Response(JSON.stringify(posts), {
    headers: { 'Content-Type': 'application/json' },
  });
};
