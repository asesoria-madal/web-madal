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
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  nombre text not null,
  empresa text,
  email text,
  reporting boolean not null default false,
  created_at timestamptz not null default now()
);

-- Emails duplicados (con distinta mayúscula/minúscula incluida) romperían
-- el vínculo automático de abajo, porque no sabríamos a qué fila enlazar.
create unique index if not exists clientes_email_lower_idx on clientes (lower(email));

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
