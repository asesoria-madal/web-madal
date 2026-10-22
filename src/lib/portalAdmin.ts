import type { SupabaseClient } from '@supabase/supabase-js';

// Comprueba que quien llama a un endpoint es un administrador del portal
// (fila en `portal_admins`). El access token de su sesión de Supabase llega en
// `Authorization: Bearer`. Los endpoints de admin usan la service role, que se
// salta RLS, así que esta comprobación ES la autorización: nunca se confía en
// nada que venga en el cuerpo de la petición.
export async function esAdminDesdeRequest(request: Request, supabase: SupabaseClient): Promise<boolean> {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return false;

  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return false;

  const { data: admin } = await supabase
    .from('portal_admins')
    .select('auth_user_id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  return !!admin;
}
