-- Migracion: tecnicas avanzadas de intensidad (superset, drop_set, rest_pause)
alter table public.exercises
  add column if not exists technique_type text default 'normal';

-- sets_logs: soporte de caidas para drop sets (JSON array de {reps, weight})
alter table public.sets_logs
  add column if not exists drops jsonb;

-- sets_logs: segundos de pausa corta para rest-pause
alter table public.sets_logs
  add column if not exists rest_pause_seconds int;

-- sets_logs: tipo de serie (normal, warmup, drop_set, rest_pause)
alter table public.sets_logs
  add column if not exists series_type text default 'normal';

create index if not exists idx_exercises_technique on public.exercises(technique_type);
```