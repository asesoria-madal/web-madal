-- Retirada del simulador de precio (decisión del 2026-10-23).
--
-- NO se ejecuta solo: es IRREVERSIBLE y borra datos personales de leads (emails y
-- respuestas del simulador). Ejecutar a mano en el SQL Editor de Supabase, y solo
-- cuando (1) la web ya esté desplegada sin /simulador ni api/presupuesto, y (2) los
-- workflows de n8n nuevo_presupuesto, recordatorio-presupuesto y detectar_respuesta_presu
-- estén DESACTIVADOS (si siguen activos fallarían contra una tabla que ya no existe).
--
-- Antes: si quieres conservar los leads, exporta presupuestos a CSV
-- (Table Editor > presupuestos > Export).
--
-- Qué NO se toca: `clientes` (los clientes con id PENDIENTE-... creados por el camino B
-- siguen existiendo; revisarlos a mano) ni `alta_nuevos_autonomos` / `traspasos_nuevos`.

-- Borrar la tabla elimina también su trigger hacia n8n (webhook new_presupuesto) y su RLS.
drop table if exists presupuestos cascade;

-- Contador de números de presupuesto (CC-26-00001...) y su función: solo los usaba el simulador.
drop function if exists next_quote_number(integer);
drop table if exists quote_counters;

-- Comprobación: no debe quedar ninguna fila.
select count(*) as tablas_que_quedan
from information_schema.tables
where table_schema = 'public' and table_name in ('presupuestos', 'quote_counters');
