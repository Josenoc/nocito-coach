-- Migracion: estandarizar nombres de ejercicios (corregir erratas)
-- Ejecutar en el SQL Editor de Supabase (proyecto uatjjjmsbpxlwmgweszq).
-- Actualiza exercises.name y el exercise_name desnormalizado en sets_logs.

-- 1. flexiones en barra a 45° -> Press frances en barra a 45°
UPDATE exercises SET name = 'Press francés en barra a 45°'
  WHERE name ILIKE '%flexiones%barra%45%';
UPDATE sets_logs SET exercise_name = 'Press francés en barra a 45°'
  WHERE exercise_name ILIKE '%flexiones%barra%45%';

-- 2. press plano° -> Press de banca
UPDATE exercises SET name = 'Press de banca'
  WHERE name ILIKE '%press%plano%';
UPDATE sets_logs SET exercise_name = 'Press de banca'
  WHERE exercise_name ILIKE '%press%plano%';

-- 3. remo t a 45°° -> Remo en barra T
UPDATE exercises SET name = 'Remo en barra T'
  WHERE name ILIKE '%remo%t%45%' OR name ILIKE '%remo t a%';
UPDATE sets_logs SET exercise_name = 'Remo en barra T'
  WHERE exercise_name ILIKE '%remo%t%45%' OR exercise_name ILIKE '%remo t a%';

-- 4. remo cerrado en polea°° -> Remo en polea sentado
UPDATE exercises SET name = 'Remo en polea sentado'
  WHERE name ILIKE '%remo%cerrado%polea%';
UPDATE sets_logs SET exercise_name = 'Remo en polea sentado'
  WHERE exercise_name ILIKE '%remo%cerrado%polea%';

-- 5. biceps curl en banco a 45°°° -> Curl de biceps en banco inclinado
UPDATE exercises SET name = 'Curl de biceps en banco inclinado'
  WHERE name ILIKE '%biceps%curl%banco%45%';
UPDATE sets_logs SET exercise_name = 'Curl de biceps en banco inclinado'
  WHERE exercise_name ILIKE '%biceps%curl%banco%45%';

-- 6. biceps curl con mancuerna°°° -> Curl de biceps con mancuerna
UPDATE exercises SET name = 'Curl de biceps con mancuerna'
  WHERE name ILIKE '%biceps%curl%mancuerna%';
UPDATE sets_logs SET exercise_name = 'Curl de biceps con mancuerna'
  WHERE exercise_name ILIKE '%biceps%curl%mancuerna%';

-- 7. manguito rotador polea (agarre individual)°°° -> Rotación externa con polea
UPDATE exercises SET name = 'Rotación externa con polea'
  WHERE name ILIKE '%manguito%rotador%polea%';
UPDATE sets_logs SET exercise_name = 'Rotación externa con polea'
  WHERE exercise_name ILIKE '%manguito%rotador%polea%';

-- Verificacion (opcional): listar los nombres actualizados
-- SELECT id, name FROM exercises WHERE name IN (
--   'Press francés en barra a 45°','Press de banca','Remo en barra T',
--   'Remo en polea sentado','Curl de biceps en banco inclinado',
--   'Curl de biceps con mancuerna','Rotación externa con polea'
-- );
