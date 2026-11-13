// Lógica del formulario de alta de autónomo (ver FormularioAlta.astro). Basado en el
// formulario de Edurne (2026-11-11): se guarda solo en el navegador, avisa de lo que falta
// y envía a /api/alta-autonomo. Lo guardado va siempre en castellano.
import { track } from './analytics';

const ENDPOINT = "/api/alta-autonomo";
const EMAIL = "contacto@asesoriamadal.es";
const KEY = "form-alta-autonomo-v1";

let state = { f:{} };
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const LANG = $("#fa").dataset.lang || "es";
const I18N = JSON.parse($("#fa-i18n").textContent || "{}");
const ES = Object.fromEntries(Object.entries(I18N).map(([k, v]) => [v, k]));
const tr = (t, vars = {}) => (I18N[t] ?? t).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
const aEs = (t) => ES[t] ?? t;
const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const vacio = v => Array.isArray(v) ? v.length===0 : !String(v ?? "").trim();
const visibleEl = el => !el.closest(".hidden");
const labelOf = fl => ($("label.l", fl)?.textContent || "").replace(/\*.*$/s,"").trim();
const nombreCompleto = () => [state.f.nombre, state.f.apellidos].filter(Boolean).join(" ");

$("#envio-hint").textContent = tr("Al pulsar “Enviar” los datos nos llegan directamente. La documentación (DNI, etc.) envíala aparte a {email}.", { email: EMAIL });

/* ---------- Guardado ---------- */
let saveTimer;
function save(){
  clearTimeout(saveTimer);
  $("#saved").textContent = tr("Guardando…"); $("#saved").className = "saved";
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({...state, _t:new Date().toISOString()}));
      $("#saved").textContent = tr("✓ Guardado {hora}", { hora: new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}) });
      $("#saved").className = "saved ok";
    } catch(e){ $("#saved").textContent = tr("No se pudo guardar en este navegador: usa “Descargar copia”"); }
  }, 400);
}
function load(){
  try { const raw = localStorage.getItem(KEY); if(raw){ const d = JSON.parse(raw); state = {f:d.f||{}}; return true; } } catch(e){}
  return false;
}

/* ---------- Campos ---------- */
// Mismo cálculo que src/lib/iban.ts (este script no usa módulos): formato y módulo 97.
function ibanValido(v){
  const s = String(v||"").replace(/\s+/g,"").toUpperCase();
  if(!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s) || (s.startsWith("ES") && s.length !== 24)) return false;
  let m = 0;
  for(const ch of s.slice(4) + s.slice(0,4)){ const v2 = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch; for(const d of v2) m = (m*10 + Number(d)) % 97; }
  return m === 1;
}
function onField(e){
  const el = e.target; if(!el.name || !el.closest("#form")) return;
  if(el.type === "checkbox"){
    const group = $$(`#form input[type=checkbox][name="${el.name}"]`);
    if(group.length > 1){
      if(el.name==="cert" && el.checked){ group.forEach(x => { if((el.value==="Ninguno") !== (x.value==="Ninguno")) x.checked = false; }); }
      state.f[el.name] = group.filter(x=>x.checked).map(x=>x.value);
    } else state.f[el.name] = el.checked ? el.value : "";
  } else if(el.type === "radio"){ if(el.checked) state.f[el.name] = el.value; }
  else {
    // Las cuentas se guardan sin espacios y en mayúsculas: se limpian mientras se escribe o se pega.
    if((el.name === "iban" || el.name === "iban_impuestos") && /\s|[a-z]/.test(el.value)) el.value = el.value.replace(/\s+/g, "").toUpperCase();
    state.f[el.name] = el.value;
  }
  refresh(); save();
}
$("#form").addEventListener("input", onField);
$("#form").addEventListener("change", onField);
function fill(){
  $$("#form [name]").forEach(el => {
    const v = state.f[el.name];
    if(el.type === "checkbox") el.checked = Array.isArray(v) ? v.includes(el.value) : v === el.value;
    else if(el.type === "radio") el.checked = v === el.value;
    else if(el.type !== "file") el.value = v ?? "";
  });
  precargar(); // NIF y correo del enlace, ver más abajo: también tras importar una copia o vaciar
}

/* ---------- Lógica derivada ---------- */
function derivar(){
  const f = state.f, lugar = f.lugar || [];
  f.extranjero = (f.nacionalidad && !/espa|spanish/i.test(f.nacionalidad)) ? "1" : "";
  f.lugar_alq = lugar.includes("Local u oficina alquilado") ? "1" : "";
  f.lugar_prop = lugar.includes("Local u oficina en propiedad") ? "1" : "";
  f.lugar_casa = lugar.includes("Desde casa") ? "1" : "";
  f.hay_especial = (f.especial||[]).length ? "1" : "";
  // Tarifa plana orientativa
  let tp = "";
  if(f.reta_prev==="Nunca" || (f.reta_prev==="Sí, hace más de 2 años" && f.tp_prev==="No"))
    tp = `<div class="note" style="margin:0">${tr("✓ Por lo que indicas, probablemente puedas acogerte a la tarifa plana (cuota reducida durante los primeros 12 meses). Lo confirmamos al revisar.")}</div>`;
  else if(f.reta_prev==="Sí, en los últimos 2 años")
    tp = `<div class="warn" style="margin:0">${tr("Al haber estado de alta en los últimos 2 años, en principio no tendrías derecho a la tarifa plana. Lo revisamos igualmente.")}</div>`;
  else if(f.reta_prev==="Sí, hace más de 2 años" && f.tp_prev==="Sí" && f.reta_baja){
    const anos = (Date.now() - new Date(f.reta_baja)) / (365.25*864e5);
    tp = anos >= 3
      ? `<div class="note" style="margin:0">${tr("✓ Han pasado más de 3 años desde la baja: probablemente puedas volver a pedir la tarifa plana. Lo confirmamos al revisar.")}</div>`
      : `<div class="warn" style="margin:0">${tr("Si ya disfrutaste de la tarifa plana, tienen que pasar 3 años desde la baja para volver a pedirla. Lo revisamos igualmente.")}</div>`;
  }
  $("#tp-info").innerHTML = tp; $("#tp-info").classList.toggle("hidden", !tp);
}
function applyIf(){
  $$("#fa [data-if]").forEach(el => {
    const [k, vals] = el.dataset.if.split(":");
    el.classList.toggle("hidden", !vals.split("|").includes(String(state.f[k]||"")));
  });
}

/* ---------- Validación ---------- */
function faltan(){
  const out = [];
  const add = (el, label) => out.push({el, label, sec: el.closest("section.card")?.id});
  $$("#form [data-req]").forEach(el => { if(visibleEl(el) && vacio(state.f[el.name])) add(el.closest(".field"), labelOf(el.closest(".field"))); });
  $$("#form [data-req-group]").forEach(el => { if(visibleEl(el) && vacio(state.f[el.dataset.reqGroup])) add(el.closest(".field"), labelOf(el.closest(".field"))); });
  // IBAN: formato y dígito de control (evita domiciliar en una cuenta mal escrita).
  const iban = String(state.f.iban||"").replace(/\s/g,"");
  if(iban && !ibanValido(iban)) add($("[name=iban]").closest(".field"), tr("IBAN (el formato no parece correcto)"));
  const ibanImp = String(state.f.iban_impuestos||"").replace(/\s/g,"");
  if(state.f.iban_imp_misma === "No" && ibanImp && !ibanValido(ibanImp)) add($("[name=iban_impuestos]").closest(".field"), tr("IBAN de impuestos (el formato no parece correcto)"));
  if(state.f.c_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.f.c_email)) add($("[name=c_email]").closest(".field"), tr("Email (el formato no parece correcto)"));
  return out;
}
let marcarFaltan = false;
function marcar(){
  $$(".missing").forEach(el => { el.classList.remove("missing"); $$("input,select,textarea", el).forEach(c => c.removeAttribute("aria-invalid")); });
  if(marcarFaltan) faltan().forEach(m => { if(!m.el) return; m.el.classList.add("missing"); $$("input,select,textarea", m.el).forEach(c => { if(c.type !== "radio" && c.type !== "checkbox") c.setAttribute("aria-invalid", "true"); }); });
}
const SECS = {"s-personal":"Datos personales","s-actividad":"Actividad","s-local":"Lugar de trabajo","s-fiscal":"Fiscal","s-ss":"Seguridad Social","s-otros":"Servicio y otros"};

/* ---------- Accesibilidad ---------- */
let uid = 0;
function vincularEtiquetas(){
  $$("#fa .field").forEach(fl => {
    const lab = $("label.l", fl); if(!lab) return;
    if(!lab.id) lab.id = "fa-l" + (++uid);
    const grupo = $(".opts", fl);
    if(grupo){ grupo.setAttribute("role", "group"); grupo.setAttribute("aria-labelledby", lab.id); return; }
    const control = $("input,select,textarea", fl); if(!control) return;
    if(!control.id) control.id = "fa-c" + (++uid);
    lab.htmlFor = control.id;
    if(lab.textContent.includes("*")) control.setAttribute("aria-required", "true");
  });
  $("#steps").setAttribute("aria-label", tr("Apartados del formulario"));
}

function refresh(){
  derivar(); applyIf();
  const miss = faltan(), keys = Object.keys(SECS);
  const ok = k => !miss.some(m => m.sec===k);
  $("#prog").style.width = (keys.filter(ok).length/keys.length*100) + "%";
  $$("#steps a").forEach(a => a.classList.toggle("done", !!SECS[a.dataset.sec] && ok(a.dataset.sec)));
  const pend = keys.filter(k=>!ok(k)).map(k=>tr(SECS[k]));
  $("#resumen-check").innerHTML = pend.length
    ? `<div class="warn" style="margin:0">${tr("Faltan datos obligatorios en: <strong>{lista}</strong>.", { lista: pend.join(", ") })}</div>`
    : `<div class="note" style="margin:0">${tr("✓ Todos los apartados obligatorios están completos.")}</div>`;
  marcar();
}

/* ---------- Resumen (siempre en castellano) ---------- */
function buildSummary(){
  const L = [];
  const line = (k,v) => { if(!vacio(v)) L.push(`  ${k}: ${Array.isArray(v)?v.join(", "):v}`); };
  L.push(`FORMULARIO DE ALTA DE AUTÓNOMO - Asesoría Madal`, `Idioma del cliente: ${LANG.toUpperCase()}`);
  L.push(`Persona: ${nombreCompleto()}`);
  L.push(`Generado: ${new Date().toLocaleString("es-ES")}`, "");
  $$("#form section.card[id^=s-]").forEach(sec => {
    if(sec.id==="s-fin") return;
    L.push("== " + aEs($("h2",sec).textContent).toUpperCase() + " ==");
    $$(".field, ul.check li, .sub > h3", sec).forEach(fl => {
      if(fl.closest(".hidden")) return;
      if(fl.tagName==="H3"){ L.push(` -- ${aEs(fl.textContent)} --`); return; }
      const el = $("[name]", fl); if(!el) return;
      if(fl.tagName==="LI"){ line(aEs($("label", fl).textContent.trim()), state.f[el.name] ? "Preparado" : "Pendiente"); return; }
      line(aEs(labelOf(fl)), state.f[el.name]);
    });
    L.push("");
  });
  return L.join("\n");
}

function download(name, content, type){
  const b = new Blob([content], {type}); const a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();}, 500);
}
function baseName(){
  const n = ("alta-autonomo-" + (nombreCompleto() || "sin-nombre")).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^\w]+/g,"-").replace(/^-|-$/g,"").toLowerCase();
  return `${n}-${new Date().toISOString().slice(0,10)}`;
}
const exportJSON = () => download(`${baseName()}.json`, JSON.stringify({...state, _tipo:"alta-autonomo", _v:1, _t:new Date().toISOString()}, null, 2), "application/json");
const descargarTodo = () => { download(`${baseName()}-resumen.txt`, buildSummary(), "text/plain;charset=utf-8"); setTimeout(exportJSON, 300); };

$("#btn-export").onclick = exportJSON;
$("#btn-descargar").onclick = descargarTodo;
$("#btn-print").onclick = () => { $("#print-view").textContent = buildSummary(); window.print(); };
$("#btn-enviar").onclick = async () => {
  const msg = $("#envio-msg");
  const miss = faltan();
  if(miss.length){
    track("formulario_incompleto", { tipo: "alta_autonomo", idioma: LANG, faltan: miss.length, apartado: miss[0].sec || "" });
    marcarFaltan = true; marcar();
    msg.innerHTML = `<div class="warn" style="margin:0"><strong>${miss.length>1 ? tr("Faltan {n} datos obligatorios", { n: miss.length }) : tr("Falta 1 dato obligatorio")}</strong> ${tr("(marcados en rojo):")}<ul>${miss.slice(0,10).map(m=>`<li>${esc(m.label)}</li>`).join("")}${miss.length>10?`<li>${tr("…y {n} más", { n: miss.length-10 })}</li>`:""}</ul><button type="button" class="btn sec small" style="margin-top:8px" id="ir-falta">${tr("Ir al primero")}</button></div>`;
    $("#ir-falta").onclick = () => miss[0].el.scrollIntoView({behavior:"smooth", block:"center"});
    return;
  }
  if(!state.f.rgpd){ msg.innerHTML = `<span class="err-msg">${tr("Marca la casilla de protección de datos para poder enviar.")}</span>`; return; }
  const btn = $("#btn-enviar"); btn.disabled = true; btn.textContent = tr("Enviando…");
  try{
    const r = await fetch(ENDPOINT, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ idioma: LANG, resumen: buildSummary(), datos: state, web: $("#fa-web").value }) });
    if(!r.ok){
      const d = await r.json().catch(() => ({}));
      if(d.field === "dni") throw new Error(tr("El DNI / NIE no tiene un formato válido. Revísalo en el apartado 1."));
      throw new Error("");
    }
    track("formulario_enviado", { tipo: "alta_autonomo", idioma: LANG });
    state.f._enviado = new Date().toLocaleString("es-ES"); save();
    msg.innerHTML = `<span class="ok-msg">${tr("✓ Enviado el {fecha}. En unos minutos te llegará un correo con los próximos pasos. Si cambias algo, puedes volver a enviarlo.", { fecha: state.f._enviado })}</span>`;
  } catch(e){
    msg.innerHTML = `<span class="err-msg">${esc(e.message) || tr("No se ha podido enviar. Vuelve a intentarlo o pulsa “Descargar resumen” y envíanoslo a contacto@asesoriamadal.es.")}</span>`;
  }
  btn.disabled = false; btn.textContent = tr("Enviar a Asesoría Madal");
};
$("#btn-import").onchange = e => {
  const file = e.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result);
      if(!d.f || (d._tipo && d._tipo!=="alta-autonomo")) throw 0;
      if(!confirm(tr("Se sustituirán los datos actuales por los de la copia. ¿Continuar?"))) return;
      state = {f:d.f}; fill(); refresh(); save();
    } catch(err){ alert(tr("El archivo no es una copia válida de este formulario.")); }
  };
  r.readAsText(file); e.target.value = "";
};
$("#btn-reset").onclick = () => {
  if(!confirm(tr("Se borrarán todos los datos de este formulario en este navegador. Si quieres conservarlos, descarga antes una copia. ¿Borrar?"))) return;
  state = {f:{}}; try{localStorage.removeItem(KEY);}catch(e){}
  marcarFaltan = false; $("#envio-msg").innerHTML = "";
  fill(); refresh(); $("#saved").textContent = tr("Formulario vacío"); $("#saved").className="saved";
};

// El enlace que manda n8n (Onboarding) lleva ?nif=<NIF de la ficha>&email=<su correo>. El NIF se
// precarga y queda bloqueado: es el id de su ficha en `clientes`, y si el cliente lo escribiera mal,
// "Responden formulario" crearía otra ficha en vez de completar la suya. El correo solo se precarga.
const PARAMS = new URLSearchParams(location.search);
const NIF_ENLACE = (PARAMS.get("nif") || "").trim().toUpperCase();
const EMAIL_ENLACE = (PARAMS.get("email") || "").trim().toLowerCase();
function precargar(){
  if(/^[0-9XYZ][0-9]{7}[A-Z]$/.test(NIF_ENLACE)){
    state.f.dni = NIF_ENLACE;
    const dni = $("#form [name=dni]"); if(dni){ dni.value = NIF_ENLACE; dni.readOnly = true; }
  }
  if(EMAIL_ENLACE && !state.f.c_email){
    state.f.c_email = EMAIL_ENLACE;
    const em = $("#form [name=c_email]"); if(em) em.value = EMAIL_ENLACE;
  }
}
const had = load();
$("#form").addEventListener("input", () => {
  try { if (localStorage.getItem("fa-empezado")) return; localStorage.setItem("fa-empezado", "1"); } catch (e) {}
  track("formulario_empezado", { tipo: "alta_autonomo", idioma: LANG });
}, { once: true });
vincularEtiquetas();
fill(); refresh();
if(state.f._enviado) $("#envio-msg").innerHTML = `<span class="ok-msg">${tr("✓ Ya enviado el {fecha}. Si cambias algo, puedes volver a enviarlo.", { fecha: state.f._enviado })}</span>`;
if(had){ $("#saved").textContent = tr("✓ Datos recuperados"); $("#saved").className = "saved ok"; }
window.addEventListener("beforeunload", () => { try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} });
