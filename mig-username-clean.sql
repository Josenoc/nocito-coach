-- Agrega username único a profiles
alter table public.profiles add column if not exists username text;
create unique index if not exists idx_profiles_username_lower on public.profiles (lower(username)) where username is not null;