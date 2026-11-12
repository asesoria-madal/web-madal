// IBAN: limpieza y comprobación del dígito de control (módulo 97, ISO 13616).
// Se usa en los formularios de alta y traspaso para la cuenta de domiciliación de impuestos
// (2026-11-12): una cuenta mal escrita haría fallar el cargo de un impuesto. Es la única
// validación "de verdad" de los formularios; el resto sigue el criterio laxo del proyecto.
// El script del formulario de alta (src/scripts/formulario-alta-autonomo.js) lleva una copia.

/** Quita espacios y pasa a mayúsculas. */
export function limpiarIban(v: string): string {
  return String(v ?? '').replace(/\s+/g, '').toUpperCase();
}

/** Formato de IBAN (y 24 caracteres si es español) y dígito de control correcto. */
export function ibanValido(v: string): boolean {
  const s = limpiarIban(v);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  if (s.startsWith('ES') && s.length !== 24) return false;
  let resto = 0;
  for (const ch of s.slice(4) + s.slice(0, 4)) {
    const digitos = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digitos) resto = (resto * 10 + Number(d)) % 97;
  }
  return resto === 1;
}
