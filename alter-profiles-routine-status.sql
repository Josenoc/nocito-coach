-- ============================================================
-- Nocito Coach - Estado de rutina y plan nutricional del cliente
-- Ejecutar en Supabase -> SQL Editor -> New query -> Run
-- Agrega a profiles el estado de aprobación y el plan nutricional.
-- ============================================================

alter table public.profiles
  add column if not exists routine_status text not null default 'active'
    check (routine_status in ('pending_review', 'active'));

alter table public.profiles add column if not exists nutrition_plan jsonb;
alter table public.profiles add column if not exists approved_at timestamptz;

-- routine_status:
--   'pending_review' -> el cliente completó su anamnesis; la rutina es un
--                       borrador (routines.active = false) visible solo para el coach.
--   'active'         -> el coach aprobó y publicó la rutina (routines.active = true).
-- Los clientes existentes quedan en 'active' por el default.

-- nutrition_plan guarda el plan nutricional editable por el coach:
-- {
--   "cal": 2600, "prot": 160, "carbs": 280, "fat": 80,
--   "proteinSources": "Pollo, carne magra, pescado, huevos y lácteos",
--   "meals": [["Desayuno", "..."], ["Almuerzo", "..."], ...]
-- }

-- Utilidades:
-- select email, full_name, routine_status from public.profiles where role = 'client' order by full_name;
-- update public.profiles set routine_status = 'pending_review' where email = 'alumno@nocito.coach';
