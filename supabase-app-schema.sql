-- ============================================================
-- Nocito Coach - Web App privada (nocito.coach/app)
-- Ejecutar en Supabase -> SQL Editor -> New query -> Run
-- Crea el esquema nuevo e idempotente y migra los datos
-- existentes (alumnos / rutinas / ejercicios_asignados /
-- registros_progreso) hacia las nuevas tablas.
-- ============================================================

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
-- SEED / MIGRACIÓN
-- ============================================================

-- Coach (José). PIN por defecto: 7319  -> CAMBIARLO.
-- (mismo algoritmo que usa la app: scrypt N=16384 salt 16B keylen 64)
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

-- Migrar rutinas / ejercicios / registros con un bloque PL/pgSQL
do $$
declare
  r record;
  e record;
  g record;
  v_client uuid;
  v_routine uuid;
  v_exercise uuid;
begin
  -- Solo migrar si todavía no hay rutinas nuevas para ese cliente.
  for r in
    select ru.*, a.email
    from public.rutinas ru
    join public.alumnos a on a.id = ru.alumno_id
  loop
    select p.id into v_client
    from public.profiles p
    where lower(p.email) = lower(r.email);

    if v_client is null then
      continue;
    end if;

    if exists (
      select 1 from public.routines nr
      where nr.client_id = v_client and nr.name = r.nombre
    ) then
      continue;
    end if;

    insert into public.routines (client_id, name, day_name, week_number, active)
    values (v_client, r.nombre, '', 1, coalesce(r.activa, true))
    returning id into v_routine;

    for e in
      select * from public.ejercicios_asignados ea
      where ea.rutina_id = r.id
      order by ea.orden
    loop
      insert into public.exercises (
        routine_id, name, order_index, target_sets, target_reps, target_weight, unit
      ) values (
        v_routine,
        e.nombre,
        coalesce(e.orden, 0),
        coalesce(e.series_default, 3),
        coalesce(e.reps_default, 10),
        e.peso_default,
        coalesce(e.unidad_peso, 'kg')
      );
    end loop;
  end loop;

  -- Migrar registros de progreso -> sets_logs (1 fila por registro).
  -- sets_logs.exercise_id es NOT NULL, así que solo se migran los registros
  -- cuyo ejercicio matchee (por nombre) con un ejercicio del cliente.
  for g in
    select rp.*, a.email
    from public.registros_progreso rp
    join public.alumnos a on a.id = rp.alumno_id
  loop
    select p.id into v_client
    from public.profiles p
    where lower(p.email) = lower(g.email);

    if v_client is null then
      continue;
    end if;

    select ex.id into v_exercise
    from public.exercises ex
    join public.routines ro on ro.id = ex.routine_id
    where ro.client_id = v_client
      and lower(ex.name) = lower(g.ejercicio)
    order by ex.order_index
    limit 1;

    if v_exercise is null then
      continue;
    end if;

    insert into public.sets_logs (
      exercise_id, client_id, set_number, actual_reps, actual_weight,
      target_reps, target_weight, log_date
    ) values (
      v_exercise, v_client, 1, g.repeticiones, g.peso_utilizado,
      g.repeticiones, g.peso_utilizado, g.fecha
    )
    on conflict (exercise_id, client_id, log_date, set_number) do nothing;
  end loop;
end $$;

-- ============================================================
-- Utilidades
-- ============================================================

-- Ver perfiles:
-- select email, role, full_name, activo from public.profiles order by role, full_name;

-- Resetear PIN del coach a 7319 (o cambiar por otro hasheado desde el panel):
-- update public.profiles set pin_hash = null where role = 'coach';

-- Clientes que todavía no tienen PIN asignado:
-- select email, full_name from public.profiles where role = 'client' and pin_hash is null;
