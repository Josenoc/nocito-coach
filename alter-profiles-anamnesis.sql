-- ============================================================
-- Nocito Coach - Anamnesis del cliente (onboarding self-setup)
-- Ejecutar en Supabase -> SQL Editor -> New query -> Run
-- Agrega a profiles los datos de anamnesis y el teléfono.
-- ============================================================

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists anamnesis jsonb;

-- La anamnesis guarda (jsonb, sin cambios de esquema al agregar campos):
-- {
--   "sex": "Masculino" | "Femenino" | "Otro",
--   "age": 30,
--   "height_cm": 178,
--   "weight_kg": 78.5,
--   "body_fat_pct": 18.5,                        -- % de grasa corporal estimado (opcional)
--   "goal": "hipertrofia" | "perdida-grasa" | "fuerza" | "recomposicion" | "rendimiento-deportivo",
--   "training_days": 3 | 4 | 5,
--   "training_place": "gimnasio" | "casa" | "aire-libre",   -- acceso a equipamiento
--   "experience": "principiante" | "intermedio" | "avanzado",
--   "training_years": 2,                         -- años de entrenamiento estructurado
--   "activity_level": "sedentario" | "ligero" | "moderado" | "alto" | "muy-alto",
--   "sleep_quality": "mala" | "regular" | "buena" | "excelente",
--   "injuries": "molestia hombro derecho",
--   "food_restrictions": "sin lactosa",
--   "nutrition": "omnivoro" | "vegetariano" | "carnivoro" | "vegano",
--   "completedAt": "2026-10-15T00:00:00.000Z"
-- }

-- Utilidades:
-- select email, full_name, phone, anamnesis from public.profiles where role = 'client' order by full_name;
-- select email, full_name from public.profiles
--   where role = 'client' and (anamnesis is null or anamnesis = '{}'::jsonb);
