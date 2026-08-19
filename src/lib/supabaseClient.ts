import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

// Cliente de Supabase para el navegador (portal de clientes). Usa la
// clave pública "anon", que es segura de exponer: el acceso real a los
// datos lo controla RLS en la base de datos, no esta clave.
export function getSupabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    client = null;
    return client;
  }
  client = createClient(url, key);
  return client;
}
