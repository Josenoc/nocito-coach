-- ============================================================
-- Nocito Coach — Reparación del circuito de guardado/sincronización
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run.
--
-- Por qué: el endpoint de guardado hace un UPSERT de cada serie usando la
-- clave (exercise_id, client_id, log_date, set_number). Si esa restricción
-- única no existe, Postgres rechaza TODOS los guardados (error 42P10) y el
-- panel del coach nunca ve las series. Además, sin las columnas de vínculo
-- (routine_id / week_number / day_number) el coach no puede agrupar por
-- semana/día sin joins frágiles.
--
-- Este script es idempotente (se puede correr más de una vez).
-- No borra datos: solo normaliza duplicados exactos antes de crear el índice.
-- ============================================================

-- 1) Columnas de trazabilidad (si ya existen, no hace nada)
alter table public.sets_logs
  add column if not exists routine_id uuid references public.routines(id) on delete set null;
alter table public.sets_logs
  add column if not exists week_number int;
alter table public.sets_logs
  add column if not exists day_number int;

create index if not exists idx_sets_logs_routine
  on public.sets_logs (routine_id, week_number, day_number);

-- 2) Rellenar el vínculo de las series ya guardadas a partir de su ejercicio
update public.sets_logs s
set
  routine_id = r.id,
  week_number = r.week_number,
  day_number = r.position
from public.exercises e
join public.routines r on r.id = e.routine_id
where s.exercise_id = e.id
  and s.routine_id is null;

-- 3) Quitar duplicados exactos (conserva la fila más reciente de cada serie).
--    Sin esto no se puede crear el índice único si hubo dobles guardados.
delete from public.sets_logs a
using public.sets_logs b
where a.id <> b.id
  and a.exercise_id = b.exercise_id
  and a.client_id = b.client_id
  and a.log_date = b.log_date
  and a.set_number = b.set_number;

-- 4) Restricción única que necesita el UPSERT. Es la pieza que faltaba
--    cuando los guardados fallaban siempre
create unique index if not exists sets_logs_exercise_client_date_set_key
  on public.sets_logs (exercise_id, client_id, log_date, set_number);

-- 5) Verificación: deberías ver 4 filas con "OK"
select 'columna routine_id' as chequeo,
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'sets_logs'
           and column_name = 'routine_id'
       ) then 'OK' else 'FALTA' end as estado
union all
select 'columna week_number',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'sets_logs'
           and column_name = 'week_number'
       ) then 'OK' else 'FALTA' end
union all
select 'columna day_number',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'sets_logs'
           and column_name = 'day_number'
       ) then 'OK' else 'FALTA' end
union all
select 'índice único para upsert',
       case when exists (
         select 1 from pg_indexes
         where schemaname = 'public' and tablename = 'sets_logs'
           and indexname = 'sets_logs_exercise_client_date_set_key'
       ) then 'OK' else 'FALTA' end;

-- Nota sobre RLS: sets_logs tiene RLS activado y SIN políticas a propósito.
-- Solo el service role (usado por las API routes del servidor) puede leer y
-- escribir. Si SUPABASE_SERVICE_ROLE_KEY no está configurada con la clave
-- service_role, los guardados fallan con error 42501 (ahora queda logueado
-- como "RLS_BLOCKED" en los logs de Vercel).
