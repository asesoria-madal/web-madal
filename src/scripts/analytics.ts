// Envoltorio mínimo sobre el `umami` global que expone el script cargado en
// Layout.astro (analytics.asesoriamadal.es/script.js). Mismo nombre/firma
// que `track()` de @vercel/analytics para que migrar las llamadas existentes
// fuera solo cambiar el import. Si el script de Umami no ha cargado (bloqueo
// de red, adblock, etc.) no hace nada, en vez de romper la interacción.
declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, unknown>) => void };
  }
}

export function track(name: string, data?: Record<string, unknown>): void {
  window.umami?.track(name, data);
}
