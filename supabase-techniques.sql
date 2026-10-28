-- Migracion: tecnicas avanzadas de intensidad (superset, drop_set, rest_pause)
alter table public.exercises
  add column if not exists technique_type text default 'normal';

-- sets_logs: soporte de caidas para drop sets (JSON array de {reps, weight})
alter table public.sets_logs
  add column if not exists drops jsonb;

create index if not exists idx_exercises_technique on public.exercises(technique_type);
```