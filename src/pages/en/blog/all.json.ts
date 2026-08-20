import type { APIRoute } from 'astro';
import { getSortedBlogPosts, toPostPreview } from '../../../lib/blog';

export const prerender = true;

// Ver src/pages/blog/all.json.ts (misma idea, para el idioma inglés).
export const GET: APIRoute = async () => {
  const entries = await getSortedBlogPosts('en');
  const posts = entries.map((e) => toPostPreview(e, 'en'));
  return new Response(JSON.stringify(posts), {
    headers: { 'Content-Type': 'application/json' },
  });
};
