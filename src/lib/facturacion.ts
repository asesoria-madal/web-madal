// Piezas comunes de los endpoints de facturación del portal (emitir,
// rectificar, clientes, recurrentes). Todos hacen lo mismo antes de tocar
// BeeL: comprobar que BeeL y Supabase están configurados, identificar al
// cliente por su sesión, aplicar un límite de peticiones y resolver su
// company. Centralizarlo evita que un endpoint se olvide de un paso.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase';
import { clienteParaFacturacion, type ClienteSesion } from './portalAuth';
import { beelConfig, resolveCompanyId } from './beel';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const NIF_CIF_PATTERN = /^[0-9A-Za-z][0-9]{7}[A-Za-z0-9]$/;
export const CP_PATTERN = /^\d{5}$/;

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 60;
// Por cliente (ya autenticado), no por IP. Best-effort en memoria, como el resto.
const requestLog = new Map<string, number[]>();

function isRateLimited(clienteId: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(clienteId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(clienteId, recent);
  return recent.length > RATE_LIMIT_MAX;
}

export interface ContextoFacturacion {
  supabase: SupabaseClient;
  cliente: ClienteSesion;
  companyId: string;
  sandbox: boolean;
}

// Devuelve el contexto, o la Response de error que el endpoint debe devolver
// tal cual (503 sin configurar, 401 sin sesión, 429 límite, 409 sin company).
export async function contextoFacturacion(request: Request): Promise<ContextoFacturacion | Response> {
  const cfg = beelConfig();
  const supabase = getSupabaseAdmin();
  if (!cfg || !supabase) return json({ error: 'La facturación no está disponible ahora mismo.' }, 503);

  const cliente = await clienteParaFacturacion(request, supabase, cfg.sandbox);
  if (!cliente) return json({ error: 'Sesión no válida' }, 401);

  if (isRateLimited(cliente.id)) {
    return json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.' }, 429);
  }

  // Solo emiten facturas los clientes que han contratado la facturación; sin esto,
  // `resolveCompanyId` caería en la empresa por defecto de sandbox para cualquiera.
  if (!cliente.beelContratado) {
    return json({ error: 'La facturación no está contratada en tu cuenta. Escríbenos si quieres activarla.' }, 403);
  }

  const companyId = resolveCompanyId(cliente.beelCompanyId);
  if (!companyId) {
    return json({ error: 'La facturación todavía no está activada para tu cuenta. Escríbenos y la activamos.' }, 409);
  }
  return { supabase, cliente, companyId, sandbox: cfg.sandbox };
}

// Respuesta de error a partir de una respuesta fallida de BeeL. Los errores de
// validación (4xx) son accionables por el cliente, así que se devuelven el
// código y el mensaje; los demás son un fallo del servicio.
export async function errorBeel(res: Response, contexto: string) {
  const result = await res.json().catch(() => null);
  const code = result?.error?.code ?? 'BEEL_ERROR';
  console.error(`BeeL ${contexto} error:`, res.status, code, result?.error?.message);
  const status = res.status >= 400 && res.status < 500 ? 422 : 502;
  return json({ error: 'No se ha podido completar la operación.', code, detail: result?.error?.message ?? null }, status);
}

// ---- Conceptos (líneas) ----------------------------------------------------
// Mismo criterio "deliberadamente laxo" que el resto de endpoints: forma y
// longitud, no corrección fiscal. La validación fiscal la hace BeeL.

// Tipos de IVA. 0 = exento / no sujeto: exige un motivo (ver EXENCIONES).
export const IVA_VALUES = [21, 10, 4, 0];
// Retenciones habituales: 7 % inicio de actividad, 15 % general, 19 %
// arrendamientos. 0 = sin retención.
export const IRPF_VALUES = [0, 7, 15, 19];
// Motivos de exención que se ofrecen desde el portal (subconjunto de los de
// BeeL; el resto los emite el equipo). OTRO exige texto.
export const EXENCIONES = [
  'EXENTA_ART_20',
  'NO_SUJETA_ART_7_9',
  'NO_SUJETA_LOCALIZACION',
  'ISP_ART_84_2_F',
  'OTRO',
];
export const MAX_LINEAS = 20;
export const METODOS_PAGO = ['BANK_TRANSFER', 'CARD', 'CASH', 'DIRECT_DEBIT', 'BIZUM', 'OTHER'];

export interface Linea {
  descripcion: string;
  cantidad: number;
  precio: number;
  descuento: number;
  iva: number;
  irpf: number;
  exencion?: string;
  exencionTexto?: string;
}

export function str(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

// `permitirNegativas`: en una rectificativa parcial las cantidades negativas
// expresan una reducción (así lo documenta BeeL).
export function lineasValidas(lineas: unknown, permitirNegativas = false): lineas is Linea[] {
  if (!Array.isArray(lineas) || lineas.length < 1 || lineas.length > MAX_LINEAS) return false;
  for (const l of lineas) {
    if (typeof l !== 'object' || l === null) return false;
    if (!str(l.descripcion, 300)) return false;
    const q = l.cantidad;
    if (typeof q !== 'number' || !Number.isFinite(q) || q === 0 || Math.abs(q) > 1_000_000) return false;
    if (q < 0 && !permitirNegativas) return false;
    if (typeof l.precio !== 'number' || !Number.isFinite(l.precio) || l.precio < 0 || l.precio > 999_999) return false;
    if (typeof l.descuento !== 'number' || l.descuento < 0 || l.descuento > 100) return false;
    if (!IVA_VALUES.includes(l.iva) || !IRPF_VALUES.includes(l.irpf)) return false;
    if (l.iva === 0) {
      if (typeof l.exencion !== 'string' || !EXENCIONES.includes(l.exencion)) return false;
      if (l.exencion === 'OTRO' && !str(l.exencionTexto, 500)) return false;
    }
  }
  return true;
}

// Línea del portal → línea de factura de BeeL. Con "IVA incluido" el precio
// que escribe el cliente ya lleva IVA: se manda el total con impuestos de la
// línea y BeeL calcula la base.
export function lineaABeel(l: Linea, ivaIncluido: boolean) {
  const base: Record<string, unknown> = {
    description: l.descripcion.trim(),
    quantity: l.cantidad,
    main_tax: { type: 'IVA', percentage: l.iva, regime_key: '01' },
    irpf_rate: l.irpf,
  };
  if (ivaIncluido) {
    const total = Math.round(l.cantidad * l.precio * (1 - l.descuento / 100) * 100) / 100;
    base.total_including_tax = total;
  } else {
    base.unit_price = l.precio;
    base.discount_percentage = l.descuento;
  }
  if (l.iva === 0 && l.exencion) {
    base.exemption_reason = l.exencion;
    if (l.exencion === 'OTRO') base.exemption_reason_text = l.exencionTexto!.trim();
  }
  return base;
}

// Línea para plantillas recurrentes: los campos de impuestos van "planos"
// (vat_rate…), no en `main_tax`, y no heredan el IRPF de la empresa.
export function lineaARecurrente(l: Linea, ivaIncluido: boolean) {
  const base: Record<string, unknown> = {
    description: l.descripcion.trim(),
    quantity: l.cantidad,
    vat_rate: l.iva,
    irpf_rate: l.irpf,
  };
  if (ivaIncluido) {
    base.total_including_tax = Math.round(l.cantidad * l.precio * (1 - l.descuento / 100) * 100) / 100;
  } else {
    base.unit_price = l.precio;
    base.discount_percentage = l.descuento;
  }
  if (l.iva === 0 && l.exencion) {
    base.exemption_reason = l.exencion;
    if (l.exencion === 'OTRO') base.exemption_reason_text = l.exencionTexto!.trim();
  }
  return base;
}

export interface Pago {
  metodo: string;
  iban?: string;
  swift?: string;
  plazoDias?: number;
}

export function pagoValido(p: unknown): p is Pago {
  if (typeof p !== 'object' || p === null) return false;
  const x = p as Record<string, any>;
  if (!METODOS_PAGO.includes(x.metodo)) return false;
  if (x.iban !== undefined && x.iban !== '' && !(typeof x.iban === 'string' && /^[A-Za-z]{2}\d{2}[A-Za-z0-9]{1,30}$/.test(x.iban.replace(/\s/g, '')))) return false;
  if (x.swift !== undefined && x.swift !== '' && !(typeof x.swift === 'string' && /^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/.test(x.swift))) return false;
  if (x.plazoDias !== undefined && !(Number.isInteger(x.plazoDias) && x.plazoDias >= 0 && x.plazoDias <= 365)) return false;
  return true;
}

export function pagoABeel(p: Pago) {
  return {
    method: p.metodo,
    ...(p.iban ? { iban: p.iban.replace(/\s/g, '').toUpperCase() } : {}),
    ...(p.swift ? { swift: p.swift.toUpperCase() } : {}),
    ...(p.plazoDias !== undefined ? { payment_term_days: p.plazoDias } : {}),
  };
}

// Fecha ISO yyyy-mm-dd válida.
export function fechaValida(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
