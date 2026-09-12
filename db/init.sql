-- Ejecutar en Supabase: SQL Editor (Project > SQL New query)
CREATE TABLE IF NOT EXISTS routines (
  ref TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);