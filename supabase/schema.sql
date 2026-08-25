-- Ejecutar una vez en el SQL editor de Supabase (proyecto nuevo).
-- Guarda las respuestas del simulador de precio y genera un número de
-- presupuesto único y secuencial por año (CC-26-00001, CC-26-00002, ...).
--
-- Desde la incorporación del paso de email en el simulador, "email" y
-- "privacy_accepted_at" son opcionales: el visitante puede omitir ese paso
-- y ver su precio igualmente. Solo se guarda el correo si ha marcado la
-- casilla de aceptación de la Política de Privacidad — en ese caso,
-- privacy_accepted_at deja constancia de cuándo (principio de
-- responsabilidad proactiva del RGPD, art. 5.2).
--
-- "alta", "certificado", "actividad" y "fecha_inicio" solo se responden en
-- la rama del simulador para autónomos que todavía no están dados de alta
-- (ver Simulador.astro, branchSteps): certificado y actividad quedan NULL
-- para quien ya estaba de alta o es pyme, porque esas preguntas no se le
-- llegan a hacer.

create table if not exists quote_counters (
  year integer primary key,
  value integer not null default 0
);

-- presupuesto_enviado_at / recordatorio_enviado_at / respondido_at: soporte
-- para el workflow de n8n que envía el presupuesto por email al cliente (si
-- dejó su correo) y hace seguimiento. presupuesto_enviado_at se rellena al
-- mandar el email inicial; recordatorio_enviado_at, al mandar el recordatorio
-- si a los 5 días no hay respuesta. respondido_at la rellena automáticamente
-- otro flujo de n8n (lee la bandeja por IMAP y cruza el remitente con esta
-- tabla) en cuanto el cliente contesta — no hay marcado manual. Mientras
-- respondido_at sea null, el workflow de recordatorio sigue considerando el
-- presupuesto "sin respuesta". El recordatorio no usa threading real por
-- cabeceras (In-Reply-To/References) porque el nodo Send Email de n8n no
-- las expone — se manda con el mismo asunto prefijado "Re:", que Gmail
-- agrupa igualmente en el mismo hilo sin necesitar esas cabeceras.
create table if not exists presupuestos (
  id bigint generated always as identity primary key,
  quote_code text not null unique,
  regimen text not null,
  facturas text not null,
  reporting text not null,
  total numeric(10, 2) not null,
  alta text,
  certificado text,
  actividad text,
  fecha_inicio date,
  email text,
  privacy_accepted_at timestamptz,
  presupuesto_enviado_at timestamptz,
  recordatorio_enviado_at timestamptz,
  respondido_at timestamptz,
  created_at timestamptz not null default now()
);

-- Si la tabla ya existía de antes (proyecto ya en marcha), añade las
-- columnas nuevas sin tocar las filas existentes:
-- alter table presupuestos add column if not exists email text;
-- alter table presupuestos add column if not exists privacy_accepted_at timestamptz;
-- alter table presupuestos add column if not exists alta text;
-- alter table presupuestos add column if not exists certificado text;
-- alter table presupuestos add column if not exists actividad text;
-- alter table presupuestos add column if not exists fecha_inicio date;
-- alter table presupuestos add column if not exists presupuesto_enviado_at timestamptz;
-- alter table presupuestos add column if not exists recordatorio_enviado_at timestamptz;
-- alter table presupuestos add column if not exists respondido_at timestamptz;

-- Incremento atómico: aunque lleguen dos peticiones a la vez, cada una
-- recibe un número distinto (evita el problema de contar filas "a mano").
create or replace function next_quote_number(p_year integer)
returns integer
language sql
as $$
  insert into quote_counters (year, value) values (p_year, 1)
  on conflict (year) do update set value = quote_counters.value + 1
  returning value;
$$;

-- RLS: por defecto, activada y sin políticas (nadie puede leer/escribir
-- salvo con la service role key, que es la que usa nuestra función serverless
-- desde el servidor). No exponer nunca esa clave en el navegador.
alter table quote_counters enable row level security;
alter table presupuestos enable row level security;

-- ---------------------------------------------------------------------
-- Formulario "alta de autónomo": los datos que Edurne necesita para
-- tramitar el alta en Hacienda/Seguridad Social una vez el cliente ha
-- aceptado el presupuesto. Vive en una página suelta de la web (sin
-- enlazar desde el menú — se le manda el link directo al cliente tras la
-- llamada de venta), no en el simulador. Se guarda con la service role
-- key desde el endpoint del servidor, igual que "presupuestos" — RLS
-- activada y sin políticas, nadie puede leer/escribir esta tabla desde
-- el navegador.
--
-- quote_code enlaza con el presupuesto simulado si lo hubo, pero es
-- opcional: "si es solo alta no hace falta firma de presupuesto", así
-- que puede haber una fila de alta sin presupuesto previo.
--
-- privacy_accepted_at es obligatorio aquí (a diferencia de
-- presupuestos, donde el email es opcional y el consentimiento solo se
-- pide si lo hay): este formulario sí o sí recoge NIF, IBAN y
-- domicilio, así que el consentimiento RGPD no puede faltar en
-- ninguna fila.
--
-- Los campos de texto con valores cerrados (identificacion_digital,
-- tipo_local, regimen_cotizacion, retencion_irpf) no llevan CHECK en
-- SQL: se validan en el endpoint, igual que regimen/facturas/reporting
-- en presupuesto.ts — mismo criterio ya usado en este proyecto.
--
-- Las columnas *_at del bloque final (pago_confirmado_at,
-- cita_aeat_solicitada_at, apoderamiento_aeat_at,
-- apoderamiento_seg_soc_at) no las rellena el formulario: son checklist
-- del equipo, igual que facturas_subidas.fecha_contabilizado — se
-- marcan a mano en el Table Editor de Supabase mientras no haya
-- automatización, y quedan NULL hasta que se completa ese paso.
create table if not exists alta_nuevos_autonomos (
  id bigint generated always as identity primary key,
  quote_code text references presupuestos (quote_code),
  privacy_accepted_at timestamptz not null default now(),

  -- Identificación digital: si es 'ninguno', hay que pedirle cita AEAT
  -- (cita_aeat_solicitada_at, más abajo, trackea ese trámite).
  identificacion_digital text not null, -- 'certificado' | 'clave_pin' | 'ninguno'

  -- Datos básicos
  nombre_completo text not null,
  nif_nie text not null,
  email text not null,
  telefono text not null,
  domicilio_fiscal text not null,
  domicilio_notificaciones text, -- null = igual que domicilio_fiscal
  iban text not null,

  -- Datos de la actividad económica
  epigrafes_iae text not null, -- código(s) IAE si los conoce, o descripción libre de la actividad si no
  fecha_inicio_actividad date not null,
  tipo_local text not null, -- 'casa' | 'oficina' | 'sin_local'
  domicilio_local text, -- null si tipo_local = 'sin_local'
  multiples_locales boolean not null default false,
  detalle_locales_adicionales text, -- solo si multiples_locales = true
  profesion_colegiada boolean not null default false,
  regimen_cotizacion text, -- 'reta' | 'mutualidad', solo si profesion_colegiada = true

  -- Datos IVA
  operaciones_intracomunitarias boolean not null default false, -- para valorar alta en el ROI

  -- Datos IRPF
  retencion_irpf text not null default 'no_sabe', -- 'si' | 'no' | 'no_sabe'
  tendra_trabajadores boolean not null default false,

  -- Checklist del equipo (no lo rellena el formulario, ver comentario arriba)
  pago_confirmado_at timestamptz,
  cita_aeat_solicitada_at timestamptz,
  apoderamiento_aeat_at timestamptz,
  apoderamiento_seg_soc_at timestamptz,

  created_at timestamptz not null default now()
);

alter table alta_nuevos_autonomos enable row level security;

-- ---------------------------------------------------------------------
-- Formulario "traspaso desde otra gestoría" — para clientes que ya
-- estaban dados de alta en otro sitio y se cambian a nosotros. Se manda
-- manualmente (no automatizado) en cuanto el equipo da de alta al cliente,
-- momento en el que ya se sabe si es autónomo o SL — por eso son DOS
-- páginas (formulario-traspaso-autonomo y formulario-traspaso-sl, mismo
-- componente Astro con un prop `tipo`), pero UNA sola tabla: la columna
-- `tipo` ('autonomo' | 'sl') distingue el origen de cada fila, y las
-- columnas que solo aplican a un tipo quedan NULL en las filas del otro
-- en vez de crear dos tablas casi idénticas.
--
-- Columnas exclusivas de autónomo (NULL en filas tipo='sl', porque el
-- formulario de SL no las pregunta): fecha_alta_actividad,
-- epigrafes_iae_actuales, regimen_iva_actual, regimen_irpf_actual,
-- factura_con_retencion, porcentaje_retencion.
-- Columna exclusiva de SL: domicilio_social.
-- El resto de columnas son compartidas entre ambos tipos.
--
-- Los apartados "documentación a pedir a la gestoría anterior" y
-- "documentación a aportar por el cliente" del encargo original NO se
-- han convertido en columnas: son listas de qué reunir, no preguntas
-- con respuesta — este formulario no sube archivos (no se ha pedido esa
-- función), así que se muestran como texto informativo en la página y el
-- equipo gestiona la recogida real de esos documentos por email/Drive.
-- Por el mismo motivo, "revocar el apoderamiento anterior" y "apoderarnos
-- en AEAT/Seg. Social" tampoco son checkboxes que rellene el cliente
-- (no hay forma de verificar desde el formulario si los ha hecho): son
-- trámites que se explican como recordatorio en la página, igual que en
-- alta_nuevos_autonomos, y el equipo marca su fecha a mano cuando los
-- confirma (columnas *_at del bloque final).
create table if not exists traspasos_nuevos (
  id bigint generated always as identity primary key,
  tipo text not null, -- 'autonomo' | 'sl'
  privacy_accepted_at timestamptz not null default now(),

  -- Igual que en alta_nuevos_autonomos: si es 'ninguno', hay que
  -- gestionarle cita AEAT o renovación (cita_aeat_solicitada_at más abajo).
  identificacion_digital text not null, -- 'certificado' | 'clave_pin' | 'ninguno'

  -- Datos básicos. nombre_razon_social y nif_cif están unificados a
  -- propósito (en vez de columnas separadas "nombre_completo"/"nif_nie"
  -- para autónomo y "razon_social"/"cif" para SL): son el mismo dato de
  -- negocio bajo dos etiquetas distintas según el tipo, así que una sola
  -- columna evita duplicar el campo por tipo — el formulario decide qué
  -- etiqueta mostrar según el prop `tipo`.
  nombre_razon_social text not null,
  nif_cif text not null,
  email text not null,
  telefono text not null,
  domicilio_fiscal text not null,
  domicilio_social text, -- solo SL: domicilio social si es distinto del fiscal
  domicilio_notificaciones text, -- null = igual que domicilio fiscal
  iban text not null, -- para el cobro de honorarios

  -- Situación fiscal actual (autónomo): el cliente informa lo que ya
  -- tiene, no elige nada nuevo — ver comentario arriba sobre columnas
  -- exclusivas de autónomo.
  fecha_alta_actividad date,
  epigrafes_iae_actuales text,
  regimen_iva_actual text, -- 'general' | 'recargo_equivalencia' | 'simplificado' | 'exento' | otro (texto libre)
  regimen_irpf_actual text, -- 'directa_normal' | 'directa_simplificada' | 'modulos'
  factura_con_retencion boolean not null default false,
  porcentaje_retencion numeric(5, 2), -- solo si factura_con_retencion = true

  -- Situación fiscal actual (compartida autónomo/SL)
  tiene_trabajadores boolean not null default false,
  numero_trabajadores integer, -- solo si tiene_trabajadores = true
  operaciones_intracomunitarias boolean not null default false,

  -- Continuidad con la gestoría anterior (compartida)
  tiene_requerimientos_aeat boolean not null default false,
  detalle_requerimientos_aeat text, -- solo si tiene_requerimientos_aeat = true
  contacto_gestoria_anterior text not null, -- para poder reclamarle documentación
  autoriza_solicitar_historico boolean not null default false, -- consentimiento para pedir el histórico a la gestoría anterior en su nombre

  -- Checklist del equipo (no lo rellena el formulario, ver comentario arriba)
  revocacion_apoderamiento_anterior_at timestamptz,
  apoderamiento_aeat_at timestamptz,
  apoderamiento_seg_soc_at timestamptz,
  cita_aeat_solicitada_at timestamptz,

  created_at timestamptz not null default now()
);

alter table traspasos_nuevos enable row level security;

-- ---------------------------------------------------------------------
-- Portal de clientes (reporting/dashboards, fase 2 del roadmap).
-- Cada cliente inicia sesión con enlace mágico por email (Supabase Auth,
-- ya incluido en el proyecto, no requiere activación aparte). El alta de
-- cada fila la hace el equipo (con la service role key) cuando se
-- incorpora un cliente nuevo — el cliente no puede crearse ni editarse a
-- sí mismo, y solo un email ya dado de alta aquí puede llegar a tener
-- cuenta de Auth (ver api/portal-login.ts: el endpoint de login rechaza
-- silenciosamente cualquier email que no esté en esta tabla, así nadie
-- ajeno puede generarse una cuenta escribiendo un email cualquiera).
--
-- "id" es un identificador propio, generado al dar de alta, independiente
-- de Auth: así se puede crear la fila del cliente (con solo su email) sin
-- esperar a que inicie sesión por primera vez. "auth_user_id" empieza
-- vacío y se rellena solo — vía trigger, ver más abajo — la primera vez
-- que ese email inicia sesión. La política RLS usa auth_user_id, no id.
--
-- Pendiente de definir con la socia: la tabla (o tablas) con los datos
-- financieros reales que verá cada cliente (facturación, gastos,
-- beneficio, periodo...). Cuando exista, debe llevar una columna
-- cliente_id references clientes(id) y su propia política RLS igual
-- que la de abajo (using (auth.uid() = (select auth_user_id from clientes where id = cliente_id))).
-- "tipo_persona" ('autonomo' | 'sl') decide, en el panel de Documentación
-- del portal, qué PDF de presentación de servicios genérica le corresponde
-- a cada cliente (ver Portal.astro; no confundir con el presupuesto
-- individual ya firmado, que se envía por otra vía). Igual que "reporting", lo rellena el equipo
-- a mano al dar de alta al cliente. Esta columna ya existía en el
-- proyecto de Supabase en marcha antes de este cambio (se añade aquí solo
-- para que el "create table if not exists" reproduzca el esquema real si
-- se recrea la base desde cero); queda NULL para clientes sin ese dato
-- marcado, y el portal muestra un aviso en vez de un enlace mientras tanto.
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  nombre text not null,
  empresa text,
  email text,
  reporting boolean not null default false,
  tipo_persona text,
  created_at timestamptz not null default now()
);

-- Emails duplicados (con distinta mayúscula/minúscula incluida) romperían
-- el vínculo automático de abajo, porque no sabríamos a qué fila enlazar.
create unique index if not exists clientes_email_lower_idx on clientes (lower(email));

-- alta_hecha: para la automatización de onboarding de n8n (trigger AFTER
-- INSERT en esta tabla -> webhook cliente-nuevo). Solo aplica a
-- tipo_persona = 'autonomo' (columna ya existente, ver más arriba) —
-- para 'sl' se ignora y queda NULL sin que eso sea un error.
--
-- Interpretación que usa el workflow de n8n:
--   tipo_persona NULL                     -> falta por rellenar (incompleto)
--   tipo_persona = 'autonomo', alta_hecha NULL  -> falta por rellenar (incompleto)
--   tipo_persona = 'autonomo', alta_hecha true  -> necesita alta (la tramitamos nosotros)
--   tipo_persona = 'autonomo', alta_hecha false -> ya estaba dado de alta (traspaso)
--   tipo_persona = 'sl'                   -> SL (alta_hecha no aplica, se ignora)
alter table clientes add column if not exists alta_hecha boolean;

alter table clientes enable row level security;

-- Un cliente autenticado solo puede leer su propia fila, nunca las de
-- otros. No hay política de insert/update/delete: esas operaciones solo
-- las puede hacer el equipo con la service role key.
create policy "clientes ven su propia fila"
  on clientes for select
  using (auth.uid() = auth_user_id);

-- Vínculo automático: en cuanto Supabase Auth crea la cuenta de un email
-- que ya estaba dado de alta (fila en clientes con auth_user_id todavía
-- vacío), esta función lo rellena sola. Corre con permisos elevados
-- (security definer) pero solo toca esta tabla y solo cuando el email
-- coincide — no expone la service role key en ningún sitio.
create or replace function public.vincular_cliente_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clientes
  set auth_user_id = new.id
  where lower(email) = lower(new.email) and auth_user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.vincular_cliente_nuevo();

-- ---------------------------------------------------------------------
-- MIGRACIÓN para el proyecto de Supabase ya en marcha (la tabla clientes
-- ya existía con id referenciando auth.users directamente, y ya tenía
-- columnas email/reporting añadidas a mano). Ejecutar UNA VEZ, después
-- de lo de arriba (el "create table if not exists" no toca una tabla que
-- ya existe, así que esto añade lo que falta):
--
-- alter table clientes add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;
-- update clientes set auth_user_id = id where auth_user_id is null;
-- alter table clientes drop constraint if exists clientes_id_fkey;
-- alter table clientes alter column id set default gen_random_uuid();
-- create unique index if not exists clientes_email_lower_idx on clientes (lower(email));
-- drop policy if exists "clientes ven su propia fila" on clientes;
-- create policy "clientes ven su propia fila"
--   on clientes for select
--   using (auth.uid() = auth_user_id);
--
-- "tipo_persona" ya existía en el proyecto de Supabase en marcha antes del
-- panel de Documentación del portal (ver Portal.astro) — no hace falta
-- ningún alter table para esto, solo rellenarla por cliente si algún
-- cliente todavía la tiene NULL:
-- update clientes set tipo_persona = 'autonomo' where id = '...'; -- (o 'sl')

-- Si ya habéis ejecutado el bloque de facturas_subidas de más abajo (antes
-- de este cambio), sus políticas también asumían cliente_id = auth.uid()
-- directamente — hay que corregirlas también, en este mismo momento:
--
-- drop policy if exists "cliente ve sus facturas subidas" on facturas_subidas;
-- create policy "cliente ve sus facturas subidas"
--   on facturas_subidas for select
--   using (cliente_id in (select id from clientes where auth_user_id = auth.uid()));
--
-- drop policy if exists "cliente registra su propia subida" on facturas_subidas;
-- create policy "cliente registra su propia subida"
--   on facturas_subidas for insert
--   with check (
--     fecha_contabilizado is null
--     and cliente_id in (select id from clientes where auth_user_id = auth.uid())
--   );

-- ---------------------------------------------------------------------
-- Storage: bucket "facturas" (subida de facturas desde el portal).
-- Cada archivo se guarda en la ruta `${auth.uid()}/archivo.pdf` (ver
-- Portal.astro), así que las políticas de storage.objects restringen a
-- cada cliente a su propia carpeta — nadie puede listar ni subir en la
-- carpeta de otro cliente. Ya están creadas en el dashboard de Supabase
-- (Storage → Policies), se documentan aquí solo como referencia; si el
-- bucket se recrea desde cero, hay que volver a crearlas a mano:
--
-- create policy "facturas listar carpeta propia"
--   on storage.objects for select
--   to authenticated
--   using (bucket_id = 'facturas' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "facturas subir en carpeta propia"
--   on storage.objects for insert
--   to authenticated
--   with check (bucket_id = 'facturas' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Registro de facturas subidas (metadatos, independiente del Storage).
--
-- Por qué existe: la automatización (Bloque 4 de PENDIENTES-WEB.txt) baja
-- cada factura del Storage a Drive compartido y, pasados unos días de
-- margen (pensado 7, por si falla la sincronización o el cliente necesita
-- recuperarla), borra el archivo del Storage para ahorrar espacio. Si el
-- portal siguiera listando directo desde storage.objects (como hacía
-- antes), el cliente perdería el registro de lo que subió en cuanto se
-- borrara el archivo. Esta tabla guarda ese registro aparte, para siempre.
--
-- fecha_contabilizado se rellena cuando el equipo confirma que la factura
-- ya está bajada a Drive (a mano en el Table Editor de Supabase, mientras
-- no exista la automatización; luego lo hará ella misma). No tiene por
-- qué coincidir con el borrado del Storage: "contabilizada" = ya está en
-- Drive; storage_path a null = ya se borró del Storage. Son dos pasos
-- independientes.
create table if not exists facturas_subidas (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references clientes (id) on delete cascade,
  nombre_archivo text not null,
  storage_path text,
  fecha_subida timestamptz not null default now(),
  fecha_contabilizado timestamptz
);

alter table facturas_subidas enable row level security;

-- cliente_id apunta al id propio de clientes (no a auth.uid() directamente
-- — ver el bloque de más arriba sobre clientes.auth_user_id), así que la
-- comprobación pasa por la fila de clientes vinculada a la sesión actual.
create policy "cliente ve sus facturas subidas"
  on facturas_subidas for select
  using (cliente_id in (select id from clientes where auth_user_id = auth.uid()));

-- Un cliente solo puede crear una fila propia, y solo como "pendiente"
-- (no puede marcarse a sí mismo como contabilizada). No hay política de
-- update ni delete para clientes: fecha_contabilizado y storage_path los
-- toca solo el equipo (service role) o, en el futuro, la automatización.
create policy "cliente registra su propia subida"
  on facturas_subidas for insert
  with check (
    fecha_contabilizado is null
    and cliente_id in (select id from clientes where auth_user_id = auth.uid())
  );
