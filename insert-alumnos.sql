-- ============================================================
-- Nocito Coach - Crear alumnos reales
-- Ejecutar en Supabase -> SQL Editor -> New query -> Run
-- El id y created_at se generan solos.
-- Elegí para cada alumno un token fácil de tipear (lo usará para entrar).
-- ============================================================

insert into public.alumnos (nombre, email, token_acceso, activo) values
  ('Juan Perez',  'juan.perez@ejemplo.com',  'juan-2026',  true),
  ('Maria Gomez', 'maria.gomez@ejemplo.com', 'maria-2026', true)
on conflict (email) do nothing;

-- ============================================================
-- Utilidades
-- ============================================================

-- Ver todos los alumnos y sus tokens (para pasarle el token a cada uno):
-- select nombre, email, token_acceso, activo, created_at
-- from public.alumnos order by nombre;

-- Desactivar a un alumno (le corta el acceso, conserva su historial):
-- update public.alumnos set activo = false where token_acceso = 'juan-2026';

-- Reactivar a un alumno:
-- update public.alumnos set activo = true where token_acceso = 'juan-2026';

-- Cambiar el token de un alumno:
-- update public.alumnos set token_acceso = 'nuevo-token' where email = 'juan.perez@ejemplo.com';
