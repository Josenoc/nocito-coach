import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const exerciseId = String(body?.exercise_id ?? "");
  const sets = Number(body?.target_sets);
  if (!exerciseId || !Number.isInteger(sets) || sets < 1 || sets > 12) {
    return NextResponse.json(
      { ok: false, error: "exercise_id y target_sets (1 a 12) requeridos" },
      { status: 400 }
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .from("exercises")
    .update({ target_sets: sets })
    .eq("id", exerciseId)
    .select("id, target_sets")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Ejercicio no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, target_sets: data.target_sets });
}
