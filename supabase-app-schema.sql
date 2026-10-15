-- ============================================================
-- Nocito Coach - Web App privada (nocito.coach/app)
-- Ejecutar en Supabase -> SQL Editor -> New query -> Run
-- Esquema idempotente y SIN bloques PL/pgSQL (nada de `do $$`),
-- para que el editor de Supabase no rompa el dollar-quoting.
-- Migra los datos existentes (alumnos / rutinas /
-- ejercicios_asignados / registros_progreso).
-- ============================================================

-- NOTA: la tabla legacy public.routines (columnas ref, payload,
-- vacía y sin uso) ya fue renombrada a public.routines_legacy
-- para liberar el nombre `routines`.

-- ------------------------------------------------------------
-- 1) PERFILES (clientes y coach)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'client' check (role in ('client', 'coach')),
  full_name text not null default '',
  pin_hash text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2) RUTINAS (una fila = un día de entrenamiento de una semana)
-- ------------------------------------------------------------
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Rutina',
  day_name text not null default '',
  week_number int not null default 1,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_routines_client
  on public.routines (client_id, active, week_number desc, position);

-- ------------------------------------------------------------
-- 3) EJERCICIOS
-- ------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  name text not null,
  video_url text,
  technique_notes text,
  order_index int not null default 0,
  target_sets int default 3,
  target_reps int default 10,
  target_weight numeric,
  unit text not null default 'kg' check (unit in ('kg', 'lbs')),
  created_at timestamptz not null default now()
);
create index if not exists idx_exercises_routine
  on public.exercises (routine_id, order_index);

-- ------------------------------------------------------------
-- 4) SERIES REGISTRADAS (sets_logs)
-- ------------------------------------------------------------
create table if not exists public.sets_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  set_number int not null,
  target_reps int,
  target_weight numeric,
  actual_reps int,
  actual_weight numeric,
  phantom_reference_10_percent numeric,
  log_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (exercise_id, client_id, log_date, set_number)
);
create index if not exists idx_sets_client_date
  on public.sets_logs (client_id, log_date desc);

-- ------------------------------------------------------------
-- 5) REPORTES DE AUDIO (notas de voz)
-- ------------------------------------------------------------
create table if not exists public.audio_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  audio_storage_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_audio_client
  on public.audio_reports (client_id, created_at desc);

-- ============================================================
-- SEED / MIGRACIÓN (SQL puro, sin PL/pgSQL)
-- ============================================================

-- Coach (José). PIN por defecto: 7319  -> CAMBIARLO.
insert into public.profiles (email, role, full_name, pin_hash)
values (
  'nocito.coach@gmail.com',
  'coach',
  'José Nocito',
  'scrypt$e92585b85c1df7a280014e4baae9f82c$9f3044ed8828a66683747a9624a2183017e4dd3bb2c71daa44041bd42c782e3b889ab8550dc4c5d73f01ce9ad48e6b58aa1ea33fda95d9f969e1decfb1476de7'
)
on conflict (email) do nothing;

-- Migrar alumnos existentes -> profiles (clientes).
-- PIN por defecto para migrados: 1234  -> el coach lo cambia desde el panel.
insert into public.profiles (email, role, full_name, pin_hash)
select
  lower(a.email),
  'client',
  a.nombre,
  'scrypt$8acdb6c4a029b43fd2705c3f892adc34$26a8dcb8ed669047e1629789f2ac7977f9f8f305990c91d94c1bdf93def446e97fe7eaa3c6f1c8d48fe5d37b539f7868fb63fa276bc499357a56d30f20624078'
from public.alumnos a
on conflict (email) do nothing;

-- Migrar rutinas -> routines.
insert into public.routines (client_id, name, day_name, week_number, active)
select p.id, ru.nombre, '', 1, coalesce(ru.activa, true)
from public.rutinas ru
join public.alumnos a on a.id = ru.alumno_id
join public.profiles p on lower(p.email) = lower(a.email)
where not exists (
  select 1 from public.routines nr
  where nr.client_id = p.id and nr.name = ru.nombre
);

-- Migrar ejercicios_asignados -> exercises.
insert into public.exercises (
  routine_id, name, order_index, target_sets, target_reps, target_weight, unit
)
select
  nr.id,
  ea.nombre,
  coalesce(ea.orden, 0),
  coalesce(ea.series_default, 3),
  coalesce(ea.reps_default, 10),
  ea.peso_default,
  coalesce(ea.unidad_peso, 'kg')
from public.ejercicios_asignados ea
join public.rutinas ru on ru.id = ea.rutina_id
join public.alumnos a on a.id = ru.alumno_id
join public.profiles p on lower(p.email) = lower(a.email)
join public.routines nr on nr.client_id = p.id and nr.name = ru.nombre
where not exists (
  select 1 from public.exercises ex
  where ex.routine_id = nr.id and lower(ex.name) = lower(ea.nombre)
);

-- Migrar registros_progreso -> sets_logs (solo si matchea el ejercicio).
insert into public.sets_logs (
  exercise_id, client_id, set_number, actual_reps, actual_weight,
  target_reps, target_weight, log_date
)
select
  ex.id, p.id, 1, rp.repeticiones, rp.peso_utilizado,
  rp.repeticiones, rp.peso_utilizado, rp.fecha
from public.registros_progreso rp
join public.alumnos a on a.id = rp.alumno_id
join public.profiles p on lower(p.email) = lower(a.email)
join public.exercises ex on lower(ex.name) = lower(rp.ejercicio)
join public.routines nr on nr.id = ex.routine_id and nr.client_id = p.id
on conflict (exercise_id, client_id, log_date, set_number) do nothing;

-- ============================================================
-- Seguridad: RLS activado (solo el service role accede; la app
-- usa exclusivamente el service role a través de sus API routes).
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.routines      enable row level security;
alter table public.exercises     enable row level security;
alter table public.sets_logs     enable row level security;
alter table public.audio_reports enable row level security;

-- ============================================================
-- Utilidades
-- ============================================================
-- Ver perfiles:
-- select email, role, full_name, activo from public.profiles order by role, full_name;
-- Clientes sin PIN asignado:
-- select email, full_name from public.profiles where role = 'client' and pin_hash is null;
