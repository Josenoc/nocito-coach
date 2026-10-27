-- Migracion: estandarizar nombres de ejercicios (corregir erratas)
-- Ejecutar en el SQL Editor de Supabase (proyecto uatjjjmsbpxlwmgweszq).
-- Actualiza exercises.name y, si existe, el exercise_name desnormalizado en sets_logs.

-- 1. flexiones en barra a 45° -> Press frances en barra a 45°
UPDATE exercises SET name = 'Press francés en barra a 45°'
  WHERE name ILIKE '%flexiones%barra%45%';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sets_logs' AND column_name='exercise_name') THEN
    UPDATE sets_logs SET exercise_name = 'Press francés en barra a 45°'
      WHERE exercise_name ILIKE '%flexiones%barra%45%';
  END IF;
END $$;

-- 2. press plano° -> Press de banca
UPDATE exercises SET name = 'Press de banca'
  WHERE name ILIKE '%press%plano%';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sets_logs' AND column_name='exercise_name') THEN
    UPDATE sets_logs SET exercise_name = 'Press de banca'
      WHERE exercise_name ILIKE '%press%plano%';
  END IF;
END $$;

-- 3. remo t a 45°° -> Remo en barra T
UPDATE exercises SET name = 'Remo en barra T'
  WHERE name ILIKE '%remo%t%45%' OR name ILIKE '%remo t a%';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sets_logs' AND column_name='exercise_name') THEN
    UPDATE sets_logs SET exercise_name = 'Remo en barra T'
      WHERE exercise_name ILIKE '%remo%t%45%' OR exercise_name ILIKE '%remo t a%';
  END IF;
END $$;

-- 4. remo cerrado en polea°° -> Remo en polea sentado
UPDATE exercises SET name = 'Remo en polea sentado'
  WHERE name ILIKE '%remo%cerrado%polea%';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sets_logs' AND column_name='exercise_name') THEN
    UPDATE sets_logs SET exercise_name = 'Remo en polea sentado'
      WHERE exercise_name ILIKE '%remo%cerrado%polea%';
  END IF;
END $$;

-- 5. biceps curl en banco a 45°°° -> Curl de biceps en banco inclinado
UPDATE exercises SET name = 'Curl de biceps en banco inclinado'
  WHERE name ILIKE '%biceps%curl%banco%45%';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sets_logs' AND column_name='exercise_name') THEN
    UPDATE sets_logs SET exercise_name = 'Curl de biceps en banco inclinado'
      WHERE exercise_name ILIKE '%biceps%curl%banco%45%';
  END IF;
END $$;

-- 6. biceps curl con mancuerna°°° -> Curl de biceps con mancuerna
UPDATE exercises SET name = 'Curl de biceps con mancuerna'
  WHERE name ILIKE '%biceps%curl%mancuerna%';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sets_logs' AND column_name='exercise_name') THEN
    UPDATE sets_logs SET exercise_name = 'Curl de biceps con mancuerna'
      WHERE exercise_name ILIKE '%biceps%curl%mancuerna%';
  END IF;
END $$;

-- 7. manguito rotador polea (agarre individual)°°° -> Rotación externa con polea
UPDATE exercises SET name = 'Rotación externa con polea'
  WHERE name ILIKE '%manguito%rotador%polea%';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sets_logs' AND column_name='exercise_name') THEN
    UPDATE sets_logs SET exercise_name = 'Rotación externa con polea'
      WHERE exercise_name ILIKE '%manguito%rotador%polea%';
  END IF;
END $$;

-- Verificacion (opcional): listar los nombres actualizados
-- SELECT id, name FROM exercises WHERE name IN (
--   'Press francés en barra a 45°','Press de banca','Remo en barra T',
--   'Remo en polea sentado','Curl de biceps en banco inclinado',
--   'Curl de biceps con mancuerna','Rotación externa con polea'
-- );
