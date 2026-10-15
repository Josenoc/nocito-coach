import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { hashPin, setSessionCookie, type Role } from "@/lib/auth";
import { buildOnboardingPlan } from "@/app/lib/onboarding";
import type { Anamnesis } from "@/lib/app-types";

export const dynamic = "force-dynamic";

// Solo desarrollo/testing: oculto en producción salvo que se habilite explícitamente.
const ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_TEST_LOGIN === "true";

const MOCK = {
  email: "alumno.test@nocito.local",
  username: "alumnotest",
  full_name: "Alumno Test",
  phone: "3410000000",
  pin: "0000",
};

const ANAMNESIS: Anamnesis = {
  sex: "Masculino",
  age: 30,
  height_cm: 178,
  weight_kg: 80,
  goal: "hipertrofia",
  training_days: 4,
  nutrition: "omnivoro",
  completedAt: new Date().toISOString(),
};

function num(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? "").match(/\d+/)?.[0]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function POST() {
  if (!ENABLED) {
    return NextResponse.json(
      { ok: false, error: "No disponible en producción." },
      { status: 404 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { routine, nutrition } = buildOnboardingPlan(ANAMNESIS);

    const { data: prof, error } = await supabase
      .from("profiles")
      .upsert(
        {
          email: MOCK.email,
          username: MOCK.username,
          role: "client",
          full_name: MOCK.full_name,
          phone: MOCK.phone,
          pin_hash: hashPin(MOCK.pin),
          activo: true,
          anamnesis: ANAMNESIS,
          routine_status: "active",
          nutrition_plan: nutrition,
          approved_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select("id, email, username, role, full_name")
      .single();

    if (error || !prof) {
      return NextResponse.json(
        { ok: false, error: error?.message || "No se pudo crear el usuario de prueba." },
        { status: 500 }
      );
    }

    const clientId = String(prof.id);

    const { count } = await supabase
      .from("routines")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);

    if (!count) {
      for (let d = 0; d < routine.days.length; d++) {
        const day = routine.days[d];
        const { data: row } = await supabase
          .from("routines")
          .insert({
            client_id: clientId,
            name: day.name,
            day_name: day.name,
            week_number: 1,
            position: d,
            active: true,
          })
          .select("id")
          .single();
        if (!row) continue;

        const exercises = day.items.map((item, index) => ({
          routine_id: row.id as string,
          name: item[0],
          order_index: index,
          target_sets: num(item[1], 3),
          target_reps: num(item[2], 10),
          target_weight: null,
          unit: "kg",
        }));
        if (exercises.length) await supabase.from("exercises").insert(exercises);
      }
    }

    const profile = {
      id: clientId,
      email: String(prof.email),
      username: String(prof.username || MOCK.username),
      role: prof.role as Role,
      full_name: String(prof.full_name || MOCK.full_name),
    };
    await setSessionCookie(profile);

    return NextResponse.json({ ok: true, profile });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno." }, { status: 500 });
  }
}
