import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";
import { generateOnboardingDraft } from "@/app/lib/onboarding";
import type { Anamnesis } from "@/lib/app-types";

export const dynamic = "force-dynamic";

const PROFILE_FIELDS =
  "id, email, full_name, activo, created_at, phone, anamnesis, routine_status, nutrition_plan, approved_at";

export async function GET(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const [profileRes, routinesRes] = await Promise.all([
    supabase.from("profiles").select(PROFILE_FIELDS).eq("id", id).single(),
    supabase
      .from("routines")
      .select("*, exercises(*)")
      .eq("client_id", id)
      .order("week_number", { ascending: false })
      .order("position", { ascending: true }),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  let profile = profileRes.data;
  let routines = routinesRes.data ?? [];

  if (profile.anamnesis && !profile.nutrition_plan && routines.length === 0) {
    try {
      await generateOnboardingDraft(id, profile.anamnesis as Anamnesis);
      const [profileAgain, routinesAgain] = await Promise.all([
        supabase.from("profiles").select(PROFILE_FIELDS).eq("id", id).single(),
        supabase
          .from("routines")
          .select("*, exercises(*)")
          .eq("client_id", id)
          .order("week_number", { ascending: false })
          .order("position", { ascending: true }),
      ]);
      if (profileAgain.data) profile = profileAgain.data;
      routines = routinesAgain.data ?? routines;
    } catch {
      // si falla la generación, seguimos devolviendo lo que haya
    }
  }

  let changes: unknown[] = [];
  try {
    const changesRes = await supabase
      .from("client_changes")
      .select("id, field, field_label, old_value, new_value, changed_by, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!changesRes.error) changes = changesRes.data ?? [];
  } catch {
    changes = [];
  }

  const [logsRes, audioRes] = await Promise.all([
    supabase
      .from("sets_logs")
      .select("*, exercises(name)")
      .eq("client_id", id)
      .order("log_date", { ascending: false })
      .order("set_number", { ascending: true })
      .limit(2000),
    supabase
      .from("audio_reports")
      .select("*, exercises(name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    ok: true,
    profile,
    routines,
    logs: logsRes.data ?? [],
    audio: audioRes.data ?? [],
    changes,
  });
}

// Campos de anamnesis que el coach puede editar (el resto de las claves
// especiales — photos, foodLogs, setRir, trainingBlock — se preservan).
const ANAMNESIS_KEYS = [
  "sex",
  "age",
  "height_cm",
  "weight_kg",
  "body_fat_pct",
  "goal",
  "training_days",
  "session_length",
  "nutrition",
  "training_place",
  "experience",
  "training_years",
  "activity_level",
  "sleep_quality",
  "sleep_hours",
  "stress_level",
  "injuries",
  "food_restrictions",
  "allergies",
  "foods_love",
  "foods_avoid",
  "meals_per_day",
  "cook_time",
  "meal_prep",
  "budget",
  "supplements",
  "alcohol",
  "motivation",
] as const;

const FIELD_LABELS: Record<string, string> = {
  full_name: "Nombre",
  phone: "Teléfono",
  activo: "Estado",
  sex: "Sexo",
  age: "Edad",
  height_cm: "Altura",
  weight_kg: "Peso",
  body_fat_pct: "% de grasa",
  goal: "Objetivo",
  training_days: "Días por semana",
  session_length: "Duración de sesión",
  nutrition: "Alimentación",
  training_place: "Lugar de entrenamiento",
  experience: "Experiencia",
  training_years: "Años entrenando",
  activity_level: "Actividad diaria",
  sleep_quality: "Calidad de sueño",
  sleep_hours: "Horas de sueño",
  stress_level: "Nivel de estrés",
  injuries: "Lesiones / notas",
  food_restrictions: "Restricciones alimentarias",
  allergies: "Alergias",
  foods_love: "Alimentos favoritos",
  foods_avoid: "Alimentos que evita",
  meals_per_day: "Comidas por día",
  cook_time: "Tiempo para cocinar",
  meal_prep: "Meal prep",
  budget: "Presupuesto",
  supplements: "Suplementos",
  alcohol: "Alcohol",
  motivation: "Motivación",
};

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export async function PATCH(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: current, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, activo, anamnesis")
    .eq("id", id)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }
  if (current.role !== "client") {
    return NextResponse.json(
      { ok: false, error: "Solo se pueden editar clientes" },
      { status: 400 }
    );
  }

  const profileUpdate: Record<string, unknown> = {};
  const changes: {
    field: string;
    field_label: string;
    old_value: string;
    new_value: string;
  }[] = [];

  const logChange = (field: string, oldV: unknown, newV: unknown) => {
    const a = normalize(oldV);
    const b = normalize(newV);
    if (a === b) return;
    changes.push({
      field,
      field_label: FIELD_LABELS[field] ?? field,
      old_value: a,
      new_value: b,
    });
  };

  if (body.full_name !== undefined) {
    const v = cleanNote(body.full_name, 120);
    if (v) {
      logChange("full_name", current.full_name, v);
      profileUpdate.full_name = v;
    }
  }
  if (body.phone !== undefined) {
    const v = cleanNote(body.phone, 40);
    logChange("phone", current.phone, v);
    profileUpdate.phone = v;
  }
  if (typeof body.activo === "boolean") {
    logChange("activo", current.activo, body.activo);
    profileUpdate.activo = body.activo;
  }

  const currentAnamnesis: Record<string, unknown> =
    current.anamnesis && typeof current.anamnesis === "object"
      ? { ...(current.anamnesis as Record<string, unknown>) }
      : {};

  if (body.anamnesis && typeof body.anamnesis === "object") {
    const incoming = body.anamnesis as Record<string, unknown>;
    for (const key of ANAMNESIS_KEYS) {
      if (incoming[key] === undefined) continue;
      const next = incoming[key];
      logChange(key, currentAnamnesis[key], next);
      currentAnamnesis[key] = next;
    }
    profileUpdate.anamnesis = currentAnamnesis;
  }

  if (Object.keys(profileUpdate).length === 0) {
    return NextResponse.json({ ok: true, changed: 0 });
  }

  const { error: updErr } = await supabase.from("profiles").update(profileUpdate).eq("id", id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  // Registro de cambios (no bloquea si la tabla no existe todavía).
  if (changes.length) {
    try {
      await supabase.from("client_changes").insert(
        changes.map((c) => ({
          client_id: id,
          field: c.field,
          field_label: c.field_label,
          old_value: c.old_value,
          new_value: c.new_value,
          changed_by: coach.full_name || coach.email || "coach",
        }))
      );
    } catch {
      // migración pendiente: ignorar
    }
  }

  return NextResponse.json({ ok: true, changed: changes.length, changes });
}

function cleanNote(value: unknown, max = 1200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function DELETE(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }
  if (target.role !== "client") {
    return NextResponse.json(
      { ok: false, error: "Solo se pueden eliminar cuentas de clientes" },
      { status: 400 }
    );
  }

  const { data: routines } = await supabase.from("routines").select("id").eq("client_id", id);
  const routineIds = (routines ?? []).map((r: { id: string }) => r.id);

  const logsDel = await supabase.from("sets_logs").delete().eq("client_id", id);
  if (logsDel.error) {
    return NextResponse.json({ ok: false, error: logsDel.error.message }, { status: 500 });
  }

  const audioDel = await supabase.from("audio_reports").delete().eq("client_id", id);
  if (audioDel.error) {
    return NextResponse.json({ ok: false, error: audioDel.error.message }, { status: 500 });
  }

  if (routineIds.length) {
    const exDel = await supabase.from("exercises").delete().in("routine_id", routineIds);
    if (exDel.error) {
      return NextResponse.json({ ok: false, error: exDel.error.message }, { status: 500 });
    }
  }

  const routinesDel = await supabase.from("routines").delete().eq("client_id", id);
  if (routinesDel.error) {
    return NextResponse.json({ ok: false, error: routinesDel.error.message }, { status: 500 });
  }

  const profileDel = await supabase.from("profiles").delete().eq("id", id);
  if (profileDel.error) {
    return NextResponse.json({ ok: false, error: profileDel.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: id });
}
