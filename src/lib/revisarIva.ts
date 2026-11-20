// ---------- comprobaciones fiscales (2026-11-20) ----------
// revisarIva(datos, ctx) -> { bloqueos: [..], avisos: [..] }. ctx: { tipoPersona: 'autonomo'|'sl', grupo }.
// Bloqueos: errores claros que no se pueden contabilizar así (la pantalla de revisión y "Contabilizar en Cegid"
// no los dejan pasar). Avisos: cosas raras que hay que mirar; dejan la factura en naranja.
// Copia de revisarIva de n8n-workflows/workflows/lector-facturas.js, que también usan la lectura nocturna y
// "Contabilizar en Cegid": si se cambia aquí, hay que cambiarla allí (y volver a montar los dos workflows).
export type LineaIva = { base: number | null; pct: number | null; cuota: number | null };
export type DatosIva = { tipo?: string | null; emisor?: { nif?: string | null } | null; receptor?: { nif?: string | null } | null; lineas?: LineaIva[] | null; sin_iva?: string | null; vies?: { valido: boolean } | null; retencion?: { pct: number; cuota: number } | null };

export function revisarIva(d: DatosIva | null | undefined, ctx?: { tipoPersona?: string | null; grupo?: string | null }): { bloqueos: string[]; avisos: string[] } {
  const TIPOS_IVA = [0, 2, 4, 5, 7.5, 10, 21]; // 21, 10 y 4 generales; 5, 7,5 y 2 temporales de 2022-2024
  const TIPOS_RET = [1, 2, 7, 15, 19];
  const UE_ = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];
  const bloqueos: string[] = [], avisos: string[] = [];
  if (!d) return { bloqueos, avisos };
  const emitida = d.tipo === 'emitida';
  const contra = (emitida ? d.receptor : d.emisor) || {};
  const nif = String(contra.nif || '').toUpperCase().replace(/[\s-]/g, '');
  if (!nif) return { bloqueos, avisos };
  const intra = UE_.includes(nif.slice(0, 2));
  const espanol = /^([\dXYZ]\d{7}[A-Z]|[A-W]\d{7}[0-9A-J])$/.test(nif);
  const fuera = !intra && !espanol;
  const lineas = (d.lineas || []).filter((l: LineaIva) => l && l.base !== null && l.base !== undefined).map((l: LineaIva) => ({ ...l, base: Number(l.base) }));
  const isp = d.sin_iva === 'inversion_sujeto_pasivo';
  // En una recibida con inversión del sujeto pasivo, la cuota la autoliquidamos nosotros: la factura va sin IVA.
  const cuota = isp && !emitida ? 0 : Math.round(lineas.reduce((s: number, l: { base: number; pct: number | null; cuota: number | null }) => s + (Number(l.cuota) || 0), 0) * 100) / 100;
  const conIva = cuota !== 0;
  const quien = emitida ? 'cliente' : 'proveedor';
  const eur = (n: number) => Number(n).toFixed(2).replace('.', ',');
  const pct = (n: number) => String(n).replace('.', ',') + ' %';
  const grupo = String((ctx && ctx.grupo) || '');
  const alquiler = /^(621|752)/.test(grupo) || grupo === '12';
  const sl = !!ctx && ctx.tipoPersona === 'sl';

  // NIF intracomunitario
  if (intra && d.vies && d.vies.valido === false) bloqueos.push('El NIF ' + nif + ' no es válido en VIES: no se puede tratar como operación intracomunitaria. ' + (emitida ? 'Sin NIF-IVA válido, la factura tiene que llevar IVA español.' : 'Pedid al proveedor que lo compruebe o que facture con IVA.'));
  if (intra && !d.vies) avisos.push('Falta comprobar en VIES el NIF ' + nif + '.');

  if (!emitida) {
    if (intra && conIva) bloqueos.push('El proveedor es de otro país de la UE (' + nif + ') y la factura lleva ' + eur(cuota) + ' € de IVA. Entre empresas no se cobra IVA: va sin IVA y se autoliquida (inversión del sujeto pasivo). Si lo ha cobrado, os ha tratado como particular (no tenía vuestro NIF-IVA o no estáis en el registro de operadores intracomunitarios, ROI), y ese IVA no se puede deducir. Dos salidas: pedid la factura rectificada dándole el NIF-IVA, o contabilizadla con el IVA como más gasto (todo el total como base y sin IVA).');
    if (fuera && conIva) avisos.push('Proveedor de fuera de la UE (' + nif + ') con IVA: solo es correcto si está dado de alta en el IVA español (en la factura debería salir su NIF español). Si no, va sin IVA y como inversión del sujeto pasivo, y si es IVA de otro país no se deduce.');
    if (!espanol && !conIva && !isp && lineas.length) avisos.push('Proveedor extranjero sin IVA: marca "Inversión del sujeto pasivo" para que se autoliquide el IVA.');
    if (espanol && isp) avisos.push('Inversión del sujeto pasivo con un proveedor español: solo en casos concretos (obras de urbanización o rehabilitación, chatarra, oro, móviles y ordenadores a revendedores, inmuebles con renuncia a la exención...). Compruébalo.');
  } else {
    if (intra && conIva && !(d.vies && d.vies.valido === false)) bloqueos.push('El cliente es de otro país de la UE (' + nif + ') y la factura lleva IVA. Con NIF-IVA válido, las entregas de bienes van exentas (art. 25 de la Ley del IVA) y los servicios a empresas no están sujetos en España (art. 69): la factura tiene que ir sin IVA y hay que rectificarla.');
    if (fuera && conIva) avisos.push('Cliente de fuera de la UE (' + nif + ') con IVA: los servicios a empresas de fuera de la UE normalmente no llevan IVA español y las exportaciones de bienes van exentas. Compruébalo (es correcto, por ejemplo, si el cliente es un particular o el servicio es sobre un inmueble en España).');
    if (intra && !conIva && !(d.vies && d.vies.valido === false)) avisos.push('Operación intracomunitaria: la factura tiene que indicar "inversión del sujeto pasivo" (servicios) o "entrega exenta art. 25 LIVA" (bienes), y va en el modelo 349.');
  }
  if (espanol && !conIva && !isp && d.sin_iva !== 'exenta' && lineas.length) avisos.push('Factura de un ' + quien + ' español sin IVA: si está exenta, márcalo en "Sin IVA" (y comprueba que la factura diga por qué); si no, revisa el IVA.');

  // Tipos y cuotas
  if (!(isp && !emitida)) for (const l of lineas) {
    if (l.pct !== null && l.pct !== undefined && !TIPOS_IVA.includes(Number(l.pct))) avisos.push('Tipo de IVA del ' + pct(l.pct) + ': no es un tipo español (21, 10 o 4 %).' + (!espanol ? ' Si es IVA de otro país, no se deduce en España.' : ''));
    if (l.pct && l.cuota !== null && l.cuota !== undefined && Math.abs(Math.round(l.base * l.pct) / 100 - l.cuota) > 0.02) avisos.push('La cuota de IVA de ' + eur(l.cuota) + ' € no es el ' + pct(l.pct) + ' de ' + eur(l.base) + ' €.');
  }

  // Retención
  const ret = d.retencion && d.retencion.cuota ? d.retencion : null;
  if (ret) {
    if (!TIPOS_RET.includes(Number(ret.pct))) avisos.push('Retención del ' + pct(ret.pct) + ': los tipos habituales son 15 % (profesionales), 7 % (nuevos profesionales), 19 % (alquileres), 1 % y 2 % (módulos y agrarios).');
    if (!espanol) avisos.push('Retención con un ' + quien + ' extranjero: la retención española no se aplica a un no residente (tributa por el IRNR, con sus propios tipos). Compruébalo.');
    if (!emitida && espanol && /^[ABCDFGNPQRSUVW]/.test(nif) && !alquiler) avisos.push('Retención de una sociedad (' + nif + '): las sociedades solo llevan retención en los alquileres. Si es un alquiler, elige la cuenta o el grupo de arrendamientos.');
    if (emitida && sl && !alquiler) avisos.push('Factura emitida por una sociedad con retención: una SL solo repercute retención si alquila un local. Revísala.');
    const bases = lineas.reduce((s: number, l: { base: number; pct: number | null; cuota: number | null }) => s + l.base, 0);
    if (bases && Math.abs(Math.round(bases * ret.pct) / 100 - ret.cuota) > 0.05) avisos.push('La retención de ' + eur(ret.cuota) + ' € no es el ' + pct(ret.pct) + ' de la base.');
  }
  return { bloqueos, avisos };
}
