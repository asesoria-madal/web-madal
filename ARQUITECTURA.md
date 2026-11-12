# Arquitectura (Supabase / Vercel)

Referencia técnica para quien construya automatizaciones (n8n) u otras integraciones sobre esta web, sin tener que releer el código fuente. Regenerado el **2026-08-26** a partir del código real del repo, y revisado el **2026-08-30** (sigue cuadrando con `supabase/schema.sql` tras los cambios de administrador de portal y de `cegid_empresa_codigo`) — si ha pasado tiempo y algo no cuadra con lo que veas en `src/`, `supabase/schema.sql` o el dashboard de Supabase/Vercel, fíate del código y actualiza este documento.

Para tareas concretas hay guías aparte: **`DOCS/CONTENIDO.md`** (editar blog y FAQs) y **`DOCS/OPERACIONES.md`** (pasos manuales, config de paneles, deploy y rollback). El índice del repo es **`README.md`**.

**`supabase/schema.sql` manda sobre este documento.** Sus comentarios explican el *porqué* de cada decisión de diseño; aquí solo está el resumen operativo.

## Stack y despliegue

- **Framework**: Astro 7 (`output: 'server'`), adapter `@astrojs/vercel`. Desplegado en **Vercel**, dominio `https://asesoriamadal.es`. Node ≥ 22.12.
- **Todo se prerenderiza**: pese al `output: 'server'`, cada página lleva `export const prerender = true`. Solo los cuatro endpoints de `src/pages/api/` corren por petición (`prerender = false`).
- **i18n**: `es` (por defecto, sin prefijo), `ca`, `en`. Rutas duplicadas a mano (sin middleware), misma lógica de backend en los tres. Las páginas legales y el portal existen **solo en castellano**. Los tres formularios de cliente existen en castellano e **inglés** (`/en/formulario-…`, desde el 2026-11-02; textos en `src/i18n/formularios.ts`, mismo envío al servidor en los dos idiomas); en catalán no.
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

### `altas_trabajadores` — alta de un trabajador de un cliente (desde 2026-11-02)

Páginas sueltas `/formulario-alta-trabajador`, `/ca/formulario-alta-trabajador` y `/en/formulario-alta-trabajador` (`noindex`, sin enlazar desde el menú; textos en `src/i18n/formularioTrabajador.ts`, único formulario de cliente que existe también en catalán). La rellena **nuestro cliente** (la empresa o el autónomo que contrata) con los datos que él mismo le pide a su trabajador: es el equivalente a pedírselos por correo, no un formulario para el trabajador. El enlace se manda a mano con `?nif=<NIF del cliente>&email=<su email>` (el NIF queda de solo lectura). Recoge empresa (CCC, centro de trabajo, convenio), trabajador (identificación, NUSS, permiso si es extracomunitario, IBAN, estudios, discapacidad), los datos del modelo 145, el contrato y la retribución. Lo que es decisión técnica de la gestoría (grupo de cotización, CNO, convenio, bonificaciones) se pregunta como opcional.

- `empresa_nif` **no** es FK a `clientes.id` a propósito: un insert rechazado perdería los datos; se cruza a mano.
- Datos sensibles (discapacidad = dato de salud; situación familiar): solo `service_role` tiene GRANT, ni `anon` ni `authenticated`.
- No sube archivos: DNI/NIE, permiso de trabajo y certificado de discapacidad se piden por correo a contacto@ y van a Drive.
- Aviso al equipo: el workflow n8n `Alta de trabajador` mira cada 5 minutos las filas con `notificado_at` null, manda el correo a contacto@ y las marca (sin trigger ni webhook). `tramitado_at` se marca a mano en el Table Editor al terminar el alta.

### `leads` — solicitudes de la web (desde 2026-11-06)

Formulario de `/contacto` y de cada artículo (`tipo = 'contacto'`) y de `/constituir-sl` (`tipo = 'constituir_sl'`), mediante `POST /api/lead`. Es aparte de `clientes` porque quien escribe aún no es cliente ni tiene NIF. Sin esta tabla ejecutada en Supabase, el endpoint devuelve error. El endpoint rechaza constituir en Canarias, País Vasco y Navarra. Formulario de SL corto a propósito (decisión de Edurne, para que lo rellenen): nombre, correo, nombre deseado, comunidad, actividad y cuándo empezar. Solo `service_role`.

### `seguimiento_negocios` — dedup de avisos de seguimiento comercial (desde 2026-11-05)

No es una ficha de cliente: es solo el registro de qué avisos ya se mandaron para cada **negocio (deal) de HubSpot** que todavía no es cliente, por `hubspot_deal_id` (clave primaria, texto — el id numérico de HubSpot como string). Existe porque ese lead no tiene fila en `clientes` todavía, así que el dedup no puede ir ahí como en el resto de avisos.

- La escribe y la lee solo el workflow n8n **"Seguimiento de negocios"**: lee los negocios abiertos del pipeline "Venta" de HubSpot (API, solo lectura — nunca escribe propiedades en HubSpot, es un CRM compartido con Hugo) y cruza contra esta tabla para saber en qué aviso está cada uno.
- `aviso_1_at` / `aviso_2_at` / `aviso_3_at` (`timestamptz`, nullable): se rellenan, en ese orden, DESPUÉS de mandar el correo correspondiente a contacto@ (no antes, para reintentar si falla ese envío) — mismo patrón que `debut_aviso_*_enviado_at`.
- No tiene RLS más allá de `service_role` (ni `anon` ni `authenticated` tienen grant): no la usa el portal ni ningún endpoint, es de uso interno de n8n.

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
- **Columnas añadidas el 2026-10-23** (todas con `add column if not exists` en `schema.sql`): `plan` (`debut|esencial|crece|total|sl`; el precio NO se guarda, vive en `ui.ts`), `telefono`, `idioma` (`es|ca|en`, `not null default 'es'`; decide el idioma de los correos automáticos de n8n), `hubspot_contact_id` (índice único) y `hubspot_synced_at` (los escribe solo el workflow `Sync HubSpot`; no tocar a mano).
- `modelos` (`text[]`, `not null default '{}'`, añadido 2026-08-26) — qué modelos fiscales presenta el cliente (130, 131, 111, 115, 303, 349, 202, 200, 347, 390, 190, 180; ver el comentario junto a la columna en `schema.sql` para el detalle de cada uno). Primer campo multivalor del esquema — se rellena a mano en el Table Editor, sin endpoint ni CHECK, igual que `alta_hecha`. Lo usa `src/lib/modelosFiscales.ts` para calcular, en `Portal.astro`, el stat "días hasta tu próxima presentación de impuestos" — visible para **todos** los clientes (no depende de `reporting`: es información básica de gestoría, no una funcionalidad de pago).
- `cegid_empresa_codigo` (`text`, nullable; renombrada en producción el 2026-11-04) — código de la empresa del cliente en Cegid (el ERP de contabilidad). Lo escribe el workflow n8n **"Acceso Cegid"** cuando el equipo rellena «Código Cegid» en el deal de HubSpot; también se puede poner a mano en el Table Editor. Ningún endpoint lo escribe. Es el flag de "cliente ya configurado en Cegid": el workflow n8n **"Descarga de facturas"** solo baja una factura del Storage a la carpeta de Drive del cliente si este tiene **NIF Y `cegid_empresa_codigo`** (nodo "¿Cliente listo?"); si falta alguno, la factura se queda en el Storage y se reintenta cada 12 h. **No** la usa la sincronización de dashboards (esa vincula por CIF contra `clientes.id`). Nota: una NOTA antigua de `schema.sql` decía que esta columna "ya no la usa nada" — se refería solo al sincronizador de dashboards; ya está corregida.
- `fecha_alta_actividad` (`date`, nullable, añadida 2026-11-05) — fecha real de alta en el RETA/Hacienda (autónomo) o de constitución (SL), **distinta** de `created_at` (cuándo se creó la ficha, es decir cuándo empezó a ser cliente nuestro). Si está vacía, el workflow n8n **"Sync Empresas HubSpot"** la rellena (desde el 2026-11-05) con `traspasos_nuevos.fecha_alta_actividad` o `alta_nuevos_autonomos.fecha_inicio_actividad`, y nunca pisa un valor ya puesto: si la fecha real es otra, corrígela a mano.
- `debut_aviso_6m_enviado_at` / `debut_aviso_11m_enviado_at` (`timestamptz`, nullable, añadidas 2026-11-05) — las rellenan los workflows n8n **"Debut: revisar facturación 6 meses"** y **"Debut: aviso cambio a Esencial 11 meses"** después de mandar su correo a contacto@ (no antes, para reintentar si falla). Ningún endpoint los toca. El plazo se mide desde `coalesce(fecha_alta_actividad, created_at)` (la fecha real si ya está rellenada, si no la de alta como cliente como aproximación), solo para `plan = 'debut'` y `tipo_persona = 'autonomo'`. Si un cliente vuelve al plan Debut, hay que vaciarlos a mano para que se vuelva a avisar en su próximo ciclo.
- `opinion_aviso_meses` (`integer`, nullable, añadida 2026-11-05) — guarda el último hito (6, 12, 24, 36... meses desde `created_at`) en el que el workflow n8n **"Opinión del cliente"** mandó su correo pidiendo opinión del servicio. Sin tabla ni formulario propio: el cliente contesta directamente al correo. Se actualiza DESPUÉS de enviar, igual que los avisos de Debut.
- RLS: un cliente autenticado solo puede hacer `select` de su propia fila (`auth.uid() = auth_user_id`); sin políticas de insert/update/delete. **Admin** (2026-08-30): quien tenga fila en `portal_admins` (uuid de `auth.users`, alta a mano) tiene además `select` sobre **todas** las filas de `clientes`, `facturas_subidas` y las `dashboard_*` — políticas aditivas de solo lectura. `Portal.astro` lo detecta y muestra un selector de clientes en vez de la ficha propia. La política equivalente sobre `storage.objects` (bucket `facturas`) se crea a mano en el dashboard, como el resto de las de Storage.
- **Pendiente** (sin definir todavía, según el propio `schema.sql`): la tabla con los datos financieros reales que verá cada cliente. Cuando exista, seguirá el mismo patrón — `cliente_id references clientes(id)` + política RLS vía la subconsulta a `clientes`. Esbozo pensado (no implementado): `dashboard_periodos` (una fila por cliente y mes — ingresos, gastos, tesorería, iva_repercutido/soportado/resultado, base+retenido de 111/115, pago fraccionado 130 estimado) y `dashboard_pendientes` (cobros/pagos pendientes; se borra y reinserta entero por cliente en cada sincronización, sin ids estables de origen). Alimentadas por una sincronización semanal contra el programa de contabilidad anterior (carpeta compartida en SOB-MARIO, formato .DBF; retirada el 2026-11-04: los clientes ven esa información en Cegid y no se va a rehacer), ampliando el prototipo Java ya existente (lee DIACAB/DIALIN y ya calcula IVA/111/115/130) para que además haga `push` a Supabase con la service role key. Nota técnica pendiente de verificar con datos reales antes de sincronizar nada: ese prototipo decodifica los .DBF como ISO-8859-1 a pelo, sin leer el byte de codepage de FoxPro — probablemente mal para tildes/ñ si ese programa usa CP850/CP1252.

### `facturas_subidas` — registro de facturas (la tabla clave para n8n)

- El cliente sube su PDF al bucket `facturas` desde el portal, y eso crea también una fila aquí con los metadatos (`nombre_archivo`, `storage_path`, `fecha_subida`).
- **Por qué existe aparte del Storage**: la automatización baja cada factura a Drive compartido y, pasado un margen, borra el archivo del Storage para ahorrar espacio. Si el portal listara directo desde `storage.objects`, el cliente perdería el registro de lo que subió en cuanto se borrara el archivo. Este registro vive aquí, aparte, para siempre.
- **`fecha_contabilizado` y `storage_path` son dos pasos independientes.** "Contabilizada" = ya está en Drive. `storage_path = null` = ya se borró del Storage. No asumas que van juntos. Hoy `fecha_contabilizado` se marca **a mano** en el Table Editor de Supabase; es exactamente lo que la automatización debería hacer sola.
- El portal ya contempla el caso "registro sin archivo": si `storage_path` es `null` no muestra botón de descarga, y si la URL firmada falla avisa al cliente en vez de romper.
- RLS: el cliente puede ver sus propias filas y crear una fila propia, siempre con `fecha_contabilizado is null` (no puede marcarse a sí mismo como contabilizada). **Sin políticas de update ni delete** — esas columnas las toca solo la service role.
- **Carpetas (2026-11-12)**: no solo hay facturas. El cliente sube desde la pestaña Documentación eligiendo `carpeta` (facturas emitidas/recibidas/simplificadas, tickets, extractos de banco —solo SL— o de tarjeta de crédito, y carpetas de documentación: escrituras, contratos, préstamos…). En extractos guarda también `cuenta_digitos`, `periodo_desde` y `periodo_hasta`. `carpeta` null = subida anterior, tratada como factura. n8n (`Descarga de facturas`) decide con ella la carpeta de Drive y el nombre; solo facturas y tickets llevan `drive_carpeta_pendientes_id` y se marcan como contabilizados. Valores y rutas en `schema.sql`.

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
| `POST /api/alta-cliente` | `clientes` | — | Solo admin (`portal_admins`, validado con el token de sesión). Inserta la ficha con idioma, plan, teléfono, `alta_hecha`, `reporting` y `enviar_formulario`; no envía nada, lo hace n8n a partir del INSERT. |
| `POST /api/alta-autonomo` | `alta_nuevos_autonomos` | Sí | Normaliza NIF a mayúsculas e IBAN sin espacios. |
| `POST /api/traspaso` | `traspasos_nuevos` | Sí | Ídem; ramifica el insert según `tipo`. |
| `POST /api/alta-trabajador` | `altas_trabajadores` | Sí | Ídem; exige causa concreta (≥ 30 caracteres) en temporales, tutor y plan en formativos, horas y distribución en parcial, y NUSS salvo «no tiene». |

Los endpoints de formularios y login (`portal-login`, `alta-autonomo`, `traspaso`, `alta-trabajador`) usan `getSupabaseAdmin()` y **degradan con gracia**: si Supabase no está configurado responden en éxito sin persistir (`{ persisted: false }`), para no romper la experiencia.

**Validación deliberadamente laxa** en todos: forma y longitud (`algo@algo.algo`, NIF de 9 caracteres, IBAN alfanumérico), no corrección real — Edurne revisa los datos a mano antes de tramitar. Los valores cerrados (`tipo_local`, `retencion_irpf`, `regimen`…) se validan en el endpoint y **no** llevan `CHECK` en SQL.

Los precios viven solo en `src/i18n/ui.ts` (sección `precios`): ya no hay simulador ni cálculo duplicado (retirado 2026-10-23).

### Alta de clientes: tres caminos, todos acaban en `clientes` + webhook `cliente-nuevo`

Desde 2026-10-23 (el camino por presupuesto se retiró con el simulador) hay tres formas de que exista una fila en `clientes`; las tres disparan, por el trigger `AFTER INSERT`, el workflow n8n **Onboarding**:

1. **Alta manual desde el portal de admin** (`POST /api/alta-cliente`, exige sesión de `portal_admins`). Es el camino normal.
2. **A mano en el Table Editor.**
3. **Automática, si el formulario de alta o traspaso llega antes que el alta** (desde 2026-11-04): la crea `Responden formulario` con los datos del formulario y `enviar_formulario = false`. El idioma sale de la página del formulario (columna `idioma` de `alta_nuevos_autonomos` y `traspasos_nuevos`: `es` o `en`). Plan y reporting se completan a mano: el equipo recibe el aviso «Ficha creada desde el formulario, revísala». Como en este camino no sale el correo de bienvenida de Onboarding, el cliente no recibe por ahí los datos de la transferencia de la primera mensualidad.

Qué hace **Onboarding** (todo en el idioma `clientes.idioma`; a un cliente en inglés se le enlaza el formulario en inglés; en catalán no hay formulario y el correo avisa de que va en castellano; la guía PDF solo existe en castellano):
- Correo con el formulario (alta de autónomo, traspaso de autónomo o traspaso de SL según `tipo_persona` / `alta_hecha`); si la ficha está incompleta no se envía y se crea la tarea "Revisar alta incompleta". Tampoco se envía si `clientes.enviar_formulario = false` (casilla del alta manual, por defecto marcada; HubSpot y Drive no cambian). Al no mandarse el formulario, el deal se queda en "Formulario pendiente" y hay que moverlo a mano.
- **No** manda el correo de acceso al portal (magic link + guía PDF): sale al recibir el primer formulario (ver abajo). Con `enviar_formulario = false` el equipo manda el formulario en un correo propio; el portal, al crear el cliente, muestra el enlace del formulario que le toca con `?nif=…&email=…` y un botón «Copiar». Motivo (decisión de Hugo, 2026-11-02): dos correos de bienvenida a la vez confundían sobre qué hacer primero; el portal no sirve de nada hasta tener el formulario; el magic link caduca en 1 h, así que conviene mandarlo cuando el cliente vaya a usarlo; y así se manda después de comprobar que el email del formulario coincide con el de la ficha.
- HubSpot, solo si hay email: contacto (upsert por email, con `firstname`/`lastname` separados), deal en el pipeline "Onboarding" (etapa "Formulario pendiente") y tarea asociada a contacto y deal.
- Carpeta de Drive `<NIF>-<nombre>` con las subcarpetas 0-documentos, 1-contabilidad, 2-escrituras, 3-impuestos, 4-laboral, 5-mercantil y 9-otros bajo "Clientes" (solo con NIF real). El flujo de facturas localiza la carpeta por NIF (`name contains <NIF>`).

Cuando el cliente envía el formulario (`alta_nuevos_autonomos` / `traspasos_nuevos`, cada tabla con su trigger y su webhook), `Responden formulario`: comprueba NIF y email contra `clientes` y, si el NIF no tiene ficha, la crea (salvo que el email ya sea de otra ficha o el NIF no tenga forma válida; entonces solo avisa al equipo). Si coinciden, manda **un solo correo al cliente**: con el primer formulario de ese NIF, el de acceso al portal (confirma la recepción y da los próximos pasos: apoderamiento o certificado digital, mandato SEPA de GoCardless y acceso, con enlace válido 1 h y cómo pedir otro; guía adjunta); con los siguientes, una confirmación. Avisa a contacto@, mueve el deal a "Apoderamiento pendiente" (solo si sigue en "Formulario pendiente") y sube el txt de respuestas a `0-documentos` de la carpeta existente (la crea solo si no existe). Si el email no coincide con el de la ficha, solo avisa al equipo. Legado: ya no se crean fichas `PENDIENTE-…` de forma automática; el workflow las renombra si existen.

**HubSpot** (`n8n-workflows/hubspot/README.md`): el workflow `Sync HubSpot` copia `clientes` a las propiedades del contacto (grupo "Cliente Madal"). Supabase manda en todo salvo `plan` y `telefono`, que se pueden editar en ambos lados (gana HubSpot solo si el contacto cambió después de `hubspot_synced_at`). Los pasos de las etapas del deal posteriores a "Apoderamiento pendiente" se mueven a mano.

## Variables de entorno

| Variable | Server-only | Uso |
|---|---|---|
| `SUPABASE_URL` | Sí | Cliente admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí — **secreto, nunca al navegador** | Cliente admin |
| `PUBLIC_SUPABASE_URL` | No | Cliente browser (portal) |
| `PUBLIC_SUPABASE_ANON_KEY` | No — segura de exponer | Cliente browser (portal) |

Estas cuatro son las que hacen falta para tener Supabase funcionando en local/Vercel.

## Notas para quien construya workflows de n8n

- Necesitas credenciales equivalentes a la service role key. RLS bloqueará una anon key en prácticamente todo.
- **Las columnas `*_at` son la cola de trabajo.** `fecha_contabilizado`, `pago_confirmado_at`, `cita_aeat_solicitada_at`, `apoderamiento_aeat_at`, `apoderamiento_seg_soc_at`, `revocacion_apoderamiento_anterior_at`, `presupuesto_enviado_at`, `recordatorio_enviado_at`, `respondido_at`: ningún formulario las rellena, hoy se marcan a mano, y son exactamente los pasos que hay que ir automatizando. Quedan `NULL` hasta completarse, y eso no es un error.
- Casos de uso ya definidos con tabla lista: (1) facturas Storage → Drive → `fecha_contabilizado` → borrado del Storage tras el margen de días; (2) envío y seguimiento de presupuestos por email; (3) onboarding de cliente nuevo tras firmar el presupuesto. No hace falta diseñar esquema para ninguno.
- Vincula siempre **por NIF** (`clientes.id`), que es el identificador común a presupuestos, formularios y facturas.
- Los rate limiters de los endpoints públicos son en memoria y por instancia de Vercel — si un workflow llama a estos endpoints HTTP en vez de ir directo a Supabase, ese límite no es fiable bajo carga ni es una autenticación real. Prefiere ir directo a Supabase.

## Formulario de constitución de SL (2026-11-07)

`/formulario-constitucion-sl` (es, ca, en) se envía por correo a quien pide constituir una SL, con `?lead=<id>`. Guarda en `constituciones_formulario` por `/api/constitucion`, solo con service role porque lleva DNI e IBAN. El workflow `Formulario de constitución` de n8n copia cada envío a la hoja de Drive `Constituciones SL`, de la que saldrá el DUE, avisa a contacto@ y pasa el negocio a Revisión. Se ve en el idioma del cliente, pero los valores se guardan siempre en castellano.
