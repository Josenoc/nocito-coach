-- Migracion: trial de 30 dias para nuevos y existentes
alter table public.profiles
  add column if not exists trial_ends_at timestamptz,
  add column if not exists plan text default 'trial';

-- Existentes: trial_ends_at = created_at + 30 dias (si no tenian plan pago)
update public.profiles
set trial_ends_at = coalesce(created_at, now()) + interval '30 days',
    plan = coalesce(plan, 'trial')
where trial_ends_at is null;

create index if not exists idx_profiles_trial_ends on public.profiles(trial_ends_at);
```