-- Migracion: dias de entrenamiento por rutina (para notificaciones push)
alter table public.routines
  add column if not exists training_day_of_week int; -- 0=Dom,1=Lun,...,6=Sab. NULL = sin programar (envia todos los dias).

create index if not exists idx_routines_client_day on public.routines(client_id, training_day_of_week);
```