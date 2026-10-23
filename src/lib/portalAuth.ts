import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClienteSesion {
  id: string; // NIF del cliente (clientes.id)
  beelCompanyId: string | null;
  // Ha contratado la facturación con nosotros (clientes.beel_contratado).
  beelContratado: boolean;
}

// Identifica al cliente que llama a un endpoint del portal a partir del
// access token de su sesión de Supabase (cabecera `Authorization: Bearer`).
// El endpoint usa la service role, que se salta RLS, así que la autorización
// real se hace aquí: el token se valida contra Supabase Auth y de ahí sale el
// cliente. Nunca se confía en un NIF enviado en el cuerpo de la petición.
export async function clienteDesdeRequest(
  request: Request,
  supabase: SupabaseClient,
): Promise<ClienteSesion | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, beel_company_id, beel_contratado')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (!cliente) return null;

  return {
    id: cliente.id as string,
    beelCompanyId: (cliente.beel_company_id as string | null) ?? null,
    beelContratado: cliente.beel_contratado === true,
  };
}
