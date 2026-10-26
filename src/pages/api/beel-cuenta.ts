import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { esAdminDesdeRequest } from '../../lib/portalAdmin';
import { beelConfig, beelFetch } from '../../lib/beel';

export const prerender = false;

// Paso 1 del alta de facturación en BeeL (solo administradores del portal):
// crea la cuenta gestionada del cliente (nivel OPERATE), guarda sus ids en
// `clientes`, genera el documento de representación Verifactu y, si hay
// webhook de n8n configurado, avisa para que le llegue al cliente por email
// con las instrucciones de firma. No cuesta nada: el NIF queda en TEST.
//
// El paso 2 (subir el PDF firmado y activar en producción) está en
// api/beel-activar.ts. Procedimiento completo: DOCS/ALTA-CLIENTE-FACTURACION.md.
//
// Variables de entorno opcionales:
//   N8N_BEEL_WEBHOOK_URL   webhook de n8n "BeeL representación al cliente".
//   N8N_ALERT_TOKEN        (ya existente) se reutiliza como valor de la cabecera
//                          X-Alert-Token: el webhook usa la misma credencial Header Auth
//                          "Beel" de n8n que el de alertas de rechazo.

const CP_PATTERN = /^\d{5}$/;

interface Body {
  clienteId: string;
  // 'crear': crea la cuenta (si no existe) y genera el documento.
  // 'documento': solo vuelve a generarlo y reenviarlo (el enlace caduca a los
  // 5 minutos, o la generación falló al crear la cuenta).
  action: 'crear' | 'documento';
  // Solo para 'crear'. BeeL exige dirección estructurada y los formularios
  // solo guardan el domicilio como texto libre, por eso la completa el admin.
  legalName?: string;
  street?: string;
  number?: string;
  postalCode?: string;
  city?: string;
  province?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

type Leido = { ok: boolean; status: number; data: any; errorCode: string | null; errorMessage: string | null; errorDetails: unknown };

// Respuesta de BeeL: { success, data } o { success: false, error: { code, message, details } }.
async function leer(res: Response): Promise<Leido> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    data: body?.data ?? null,
    errorCode: body?.error?.code ?? null,
    errorMessage: body?.error?.message ?? null,
    errorDetails: body?.error?.details ?? null,
  };
}

// `extra` va tal cual en la respuesta: si la cuenta ya existe y falla un paso
// posterior, el panel necesita saberlo para mostrar el estado real.
function fallo(paso: string, r: Leido, extra: Record<string, unknown> = {}) {
  console.error(`[beel-cuenta] ${paso} falló`, r.status, r.errorCode, r.errorMessage, r.errorDetails);
  // BeeL nombra en `details` los campos que faltan o son inválidos.
  const detalle = r.errorDetails && typeof r.errorDetails === 'object' ? ` ${JSON.stringify(r.errorDetails)}` : '';
  return json(
    { error: `BeeL rechazó el paso «${paso}»: ${r.errorCode ?? r.status}${r.errorMessage ? ' — ' + r.errorMessage : ''}${detalle}`, code: r.errorCode, ...extra },
    502,
  );
}

export const POST: APIRoute = async ({ request }) => {
  const cfg = beelConfig();
  const supabase = getSupabaseAdmin();
  if (!cfg || !supabase) return json({ error: 'BeeL o Supabase no están configurados.' }, 503);
  if (!(await esAdminDesdeRequest(request, supabase))) return json({ error: 'No tienes permisos de administrador' }, 403);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (typeof body.clienteId !== 'string' || (body.action !== 'crear' && body.action !== 'documento')) {
    return json({ error: 'Petición no válida' }, 400);
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nombre, empresa, email, tipo_persona, beel_contratado, beel_account_id, beel_company_id, beel_estado')
    .eq('id', body.clienteId)
    .maybeSingle();
  if (!cliente) return json({ error: 'Cliente no encontrado' }, 404);
  if (String(cliente.id).startsWith('PENDIENTE-')) {
    return json({ error: 'El cliente aún tiene un id provisional: falta su NIF real (llega con el formulario).' }, 409);
  }
  if (!cliente.beel_contratado) return json({ error: 'Este cliente no tiene marcada la facturación BeeL como contratada.' }, 409);

  let companyId: string | null = (cliente.beel_company_id as string | null) ?? null;

  if (body.action === 'crear' && !cliente.beel_account_id) {
    const street = body.street?.trim();
    const city = body.city?.trim();
    const province = body.province?.trim();
    const postalCode = body.postalCode?.trim();
    const legalName = (body.legalName ?? '').trim() || (cliente.empresa as string | null) || (cliente.nombre as string);
    if (!street || !city || !province || !postalCode || !CP_PATTERN.test(postalCode)) {
      return json({ error: 'Faltan datos de la dirección (calle, código postal de 5 cifras, ciudad y provincia).' }, 400);
    }

    // Sin `email` la cuenta nace sin titular ni enlace de reclamación: el
    // cliente factura desde nuestro portal y no necesita entrar en BeeL.
    const crear = await leer(
      await beelFetch('/v1/accounts', {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: JSON.stringify({
          display_name: legalName,
          external_ref: cliente.id,
          language: 'es',
          access_level: 'OPERATE',
          tax_profile: {
            nif: cliente.id,
            legal_name: legalName,
            entity_type: cliente.tipo_persona === 'sl' ? 'LEGAL_ENTITY' : 'INDIVIDUAL',
            ...(cliente.tipo_persona === 'sl' ? { legal_form: 'SL' } : {}),
            address: { street, ...(body.number?.trim() ? { number: body.number.trim() } : {}), postal_code: postalCode, city, province },
          },
        }),
      }),
    );
    if (!crear.ok) return fallo('crear cuenta', crear);

    companyId = crear.data?.company_id ?? null;
    const { error: upError } = await supabase
      .from('clientes')
      .update({ beel_account_id: crear.data?.account_id ?? null, beel_company_id: companyId, beel_estado: 'cuenta_test' })
      .eq('id', cliente.id);
    if (upError) {
      console.error('[beel-cuenta] cuenta creada pero no se pudo guardar', upError.message, crear.data);
      return json({ error: 'La cuenta se creó en BeeL pero no se pudo guardar en Supabase. Revisa los logs.' }, 500);
    }
  }

  if (!companyId) return json({ error: 'El cliente no tiene company de BeeL: crea primero la cuenta.' }, 409);

  // Documento de representación. Si ya estaba generado, la generación puede
  // fallar y aun así el documento existe: se intenta descargar igualmente.
  // Si tampoco hay documento, el error útil es el de la generación (el de la
  // descarga solo dice REPRESENTATION_NOT_FOUND). La cuenta ya existe, así
  // que la respuesta lleva su estado para que el panel permita reintentarlo.
  const estado = (cliente.beel_estado as string | null) ?? 'cuenta_test';
  const gen = await leer(await beelFetch(`/v1/companies/${companyId}/representation`, { method: 'POST' }));
  if (!gen.ok) console.warn('[beel-cuenta] generar representación', gen.status, gen.errorCode, gen.errorMessage, gen.errorDetails);
  const doc = await leer(await beelFetch(`/v1/companies/${companyId}/representation/document`));
  if (!doc.ok) return gen.ok ? fallo('documento de representación', doc, { estado }) : fallo('generar representación', gen, { estado });
  const downloadUrl: string | undefined = doc.data?.download_url;

  // Aviso a n8n para que le llegue al cliente. La URL caduca en minutos, así
  // que n8n la descarga al momento. Un fallo aquí no invalida lo anterior.
  let avisoEnviado = false;
  const hook = import.meta.env.N8N_BEEL_WEBHOOK_URL as string | undefined;
  if (hook && downloadUrl && cliente.email) {
    try {
      const r = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Alert-Token': (import.meta.env.N8N_ALERT_TOKEN as string | undefined) ?? '' },
        body: JSON.stringify({ cliente_id: cliente.id, nombre: cliente.nombre, email: cliente.email, download_url: downloadUrl }),
      });
      avisoEnviado = r.ok;
    } catch (e) {
      console.error('[beel-cuenta] no se pudo avisar a n8n', e);
    }
  }

  return json({ ok: true, estado, companyId, downloadUrl: downloadUrl ?? null, avisoEnviado });
};
