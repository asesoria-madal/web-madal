// Pequeñas reacciones al cursor en el hero de la Home: los dos botones
// (circular y de volumen) se acercan un poco al cursor dentro de su propia
// zona ("imán"), y el ticket de precio se desplaza levemente solo cuando el
// cursor está cerca de él — quieto el resto del tiempo, no flota solo.
// Puramente decorativo: si algo falla o el usuario prefiere menos
// movimiento, los botones y el precio siguen funcionando exactamente igual,
// solo sin el desplazamiento.

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function bindMagnet(zone: HTMLElement, strength = 18): void {
  const inner = zone.querySelector<HTMLElement>('.hero-magnet-inner');
  if (!inner) return;
  zone.addEventListener('mousemove', (e) => {
    const rect = zone.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    inner.style.transform = `translate(${(x * strength).toFixed(1)}px, ${(y * strength).toFixed(1)}px)`;
  });
  zone.addEventListener('mouseleave', () => { inner.style.transform = 'translate(0, 0)'; });
}

function bindTicketAndDots(visual: HTMLElement): void {
  const ticketWrap = visual.querySelector<HTMLElement>('.hero-ticket-wrap');
  const dots = Array.from(visual.querySelectorAll<HTMLElement>('.hero-dot'));
  if (!ticketWrap && !dots.length) return;

  visual.addEventListener('mousemove', (e) => {
    const rect = visual.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = (e.clientY - rect.top) / rect.height - 0.5;

    if (ticketWrap) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const proximity = Math.max(0, 1 - dist / 0.32);
      ticketWrap.style.transform = `translate(${(dx * -20 * proximity).toFixed(1)}px, ${(dy * -16 * proximity).toFixed(1)}px)`;
    }
    dots.forEach((dot, i) => {
      const mult = 22 + i * 8;
      const sign = i % 2 === 0 ? 1 : -1;
      dot.style.transform = `translate(${(dx * mult * sign).toFixed(1)}px, ${(dy * mult).toFixed(1)}px)`;
    });
  });
}

export function initHeroInteractions(): void {
  if (prefersReducedMotion()) return;
  const hero = document.querySelector<HTMLElement>('section.hero');
  if (!hero) return;

  hero.querySelectorAll<HTMLElement>('.hero-magnet').forEach((zone) => bindMagnet(zone));

  const visual = hero.querySelector<HTMLElement>('.hero-visual');
  if (visual) bindTicketAndDots(visual);
}
