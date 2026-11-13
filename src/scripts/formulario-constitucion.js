// Lógica del formulario de constitución de SL (ver FormularioConstitucion.astro).
import { track } from './analytics';

/* ======== CONFIGURACIÓN DE LA GESTORÍA ======== */
const CONFIG = {
  gestoria: "Asesoría Madal",
  email: "contacto@asesoriamadal.es",
  endpoint: "/api/constitucion"
};
/* ============================================== */

const KEY = "form-constitucion-sl-v1";
let state = { f:{}, socios:[], adminsNuevos:[] };
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
// Traducción: lo que se ve va en el idioma de la página; lo que se guarda, en castellano.
const LANG = $("#fc").dataset.lang || "es";
const I18N = JSON.parse($("#fc-i18n").textContent || "{}");
const ES = Object.fromEntries(Object.entries(I18N).map(([k, v]) => [v, k]));
const tr = (t, vars = {}) => (I18N[t] ?? t).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
const aEs = (t) => ES[t] ?? t;
const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const num = v => { const n = parseFloat(String(v||"").replace(/\./g,"").replace(",", ".")); return isNaN(n) ? 0 : n; };
// El valor de participación viene de un campo numérico, siempre con punto decimal.
const valorParticipacion = () => parseFloat(state.f.cap_nominal) || 1;
const eur = n => n.toLocaleString("es-ES",{style:"currency",currency:"EUR"});

$("#envio-hint").textContent = tr("Al pulsar “Enviar” los datos nos llegan directamente. La documentación (DNI, escrituras…) enviadla aparte a {email}.", { email: CONFIG.email });
$("#rgpd-gestoria").textContent = CONFIG.gestoria;

/* ---------- Guardado ---------- */
let saveTimer;
function save(){
  clearTimeout(saveTimer);
  $("#saved").textContent = tr("Guardando…"); $("#saved").className = "saved";
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({...state, _t: new Date().toISOString()}));
      $("#saved").textContent = tr("✓ Guardado {hora}", { hora: new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}) });
      $("#saved").className = "saved ok";
    } catch(e){ $("#saved").textContent = tr("No se pudo guardar en este navegador: usad “Descargar copia”"); }
  }, 400);
}
function load(){
  try { const raw = localStorage.getItem(KEY); if(raw){ const d = JSON.parse(raw); state = {f:d.f||{}, socios:d.socios||[], adminsNuevos:d.adminsNuevos||[]}; return true; } } catch(e){}
  return false;
}

/* ---------- Campos estáticos ---------- */
function bindStatic(){
  $("#form").addEventListener("input", onStatic);
  $("#form").addEventListener("change", onStatic);
}
function onStatic(e){
  const el = e.target;
  if(!el.name || el.closest("[data-dyn]")) return;
  if(el.type === "checkbox"){
    const group = $$(`input[type=checkbox][name="${el.name}"]`, $("#form")).filter(x=>!x.closest("[data-dyn]"));
    state.f[el.name] = group.length > 1 ? group.filter(x=>x.checked).map(x=>x.value) : (el.checked ? el.value : "");
  } else if(el.type === "radio"){
    if(el.checked) state.f[el.name] = el.value;
  } else state.f[el.name] = el.value;
  refresh(); save();
}
function fillStatic(){
  $$("#form [name]").forEach(el => {
    if(el.closest("[data-dyn]")) return;
    const v = state.f[el.name];
    if(el.type === "checkbox") el.checked = Array.isArray(v) ? v.includes(el.value) : v === el.value;
    else if(el.type === "radio") el.checked = v === el.value;
    else el.value = v ?? "";
  });
}

/* ---------- Socios ---------- */
const nuevoSocio = () => ({tipo:"Persona física", aport:"Dinero"});
function socioNombre(s, i){
  const n = s.tipo === "Persona jurídica" ? s.razon : [s.nombre, s.apellidos].filter(Boolean).join(" ");
  return n || tr("Socio {n}", { n: i+1 });
}
function socioAporta(s){
  return (s.aport !== "Bienes" ? num(s.dinero) : 0) + (s.aport !== "Dinero" ? num(s.bienes_valor) : 0);
}
function opts(name, values, cur){
  return `<div class="opts">${values.map(v=>`<label><input type="radio" name="${name}" data-k="${name.split("__")[1]}" value="${esc(v)}" ${cur===v?"checked":""}>${esc(tr(v))}</label>`).join("")}</div>`;
}
function sel(k, values, cur){
  return `<select data-k="${k}"><option value="">-</option>${values.map(v=>`<option value="${esc(v)}" ${cur===v?"selected":""}>${esc(tr(v))}</option>`).join("")}</select>`;
}
function inp(k, s, type="text", extra=""){ return `<input type="${type}" data-k="${k}" value="${esc(s[k])}" ${extra}>`; }
function f(label, html, cls="", cond=""){ return `<div class="field ${cls}" ${cond?`data-sif="${cond}"`:""}><label class="l">${tr(label)}</label>${html}</div>`; }

function renderSocios(){
  const box = $("#socios");
  if(!state.socios.length) state.socios.push(nuevoSocio());
  box.innerHTML = state.socios.map((s,i) => `
    <div class="sub" data-dyn="socio" data-i="${i}">
      <h3><span>${esc(socioNombre(s,i))}</span>${state.socios.length>1?`<button type="button" class="btn ghost" data-del="${i}">${tr("Eliminar")}</button>`:""}</h3>
      <div class="grid">
        ${f("Tipo de socio", opts(`s${i}__tipo`, ["Persona física","Persona jurídica"], s.tipo), "full")}
        ${f("Nombre *", inp("nombre",s), "", "tipo:Persona física")}
        ${f("Apellidos *", inp("apellidos",s), "", "tipo:Persona física")}
        ${f("DNI / NIE *", inp("dni",s), "", "tipo:Persona física")}
        ${f("Fecha de nacimiento *", inp("fnac",s,"date"), "", "tipo:Persona física")}
        ${f("Nacionalidad *", inp("nacionalidad",s,"text",`placeholder="${esc(tr("Española"))}"`), "", "tipo:Persona física")}
        ${f("Profesión", inp("profesion",s), "", "tipo:Persona física")}
        ${f("Estado civil *", sel("civil",["Soltero/a","Casado/a","Pareja de hecho","Divorciado/a","Viudo/a"],s.civil), "", "tipo:Persona física")}
        ${f("Régimen económico matrimonial *", sel("regimen",["Separación de bienes","Gananciales","Participación","Otro","No lo sé"],s.regimen), "", "civil:Casado/a")}
        ${f("Nombre del cónyuge *", inp("cony_nombre",s), "", "civil:Casado/a")}
        ${f("Apellidos del cónyuge *", inp("cony_apellidos",s), "", "civil:Casado/a")}
        ${f("DNI / NIE del cónyuge *", inp("cony_dni",s), "", "civil:Casado/a")}
        ${f("Razón social *", inp("razon",s), "", "tipo:Persona jurídica")}
        ${f("NIF de la sociedad *", inp("nif",s), "", "tipo:Persona jurídica")}
        ${f("Representante (nombre y DNI)", inp("representante",s), "", "tipo:Persona jurídica")}
        ${f("Domicilio completo *", inp("domicilio",s,"text",`placeholder="${esc(tr("Calle, número, piso, CP, municipio"))}"`), "full")}
        ${f("Email", inp("email",s,"email"))}
        ${f("Teléfono", inp("tel",s,"tel"))}
        ${f("¿Qué aporta?", opts(`s${i}__aport`, ["Dinero","Bienes","Dinero y bienes"], s.aport), "full")}
        ${f("Importe en dinero (€) *", inp("dinero",s,"text",'inputmode="decimal"'), "", "aport:Dinero|Dinero y bienes")}
        ${f("Bienes que aporta *", `<textarea data-k="bienes_desc" placeholder="${esc(tr("Qué es, marca/modelo, número de serie, estado… (vehículo, maquinaria, ordenadores, mobiliario, una marca, un inmueble…)"))}">${esc(s.bienes_desc)}</textarea>`, "full", "aport:Bienes|Dinero y bienes")}
        ${f("Valor de los bienes (€) *", inp("bienes_valor",s,"text",'inputmode="decimal"'), "", "aport:Bienes|Dinero y bienes")}
        <div class="field full" data-sif="aport:Bienes|Dinero y bienes"><div class="warn" style="margin:0">${tr("Los socios responden de que el valor asignado a los bienes sea real. Necesitaremos documentación (facturas, tasación, fichas técnicas) para describirlos en la escritura.")}</div></div>
        ${f("¿Es familiar de otro socio (incluido cónyuge o pareja)?", opts(`s${i}__familiar`, ["Sí","No"], s.familiar), "full", "tipo:Persona física")}
        ${f("¿De quién, qué parentesco y si conviven juntos?", inp("familiar_det",s), "full", "familiar:Sí")}
        ${f("¿Firmará en la notaría personalmente?", opts(`s${i}__firma`, ["Sí","No, firmará otra persona con poder notarial"], s.firma), "full")}
        ${f("¿Quién firmará en su nombre?", inp("apoderado",s), "full", "firma:No, firmará otra persona con poder notarial")}
        ${f("¿Trabajará en la sociedad?", opts(`s${i}__trabaja`, ["Sí","No","Aún no lo sé"], s.trabaja), "full", "tipo:Persona física")}

      </div>
    </div>`).join("");
  applySif(box);
}
function applySif(root){
  $$("[data-dyn]", root).forEach(card => {
    const arr = card.dataset.dyn === "socio" ? state.socios : state.adminsNuevos;
    const s = arr[+card.dataset.i] || {};
    $$("[data-sif]", card).forEach(el => {
      const [k, vals] = el.dataset.sif.split(":");
      el.classList.toggle("hidden", !vals.split("|").includes(s[k] || ""));
    });
  });
}
function bindDyn(root, arrName, rerender){
  root.addEventListener("input", e => dynChange(e, arrName, rerender));
  root.addEventListener("change", e => dynChange(e, arrName, rerender));
  root.addEventListener("click", e => {
    const d = e.target.closest("[data-del]"); if(!d) return;
    if(!confirm(tr("¿Eliminar esta persona y sus datos?"))) return;
    state[arrName].splice(+d.dataset.del, 1); rerender(); refresh(); save();
  });
}
function dynChange(e, arrName, rerender){
  const el = e.target, k = el.dataset.k; if(!k) return;
  const card = el.closest("[data-dyn]"); const i = +card.dataset.i;
  const obj = state[arrName][i];
  if(el.type === "radio"){ if(!el.checked) return; obj[k] = el.value; }
  else obj[k] = el.value;
  applySif(card.parentElement);
  if(arrName === "socios" && card.closest("#socios") && ["nombre","apellidos","razon","tipo"].includes(k)) $("h3 span", card).textContent = socioNombre(obj, i);
  if(arrName === "adminsNuevos" && ["nombre","apellidos"].includes(k)) $("h3 span", card).textContent = [obj.nombre,obj.apellidos].filter(Boolean).join(" ") || tr("Administrador/a {n}", { n: i+1 });
  refresh(); save();
}

/* ---------- Quién tiene certificado ---------- */
function personasCert(){
  return [...state.socios.filter(s=>s.tipo!=="Persona jurídica").map((s,i)=>socioNombre(s,state.socios.indexOf(s))),
          ...state.adminsNuevos.map((a,i)=>[a.nombre,a.apellidos].filter(Boolean).join(" ") || tr("Administrador/a {n}", { n: i+1 }))];
}
let certSig = "";
function renderCertQuien(){
  const ps = personasCert(), sel = state.f.cert_quien || [];
  const sig = ps.join("|")+"#"+sel.join("|"); if(sig===certSig) return; certSig = sig;
  $("#cert-quien").innerHTML = ps.map(n=>`<label><input type="checkbox" data-certq="${esc(n)}" ${sel.includes(n)?"checked":""}>${esc(n)}</label>`).join("")
    || `<span class="hint">${tr("Primero añadid los socios.")}</span>`;
}
$("#cert-quien").addEventListener("change", e => {
  const n = e.target.dataset.certq; if(n===undefined) return;
  const sel = new Set(state.f.cert_quien || []); e.target.checked ? sel.add(n) : sel.delete(n);
  state.f.cert_quien = [...sel]; refresh(); save();
});

/* ---------- Seguridad Social de administradores ---------- */
function ssFields(o, prefix){
  return `
        ${f("¿Está ya dado de alta como autónomo? *", opts(`${prefix}__adm_reta`, ["Sí","No"], o.adm_reta), "full")}
        ${f("¿Tiene nº de afiliación a la Seguridad Social? *", opts(`${prefix}__adm_naf_tiene`, ["Sí","No, que lo pida Asesoría Madal"], o.adm_naf_tiene), "full")}
        ${f("Nº de afiliación a la Seguridad Social *", inp("adm_naf",o), "", "adm_naf_tiene:Sí")}
        ${f("IBAN donde se le domicilian las cuotas de autónomo *", inp("adm_iban",o,"text",'placeholder="ES00 0000 0000 0000 0000 0000"'), "", "adm_reta:Sí")}
        <div class="field full" data-sif="adm_reta:No"><div class="note" style="margin:0">${tr("Tendrá que rellenar y firmar el <strong>mandato de domiciliación</strong> de las cuotas de autónomo. Os lo enviaremos nosotros.")}</div></div>`;
}
let admSig = "";
function renderAdmSS(){
  const list = state.socios.map((s,i)=>({s,i})).filter(x=>x.s.esAdmin);
  const sig = list.map(x=>x.i+":"+socioNombre(x.s,x.i)).join("|");
  if(sig === admSig) return; admSig = sig;
  $("#adm-ss").innerHTML = list.map(({s,i}) => `
    <div class="sub" data-dyn="socio" data-i="${i}">
      <h3><span>${esc(socioNombre(s,i))} · ${tr("administrador/a")}</span></h3>
      <div class="grid">${ssFields(s, `ss${i}`)}</div>
    </div>`).join("");
  applySif($("#adm-ss"));
}
const todosAdmins = () => [...state.socios.filter(s=>s.esAdmin), ...state.adminsNuevos];

/* ---------- Administradores no socios ---------- */
function renderAdmins(){
  $("#admins-nuevos").innerHTML = state.adminsNuevos.map((a,i)=>`
    <div class="sub" data-dyn="admin" data-i="${i}">
      <h3><span>${esc([a.nombre,a.apellidos].filter(Boolean).join(" ") || tr("Administrador/a {n}", { n: i+1 }))}</span><button type="button" class="btn ghost" data-del="${i}">${tr("Eliminar")}</button></h3>
      <div class="grid">
        ${f("Nombre *", inp("nombre",a))}
        ${f("Apellidos *", inp("apellidos",a))}
        ${f("DNI / NIE *", inp("dni",a))}
        ${f("Nacionalidad", inp("nacionalidad",a))}
        ${f("Fecha de nacimiento", inp("fnac",a,"date"))}
        ${f("Estado civil", sel("civil",["Soltero/a","Casado/a","Pareja de hecho","Divorciado/a","Viudo/a"],a.civil))}
        ${f("Domicilio completo *", inp("domicilio",a), "full")}
        ${f("Email", inp("email",a,"email"))}
        ${f("Teléfono", inp("tel",a,"tel"))}
        ${ssFields(a, `a${i}`)}
      </div>
    </div>`).join("");
}
function renderAdmSocios(){
  $("#adm-socios").innerHTML = state.socios.map((s,i)=>
    `<label><input type="checkbox" data-admsocio="${i}" ${s.esAdmin?"checked":""}>${esc(socioNombre(s,i))}</label>`).join("");
}
$("#adm-socios").addEventListener("change", e => {
  const i = e.target.dataset.admsocio; if(i===undefined) return;
  state.socios[+i].esAdmin = e.target.checked; refresh(); save();
});

/* ---------- Capital ---------- */
function renderCapital(){
  const nominal = valorParticipacion();
  const total = state.socios.reduce((t,s)=>t+socioAporta(s),0);
  const dinero = state.socios.reduce((t,s)=>t+(s.aport!=="Bienes"?num(s.dinero):0),0);
  const rows = state.socios.map((s,i)=>{
    const a = socioAporta(s), pct = total ? a/total*100 : 0;
    return `<tr><td>${esc(socioNombre(s,i))}</td><td>${esc(tr(s.aport||""))}</td><td class="n">${eur(a)}</td><td class="n">${pct.toLocaleString("es-ES",{maximumFractionDigits:2})} %</td><td class="n">${Math.floor(a/nominal).toLocaleString("es-ES")}</td></tr>`;
  }).join("");
  $("#cap-tabla").innerHTML = `<div style="overflow-x:auto" tabindex="0" role="region" aria-label="${esc(tr("Capital social total"))}"><table class="cap"><thead><tr><th>${tr("Socio")}</th><th>${tr("Aportación")}</th><th class="n">${tr("Importe")}</th><th class="n">${tr("% capital")}</th><th class="n">${tr("Participaciones")}</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><td colspan="2">${tr("Capital social total")}</td><td class="n">${eur(total)}</td><td class="n">100 %</td><td class="n">${Math.floor(total/nominal).toLocaleString("es-ES")}</td></tr></tfoot></table></div>
    <p class="hint">${tr("En dinero: {d} · En bienes: {b}", { d: eur(dinero), b: eur(total-dinero) })}</p>`;
  let av = "";
  if(total > 0 && total < 3000) av += `<div class="warn">${tr("El capital es inferior a 3.000 €. Está permitido (mínimo 1 €), pero la sociedad tendrá que destinar al menos el 20 % de sus beneficios a reserva legal hasta que capital y reserva sumen 3.000 €.")}</div>`;
  const nonInt = state.socios.some(s => Math.abs(socioAporta(s)/nominal - Math.round(socioAporta(s)/nominal)) > 1e-6);
  if(total > 0 && nonInt) av += `<div class="warn">${tr("Alguna aportación no es múltiplo del valor de la participación ({v}). Revisad los importes o el valor de cada participación.", { v: eur(nominal) })}</div>`;
  if(total > 0) av += `<p class="hint">${tr("Con estatutos tipo y un capital de hasta 3.100 €, los aranceles de notaría y registro son reducidos.")}</p>`;
  $("#cap-aviso").innerHTML = av;
  // flags para documentación
  state.f.hay_bienes = state.socios.some(s=>s.aport && s.aport!=="Dinero") ? "1" : "";
  state.f.hay_juridica = state.socios.some(s=>s.tipo==="Persona jurídica") ? "1" : "";
  state.f.hay_dinero = dinero>0 ? "1" : "";
  state.f.doc_cert_flag = (state.f.cap_momento==="Antes de la firma" && dinero>0) ? "1" : "";
  state.f.doc_mandato_flag = todosAdmins().some(a=>a.adm_reta==="No") ? "1" : "";
  state.f.hay_extranjero = [...state.socios, ...state.adminsNuevos].some(s=>s.nacionalidad && !/espa|spanish/i.test(s.nacionalidad)) ? "1" : "";
}

/* ---------- Comprobaciones ---------- */
function adminCount(){ return state.socios.filter(s=>s.esAdmin).length + state.adminsNuevos.length; }
function checkAdmin(){
  const t = state.f.adm_tipo, n = adminCount();
  let msg = "";
  if(!t) msg = "";
  else if(t==="Administrador único" && n!==1) msg = tr("Con administrador único tiene que haber exactamente 1 persona (ahora hay {n}).", { n });
  else if((t==="Administradores solidarios"||t==="Administradores mancomunados") && n<2) msg = tr("Esta forma requiere al menos 2 administradores (ahora hay {n}).", { n });
  else if(t==="Consejo de administración" && (n<3||n>12)) msg = tr("El consejo debe tener entre 3 y 12 miembros (ahora hay {n}).", { n });
  const pjAdmin = state.socios.some(s=>s.esAdmin && s.tipo==="Persona jurídica");
  $("#adm-check").innerHTML = (msg ? `<span class="err-msg">${msg}</span>` : (t && n ? `<span class="ok-msg">${n>1 ? tr("✓ {n} administradores seleccionados", { n }) : tr("✓ 1 administrador seleccionado")}</span>` : ""))
    + (pjAdmin ? `<div class="warn" style="margin-top:8px">${tr("Si una sociedad es administradora, no se pueden usar estatutos tipo (el trámite es algo más lento y caro) y tendrá que designar a una persona física que la represente.")}</div>` : "");
  return !msg && t && n;
}
const vacio = v => Array.isArray(v) ? v.length===0 : !String(v ?? "").trim();
const visibleEl = el => !el.closest(".hidden");
const labelOf = fl => ($("label.l", fl)?.textContent || "").replace("*","").trim();
function faltan(){
  const out = [];
  const add = (el, label) => out.push({el, label, sec: el.closest("section.card")?.id});
  $$("[data-req]").forEach(el => { if(visibleEl(el) && vacio(state.f[el.name])) add(el.closest(".field, .den-row") || el, el.closest(".den-row") ? tr("Nombre opción {n}", { n: $("b", el.closest(".den-row")).textContent }) : labelOf(el.closest(".field"))); });
  $$("[data-req-group]").forEach(el => { if(visibleEl(el) && vacio(state.f[el.dataset.reqGroup])) add(el.closest(".field"), labelOf(el.closest(".field"))); });
  $$("[data-dyn]").forEach(card => {
    const arr = card.dataset.dyn==="socio" ? state.socios : state.adminsNuevos, o = arr[+card.dataset.i] || {};
    const who = $("h3 span", card).textContent;
    $$(".field", card).forEach(fl => {
      if(!visibleEl(fl) || !$("label.l", fl)?.textContent.includes("*")) return;
      const inpEl = $("[data-k]", fl); if(!inpEl) return;
      const k = inpEl.dataset.k, v = o[k];
      const bad = vacio(v) || (["dinero","bienes_valor"].includes(k) && !(num(v)>0));
      if(bad) add(fl, `${who}: ${labelOf(fl)}`);
    });
  });
  if(state.f.cert==="Sí" && vacio(state.f.cert_quien)) add($("#cert-field"), tr("Quién tiene certificado digital / Cl@ve"));
  if(!checkAdmin()) add($("#adm-check").closest("section") .querySelector(".field"), tr("Forma de administración y administradores"));
  return out;
}
function sectionStatus(){
  const st = {}, miss = faltan();
  $$("section.card[id^=s-]").forEach(sec => st[sec.id] = !miss.some(m => m.sec===sec.id));
  st["s-capital"] = st["s-capital"] && state.socios.reduce((t,s)=>t+socioAporta(s),0) > 0;
  return st;
}
let marcarFaltan = false;
function marcar(){
  $$(".missing").forEach(el => { el.classList.remove("missing"); $$("input,select,textarea", el).forEach(c => c.removeAttribute("aria-invalid")); });
  if(marcarFaltan) faltan().forEach(m => { if(!m.el) return; m.el.classList.add("missing"); $$("input,select,textarea", m.el).forEach(c => { if(c.type !== "radio" && c.type !== "checkbox") c.setAttribute("aria-invalid", "true"); }); });
}
const NOMBRES = {"s-contacto":"Contacto","s-nombre":"Nombre","s-domicilio":"Domicilio","s-actividad":"Actividad","s-socios":"Socios","s-capital":"Capital","s-admin":"Administración","s-fiscal":"Fiscal"};

/* ---------- Visibilidad condicional estática ---------- */
function applyIf(){
  $$("[data-if]").forEach(el => {
    const [k, vals] = el.dataset.if.split(":");
    el.classList.toggle("hidden", !vals.split("|").includes(String(state.f[k]||"")));
  });
}

/* ---------- Accesibilidad: el marcado se genera por JavaScript, así que se enlaza aquí ---------- */
let fcUid = 0;
function vincularEtiquetas(){
  $$("#fc .field").forEach(fl => {
    const lab = $("label.l", fl); if(!lab) return;
    if(!lab.id) lab.id = "fc-l" + (++fcUid);
    const grupo = $(".opts", fl);
    if(grupo){ grupo.setAttribute("role", "group"); grupo.setAttribute("aria-labelledby", lab.id); return; }
    const control = $("input,select,textarea", fl); if(!control) return;
    if(!control.id) control.id = "fc-c" + (++fcUid);
    lab.htmlFor = control.id;
    if(lab.textContent.includes("*")) control.setAttribute("aria-required", "true");
  });
  $$("#fc .den-row").forEach(row => {
    const input = $("input", row);
    input.setAttribute("aria-label", tr("Nombre opción {n}", { n: $("b", row).textContent }));
    if(input.hasAttribute("data-req")) input.setAttribute("aria-required", "true");
  });
  $("#steps").setAttribute("aria-label", tr("Apartados del formulario"));
}

function refresh(){
  vincularEtiquetas();
  renderCapital();
  renderAdmSocios();
  renderAdmSS();
  applyIf();
  const st = sectionStatus(); renderCertQuien(); marcar();
  const keys = Object.keys(NOMBRES);
  const done = keys.filter(k=>st[k]).length;
  $("#prog").style.width = (done/keys.length*100) + "%";
  $$("#steps a").forEach(a => a.classList.toggle("done", !!(st[a.dataset.sec] && NOMBRES[a.dataset.sec])));
  const pend = keys.filter(k=>!st[k]).map(k=>tr(NOMBRES[k]));
  $("#num-socios").textContent = tr("Número de socios: {n}", { n: state.socios.length });
  $("#resumen-check").innerHTML = pend.length
    ? `<div class="warn" style="margin:0">${tr("Faltan datos obligatorios en: <strong>{lista}</strong>. Completadlos para poder enviarlo.", { lista: pend.join(", ") })}</div>`
    : `<div class="note" style="margin:0">${tr("✓ Todos los apartados obligatorios están completos.")}</div>`;
}

/* ---------- Resumen en texto ---------- */
function buildSummary(){
  const L = [];
  const line = (k,v) => { if(v!==undefined && v!==null && String(v).trim()!=="") L.push(`  ${k}: ${Array.isArray(v)?v.join(", "):v}`); };
  L.push(`FORMULARIO DE CONSTITUCIÓN DE SL - ${CONFIG.gestoria}`, `Idioma del cliente: ${LANG.toUpperCase()}`);
  L.push(`Generado: ${new Date().toLocaleString("es-ES")}`, "");
  $$("section.card[id^=s-]").forEach(sec => {
    if(["s-socios","s-capital","s-admin","s-fin"].includes(sec.id)) return;
    L.push("== " + aEs($("h2",sec).textContent).toUpperCase() + " ==");
    $$(".field, .den-row, ul.check li", sec).forEach(fl => {
      if(fl.closest(".hidden")) return;
      if(fl.id==="cert-field"){ line("Quién tiene certificado / Cl@ve", state.f.cert_quien); return; }
      const el = $("[name]", fl); if(!el) return;
      const lab = fl.classList.contains("den-row") ? `Nombre opción ${$("b",fl).textContent}` : aEs(($("label.l",fl)||fl).textContent.replace("*","").trim());
      let v = state.f[el.name];
      if(fl.tagName==="LI") v = v ? "Preparado" : "Pendiente";
      line(lab, v);
    });
    L.push("");
    if(sec.id==="s-actividad"){
      L.push("== 5. SOCIOS (" + state.socios.length + ") ==");
      state.socios.forEach((s,i)=>{
        L.push(` Socio ${i+1}: ${socioNombre(s,i)}`);
        const F = s.tipo==="Persona jurídica"
          ? [["Tipo",s.tipo],["Razón social",s.razon],["NIF",s.nif],["Representante",s.representante]]
          : [["Tipo",s.tipo],["DNI/NIE",s.dni],["Fecha nacimiento",s.fnac],["Nacionalidad",s.nacionalidad],["Profesión",s.profesion],["Estado civil",s.civil],["Régimen matrimonial",s.civil==="Casado/a"?s.regimen:""],["Cónyuge",s.civil==="Casado/a"?[s.cony_nombre,s.cony_apellidos,s.cony_dni&&("DNI/NIE "+s.cony_dni)].filter(Boolean).join(" "):""]];
        F.push(["Domicilio",s.domicilio],["Email",s.email],["Teléfono",s.tel],["Aporta",s.aport]);
        if(s.aport!=="Bienes") F.push(["Dinero (€)",s.dinero]);
        if(s.aport!=="Dinero") F.push(["Bienes",s.bienes_desc],["Valor bienes (€)",s.bienes_valor]);
        if(s.tipo!=="Persona jurídica") F.push(["Familiar de otro socio",s.familiar],["Parentesco / convivencia",s.familiar==="Sí"?s.familiar_det:""]);
        F.push(["Firma personalmente",s.firma],["Apoderado",s.firma&&s.firma!=="Sí"?s.apoderado:""]);
        F.push(["Trabajará en la sociedad",s.trabaja]);
        F.push(["Administrador/a",s.esAdmin?"Sí":"No"]);
        F.forEach(([k,v])=>line(k,v));
      });
      L.push("");
      const total = state.socios.reduce((t,s)=>t+socioAporta(s),0), nominal = valorParticipacion();
      L.push("== 6. CAPITAL SOCIAL ==");
      line("Capital total", eur(total)); line("Valor participación", eur(nominal)); line("Nº participaciones", Math.floor(total/nominal));
      state.socios.forEach((s,i)=>{ const a=socioAporta(s); line(socioNombre(s,i), `${eur(a)} (${total?(a/total*100).toFixed(2):0} %) - ${s.aport||""}`); });
      line("Aportación del dinero", state.f.cap_momento); L.push("");
      L.push("== 7. ADMINISTRACIÓN ==");
      line("Forma", state.f.adm_tipo);
      const ss = a => [["Ya es autónomo",a.adm_reta],["Nº afiliación SS",a.adm_naf_tiene==="Sí"?a.adm_naf:(a.adm_naf_tiene?"Lo pide Asesoría Madal":"")],["IBAN cuotas autónomo",a.adm_reta==="Sí"?a.adm_iban:""],["Mandato de domiciliación",a.adm_reta==="No"?"Pendiente de firmar":""]];
      state.socios.forEach((s,i)=>{ if(!s.esAdmin) return; L.push(` Administrador/a (socio): ${socioNombre(s,i)}`); ss(s).forEach(([k,v])=>line(k,v)); });
      state.adminsNuevos.forEach((a,i)=>{
        L.push(` Administrador/a no socio ${i+1}:`);
        [["Nombre",[a.nombre,a.apellidos].filter(Boolean).join(" ")],["DNI/NIE",a.dni],["Nacionalidad",a.nacionalidad],["Fecha nacimiento",a.fnac],["Estado civil",a.civil],["Domicilio",a.domicilio],["Email",a.email],["Teléfono",a.tel],...ss(a)].forEach(([k,v])=>line(k,v));
      });
      line("Cargo retribuido", state.f.adm_retrib); line("Detalle retribución", state.f.adm_retrib==="Sí"?state.f.adm_retrib_det:"");
      L.push("");
    }
  });
  return L.join("\n");
}

function download(name, content, type){
  const b = new Blob([content], {type}); const a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();}, 500);
}
function baseName(){
  const n = (state.f.den1 || "constitucion-sl").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w]+/g,"-").replace(/^-|-$/g,"").toLowerCase();
  return `${n}-${new Date().toISOString().slice(0,10)}`;
}
const exportJSON = () => download(`${baseName()}.json`, JSON.stringify({...state, _v:1, _t:new Date().toISOString()}, null, 2), "application/json");

$("#btn-export").onclick = exportJSON;
const descargarTodo = () => { download(`${baseName()}-resumen.txt`, buildSummary(), "text/plain;charset=utf-8"); setTimeout(exportJSON, 300); };
$("#btn-descargar").onclick = descargarTodo;
$("#btn-enviar").onclick = async () => {
  const msg = $("#envio-msg");
  const miss = faltan();
  if(miss.length){
    track("formulario_incompleto", { tipo: "constitucion", idioma: LANG, faltan: miss.length, apartado: miss[0].sec || "" });
    marcarFaltan = true; marcar();
    msg.innerHTML = `<div class="warn" style="margin:0"><strong>${miss.length>1 ? tr("Faltan {n} datos obligatorios", { n: miss.length }) : tr("Falta 1 dato obligatorio")}</strong> ${tr("(marcados en rojo):")}<ul>${miss.slice(0,10).map(m=>`<li>${esc(m.label)}</li>`).join("")}${miss.length>10?`<li>${tr("…y {n} más", { n: miss.length-10 })}</li>`:""}</ul><button type="button" class="btn sec small" style="margin-top:8px" id="ir-falta">${tr("Ir al primero")}</button></div>`;
    $("#ir-falta").onclick = () => miss[0].el.scrollIntoView({behavior:"smooth", block:"center"});
    return;
  }
  if(!state.f.rgpd){ msg.innerHTML = `<span class="err-msg">${tr("Marcad la casilla de protección de datos para poder enviar.")}</span>`; return; }
  const btn = $("#btn-enviar"); btn.disabled = true; btn.textContent = tr("Enviando…");
  try{
    const lead = new URLSearchParams(location.search).get("lead");
    const r = await fetch(CONFIG.endpoint, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ lead, idioma: LANG, resumen: buildSummary(), datos: state, web: $("#fc-web").value }) });
    if(!r.ok) throw new Error("HTTP " + r.status);
    track("formulario_enviado", { tipo: "constitucion", idioma: LANG });
    state.f._enviado = new Date().toLocaleString("es-ES"); save();
    msg.innerHTML = `<span class="ok-msg">${tr("✓ Enviado el {fecha}. Os contactaremos. Si cambiáis algo, podéis volver a enviarlo.", { fecha: state.f._enviado })}</span>`;
  } catch(e){
    msg.innerHTML = `<span class="err-msg">${tr("No se ha podido enviar. Volved a intentarlo o pulsad “Descargar resumen” y enviádnoslo a contacto@asesoriamadal.es.")}</span>`;
  }
  btn.disabled = false; btn.textContent = tr("Enviar a Asesoría Madal");
};
$("#btn-print").onclick = () => {
  $("#print-view").textContent = buildSummary();
  window.print();
};
$("#btn-import").onchange = e => {
  const file = e.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result);
      if(!d.f) throw 0;
      if(!confirm(tr("Se sustituirán los datos actuales por los de la copia. ¿Continuar?"))) return;
      state = {f:d.f, socios:d.socios||[], adminsNuevos:d.adminsNuevos||[]};
      initRender(); save();
    } catch(err){ alert(tr("El archivo no es una copia válida de este formulario.")); }
  };
  r.readAsText(file); e.target.value = "";
};
$("#btn-reset").onclick = () => {
  if(!confirm(tr("Se borrarán todos los datos de este formulario en este navegador. Si queréis conservarlos, descargad antes una copia. ¿Borrar?"))) return;
  state = {f:{}, socios:[], adminsNuevos:[]}; try{localStorage.removeItem(KEY);}catch(e){}
  initRender(); $("#saved").textContent = tr("Formulario vacío"); $("#saved").className="saved";
};
$("#add-socio").onclick = () => { state.socios.push(nuevoSocio()); renderSocios(); refresh(); save(); $$("#socios .sub").pop().scrollIntoView({behavior:"smooth",block:"start"}); };
$("#add-admin").onclick = () => { state.adminsNuevos.push({}); renderAdmins(); refresh(); save(); };

function initRender(){ admSig = "#"; certSig = "#"; fillStatic(); renderSocios(); renderAdmins(); refresh(); }

const had = load();
bindStatic();
// Una vez por navegador, para que volver a un formulario guardado no cuente como empezarlo otra vez.
$("#form").addEventListener("input", () => {
  try { if (localStorage.getItem("fc-empezado")) return; localStorage.setItem("fc-empezado", "1"); } catch (e) {}
  track("formulario_empezado", { tipo: "constitucion", idioma: LANG });
}, { once: true });
bindDyn($("#socios"), "socios", renderSocios);
bindDyn($("#admins-nuevos"), "adminsNuevos", renderAdmins);
bindDyn($("#adm-ss"), "socios", ()=>{});
initRender();
if(state.f._enviado) $("#envio-msg").innerHTML = `<span class="ok-msg">${tr("✓ Ya enviado el {fecha}. Si cambiáis algo, podéis volver a enviarlo.", { fecha: state.f._enviado })}</span>`;
if(had){ $("#saved").textContent = tr("✓ Datos recuperados"); $("#saved").className = "saved ok"; }
window.addEventListener("beforeunload", () => { try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} });
