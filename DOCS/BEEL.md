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
- **Permisos que necesita la clave para todo lo que hace el portal** (comprobado 25-oct-2026): companies (incluido `companies:write`, para corregir la dirección de una cuenta), customers, invoices, webhooks, `accounts:read`, `accounts:write` y **`series:read`** (crear facturas recurrentes: el portal lista las series para usar la predeterminada). La clave de test `Portal web test` (23-oct) **no** tenía `series:read`: al crear una recurrente BeeL contestaba `INSUFFICIENT_SCOPE` con `missing_scopes: "series:read"`. **Resuelto el 26-oct-2026**: Hugo creó una clave de test nueva con todos los permisos y la puso en `BEEL_API_KEY`; con ella ya se crean recurrentes desde el portal. No se encontró forma de añadir permisos a una clave ya creada: se crea otra. La live necesita además `configuration:write` y `nif:validate` (ver §12).
- **Dónde guardar la clave:** solo en variables de entorno de servidor (Vercel). Nunca en el repo (es público) ni en el navegador. Al pasar a producción, crear una clave live nueva y rotar la de test.
- Límites: 300 peticiones/min por clave (compartido por todas las cuentas); 1.000/min por IP; 5/min por IP en representación y emails. Sin límite por NIF.

## 6. Convenciones de la API

- Base: `https://app.beel.es/api`. Rutas por empresa: `/v1/companies/{company_id}/…` (las rutas planas se retiran el 9-dic-2026: usar siempre las de empresa).
- `Idempotency-Key` obligatorio en las creaciones (usamos un uuid por intento).
- **Nunca llamar a la API desde el navegador**: siempre desde servidor (`src/lib/beel.ts`).
- Dirección del destinatario **obligatoria** (error `RECIPIENT_ADDRESS_REQUIRED`); el número de calle es opcional.
- BeeL **no tiene NIF de prueba** (confirmado 23-oct-2026): la validación es contra el censo real, así que para probar hay que usar NIF reales (propios o de quien lo consienta). Lo habitual es montar la integración con datos reales y pasar a live sin rehacer nada. BeeL no manda presupuesto aparte: vale el precio pactado y los términos y condiciones aceptados al dar de alta la cuenta (si hace falta un presupuesto firmado, lo preparan a petición).
- **Al crear cuentas o empresas, también en sandbox, BeeL comprueba el NIF y el nombre contra el censo real de la AEAT.** Lo único simulado en sandbox es `POST /v1/nif/validate`, que allí solo mira la sintaxis (confirmado por BeeL, 26-oct-2026); en live sí consulta el censo. Si no cuadran: `422 NIF_VALIDATION_INVALID` («The NIF does not exist in the AEAT census», el mismo mensaje para un NIF inventado que para un nombre que no coincide) y la cuenta no se crea. Comprobado el 26-oct-2026 con el NIF de Edurne (con su consentimiento): falla con otro nombre y pasa con el suyo tal como figura en el DNI. **No hace falta estar dado de alta como autónomo**: basta con el NIF real y la razón social tal como consta en la AEAT.
- Lo anterior es para **crear cuentas** (el NIF del emisor). Para los **clientes del emisor** (destinatarios), en sandbox BeeL solo comprueba la sintaxis del NIF (docs.beel.es/verifactu/testing-in-sandbox); en live comprueba el censo y, si es persona física, que el nombre coincida (`422 NIF_NOT_IN_CENSUS`).
- Destinatario sin NIF español: va en `alternative_id` { `type`, `number`, `country_code` } en vez de `nif` (`NIF_IVA` para empresas de otro país de la UE, `PASSPORT`, `COUNTRY_ID`, `RESIDENCE_CERTIFICATE`, `OTHER_DOCUMENT`, o `NOT_REGISTERED` para un DNI/NIE español sin alta en Hacienda), con `address.country_code`; fuera de España el código postal es libre y la provincia opcional (docs.beel.es/customers/createCompanyCustomer). El portal lo admite desde el 25-oct-2026. Un `NIF_IVA` que no esté en VIES acaba `REJECTED` por la AEAT (BeeL solo valida el formato).
- En sandbox el email de factura solo se entrega a la dirección del titular de prueba.
- El endpoint `/pdf` devuelve JSON con una `download_url` firmada que caduca a los 300 s, no el PDF directo. **El PDF se genera de forma asíncrona tras emitir**: si no está listo, BeeL contesta `202` sin cuerpo y `Retry-After` (espera como mucho 10 s; `Prefer: wait=N` lo acota). Una factura no registrada en la AEAT no tiene PDF: `400 INVOICE_NOT_REGISTERED_NO_PDF` (docs.beel.es/guides/branding-and-pdf). El portal lo gestiona en `src/pages/api/factura-pdf.ts` (espera 5 s y el navegador reintenta).
- Segundo NIF en el plan API sin precio acordado → `403 CONTACT_SALES_REQUIRED` (resuelto con el acuerdo de cuentas gestionadas).
- Pruebas ya hechas: factura estándar OK (`ACCEPTED` por la AEAT de pruebas, email entregado); IVA 10 % + IRPF 15 % OK; sin dirección → `RECIPIENT_ADDRESS_REQUIRED`.
- Probado en sandbox (22-oct-2026, mismos cuerpos que envía el portal): crear cliente; ordinaria con `recipient.customer_id`, línea exenta (`EXENTA_ART_20`), línea con `total_including_tax` (IVA incluido), `payment_info` y notas; simplificada con `recipient: {}`; rectificativa parcial R5 sobre una simplificada (cantidad negativa → `RS-2026-0001`); plantilla recurrente mensual con IRPF y pago.
- Detalles de la API: la factura no admite fecha de emisión (siempre es la de hoy), solo `operation_date`. Las plantillas recurrentes usan campos planos en las líneas (`vat_rate`, `irpf_rate`), no `main_tax`, y exigen `series_id` (confirmado por BeeL: no coge la predeterminada si se omite; `GET …/series/defaults` da la de cada tipo en el entorno de la clave). Cada tipo tiene su serie por defecto (`F`, `S`, `R`, `RS` para rectificativas de simplificadas). `limit` máximo 100 en los listados.

## 7. Representación Verifactu (el punto con más fricción)

Para emitir en producción en nombre de un NIF, el titular debe firmar la representación.

- La firma la hace **el titular del NIF** (el autónomo, o el representante legal si es sociedad), **con su propio certificado electrónico**, **una sola vez** (regla REC-011). La API comprueba que el PDF lleve firma válida; si no, `PDF_SIGNATURE_INVALID`.
- **No vale Cl@ve. No podemos firmar nosotros como apoderados.**
- Lo que sí hacemos nosotros desde el portal: generar el documento (`POST …/representation`), descargarlo, subir la copia firmada (`…/representation/submit`, clave live) y consultar el estado (`GET …/representation`).
- Cliente sin certificado: el más sencillo es el **certificado de persona física de la FNMT**. Gratuito, acreditando identidad en oficina, con DNI electrónico, o por videoidentificación desde la app/web de la FNMT (esta vía tiene un pequeño coste). La acreditación la hace el propio cliente; es un trámite corto que acompañamos como parte del alta.
- Mientras tanto su NIF puede estar en **test, sin coste**.
- **Para generar el documento, la dirección fiscal de la empresa tiene que llevar el número aparte (`address.number`)**, aunque el esquema de BeeL lo dé por opcional «si la calle ya lo incluye»: sin él, `400 PROFILE_INCOMPLETE` con `details: {"address_number": …}` (comprobado el 26-oct-2026). Si una cuenta se creó sin número, se corrige con `PATCH /v1/companies/{company_id}` mandando la dirección entera (permiso `companies:write`). El portal pide el número aparte y permite corregir la dirección desde el panel (§11).
- **En sandbox la representación no hace falta** (confirmado por BeeL, 26-oct-2026): en Test se emite desde el primer momento y cada factura va al entorno de pruebas de la AEAT. Firmarla solo se puede en Live (con clave de test, `SIGNING_ONLY_IN_LIVE`).
- **Paso a producción de cada cliente, según BeeL** (correo del 26-oct-2026 y docs.beel.es/multi-nif/managed-accounts): (1) activar el NIF con `POST …/activations` y `"environment": "PROD"`; (2) generar la representación, que la firme el titular con su certificado y subirla con la clave live (`POST …/representation/submit`); (3) comprobar con la clave live que `GET …/representation` da `ACTIVE` y que `issuing-readiness` da `ready` **y** `verifactu.ready` (`ready` solo dice que el NIF puede emitir; si pasará el registro en la AEAT lo dice `verifactu.ready`). El evento `representation.signed` avisa de la firma. No mencionan `PUT …/verifactu-configuration`.
- **Lo que hace hoy `beel-activar.ts`** (ajustado el 26-oct-2026): sube la representación, activa PROD, `PUT verifactu-configuration`, y solo da por buena la activación con `ready` y `verifactu.ready`. Sube la representación **antes** de activar para no pagar el NIF si el PDF no vale; un reintento no la resube (mira si ya está `SUBMITTED`/`ACTIVE`) y la activación repetida no cobra dos veces (`already_active: true`). Preguntado a BeeL si ese orden vale.
- **Titular de la cuenta (26-oct-2026):** la activación en PROD documenta `422 ACCOUNT_HAS_NO_HOLDER` para cuentas sin titular. Por eso, desde el 26-oct `beel-cuenta.ts` crea las cuentas **con el email del cliente** (`clientes.email`) como titular. BeeL no le escribe: `send_email` es `false` por defecto y el enlace de reclamación (`claim_url`, unos 30 días) solo llega en la respuesta, que no guardamos porque se puede pedir otro con `POST /v1/accounts/{account_id}/claim-tokens`. Si ese email ya tiene una cuenta de BeeL que no gestionamos: `409 PROVISIONING_EMAIL_ALREADY_REGISTERED` (el panel lo explica). Las dos cuentas de prueba anteriores (Hugo, Edurne) se crearon sin email; si alguna pasara a producción, darle titular antes con `POST …/claim-tokens` y el email. Preguntado a BeeL si se puede activar PROD sin que el cliente llegue a reclamar la cuenta.

## 8. Webhooks

- Una **única suscripción** nuestra (`POST /v1/accounts/{nuestro_account_id}/webhooks`) recibe los eventos de todas las cuentas gestionadas, **siempre que se cree con `account_relationship: "managed"`** (solo clientes) o `"all"` (nuestra cuenta y las suyas). Por defecto es `own`, y con `own` **no se reciben** los eventos de los clientes.
- Hay suscripción de sandbox y de producción, cada una con **su propio secreto**. Al pasar a producción hay que cambiar `BEEL_WEBHOOK_SECRET` en Vercel.
- Cada evento lleva `account_id`, `account_external_ref`, `account_relationship`, `company_id` y `nif`.
- Eventos extra que solo recibe quien creó la cuenta: `account.claimed`, `company.created`, `representation.signed` (este último solo en producción).
- Una cuenta con nivel `NONE` no envía eventos.
- Firma: cabecera `BeeL-Signature: t=<timestamp>,v1=<hmac>`; HMAC-SHA256 de `"{t}.{cuerpo_en_crudo}"` con el secreto de la suscripción; ventana de 300 s. Implementado en `src/pages/api/beel-webhook.ts`.
- Reintentos: 7 veces durante ~3 días. Responder 2xx para que no reintente; 500 solo si queremos el reintento.
- Máximo 10 suscripciones activas por cuenta.
- Confirmado por BeeL (26-oct-2026): con `"managed"` llegan los eventos de todas las cuentas que hemos dado de alta, salvo las de acceso `NONE`; con `"all"`, también los nuestros. Cada evento lleva `company_id`, `nif`, `account_id`, `account_external_ref`, `account_relationship` y `livemode` (`true` en Live, `false` en Test). El `id` del evento se repite en los reintentos (sirve para deduplicar).
- **`verifactu.status.updated` nunca notifica `NOT_SUBMITTED`** (no hay registro cuyo estado cambie). BeeL recomienda conciliar periódicamente con `GET …/invoices?verifactu_status=NOT_SUBMITTED` y `?verifactu_status=REJECTED`. Hoy el portal lo hace solo al abrir la lista (`sincronizar.ts`); en producción conviene un repaso programado (§12).
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
- `api/facturacion/sincronizar.ts` (25-oct-2026): pone al día el estado de Hacienda de las facturas sin respuesta definitiva (`PENDING`, `NOT_SUBMITTED`) consultando a BeeL; el portal lo llama al pintar la lista. Sin esto, sin webhook, una factura se quedaba "pendiente de envío" para siempre. Al admin que prueba le devuelve además un diagnóstico (estado real en BeeL, motivo, `request_id` para el soporte, e `issuing-readiness` de la empresa).
- **El administrador puede probar la facturación como un cliente (2026-10-25), solo con clave de test.** En el portal (modo admin), al elegir un cliente con `beel_contratado`, aparece "Facturas" y las peticiones llevan la cabecera `X-Cliente-Admin` con su `clientes.id`. `clienteParaFacturacion` (`src/lib/portalAuth.ts`) solo la acepta si quien llama es admin (`portal_admins`) y la clave es `beel_sk_test_`; con clave live la rechaza, porque una factura a nombre de un cliente tendría efecto fiscal real. Afecta a emitir, rectificar, clientes, recurrentes y PDF. Si algún día se quiere en producción, hay que decidirlo aparte (quién emite es el cliente).
- **Solo emiten los clientes con `clientes.beel_contratado = true`** (2026-10-23): el portal oculta el panel "Facturas" al resto y `contextoFacturacion` (`src/lib/facturacion.ts`) devuelve 403. Antes, un cliente sin cuenta propia caía en `BEEL_DEFAULT_COMPANY_ID` (empresa de sandbox compartida) aunque no hubiera contratado nada. Siguen valiendo: la empresa por defecto solo con clave de test, y 409 "todavía no está activada" si no hay `beel_company_id` con clave live.
- Variables de entorno: ver `ARQUITECTURA.md`, sección "Facturación Verifactu (BeeL)".
- **Con qué empresa emite cada cliente:** si tiene `beel_company_id` (cuenta gestionada creada desde el panel de admin), con la suya; si no, en sandbox, con la empresa por defecto (`BEEL_DEFAULT_COMPANY_ID`, hoy la empresa principal de nuestra cuenta: Hugo Madrid Rodríguez, 23845033J), así que el emisor que sale en esas facturas es Hugo, no el cliente. Para producción hace falta una cuenta gestionada por cliente (ver `ALTA-CLIENTE-FACTURACION.md`). A 26-oct-2026 hay dos cuentas gestionadas de prueba en sandbox: la de Hugo (company `60e87558-a7c7-46f6-8e00-de059ea125e6`) y la de Edurne (company `164ec0af-deee-457b-8339-2687f862569f`). Las cuentas gestionadas de sandbox no se pueden borrar ni dejar de gestionar (`LIVE_CREDENTIAL_REQUIRED`).
- **El panel de BeeL (app.beel.es) no enseña los datos de Test de una cuenta gestionada**: al entrar con «Emitir en su nombre» solo ofrece la vista Live. Sus facturas y clientes de prueba solo se ven desde el portal (modo admin) o por API con la clave de test (`GET /v1/companies/{company_id}/invoices` y `…/customers`); BeeL confirma que esa es la vía.

## 11. Alta automatizada desde el portal (2026-10-22)

Implementado y **probado en sandbox desde el portal el 26-oct-2026** (ver abajo). Con una clave sin `accounts:read/write`, `POST /v1/accounts` devuelve `403 FEATURE_NOT_AVAILABLE`.

**Prueba desde el portal (26-oct-2026)**, con un cliente de prueba y el NIF de Edurne (con su consentimiento): la cuenta se crea con nivel OPERATE (aparece en BeeL > Cuentas gestionadas, «Lista» para emitir, titular sin invitar) y Supabase queda con `beel_estado = 'cuenta_test'`. Hallazgos, ya corregidos en el código: (1) el nombre fiscal tiene que ser el del DNI (§6); (2) la representación exige el número de la calle aparte (§7): el formulario lo pide y, si una cuenta se creó sin él, el panel vuelve a mostrar la dirección y «Generar de nuevo el documento» la corrige con `PATCH` antes de generar; (3) el código perdía el error real de la generación y solo enseñaba `REPRESENTATION_NOT_FOUND`. Errores comprobados con mensaje legible: código postal de 4 cifras (400), cliente sin facturación contratada (409), NIF inventado (`NIF_VALIDATION_INVALID`), cliente inexistente (404). **Lo que sigue fallando:** el aviso a n8n responde **403** (ver §12), así que el documento no le llega solo al cliente; el panel enseña el enlace de descarga y el motivo.

**Probado contra el sandbox el 23-oct-2026** (mismas peticiones que hace `beel-cuenta.ts`, con el NIF de Hugo como `INDIVIDUAL`): `POST /v1/accounts` → 201 con `account_id` y `company_id`; `POST …/representation` → `PDF_GENERATED`; `GET …/representation/document` → `download_url` (300 s); `GET …/issuing-readiness` → `ready: true`. Falta probar el tramo del portal (Supabase, panel de admin, aviso a n8n) y todo lo de producción (subir representación firmada, activar PROD).

Flujo (detalle operativo en `ALTA-CLIENTE-FACTURACION.md`):
1. Al dar de alta al cliente se marca `clientes.beel_contratado` (formulario de alta del portal de admin). `Onboarding` crea en HubSpot una tarea «Alta BeeL».
2. Cuando hay NIF real y dirección fiscal: portal (modo admin) > cliente > panel «Facturación BeeL» > nombre fiscal tal como figura en el DNI o en el censo, calle, **número aparte** («s/n» si no tiene), piso y puerta opcional, CP, ciudad y provincia > **crear cuenta** → `api/beel-cuenta.ts`: crea la cuenta gestionada (OPERATE, con el email del cliente como titular pero sin que BeeL le escriba; ver §7), guarda `beel_account_id`/`beel_company_id`, estado `cuenta_test`, genera el documento de representación y avisa al webhook de n8n «BeeL representación al cliente», que se lo envía por email con las instrucciones de firma. Gratis. En el estado `cuenta_test`, el botón «Generar de nuevo el documento y enviárselo al cliente» (`action: 'documento'`) vuelve a generarlo y a enviarlo: sirve cuando caduca el enlace (5 minutos), cuando el cliente lo pierde o cuando falló al crear la cuenta.
3. El cliente firma con su certificado y devuelve el PDF. El equipo lo sube en el mismo panel → `api/beel-activar.ts`: sube la representación, activa el NIF en PROD, activa Veri*Factu, comprueba `issuing-readiness` y guarda estado `produccion` + `beel_activado_prod_at`. **Solo con clave live** (con la de test también cobraría el NIF) y con casilla de aceptación del coste.

Por qué la dirección la teclea el admin: BeeL exige dirección estructurada (calle, CP, ciudad, provincia) y los formularios de alta/traspaso solo guardan `domicilio_fiscal` como texto libre; parsearlo sería frágil.

Variable nueva en Vercel: `N8N_BEEL_WEBHOOK_URL` (URL de producción del webhook de n8n; opcional: sin ella el panel ofrece el enlace de descarga para enviar el documento a mano). La autenticación reutiliza `N8N_ALERT_TOKEN` (cabecera `X-Alert-Token`, credencial Header Auth «Beel» de n8n).

## 12. Pendiente

- **Cuentas gestionadas en sandbox: sus facturas no se envían a la AEAT** (25 y 26-oct-2026). Pasa en las dos que tenemos, cada una con su F-2026-0001: la de Hugo (company `60e87558-a7c7-46f6-8e00-de059ea125e6`, emitida el 25-oct; `request_id` `689b8925427e8e3abc4d48592fb65a69` y `2c0028de650ce6d6f34e394e63ada466`) y la de Edurne (company `164ec0af-deee-457b-8339-2687f862569f`, emitida el 26-oct; `request_id` `5784709e3a50b90a75a0f1c8ddb6b00d` y `5d0b5427d29617670216b4c65a0258a9`). Ambas: `ISSUED`, `submission_status: NOT_SUBMITTED`, sin `error_code` ni registro, `/pdf` con `202` indefinido (el portal se rinde a los ~75 s con «El PDF todavía no está disponible»), e `issuing-readiness` con `ready: true`. La empresa principal (`3f609c9e-…`) sí envía (ACCEPTED). **Descartada la hipótesis del NIF repetido**: el NIF de Edurne no está en ninguna otra empresa. **BeeL respondió el 26-oct-2026**: no es por la representación (en sandbox no hace falta) ni es el comportamiento esperado; lo están investigando con los `request_id`. `NOT_SUBMITTED` = emitida sin registro en la AEAT, y sin registro no hay QR ni PDF (de ahí el 202). Según BeeL, el resto del flujo de una cuenta gestionada es idéntico al de la empresa principal (solo cambia el `company_id`), así que lo ya probado allí vale. Pendiente de que nos avisen para repetir la prueba.
- **Repaso programado de facturas `NOT_SUBMITTED` y `REJECTED`** (recomendación de BeeL, §8): el webhook nunca avisa de `NOT_SUBMITTED`. Hoy solo se ponen al día al abrir la lista. Para producción: una tarea periódica (n8n o cron de Vercel) que consulte cada empresa con `?verifactu_status=NOT_SUBMITTED` y `REJECTED` y avise a la asesoría. Sin hacer.
- **Preguntas abiertas a BeeL (26-oct-2026):** si se puede subir la representación antes de activar PROD (orden de `beel-activar.ts`, §7); si hace falta `PUT …/verifactu-configuration`; y si se puede activar PROD sin que el cliente reclame su cuenta. Test y Live son entornos separados: en producción se empieza de cero (clientes, series y numeración), según la documentación de BeeL.
- **Aviso a n8n del documento de representación: resuelto el 26-oct-2026.** Respondía 403 porque `N8N_ALERT_TOKEN` no existía en Vercel (el portal mandaba la cabecera `X-Alert-Token` vacía); también faltaba `N8N_ALERT_WEBHOOK_URL` (`https://n8n.asesoriamadal.es/webhook/beel-factura-rechazada`, Production). Se puso un valor nuevo en la credencial «Beel» de n8n (Header Auth, nombre `X-Alert-Token`) y el mismo en `N8N_ALERT_TOKEN` de Vercel (tipo Secret, Production), y se redesplegó: el portal ya confirma el envío. Si hay que rotarlo: n8n no deja ver el valor guardado, así que se pone uno nuevo en los dos sitios y se redespliega. Lo usan los dos avisos: documento de representación (`beel-cuenta.ts`) y factura rechazada (`beel-webhook.ts`); este último no se puede probar hasta crear el webhook de BeeL (§8).
- **Facturas rechazadas por la AEAT:** el portal ya no ofrece «Rectificar» (no hay registro que rectificar) ni tiene «Anular»: la asesoría la anula desde BeeL (`POST …/invoices/{id}/void`) y el cliente emite otra. Un NIF-IVA que no está en VIES acaba rechazado (`RECIPIENT_VAT_NOT_IN_VIES`); se podría comprobar VIES al crear el cliente, no implementado.
- Webhook `managed` de sandbox y de producción (ver §8). Mientras no exista, `api/facturacion/sincronizar.ts` pone al día los estados al abrir la lista.
- Bloquear la emisión en producción si el cliente no tiene `beel_estado = 'produccion'`.
- Baja del cliente (`DELETE …/activations?environment=PROD` y terminar la gestión): sigue siendo manual, ver `ALTA-CLIENTE-FACTURACION.md`.
- `PUT …/verifactu-configuration`: confirmado en el OpenAPI (23-oct-2026) que el único campo es `enabled` (obligatorio, reemplazo completo) y que exige el permiso `configuration:write`. En live sin representación validada devuelve `422 VERIFACTU_REPRESENTATION_REQUIRED`. La clave de test creada el 23-oct (`Portal web test`) **no** lleva `configuration:*` ni `nif:validate`: la clave live debe incluirlos (`beel-activar.ts` los necesita).
- Clientes SL (`entity_type: LEGAL_ENTITY`): para generar la representación BeeL exige la dirección completa del representante legal (`PROFILE_INCOMPLETE` con `error.details` si falta) y `beel-cuenta.ts` aún no envía `legal_representative`. Un `INDIVIDUAL` con `legal_form` o representante se rechaza. Probar primero con un autónomo (`INDIVIDUAL`); el flujo de SL queda por completar.
- `GET …/representation/document` devuelve `download_url` de vida corta y la representación pasa por `NOT_STARTED → PDF_GENERATED → ACTIVE`.
