-- ============================================================
-- Nocito Coach - Nombre de usuario del cliente (login rápido)
-- Ejecutar en Supabase -> SQL Editor -> New query -> Run
-- Agrega a profiles el nombre de usuario único para el login.
-- ============================================================

alter table public.profiles add column if not exists username text;

-- Índice único case-insensitive (ignora NULLs de coach/migrados).
create unique index if not exists idx_profiles_username_lower
  on public.profiles (lower(username))
  where username is not null;

-- El login acepta email O username + PIN de 4 dígitos.
-- El username se guarda en minúsculas; 3 a 20 caracteres [a-z0-9_].
