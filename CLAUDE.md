## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Verificación de contenido fiscal (blog y FAQs)

El usuario tiene un notebook de NotebookLM ("Blog y FAQs AM", en notebooklm.google.com) que usa para revisar la precisión de los artículos del blog y las FAQs antes de darlos por buenos. Sus fuentes son normativa oficial (manuales e instrucciones de la Agencia Tributaria, leyes y reales decretos del BOE — Ley IRPF, Ley IVA, Ley General Tributaria, Verifactu, etc.), no los propios artículos.

Cuando se genere o edite contenido fiscal nuevo para el blog/FAQs, hay que pasarlo por ese notebook antes de darlo por definitivo: se abre vía Chrome (`mcp__claude-in-chrome__*`), se localiza el notebook en la pantalla de inicio de NotebookLM, y se pega en el chat cada pregunta/afirmación a verificar (funciona bien pegar el `{ q: '...', a: '...' }` tal cual sale de `ui.ts`) pidiendo que confirme si es correcto contra las fuentes y señale matices o errores. Si el notebook detecta que falta una fuente relevante (p. ej. una ley concreta no incluida), tiene la opción "Fast Research" para buscarla en la web e importarla como fuente nueva — usarla cuando la duda no se pueda resolver con las fuentes ya cargadas, pero verificar después si las fuentes que trae son oficiales (BOE/AEAT) o de terceros (despachos/blogs) antes de dar el dato por bueno.

## Diseño y marca

La paleta y tipografía corporativas reales viven como custom properties en `src/styles/global.css` (paper/ink/accent/warm + modo oscuro) y `@font-face` para Domine (display) + Public Sans (body) — **son la fuente de verdad, no un mockup antiguo**. `web-mockup/` (marca antigua "Cuenta Clara") ya no existe en el repo. Antes de proponer cualquier paleta o tipografía nueva para la web, comprobar primero `global.css`: en la sesión del 2026-09-15 se sustituyó por error esta paleta real por otra "menos genérica de IA" sin verificar que ya era la marca en producción — no repetir ese error.

Hubo una ronda de exploración visual de la home (hero tipográfico, tabla comparativa estilo Bauhaus, etc.) iterada en un canvas de diseño publicado como Artifact: https://claude.ai/code/artifact/2487eeb5-2f05-4653-b05d-472e741df4f4 — el resultado de esa exploración ya se aplicó directamente al código (ver más abajo), el canvas queda solo como referencia histórica por si se retoma esa exploración visual más adelante.

## Rediseño de interacción — 2026-09-15

Auditoría de diseño de toda la web (no solo la home) con el objetivo de que se sienta dinámica/memorable sin parecer una plantilla genérica de IA, manteniendo estrictamente la paleta y tipografía corporativas de arriba. Implementado directamente en el código real (no solo maquetas):

- **Transiciones de página** nativas de Astro (`<ClientRouter />` en `Layout.astro`, `astro:transitions`), con el wordmark del header persistiendo visualmente entre navegaciones (`transition:name="wordmark"`).
- **Cifras de precio animadas**: `src/scripts/countup.ts` — el precio del hero, la tabla de precios, la caja de alta y el resultado del simulador cuentan hasta su valor final al entrar en pantalla (o al calcularse). Respeta `prefers-reduced-motion`.
- **FAQ con apertura animada**: `src/scripts/faqAccordion.ts` — los `<details>` nativos se quedan como fuente de verdad (accesibles, funcionan sin JS), solo se anima la transición de altura.
- **Header sin iconografía emoji**: 🌙☀️🌐🇪🇸🇬🇧👤 sustituidos por SVGs propios de un color (`currentColor`) y una insignia de texto ES/CA/EN consistente para los tres idiomas.
- **`/servicios#dashboards`**: ejemplo ilustrativo del mismo gráfico SVG que ya existe en el Portal (mismo trazo, mismas clases CSS `.finanzas-evo-*`), con datos fijos explícitamente etiquetados como "ejemplo ilustrativo, no son datos reales de ningún cliente" en los 3 idiomas — demuestra el reporting en vez de solo describirlo en texto.
- **404 con personalidad**: "Esta página no cuadra en el balance" en vez de un 404 genérico.
- **Fix necesario para que lo anterior no rompiera nada**: con `<ClientRouter />`, los scripts de componentes que aparecen en todas las páginas (Header, ContactSwitch, CookieConsent) o en páginas a las que se navega mucho desde otras (Simulador, buscador/FAQ de Blog, compartir/FAQ de Articulo) dejaban de reaccionar tras la primera transición si no se reenganchaban al evento `astro:page-load`. Están arreglados; **el resto de scripts del sitio (Portal, formularios largos) no se tocaron** — si en algún momento se navega a ellos vía transición de página desde otra ruta en vez de con carga completa, podrían necesitar el mismo arreglo.

**Pendiente de decidir (no implementado):** una sección de "prueba sin testimonios inventados" — mostrar un fragmento real anonimizado de un balance/PyG explicado, en vez de testimonios de clientes (que en este momento no existen y fabricarlos sería una práctica engañosa "lista negra" bajo la Ley de Competencia Desleal reformada en 2022 — riesgo legal real, no solo de estilo). Retomar cuando el usuario quiera definir el contenido concreto.

**Limitación conocida, no bloqueante:** el listener de scroll del aviso flotante de contacto en `Articulo.astro` (`.article-nudge`) se reengancha en cada `astro:page-load` sin desenganchar el anterior — no rompe nada (apunta a elementos ya desmontados), pero con muchas navegaciones seguidas entre artículos se acumulan listeners inertes. Limpiar si se quiere pulir del todo.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
