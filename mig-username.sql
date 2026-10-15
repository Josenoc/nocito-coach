-- Agrega username unico a profiles
alter table public.profiles add column if not exists username text;
create unique index if not exists idx_profiles_username_lower on public.profiles (lower(username)) where username is not null;
-- login: email O username + PIN 4 digitos; username 3-20 [a-z0-9_] minusculas