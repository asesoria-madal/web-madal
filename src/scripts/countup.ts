// Cifras que "aterrizan" en su valor final al entrar en pantalla, en vez de
// aparecer estáticas de golpe. El sitio gira en torno a números (precios,
// desgloses) así que esta animación tiene sentido semántico propio, no es
// un efecto decorativo importado de otro rubro.
//
// Respeta prefers-reduced-motion (salta directo al valor final) y nunca usa
// aria-live en el número intermedio: el valor final ya es el texto real del
// elemento, así que un lector de pantalla siempre puede leerlo correctamente
// fuera de la ventana breve de animación.

const DURATION_MS = 900;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Ease-out cúbico: la cifra sube rápido al principio y se posa despacio al
// final, como si aterrizara — no un contador mecánico a velocidad constante.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Anima un número de 0 al valor final, formateando cada fotograma con `format`. */
export function animateCountUp(
  el: HTMLElement,
  target: number,
  format: (n: number) => string,
  duration = DURATION_MS
): void {
  if (prefersReducedMotion() || target === 0) {
    el.textContent = format(target);
    return;
  }
  const start = performance.now();
  function tick(now: number) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = format(target * easeOutCubic(progress));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/**
 * Detecta automáticamente el número dentro del texto ya renderizado por
 * Astro/i18n (p.ej. "desde 48,40 €") y lo anima la primera vez que el
 * elemento entra en el viewport. Deliberadamente NO recibe el valor por un
 * atributo aparte: así el número que se anima es siempre exactamente el que
 * ya tradujo/formateó la plantilla, sin duplicarlo a mano en JS.
 *
 * El elemento marcado con `data-countup` debe ser una hoja (sin elementos
 * hijos) — si contiene texto e hijos mezclados, envuelve solo la parte
 * numérica en su propio span antes de marcarlo.
 */
export function observeCountUp(selector = '[data-countup]'): void {
  const els = document.querySelectorAll<HTMLElement>(selector);
  if (!els.length) return;
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        enhanceOne(entry.target as HTMLElement);
      });
    },
    { threshold: 0.5 }
  );

  els.forEach((el) => observer.observe(el));
}

function enhanceOne(el: HTMLElement): void {
  const original = el.textContent || '';
  const match = original.match(/\d[\d.,]*\d|\d/);
  if (!match || match.index === undefined) return;

  const raw = match[0];
  const before = original.slice(0, match.index);
  const after = original.slice(match.index + raw.length);

  // El separador decimal es el que va seguido de exactamente 2 dígitos al
  // final ("48,40" o "48.40"); cualquier otro punto/coma en el número es
  // separador de miles.
  const decimalMatch = raw.match(/([.,])(\d{2})$/);
  const decimalSep = decimalMatch ? decimalMatch[1] : null;
  const decimals = decimalMatch ? 2 : 0;
  const integerRaw = decimalSep ? raw.slice(0, -3) : raw;
  const numericValue = parseFloat(integerRaw.replace(/[.,]/g, '') + (decimalMatch ? '.' + decimalMatch[2] : ''));
  if (Number.isNaN(numericValue)) return;
  const thousandSep = decimalSep === ',' ? '.' : decimalSep === '.' ? ',' : '';

  function format(n: number): string {
    const [intPart, decPart] = n.toFixed(decimals).split('.');
    const withThousands = thousandSep ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep) : intPart;
    return before + withThousands + (decPart ? decimalSep + decPart : '') + after;
  }

  animateCountUp(el, numericValue, format);
}
