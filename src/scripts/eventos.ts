// Eventos de Umami que dependen de a qué se pulsa, no de un componente concreto. Escucha en
// `document` para cubrir todos los enlaces, también los del menú, el pie y el texto de los
// artículos, y para seguir funcionando al cambiar de página con ClientRouter. No envía datos
// personales. Los enlaces de la ventana de contacto no se cuentan aquí: ContactSwitch ya los
// registra como `contacto_click`.
import { track } from './analytics';

function origenDe(el: Element): string {
  if (el.closest('header.site, #mobileMenu')) return 'menu';
  if (el.closest('footer.site')) return 'pie';
  if (el.closest('.hero')) return 'portada_hero';
  if (el.closest('.sl-band')) return 'portada_franja';
  if (el.closest('.article-side')) return 'articulo_lateral';
  if (location.pathname.includes('/blog/')) return 'articulo_texto';
  return 'pagina';
}

document.addEventListener('click', (ev) => {
  const a = (ev.target as Element | null)?.closest?.('a[href]');
  if (!a || a.closest('.contact-dialog')) return;
  const href = a.getAttribute('href') ?? '';
  if (/^(\/(ca|en))?\/constituir-sl\/?(#.*)?$/.test(href)) {
    // Dentro de /constituir-sl solo hay anclas y cambios de idioma: no es una llegada.
    if (!/\/constituir-sl\/?$/.test(location.pathname)) track('sl_click', { origen: origenDe(a) });
  } else if (href.includes('meetings-eu1.hubspot.com')) {
    track('llamada_click', { origen: origenDe(a) });
  } else if (href.startsWith('mailto:')) {
    track('correo_click', { origen: origenDe(a) });
  }
});
