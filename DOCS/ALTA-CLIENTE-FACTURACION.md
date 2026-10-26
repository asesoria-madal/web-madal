# Procedimiento de alta de un cliente con facturación (BeeL)

Pasos que hay que seguir cuando un cliente de la asesoría contrata el uso del emisor de facturas del portal. Complementa `BEEL.md` (que explica el porqué y los detalles de la API). El orden importa: **no se activa el NIF en producción hasta tener la representación firmada**, porque desde ese momento cuesta 12 €/mes.

Supuestos:
- El cliente ya está dado de alta en la asesoría y tiene usuario en el portal (`clientes.auth_user_id`).
- Modelo de cuentas gestionadas de BeeL (ver `BEEL.md`, sección 2).
- Quién lo hace: la persona de la asesoría que gestiona el alta; el cliente solo interviene en los pasos marcados como "cliente".

## Atajo: alta automatizada desde el portal (2026-10-22)

Las fases 2 a 4 de abajo se hacen ahora desde el portal en modo administrador, panel «Facturación BeeL» del cliente (no hace falta tocar la API a mano). Pasos: (1) marcar «Contrata la facturación» al crear al cliente; (2) con su NIF real, el nombre fiscal **tal como figura en su DNI o en el censo** (con otro nombre BeeL contesta `NIF_VALIDATION_INVALID`) y la dirección fiscal con el **número aparte** («s/n» si no tiene), pulsar «Crear cuenta y generar representación» (se le envía solo el documento); si BeeL pide completar la dirección (`PROFILE_INCOMPLETE`), el panel la vuelve a mostrar: rellenarla entera y pulsar «Generar de nuevo el documento y enviárselo al cliente», que también sirve para reenviarlo; (3) cuando devuelva el PDF firmado, subirlo y pulsar «Subir y activar en producción» (cuenta 12 €/mes desde ahí). No hace falta que el cliente esté dado de alta como autónomo para crear la cuenta en pruebas. Detalle técnico y limitaciones: `BEEL.md` §11. Lo que sigue describe lo mismo paso a paso, útil si algo falla y hay que hacerlo a mano.

## Fase 0. Decisión comercial (antes de empezar)
1. Confirmar con el cliente que quiere emitir facturas desde el portal y cómo se le cobra (importe aparte, según decisión de los socios; Edurne decide si algún plan lo incluye).
2. Explicarle que necesita **certificado electrónico de persona física** para firmar la representación una sola vez. Si no lo tiene, ver Fase 1.

## Fase 1. Certificado electrónico del cliente (cliente)
1. Si no tiene certificado: solicitar el de **persona física de la FNMT** (gratuito). Acreditación de identidad en oficina, con DNI electrónico, o por videoidentificación desde la app/web de la FNMT (tiene un pequeño coste).
2. Este trámite lo hace el propio cliente; la asesoría le acompaña. Mientras tanto, seguir con la Fase 2 en **test** (sin coste).
3. Cl@ve **no** sirve y la asesoría **no** puede firmar como apoderada.

## Fase 2. Preparar datos y crear la cuenta gestionada (asesoría)
1. Reunir: NIF, nombre o razón social exactos (los del DNI o el censo), dirección fiscal completa con el número de la calle aparte (obligatorio para generar la representación), email del cliente.
2. Comprobar que el NIF existe en el censo de la AEAT con `POST /v1/nif/validate`. Un NIF no censado devuelve `422 NIF_VALIDATION_INVALID` y la cuenta no se crea.
3. Crear la cuenta gestionada (`POST /v1/accounts`) con nivel de acceso **`OPERATE`** y `external_ref` = id del cliente en Supabase. (Lo hace el panel de admin, ver el atajo de arriba; a mano solo si el panel falla.)
4. Guardar `account_id` y `company_id` en la ficha del cliente (`clientes.beel_company_id`).
5. En este punto el NIF está en **test**: puede emitir facturas de prueba, sin efecto fiscal ni coste. No activar PROD todavía.

> Orden y comprobaciones que indica BeeL (26-oct-2026): activar PROD → generar, firmar y subir la representación con la clave live → comprobar que `GET …/representation` da `ACTIVE` y que `issuing-readiness` da `ready` **y** `verifactu.ready`. El portal sube la representación antes de activar (para no pagar el NIF si el PDF no vale) y está preguntado a BeeL si ese orden vale. Antes de la primera activación, comprobar que la cuenta de BeeL tiene tarjeta registrada (si no, `402 CHECKOUT_REQUIRED`) y que no salta `422 ACCOUNT_HAS_NO_HOLDER` (nuestras cuentas no tienen email de titular). Ver `BEEL.md` §7.

## Fase 3. Representación Verifactu (asesoría + cliente)
1. Generar el documento de representación (`POST …/representation`) y descargarlo.
2. Enviarlo al cliente para que lo **firme electrónicamente con su certificado** (el PDF debe llevar firma válida).
3. Recibir el PDF firmado y subirlo (`…/representation/submit`) con la **clave live**. Si el PDF no lleva firma válida, BeeL responde `PDF_SIGNATURE_INVALID`.
4. Comprobar con `GET …/representation` que consta como firmada (en producción llega también el webhook `representation.signed`).

## Fase 4. Activación en producción (asesoría)
1. Activar el NIF en producción: `POST /v1/companies/{company_id}/activations` con `environment: "PROD"`. **Desde aquí empieza a contar el NIF (12 €/mes)**, emita o no.
2. Activar Veri*Factu: `PUT …/verifactu-configuration` con `enabled: true`.
3. Comprobar `GET …/issuing-readiness`: deben estar a `true` tanto `ready` (el NIF puede emitir) como `verifactu.ready` (sus facturas pasarán el registro en la AEAT). Y `GET …/representation` debe dar `ACTIVE`.
4. Dejar anotado en la ficha del cliente la fecha de activación (para la repercusión del coste).

## Fase 5. Primera factura y entrega al cliente
1. Pedir al cliente que emita desde el portal (panel "Emitir facturas") una primera factura real, o hacerlo con él.
2. Comprobar que el estado Verifactu pasa a `ACCEPTED` (lo actualiza el webhook). Si pasa a `REJECTED`, llega aviso por n8n al correo de la asesoría; una factura emitida no se edita, se corrige con una rectificativa.
3. Recordar al cliente: el PDF y el email son los de BeeL; no debe renderizar su propio PDF.

## Baja del cliente
1. Dejar de pagar el NIF: `DELETE …/activations?environment=PROD`. La baja se programa al final del ciclo en curso (ese ciclo se cobra entero y puede facturar hasta entonces).
2. Si el cliente se va definitivamente de la asesoría: terminar la gestión con `DELETE /v1/accounts/{account_id}/management` (clave live). Perdemos acceso al momento; el cliente conserva cuenta, NIF y facturas.
3. Antes de terminar la gestión, ofrecer al cliente la exportación de sus datos (Excel de facturas hasta 50.000, ZIP de PDF hasta 500 por exportación).
4. Los registros los conserva BeeL 6 años tras la baja.

## Checklist rápido
- [ ] Cliente informado del coste y del certificado necesario
- [ ] Certificado electrónico del cliente disponible
- [ ] NIF validado (`/v1/nif/validate`)
- [ ] Cuenta gestionada creada con `OPERATE`; `account_id`/`company_id` guardados
- [ ] Representación firmada y subida (clave live)
- [ ] NIF activado en PROD y Veri*Factu activado
- [ ] `issuing-readiness` con `ready` y `verifactu.ready`; representación `ACTIVE`
- [ ] Primera factura aceptada por la AEAT
