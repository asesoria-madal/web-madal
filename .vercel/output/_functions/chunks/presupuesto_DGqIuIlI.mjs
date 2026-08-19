import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
//#region src/lib/supabase.ts
var client;
function getSupabaseAdmin() {
	if (client !== void 0) return client;
	client = null;
	return client;
}
//#endregion
//#region src/pages/api/presupuesto.ts
var presupuesto_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
var RATES_AUTONOMO = {
	bajo: 40,
	medio: 50,
	alto: 60
};
var RATES_PYME = {
	t1: 100,
	t2: 115,
	t3: 130,
	t4: 150
};
var REPORTING = {
	si: 30,
	no: 0,
	nose: 15
};
function isValid(body) {
	if (typeof body !== "object" || body === null) return false;
	const b = body;
	if (typeof b.regimen !== "string" || typeof b.facturas !== "string" || typeof b.reporting !== "string") return false;
	if (!(b.reporting in REPORTING)) return false;
	if (b.regimen === "autonomo") return b.facturas in RATES_AUTONOMO;
	if (b.regimen === "pyme") return b.facturas in RATES_PYME;
	return false;
}
function round2(n) {
	return Math.round(n * 100) / 100;
}
function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" }
	});
}
var POST = async ({ request }) => {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: "JSON inválido" }, 400);
	}
	if (!isValid(body)) return json({ error: "Respuestas no válidas" }, 400);
	const total = round2(((body.regimen === "pyme" ? RATES_PYME : RATES_AUTONOMO)[body.facturas] + REPORTING[body.reporting]) * 1.21);
	const year = (/* @__PURE__ */ new Date()).getFullYear();
	const yy = String(year).slice(-2);
	const supabase = getSupabaseAdmin();
	if (!supabase) return json({
		quote: `CC-${yy}-DEMO${Math.floor(1e4 + Math.random() * 9e4)}`,
		total,
		persisted: false
	});
	const { data: seq, error: seqError } = await supabase.rpc("next_quote_number", { p_year: year });
	if (seqError || seq == null) return json({ error: "No se ha podido generar el número de presupuesto" }, 500);
	const quote = `CC-${yy}-${String(seq).padStart(5, "0")}`;
	const { error: insertError } = await supabase.from("presupuestos").insert({
		quote_code: quote,
		regimen: body.regimen,
		facturas: body.facturas,
		reporting: body.reporting,
		total
	});
	if (insertError) return json({ error: "No se ha podido guardar el presupuesto" }, 500);
	return json({
		quote,
		total,
		persisted: true
	});
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/presupuesto@_@ts
var page = () => presupuesto_exports;
//#endregion
export { page };
