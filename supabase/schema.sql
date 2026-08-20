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
-- ya incluido en el proyecto, no requiere activación aparte). Esta tabla
-- enlaza esa cuenta de login con los datos del cliente. El alta de cada
-- fila la hace el equipo (con la service role key) cuando se incorpora
-- un cliente nuevo — el cliente no puede crearse ni editarse a sí mismo.
--
-- Pendiente de definir con la socia: la tabla (o tablas) con los datos
-- financieros reales que verá cada cliente (facturación, gastos,
-- beneficio, periodo...). Cuando exista, debe llevar una columna
-- cliente_id references clientes(id) y su propia política RLS igual
-- que la de abajo (using (auth.uid() = cliente_id)).
create table if not exists clientes (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  empresa text,
  created_at timestamptz not null default now()
);

alter table clientes enable row level security;

-- Un cliente autenticado solo puede leer su propia fila, nunca las de
-- otros. No hay política de insert/update/delete: esas operaciones solo
-- las puede hacer el equipo con la service role key.
create policy "clientes ven su propia fila"
  on clientes for select
  using (auth.uid() = id);

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
