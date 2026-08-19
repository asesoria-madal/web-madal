import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

// Devuelve null si todavía no hay credenciales de Supabase configuradas
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — así la API puede seguir
// funcionando en modo degradado mientras se crea el proyecto de Supabase.
export function getSupabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    client = null;
    return client;
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
