// Apartado Laboral del portal: incidencias mensuales (plantilla Excel), trabajadores, bajas y altas.
// Lo llama Portal.astro con iniciarLaboral() cada vez que se pinta un cliente (el propio o, siendo admin,
// el elegido). Los eventos se enganchan una sola vez; las siguientes llamadas solo cambian el cliente y repintan.
//
// Seguridad: todo pasa por Supabase con RLS (el cliente solo ve e inserta lo suyo). Lo que se valida aquí es para
// dar el error al momento; n8n ("Incidencias laborales a Cegid") vuelve a validarlo todo al cargar en DiezNom.
import { LABORAL, MESES_LABORAL, type TextosLaboral } from '../i18n/laboral';
import {
  TIPOS_INCIDENCIA, TIPO_POR_CLAVE, tipoPorNombre, nombreTipo, plazoIncidencias, DIA_LIMITE_INCIDENCIAS, CAUSAS_BAJA,
  type IdiomaPortal, type TipoIncidencia,
} from '../lib/incidenciasLaborales';

type Fila = Record<string, any>;
interface Estado {
  supabase: any;
  cliente: { id: string; nombre: string; email?: string | null };
  lang: IdiomaPortal;
  soloLectura: boolean;
  t: TextosLaboral;
  empleados: Fila[];
  cargas: Fila[];
  altas: Fila[];
  bajas: Fila[];
  mes: { anio: number; mes: number };
  enviando: boolean;
  sondeos: number;
  temporizador: number | undefined;
}

const ES_PRUEBA = /^PENDIENTE-/;
const MAX_FILAS = 500;
const FILAS_PLANTILLA = 300;
const GRUPOS = ['ausencias', 'bajas', 'variables', 'pluses', 'deducciones'] as const;

let E: Estado | null = null;
let enganchado = false;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const tpl = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_m, k) => String(v[k] ?? ''));

function crear<K extends keyof HTMLElementTagNameMap>(tag: K, texto?: string, clase?: string): HTMLElementTagNameMap[K] {
  const x = document.createElement(tag);
  if (texto !== undefined) x.textContent = texto;
  if (clase) x.className = clase;
  return x;
}

function fechaLarga(d: Date): string {
  const loc = E!.lang === 'ca' ? 'ca-ES' : E!.lang === 'en' ? 'en-GB' : 'es-ES';
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
}
function fechaCorta(iso: string): string {
  const loc = E!.lang === 'ca' ? 'ca-ES' : E!.lang === 'en' ? 'en-GB' : 'es-ES';
  return new Date(iso).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
const nombreMes = (mes: number) => MESES_LABORAL[E!.lang][mes - 1];

/** Mes que acaba de terminar (el de la nómina que se prepara, por defecto) y el anterior a ese (envíos con retraso). */
function mesesDisponibles(): { anio: number; mes: number }[] {
  const atras = (a: number, m: number) => (m === 1 ? { anio: a - 1, mes: 12 } : { anio: a, mes: m - 1 });
  const hoy = new Date();
  const ult = atras(hoy.getFullYear(), hoy.getMonth() + 1);
  return [ult, atras(ult.anio, ult.mes)];
}

const empleadosActivos = () => E!.empleados.filter((e) => !e.fecha_baja);
const etiquetaTrabajador = (e: Fila) => `${e.nombre}${e.nif ? ' (' + e.nif + ')' : ''} #${e.codigo_empleado}`;

// ---------------------------------------------------------------------------------------------------------------
// Carga de datos y pintado
// ---------------------------------------------------------------------------------------------------------------
async function cargarDatos(): Promise<void> {
  if (!E) return;
  const { supabase, cliente } = E;
  const [emp, car, alt, baj] = await Promise.all([
    supabase.from('empleados_nomina').select('codigo_empleado, nif, nombre, fecha_alta, fecha_baja').eq('cliente_id', cliente.id).order('nombre'),
    supabase.from('incidencias_cargas').select('id, anio, mes, estado, resumen, created_at, nombre_archivo').eq('cliente_id', cliente.id)
      .neq('estado', 'subiendo').order('created_at', { ascending: false }).limit(24),
    supabase.from('altas_trabajadores').select('id, nombre_completo, fecha_inicio, created_at, tramitado_at, cegid_enviado_at, cegid_error').ilike('empresa_nif', cliente.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('bajas_trabajadores').select('id, trabajador_nombre, fecha_baja, causa, created_at, tramitado_at, cegid_enviado_at, cegid_error').eq('cliente_id', cliente.id).order('created_at', { ascending: false }).limit(20),
  ]);
  E.empleados = emp.data ?? [];
  E.cargas = car.data ?? [];
  E.altas = alt.data ?? [];
  E.bajas = baj.data ?? [];
}

function cargaDelMes(): Fila | undefined {
  return E!.cargas.find((c) => c.anio === E!.mes.anio && c.mes === E!.mes.mes && c.estado !== 'sustituida');
}

async function pintar(): Promise<void> {
  if (!E) return;
  const { t } = E;
  $('lab-solo-lectura').hidden = !E.soloLectura;
  pintarSelectorMes();
  const activos = empleadosActivos();
  const sinTrabajadores = activos.length === 0;
  const sinNada = sinTrabajadores && E.altas.length === 0;

  // --- Incidencias del mes
  const carga = cargaDelMes();
  const chip = $('lab-estado');
  const total = carga?.resumen?.total;
  let textoEstado = t.inc.estado.sinEnviar;
  let clase = 'lab-chip is-pend';
  if (carga) {
    if (carga.estado === 'pendiente') { textoEstado = t.inc.estado.pendiente; clase = 'lab-chip is-proc'; }
    else if (carga.estado === 'con_errores') { textoEstado = t.inc.estado.conErrores; clase = 'lab-chip is-err'; }
    else if (total === 0) { textoEstado = t.inc.estado.sinIncidencias; clase = 'lab-chip is-ok'; }
    else { textoEstado = t.inc.estado.cargada; clase = 'lab-chip is-ok'; }
  }
  chip.textContent = textoEstado;
  chip.className = clase;
  const plazo = plazoIncidencias(E.mes.anio, E.mes.mes);
  const plazoEl = $('lab-plazo');
  const vencido = new Date() > plazo && !carga;
  plazoEl.textContent = tpl(vencido ? t.inc.plazoVencido : t.inc.plazo, { fecha: fechaLarga(plazo) });
  plazoEl.className = vencido ? 'lab-plazo is-vencido' : 'lab-plazo';
  $('lab-sin-trabajadores').hidden = !sinTrabajadores;
  $('lab-inc-controles').hidden = sinTrabajadores;
  const lectura = E.soloLectura;
  ($('lab-subir-wrap') as HTMLElement).hidden = lectura;
  ($('lab-sin-inc') as HTMLButtonElement).hidden = lectura;
  $('lab-descargar').textContent = tpl(t.inc.descargar, { mes: nombreMes(E.mes.mes) });
  await pintarResultado(carga);

  // --- Trabajadores y bajas
  pintarTrabajadores();
  pintarBajas();

  // --- Altas
  $('lab-alta-vacio').hidden = !sinNada;
  $('lab-alta-normal').hidden = sinNada;
  const href = enlaceAlta();
  for (const id of ['lab-alta-btn-vacio', 'lab-alta-btn']) ($(id) as HTMLAnchorElement).href = href;
  $('lab-alta-btn').textContent = activos.length || E.altas.length ? t.alta.botonOtro : t.alta.boton;
  pintarAltas();

  // Mientras la carga se está procesando, se vuelve a mirar cada pocos segundos (n8n corre cada 5 minutos).
  window.clearTimeout(E.temporizador);
  if (carga?.estado === 'pendiente' && E.sondeos < 40) {
    E.sondeos += 1;
    E.temporizador = window.setTimeout(async () => { await cargarDatos(); await pintar(); }, 15000);
  }
}

function pintarSelectorMes() {
  const sel = $('lab-mes') as HTMLSelectElement;
  const { t } = E!;
  const [act, ant] = mesesDisponibles();
  const valor = `${E!.mes.anio}-${E!.mes.mes}`;
  sel.textContent = '';
  for (const [m, plantilla] of [[act, t.inc.mesActual], [ant, t.inc.mesAnterior]] as const) {
    const o = crear('option', tpl(plantilla, { mes: `${nombreMes(m.mes)} ${m.anio}` }));
    o.value = `${m.anio}-${m.mes}`;
    sel.appendChild(o);
  }
  sel.value = valor;
}

async function pintarResultado(carga: Fila | undefined) {
  const caja = $('lab-resultado');
  caja.textContent = '';
  if (!E || !carga) { caja.hidden = true; return; }
  const { t } = E;
  const { data } = await E.supabase.from('incidencias_lineas').select('fila, trabajador_codigo, tipo, estado, detalle')
    .eq('carga_id', carga.id).order('fila');
  const lineas: Fila[] = data ?? [];
  caja.hidden = false;
  caja.appendChild(crear('h4', t.inc.resultado));
  caja.appendChild(crear('p', tpl(t.inc.ultimaCarga, { fecha: fechaCorta(carga.created_at) }), 'lab-nota'));
  if (!lineas.length) return;
  const tabla = crear('table', undefined, 'lab-tabla');
  const cab = tabla.createTHead().insertRow();
  for (const h of [t.inc.cols.fila, t.inc.cols.trabajador, t.inc.cols.tipo, t.inc.cols.estado, t.inc.cols.detalle]) cab.appendChild(crear('th', h));
  const cuerpo = tabla.createTBody();
  const nombres = new Map(E.empleados.map((e) => [e.codigo_empleado, e.nombre]));
  for (const l of lineas) {
    const tr = cuerpo.insertRow();
    tr.appendChild(crear('td', String(l.fila)));
    tr.appendChild(crear('td', nombres.get(l.trabajador_codigo) ?? String(l.trabajador_codigo)));
    tr.appendChild(crear('td', nombreTipo(l.tipo, E.lang)));
    const est = crear('td');
    est.appendChild(crear('span', (t.inc.estadoLinea as any)[l.estado] ?? l.estado, 'lab-chip is-' + (l.estado === 'cargada' ? 'ok' : l.estado === 'error' ? 'err' : l.estado === 'revisar' ? 'rev' : 'proc')));
    tr.appendChild(est);
    tr.appendChild(crear('td', l.detalle ?? ''));
  }
  const envoltorio = crear('div', undefined, 'lab-tabla-caja');
  envoltorio.appendChild(tabla);
  caja.appendChild(envoltorio);
  if (lineas.some((l) => l.estado === 'revisar')) caja.appendChild(crear('p', t.inc.notaRevisar, 'lab-nota'));
}

function pintarTrabajadores() {
  const { t } = E!;
  const cuerpo = $('lab-trab-filas');
  cuerpo.textContent = '';
  const hay = E!.empleados.length > 0;
  $('lab-trab-vacio').hidden = hay;
  $('lab-trab-tabla').hidden = !hay;
  for (const e of E!.empleados) {
    const tr = document.createElement('tr');
    tr.appendChild(crear('td', e.nombre));
    tr.appendChild(crear('td', e.nif ?? ''));
    tr.appendChild(crear('td', e.fecha_alta ? fechaCorta(e.fecha_alta) : ''));
    tr.appendChild(crear('td', e.fecha_baja ? `${t.trab.deBaja} (${fechaCorta(e.fecha_baja)})` : t.trab.activo));
    const acc = crear('td');
    if (!e.fecha_baja && !E!.soloLectura) {
      const b = crear('button', t.trab.pedirBaja, 'btn btn-outline lab-btn-peq');
      b.type = 'button';
      b.addEventListener('click', () => abrirBaja(e));
      acc.appendChild(b);
    }
    tr.appendChild(acc);
    cuerpo.appendChild(tr);
  }
}

function estadoLista(f: Fila, claves: { recibida: string; cargada: string; tramitada: string; revision: string }) {
  if (f.tramitado_at) return { texto: claves.tramitada, clase: 'is-ok' };
  if (f.cegid_error) return { texto: claves.revision, clase: 'is-rev' };
  if (f.cegid_enviado_at) return { texto: claves.cargada, clase: 'is-proc' };
  return { texto: claves.recibida, clase: 'is-pend' };
}

function pintarLista(idCaja: string, idLista: string, filas: Fila[], titulo: (f: Fila) => string, extra: (f: Fila) => string, claves: any) {
  const caja = $(idCaja);
  const ul = $(idLista);
  ul.textContent = '';
  caja.hidden = filas.length === 0;
  for (const f of filas) {
    const li = crear('li', undefined, 'lab-item');
    li.appendChild(crear('span', titulo(f), 'lab-item-titulo'));
    li.appendChild(crear('span', extra(f), 'lab-item-extra'));
    const est = estadoLista(f, claves);
    li.appendChild(crear('span', est.texto, 'lab-chip ' + est.clase));
    ul.appendChild(li);
  }
}

function pintarAltas() {
  const { t } = E!;
  pintarLista('lab-altas', 'lab-altas-lista', E!.altas,
    (f) => f.nombre_completo ?? '',
    (f) => (f.fecha_inicio ? fechaCorta(f.fecha_inicio) : ''),
    { recibida: t.alta.estado.recibida, cargada: t.alta.estado.cargada, tramitada: t.alta.estado.tramitada, revision: t.alta.estado.revision });
  $('lab-altas-titulo').textContent = t.alta.enviadas;
}

function pintarBajas() {
  const { t } = E!;
  pintarLista('lab-bajas', 'lab-bajas-lista', E!.bajas,
    (f) => f.trabajador_nombre ?? '',
    (f) => (f.fecha_baja ? fechaCorta(f.fecha_baja) : ''),
    { recibida: t.baja.estado.enviada, cargada: t.baja.estado.cargada, tramitada: t.baja.estado.tramitada, revision: t.baja.estado.revision });
  $('lab-bajas-titulo').textContent = t.baja.pedidas;
}

function enlaceAlta(): string {
  const base = { es: '/formulario-alta-trabajador', ca: '/ca/formulario-alta-trabajador', en: '/en/formulario-alta-trabajador' }[E!.lang];
  if (ES_PRUEBA.test(E!.cliente.id)) return base;
  const p = new URLSearchParams({ nif: E!.cliente.id, nombre: E!.cliente.nombre ?? '' });
  if (E!.cliente.email) p.set('email', E!.cliente.email);
  return `${base}?${p.toString()}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Baja de un trabajador
// ---------------------------------------------------------------------------------------------------------------
let bajaEmpleado: Fila | null = null;

function abrirBaja(e: Fila) {
  const { t } = E!;
  bajaEmpleado = e;
  const form = $('lab-baja-form') as HTMLFormElement;
  $('lab-baja-titulo').textContent = tpl(t.baja.title, { nombre: e.nombre });
  (form.elements.namedItem('fecha') as HTMLInputElement).value = '';
  (form.elements.namedItem('observaciones') as HTMLTextAreaElement).value = '';
  const sel = form.elements.namedItem('causa') as HTMLSelectElement;
  sel.textContent = '';
  for (const c of CAUSAS_BAJA) { const o = crear('option', c.nombre[E!.lang]); o.value = c.clave; sel.appendChild(o); }
  const msg = $('lab-baja-msg'); msg.hidden = true;
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function enviarBaja(ev: Event) {
  ev.preventDefault();
  if (!E || !bajaEmpleado || E.soloLectura) return;
  const form = $('lab-baja-form') as HTMLFormElement;
  const msg = $('lab-baja-msg');
  const fecha = (form.elements.namedItem('fecha') as HTMLInputElement).value;
  const causa = (form.elements.namedItem('causa') as HTMLSelectElement).value;
  const obs = (form.elements.namedItem('observaciones') as HTMLTextAreaElement).value.trim();
  if (!fecha) return;
  const btn = form.querySelector('button[type=submit]') as HTMLButtonElement;
  btn.disabled = true;
  const { error } = await E.supabase.from('bajas_trabajadores').insert({
    cliente_id: E.cliente.id, trabajador_codigo: bajaEmpleado.codigo_empleado, trabajador_nombre: bajaEmpleado.nombre,
    trabajador_nif: bajaEmpleado.nif, fecha_baja: fecha, causa, observaciones: obs || null,
  });
  btn.disabled = false;
  msg.hidden = false;
  if (error) { msg.textContent = E.t.baja.error; msg.className = 'portal-msg is-error'; return; }
  msg.textContent = E.t.baja.enviada;
  msg.className = 'portal-msg is-ok';
  form.hidden = true;
  bajaEmpleado = null;
  await cargarDatos();
  await pintar();
  $('lab-baja-msg-global').textContent = E.t.baja.enviada;
  $('lab-baja-msg-global').hidden = false;
}

// ---------------------------------------------------------------------------------------------------------------
// Plantilla Excel: descargar
// ---------------------------------------------------------------------------------------------------------------
async function descargarPlantilla() {
  if (!E) return;
  const { t, lang } = E;
  const msg = $('lab-msg');
  const { anio, mes } = E.mes;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Asesoría Madal';
  const x = t.xlsx;
  const ws = wb.addWorksheet(x.hojaIncidencias, { views: [{ state: 'frozen', ySplit: 2 }] });
  const ins = wb.addWorksheet(x.hojaInstrucciones);
  const listas = wb.addWorksheet('Listas', { state: 'hidden' });

  // --- Hoja Listas: trabajadores (A), tipos (D-G) y la identificación de la plantilla (I). Oculta.
  const activos = empleadosActivos();
  const etiquetas = activos.length ? activos.map(etiquetaTrabajador) : [x.sinTrabajadores];
  etiquetas.forEach((v, i) => { listas.getCell(i + 1, 1).value = v; });
  const tipos: TipoIncidencia[] = [];
  for (const g of GRUPOS) tipos.push(...TIPOS_INCIDENCIA.filter((tp) => tp.grupo === g));
  tipos.forEach((tp, i) => {
    listas.getCell(i + 1, 4).value = tp.nombre[lang];
    listas.getCell(i + 1, 5).value = (x.unidad as any)[tp.unidad];
    listas.getCell(i + 1, 6).value = tp.fechas ? x.si : x.no;
    listas.getCell(i + 1, 7).value = tp.importe === 'convenio' ? x.importeConvenio : tp.importe === 'obligatorio' ? x.importeObligatorio : x.importeNinguno;
  });
  listas.getCell('I1').value = E.cliente.id;
  listas.getCell('I2').value = anio;
  listas.getCell('I3').value = mes;
  listas.getCell('I4').value = 'v1';

  // --- Hoja Incidencias
  const verde = 'FF1F5C58';
  ws.mergeCells('A1:H1');
  const titulo = ws.getCell('A1');
  titulo.value = tpl(x.titulo, { mes: nombreMes(mes), anio, empresa: E.cliente.nombre });
  titulo.font = { bold: true, size: 13, color: { argb: verde } };
  ws.getRow(1).height = 24;
  const cab = [x.cols.trabajador, x.cols.tipo, x.cols.desde, x.cols.hasta, x.cols.cantidad, x.cols.importe, x.cols.comentario, x.cols.ayuda];
  const anchos = [38, 42, 13, 13, 12, 13, 34, 30];
  cab.forEach((h, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: verde } };
    c.alignment = { vertical: 'middle', wrapText: true };
    ws.getColumn(i + 1).width = anchos[i];
  });
  ws.getRow(2).height = 32;
  const finT = Math.max(etiquetas.length, 1);
  for (let r = 3; r < 3 + FILAS_PLANTILLA; r++) {
    ws.getCell(r, 1).dataValidation = { type: 'list', allowBlank: true, formulae: [`Listas!$A$1:$A$${finT}`], showErrorMessage: true, errorStyle: 'stop', error: x.cols.trabajador };
    ws.getCell(r, 2).dataValidation = { type: 'list', allowBlank: true, formulae: [`Listas!$D$1:$D$${tipos.length}`], showErrorMessage: true, errorStyle: 'stop', error: x.cols.tipo };
    for (const col of [3, 4]) {
      ws.getCell(r, col).numFmt = 'dd/mm/yyyy';
      ws.getCell(r, col).dataValidation = { type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date(Date.UTC(2020, 0, 1))], showErrorMessage: true, error: 'dd/mm/aaaa' };
    }
    ws.getCell(r, 5).dataValidation = { type: 'decimal', operator: 'greaterThan', allowBlank: true, formulae: [0], showErrorMessage: true, error: '> 0' };
    ws.getCell(r, 6).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0], showErrorMessage: true, error: '≥ 0' };
    ws.getCell(r, 8).value = { formula: `IF(B${r}="","",IFERROR("→ "&VLOOKUP(B${r},Listas!$D$1:$E$${tipos.length},2,FALSE),""))` };
    ws.getCell(r, 8).font = { italic: true, color: { argb: 'FF6B6155' } };
  }

  // --- Hoja Instrucciones
  ins.getColumn(1).width = 46; ins.getColumn(2).width = 28; ins.getColumn(3).width = 34; ins.getColumn(4).width = 12;
  ins.mergeCells('A1:D1');
  ins.getCell('A1').value = x.hojaInstrucciones;
  ins.getCell('A1').font = { bold: true, size: 14, color: { argb: verde } };
  x.instrucciones.forEach((linea, i) => {
    ins.mergeCells(i + 3, 1, i + 3, 4);
    const c = ins.getCell(i + 3, 1);
    c.value = `${i + 1}. ${linea}`;
    c.alignment = { wrapText: true, vertical: 'top' };
    ins.getRow(i + 3).height = 32;
  });
  const f0 = x.instrucciones.length + 4;
  [x.tablaTipo, x.tablaCantidad, x.tablaImporte, x.tablaFechas].forEach((h, i) => {
    const c = ins.getCell(f0, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: verde } };
  });
  tipos.forEach((tp, i) => {
    ins.getCell(f0 + 1 + i, 1).value = tp.nombre[lang];
    ins.getCell(f0 + 1 + i, 2).value = (x.unidad as any)[tp.unidad];
    ins.getCell(f0 + 1 + i, 3).value = tp.importe === 'convenio' ? x.importeConvenio : tp.importe === 'obligatorio' ? x.importeObligatorio : x.importeNinguno;
    ins.getCell(f0 + 1 + i, 4).value = tp.fechas ? x.si : x.no;
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = tpl(x.archivo, { mes: nombreMes(mes), anio });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  msg.hidden = true;
}

// ---------------------------------------------------------------------------------------------------------------
// Plantilla Excel: leer y subir
// ---------------------------------------------------------------------------------------------------------------
/** Valor de una celda de ExcelJS como texto o número (fórmulas, texto enriquecido y fechas incluidos). */
function plano(v: any): any {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return plano(v.result);
    if ('richText' in v) return v.richText.map((r: any) => r.text).join('');
    if ('text' in v) return String(v.text);
    return '';
  }
  return typeof v === 'string' ? v.trim() : v;
}
function aNumero(v: any): number | null {
  if (v === '' || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function aFecha(v: any): string | null | undefined {
  // null = vacío, undefined = no es una fecha válida
  if (v === '' || v === null) return null;
  if (v instanceof Date) return isNaN(+v) ? undefined : v.toISOString().slice(0, 10);
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return isNaN(+d) ? undefined : d.toISOString().slice(0, 10); }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

interface LineaLeida { fila: number; trabajador_codigo: number; tipo: string; desde: string | null; hasta: string | null; unidades: number | null; importe: number | null; comentario: string | null }

async function leerPlantilla(file: File): Promise<{ lineas: LineaLeida[]; errores: string[]; anio: number; mes: number } | { fatal: string }> {
  const { t } = E!;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { return { fatal: t.err.sinHoja }; }
  const nombresHoja = ['Incidencias', LABORAL.es.xlsx.hojaIncidencias, LABORAL.ca.xlsx.hojaIncidencias, LABORAL.en.xlsx.hojaIncidencias];
  const ws = wb.worksheets.find((w) => nombresHoja.includes(w.name));
  const listas = wb.getWorksheet('Listas');
  if (!ws || !listas) return { fatal: t.err.sinHoja };
  const cliente = String(plano(listas.getCell('I1').value));
  const anio = Number(plano(listas.getCell('I2').value));
  const mes = Number(plano(listas.getCell('I3').value));
  if (cliente !== E!.cliente.id) return { fatal: t.err.otraEmpresa };
  if (!Number.isInteger(anio) || !(mes >= 1 && mes <= 12)) return { fatal: t.err.sinHoja };

  const codigos = new Set(E!.empleados.map((e) => e.codigo_empleado));
  const lineas: LineaLeida[] = [];
  const errores: string[] = [];
  const ultima = Math.min(ws.rowCount, MAX_FILAS + 2);
  if (ws.rowCount > 2 + MAX_FILAS + 50) return { fatal: t.err.demasiadas };
  for (let r = 3; r <= ultima; r++) {
    const celdas = [1, 2, 3, 4, 5, 6, 7].map((c) => plano(ws.getCell(r, c).value));
    if (celdas.every((c) => c === '')) continue;
    const [cTrab, cTipo, cDesde, cHasta, cCant, cImp, cCom] = celdas;
    const aviso = (m: string) => errores.push(tpl(m, { fila: r }));
    const cod = String(cTrab).match(/#(\d+)\s*$/);
    const codigo = cod ? Number(cod[1]) : NaN;
    if (!cod || !codigos.has(codigo)) { aviso(t.err.trabajador); continue; }
    const tipo = tipoPorNombre(String(cTipo));
    if (!tipo) { aviso(t.err.tipo); continue; }
    const desde = aFecha(cDesde);
    const hasta = aFecha(cHasta);
    const unidades = aNumero(cCant);
    const importe = aNumero(cImp);
    let ok = true;
    if (desde === undefined || (tipo.via !== 'importe' && desde === null)) { aviso(t.err.desde); ok = false; }
    if (hasta === undefined) { aviso(t.err.hasta); ok = false; }
    if (ok && desde && hasta && hasta < desde) { aviso(t.err.hastaAntes); ok = false; }
    if (tipo.via === 'importe' && !tipo.manual && !(unidades !== null && unidades > 0)) { aviso(t.err.cantidad); ok = false; }
    if (cImp !== '' && (importe === null || importe < 0)) { aviso(t.err.importe); ok = false; }
    if (!ok) continue;
    lineas.push({ fila: r, trabajador_codigo: codigo, tipo: tipo.clave, desde: desde ?? null, hasta: hasta ?? null, unidades, importe, comentario: cCom === '' ? null : String(cCom).slice(0, 250) });
  }
  if (!lineas.length && !errores.length) errores.push(t.err.sinFilas);
  if (lineas.length > MAX_FILAS) return { fatal: t.err.demasiadas };
  return { lineas, errores, anio, mes };
}

function mostrarErrores(lista: string[]) {
  const ul = $('lab-errores');
  ul.textContent = '';
  for (const e of lista) ul.appendChild(crear('li', e));
  $('lab-errores-caja').hidden = lista.length === 0;
}

function mensaje(texto: string, tipo: '' | 'is-ok' | 'is-error') {
  const m = $('lab-msg');
  m.textContent = texto;
  m.className = 'portal-msg ' + tipo;
  m.hidden = !texto;
}

/** Crea la carga en 'subiendo', inserta las filas y solo entonces la deja 'pendiente' para n8n. */
async function enviarCarga(anio: number, mes: number, nombreArchivo: string | null, lineas: LineaLeida[]): Promise<boolean> {
  const { supabase, cliente, t } = E!;
  const { data: carga, error } = await supabase.from('incidencias_cargas')
    .insert({ cliente_id: cliente.id, anio, mes, nombre_archivo: nombreArchivo, estado: 'subiendo' }).select('id').single();
  if (error || !carga) { mensaje(t.inc.errorGenerico, 'is-error'); return false; }
  for (let i = 0; i < lineas.length; i += 100) {
    const trozo = lineas.slice(i, i + 100).map((l) => ({ ...l, carga_id: carga.id }));
    const { error: e2 } = await supabase.from('incidencias_lineas').insert(trozo);
    if (e2) { mensaje(t.inc.errorGenerico, 'is-error'); return false; }
  }
  const { error: e3 } = await supabase.from('incidencias_cargas').update({ estado: 'pendiente' }).eq('id', carga.id);
  if (e3) { mensaje(t.inc.errorGenerico, 'is-error'); return false; }
  return true;
}

async function subirPlantilla(file: File) {
  if (!E || E.enviando || E.soloLectura) return;
  const { t } = E;
  E.enviando = true;
  mostrarErrores([]);
  mensaje(t.inc.leyendo, '');
  try {
    const r = await leerPlantilla(file);
    if ('fatal' in r) { mensaje(r.fatal, 'is-error'); return; }
    if (r.errores.length) { mensaje(t.inc.erroresPlantilla, 'is-error'); mostrarErrores(r.errores); return; }
    mensaje(t.inc.subiendo, '');
    if (!(await enviarCarga(r.anio, r.mes, file.name.slice(0, 120), r.lineas))) return;
    E.mes = { anio: r.anio, mes: r.mes };
    E.sondeos = 0;
    mensaje(t.inc.hecho, 'is-ok');
    await cargarDatos();
    await pintar();
  } catch {
    mensaje(t.inc.errorGenerico, 'is-error');
  } finally {
    E.enviando = false;
    ($('lab-subir-input') as HTMLInputElement).value = '';
  }
}

async function sinIncidencias() {
  if (!E || E.enviando || E.soloLectura) return;
  const { t } = E;
  if (!window.confirm(tpl(t.inc.confirmarSin, { mes: `${nombreMes(E.mes.mes)} ${E.mes.anio}` }))) return;
  E.enviando = true;
  mostrarErrores([]);
  try {
    mensaje(t.inc.subiendo, '');
    if (!(await enviarCarga(E.mes.anio, E.mes.mes, null, []))) return;
    E.sondeos = 0;
    mensaje(t.inc.hecho, 'is-ok');
    await cargarDatos();
    await pintar();
  } finally {
    E.enviando = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------------------------------------------
function engancharEventos() {
  if (enganchado) return;
  enganchado = true;
  ($('lab-mes') as HTMLSelectElement).addEventListener('change', async (ev) => {
    const [a, m] = (ev.target as HTMLSelectElement).value.split('-').map(Number);
    E!.mes = { anio: a, mes: m };
    E!.sondeos = 0;
    mostrarErrores([]);
    mensaje('', '');
    await pintar();
  });
  $('lab-descargar').addEventListener('click', () => { void descargarPlantilla().catch(() => mensaje(E!.t.inc.errorGenerico, 'is-error')); });
  ($('lab-subir-input') as HTMLInputElement).addEventListener('change', (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) void subirPlantilla(f);
  });
  $('lab-sin-inc').addEventListener('click', () => void sinIncidencias());
  ($('lab-baja-form') as HTMLFormElement).addEventListener('submit', (ev) => void enviarBaja(ev));
  $('lab-baja-cancelar').addEventListener('click', () => { ($('lab-baja-form') as HTMLFormElement).hidden = true; bajaEmpleado = null; });
}

export async function iniciarLaboral(supabase: any, cliente: { id: string; nombre: string; email?: string | null }, opciones: { lang: IdiomaPortal; soloLectura: boolean }) {
  const [act] = mesesDisponibles();
  const cambioDeCliente = !E || E.cliente.id !== cliente.id;
  window.clearTimeout(E?.temporizador);
  E = {
    supabase, cliente, lang: opciones.lang, soloLectura: opciones.soloLectura, t: LABORAL[opciones.lang],
    empleados: [], cargas: [], altas: [], bajas: [],
    mes: cambioDeCliente || !E ? act : E.mes, enviando: false, sondeos: 0, temporizador: undefined,
  };
  engancharEventos();
  ($('lab-baja-form') as HTMLFormElement).hidden = true;
  $('lab-baja-msg-global').hidden = true;
  mostrarErrores([]);
  mensaje('', '');
  await cargarDatos();
  await pintar();
}
