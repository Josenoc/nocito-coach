-- Nocito Coach — Cola de notificaciones push.
-- Los avisos al coach y al alumno se guardan acá al cargar una serie y los
-- envía el cron /api/cron/push-triggers. Ejecutar una vez en el SQL Editor.

create table if not exists public.push_queue (
  id bigint generated always as identity primary key,
  target text not null check (target in ('coach', 'client')),
  client_id text,
  title text not null,
  body text not null,
  url text,
  tag text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists push_queue_pending_idx
  on public.push_queue (created_at)
  where sent_at is null;

-- Sin políticas: solo el service role (servidor) puede leer o escribir.
alter table public.push_queue enable row level security;
