import type { SupabaseClient } from '@supabase/supabase-js';
import { esAdminDesdeRequest } from './portalAdmin';

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

// Cabecera con la que un administrador indica a qué cliente representa al
// probar la facturación desde el portal.
export const CABECERA_CLIENTE_ADMIN = 'x-cliente-admin';

// Como `clienteDesdeRequest`, pero un administrador puede actuar como un
// cliente concreto (cabecera `X-Cliente-Admin` con su `clientes.id`) para
// probar la facturación sin entrar con el enlace mágico de ese cliente.
//
// SOLO con clave de test de BeeL (`sandbox`): con clave live una factura
// emitida a nombre de un cliente tiene efecto fiscal real, y quien emite es
// el cliente, no la asesoría. Fuera de sandbox se rechaza (`null` → 401 en
// los endpoints). La autorización real es `esAdminDesdeRequest`: el id que
// llega en la cabecera solo se usa después de comprobar que quien llama es
// administrador.
export async function clienteParaFacturacion(
  request: Request,
  supabase: SupabaseClient,
  sandbox: boolean,
): Promise<ClienteSesion | null> {
  const suplantado = request.headers.get(CABECERA_CLIENTE_ADMIN)?.trim();
  if (!suplantado) return clienteDesdeRequest(request, supabase);

  if (!sandbox) return null;
  if (!(await esAdminDesdeRequest(request, supabase))) return null;

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, beel_company_id, beel_contratado')
    .eq('id', suplantado)
    .maybeSingle();
  if (!cliente) return null;

  return {
    id: cliente.id as string,
    beelCompanyId: (cliente.beel_company_id as string | null) ?? null,
    beelContratado: cliente.beel_contratado === true,
  };
}
