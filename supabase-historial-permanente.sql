-- Migracion: historial permanente de entrenamientos (sets_logs)
-- Asegura retencion indefinida y consultas cronologicas para progresion.

-- Indice para consultas de progresion por cliente y fecha (cronologico).
create index if not exists idx_sets_logs_client_date
  on public.sets_logs (client_id, log_date asc, set_number asc);

-- Indice para consultas por ejercicio y fecha.
create index if not exists idx_sets_logs_exercise_date
  on public.sets_logs (exercise_id, log_date asc, set_number asc);

-- Asegurar que exercise_name se conserve (historial inmutable).
alter table public.sets_logs
  add column if not exists exercise_name text;

-- Sin TTL ni limpieza automatica: los datos se retienen de forma permanente.
-- (No hay cron ni policy que borre registros; solo el coach puede borrar un cliente.)
```