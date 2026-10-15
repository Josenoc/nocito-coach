import { getSupabaseAdmin } from "@/lib/supabase-server";
import { hashPin } from "@/lib/auth";
import { getResend, getDestinationEmail, SENDER_EMAIL } from "./resend";
import { siteBaseUrl } from "./mp";

const RESERVED_EMAILS = new Set(["comprador@example.com"]);

export function isDeliverableEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return !RESERVED_EMAILS.has(email);
}

function slugName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.split("-")[0] || "alumno";
}

function randomToken(slug: string): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${slug}-${n}`;
}

export type ProvisionResult =
  | { ok: true; token: string; email: string; existing: boolean }
  | { ok: false; error: string };

export async function provisionAlumno(input: {
  name: string;
  email: string;
}): Promise<ProvisionResult> {
  const email = input.email.trim().toLowerCase();
  const nombre = input.name.trim() || "Alumno";
  if (!isDeliverableEmail(email)) {
    return { ok: false, error: "email no válido" };
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err: any) {
    return { ok: false, error: err?.message || "Supabase no configurado" };
  }

  const { data: found, error: findErr } = await supabase
    .from("alumnos")
    .select("token_acceso")
    .eq("email", email)
    .maybeSingle();
  if (findErr) return { ok: false, error: findErr.message };
  if (found?.token_acceso) {
    return { ok: true, token: found.token_acceso, email, existing: true };
  }

  const slug = slugName(nombre);
  for (let i = 0; i < 5; i++) {
    const token = randomToken(slug);
    const { error } = await supabase.from("alumnos").insert({
      nombre,
      email,
      token_acceso: token,
      activo: true,
    });
    if (!error) return { ok: true, token, email, existing: false };
    if (error.code === "23505") continue;
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "no se pudo generar un token único" };
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export type ProfileProvision =
  | { ok: true; pin: string; existing: boolean }
  | { ok: false; error: string };

export async function provisionProfile(input: {
  name: string;
  email: string;
}): Promise<ProfileProvision> {
  const email = input.email.trim().toLowerCase();
  const nombre = input.name.trim() || "Alumno";
  if (!isDeliverableEmail(email)) {
    return { ok: false, error: "email no válido" };
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err: any) {
    return { ok: false, error: err?.message || "Supabase no configurado" };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const pin = generatePin();
  const { error } = await supabase.from("profiles").upsert(
    {
      email,
      role: "client",
      full_name: nombre,
      pin_hash: hashPin(pin),
      activo: true,
    },
    { onConflict: "email" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, pin, existing: Boolean(existing) };
}

function accessEmailHtml(name: string, email: string, base: string): string {
  const link = `${base}/app?registro=1`;
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">`,
    `<div style="background:#0b0b0b;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0;">`,
    `<p style="margin:0;font-size:11px;letter-spacing:2px;color:#FFC400;">NOCITO COACH</p>`,
    `<h1 style="margin:8px 0 0;font-size:22px;">Creá tu acceso</h1>`,
    `</div>`,
    `<div style="background:#fff;padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">`,
    `<p style="margin:0 0 16px;color:#222;font-size:15px;">Hola ${name},</p>`,
    `<p style="margin:0 0 16px;color:#444;font-size:14px;line-height:1.6;">Tu compra fue confirmada. Creá tu acceso al panel privado en un minuto: completás tus datos (peso, edad, altura y preferencias) y elegís un PIN de 4 dígitos.</p>`,
    `<p style="margin:0 0 16px;color:#444;font-size:14px;">Vas a ingresar siempre con tu email <strong>${email}</strong> y el PIN que elijas.</p>`,
    `<p style="margin:0 0 22px;"><a href="${link}" style="display:inline-block;background:#FFC400;color:#111;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:15px;">Crear mi acceso</a></p>`,
    `<p style="margin:0;color:#888;font-size:12px;">Guardá este email: podés volver cuando quieras e ingresar con tu email y PIN en ${base}/app.</p>`,
    `</div>`,
    `</div>`,
  ].join("\n");
}

function accessEmailText(name: string, email: string, base: string): string {
  return [
    "NOCITO COACH — CREÁ TU ACCESO",
    "",
    `Hola ${name},`,
    "",
    "Tu compra fue confirmada. Creá tu acceso al panel privado en un minuto:",
    "completás tus datos (peso, edad, altura y preferencias) y elegís un PIN de 4 dígitos.",
    "",
    "Email de acceso: " + email,
    "Vas a ingresar siempre con este email y el PIN que elijas.",
    "Creá tu acceso en: " + `${base}/app?registro=1`,
    "",
    "Guardá este email: podés volver cuando quieras e ingresar en " + `${base}/app`,
  ].join("\n");
}

export async function sendAlumnoAccessEmail(input: {
  name: string;
  email: string;
  existing?: boolean;
}): Promise<{ ok: boolean; to?: string; error?: string }> {
  const base = siteBaseUrl();
  const subject = input.existing
    ? "Tu acceso a Nocito Coach"
    : "Bienvenido a Nocito Coach — creá tu acceso";
  const html = accessEmailHtml(input.name, input.email, base);
  const text = accessEmailText(input.name, input.email, base);

  let resend;
  try {
    resend = getResend();
  } catch (err: any) {
    return { ok: false, error: err?.message || "Resend no configurado" };
  }

  const primary = await resend.emails.send({
    from: SENDER_EMAIL,
    to: input.email,
    subject,
    html,
    text,
  });
  if (!primary.error) return { ok: true, to: input.email };

  const fallback = getDestinationEmail();
  if (fallback && fallback !== input.email.toLowerCase()) {
    const res = await resend.emails.send({
      from: SENDER_EMAIL,
      to: fallback,
      subject: `${subject} — ${input.email}`,
      html,
      text,
    });
    if (!res.error) return { ok: true, to: fallback };
    return { ok: false, error: res.error.message };
  }
  return { ok: false, error: primary.error.message };
}
