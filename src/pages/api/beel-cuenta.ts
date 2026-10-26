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
  // BeeL exige dirección estructurada y los formularios solo guardan el
  // domicilio como texto libre, por eso la completa el admin. Obligatoria
  // para 'crear'; con 'documento' solo se envía para corregir la dirección
  // de una cuenta ya creada (PROFILE_INCOMPLETE al generar la representación).
  legalName?: string;
  street?: string;
  number?: string;
  floor?: string;
  postalCode?: string;
  city?: string;
  province?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// Dirección en el formato de BeeL, o null si falta algo. El número va aparte
// y es obligatorio aunque la documentación de BeeL lo dé por opcional: sin él,
// generar la representación falla con PROFILE_INCOMPLETE (address_number).
// Comprobado en sandbox el 26-oct-2026. Sin número se escribe "s/n".
function direccion(body: Body) {
  const street = body.street?.trim();
  const number = body.number?.trim();
  const floor = body.floor?.trim();
  const postalCode = body.postalCode?.trim();
  const city = body.city?.trim();
  const province = body.province?.trim();
  if (!street || !number || !city || !province || !postalCode || !CP_PATTERN.test(postalCode)) return null;
  return { street, number, ...(floor ? { floor } : {}), postal_code: postalCode, city, province };
}

const FALTA_DIRECCION = 'Faltan datos de la dirección (calle, número, código postal de 5 cifras, ciudad y provincia).';

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
    const address = direccion(body);
    const legalName = (body.legalName ?? '').trim() || (cliente.empresa as string | null) || (cliente.nombre as string);
    if (!address) return json({ error: FALTA_DIRECCION }, 400);

    // Con el email del cliente la cuenta nace con titular, que es lo que pide
    // la activación en producción (sin titular: 422 ACCOUNT_HAS_NO_HOLDER).
    // BeeL no le escribe (`send_email` es false por defecto): el cliente
    // sigue facturando desde nuestro portal sin entrar en BeeL. Cambiado el
    // 26-oct-2026; antes se creaban sin email.
    const crear = await leer(
      await beelFetch('/v1/accounts', {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: JSON.stringify({
          display_name: legalName,
          external_ref: cliente.id,
          ...(cliente.email ? { email: cliente.email } : {}),
          language: 'es',
          access_level: 'OPERATE',
          tax_profile: {
            nif: cliente.id,
            legal_name: legalName,
            entity_type: cliente.tipo_persona === 'sl' ? 'LEGAL_ENTITY' : 'INDIVIDUAL',
            ...(cliente.tipo_persona === 'sl' ? { legal_form: 'SL' } : {}),
            address,
          },
        }),
      }),
    );
    if (crear.errorCode === 'PROVISIONING_EMAIL_ALREADY_REGISTERED') {
      return json(
        { error: 'Ese email ya tiene una cuenta en BeeL que no gestionamos nosotros. Pide al cliente otro email o habla con BeeL.', code: crear.errorCode },
        409,
      );
    }
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

  // Corregir la dirección de una cuenta ya creada: se manda entera (BeeL no
  // documenta si fusiona la dirección o la sustituye).
  if (body.action === 'documento' && body.street !== undefined) {
    const address = direccion(body);
    if (!address) return json({ error: FALTA_DIRECCION, estado }, 400);
    const patch = await leer(
      await beelFetch(`/v1/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify({ address }) }),
    );
    if (!patch.ok) return fallo('corregir la dirección', patch, { estado });
  }

  const gen = await leer(await beelFetch(`/v1/companies/${companyId}/representation`, { method: 'POST' }));
  if (!gen.ok) console.warn('[beel-cuenta] generar representación', gen.status, gen.errorCode, gen.errorMessage, gen.errorDetails);
  const doc = await leer(await beelFetch(`/v1/companies/${companyId}/representation/document`));
  if (!doc.ok) return gen.ok ? fallo('documento de representación', doc, { estado }) : fallo('generar representación', gen, { estado });
  const downloadUrl: string | undefined = doc.data?.download_url;

  // Aviso a n8n para que le llegue al cliente. La URL caduca en minutos, así
  // que n8n la descarga al momento. Un fallo aquí no invalida lo anterior.
  // Si no se envía, `avisoMotivo` le dice al admin por qué (solo lo ve él).
  let avisoEnviado = false;
  let avisoMotivo: string | null = null;
  const hook = import.meta.env.N8N_BEEL_WEBHOOK_URL as string | undefined;
  if (!hook) {
    avisoMotivo = 'falta N8N_BEEL_WEBHOOK_URL en Vercel';
  } else if (!cliente.email) {
    avisoMotivo = 'el cliente no tiene email';
  } else if (!downloadUrl) {
    avisoMotivo = 'BeeL no ha devuelto el enlace del documento';
  } else {
    try {
      const r = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Alert-Token': (import.meta.env.N8N_ALERT_TOKEN as string | undefined) ?? '' },
        body: JSON.stringify({ cliente_id: cliente.id, nombre: cliente.nombre, email: cliente.email, download_url: downloadUrl }),
      });
      avisoEnviado = r.ok;
      if (!r.ok) {
        const pista =
          r.status === 403 ? ': revisa N8N_ALERT_TOKEN y la credencial «Beel» de n8n'
          : r.status === 404 ? ': ¿URL de pruebas (webhook-test) o workflow inactivo?'
          : '';
        avisoMotivo = `n8n ha respondido ${r.status}${pista}`;
        console.error('[beel-cuenta] n8n rechazó el aviso', r.status);
      }
    } catch (e) {
      avisoMotivo = 'sin conexión con n8n';
      console.error('[beel-cuenta] no se pudo avisar a n8n', e);
    }
  }

  return json({ ok: true, estado, companyId, downloadUrl: downloadUrl ?? null, avisoEnviado, avisoMotivo });
};
