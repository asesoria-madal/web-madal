// Piezas compartidas por las calculadoras de Madal Pricing (tarifa por hora y precio de un servicio).
// - initListaCostes: lista editable de costes (filas fijas + filas añadidas por el usuario con
//   concepto libre y botón de quitar). Devuelve una función que suma todos los inputs [data-coste].
// - pintarBarra: barra apilada + leyenda con el reparto del precio (cada tramo en € y su % del total).
// Solo DOM y cálculo en el navegador; no envía nada.

export function initListaCostes(lista: HTMLElement, alCambiar: () => void): () => number {
  const filas = lista.querySelector('.pp-cost-rows') as HTMLElement;
  const boton = lista.querySelector('[data-add]') as HTMLButtonElement | null;

  boton?.addEventListener('click', () => {
    const fila = document.createElement('div');
    fila.className = 'pp-cost pp-cost-extra';
    fila.innerHTML =
      '<input type="text" class="pp-cost-name" placeholder="Concepto" aria-label="Concepto del gasto" maxlength="60" />' +
      '<input type="number" data-coste inputmode="decimal" min="0" step="5" value="0" aria-label="Importe" />' +
      '<button type="button" class="pp-cost-del" aria-label="Quitar este gasto">×</button>';
    fila.querySelector('.pp-cost-del')!.addEventListener('click', () => {
      fila.remove();
      alCambiar();
    });
    filas.appendChild(fila);
    (fila.querySelector('input') as HTMLInputElement).focus();
  });

  return () =>
    Array.from(lista.querySelectorAll<HTMLInputElement>('input[data-coste]'))
      .reduce((s, i) => s + Math.max(0, Number(i.value) || 0), 0);
}

export type Tramo = { l: string; v: number; c: string };

export function pintarBarra(barra: HTMLElement, leyenda: HTMLElement, tramos: Tramo[], fmt?: Intl.NumberFormat) {
  const total = tramos.reduce((s, t) => s + Math.max(0, t.v), 0);
  if (total <= 0 || !fmt) {
    barra.innerHTML = '';
    leyenda.innerHTML = '';
    return;
  }
  const visibles = tramos.filter((t) => t.v > 0);
  barra.innerHTML = visibles
    .map((t) => `<span class="pp-seg pp-seg-${t.c}" style="width:${(t.v / total) * 100}%"></span>`)
    .join('');
  leyenda.innerHTML = visibles
    .map((t) => `<li><i class="pp-seg-${t.c}"></i><span>${t.l}</span><b>${fmt.format(t.v)}</b><em>${Math.round((t.v / total) * 100)} %</em></li>`)
    .join('');
}
