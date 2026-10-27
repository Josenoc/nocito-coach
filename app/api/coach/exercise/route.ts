import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const exerciseId = String(body?.exercise_id ?? "");
  if (!exerciseId) {
    return NextResponse.json(
      { ok: false, error: "exercise_id requerido" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: existing, error: findErr } = await supabase
    .from("exercises")
    .select("id")
    .eq("id", exerciseId)
    .maybeSingle();
  if (findErr || !existing) {
    return NextResponse.json(
      { ok: false, error: "Ejercicio no encontrado" },
      { status: 404 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (body.target_sets !== undefined) {
    const v = numOrNull(body.target_sets);
    if (v !== null && (v < 1 || v > 12)) {
      return NextResponse.json(
        { ok: false, error: "target_sets debe estar entre 1 y 12" },
        { status: 400 }
      );
    }
    patch.target_sets = v;
  }
  if (body.target_reps !== undefined) patch.target_reps = numOrNull(body.target_reps);
  if (body.target_weight !== undefined)
    patch.target_weight = numOrNull(body.target_weight);
  if (body.unit === "kg" || body.unit === "lbs") patch.unit = body.unit;
  if (typeof body.name === "string" && body.name.trim())
    patch.name = body.name.trim();
  if (typeof body.video_url === "string")
    patch.video_url = body.video_url.trim() || null;
  if (typeof body.technique_notes === "string")
    patch.technique_notes = body.technique_notes.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("exercises")
    .update(patch)
    .eq("id", exerciseId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}