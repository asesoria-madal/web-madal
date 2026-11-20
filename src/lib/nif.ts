// Validación del NIF/NIE/CIF con su dígito o letra de control (2026-11-20).
// Sirve para frenar entradas inventadas o con una errata: un NIF cualquiera con la forma correcta
// (ocho cifras y una letra) ya no basta. Es deliberadamente benévolo con lo que no puede
// comprobar bien: los NIF que empiezan por K, L o M (menores y españoles sin DNI) solo se
// validan por forma, para no rechazar a un cliente real.
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const LETRAS_CIF = 'JABCDEFGHI';
// NIF de prueba del equipo (los mismos que excluyen los workflows de n8n): no tienen letra correcta.
const NIF_DE_PRUEBA = new Set(['23845033J', '11111111A', '33333333A', '99999998W']);

function letraDni(n: number): string {
  return LETRAS_DNI[n % 23];
}

function cifValido(v: string): boolean {
  if (!/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(v)) return false;
  const digitos = v.slice(1, 8).split('').map(Number);
  let suma = 0;
  digitos.forEach((d, i) => {
    if (i % 2 === 0) {
      const doble = d * 2;
      suma += Math.floor(doble / 10) + (doble % 10);
    } else {
      suma += d;
    }
  });
  const control = (10 - (suma % 10)) % 10;
  const esperadaDigito = String(control);
  const esperadaLetra = LETRAS_CIF[control];
  const ultimo = v[8];
  // Letra obligatoria: P, Q, R, S, N, W. Dígito obligatorio: A, B, E, H. El resto admite las dos.
  if ('PQRSNW'.includes(v[0])) return ultimo === esperadaLetra;
  if ('ABEH'.includes(v[0])) return ultimo === esperadaDigito;
  return ultimo === esperadaDigito || ultimo === esperadaLetra;
}

export function nifValido(entrada: string): boolean {
  const v = String(entrada ?? '').toUpperCase().replace(/[\s.-]/g, '');
  if (NIF_DE_PRUEBA.has(v)) return true;
  if (/^[0-9]{8}[A-Z]$/.test(v)) return letraDni(Number(v.slice(0, 8))) === v[8];
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(v)) return letraDni(Number('XYZ'.indexOf(v[0]) + v.slice(1, 8))) === v[8];
  if (/^[KLM][0-9]{7}[A-Z0-9]$/.test(v)) return true;
  return cifValido(v);
}
