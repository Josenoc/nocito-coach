import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { hashPin, setSessionCookie, type Role } from "@/lib/auth";
import { isDeliverableEmail } from "@/app/lib/alumnos";
import { generateOnboardingDraft } from "@/app/lib/onboarding";
import { sendCoachPendingReviewEmail } from "@/app/lib/notify";
import { sendCoachPush } from "@/app/lib/push";
import type { Anamnesis } from "@/lib/app-types";

export const dynamic = "force-dynamic";

const SEXOS = ["Masculino", "Femenino", "Otro"];
const OBJETIVOS = ["hipertrofia", "perdida-grasa", "fuerza", "recomposicion", "rendimiento-deportivo"];
const DIAS_VALIDOS = [3, 4, 5, 6];
const NUTRICION = ["omnivoro", "vegetariano", "carnivoro", "vegano"];
const LUGARES = ["gimnasio", "casa", "aire-libre"];
const EXPERIENCIAS = ["principiante", "intermedio", "avanzado"];
const ACTIVIDADES = ["sedentario", "ligero", "moderado", "alto", "muy-alto"];
const SUENO = ["mala", "regular", "buena", "excelente"];

function cleanNote(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

function cleanShort(value: unknown, max = 80): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function clampInt(value: unknown, min: number, max: number): number | null {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === "";
}

/** Devuelve undefined si el campo viene vacío, "invalid" si está fuera de rango. */
function optionalInt(value: unknown, min: number, max: number): number | undefined | "invalid" {
  if (isBlank(value)) return undefined;
  const n = clampInt(value, min, max);
  return n === null ? "invalid" : n;
}

function optionalDecimal(value: unknown, min: number, max: number): number | undefined | "invalid" {
  if (isBlank(value)) return undefined;
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) return "invalid";
  return Math.round(n * 10) / 10;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = String(body?.email ?? "").trim().toLowerCase();
    const username = String(body?.username ?? "").trim().toLowerCase();
    const full_name = String(body?.full_name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const sex = String(body?.sex ?? "");
    const age = clampInt(body?.age, 10, 100);
    const height_cm = clampInt(body?.height_cm, 100, 250);
    const weight_kg = Number(body?.weight_kg);
    const body_fat_pct = optionalDecimal(body?.body_fat_pct, 3, 60);
    const goal = String(body?.goal ?? "");
    const training_days = clampInt(body?.training_days, 3, 5);
    const nutrition = String(body?.nutrition ?? "");
    const training_place = String(body?.training_place ?? "");
    const experience = String(body?.experience ?? "");
    const training_years = optionalInt(body?.training_years, 0, 60);
    const activity_level = String(body?.activity_level ?? "");
    const sleep_quality = String(body?.sleep_quality ?? "");
    const injuries = cleanNote(body?.injuries);
    const food_restrictions = cleanNote(body?.food_restrictions);
    const allergies = cleanNote(body?.allergies);
    const foods_love = cleanNote(body?.foods_love);
    const foods_avoid = cleanNote(body?.foods_avoid);
    const motivation = cleanNote(body?.motivation);
    const supplements = cleanNote(body?.supplements);
    const session_length = cleanShort(body?.session_length);
    const cook_time = cleanShort(body?.cook_time);
    const meal_prep = cleanShort(body?.meal_prep);
    const budget = cleanShort(body?.budget);
    const alcohol = cleanShort(body?.alcohol);
    const meals_per_day = clampInt(body?.meals_per_day, 2, 8);
    const stress_level = clampInt(body?.stress_level, 1, 10);
    const sleep_hours = clampInt(body?.sleep_hours, 3, 12);
    const pin = String(body?.pin ?? "").trim();
    const pin_confirm = String(body?.pin_confirm ?? "").trim();

    if (!isDeliverableEmail(email)) return bad("Ingresá un email válido.");
    if (!/^[a-z0-9_]{3,20}$/.test(username))
      return bad("El usuario debe tener 3 a 20 caracteres (letras, números o guión bajo).");
    if (!full_name) return bad("Ingresá tu nombre completo.");
    if (phone.replace(/\D/g, "").length < 6) return bad("Ingresá un teléfono/WhatsApp válido.");
    if (!SEXOS.includes(sex)) return bad("Elegí tu sexo.");
    if (age === null) return bad("Edad inválida (10 a 100 años).");
    if (height_cm === null) return bad("Altura inválida (100 a 250 cm).");
    if (!Number.isFinite(weight_kg) || weight_kg < 30 || weight_kg > 300)
      return bad("Peso inválido (30 a 300 kg).");
    if (!OBJETIVOS.includes(goal)) return bad("Elegí tu objetivo.");
    if (training_days === null || !DIAS_VALIDOS.includes(training_days))
      return bad("Elegí 3, 4 o 5 días de entrenamiento.");
    if (!NUTRICION.includes(nutrition)) return bad("Elegí tu preferencia alimentaria.");
    if (!LUGARES.includes(training_place))
      return bad("Elegí dónde vas a entrenar.");
    if (!EXPERIENCIAS.includes(experience))
      return bad("Elegí tu nivel de experiencia.");
    if (body_fat_pct === "invalid")
      return bad("El % de grasa corporal debe estar entre 3 y 60.");
    if (training_years === "invalid")
      return bad("Los años de entrenamiento deben estar entre 0 y 60.");
    if (activity_level && !ACTIVIDADES.includes(activity_level))
      return bad("Elegí tu nivel de actividad diaria.");
    if (sleep_quality && !SUENO.includes(sleep_quality))
      return bad("Elegí tu calidad de sueño.");
    if (!/^\d{4}$/.test(pin)) return bad("El PIN debe tener 4 dígitos.");
    if (pin !== pin_confirm) return bad("Los PIN no coinciden.");

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, anamnesis, username")
      .eq("email", email)
      .maybeSingle();

    const yaOnboarded =
      existing &&
      existing.anamnesis &&
      typeof existing.anamnesis === "object" &&
      Object.keys(existing.anamnesis).length > 0;

    if (yaOnboarded) {
      return bad("Ya existe una cuenta con ese email. Iniciá sesión.", 409);
    }

    const { data: usernameTaken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", existing?.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    if (usernameTaken) {
      return bad("Ese nombre de usuario ya está en uso. Elegí otro.", 409);
    }

    const anamnesis: Anamnesis = {
      sex,
      age: age as number,
      height_cm: height_cm as number,
      weight_kg: Math.round(weight_kg * 10) / 10,
      goal,
      training_days: training_days as number,
      nutrition,
      training_place,
      experience,
      injuries,
      food_restrictions,
      photos: {},
      completedAt: new Date().toISOString(),
    };
    if (body_fat_pct !== undefined) {
      anamnesis.body_fat_pct = body_fat_pct;
    }
    if (training_years !== undefined) {
      anamnesis.training_years = training_years;
    }
    if (activity_level) anamnesis.activity_level = activity_level;
    if (sleep_quality) anamnesis.sleep_quality = sleep_quality;
    if (session_length) anamnesis.session_length = session_length;
    if (allergies) anamnesis.allergies = allergies;
    if (foods_love) anamnesis.foods_love = foods_love;
    if (foods_avoid) anamnesis.foods_avoid = foods_avoid;
    if (motivation) anamnesis.motivation = motivation;
    if (supplements) anamnesis.supplements = supplements;
    if (cook_time) anamnesis.cook_time = cook_time;
    if (meal_prep) anamnesis.meal_prep = meal_prep;
    if (budget) anamnesis.budget = budget;
    if (alcohol) anamnesis.alcohol = alcohol;
    if (meals_per_day !== null) anamnesis.meals_per_day = meals_per_day;
    if (stress_level !== null) anamnesis.stress_level = stress_level;
    if (sleep_hours !== null) anamnesis.sleep_hours = sleep_hours;

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          email,
          username,
          role: "client",
          full_name,
          phone,
          pin_hash: hashPin(pin),
          activo: true,
          anamnesis,
          routine_status: "pending_review",
        },
        { onConflict: "email" }
      )
      .select("id, email, username, role, full_name")
      .single();

    if (error || !data) {
      return bad(error?.message || "No se pudo crear el usuario.", 500);
    }

    await generateOnboardingDraft(data.id as string, anamnesis);

    // Aviso al coach: nuevo cliente pendiente de revisión (no bloquea el registro).
    sendCoachPendingReviewEmail({
      name: full_name,
      email,
      phone,
      anamnesis,
    }).catch((err) => console.error("[register] aviso al coach:", err));

    sendCoachPush({
      title: "Nocito Coach",
      body: `${full_name || email} completó su registro y espera revisión`,
      url: "/app/admin",
    }).catch((err) => console.error("[register] push al coach:", err));

    const profile = {
      id: data.id as string,
      email: data.email as string,
      username: (data.username as string) || username,
      role: data.role as Role,
      full_name: (data.full_name as string) || "",
    };
    await setSessionCookie(profile);

    return NextResponse.json({ ok: true, profile, anamnesis });
  } catch {
    return bad("Error interno", 500);
  }
}
