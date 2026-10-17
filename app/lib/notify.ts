import { getResend, getDestinationEmail, SENDER_EMAIL } from "./resend";
import { siteBaseUrl } from "./mp";
import type { Anamnesis } from "@/lib/app-types";

const GOAL_LABELS: Record<string, string> = {
  hipertrofia: "Hipertrofia",
  "perdida-grasa": "Pérdida de grasa",
  fuerza: "Fuerza",
  recomposicion: "Recomposición corporal",
  "rendimiento-deportivo": "Rendimiento deportivo",
};

const NUTRITION_LABELS: Record<string, string> = {
  omnivoro: "Omnívoro",
  vegetariano: "Vegetariano",
  carnivoro: "Carnívoro",
  vegano: "Vegano",
};

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#888;font-size:13px;white-space:nowrap;">${label}</td><td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${value}</td></tr>`;
}

/**
 * Aviso al coach cuando un cliente completa la anamnesis y queda pendiente de revisión.
 * Se envía a la dirección maestra (DESTINATION_EMAIL).
 */
export async function sendCoachPendingReviewEmail(input: {
  name: string;
  email: string;
  phone?: string;
  anamnesis: Anamnesis;
}): Promise<{ ok: boolean; to?: string; error?: string }> {
  const to = getDestinationEmail();
  if (!to) return { ok: false, error: "DESTINATION_EMAIL no configurado" };

  const base = siteBaseUrl();
  const link = `${base}/app/admin`;
  const a = input.anamnesis;
  const clientName = input.name || input.email;

  const subject = `Nuevo cliente pendiente de revisión — ${clientName}`;

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">`,
    `<div style="background:#0b0b0b;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0;">`,
    `<p style="margin:0;font-size:11px;letter-spacing:2px;color:#FFC400;">NOCITO COACH</p>`,
    `<h1 style="margin:8px 0 0;font-size:22px;">Nuevo cliente pendiente de revisión</h1>`,
    `</div>`,
    `<div style="background:#fff;padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">`,
    `<p style="margin:0 0 16px;color:#222;font-size:15px;"><strong>${clientName}</strong> completó su anamnesis y espera que revises y publiques su rutina.</p>`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">`,
    row("Email", input.email),
    input.phone ? row("Teléfono", input.phone) : "",
    row("Objetivo", GOAL_LABELS[a.goal] ?? a.goal),
    row("Días/semana", String(a.training_days)),
    row("Edad", `${a.age} años`),
    row("Sexo", a.sex),
    row("Altura", `${a.height_cm} cm`),
    row("Peso", `${a.weight_kg} kg`),
    a.body_fat_pct ? row("Grasa corporal", `${a.body_fat_pct} %`) : "",
    a.training_years != null ? row("Años entrenando", String(a.training_years)) : "",
    a.activity_level ? row("Actividad diaria", a.activity_level) : "",
    a.sleep_quality ? row("Sueño", a.sleep_quality) : "",
    row("Alimentación", NUTRITION_LABELS[a.nutrition] ?? a.nutrition),
    `</table>`,
    `<p style="margin:0 0 22px;"><a href="${link}" style="display:inline-block;background:#FFC400;color:#111;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:15px;">Entrar al panel y revisar</a></p>`,
    `<p style="margin:0;color:#888;font-size:12px;">La rutina generada queda oculta para el cliente hasta que la apruebes en ${link}.</p>`,
    `</div>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n");

  const text = [
    "NOCITO COACH — NUEVO CLIENTE PENDIENTE DE REVISIÓN",
    "",
    `${clientName} completó su anamnesis y espera revisión.`,
    "",
    `Email: ${input.email}`,
    input.phone ? `Teléfono: ${input.phone}` : "",
    `Objetivo: ${GOAL_LABELS[a.goal] ?? a.goal}`,
    `Días/semana: ${a.training_days}`,
    `Edad: ${a.age} años`,
    `Sexo: ${a.sex}`,
    `Altura: ${a.height_cm} cm`,
    `Peso: ${a.weight_kg} kg`,
    `Alimentación: ${NUTRITION_LABELS[a.nutrition] ?? a.nutrition}`,
    "",
    `Revisá y publicá la rutina en ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  let resend;
  try {
    resend = getResend();
  } catch (err: any) {
    return { ok: false, error: err?.message || "Resend no configurado" };
  }

  const res = await resend.emails.send({
    from: SENDER_EMAIL,
    to,
    subject,
    html,
    text,
  });
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true, to };
}

/**
 * Aviso al coach cuando un cliente actualiza sus datos desde el panel de espera.
 * Se envía a la dirección maestra (DESTINATION_EMAIL). No bloquea al cliente.
 */
export async function sendClientUpdatedEmail(input: {
  name: string;
  email: string;
  changes: string[];
}): Promise<{ ok: boolean; to?: string; error?: string }> {
  const to = getDestinationEmail();
  if (!to) return { ok: false, error: "DESTINATION_EMAIL no configurado" };

  const base = siteBaseUrl();
  const link = `${base}/app/admin`;
  const clientName = input.name || input.email;
  const list = input.changes.filter(Boolean);
  const comma = list.join(", ") || "Sus datos";
  const subject = `Actualización de datos — ${clientName}`;

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">`,
    `<div style="background:#0b0b0b;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0;">`,
    `<p style="margin:0;font-size:11px;letter-spacing:2px;color:#FFC400;">NOCITO COACH</p>`,
    `<h1 style="margin:8px 0 0;font-size:22px;">El cliente actualizó sus datos</h1>`,
    `</div>`,
    `<div style="background:#fff;padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">`,
    `<p style="margin:0 0 16px;color:#222;font-size:15px;"><strong>${clientName}</strong> editó su ficha mientras esperaba la revisión.</p>`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">`,
    row("Email", input.email),
    row("Cambios", comma),
    `</table>`,
    `<p style="margin:0 0 22px;"><a href="${link}" style="display:inline-block;background:#FFC400;color:#111;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:15px;">Ver en el panel</a></p>`,
    `<p style="margin:0;color:#888;font-size:12px;">Revisá los datos actualizados antes de cerrar el plan.</p>`,
    `</div>`,
    `</div>`,
  ].join("");

  const text = [
    `${clientName} actualizó sus datos.`,
    ``,
    `Email: ${input.email}`,
    `Cambios: ${comma}`,
    ``,
    `Ver en el panel: ${link}`,
  ].join("\n");

  let resend;
  try {
    resend = getResend();
  } catch (err: any) {
    return { ok: false, error: err?.message || "Resend no configurado" };
  }

  const res = await resend.emails.send({
    from: SENDER_EMAIL,
    to,
    subject,
    html,
    text,
  });
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true, to };
}

export type CoachActivityKind = "workout" | "voice" | "profile";

const ACTIVITY_TITLE: Record<CoachActivityKind, string> = {
  workout: "registró su sesión",
  voice: "envió una nota de voz",
  profile: "actualizó sus datos",
};

const ACTIVITY_INTRO: Record<CoachActivityKind, string> = {
  workout: "completó y registró series de su entrenamiento.",
  voice: "te envió una nota de voz desde la app.",
  profile: "editó su ficha y datos personales.",
};

/**
 * Aviso al coach ante actividad del cliente (sesión registrada, nota de voz o
 * actualización de datos). Se envía a la dirección maestra (DESTINATION_EMAIL).
 */
export async function sendCoachActivityEmail(input: {
  kind: CoachActivityKind;
  name: string;
  email: string;
  detail?: string;
}): Promise<{ ok: boolean; to?: string; error?: string }> {
  const to = getDestinationEmail();
  if (!to) return { ok: false, error: "DESTINATION_EMAIL no configurado" };

  const base = siteBaseUrl();
  const link = `${base}/app/admin`;
  const clientName = input.name || input.email;
  const title = ACTIVITY_TITLE[input.kind];
  const subject = `Nocito Coach: ${clientName} ${title}`;

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">`,
    `<div style="background:#0b0b0b;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0;">`,
    `<p style="margin:0;font-size:11px;letter-spacing:2px;color:#FFC400;">NOCITO COACH</p>`,
    `<h1 style="margin:8px 0 0;font-size:22px;">Actividad de un alumno</h1>`,
    `</div>`,
    `<div style="background:#fff;padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">`,
    `<p style="margin:0 0 16px;color:#222;font-size:15px;"><strong>${clientName}</strong> ${ACTIVITY_INTRO[input.kind]}</p>`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">`,
    row("Alumno", clientName),
    row("Email", input.email),
    input.detail ? row("Detalle", input.detail) : "",
    `</table>`,
    `<p style="margin:0 0 22px;"><a href="${link}" style="display:inline-block;background:#FFC400;color:#111;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:15px;">Ver en el panel</a></p>`,
    `<p style="margin:0;color:#888;font-size:12px;">Entrá al panel para revisar su historial y responder.</p>`,
    `</div>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("");

  const text = [
    `${clientName} ${title}.`,
    ``,
    `Email: ${input.email}`,
    input.detail ? `Detalle: ${input.detail}` : "",
    ``,
    `Ver en el panel: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  let resend;
  try {
    resend = getResend();
  } catch (err: any) {
    return { ok: false, error: err?.message || "Resend no configurado" };
  }

  const res = await resend.emails.send({
    from: SENDER_EMAIL,
    to,
    subject,
    html,
    text,
  });
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true, to };
}
