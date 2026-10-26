import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

// La clave de servicio es un JWT: si por error se configuró la anon key, todas
// las lecturas/escrituras fallan por RLS (y el guardado del alumno se pierde
// en silencio). Detectamos el rol al arrancar y lo dejamos en los logs.
function jwtRole(key: string): string | null {
  try {
    const payload = key.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof json?.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL faltante');
  }
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY faltante');
  }

  const role = jwtRole(supabaseServiceKey);
  if (role && role !== 'service_role') {
    console.error(
      `[supabase] SUPABASE_SERVICE_ROLE_KEY tiene rol "${role}", no "service_role": ` +
        'las tablas tienen RLS sin políticas y las escrituras del alumno van a fallar. ' +
        'Revisá la variable en Vercel.'
    );
  }

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return adminClient;
}