import type { APIRoute } from 'astro';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export const prerender = false;

// Rellena los documentos del alta de autónomo (Edurne, 2026-11-16) para que el cliente solo
// tenga que firmarlos. Lo llama el workflow de n8n "Mandato Seguridad Social" con las
// respuestas del formulario de alta (`respuestas.f` de `alta_nuevos_autonomos`):
//   - mandato: el TC 1/15-3 oficial de la Seguridad Social (PDF con campos), siempre en castellano;
//   - poder: el poder de representación para tramitar el alta (AEAT + TGSS, CIRCE/DUE),
//     en el idioma del cliente (es/ca/en). Solo si `poder` es true.
// Devuelve JSON con cada PDF en base64, que n8n convierte en adjuntos.
//
// No lee ni guarda nada: rellena con lo que recibe. Por eso no lleva clave, y los datos del
// apoderado los manda n8n en `apoderado` (no hay datos personales del equipo en la web).
const MANDATO_URL =
  'https://suslwmgqdzingeqhfrpw.supabase.co/storage/v1/object/public/docs-publicos/Mandato_Seguridad_Social_TC1-15-3.pdf';
const TAMANO_MAXIMO = 50_000;

const RATE_LIMIT_MAX = 30;
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

type Idioma = 'es' | 'ca' | 'en';
type Datos = Record<string, unknown>;
const txt = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const sinEspacios = (v: unknown) => txt(v, 60).toUpperCase().replace(/[\s.-]/g, '');
// NIE (X/Y/Z inicial) = tarjeta de extranjero; si no, DNI.
const esNie = (doc: string) => /^[XYZ]/.test(doc);

// Las fuentes estándar de PDF solo cubren WinAnsi (letras de Europa occidental). Una letra de
// fuera (ș, ă, ł, ő… en nombres rumanos, polacos, húngaros) se escribe sin el signo diacrítico
// ("Ștefan" -> "Stefan") en vez de perderse; lo que no tenga equivalente se quita para que
// pdf-lib no falle.
const EXTRA: Record<string, string> = { ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ı: 'i' };
const winAnsi = (s: string) =>
  [...s.replace(/[‘’]/g, "'").replace(/[“”«»]/g, '"')]
    .map((c) => {
      if (/[\x20-\x7E -ÿ€]/.test(c)) return c;
      const base = EXTRA[c] ?? c.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return /^[\x20-\x7E -ÿ]*$/.test(base) ? base : '';
    })
    .join('');

function fechaHoy() {
  const p = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'numeric', year: 'numeric' })
    .formatToParts(new Date());
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { dia: v('day'), mes: v('month'), anio: v('year') };
}

function domicilio(f: Datos) {
  const piso = txt(f.dom_piso, 50);
  const calle = [txt(f.dom_via), txt(f.dom_num, 20)].filter(Boolean).join(' ') + (piso ? `, ${piso}` : '');
  return { calle, cp: txt(f.dom_cp, 10), localidad: txt(f.dom_mun, 100), provincia: txt(f.dom_prov, 100) };
}

// ---------- Mandato TC 1/15-3 ----------
// Nombres de los campos del PDF oficial (versión 06-2022), deducidos por su posición en la página.
// Los que se llaman igual en el mandato y en el resguardo de abajo comparten valor.
//   Texto           apellidos y nombre del sujeto obligado al pago (mandato y resguardo)
//   Texto2          n.º identificativo de Seguridad Social (NAF)
//   Texto3          n.º de documento del responsable de pago
//   Casilla 10-13   tipo de documento del responsable: DNI, tarjeta de extranjero, pasaporte, CIF (18-21 en el resguardo)
//   iban1-24        IBAN, un carácter por casilla (iban41-64 en el resguardo)
//   Texto4/Texto63  titular de la cuenta · Texto5/Texto16.0 domicilio del titular
//   Texto17.0/67.0  localidad · Texto23/73 código postal · Texto21/71 provincia
//   Texto6/Texto69  n.º de documento del titular
//   Casilla 17,16,15,14 tipo de documento del titular: DNI, tarjeta, pasaporte, CIF (26,24,23,22 en el resguardo)
//   Texto11.0/11.2/36.0 fecha (día, mes, año)
//   Casilla 1 alta en domiciliación · Casilla 4 R.E. Trabajadores Autónomos
let plantillaMandato: Uint8Array | null = null;

async function rellenarMandato(f: Datos) {
  if (!plantillaMandato) {
    const r = await fetch(MANDATO_URL);
    if (!r.ok) throw new Error(`No se pudo descargar el mandato (${r.status})`);
    plantillaMandato = new Uint8Array(await r.arrayBuffer());
  }
  const pdf = await PDFDocument.load(plantillaMandato);
  const form = pdf.getForm();
  const poner = (campo: string, valor: string) => {
    if (!valor) return;
    const c = form.getTextField(campo);
    const max = c.getMaxLength();
    c.setText(winAnsi(max ? valor.slice(0, max) : valor));
  };
  const marcar = (campo: string) => form.getCheckBox(campo).check();

  const nombre = txt(f.nombre, 100);
  const apellidos = txt(f.apellidos, 150);
  const doc = sinEspacios(f.dni);
  const obligado = [apellidos, nombre].filter(Boolean).join(' ').toUpperCase();

  marcar('Casilla de verificación1'); // Alta en domiciliación
  marcar('Casilla de verificación4'); // R.E. Trabajadores Autónomos
  poner('Texto', obligado);
  if (f.naf_tiene === 'Sí') poner('Texto2', txt(f.naf, 30).replace(/\D/g, ''));
  poner('Texto3', doc);
  if (doc) {
    marcar(esNie(doc) ? 'Casilla de verificación11' : 'Casilla de verificación10');
    marcar(esNie(doc) ? 'Casilla de verificación19' : 'Casilla de verificación18');
  }

  const iban = sinEspacios(f.iban).replace(/[^A-Z0-9]/g, '').slice(0, 24);
  [...iban].forEach((ch, i) => {
    poner(`iban${i + 1}`, ch);
    poner(`iban${i + 41}`, ch);
  });

  // Titular de la cuenta: el propio cliente, o la persona que indicó en el formulario.
  // Del titular ajeno no tenemos domicilio: lo completa él (el correo lo explica).
  const otro = f.iban_titular === 'No';
  const titular = (otro ? txt(f.iban_tit_nombre, 150) : obligado).toUpperCase();
  const docTitular = otro ? sinEspacios(f.iban_tit_dni) : doc;
  poner('Texto4', titular);
  poner('Texto63', titular);
  poner('Texto6', docTitular);
  poner('Texto69', docTitular);
  if (docTitular) {
    marcar(esNie(docTitular) ? 'Casilla de verificación16' : 'Casilla de verificación17');
    marcar(esNie(docTitular) ? 'Casilla de verificación24' : 'Casilla de verificación26');
  }
  if (!otro) {
    const d = domicilio(f);
    for (const [a, b, v] of [
      ['Texto5', 'Texto16.0', d.calle.toUpperCase()],
      ['Texto17.0', 'Texto67.0', d.localidad.toUpperCase()],
      ['Texto23', 'Texto73', d.cp],
      ['Texto21', 'Texto71', d.provincia.toUpperCase()],
    ]) {
      poner(a, v);
      poner(b, v);
    }
  }

  const hoy = fechaHoy();
  poner('Texto11.0', String(hoy.dia).padStart(2, '0'));
  poner('Texto11.2', String(hoy.mes).padStart(2, '0'));
  poner('Texto36.0', String(hoy.anio));

  form.updateFieldAppearances(await pdf.embedFont(StandardFonts.Helvetica));
  return pdf.save();
}

// ---------- Poder de representación ----------
// Texto de la plantilla de Edurne "Poder de representación - Alta autónomos (CIRCE DUE)",
// traducido al catalán y al inglés. {poderdante}, {doc}, {num}, {dom}, {apoderado}, {apdni} y
// {apdom} se sustituyen; los fragmentos entre ** van en negrita.
const MESES: Record<Idioma, string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  ca: ['de gener', 'de febrer', 'de març', "d'abril", 'de maig', 'de juny', 'de juliol', "d'agost", 'de setembre', "d'octubre", 'de novembre', 'de desembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const PODER: Record<Idioma, { titulo: string; fecha: (l: string, d: number, m: string, a: number) => string; bloques: [string, string[]][]; firmas: [string, string]; nombreArchivo: string }> = {
  es: {
    titulo: 'PODER DE REPRESENTACIÓN',
    fecha: (l, d, m, a) => `En ${l}, a ${d} de ${m} de ${a}.`,
    bloques: [
      ['REUNIDOS', [
        'De una parte, D./Dña. **{poderdante}**, mayor de edad, con {doc} número **{num}**, y domicilio en {dom}, en adelante el PODERDANTE.',
        'De otra parte, **{apoderado}**, con DNI **{apdni}**, y domicilio en {apdom}, en adelante el APODERADO.',
      ]],
      ['EXPONEN', [
        'Que el PODERDANTE desea iniciar actividad como trabajador/a autónomo/a y precisa ser representado ante la Agencia Estatal de Administración Tributaria (AEAT) y la Tesorería General de la Seguridad Social (TGSS) para la tramitación de dicha alta.',
      ]],
      ['OTORGAN', [
        'El PODERDANTE confiere poder de representación al APODERADO, tan amplio como en Derecho sea necesario, para que en su nombre y representación pueda:',
        '1. Presentar y firmar el modelo 030 (declaración censal) y el modelo 036 (declaración censal de alta/modificación) ante la AEAT.',
        '2. Cumplimentar, firmar y enviar el Documento Único Electrónico (DUE) a través del sistema CIRCE/PAE para el alta como trabajador/a autónomo/a.',
        '3. Solicitar la asignación del número de afiliación a la Seguridad Social (NAF) y tramitar el alta en el Régimen Especial de Trabajadores Autónomos (RETA) ante la TGSS.',
        '4. Realizar cuantas gestiones, trámites y comunicaciones sean necesarios ante la AEAT y la TGSS en relación con el trámite de alta descrito.',
        'El presente poder tiene vigencia desde la fecha de su firma hasta la finalización del trámite de alta descrito, salvo revocación expresa por parte del PODERDANTE.',
        'Queda expresamente excluido de este poder cualquier acto de disposición sobre cuentas bancarias del PODERDANTE, incluida la firma del mandato de domiciliación de adeudos SEPA para el pago de cuotas de la Seguridad Social, que deberá firmar personalmente el PODERDANTE.',
        'Y en prueba de conformidad, firman el presente documento en el lugar y fecha indicados.',
      ]],
    ],
    firmas: ['Firma del PODERDANTE', 'Firma del APODERADO'],
    nombreArchivo: 'Poder de representacion - Alta autonomo.pdf',
  },
  ca: {
    titulo: 'PODER DE REPRESENTACIÓ',
    fecha: (l, d, m, a) => `A ${l}, ${d} ${m} de ${a}.`,
    bloques: [
      ['REUNITS', [
        "D'una part, el Sr./la Sra. **{poderdante}**, major d'edat, amb {doc} número **{num}**, i domicili a {dom}, d'ara endavant el PODERDANT.",
        "D'una altra part, **{apoderado}**, amb DNI **{apdni}**, i domicili a {apdom}, d'ara endavant l'APODERAT.",
      ]],
      ['EXPOSEN', [
        "Que el PODERDANT vol iniciar activitat com a treballador/a autònom/a i necessita ser representat davant l'Agència Estatal d'Administració Tributària (AEAT) i la Tresoreria General de la Seguretat Social (TGSS) per a la tramitació d'aquesta alta.",
      ]],
      ['ATORGUEN', [
        "El PODERDANT confereix poder de representació a l'APODERAT, tan ampli com en Dret sigui necessari, perquè en nom seu i en representació seva pugui:",
        "1. Presentar i signar el model 030 (declaració censal) i el model 036 (declaració censal d'alta/modificació) davant l'AEAT.",
        "2. Emplenar, signar i enviar el Document Únic Electrònic (DUE) a través del sistema CIRCE/PAE per a l'alta com a treballador/a autònom/a.",
        "3. Sol·licitar l'assignació del número d'afiliació a la Seguretat Social (NAF) i tramitar l'alta al Règim Especial de Treballadors Autònoms (RETA) davant la TGSS.",
        "4. Fer totes les gestions, tràmits i comunicacions que siguin necessaris davant l'AEAT i la TGSS en relació amb el tràmit d'alta descrit.",
        "Aquest poder té vigència des de la data de la seva signatura fins a la finalització del tràmit d'alta descrit, llevat de revocació expressa per part del PODERDANT.",
        "Queda expressament exclòs d'aquest poder qualsevol acte de disposició sobre comptes bancaris del PODERDANT, inclosa la signatura del mandat de domiciliació de rebuts SEPA per al pagament de quotes de la Seguretat Social, que haurà de signar personalment el PODERDANT.",
        'I en prova de conformitat, signen aquest document al lloc i la data indicats.',
      ]],
    ],
    firmas: ['Signatura del PODERDANT', "Signatura de l'APODERAT"],
    nombreArchivo: 'Poder de representacio - Alta autonom.pdf',
  },
  en: {
    titulo: 'POWER OF REPRESENTATION',
    fecha: (l, d, m, a) => `In ${l}, on ${d} ${m} ${a}.`,
    bloques: [
      ['PARTIES', [
        'On the one hand, **{poderdante}**, of legal age, holder of {doc} number **{num}**, with address at {dom}, hereinafter the PRINCIPAL.',
        'On the other hand, **{apoderado}**, holder of DNI **{apdni}**, with address at {apdom}, hereinafter the REPRESENTATIVE.',
      ]],
      ['STATE', [
        'That the PRINCIPAL wishes to start an activity as a self-employed worker and needs to be represented before the Spanish Tax Agency (Agencia Estatal de Administración Tributaria, AEAT) and the General Treasury of Social Security (Tesorería General de la Seguridad Social, TGSS) to process this registration.',
      ]],
      ['GRANT', [
        "The PRINCIPAL grants the REPRESENTATIVE a power of representation, as broad as legally necessary, so that the REPRESENTATIVE may, in the PRINCIPAL's name and on the PRINCIPAL's behalf:",
        '1. File and sign form 030 (census declaration) and form 036 (census declaration of registration/modification) with the AEAT.',
        '2. Complete, sign and send the Single Electronic Document (Documento Único Electrónico, DUE) through the CIRCE/PAE system for registration as a self-employed worker.',
        '3. Apply for the Social Security number (NAF) and process the registration in the Special Scheme for Self-Employed Workers (RETA) with the TGSS.',
        '4. Carry out all formalities, procedures and communications necessary before the AEAT and the TGSS in connection with the registration described.',
        'This power is valid from the date of signature until the registration described is completed, unless expressly revoked by the PRINCIPAL.',
        "Any act of disposal over the PRINCIPAL's bank accounts is expressly excluded from this power, including signing the SEPA direct debit mandate for the payment of Social Security contributions, which the PRINCIPAL must sign personally.",
        'In witness whereof, both parties sign this document at the place and on the date stated above.',
      ]],
    ],
    firmas: ['Signature of the PRINCIPAL', 'Signature of the REPRESENTATIVE'],
    nombreArchivo: 'Power of representation - Self-employed registration.pdf',
  },
};

type Trozo = { t: string; b: boolean };

// Escribe un párrafo con negritas (**…**) ajustado al ancho; devuelve la nueva y.
function parrafo(page: PDFPage, texto: string, x: number, y: number, ancho: number, normal: PDFFont, negrita: PDFFont, size: number, sangria = 0) {
  const palabras: Trozo[] = [];
  texto.split('**').forEach((seg, i) => {
    for (const w of seg.split(/(\s+)/)) if (w) palabras.push({ t: w, b: i % 2 === 1 });
  });
  const alto = size * 1.4;
  let linea: Trozo[] = [];
  let usado = 0;
  const pintar = () => {
    let cx = x + sangria;
    while (linea.length && !linea[linea.length - 1].t.trim()) linea.pop();
    for (const w of linea) {
      const font = w.b ? negrita : normal;
      page.drawText(w.t, { x: cx, y, size, font, color: rgb(0, 0, 0) });
      cx += font.widthOfTextAtSize(w.t, size);
    }
    y -= alto;
    linea = [];
    usado = 0;
  };
  for (const w of palabras) {
    const font = w.b ? negrita : normal;
    const wAncho = font.widthOfTextAtSize(w.t, size);
    if (!w.t.trim() && !linea.length) continue;
    if (usado + wAncho > ancho - sangria && w.t.trim()) pintar();
    if (!w.t.trim() && !linea.length) continue;
    linea.push(w);
    usado += wAncho;
  }
  if (linea.length) pintar();
  return y;
}

async function generarPoder(f: Datos, idioma: Idioma, apoderado: { nombre: string; dni: string; domicilio: string }) {
  const T = PODER[idioma];
  const pdf = await PDFDocument.create();
  pdf.setTitle(T.titulo);
  const page = pdf.addPage([595.28, 841.89]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size = 10.5;
  const x = 70;
  const ancho = 595.28 - 2 * x;

  const doc = sinEspacios(f.dni);
  const d = domicilio(f);
  const dom = [d.calle, [d.cp, d.localidad].filter(Boolean).join(' '), d.provincia].filter(Boolean).join(', ') || '____________________';
  const nombre = [txt(f.nombre, 100), txt(f.apellidos, 150)].filter(Boolean).join(' ').toUpperCase();
  const sust = (s: string) =>
    winAnsi(
      s
        .replace('{poderdante}', nombre)
        .replace('{doc}', esNie(doc) ? 'NIE' : 'DNI')
        .replace('{num}', doc)
        .replace('{dom}', dom)
        .replace('{apoderado}', apoderado.nombre)
        .replace('{apdni}', apoderado.dni)
        .replace('{apdom}', apoderado.domicilio),
    );

  let y = 770;
  y = parrafo(page, `**${winAnsi(T.titulo)}**`, x, y, ancho, normal, negrita, 12) - 8;
  const hoy = fechaHoy();
  y = parrafo(page, winAnsi(T.fecha(d.localidad || '__________', hoy.dia, MESES[idioma][hoy.mes - 1], hoy.anio)), x, y, ancho, normal, negrita, size) - 8;
  for (const [cabecera, parrafos] of T.bloques) {
    y = parrafo(page, `**${winAnsi(cabecera)}**`, x, y, ancho, normal, negrita, size) - 4;
    let antes = false;
    for (const p of parrafos) {
      const lista = /^\d\. /.test(p);
      if (antes && !lista) y -= 5; // aire al salir de la lista numerada
      antes = lista;
      y = parrafo(page, sust(p), x, y, ancho, normal, negrita, size, lista ? 18 : 0) - (lista ? 2 : 7);
    }
    y -= 4;
  }

  // Recuadros de firma, como en la plantilla.
  const alto = 100;
  const cab = 22;
  y -= 6;
  const mitad = ancho / 2;
  for (let i = 0; i < 2; i++) {
    const bx = x + i * mitad;
    page.drawRectangle({ x: bx, y: y - cab - alto, width: mitad, height: cab + alto, borderColor: rgb(0, 0, 0), borderWidth: 0.8 });
    page.drawLine({ start: { x: bx, y: y - cab }, end: { x: bx + mitad, y: y - cab }, thickness: 0.8, color: rgb(0, 0, 0) });
    const t = winAnsi(T.firmas[i]);
    page.drawText(t, { x: bx + (mitad - normal.widthOfTextAtSize(t, size)) / 2, y: y - 15, size, font: normal });
  }
  return pdf.save();
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (isRateLimited(clientAddress)) return json({ error: 'Demasiadas peticiones' }, 429);
  const cuerpo = await request.text();
  if (cuerpo.length > TAMANO_MAXIMO) return json({ error: 'Demasiados datos' }, 413);
  let b: Record<string, any>;
  try {
    b = JSON.parse(cuerpo);
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const f = b?.f;
  if (typeof f !== 'object' || f === null) return json({ error: 'Datos no válidos', field: 'f' }, 400);
  const idioma: Idioma = ['es', 'ca', 'en'].includes(b.idioma) ? b.idioma : 'es';

  try {
    const salida: Record<string, string> = { mandato: b64(await rellenarMandato(f)), mandatoNombre: 'Mandato Seguridad Social TC 1-15-3.pdf' };
    if (b.poder === true) {
      const a = b.apoderado ?? {};
      const apoderado = { nombre: txt(a.nombre, 100).toUpperCase(), dni: sinEspacios(a.dni), domicilio: txt(a.domicilio, 200).toUpperCase() };
      if (!apoderado.nombre || !apoderado.dni || !apoderado.domicilio) return json({ error: 'Datos no válidos', field: 'apoderado' }, 400);
      salida.poder = b64(await generarPoder(f, idioma, apoderado));
      salida.poderNombre = PODER[idioma].nombreArchivo;
    }
    return json(salida);
  } catch (e) {
    console.error('Error rellenando los documentos del alta', e instanceof Error ? e.message : e);
    return json({ error: 'No se pudieron generar los documentos' }, 500);
  }
};
