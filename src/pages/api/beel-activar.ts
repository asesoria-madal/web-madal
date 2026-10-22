import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { esAdminDesdeRequest } from '../../lib/portalAdmin';
import { beelConfig, beelFetch } from '../../lib/beel';

export const prerender = false;

// Paso 2 del alta de facturación en BeeL (solo administradores del portal):
// sube el PDF de representación FIRMADO por el cliente con su certificado,
// activa su NIF en producción, activa Veri*Factu y comprueba que puede emitir.
//
// ATENCIÓN, cuesta dinero: desde que el NIF se activa en producción cuenta
// 12 EUR/mes, emita o no (DOCS/BEEL.md §3). Por eso:
//  - solo funciona con clave LIVE: con clave de test la activación PROD
//    también se cobra, y no hay forma de firmar la representación en sandbox;
//  - el panel de admin pide confirmación antes de llamar aquí.
// Los pasos son secuenciales y se detiene en el primero que falla, diciendo
// cuál; repetir la petición es seguro (cada paso de BeeL es idempotente).

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

type Resultado = { ok: boolean; status: number; data: any; errorCode: string | null; errorMessage: string | null };

async function leer(res: Response): Promise<Resultado> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, data: body?.data ?? null, errorCode: body?.error?.code ?? null, errorMessage: body?.error?.message ?? null };
}

function fallo(paso: string, r: Resultado) {
  console.error(`[beel-activar] ${paso} falló`, r.status, r.errorCode, r.errorMessage);
  return json(
    { error: `BeeL rechazó el paso «${paso}»: ${r.errorCode ?? r.status}${r.errorMessage ? ' — ' + r.errorMessage : ''}`, paso, code: r.errorCode },
    502,
  );
}

export const POST: APIRoute = async ({ request }) => {
  const cfg = beelConfig();
  const supabase = getSupabaseAdmin();
  if (!cfg || !supabase) return json({ error: 'BeeL o Supabase no están configurados.' }, 503);
  if (!(await esAdminDesdeRequest(request, supabase))) return json({ error: 'No tienes permisos de administrador' }, 403);
  if (cfg.sandbox) {
    return json({ error: 'Activar en producción solo se hace con la clave live de BeeL: con la de test también se cobraría el NIF.' }, 409);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Se esperaba un formulario con el PDF firmado.' }, 400);
  }
  const clienteId = form.get('clienteId');
  const file = form.get('file');
  if (typeof clienteId !== 'string' || !(file instanceof File) || file.size === 0) {
    return json({ error: 'Falta el cliente o el PDF firmado.' }, 400);
  }
  if (file.size > 10 * 1024 * 1024) return json({ error: 'El PDF pesa demasiado (máximo 10 MB).' }, 400);

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, beel_contratado, beel_company_id, beel_estado')
    .eq('id', clienteId)
    .maybeSingle();
  if (!cliente) return json({ error: 'Cliente no encontrado' }, 404);
  if (!cliente.beel_contratado || !cliente.beel_company_id) {
    return json({ error: 'El cliente no tiene la facturación contratada o aún no tiene cuenta en BeeL.' }, 409);
  }
  const companyId = cliente.beel_company_id as string;

  // 1) Representación firmada (multipart, campo `file`).
  const envio = new FormData();
  envio.append('file', file, file.name || 'representacion-firmada.pdf');
  const submit = await leer(await beelFetch(`/v1/companies/${companyId}/representation/submit`, { method: 'POST', body: envio }));
  if (!submit.ok) return fallo('subir representación firmada', submit);

  // 2) Activar el NIF en producción (aquí empieza a contar).
  const activar = await leer(
    await beelFetch(`/v1/companies/${companyId}/activations`, {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
      body: JSON.stringify({ environment: 'PROD' }),
    }),
  );
  if (!activar.ok) return fallo('activar NIF en producción', activar);

  // 3) Activar Veri*Factu (reemplazo completo: solo `enabled`).
  const vf = await leer(
    await beelFetch(`/v1/companies/${companyId}/verifactu-configuration`, { method: 'PUT', body: JSON.stringify({ enabled: true }) }),
  );
  if (!vf.ok) return fallo('activar Veri*Factu', vf);

  // 4) Comprobación final: debe poder emitir.
  const ready = await leer(await beelFetch(`/v1/companies/${companyId}/issuing-readiness`));
  if (!ready.ok) return fallo('comprobar que puede emitir', ready);
  if (ready.data?.ready !== true) {
    // NIF ya activo pero con algún bloqueo pendiente: se informa, no se da por bueno.
    return json({ error: 'El NIF está activo pero BeeL indica que aún no puede emitir.', blockers: ready.data?.blockers ?? null }, 409);
  }

  const { error } = await supabase
    .from('clientes')
    .update({ beel_estado: 'produccion', beel_activado_prod_at: new Date().toISOString() })
    .eq('id', cliente.id);
  if (error) {
    console.error('[beel-activar] activado en BeeL pero no se pudo guardar', error.message);
    return json({ error: 'Activado en BeeL, pero no se pudo guardar el estado en Supabase. Revisa los logs.' }, 500);
  }

  return json({ ok: true, estado: 'produccion' });
};
