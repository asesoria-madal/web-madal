import type { APIRoute } from 'astro';
import { getSortedBlogPosts, toPostPreview } from '../../lib/blog';

export const prerender = true;

// Listado completo de posts en JSON, para el buscador/filtro de Blog.astro:
// así no hace falta embeber los 200 artículos (ocultos) en el HTML de cada
// página de listado, solo se piden bajo demanda cuando el visitante filtra.
export const GET: APIRoute = async () => {
  const entries = await getSortedBlogPosts('es');
  const posts = entries.map((e) => toPostPreview(e, 'es'));
  return new Response(JSON.stringify(posts), {
    headers: { 'Content-Type': 'application/json' },
  });
};
