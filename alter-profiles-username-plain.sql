-- ============================================================
-- Agrega username único a profiles
-- Ejecutar en Supabase SQL Editor
-- ============================================================

alter table public.profiles add column if not exists username text;

create unique index if not exists idx_profiles_username_lower
  on public.profiles (lower(username))
  where username is not null;

-- login: email O username + PIN 4 dígitos; username 3-20 [a-z0-9_] minúsculas