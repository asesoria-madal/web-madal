import { getCollection, type CollectionEntry } from 'astro:content';

// Igual que `publicado` del blog de gestoría (draft o fecha futura = aún no sale), con una
// diferencia: en desarrollo (`astro dev`) se ve todo, para poder revisar los borradores y
// los artículos programados antes de darlos por buenos. En producción nunca salen antes.
export const publicadoPricing = (e: CollectionEntry<'pricing'>): boolean =>
  import.meta.env.DEV || (!e.data.draft && e.data.date.valueOf() <= Date.now());

export async function getPricingPosts(): Promise<CollectionEntry<'pricing'>[]> {
  const entries = await getCollection('pricing', publicadoPricing);
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const fechaLarga = (d: Date): string =>
  d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
