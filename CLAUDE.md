## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Verificación de contenido fiscal (blog y FAQs)

El usuario tiene un notebook de NotebookLM ("Blog y FAQs AM", en notebooklm.google.com) que usa para revisar la precisión de los artículos del blog y las FAQs antes de darlos por buenos. Sus fuentes son normativa oficial (manuales e instrucciones de la Agencia Tributaria, leyes y reales decretos del BOE — Ley IRPF, Ley IVA, Ley General Tributaria, Verifactu, etc.), no los propios artículos.

Cuando se genere o edite contenido fiscal nuevo para el blog/FAQs, hay que pasarlo por ese notebook antes de darlo por definitivo: se abre vía Chrome (`mcp__claude-in-chrome__*`), se localiza el notebook en la pantalla de inicio de NotebookLM, y se pega en el chat cada pregunta/afirmación a verificar (funciona bien pegar el `{ q: '...', a: '...' }` tal cual sale de `ui.ts`) pidiendo que confirme si es correcto contra las fuentes y señale matices o errores. Si el notebook detecta que falta una fuente relevante (p. ej. una ley concreta no incluida), tiene la opción "Fast Research" para buscarla en la web e importarla como fuente nueva — usarla cuando la duda no se pueda resolver con las fuentes ya cargadas, pero verificar después si las fuentes que trae son oficiales (BOE/AEAT) o de terceros (despachos/blogs) antes de dar el dato por bueno.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
