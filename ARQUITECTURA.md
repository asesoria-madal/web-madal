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

**Si un workflow de n8n necesita leer/escribir en Supabase, usa el equivalente de la service role key**, nunca la anon key: RLS la bloqueará en casi todo lo que necesitarás hacer (marcar `fecha_contabilizado`, dar de alta clientes…).

## La clave que lo une todo: el NIF

**`clientes.id` es el NIF/NIE del cliente en texto, en mayúsculas** — no un uuid (migración del 2026-08-25). El motivo es precisamente n8n: con `id = NIF`, el workflow de onboarding y el que recibe las respuestas de los formularios pueden buscar/crear la fila directamente por NIF, sin lookup intermedio. La FK de `facturas_subidas` es `on update cascade`, así que corregir un NIF mal tecleado es un simple `update clientes set id = …`.

**Pero las políticas RLS no usan `id`, usan `auth_user_id`** (columna aparte, uuid → `auth.users`). Se rellena sola vía el trigger `on_auth_user_created` → `vincular_cliente_nuevo()`, **solo en el primer login** de ese email. Consecuencia práctica documentada en `schema.sql`: si recreas una fila de `clientes` para un email que *ya* tenía cuenta de Auth, `auth_user_id` se queda en `null` para siempre y todo lo que dependa de RLS falla en silencio. Hay un backfill para eso al final del bloque de migración.

## Tablas

`schema.sql` se ejecuta **a mano en el SQL editor de Supabase**. No hay migraciones automáticas: es un archivo acumulativo con bloques marcados "ejecutar UNA VEZ".

### `quote_counters` + `presupuestos` — RETIRADO (2026-10-23)

El simulador de precio (`/simulador`, `/solicitud`, `api/presupuesto`) se eliminó por decisión de Hugo: el alta se hace siempre a mano desde el portal tras la primera llamada. **Ningún código usa ya estas tablas.** Siguen en Supabase hasta que alguien ejecute a mano `supabase/retirar-simulador.sql` (borra `presupuestos`, `quote_counters` y `next_quote_number`; es **irreversible** y contiene emails de leads: exportar antes si interesa). Antes de ejecutarlo, comprobar que los workflows de n8n `nuevo_presupuesto`, `recordatorio-presupuesto` y `detectar_respuesta_presu` están desactivados (ya archivados en `n8n-workflows/workflows/_retirados/`). Las definiciones se dejan en `schema.sql` solo para poder recrear la base desde cero.

### `alta_nuevos_autonomos` — formulario de alta

Datos que Edurne necesita para tramitar el alta en Hacienda/Seguridad Social tras la llamada de venta. Página suelta (`/formulario-alta`), sin enlazar desde el menú: el enlace se manda al cliente tras la llamada de venta, con `?nif=…`, y ese valor llega en `nif_nie`. El vínculo con el cliente se hace **por NIF** (`clientes.id`); la columna `quote_code` se eliminó.

`privacy_accepted_at` es obligatorio aquí (a diferencia de otros formularios opcionales): el formulario recoge NIF, IBAN y domicilio sí o sí.

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

  Un trigger `AFTER INSERT` sobre `clientes` (nombre `cliente-nuevo`, creado a mano en Supabase > Database > Triggers; **no está en `schema.sql`**) hace un POST al webhook de producción `https://n8n.asesoriamadal.es/webhook/cliente-nuevo` con una cabecera secreta. Esa cabecera debe coincidir en nombre y valor con la credencial Header Auth del nodo Webhook de n8n; si no, n8n responde 403 "Authorization data is wrong!" y no deja ninguna ejecución. Diagnóstico: `select status_code, left(content,100) from net._http_response order by created desc;`.
- **Columnas añadidas el 2026-10-23** (todas con `add column if not exists` en `schema.sql`): `plan` (`debut|esencial|crece|total|sl`; el precio NO se guarda, vive en `ui.ts`), `telefono`, `idioma` (`es|ca|en`, `not null default 'es'`; decide el idioma de los correos automáticos de n8n), `hubspot_contact_id` (índice único) y `hubspot_synced_at` (los escribe solo el workflow `Sync HubSpot`; no tocar a mano). Columnas de facturación BeeL: `beel_contratado`, `beel_account_id`, `beel_company_id`, `beel_estado`, `beel_activado_prod_at` (ver `DOCS/BEEL.md`).
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
| `POST /api/portal-login` | `clientes` (solo lectura) | 10 / 10 min / IP | Enlace mágico. Respuesta genérica siempre. |
| `POST /api/alta-cliente` | `clientes` | — | Solo admin (`portal_admins`, validado con el token de sesión). Inserta la ficha con idioma, plan, teléfono, `alta_hecha`, `reporting` y `beel_contratado`; no envía nada, lo hace n8n a partir del INSERT. |
| `POST /api/alta-autonomo` | `alta_nuevos_autonomos` | Sí | Normaliza NIF a mayúsculas e IBAN sin espacios. |
| `POST /api/traspaso` | `traspasos_nuevos` | Sí | Ídem; ramifica el insert según `tipo`. |

Desde 2026-10-21 hay tres endpoints más, todos de facturación Verifactu vía BeeL (ver § "Facturación Verifactu (BeeL)" al final): `POST /api/emitir-factura`, `GET /api/factura-pdf` y `POST /api/beel-webhook`. **Estos tres no degradan en silencio**: sin `BEEL_API_KEY` responden 503, porque fingir que se ha emitido una factura sería peor que fallar. Los dos primeros exigen la sesión del cliente (`Authorization: Bearer <access_token>`); el tercero exige la firma de BeeL. **Desde 2026-10-23 todos los endpoints de facturación (`emitir-factura`, `rectificar-factura`, `facturacion/*`, `factura-pdf`) exigen además `clientes.beel_contratado = true`** (403 si no): sin ese filtro, un cliente sin cuenta caía en la empresa por defecto de sandbox. El panel "Facturas" del portal tampoco se muestra a quien no lo tenga.

Los endpoints de formularios y login (`portal-login`, `alta-autonomo`, `traspaso`) usan `getSupabaseAdmin()` y **degradan con gracia**: si Supabase no está configurado responden en éxito sin persistir (`{ persisted: false }`), para no romper la experiencia.

**Validación deliberadamente laxa** en todos: forma y longitud (`algo@algo.algo`, NIF de 9 caracteres, IBAN alfanumérico), no corrección real — Edurne revisa los datos a mano antes de tramitar. Los valores cerrados (`tipo_local`, `retencion_irpf`, `regimen`…) se validan en el endpoint y **no** llevan `CHECK` en SQL.

Los precios viven solo en `src/i18n/ui.ts` (sección `precios`): ya no hay simulador ni cálculo duplicado (retirado 2026-10-23).

### Alta de clientes: dos caminos, ambos acaban en `clientes` + webhook `cliente-nuevo`

Desde 2026-10-23 (el camino por presupuesto se retiró con el simulador) hay dos formas de que exista una fila en `clientes`; las dos disparan, por el trigger `AFTER INSERT`, el workflow n8n **Onboarding**:

1. **Alta manual desde el portal de admin** (`POST /api/alta-cliente`, exige sesión de `portal_admins`). Es el camino normal.
2. **A mano en el Table Editor.**

Qué hace **Onboarding** (todo en el idioma `clientes.idioma`; los formularios y la guía PDF solo existen en castellano y el correo en ca/en lo avisa):
- Correo con el formulario (alta de autónomo, traspaso de autónomo o traspaso de SL según `tipo_persona` / `alta_hecha`); si la ficha está incompleta no se envía y se crea la tarea "Revisar alta incompleta".
- Correo con el acceso al portal (magic link + guía PDF), solo si hay email **y** NIF real.
- HubSpot, solo si hay email: contacto (upsert por email, con `firstname`/`lastname` separados), deal en el pipeline "Onboarding" (etapa "Formulario pendiente") y tarea asociada a contacto y deal.
- Carpeta de Drive `<NIF>-<nombre>` con las subcarpetas 0-documentos, 1-contabilidad, 2-escrituras, 3-impuestos, 4-laboral, 5-mercantil y 9-otros bajo "Clientes" (solo con NIF real). El flujo de facturas localiza la carpeta por NIF (`name contains <NIF>`).

Cuando el cliente envía el formulario (`alta_nuevos_autonomos` / `traspasos_nuevos`, cada tabla con su trigger y su webhook), `Responden formulario`: comprueba NIF y email contra `clientes`; si coinciden, manda confirmación al cliente, avisa a contacto@, mueve el deal a "Apoderamiento pendiente" (solo si sigue en "Formulario pendiente") y sube el txt de respuestas a `0-documentos` de la carpeta existente (la crea solo si no existe). Si el email no coincide o no hay cliente, solo avisa al equipo. Legado: ya no se crean fichas `PENDIENTE-…`; el workflow aún sabría renombrar una si existiera.

**HubSpot** (`n8n-workflows/hubspot/README.md`): el workflow `Sync HubSpot` copia `clientes` a las propiedades del contacto (grupo "Cliente Madal"). Supabase manda en todo salvo `plan` y `telefono`, que se pueden editar en ambos lados (gana HubSpot solo si el contacto cambió después de `hubspot_synced_at`). Los pasos de las etapas del deal posteriores a "Apoderamiento pendiente" se mueven a mano.

## Variables de entorno

| Variable | Server-only | Uso |
|---|---|---|
| `SUPABASE_URL` | Sí | Cliente admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí — **secreto, nunca al navegador** | Cliente admin |
| `PUBLIC_SUPABASE_URL` | No | Cliente browser (portal) |
| `PUBLIC_SUPABASE_ANON_KEY` | No — segura de exponer | Cliente browser (portal) |

Estas cuatro son las que hacen falta para tener Supabase funcionando en local/Vercel. Las de facturación (todas solo servidor, ninguna con prefijo `PUBLIC_`):

| Variable | Uso |
|---|---|
| `BEEL_API_KEY` | `beel_sk_test_…` (sandbox, sin efecto fiscal) o `beel_sk_live_…` (real). **Secreto.** |
| `BEEL_DEFAULT_COMPANY_ID` | Company de sandbox que usan todos los clientes sin `clientes.beel_company_id`. **Se ignora con clave live** (ver `src/lib/beel.ts`). |
| `BEEL_WEBHOOK_SECRET` | Secreto de la suscripción de webhooks; BeeL lo muestra una sola vez al crearla. |
| `N8N_ALERT_WEBHOOK_URL`, `N8N_ALERT_TOKEN` | Opcionales. Webhook de n8n y token de cabecera `X-Alert-Token` para avisar de rechazos de la AEAT. |

(`.env.example` está sin actualizar con estas cuatro: un hook del entorno bloqueó editarlo en la sesión que las añadió. Añadirlas a mano.)

## Notas para quien construya workflows de n8n

- Necesitas credenciales equivalentes a la service role key. RLS bloqueará una anon key en prácticamente todo.
- **Las columnas `*_at` son la cola de trabajo.** `fecha_contabilizado`, `pago_confirmado_at`, `cita_aeat_solicitada_at`, `apoderamiento_aeat_at`, `apoderamiento_seg_soc_at`, `revocacion_apoderamiento_anterior_at`, `presupuesto_enviado_at`, `recordatorio_enviado_at`, `respondido_at`: ningún formulario las rellena, hoy se marcan a mano, y son exactamente los pasos que hay que ir automatizando. Quedan `NULL` hasta completarse, y eso no es un error.
- Casos de uso ya definidos con tabla lista: (1) facturas Storage → Drive → `fecha_contabilizado` → borrado del Storage tras el margen de días; (2) envío y seguimiento de presupuestos por email; (3) onboarding de cliente nuevo tras firmar el presupuesto. No hace falta diseñar esquema para ninguno.
- Vincula siempre **por NIF** (`clientes.id`), que es el identificador común a presupuestos, formularios y facturas.
- Los rate limiters de los endpoints públicos son en memoria y por instancia de Vercel — si un workflow llama a estos endpoints HTTP en vez de ir directo a Supabase, ese límite no es fiable bajo carga ni es una autenticación real. Prefiere ir directo a Supabase.

## Facturación Verifactu (BeeL)

Añadida 2026-10-21. El cliente emite facturas desde el portal (panel "Emitir facturas"); **BeeL es quien numera, encadena el registro Verifactu, lo envía a la AEAT y genera el PDF**. Nosotros solo recogemos los datos, llamamos a su API y guardamos una copia.

**Por qué BeeL y no un sistema propio**: construir el motor fiscal nos haría productores de un sistema informático de facturación (declaración responsable, huella encadenada, firma, envío a la AEAT, QR) con responsabilidad propia. Se delega eso y se construye solo la interfaz. Por la misma razón, **el PDF y el email de la factura son siempre los de BeeL**: según su documentación de cumplimiento, un software que renderiza su propio documento puede considerarse componente del sistema y necesitar su propia declaración responsable.

**Flujo**
1. `Portal.astro` → `POST /api/emitir-factura` con el `access_token` de la sesión y una `idempotencyKey` (uuid, se mantiene mientras el contenido del formulario no cambie, para que un reintento no emita dos facturas).
2. El endpoint valida el token con Supabase Auth, saca el cliente de `clientes.auth_user_id` (nunca de un NIF enviado en el cuerpo), resuelve la company de BeeL y llama a `POST /v1/companies/{id}/invoices` con `issue_directly: true`.
3. Guarda la copia en `facturas_emitidas` (upsert por `beel_invoice_id`). Si BeeL emitió pero Supabase falla, **no** devuelve error (la factura ya existe en la AEAT): lo deja en logs.
4. La AEAT contesta en segundos/minutos → BeeL llama a `POST /api/beel-webhook` (firma HMAC-SHA256 en `BeeL-Signature`, ventana de 5 min) → se actualiza `verifactu_estado`. Si es `REJECTED`, se avisa al webhook de n8n `n8n-workflows/workflows/alerta-factura-rechazada.json`.
5. "Ver PDF" → `GET /api/factura-pdf?id=` (solo facturas del propio cliente): pide a BeeL una URL firmada de 5 min y reenvía el PDF.

**Tablas**: `facturas_emitidas` (RLS: el cliente solo lee las suyas; escribe solo la service role) y `clientes.beel_company_id`. SQL al final de `supabase/schema.sql`, bloque "ejecutar UNA VEZ" (con GRANT explícito).

**Una company de BeeL = un NIF.** En esta fase de pruebas **todos los clientes comparten la company de sandbox** (`BEEL_DEFAULT_COMPANY_ID`), así que las facturas salen con el emisor de esa cuenta de prueba, no con el del cliente. Para producción hace falta una company por cliente (`POST /v1/accounts/{id}/companies`, con el NIF real del cliente, que debe existir en el censo de la AEAT incluso en sandbox) y rellenar `clientes.beel_company_id`. BeeL responde `CONTACT_SALES_REQUIRED` al crear un segundo NIF en el plan API sin precio acordado: **hay que cerrar el precio multi-NIF con BeeL antes de pasar a producción**.

**Límites conocidos**
- IVA solo 21/10/4 % y retención 0/7/15 %. El 0 % exige causa de exención y lo emite el equipo.
- Solo facturas completas (`STANDARD`). No hay rectificativas desde el portal: una factura emitida no se edita ni se borra, se corrige con una rectificativa que hoy se haría desde BeeL.
- El esquema exacto del `data` del webhook `verifactu.status.updated` no estaba publicado al escribir el receptor: asume `invoice_id` y `new_status` (con `id`/`status` de reserva) y registra en logs si no los encuentra. **Verificar con el primer evento real** (botón "Send test event" de BeeL no sirve: los de prueba se ignoran a propósito).
