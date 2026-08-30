# Arquitectura (Supabase / Vercel)

Referencia técnica para quien construya automatizaciones (n8n) u otras integraciones sobre esta web, sin tener que releer el código fuente. Regenerado el **2026-08-26** a partir del código real del repo, y revisado el **2026-08-30** (sigue cuadrando con `supabase/schema.sql` tras los cambios de administrador de portal y de `visionwin_empresa_codigo`) — si ha pasado tiempo y algo no cuadra con lo que veas en `src/`, `supabase/schema.sql` o el dashboard de Supabase/Vercel, fíate del código y actualiza este documento.

Para tareas concretas hay guías aparte: **`DOCS/CONTENIDO.md`** (editar blog y FAQs) y **`DOCS/OPERACIONES.md`** (pasos manuales, config de paneles, deploy y rollback). El índice del repo es **`README.md`**.

**`supabase/schema.sql` manda sobre este documento.** Sus comentarios explican el *porqué* de cada decisión de diseño; aquí solo está el resumen operativo.

## Stack y despliegue

- **Framework**: Astro 7 (`output: 'server'`), adapter `@astrojs/vercel`. Desplegado en **Vercel**, dominio `https://asesoriamadal.es`. Node ≥ 22.12.
- **Todo se prerenderiza**: pese al `output: 'server'`, cada página lleva `export const prerender = true`. Solo los cuatro endpoints de `src/pages/api/` corren por petición (`prerender = false`).
- **i18n**: `es` (por defecto, sin prefijo), `ca`, `en`. Rutas duplicadas a mano (sin middleware), misma lógica de backend en los tres. Las páginas legales, el portal y los tres formularios existen **solo en castellano**.
- **Sitemap**: integración `@astrojs/sitemap`, excluye `/solicitud`.
- No hay `.vercel/project.json` en el repo local (no está enlazado por CLI en esta máquina) — el proyecto de Vercel se gestiona desde su dashboard/integración con GitHub.

## Supabase — dos clientes distintos, no los confundas

| Cliente | Archivo | Dónde corre | Variables de entorno | Clave |
|---|---|---|---|---|
| Admin | `src/lib/supabase.ts` → `getSupabaseAdmin()` | Servidor (endpoints `src/pages/api/*.ts`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Service role — **acceso total, se salta RLS**. Nunca debe llegar al navegador. |
| Browser | `src/lib/supabaseClient.ts` → `getSupabaseBrowser()` | Cliente (portal, `Portal.astro`) | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | Anon — segura de exponer, el acceso real lo controla RLS. |

Ambos devuelven `null` si faltan sus variables de entorno, en vez de lanzar error — así la web sigue funcionando en "modo degradado" (ver abajo) mientras el proyecto de Supabase no esté configurado en ese entorno (ej. preview de Vercel sin secrets).

**Si un workflow de n8n necesita leer/escribir en Supabase, usa el equivalente de la service role key**, nunca la anon key: RLS la bloqueará en casi todo lo que necesitarás hacer (marcar `fecha_contabilizado`, dar de alta clientes, leer presupuestos…).

## La clave que lo une todo: el NIF

**`clientes.id` es el NIF/NIE del cliente en texto, en mayúsculas** — no un uuid (migración del 2026-08-25). El motivo es precisamente n8n: con `id = NIF`, el workflow que da de alta al cliente al firmar el presupuesto y el que recibe las respuestas de los tres formularios pueden buscar/crear la fila directamente por NIF, sin lookup intermedio. La FK de `facturas_subidas` es `on update cascade`, así que corregir un NIF mal tecleado es un simple `update clientes set id = …`.

**Pero las políticas RLS no usan `id`, usan `auth_user_id`** (columna aparte, uuid → `auth.users`). Se rellena sola vía el trigger `on_auth_user_created` → `vincular_cliente_nuevo()`, **solo en el primer login** de ese email. Consecuencia práctica documentada en `schema.sql`: si recreas una fila de `clientes` para un email que *ya* tenía cuenta de Auth, `auth_user_id` se queda en `null` para siempre y todo lo que dependa de RLS falla en silencio. Hay un backfill para eso al final del bloque de migración.

## Tablas

`schema.sql` se ejecuta **a mano en el SQL editor de Supabase**. No hay migraciones automáticas: es un archivo acumulativo con bloques marcados "ejecutar UNA VEZ".

### `quote_counters` + `presupuestos` — simulador de precio (`/simulador`)

- `quote_counters(year, value)`: contador atómico por año vía la función `next_quote_number(p_year)`, que genera códigos únicos `CC-26-00001`, `CC-26-00002`…
- `presupuestos`: una fila por cálculo hecho en el simulador. `email` y `privacy_accepted_at` son **opcionales** — solo se rellenan si el visitante decide dejar su correo y acepta la política de privacidad (RGPD art. 5.2). `alta`, `certificado`, `actividad` y `fecha_inicio` solo se rellenan en la rama del simulador para autónomos que aún no están dados de alta.
- **Columnas de seguimiento para n8n**: `presupuesto_enviado_at` (al mandar el presupuesto por email), `recordatorio_enviado_at` (recordatorio a los 5 días sin respuesta) y `respondido_at`, que rellena automáticamente otro flujo de n8n leyendo la bandeja por IMAP y cruzando el remitente con esta tabla. Mientras `respondido_at` sea `null`, el presupuesto cuenta como "sin respuesta". El recordatorio **no** usa threading real por cabeceras (`In-Reply-To`/`References`): el nodo Send Email de n8n no las expone, así que se manda con el mismo asunto prefijado `Re:`, que Gmail agrupa igual.
- RLS activada y **sin políticas** en ambas: solo la service role puede leer/escribir.
- Si Supabase no está configurado, `api/presupuesto.ts` sigue funcionando en modo demo: devuelve un código `CC-26-DEMOxxxxx` sin persistir nada.

### `alta_nuevos_autonomos` — formulario de alta

Datos que Edurne necesita para tramitar el alta en Hacienda/Seguridad Social una vez el cliente ha aceptado el presupuesto. Página suelta (`/formulario-alta`), sin enlazar desde el menú: el enlace se manda al cliente tras la llamada de venta, con `?nif=…`, y ese valor llega en `nif_nie`. El vínculo con el presupuesto se hace **por NIF**, no por `quote_code` (esa columna se eliminó).

`privacy_accepted_at` es obligatorio aquí (a diferencia de `presupuestos`): el formulario recoge NIF, IBAN y domicilio sí o sí.

### `traspasos_nuevos` — clientes que vienen de otra gestoría

**Dos páginas, una tabla**: `/formulario-traspaso-autonomo` y `/formulario-traspaso-sl` son el mismo componente Astro con un prop `tipo`, y la columna `tipo` (`'autonomo' | 'sl'`) distingue el origen de cada fila. Las columnas que solo aplican a un tipo quedan `NULL` en las filas del otro.

- Solo autónomo: `fecha_alta_actividad`, `epigrafes_iae_actuales`, `regimen_iva_actual`, `regimen_irpf_actual`, `factura_con_retencion`, `porcentaje_retencion`.
- Solo SL: `domicilio_social`.
- `nombre_razon_social` y `nif_cif` están unificados a propósito: es el mismo dato de negocio bajo dos etiquetas según el tipo.

Este formulario **no sube archivos**. La documentación a pedir a la gestoría anterior y a aportar por el cliente se muestra como texto informativo, y el equipo la recoge por email/Drive.

### `clientes` — portal de clientes (`/portal`)

- Alta de cada fila la hace el equipo o un workflow (service role) — un cliente no puede crearse ni editarse a sí mismo.
- Login por **enlace mágico** (Supabase Auth OTP, `api/portal-login.ts`): el endpoint comprueba primero si el email existe en `clientes` (`ilike`, insensible a mayúsculas, respaldado por el índice único en `lower(email)`) y **solo si existe** llama a `signInWithOtp`. Si no existe, responde `{ ok: true }` igualmente, para no revelar qué emails son clientes. Rate limit best-effort en memoria (10 intentos / 10 min por IP).
- `reporting` (boolean) decide si el portal muestra el panel de dashboards o el CTA para contratarlo. `tipo_persona` (`'autonomo' | 'sl'`, puede ser `NULL`) decide qué PDF de presentación de servicios se le ofrece en el panel de Documentación.
- `alta_hecha` (boolean, nullable) es **para la automatización de onboarding de n8n**, y solo aplica cuando `tipo_persona = 'autonomo'`:

  | `tipo_persona` | `alta_hecha` | Interpretación |
  |---|---|---|
  | `NULL` | — | Falta por rellenar (incompleto) |
  | `'autonomo'` | `NULL` | Falta por rellenar (incompleto) |
  | `'autonomo'` | `true` | Necesita alta (la tramitamos nosotros) |
  | `'autonomo'` | `false` | Ya estaba de alta (traspaso) |
  | `'sl'` | — | SL; `alta_hecha` no aplica, se ignora |

  El diseño previsto es un trigger `AFTER INSERT` sobre `clientes` que dispara un webhook `cliente-nuevo` de n8n. **Ese trigger no está en `schema.sql`** — si el workflow depende de él, hay que crearlo.
- `modelos` (`text[]`, `not null default '{}'`, añadido 2026-08-26) — qué modelos fiscales presenta el cliente (130, 131, 111, 115, 303, 349, 202, 200, 347, 390, 190, 180; ver el comentario junto a la columna en `schema.sql` para el detalle de cada uno). Primer campo multivalor del esquema — se rellena a mano en el Table Editor, sin endpoint ni CHECK, igual que `alta_hecha`. Lo usa `src/lib/modelosFiscales.ts` para calcular, en `Portal.astro`, el stat "días hasta tu próxima presentación de impuestos" — visible para **todos** los clientes (no depende de `reporting`: es información básica de gestoría, no una funcionalidad de pago).
- `visionwin_empresa_codigo` (`text`, nullable) — código de la empresa del cliente en Visionwin (el ERP de contabilidad). Se rellena **a mano** en el Table Editor cuando el equipo da de alta al cliente y le crea su empresa en Visionwin; ningún endpoint lo escribe. Es el flag de "cliente ya configurado en Visionwin": el workflow n8n **"Descarga de facturas"** solo baja una factura del Storage a la carpeta de Drive del cliente si este tiene **NIF Y `visionwin_empresa_codigo`** (nodo "¿Cliente listo?"); si falta alguno, la factura se queda en el Storage y se reintenta cada 12 h. **No** la usa la sincronización de dashboards (esa vincula por CIF contra `clientes.id`). Nota: una NOTA antigua de `schema.sql` decía que esta columna "ya no la usa nada" — se refería solo al sincronizador de dashboards; ya está corregida.
- RLS: un cliente autenticado solo puede hacer `select` de su propia fila (`auth.uid() = auth_user_id`); sin políticas de insert/update/delete. **Admin** (2026-08-30): quien tenga fila en `portal_admins` (uuid de `auth.users`, alta a mano) tiene además `select` sobre **todas** las filas de `clientes`, `facturas_subidas` y las `dashboard_*` — políticas aditivas de solo lectura. `Portal.astro` lo detecta y muestra un selector de clientes en vez de la ficha propia. La política equivalente sobre `storage.objects` (bucket `facturas`) se crea a mano en el dashboard, como el resto de las de Storage.
- **Pendiente** (sin definir todavía, según el propio `schema.sql`): la tabla con los datos financieros reales que verá cada cliente. Cuando exista, seguirá el mismo patrón — `cliente_id references clientes(id)` + política RLS vía la subconsulta a `clientes`. Esbozo pensado (no implementado): `dashboard_periodos` (una fila por cliente y mes — ingresos, gastos, tesorería, iva_repercutido/soportado/resultado, base+retenido de 111/115, pago fraccionado 130 estimado) y `dashboard_pendientes` (cobros/pagos pendientes; se borra y reinserta entero por cliente en cada sincronización, sin ids estables de origen). Alimentadas por una sincronización semanal contra Visionwin (`\\SOB-MARIO\visionwin\contabilidad`, formato .DBF), ampliando el prototipo Java ya existente (lee DIACAB/DIALIN y ya calcula IVA/111/115/130) para que además haga `push` a Supabase con la service role key. Nota técnica pendiente de verificar con datos reales antes de sincronizar nada: ese prototipo decodifica los .DBF como ISO-8859-1 a pelo, sin leer el byte de codepage de FoxPro — probablemente mal para tildes/ñ si Visionwin usa CP850/CP1252.

### `facturas_subidas` — registro de facturas (la tabla clave para n8n)

- El cliente sube su PDF al bucket `facturas` desde el portal, y eso crea también una fila aquí con los metadatos (`nombre_archivo`, `storage_path`, `fecha_subida`).
- **Por qué existe aparte del Storage**: la automatización baja cada factura a Drive compartido y, pasado un margen, borra el archivo del Storage para ahorrar espacio. Si el portal listara directo desde `storage.objects`, el cliente perdería el registro de lo que subió en cuanto se borrara el archivo. Este registro vive aquí, aparte, para siempre.
- **`fecha_contabilizado` y `storage_path` son dos pasos independientes.** "Contabilizada" = ya está en Drive. `storage_path = null` = ya se borró del Storage. No asumas que van juntos. Hoy `fecha_contabilizado` se marca **a mano** en el Table Editor de Supabase; es exactamente lo que la automatización debería hacer sola.
- El portal ya contempla el caso "registro sin archivo": si `storage_path` es `null` no muestra botón de descarga, y si la URL firmada falla avisa al cliente en vez de romper.
- RLS: el cliente puede ver sus propias filas y crear una fila propia, siempre con `fecha_contabilizado is null` (no puede marcarse a sí mismo como contabilizada). **Sin políticas de update ni delete** — esas columnas las toca solo la service role.

### Storage

| Bucket | Acceso | Ruta | Notas |
|---|---|---|---|
| `facturas` | Privado, RLS | `${NIF}/${NIF}-DDMM-HHMM-nombre.pdf` | Carpeta y prefijo usan el NIF (no el uid de sesión) para que sean identificables a mano en Drive. El timestamp evita colisiones de nombre. Descarga vía URL firmada de 60 s. |
| `docs-publicos` | Público | — | PDFs genéricos (guía del área de clientes, presentaciones autónomo/SL, pasos de apoderamiento AEAT y Seg. Social, RGPD). Enlazados directamente desde `Portal.astro`. |

Las políticas de `storage.objects` para `facturas` están creadas **a mano en el dashboard** (Storage → Policies), no vía SQL: solo se documentan como comentario en `schema.sql`. Si el bucket se recrea desde cero, hay que rehacerlas. Comprueban la carpeta vía subconsulta a `clientes` (`(storage.foldername(name))[1] in (select id from clientes where auth_user_id = auth.uid())`), no comparando contra `auth.uid()` directamente.

## Endpoints (`src/pages/api/`)

| Endpoint | Tabla | Rate limit | Notas |
|---|---|---|---|
| `POST /api/presupuesto` | `presupuestos` | 20 / 10 min / IP | Calcula el precio y genera el código vía `next_quote_number`. |
| `PATCH /api/presupuesto` | `presupuestos` | 20 / 10 min / IP | Añade el email a un presupuesto ya generado, si el visitante cambia de opinión. 404 si el `quote_code` no existe. |
| `POST /api/portal-login` | `clientes` (solo lectura) | 10 / 10 min / IP | Enlace mágico. Respuesta genérica siempre. |
| `POST /api/alta-autonomo` | `alta_nuevos_autonomos` | Sí | Normaliza NIF a mayúsculas e IBAN sin espacios. |
| `POST /api/traspaso` | `traspasos_nuevos` | Sí | Ídem; ramifica el insert según `tipo`. |

Los cinco usan `getSupabaseAdmin()` y **degradan con gracia**: si Supabase no está configurado responden en éxito sin persistir (`{ persisted: false }`), para no romper la experiencia.

**Validación deliberadamente laxa** en todos: forma y longitud (`algo@algo.algo`, NIF de 9 caracteres, IBAN alfanumérico), no corrección real — Edurne revisa los datos a mano antes de tramitar. Los valores cerrados (`tipo_local`, `retencion_irpf`, `regimen`…) se validan en el endpoint y **no** llevan `CHECK` en SQL.

El cálculo del precio está **duplicado a propósito** entre `Simulador.astro` (front) y `api/presupuesto.ts` (back), para que coincidan. Si cambian las tarifas, hay que tocar los dos.

## Variables de entorno

| Variable | Server-only | Uso |
|---|---|---|
| `SUPABASE_URL` | Sí | Cliente admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí — **secreto, nunca al navegador** | Cliente admin |
| `PUBLIC_SUPABASE_URL` | No | Cliente browser (portal) |
| `PUBLIC_SUPABASE_ANON_KEY` | No — segura de exponer | Cliente browser (portal) |

No hay `.env.example`; estas cuatro son las que hacen falta para tener Supabase funcionando en local/Vercel.

## Notas para quien construya workflows de n8n

- Necesitas credenciales equivalentes a la service role key. RLS bloqueará una anon key en prácticamente todo.
- **Las columnas `*_at` son la cola de trabajo.** `fecha_contabilizado`, `pago_confirmado_at`, `cita_aeat_solicitada_at`, `apoderamiento_aeat_at`, `apoderamiento_seg_soc_at`, `revocacion_apoderamiento_anterior_at`, `presupuesto_enviado_at`, `recordatorio_enviado_at`, `respondido_at`: ningún formulario las rellena, hoy se marcan a mano, y son exactamente los pasos que hay que ir automatizando. Quedan `NULL` hasta completarse, y eso no es un error.
- Casos de uso ya definidos con tabla lista: (1) facturas Storage → Drive → `fecha_contabilizado` → borrado del Storage tras el margen de días; (2) envío y seguimiento de presupuestos por email; (3) onboarding de cliente nuevo tras firmar el presupuesto. No hace falta diseñar esquema para ninguno.
- Vincula siempre **por NIF** (`clientes.id`), que es el identificador común a presupuestos, formularios y facturas.
- Los rate limiters de los endpoints públicos son en memoria y por instancia de Vercel — si un workflow llama a estos endpoints HTTP en vez de ir directo a Supabase, ese límite no es fiable bajo carga ni es una autenticación real. Prefiere ir directo a Supabase.
