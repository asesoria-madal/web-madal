# Arquitectura (Supabase / Vercel)

Referencia técnica para quien construya automatizaciones (n8n) u otras integraciones sobre esta web, sin tener que releer el código fuente. Generado el 2026-08-23 a partir del código real del repo en ese momento — si ha pasado tiempo y algo no cuadra con lo que veas en `src/`, `supabase/schema.sql` o el dashboard de Supabase/Vercel, fíate del código y actualiza este documento.

## Stack y despliegue

- **Framework**: Astro (`output: 'server'`), adapter `@astrojs/vercel`. Desplegado en **Vercel**, dominio `https://asesoriamadal.es`.
- **i18n**: `es` (por defecto, sin prefijo), `ca`, `en` — mismas rutas y misma lógica de backend en los tres idiomas.
- No hay `.vercel/project.json` en el repo local (no está enlazado por CLI en esta máquina) — el proyecto de Vercel se gestiona desde su dashboard/integración con GitHub, no desde aquí.

## Supabase — dos clientes distintos, no los confundas

El proyecto usa **dos clientes de Supabase diferentes** según dónde corre el código, definidos en `src/lib/`:

| Cliente | Archivo | Dónde corre | Variables de entorno | Clave |
|---|---|---|---|---|
| Admin | `src/lib/supabase.ts` → `getSupabaseAdmin()` | Servidor (endpoints `src/pages/api/*.ts`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Service role — **acceso total, se salta RLS**. Nunca debe llegar al navegador. |
| Browser | `src/lib/supabaseClient.ts` → `getSupabaseBrowser()` | Cliente (portal de clientes) | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | Anon — segura de exponer, el acceso real lo controla RLS en la base de datos. |

Ambos clientes devuelven `null` si faltan las variables de entorno correspondientes, en vez de lanzar error — así la web sigue funcionando en "modo degradado" (ver más abajo, simulador de precio) mientras el proyecto de Supabase no esté configurado en ese entorno (ej. preview de Vercel sin secrets).

**Si un workflow de n8n necesita leer/escribir en Supabase, usa el equivalente de la clave service role** (o una key de servicio propia de n8n con los mismos permisos), nunca la anon key — la anon key está limitada por las políticas RLS de abajo y no podrá, por ejemplo, marcar `fecha_contabilizado` en `facturas_subidas`.

## Tablas (`supabase/schema.sql` es la fuente de verdad — hay que ejecutarlo a mano en el SQL editor de Supabase, no hay migraciones automáticas)

### `quote_counters` y `presupuestos` — simulador de precio (`/simulador`)
- `quote_counters(year, value)`: contador atómico por año, vía función `next_quote_number(p_year)`, para generar códigos únicos `CC-26-00001`, `CC-26-00002`...
- `presupuestos`: una fila por cálculo de precio hecho en el simulador. `email` y `privacy_accepted_at` son **opcionales** — solo se rellenan si el visitante decide dejar su correo y acepta la política de privacidad (RGPD art. 5.2, principio de responsabilidad proactiva). `alta`, `certificado`, `actividad`, `fecha_inicio` solo se rellenan en la rama del simulador para autónomos que aún no están dados de alta.
- RLS activada y **sin políticas** en ninguna de las dos: solo la service role (backend) puede leer/escribir. No hay acceso desde el navegador ni desde una anon key.
- Si Supabase no está configurado (`getSupabaseAdmin()` devuelve `null`), el endpoint `api/presupuesto.ts` sigue funcionando en modo demo: genera un código `CC-26-DEMOxxxxx` sin persistir nada.

### `clientes` — portal de clientes (`/portal`, fase 2 del roadmap)
- Alta de cada cliente la hace el equipo a mano (con service role) — un cliente no puede crearse ni editarse a sí mismo.
- Login por **enlace mágico** (Supabase Auth OTP por email, `api/portal-login.ts`): el endpoint comprueba primero si el email ya existe en `clientes` (case-insensitive, `ilike` + índice único en `lower(email)`) y **solo si existe** llama a `supabase.auth.signInWithOtp(...)`. Si no existe, responde igual (`{ ok: true }`) para no revelar qué emails son clientes (protección contra enumeración). Tiene rate limiting best-effort en memoria (10 intentos / 10 min por IP) — no persiste entre cold starts ni se comparte entre instancias de Vercel, así que no es una defensa robusta contra fuerza bruta distribuida.
- `id` (propio, `uuid`) es independiente de `auth_user_id` (referencia a `auth.users`): la fila del cliente se crea con solo su email, y `auth_user_id` se rellena solo la primera vez que ese email inicia sesión, vía el trigger `on_auth_user_created` → función `vincular_cliente_nuevo()`.
- RLS: un cliente autenticado solo puede leer su propia fila (`auth.uid() = auth_user_id`). No hay política de insert/update/delete para clientes — esas operaciones son solo del equipo (service role).
- **Pendiente** (sin definir con Edurne todavía, según el propio `schema.sql`): la tabla con los datos financieros reales que verá cada cliente en el portal (facturación, gastos, beneficio...). Cuando exista, seguirá el mismo patrón: `cliente_id references clientes(id)` + política RLS vía `auth_user_id`.

### `facturas_subidas` — registro de facturas subidas por el cliente (relevante para n8n)
Esta es la tabla que va a tocar la primera automatización de n8n (ver `PENDIENTES-WEB.txt`, Bloque 4, y memoria del proyecto principal). Contexto necesario para no romper el diseño:

- El cliente sube su factura al bucket de Storage `facturas` (ver abajo) desde el portal, y eso crea también una fila aquí con los metadatos (`nombre_archivo`, `storage_path`, `fecha_subida`).
- **Por qué existe esta tabla aparte del Storage**: el plan es que la automatización baje cada factura del Storage a Drive compartido y, pasado un margen (pensado 7 días, por si falla la sincronización o el cliente necesita recuperarla), borre el archivo del Storage para ahorrar espacio. Si el portal siguiera listando directo desde `storage.objects`, el cliente perdería el registro de lo que subió en cuanto se borrara el archivo — por eso el registro vive en esta tabla, aparte, para siempre.
- `fecha_contabilizado`: se rellena cuando el equipo confirma que la factura ya está bajada a Drive. **Ahora mismo esto se hace a mano** en el Table Editor de Supabase (ver memoria `project_facturas_subidas` del proyecto principal) — es exactamente lo que la automatización de n8n debería empezar a hacer sola. No tiene por qué coincidir con el borrado del Storage: "contabilizada" = ya está en Drive; `storage_path = null` = ya se borró del Storage. Son dos pasos independientes, no asumas que van juntos.
- RLS: el cliente puede ver sus propias filas y crear una fila propia (siempre con `fecha_contabilizado` null — no puede marcarse a sí mismo como contabilizada). No hay política de update/delete para clientes: `fecha_contabilizado` y `storage_path` los toca solo el equipo (service role) o, en el futuro, la automatización — que necesitará la service role key para poder actualizar estas filas.

### Storage — bucket `facturas`
- Cada archivo se guarda en la ruta `${auth.uid()}/archivo.pdf`.
- Las políticas de `storage.objects` (creadas a mano en el dashboard de Supabase, no vía SQL — si el bucket se recrea desde cero hay que rehacerlas, están documentadas como comentario en `schema.sql`) restringen a cada cliente a listar/subir solo en su propia carpeta.

## Endpoints relevantes (`src/pages/api/`)

- `POST /api/presupuesto`: calcula precio del simulador (autónomo/pyme, tramos de facturas, reporting opcional) e inserta en `presupuestos`. Rate limit 20 req / 10 min / IP, en memoria.
- `PATCH /api/presupuesto`: añade email a un presupuesto ya generado, si el visitante cambia de opinión después de verlo sin dejar correo.
- `POST /api/portal-login`: envía enlace mágico si el email está en `clientes`. Ver detalle arriba.

Todos usan `getSupabaseAdmin()` (service role) y degradan con gracia (responden igual, sin persistir) si Supabase no está configurado en ese entorno.

## Variables de entorno (resumen)

| Variable | Server-only | Uso |
|---|---|---|
| `SUPABASE_URL` | Sí | Cliente admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí — **secreto, nunca al navegador** | Cliente admin |
| `PUBLIC_SUPABASE_URL` | No | Cliente browser (portal) |
| `PUBLIC_SUPABASE_ANON_KEY` | No — segura de exponer | Cliente browser (portal) |

No hay `.env.example` en el repo todavía — estas cuatro son las que hacen falta para tener Supabase funcionando en local/Vercel.

## Notas para quien construya workflows de n8n

- Para leer/escribir `facturas_subidas`, `clientes` o `presupuestos` desde n8n, necesitas credenciales equivalentes a la service role key (RLS bloqueará una anon key en casi todo lo que necesitarás hacer ahí).
- El caso de uso ya definido y con tabla lista para ello es la automatización de facturas: Storage `facturas` → Drive → marcar `fecha_contabilizado` → borrar del Storage tras el margen de días. No hace falta diseñar el esquema, ya existe.
- Los rate limiters de los endpoints públicos son en memoria y por instancia de Vercel — si un workflow llama a estos endpoints HTTP en vez de ir directo a Supabase, ten en cuenta que ese límite no es fiable bajo carga ni es una autenticación real.
