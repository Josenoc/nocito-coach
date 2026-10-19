-- ============================================================
-- Nocito Coach - Vínculo explícito de sets_logs con la rutina
-- Ejecutar en Supabase -> SQL Editor -> New query -> Run
-- Idempotente y SIN bloques PL/pgSQL (nada de `do $$`).
--
-- Añade a public.sets_logs la trazabilidad directa con la rutina
-- (routine_id), la semana (week_number) y el día (day_number) a la
-- que pertenece cada serie registrada por el alumno. Así el panel
-- del coach puede reconstruir el histórico semana por semana / día
-- por día sin depender de joins frágiles, y las semanas pasadas
-- quedan inmutables y transparentes para la revisión de rendimiento.
--
-- La app funciona igual si esta migración aún no se ejecutó: el
-- endpoint de guardado escribe estos campos de forma defensiva
-- (si las columnas no existen, guarda sin ellas).
-- ============================================================

alter table public.sets_logs
  add column if not exists routine_id uuid references public.routines(id) on delete set null;
alter table public.sets_logs
  add column if not exists week_number int;
alter table public.sets_logs
  add column if not exists day_number int;

-- Backfill: cada log hereda la rutina del ejercicio, y de ahí la
-- semana y la posición (día) dentro de la semana.
update public.sets_logs sl
set
  routine_id = ex.routine_id,
  week_number = ru.week_number,
  day_number = ru.position
from public.exercises ex
join public.routines ru on ru.id = ex.routine_id
where sl.exercise_id = ex.id
  and (sl.routine_id is null or sl.week_number is null or sl.day_number is null);

-- Índices para la navegación del coach (cliente + rutina / semana).
create index if not exists idx_sets_routine
  on public.sets_logs (routine_id);
create index if not exists idx_sets_client_week
  on public.sets_logs (client_id, week_number, day_number);

-- ============================================================
-- Verificación rápida
-- ============================================================
-- select week_number, day_number, count(*)
--   from public.sets_logs group by 1, 2 order by 1, 2;
