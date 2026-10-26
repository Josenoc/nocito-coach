-- ============================================================
-- Nocito Coach - Historial permanente de series (sets_logs)
-- Ejecutar UNA vez en Supabase  SQL Editor  New query  Run.
--
-- Qué hace:
--  1) Guarda el nombre del ejercicio en cada serie (exercise_name), para que
--     el historial se lea aunque el ejercicio se edite o se quite de la rutina.
--  2) Si se borra un ejercicio de una rutina, sus series NO se borran:
--     exercise_id queda en null (antes se borraban en cascada).
--
-- Idempotente. No borra ningún dato.
-- ============================================================

alter table public.sets_logs
  add column if not exists exercise_name text;

alter table public.sets_logs
  alter column exercise_id drop not null;

alter table public.sets_logs
  drop constraint if exists sets_logs_exercise_id_fkey;

alter table public.sets_logs
  add constraint sets_logs_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id) on delete set null;

-- Backfill: completar el nombre de las series ya guardadas.
update public.sets_logs sl
set exercise_name = e.name
from public.exercises e
where sl.exercise_id = e.id
  and sl.exercise_name is null;
