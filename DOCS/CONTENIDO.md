# Editar contenido: blog y FAQs

Cómo añadir o cambiar artículos del blog y preguntas frecuentes. No hace falta saber programar: son archivos de texto. Sí hace falta poder correr `npm run build` y hacer `git commit` + `git push` (o que lo haga quien lleve el repo).

Regla previa para **todo lo que tenga afirmaciones fiscales**: se contrasta en el notebook de NotebookLM **"Blog y FAQs AM"** (fuentes oficiales: BOE, AEAT) antes de publicar. Pegar la pregunta/afirmación y pedir que confirme contra las fuentes y señale matices. Los cambios que solo enlazan o reordenan, sin afirmación fiscal nueva, no lo necesitan.

---

## 1. Añadir un artículo al blog

### 1.1. Crear los tres archivos

Un artículo son **tres archivos Markdown, uno por idioma**, con el **mismo nombre de archivo**:

```
src/content/blog/es/<slug>.md
src/content/blog/ca/<slug>.md
src/content/blog/en/<slug>.md
```

El `<slug>` es el identificador y la URL del artículo (`/blog/<slug>`, `/ca/blog/<slug>`, `/en/blog/<slug>`). Usa minúsculas y guiones, sin tildes ni ñ: `deducir-coche-autonomo`. El slug del nombre de archivo y el campo `slug:` de dentro **deben coincidir**, y ser el mismo en los tres idiomas.

Los tres archivos son obligatorios. Si falta el `ca` o el `en`, esa versión de idioma del artículo no se construye (no da error de build, simplemente no existe esa página).

### 1.2. Frontmatter (la cabecera entre `---`)

```yaml
---
lang: es                     # es | ca | en — debe cuadrar con la carpeta
slug: deducir-coche-autonomo # igual que el nombre de archivo y en los 3 idiomas
title: '¿Cuánto te puedes desgravar del coche siendo autónomo?'
description: 'Frase corta para buscadores y para la tarjeta del listado.'
cat: fiscalidad              # fiscalidad | contabilidad | laboral | finanzas
date: 2026-08-30             # AAAA-MM-DD. Ordena el blog (más reciente arriba)
updatedDate: 2026-09-15      # opcional: fecha de la última revisión de contenido
sources:                     # opcional: normativa citada, ya verificada
  - label: 'Ley 37/1992 del IVA, art. 95'
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740'
draft: true                  # opcional: ver "Borradores" abajo
---
```

- **`cat`** solo admite esos cuatro valores. Cualquier otro rompe el build.
- **`sources`** es opcional y solo se rellena cuando aporta citar la norma exacta. Toda URL tiene que ser oficial (BOE / AEAT / Seguridad Social) y estar verificada.
- **`updatedDate`** no cambia el orden del blog; solo muestra "actualizado el…" en el artículo.

### 1.3. El cuerpo

Markdown normal debajo del segundo `---`. Los `##` son los subtítulos de sección (el `#` de título no se pone: sale del campo `title`).

**Enlaces internos a otros artículos** — con la ruta del idioma que corresponda:

- Desde un artículo `es`: `[texto](/blog/otro-slug)`
- Desde un artículo `ca`: `[text](/ca/blog/otro-slug)`
- Desde un artículo `en`: `[text](/en/blog/otro-slug)`

**Imágenes**: usar el componente `<Image>` de `astro:assets`, nunca `<img>` a pelo. (Si el artículo no lleva imágenes, no hay que hacer nada.)

### 1.4. Comprobar y publicar

```sh
npx astro check     # 0 errores
npm run build        # Complete, sin errores
```

Luego `git add`, `git commit`, `git push` a `main`. Vercel despliega solo en 1-2 min.

### 1.5. Enlazar el artículo nuevo

Un artículo suelto no lo encuentra nadie. Al publicarlo:

- Añade al menos un enlace **hacia** él desde un artículo ya existente que trate un tema cercano (edita ese `.md` en los tres idiomas).
- Si tiene sentido, añade una **FAQ** con `related: '<slug>'` (ver sección 2).
- La sección "artículos relacionados" al pie de cada artículo se genera **sola** (misma categoría + palabras compartidas en título/descripción/slug); no hay que tocarla.

### 1.6. Borradores (`draft: true`)

Un artículo con `draft: true` **queda fuera del build en todos los entornos** (también en las previews de Vercel y en local). No existe su página: cualquier enlace a su slug da 404.

Para publicarlo:

1. Quita la línea `draft: true` de los **tres** archivos (es/ca/en).
2. Pon una `date:` real (la de publicación).
3. `npx astro check` + `npm run build`, y si pasan, commit + push.

Cuidado con enlazar hacia un artículo que sigue en `draft`: ese enlace estará roto (404) hasta que se publique. Es una decisión consciente cada vez.

---

## 2. Añadir o cambiar una FAQ

Las preguntas frecuentes **no** están en archivos de contenido: viven en **`src/i18n/ui.ts`**, junto al resto de textos de interfaz.

### 2.1. Dónde

Hay tres grupos, y **cada grupo aparece tres veces** en el archivo (una por idioma):

| Grupo | Variable | Aproximadamente en la línea… |
|---|---|---|
| Generales | `faqGeneralesItems` | es ~240 · ca ~777 · en ~1314 |
| Autónomos | `faqAutonomosItems` | es ~257 · ca ~794 · en ~1331 |
| SL | `faqSlItems` | es ~269 · ca ~806 · en ~1343 |

(Las líneas se mueven al editar; busca el nombre de la variable.)

### 2.2. Forma de cada ítem

```js
{ q: '¿Texto de la pregunta?', a: 'Texto de la respuesta.', related: 'slug-de-un-articulo' },
```

- `q` y `a` son obligatorios. `related` es opcional.
- **`related`** es el slug (sin ruta ni idioma) de un artículo del blog. Cuando está:
  - en la página `/blog` añade un enlace "leer más" a ese artículo debajo de la respuesta;
  - en la página del propio artículo, hace que esa FAQ salga en su bloque de "preguntas relacionadas".
- El enlace "leer más" **no comprueba que el artículo exista**: si el slug está mal escrito o el artículo está en `draft`, será un 404. Verifica el slug.

### 2.3. Hazlo en los tres idiomas

Añade el ítem equivalente (traducido) en `faq…Items` de `es`, `ca` **y** `en`. El `related` es el mismo slug en los tres (el slug no se traduce).

### 2.4. Comprobar

```sh
npx astro check     # cuidado con comas y comillas: es un archivo .ts
npm run build
```

Si una respuesta lleva comillas simples (`'`), escápalas (`\'`) o usa comillas dobles para el string. Un `astro check` en verde confirma que la sintaxis está bien.

Luego commit + push a `main`.
