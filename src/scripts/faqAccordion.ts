// Anima la apertura/cierre de los <details class="faq-item"> en vez de
// dejar el salto brusco nativo del navegador. El <details> nativo se queda
// como fuente de verdad (accesible, funciona sin JS): esto solo intercepta
// el clic para animar la transición, y si algo falla (sin WAAPI, JS
// deshabilitado) el acordeón sigue abriendo/cerrando al instante como
// siempre lo ha hecho.

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function enhanceFaqAccordions(selector = '.faq-item'): void {
  if (prefersReducedMotion()) return;
  if (typeof Element === 'undefined' || !('animate' in Element.prototype)) return;

  document.querySelectorAll<HTMLDetailsElement>(selector).forEach((details) => {
    const summary = details.querySelector('summary');
    const body = details.querySelector<HTMLElement>('.faq-item-body');
    if (!summary || !body) return;
    let animating = false;

    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (animating) return;
      if (details.open) closeItem(details, body, () => { animating = false; });
      else openItem(details, body, () => { animating = false; });
      animating = true;
    });
  });
}

function openItem(details: HTMLDetailsElement, body: HTMLElement, done: () => void): void {
  details.open = true;
  const target = body.scrollHeight;
  body.style.overflow = 'hidden';
  const anim = body.animate([{ height: '0px' }, { height: `${target}px` }], { duration: 220, easing: 'ease' });
  anim.onfinish = () => {
    body.style.height = '';
    body.style.overflow = '';
    done();
  };
}

function closeItem(details: HTMLDetailsElement, body: HTMLElement, done: () => void): void {
  const start = body.scrollHeight;
  body.style.overflow = 'hidden';
  const anim = body.animate([{ height: `${start}px` }, { height: '0px' }], { duration: 180, easing: 'ease' });
  anim.onfinish = () => {
    details.open = false;
    body.style.height = '';
    body.style.overflow = '';
    done();
  };
}
