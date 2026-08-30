# Web de Asesoría Madal

Sitio público de la gestoría (`https://asesoriamadal.es`) + portal de clientes. Astro 7 con render en servidor, desplegado en Vercel, datos en Supabase.

Este README es el índice. La documentación de detalle está en:

| Documento | Para qué |
|---|---|
| [`ARQUITECTURA.md`](ARQUITECTURA.md) | Cómo encaja todo: los dos clientes de Supabase, las tablas, RLS, Storage, los endpoints, las variables de entorno. **Léelo antes de tocar backend o construir automatizaciones.** |
| [`DOCS/CONTENIDO.md`](DOCS/CONTENIDO.md) | Añadir/publicar/traducir un artículo del blog y añadir preguntas frecuentes (FAQs). No hace falta saber programar. |
| [`DOCS/OPERACIONES.md`](DOCS/OPERACIONES.md) | Pasos manuales que no están automatizados, configuración que solo vive en los paneles de Supabase/Vercel, y cómo hacer deploy y rollback. |
| [`supabase/schema.sql`](supabase/schema.sql) | Esquema real de la base de datos, con comentarios de *por qué* en cada tabla. Manda sobre `ARQUITECTURA.md` si hay discrepancia. |
| [`CLAUDE.md`](CLAUDE.md) | Notas para trabajar con Claude Code en este repo (verificación de contenido fiscal en NotebookLM, modo del dev server). |

## Stack

- **Astro 7** (`output: 'server'`), pero **todas las páginas se prerenderizan** (`export const prerender = true`). Solo los 4 endpoints de `src/pages/api/` corren por petición.
- **Adapter `@astrojs/vercel`** → despliegue en Vercel, integrado con GitHub (push a `main` = deploy a producción).
- **Supabase** (Postgres + Auth + Storage) para el simulador de precio, los formularios y el portal de clientes.
- **i18n manual**: `es` (por defecto, sin prefijo de ruta), `ca`, `en`. Cada página existe como archivo aparte por idioma en `src/pages/`, `src/pages/ca/`, `src/pages/en/`. El portal, las páginas legales y los formularios existen **solo en castellano**.
- Sin Tailwind ni framework de UI: una sola hoja `src/styles/global.css` (~7 KB), inline en el `<head>`.

## Puesta en marcha en local

Requiere **Node ≥ 22.12**.

```sh
npm install
cp .env.example .env      # y rellena los 4 valores (ver ARQUITECTURA.md § Variables de entorno)
npm run dev               # http://localhost:4321
```

Sin `.env` la web arranca igual en **modo degradado**: el simulador devuelve códigos `CC-26-DEMO…` y los formularios responden con éxito pero no guardan nada. Útil para tocar solo maquetación/contenido.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente. |
| `npm run build` | Compila a `./dist/`. Es lo que corre Vercel en cada deploy. |
| `npm run preview` | Sirve el `build` en local para revisarlo antes de publicar. |
| `npx astro check` | Comprobación de tipos y del contenido. **Pásalo antes de cada commit.** |

## Estructura del repo

```
src/
├── pages/              Rutas. Una carpeta por idioma (raíz = es, ca/, en/).
│   ├── api/            Los 4 endpoints que sí corren en servidor (prerender = false).
│   └── blog/[slug].astro   Ruta dinámica de artículo (una por idioma).
├── components/
│   ├── pages/          Un componente por página (Home, Simulador, Portal, Blog, Articulo…).
│   └── *.astro         Header, Footer, CookieConsent, ContactSwitch.
├── content/blog/       Los artículos, en Markdown. Subcarpeta por idioma: es/ ca/ en/.
├── content.config.ts   Esquema (frontmatter) que deben cumplir los artículos.
├── i18n/
│   ├── ui.ts           TODOS los textos de interfaz y las FAQs, por idioma.
│   └── utils.ts        Helpers de idioma (detectar locale, construir la misma ruta en otro idioma).
├── lib/
│   ├── supabase.ts        Cliente admin (service role, solo servidor).
│   ├── supabaseClient.ts   Cliente browser (anon key, para el portal).
│   ├── blog.ts             Listado, orden y "artículos relacionados".
│   ├── modelosFiscales.ts  Cálculo de "días hasta tu próxima presentación" en el portal.
│   └── ads-config.ts       ID de conversión de Google Ads (pendiente de rellenar).
└── layouts/Layout.astro   Cabecera HTML común (meta, JSON-LD, estilos).

supabase/schema.sql     Fuente de verdad del esquema. Se ejecuta a mano en el SQL editor.
```

## Repositorio y despliegue

- GitHub: `asesoria-madal/web-madal`, rama de trabajo **`main`** (se trabaja directamente sobre `main`; para cambios grandes o a varias manos, rama y merge).
- Vercel: equipo `asesoria-madal`, proyecto `web-ase-madal` (plan Hobby). El proyecto **no está enlazado por CLI** en las máquinas locales: se gestiona desde su panel y la integración con GitHub. Push a `main` → deploy a producción; push a otra rama → deploy de preview.
- Las 4 variables de entorno se configuran en el panel de Vercel (Project Settings → Environment Variables), **no** en el repo.
- Rollback y detalle del flujo: [`DOCS/OPERACIONES.md`](DOCS/OPERACIONES.md).

## Antes de dar por bueno contenido fiscal

Cualquier artículo o FAQ con afirmaciones fiscales se contrasta en el notebook de NotebookLM **"Blog y FAQs AM"** (fuentes: BOE y AEAT) antes de publicarlo. Ver [`CLAUDE.md`](CLAUDE.md) y [`DOCS/CONTENIDO.md`](DOCS/CONTENIDO.md).
