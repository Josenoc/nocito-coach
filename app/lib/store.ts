import { Pool } from "pg";

export type RoutinePayload = Record<string, unknown>;

const databaseUrl = process.env.DATABASE_URL ?? "";

function createPool(): Pool {
  if (!databaseUrl) {
    throw new Error(
      "Falta la variable DATABASE_URL (Supabase/Postgres). Configurala en Vercel y en .env.local."
    );
  }
  const ssl = /([?&]|^)sslmode=/.test(databaseUrl)
    ? undefined
    : { rejectUnauthorized: false };
  const cfg: Record<string, unknown> = {
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 5000,
  };
  if (ssl) cfg.ssl = ssl;
  return new Pool(cfg);
}

const globalForPg = globalThis as unknown as { nocitoPool?: Pool };
let schemaReady = false;

function pool(): Pool {
  if (!globalForPg.nocitoPool) globalForPg.nocitoPool = createPool();
  return globalForPg.nocitoPool;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS routines (
    ref TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

export async function initStore(): Promise<void> {
  if (schemaReady) return;
  const client = await pool().connect();
  try {
    await client.query(SCHEMA);
    schemaReady = true;
  } finally {
    client.release();
  }
}

export function generateRef(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function saveRoutine(payload: RoutinePayload): Promise<string> {
  await initStore();
  const ref = generateRef();
  await pool().query<{ ref: string }>(
    "INSERT INTO routines (ref, payload) VALUES ($1, $2) RETURNING ref",
    [ref, payload]
  );
  return ref;
}

export async function getRoutine(
  ref: string
): Promise<RoutinePayload | undefined> {
  await initStore();
  const res = await pool().query<{ payload: RoutinePayload }>(
    "SELECT payload FROM routines WHERE ref = $1",
    [ref]
  );
  return res.rows[0]?.payload;
}

export async function attachPlan(
  ref: string,
  planName: string
): Promise<void> {
  await initStore();
  await pool().query(
    "UPDATE routines SET payload = payload || $2::jsonb WHERE ref = $1",
    [ref, { plan: { name: planName, confirmed: false } }]
  );
}

export async function confirmPlan(ref: string): Promise<void> {
  await initStore();
  await pool().query(
    "UPDATE routines SET payload = jsonb_set(payload, '{plan,confirmed}', 'true') WHERE ref = $1",
    [ref]
  );
}