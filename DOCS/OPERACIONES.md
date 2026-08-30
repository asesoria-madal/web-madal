# Operaciones: pasos manuales, config de paneles, deploy y rollback

Lo que **no** está automatizado y hay que hacer a mano, la configuración que solo vive en los paneles de Supabase/Vercel (no en el repo), y cómo desplegar y revertir.

Para el modelo de datos completo, ver [`../ARQUITECTURA.md`](../ARQUITECTURA.md). Este documento es la lista de "cosas que alguien tiene que hacer y no las hace el código".

---

## 1. Deploy

- **Producción**: `git push` a `main` en `asesoria-madal/web-madal`. Vercel compila (`npm run build`) y publica en `https://asesoriamadal.es` en 1-2 min. No hay paso manual.
- **Preview**: push a cualquier otra rama → Vercel crea un despliegue de preview con su propia URL. Útil para revisar antes de mezclar a `main`.
- **Antes de hacer push**: `npx astro check` (0 errores) y `npm run build` (Complete) en local.
- El proyecto de Vercel **no está enlazado por CLI** en las máquinas locales (no hay `.vercel/project.json` en el repo). Todo se gestiona desde el panel de Vercel + la integración con GitHub. No hace falta `vercel` CLI para el flujo normal.

## 2. Rollback (revertir un deploy malo)

Dos formas, de más rápida a más "correcta":

1. **Inmediato, sin recompilar — panel de Vercel**: proyecto `web-ase-madal` → pestaña **Deployments** → busca el último despliegue bueno → menú `⋯` → **Promote to Production** (o *Rollback*). Vuelve a producción en segundos, reutilizando el build anterior. Esto **no** cambia el código del repo: el commit malo sigue en `main`.
2. **Definitivo — revertir en git**: `git revert <sha-del-commit-malo>` y `git push` a `main`. Vercel recompila y despliega la versión corregida. Es lo que deja el repo y producción coherentes.

Nunca `git push --force` sobre `main`.

## 3. Variables de entorno

Cuatro, todas de Supabase (panel de Supabase → Project Settings → API). Detalle de para qué sirve cada una en [`../ARQUITECTURA.md`](../ARQUITECTURA.md) § Variables de entorno.

| Variable | Dónde se configura |
|---|---|
| `SUPABASE_URL` | Panel de Vercel → Project Settings → Environment Variables (Production + Preview). **Secreta.** |
| `SUPABASE_SERVICE_ROLE_KEY` | Ídem. **Secreta, nunca al navegador ni al repo.** |
| `PUBLIC_SUPABASE_URL` | Ídem. |
| `PUBLIC_SUPABASE_ANON_KEY` | Ídem. Segura de exponer. |

En local van en `web/.env` (ver `.env.example`). Si faltan, la web arranca en **modo degradado**: formularios y simulador responden con éxito pero no persisten nada. Un deploy de preview sin estas variables se comporta igual.

## 4. Cambios de esquema en Supabase

- `supabase/schema.sql` es la fuente de verdad, pero **no se aplica solo**: se ejecuta **a mano en el SQL editor de Supabase**.
- Es un archivo **acumulativo**. Los bloques marcados con un comentario `ejecutar UNA VEZ` (altas de datos, migraciones, backfills) hay que ejecutarlos una sola vez y con cuidado; el resto usa `create table if not exists` y es idempotente.
- No hay migraciones versionadas. Al cambiar el esquema: edita `schema.sql` (incluido el comentario que explica el porqué), ejecuta el fragmento correspondiente en el SQL editor, y haz commit del `.sql`.

## 5. Configuración que solo existe en los paneles (no en el repo)

Si algún día se recrea el proyecto de Supabase desde cero, esto hay que rehacerlo a mano:

- **Políticas RLS del Storage** (bucket `facturas`): creadas a mano en Supabase → Storage → Policies. En `schema.sql` solo están **como comentario**. Comprueban la carpeta del archivo contra el NIF del cliente vía subconsulta a `clientes`.
- **Bucket `facturas`** (privado) y **`docs-publicos`** (público): se crean en el panel de Storage.
- **Política de Storage para administradores** (lectura de las facturas de cualquier cliente): también a mano en el panel, equivalente a la que `schema.sql` define por SQL para las tablas.
- **Trigger + webhook `cliente-nuevo`** (para el onboarding de n8n): **no está en `schema.sql`**. Es un `AFTER INSERT` sobre `clientes` previsto pero no creado. Si el workflow de onboarding lo necesita, hay que escribirlo.
- El trigger `on_auth_user_created` → `vincular_cliente_nuevo()` (que rellena `auth_user_id` en el primer login) **sí** está en `schema.sql`.

## 6. Pasos manuales del día a día (hasta que n8n los automatice)

Todos se hacen en el **Table Editor de Supabase**. Son exactamente las tareas que los workflows de n8n deben ir asumiendo.

| Cuándo | Qué hacer | Dónde |
|---|---|---|
| Cliente nuevo contratado | Crear su fila en `clientes` (un cliente no puede crearse a sí mismo). `id` = su NIF/NIE en mayúsculas. | Tabla `clientes` |
| Al configurar al cliente | Rellenar `tipo_persona` (`autonomo`/`sl`), `reporting` (bool), `modelos` (array: `{130,303,...}`), y `alta_hecha` si es autónomo (`true` = le tramitamos el alta, `false` = ya estaba de alta). | Tabla `clientes` |
| Al crear su empresa en Visionwin | Rellenar `visionwin_empresa_codigo`. Es el flag de "cliente listo": sin NIF **y** este código, el workflow de facturas no baja nada. | Tabla `clientes` |
| Factura ya bajada a Drive | Marcar `fecha_contabilizado = now()` en su fila. "Contabilizada" (en Drive) y `storage_path = null` (borrada del Storage) son **pasos independientes**. | Tabla `facturas_subidas` |
| Nuevo administrador del portal | Añadir su `auth_user_id` (uuid de `auth.users`) a `portal_admins`. Bloque `ejecutar UNA VEZ` cerca del final de `schema.sql`. | SQL editor |

## 7. Trampas conocidas

- **`auth_user_id` que se queda en `null` para siempre**: si borras y recreas una fila de `clientes` para un email que **ya** tenía cuenta de Auth (ya había hecho login alguna vez), el trigger no se vuelve a disparar y esa fila nunca recupera su `auth_user_id`. Todo lo que depende de RLS para ese cliente falla **en silencio**. Hay un backfill al final del bloque de migración de `schema.sql`; en caso de duda, ejecutarlo.
- **El cálculo del precio está duplicado a propósito** entre `src/components/pages/Simulador.astro` (front) y `src/pages/api/presupuesto.ts` (back). Si cambian las tarifas, **hay que tocar los dos** o dejarán de cuadrar.
- **Las columnas `*_at` son la cola de trabajo**, no errores: `fecha_contabilizado`, `presupuesto_enviado_at`, `respondido_at`, `apoderamiento_aeat_at`, etc. quedan `NULL` hasta que alguien (hoy a mano, mañana n8n) completa ese paso.
- **La validación de los formularios es laxa a propósito** (forma y longitud, no corrección real): Edurne revisa los datos a mano antes de tramitar. No añadir `CHECK` en SQL para los valores cerrados; se validan en el endpoint.
- **Workflows de n8n contra Supabase**: usar siempre credenciales equivalentes a la **service role key**. La anon key la bloquea RLS en casi todo. Vincular por **NIF** (`clientes.id`), que es la clave común a presupuestos, formularios y facturas.
