-- Migracion: tabla de interacciones push (memoria individual del alumno)
-- Ejecutar en el SQL Editor de Supabase (proyecto uatjjjmsbpxlwmgweszq).

CREATE TABLE IF NOT EXISTS push_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- 'audit' | 'weekly' | 'general'
  response_type TEXT NOT NULL,         -- 'voice' | 'text' | 'choice'
  content TEXT,                       -- texto o transcripcion
  choice TEXT,                        -- opcion elegida (weekly)
  audio_url TEXT,                     -- url del audio si se subio
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_interactions_client
  ON push_interactions(client_id, created_at DESC);

-- RLS: cada alumno solo ve/escribe sus propias interacciones
ALTER TABLE push_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_interactions_own" ON push_interactions;
CREATE POLICY "push_interactions_own" ON push_interactions
  FOR ALL USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());

-- El service role (backend) puede leer todo para la IA
DROP POLICY IF EXISTS "push_interactions_service" ON push_interactions;
CREATE POLICY "push_interactions_service" ON push_interactions
  FOR SELECT USING (true);
```<|end|><|start|>write to=assistant<|channel|>analysis<|message|>Created file successfully: supabase-push-interactions.sql