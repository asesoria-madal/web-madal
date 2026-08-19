import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// Tarifas base SIN IVA, por tramo de facturas/mes. El total que se guarda
// y se devuelve va siempre CON IVA (21%) — así coincide con lo que se
// muestra en el simulador y en la web.
const RATES_AUTONOMO: Record<string, number> = { bajo: 40, medio: 50, alto: 60 };
const RATES_PYME: Record<string, number> = { t1: 100, t2: 115, t3: 130, t4: 150 };
// "nose" (no lo tiene claro) no suma nada al total: el reporting solo se
// cobra si el cliente lo confirma con "si". Ver Simulador.astro (duplicado
// deliberado del cálculo, para que coincidan front y back).
const REPORTING: Record<string, number> = { si: 30, no: 0, nose: 0 };
const IVA_RATE = 0.21;

interface Body {
  regimen: string;
  facturas: string;
  reporting: string;
}

function isValid(body: unknown): body is Body {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.regimen !== 'string' || typeof b.facturas !== 'string' || typeof b.reporting !== 'string') return false;
  if (!(b.reporting in REPORTING)) return false;
  if (b.regimen === 'autonomo') return b.facturas in RATES_AUTONOMO;
  if (b.regimen === 'pyme') return b.facturas in RATES_PYME;
  return false;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  if (!isValid(body)) {
    return json({ error: 'Respuestas no válidas' }, 400);
  }

  const rates = body.regimen === 'pyme' ? RATES_PYME : RATES_AUTONOMO;
  const subtotal = rates[body.facturas] + REPORTING[body.reporting];
  const total = round2(subtotal * (1 + IVA_RATE));
  const year = new Date().getFullYear();
  const yy = String(year).slice(-2);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Todavía no hay Supabase configurado: devolvemos un ID de demo, sin persistir,
    // para que el simulador siga funcionando mientras se crea el proyecto real.
    const demo = `CC-${yy}-DEMO${Math.floor(10000 + Math.random() * 90000)}`;
    return json({ quote: demo, total, persisted: false });
  }

  const { data: seq, error: seqError } = await supabase.rpc('next_quote_number', { p_year: year });
  if (seqError || seq == null) {
    return json({ error: 'No se ha podido generar el número de presupuesto' }, 500);
  }

  const quote = `CC-${yy}-${String(seq).padStart(5, '0')}`;

  const { error: insertError } = await supabase.from('presupuestos').insert({
    quote_code: quote,
    regimen: body.regimen,
    facturas: body.facturas,
    reporting: body.reporting,
    total,
  });
  if (insertError) {
    return json({ error: 'No se ha podido guardar el presupuesto' }, 500);
  }

  return json({ quote, total, persisted: true });
};
