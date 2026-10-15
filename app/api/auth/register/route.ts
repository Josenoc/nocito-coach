import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { hashPin, setSessionCookie, type Role } from "@/lib/auth";
import { isDeliverableEmail } from "@/app/lib/alumnos";
import { generateOnboardingDraft } from "@/app/lib/onboarding";
import type { Anamnesis } from "@/lib/app-types";

export const dynamic = "force-dynamic";

const SEXOS = ["Masculino", "Femenino", "Otro"];
const OBJETIVOS = ["hipertrofia", "perdida-grasa", "fuerza", "rendimiento-deportivo"];
const DIAS_VALIDOS = [3, 4, 5];
const NUTRICION = ["omnivoro", "vegetariano", "carnivoro", "vegano"];

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function clampInt(value: unknown, min: number, max: number): number | null {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = String(body?.email ?? "").trim().toLowerCase();
    const full_name = String(body?.full_name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const sex = String(body?.sex ?? "");
    const age = clampInt(body?.age, 10, 100);
    const height_cm = clampInt(body?.height_cm, 100, 250);
    const weight_kg = Number(body?.weight_kg);
    const goal = String(body?.goal ?? "");
    const training_days = clampInt(body?.training_days, 3, 5);
    const nutrition = String(body?.nutrition ?? "");
    const pin = String(body?.pin ?? "").trim();
    const pin_confirm = String(body?.pin_confirm ?? "").trim();

    if (!isDeliverableEmail(email)) return bad("Ingresá un email válido.");
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
    if (!/^\d{4}$/.test(pin)) return bad("El PIN debe tener 4 dígitos.");
    if (pin !== pin_confirm) return bad("Los PIN no coinciden.");

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, anamnesis")
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

    const anamnesis: Anamnesis = {
      sex,
      age: age as number,
      height_cm: height_cm as number,
      weight_kg: Math.round(weight_kg * 10) / 10,
      goal,
      training_days: training_days as number,
      nutrition,
      completedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          email,
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
      .select("id, email, role, full_name")
      .single();

    if (error || !data) {
      return bad(error?.message || "No se pudo crear el usuario.", 500);
    }

    await generateOnboardingDraft(data.id as string, anamnesis);

    const profile = {
      id: data.id as string,
      email: data.email as string,
      role: data.role as Role,
      full_name: (data.full_name as string) || "",
    };
    await setSessionCookie(profile);

    return NextResponse.json({ ok: true, profile, anamnesis });
  } catch {
    return bad("Error interno", 500);
  }
}
