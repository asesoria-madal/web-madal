import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';
import { limpiarIban, ibanValido } from '../../lib/iban';

export const prerender = false;

// Recibe el formulario de alta de autónomo (FormularioAlta.astro, 2026-11-11) y lo guarda en
// `alta_nuevos_autonomos`. Todas las respuestas van en `respuestas` (jsonb) y el resumen
// legible en `resumen`; además se rellenan las columnas de siempre, que leen n8n
// ("Responden formulario", "Sync Empresas HubSpot", la hoja de clientes) y el portal.
// Validación laxa, como el resto: el equipo revisa cada alta. El campo oculto `web` es una
// trampa para bots.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIF_NIE_PATTERN = /^[0-9XYZ][0-9]{7}[A-Z]$/;
const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;
const FECHA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLANES = ['debut', 'esencial', 'crece', 'total'];
const TAMANO_MAXIMO = 200_000;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (isRateLimited(clientAddress)) return json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.' }, 429);

  const cuerpo = await request.text();
  if (cuerpo.length > TAMANO_MAXIMO) return json({ error: 'Demasiados datos' }, 413);
  let b: Record<string, any>;
  try {
    b = JSON.parse(cuerpo);
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (typeof b !== 'object' || b === null) return json({ error: 'Datos no válidos' }, 400);
  if (typeof b.web === 'string' && b.web.trim()) return json({ ok: true });

  const f = b.datos?.f;
  if (typeof f !== 'object' || f === null) return json({ error: 'Datos no válidos', field: 'datos' }, 400);

  const nombre = texto(f.nombre, 100);
  const apellidos = texto(f.apellidos, 150);
  const dni = (texto(f.dni, 20) ?? '').toUpperCase().replace(/[\s.-]/g, '');
  const email = texto(f.c_email, 254)?.toLowerCase() ?? '';
  const telefono = texto(f.c_tel, 30);
  const iban = (texto(f.iban, 50) ?? '').toUpperCase().replace(/\s+/g, '');
  // Cuenta de los impuestos (2026-11-12): la misma de la cuota o la que indique aparte.
  const ibanImpuestos = f.iban_imp_misma === 'No' ? limpiarIban(texto(f.iban_impuestos, 50) ?? '') : iban;
  const inicio = texto(f.act_inicio, 10) ?? '';
  const actividad = texto(f.act_desc, 2000);
  const resumen = texto(b.resumen, TAMANO_MAXIMO);
  if (!nombre) return json({ error: 'Datos no válidos', field: 'nombre' }, 400);
  if (!apellidos) return json({ error: 'Datos no válidos', field: 'apellidos' }, 400);
  if (!NIF_NIE_PATTERN.test(dni)) return json({ error: 'Datos no válidos', field: 'dni' }, 400);
  if (!EMAIL_PATTERN.test(email)) return json({ error: 'Datos no válidos', field: 'c_email' }, 400);
  if (!telefono) return json({ error: 'Datos no válidos', field: 'c_tel' }, 400);
  if (!IBAN_PATTERN.test(iban) || !ibanValido(iban)) return json({ error: 'Datos no válidos', field: 'iban' }, 400);
  if (!['Sí', 'No'].includes(f.iban_imp_misma) || !ibanValido(ibanImpuestos)) return json({ error: 'Datos no válidos', field: 'iban_impuestos' }, 400);
  if (!FECHA_PATTERN.test(inicio)) return json({ error: 'Datos no válidos', field: 'act_inicio' }, 400);
  if (!actividad) return json({ error: 'Datos no válidos', field: 'act_desc' }, 400);
  if (!f.rgpd) return json({ error: 'Datos no válidos', field: 'rgpd' }, 400);
  if (!resumen) return json({ error: 'Datos no válidos', field: 'resumen' }, 400);

  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ persisted: false });

  const piso = texto(f.dom_piso, 50);
  const domicilio = [
    [texto(f.dom_via, 200), texto(f.dom_num, 20)].filter(Boolean).join(' ') + (piso ? `, ${piso}` : ''),
    [texto(f.dom_cp, 10), texto(f.dom_mun, 100)].filter(Boolean).join(' '),
    texto(f.dom_prov, 100),
  ].filter(Boolean).join(', ');

  const lugar = lista(f.lugar);
  const conLocal = lugar.some((l) => ['Local u oficina alquilado', 'Local u oficina en propiedad', 'Coworking / domiciliación'].includes(l));
  const enCasa = lugar.includes('Desde casa');
  const tipoLocal = conLocal ? 'oficina' : enCasa ? 'casa' : 'sin_local';
  const domicilioLocal = texto(f.alq_dir, 300) ?? texto(f.prop_dir, 300) ?? (tipoLocal === 'casa' ? domicilio : null);
  const sitios = lugar.filter((l) => ['Local u oficina alquilado', 'Local u oficina en propiedad', 'Desde casa', 'Coworking / domiciliación'].includes(l));

  const cert = lista(f.cert);
  const identificacion = cert.some((c) => c === 'Certificado digital' || c === 'DNI electrónico') ? 'certificado' : cert.includes('Cl@ve') ? 'clave_pin' : 'ninguno';
  const retencion = f.clientes === 'Empresas y autónomos' ? 'si' : f.clientes === 'Particulares' ? 'no' : 'no_sabe';
  const cnae = texto(f.act_cnae, 200);
  const seraCliente = f.sera_cliente === 'Sí' ? true : f.sera_cliente === 'No' ? false : null;

  const { error } = await supabase.from('alta_nuevos_autonomos').insert({
    privacy_accepted_at: new Date().toISOString(),
    identificacion_digital: identificacion,
    nombre_completo: `${nombre} ${apellidos}`,
    nif_nie: dni,
    email,
    telefono,
    domicilio_fiscal: domicilio,
    iban,
    iban_impuestos: ibanImpuestos,
    epigrafes_iae: cnae ? `${cnae} - ${actividad}` : actividad,
    fecha_inicio_actividad: inicio,
    tipo_local: tipoLocal,
    domicilio_local: domicilioLocal,
    multiples_locales: sitios.length > 1,
    detalle_locales_adicionales: sitios.length > 1 ? lugar.join(', ') : null,
    profesion_colegiada: f.act_regulada === 'Sí',
    operaciones_intracomunitarias: f.roi === 'Sí',
    retencion_irpf: retencion,
    tendra_trabajadores: Boolean(f.trab) && f.trab !== 'No',
    idioma: ['es', 'ca', 'en'].includes(b.idioma) ? b.idioma : 'es',
    sera_cliente: seraCliente,
    plan: seraCliente && PLANES.includes(f.plan) ? f.plan : null,
    // Programa de facturación (5 € + IVA/mes, opcional en todos los planes de autónomo): 'si' | 'no' | 'no_sabe'.
    programa_facturacion: seraCliente ? ({ 'Sí': 'si', 'No': 'no', 'No lo sé': 'no_sabe' } as Record<string, string>)[f.facturacion] ?? null : null,
    resumen,
    respuestas: b.datos,
  });
  if (error) {
    console.error('Error guardando el formulario de alta', error.message);
    return json({ error: 'No se pudo guardar' }, 500);
  }
  return json({ ok: true });
};
