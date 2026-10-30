import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";
import { generateProgram, type ProgramInput } from "@/app/lib/program";
import type { Anamnesis } from "@/lib/app-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = String(body?.clientId ?? body?.client_id ?? "");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId requerido" }, { status: 400 });
  }

  // Lectura fresca (sin cache) de los datos actuales del alumno.
  const { data: profile, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("full_name, anamnesis, updated_at")
    .eq("id", clientId)
    .single();

  if (error || !profile) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Cliente no encontrado" },
      { status: 404 }
    );
  }

  const anamnesis = (profile.anamnesis ?? null) as Anamnesis | null;
  if (!anamnesis) {
    return NextResponse.json(
      { ok: false, error: "El cliente todavía no completó su anamnesis." },
      { status: 400 }
    );
  }

  const input: ProgramInput = {
    full_name: String(profile.full_name ?? ""),
    sex: String(anamnesis.sex ?? ""),
    age: Number(anamnesis.age) || 0,
    height_cm: Number(anamnesis.height_cm) || 0,
    weight_kg: Number(anamnesis.weight_kg) || 0,
    goal: String(anamnesis.goal ?? ""),
    experience: anamnesis.experience ? String(anamnesis.experience) : undefined,
    training_days: Number(anamnesis.training_days) || 0,
    training_place: anamnesis.training_place ? String(anamnesis.training_place) : undefined,
    nutrition: String(anamnesis.nutrition ?? ""),
    injuries: anamnesis.injuries ? String(anamnesis.injuries) : undefined,
    food_restrictions: anamnesis.food_restrictions
      ? String(anamnesis.food_restrictions)
      : undefined,
    body_fat_pct: Number(anamnesis.body_fat_pct) || undefined,
    training_years:
      anamnesis.training_years != null ? Number(anamnesis.training_years) : undefined,
    activity_level: anamnesis.activity_level ? String(anamnesis.activity_level) : undefined,
    sleep_quality: anamnesis.sleep_quality ? String(anamnesis.sleep_quality) : undefined,
  };

  try {
    const program = await generateProgram(input);
    if (!program.days.length) {
      return NextResponse.json(
        { ok: false, error: "El modelo no devolvió una rutina válida. Reintentá." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, program }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al generar el plan" },
      { status: 500 }
    );
  }
}
