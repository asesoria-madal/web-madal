# BeeL (facturación Verifactu): manual de uso para la integración

Documento de referencia sobre cómo funciona BeeL y cómo lo usa el portal. Reúne lo que BeeL nos ha confirmado por correo (octubre 2026) y lo que hemos comprobado nosotros en sandbox. Pensado para que cualquier persona pueda mantener la integración sin depender de Claude.

Fuentes oficiales (mandan sobre este documento si difieren):
- Índice para máquinas: https://docs.beel.es/llms.txt
- Cuentas gestionadas: https://docs.beel.es/multi-nif/managed-accounts
- Claves y entornos: https://docs.beel.es/multi-nif
- Activar/desactivar NIF y representación: https://docs.beel.es/multi-nif/companies
- Responsabilidades y representación: https://docs.beel.es/verifactu/compliance-and-responsibilities
- Eventos de webhooks: https://docs.beel.es/webhooks/events
- Firma de webhooks: https://docs.beel.es/webhooks/signatures
- Precios: https://docs.beel.es/pricing
- Declaraciones responsables de BeeL: https://beel.es/declaraciones-responsables

## 1. Qué es y por qué lo usamos

BeeL (Honey Solutions, S.L.) es un software de facturación Verifactu con API. Es el **productor del sistema informático de facturación (SIF)** y firma la declaración responsable. Nosotros no construimos motor propio: si lo hiciéramos, seríamos productores y tendríamos esa responsabilidad.

Regla de oro: **el PDF y el email de la factura son siempre los de BeeL** (con su QR). Si renderizásemos nuestro propio PDF, podríamos necesitar una declaración responsable propia.

## 2. Modelo adoptado: cuentas gestionadas

Decidido: cada cliente de la asesoría es una **cuenta gestionada** dentro de nuestra cuenta de BeeL.

- Creamos la cuenta del cliente por API (`POST /v1/accounts`) con su NIF, un nivel de acceso y nuestra referencia externa (`external_ref`, p. ej. el id del cliente en Supabase).
- Nivel de acceso: `NONE` / `VIEW` / `OPERATE`. **Crear siempre con `OPERATE`**: emitir lo exige, y si el cliente reclama su cuenta, solo él puede subir el nivel (`MANAGED_SCOPE_ELEVATION_REQUIRES_OWNER`).
- Una sola clave de API (una de test y otra live) opera todas las cuentas gestionadas. El destino lo marca el `company_id` de la ruta.
- Dentro de las cuentas gestionadas no podemos crear claves ni webhooks (son del titular).
- El cliente puede **reclamar** su cuenta (pasa a ser titular), pero nosotros mantenemos el nivel de acceso y la facturación. **El cliente no puede quitarnos la gestión ni bajarnos el nivel.** Si quiere irse, nos lo dice y la terminamos nosotros.
- Terminar la gestión: `DELETE /v1/accounts/{account_id}/management` con clave live. Perdemos acceso al momento; sus NIF dejan de contarnos a partir del siguiente ciclo. El cliente conserva cuenta, NIF y facturas (y paga él si sigue con BeeL). Si ya había reclamado la cuenta, recuperar la gestión requiere su consentimiento.

## 3. Precio (propuesta de BeeL, oct 2026)

- **12 € al mes por NIF activo en producción**, sin IVA.
- 250 facturas en producción incluidas por NIF y mes; 0,01 € por factura adicional (se factura, no bloquea).
- Sin mínimo de NIF, sin permanencia, sin cuota de alta. Facturación mensual; el ciclo empieza el día en que empezó nuestra suscripción, no el día 1.
- **Un NIF cuenta desde que se activa en producción** (`POST /v1/companies/{company_id}/activations` con `environment: "PROD"`). Ojo: esa llamada también se puede hacer con la clave de test y **cuenta igual**. No activar PROD "por probar".
- Una vez activo en PROD cuenta aunque ese mes no emita nada. En test no cuesta nada, sin límite de tiempo.
- Baja de un NIF: `DELETE …/activations?environment=PROD`. Se programa al final del ciclo en curso (ciclo cobrado entero; puede seguir facturando hasta entonces).
- Referencia (público): plan API 19 €/NIF; el precio de 12 € es el acordado para nosotros.
- El coste se repercute al cliente aparte (decisión de los socios). Edurne decide si algún plan lo incluye.

## 4. Sandbox frente a producción

| Acción | Sandbox (clave `beel_sk_test_…`) | Producción (clave `beel_sk_live_…`) |
|---|---|---|
| Crear cuentas con nivel y `external_ref` | Sí; cada cuenta nace con NIF activo en test | Sí |
| Emitir facturas | Sí; Verifactu siempre activo, registros al entorno de pruebas de la AEAT | Sí, con efecto fiscal real |
| Webhooks | Sí, suscripción de sandbox | Suscripción propia de producción |
| Generar y descargar el PDF de representación | Sí | Sí |
| **Subir la representación firmada** | **No** (`SIGNING_ONLY_IN_LIVE`) | Sí |
| Evento `representation.signed` | No llega | Llega |
| Cambiar nivel de acceso / terminar gestión | **No** (`LIVE_CREDENTIAL_REQUIRED`) | Sí |
| Representación obligatoria para emitir | No hace falta firmarla | Sí |

Consecuencia: en sandbox el nivel de acceso se fija al crear la cuenta y no se puede cambiar. Elegir bien (`OPERATE`).

## 5. Claves API

- Se crean en app.beel.es → Desarrolladores → Claves API → "Crear clave API". Hay un selector Test/Live.
- La clave completa **solo se muestra una vez** al crearla.
- Para cuentas gestionadas la clave necesita, además de companies, customers, invoices y webhooks, los permisos **`accounts:read` y `accounts:write`**. No vienen por defecto y en la interfaz aparecen **bloqueados con el texto "Requiere activación por BeeL"** hasta que BeeL los habilite para nuestra cuenta (estado a 22-oct-2026: la pantalla "Cuentas gestionadas" ya existe, pero estas casillas seguían bloqueadas). **BeeL confirmó por email (23-oct-2026) que ya están habilitados**: hay que crear una clave de test nueva (las anteriores no los tienen) y entonces deberían aparecer disponibles.
- **Dónde guardar la clave:** solo en variables de entorno de servidor (Vercel). Nunca en el repo (es público) ni en el navegador. Al pasar a producción, crear una clave live nueva y rotar la de test.
- Límites: 300 peticiones/min por clave (compartido por todas las cuentas); 1.000/min por IP; 5/min por IP en representación y emails. Sin límite por NIF.

## 6. Convenciones de la API

- Base: `https://app.beel.es/api`. Rutas por empresa: `/v1/companies/{company_id}/…` (las rutas planas se retiran el 9-dic-2026: usar siempre las de empresa).
- `Idempotency-Key` obligatorio en las creaciones (usamos un uuid por intento).
- **Nunca llamar a la API desde el navegador**: siempre desde servidor (`src/lib/beel.ts`).
- Dirección del destinatario **obligatoria** (error `RECIPIENT_ADDRESS_REQUIRED`); el número de calle es opcional.
- BeeL **no tiene NIF de prueba** (confirmado 23-oct-2026): la validación es contra el censo real, así que para probar hay que usar NIF reales (propios o de quien lo consienta). Lo habitual es montar la integración con datos reales y pasar a live sin rehacer nada. BeeL no manda presupuesto aparte: vale el precio pactado y los términos y condiciones aceptados al dar de alta la cuenta (si hace falta un presupuesto firmado, lo preparan a petición).
- En sandbox el NIF debe existir en el censo de la AEAT. Si no, `422 NIF_VALIDATION_INVALID` y la cuenta no se crea. Comprobar antes con `POST /v1/nif/validate`.
- En sandbox el email de factura solo se entrega a la dirección del titular de prueba.
- El endpoint `/pdf` devuelve JSON con una `download_url` firmada que caduca a los 300 s, no el PDF directo. El portal lo gestiona en `src/pages/api/factura-pdf.ts`.
- Segundo NIF en el plan API sin precio acordado → `403 CONTACT_SALES_REQUIRED` (resuelto con el acuerdo de cuentas gestionadas).
- Pruebas ya hechas: factura estándar OK (`ACCEPTED` por la AEAT de pruebas, email entregado); IVA 10 % + IRPF 15 % OK; sin dirección → `RECIPIENT_ADDRESS_REQUIRED`.
- Probado en sandbox (22-oct-2026, mismos cuerpos que envía el portal): crear cliente; ordinaria con `recipient.customer_id`, línea exenta (`EXENTA_ART_20`), línea con `total_including_tax` (IVA incluido), `payment_info` y notas; simplificada con `recipient: {}`; rectificativa parcial R5 sobre una simplificada (cantidad negativa → `RS-2026-0001`); plantilla recurrente mensual con IRPF y pago.
- Detalles de la API: la factura no admite fecha de emisión (siempre es la de hoy), solo `operation_date`. Las plantillas recurrentes usan campos planos en las líneas (`vat_rate`, `irpf_rate`), no `main_tax`, y exigen `series_id`. Cada tipo tiene su serie por defecto (`F`, `S`, `R`, `RS` para rectificativas de simplificadas). `limit` máximo 100 en los listados.

## 7. Representación Verifactu (el punto con más fricción)

Para emitir en producción en nombre de un NIF, el titular debe firmar la representación.

- La firma la hace **el titular del NIF** (el autónomo, o el representante legal si es sociedad), **con su propio certificado electrónico**, **una sola vez** (regla REC-011). La API comprueba que el PDF lleve firma válida; si no, `PDF_SIGNATURE_INVALID`.
- **No vale Cl@ve. No podemos firmar nosotros como apoderados.**
- Lo que sí hacemos nosotros desde el portal: generar el documento (`POST …/representation`), descargarlo, subir la copia firmada (`…/representation/submit`, clave live) y consultar el estado (`GET …/representation`).
- Cliente sin certificado: el más sencillo es el **certificado de persona física de la FNMT**. Gratuito, acreditando identidad en oficina, con DNI electrónico, o por videoidentificación desde la app/web de la FNMT (esta vía tiene un pequeño coste). La acreditación la hace el propio cliente; es un trámite corto que acompañamos como parte del alta.
- Mientras tanto su NIF puede estar en **test, sin coste**.
- Tras firmar: subir PDF firmado → activar NIF en PROD → `PUT …/verifactu-configuration` con `enabled: true`. Comprobar con `GET …/issuing-readiness`.

## 8. Webhooks

- Una **única suscripción** nuestra (`POST /v1/accounts/{nuestro_account_id}/webhooks`) recibe los eventos de todas las cuentas gestionadas, **siempre que se cree con `account_relationship: "managed"`** (solo clientes) o `"all"` (nuestra cuenta y las suyas). Por defecto es `own`, y con `own` **no se reciben** los eventos de los clientes.
- Hay suscripción de sandbox y de producción, cada una con **su propio secreto**. Al pasar a producción hay que cambiar `BEEL_WEBHOOK_SECRET` en Vercel.
- Cada evento lleva `account_id`, `account_external_ref`, `account_relationship`, `company_id` y `nif`.
- Eventos extra que solo recibe quien creó la cuenta: `account.claimed`, `company.created`, `representation.signed` (este último solo en producción).
- Una cuenta con nivel `NONE` no envía eventos.
- Firma: cabecera `BeeL-Signature: t=<timestamp>,v1=<hmac>`; HMAC-SHA256 de `"{t}.{cuerpo_en_crudo}"` con el secreto de la suscripción; ventana de 300 s. Implementado en `src/pages/api/beel-webhook.ts`.
- Reintentos: 7 veces durante ~3 días. Responder 2xx para que no reintente; 500 solo si queremos el reintento.
- Máximo 10 suscripciones activas por cuenta.
- Hoy el receptor solo atiende `verifactu.status.updated` (actualiza `facturas_emitidas` y avisa a n8n si `REJECTED`). Verificar con el primer evento real que los campos `invoice_id`/`new_status` coinciden (el código acepta `id`/`status` como reserva y lo registra en logs si no coincide).

## 9. Salida y exportación

- Exportación por NIF: Excel (`POST …/invoices/exports`, hasta 50.000 facturas), ZIP de PDF (hasta 500), registros Veri*Factu.
- BeeL conserva los registros 6 años tras la baja.
- Stripe (cobro online) se conecta **por NIF**: el cliente conecta su cuenta desde nuestro portal (URL de autorización, vuelve al portal). Requiere nivel `OPERATE` y NIF activo. No implementado.

## 10. Qué hace hoy el código

- `src/lib/beel.ts`: configuración y llamadas a BeeL (sin SDK). La empresa por defecto (`BEEL_DEFAULT_COMPANY_ID`) solo se acepta con clave de test.
- Panel "Facturas" del portal: `src/components/pages/EmitirFacturas.astro` (pestañas Facturas · Nueva factura · Recurrentes · Clientes; textos en `ui.ts`, `portal.emitir`). Se parece a propósito al formulario de BeeL: tipo de factura, cliente de una lista, conceptos con IVA/exención/IRPF/descuento, "IVA incluido", pago, totales en vivo.
- Endpoints (todos validan la sesión del cliente y usan `src/lib/facturacion.ts`): `api/emitir-factura.ts` (ordinaria F1 y simplificada F2), `api/rectificar-factura.ts` (R1–R5; total o parcial), `api/facturacion/clientes.ts` (clientes del emisor, guardados en BeeL, no en Supabase), `api/facturacion/recurrentes.ts` (listar, crear, pausar/reanudar/terminar), `api/factura-pdf.ts`, `api/beel-webhook.ts`.
- Tablas: `clientes.beel_company_id` y `facturas_emitidas` (ver `supabase/schema.sql`). El bloque final del SQL añade `facturas_emitidas.tipo` y hace `receptor_nif` nullable: **ejecutarlo antes de desplegar**.
- Tipos que NO están en el portal: proforma, canje de simplificadas por factura completa (F3), borradores, IGIC/IPSI (Canarias/Ceuta/Melilla), recargo de equivalencia, suplidos, series propias y exenciones fuera de la lista corta de `facturacion.ts`. Esos casos los emite el equipo desde BeeL.
- Lo que genera una recurrente por sí sola (la factura de cada mes) **no se copia** a `facturas_emitidas`: no aparece en la pestaña Facturas y su estado Verifactu no se actualiza en el portal. Si hace falta, sincronizarlas desde el webhook (`verifactu.status.updated` + `GET invoices?…`).
- En sandbox todos los clientes comparten la company, así que también comparten clientes y recurrentes (solo datos de prueba).
- El administrador de la asesoría no ve este panel (antes veía la lista del cliente seleccionado).
- **Solo emiten los clientes con `clientes.beel_contratado = true`** (2026-10-23): el portal oculta el panel "Facturas" al resto y `contextoFacturacion` (`src/lib/facturacion.ts`) devuelve 403. Antes, un cliente sin cuenta propia caía en `BEEL_DEFAULT_COMPANY_ID` (empresa de sandbox compartida) aunque no hubiera contratado nada. Siguen valiendo: la empresa por defecto solo con clave de test, y 409 "todavía no está activada" si no hay `beel_company_id` con clave live.
- Variables de entorno: ver `ARQUITECTURA.md`, sección "Facturación Verifactu (BeeL)".
- **Limitación actual:** todos los clientes emiten con la empresa de sandbox (emisor ficticio, sin efecto fiscal). Para producción hace falta una cuenta gestionada por cliente (ver `ALTA-CLIENTE-FACTURACION.md`).

## 11. Alta automatizada desde el portal (2026-10-22)

Implementado, **sin probar contra BeeL** (los permisos `accounts:read/write` ya los habilitó BeeL el 23-oct-2026; con una clave sin ellos `POST /v1/accounts` devuelve `403 FEATURE_NOT_AVAILABLE`, así que hay que usar una clave de test nueva). Probar primero con clave de test y un NIF real consentido.

**Probado contra el sandbox el 23-oct-2026** (mismas peticiones que hace `beel-cuenta.ts`, con el NIF de Hugo como `INDIVIDUAL`): `POST /v1/accounts` → 201 con `account_id` y `company_id`; `POST …/representation` → `PDF_GENERATED`; `GET …/representation/document` → `download_url` (300 s); `GET …/issuing-readiness` → `ready: true`. Falta probar el tramo del portal (Supabase, panel de admin, aviso a n8n) y todo lo de producción (subir representación firmada, activar PROD).

Flujo (detalle operativo en `ALTA-CLIENTE-FACTURACION.md`):
1. Al dar de alta al cliente se marca `clientes.beel_contratado` (formulario de alta del portal de admin). `Onboarding` crea en HubSpot una tarea «Alta BeeL».
2. Cuando hay NIF real y dirección fiscal: portal (modo admin) > cliente > panel «Facturación BeeL» > **crear cuenta** → `api/beel-cuenta.ts`: crea la cuenta gestionada (OPERATE, sin `email`, es decir sin titular ni enlace de reclamación), guarda `beel_account_id`/`beel_company_id`, estado `cuenta_test`, genera el documento de representación y avisa al webhook de n8n «BeeL representación al cliente», que se lo envía por email con las instrucciones de firma. Gratis.
3. El cliente firma con su certificado y devuelve el PDF. El equipo lo sube en el mismo panel → `api/beel-activar.ts`: sube la representación, activa el NIF en PROD, activa Veri*Factu, comprueba `issuing-readiness` y guarda estado `produccion` + `beel_activado_prod_at`. **Solo con clave live** (con la de test también cobraría el NIF) y con casilla de aceptación del coste.

Por qué la dirección la teclea el admin: BeeL exige dirección estructurada (calle, CP, ciudad, provincia) y los formularios de alta/traspaso solo guardan `domicilio_fiscal` como texto libre; parsearlo sería frágil.

Variable nueva en Vercel: `N8N_BEEL_WEBHOOK_URL` (URL de producción del webhook de n8n; opcional: sin ella el panel ofrece el enlace de descarga para enviar el documento a mano). La autenticación reutiliza `N8N_ALERT_TOKEN` (cabecera `X-Alert-Token`, credencial Header Auth «Beel» de n8n).

## 12. Pendiente

- Webhook `managed` de sandbox y de producción (ver §8).
- Bloquear la emisión en producción si el cliente no tiene `beel_estado = 'produccion'`.
- Baja del cliente (`DELETE …/activations?environment=PROD` y terminar la gestión): sigue siendo manual, ver `ALTA-CLIENTE-FACTURACION.md`.
- `PUT …/verifactu-configuration`: confirmado en el OpenAPI (23-oct-2026) que el único campo es `enabled` (obligatorio, reemplazo completo) y que exige el permiso `configuration:write`. En live sin representación validada devuelve `422 VERIFACTU_REPRESENTATION_REQUIRED`. La clave de test creada el 23-oct (`Portal web test`) **no** lleva `configuration:*` ni `nif:validate`: la clave live debe incluirlos (`beel-activar.ts` los necesita).
- Clientes SL (`entity_type: LEGAL_ENTITY`): para generar la representación BeeL exige la dirección completa del representante legal (`PROFILE_INCOMPLETE` con `error.details` si falta) y `beel-cuenta.ts` aún no envía `legal_representative`. Un `INDIVIDUAL` con `legal_form` o representante se rechaza. Probar primero con un autónomo (`INDIVIDUAL`); el flujo de SL queda por completar.
- `GET …/representation/document` devuelve `download_url` de vida corta y la representación pasa por `NOT_STARTED → PDF_GENERATED → ACTIVE`.
