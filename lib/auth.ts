import crypto from "crypto";
import { cookies } from "next/headers";

export type Role = "client" | "coach";

export interface SessionProfile {
  id: string;
  email: string;
  role: Role;
  full_name: string;
}

const COOKIE_NAME = "nocito_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function secret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "nocito-dev-secret"
  );
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pin, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], "hex");
    expected = Buffer.from(parts[2], "hex");
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;
  const key = crypto.scryptSync(pin, salt, expected.length);
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function createSessionToken(profile: SessionProfile): string {
  const body = { ...profile, exp: Date.now() + SESSION_TTL_MS };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | null | undefined): SessionProfile | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, sign(payload))) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!body?.exp || body.exp < Date.now()) return null;
    if (!body.id || !body.email || !body.role) return null;
    return {
      id: body.id,
      email: body.email,
      role: body.role,
      full_name: body.full_name || "",
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(profile: SessionProfile): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(profile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionProfile | null> {
  const store = await cookies();
  return readSessionToken(store.get(COOKIE_NAME)?.value);
}

export async function getCoach(): Promise<SessionProfile | null> {
  const session = await getSession();
  return session && session.role === "coach" ? session : null;
}
