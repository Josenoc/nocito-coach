-- ============================================================
-- Nocito Coach - Perfil del alumno (post-compra)
-- Ejecutar en Supabase -> SQL Editor -> New query -> Run
-- Guarda en un solo campo JSON los datos que el alumno
-- completa dentro de /alumnos: sexo, edad, altura, peso,
-- objetivo, experiencia, días y preferencias + macros.
-- ============================================================

alter table public.alumnos
  add column if not exists perfil jsonb;

-- ============================================================
-- Utilidades
-- ============================================================

-- Ver alumnos con su perfil:
-- select nombre, email, token_acceso, activo, perfil
-- from public.alumnos order by created_at desc;

-- Ver quiénes todavía no completaron su perfil:
-- select nombre, email, token_acceso
-- from public.alumnos where perfil is null or perfil = 'null'::jsonb;

-- Resetear el perfil de un alumno (para que lo vuelva a completar):
-- update public.alumnos set perfil = null where email = 'juan.perez@ejemplo.com';
