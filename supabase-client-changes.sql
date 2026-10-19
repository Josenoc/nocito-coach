-- Historial de cambios del perfil de clientes (auditoría del panel del coach).
-- Idempotente: se puede correr varias veces sin romper nada.
--
-- Ejecutar en el SQL Editor de Supabase.

create table if not exists public.client_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  field text not null,
  field_label text,
  old_value text,
  new_value text,
  changed_by text,
  created_at timestamptz not null default now()
);

create index if not exists client_changes_client_idx
  on public.client_changes (client_id, created_at desc);
