import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanExercises(
  exercises: unknown,
  routineId: string
): Record<string, unknown>[] {
  const list = Array.isArray(exercises) ? exercises : [];
  return list
    .map((raw, idx) => {
      const e = (raw ?? {}) as Record<string, unknown>;
      const name = String(e.name ?? "").trim();
      if (!name) return null;
      return {
        routine_id: routineId,
        name,
        id: typeof e.id === "string" ? e.id : undefined,
        video_url: e.video_url ? String(e.video_url).trim() : null,
        technique_notes: e.technique_notes ? String(e.technique_notes) : null,
        order_index: Number.isFinite(Number(e.order_index))
          ? Number(e.order_index)
          : idx,
        target_sets: numOrNull(e.target_sets),
        target_reps: numOrNull(e.target_reps),
        target_weight: numOrNull(e.target_weight),
        unit: e.unit === "lbs" ? "lbs" : "kg",
        technique_type: ["normal", "superset", "drop_set", "rest_pause"].includes(String(e.technique_type))
          ? String(e.technique_type)
          : "normal",
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
}

export async function POST(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = String(body?.client_id ?? "");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "client_id requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: routine, error } = await supabase
    .from("routines")
    .insert({
      client_id: clientId,
      name: String(body?.name ?? "Rutina").trim() || "Rutina",
      day_name: String(body?.day_name ?? "").trim(),
      week_number: numOrNull(body?.week_number) ?? 1,
      position: numOrNull(body?.position) ?? 0,
      active: body?.active === false ? false : true,
      training_day_of_week: numOrNull(body?.training_day_of_week),
    })
    .select()
    .single();

  if (error || !routine) {
    return NextResponse.json(
      { ok: false, error: error?.message || "No se pudo crear la rutina" },
      { status: 500 }
    );
  }

  const exercises = cleanExercises(body?.exercises, routine.id);
  if (exercises.length) {
    const { error: exErr } = await supabase.from("exercises").insert(exercises);
    if (exErr) {
      return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, routine }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (body?.name !== undefined) patch.name = String(body.name).trim() || "Rutina";
  if (body?.day_name !== undefined) patch.day_name = String(body.day_name).trim();
  if (body?.week_number !== undefined) patch.week_number = numOrNull(body.week_number) ?? 1;
  if (body?.position !== undefined) patch.position = numOrNull(body.position) ?? 0;
  if (body?.active !== undefined) patch.active = Boolean(body.active);
  if (body?.training_day_of_week !== undefined) patch.training_day_of_week = numOrNull(body.training_day_of_week);

  if (Object.keys(patch).length) {
    const { error } = await supabase.from("routines").update(patch).eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  if (Array.isArray(body?.exercises)) {
    const { data: current, error: curErr } = await supabase
      .from("exercises")
      .select("id, name")
      .eq("routine_id", id);
    if (curErr) {
      return NextResponse.json({ ok: false, error: curErr.message }, { status: 500 });
    }
    const existing = new Map<string, string>(
      (current ?? []).map((ex: { id: string; name: string }) => [ex.id, ex.name])
    );
    const rows = cleanExercises(body.exercises, id);
    const keepIds = new Set<string>();

    for (const row of rows) {
      const rowId = typeof row.id === "string" && existing.has(row.id) ? row.id : null;
      if (rowId) {
        keepIds.add(rowId);
        const { id: _omit, routine_id: _r, ...fields } = row;
        const { error: updErr } = await supabase.from("exercises").update(fields).eq("id", rowId);
        if (updErr) {
          return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
        }
      } else {
        const { id: _omit, ...fields } = row;
        const { error: insErr } = await supabase.from("exercises").insert(fields);
        if (insErr) {
          return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
        }
      }
    }

    // Los ejercicios quitados de la rutina se borran, pero sus series quedan:
    // primero se guarda su nombre en cada serie y después se desvinculan.
    const removed = [...existing.keys()].filter((exId) => !keepIds.has(exId));
    for (const exId of removed) {
      await supabase
        .from("sets_logs")
        .update({ exercise_name: existing.get(exId) ?? null })
        .eq("exercise_id", exId)
        .is("exercise_name", null);
    }
    if (removed.length) {
      const { error: delErr } = await supabase.from("exercises").delete().in("id", removed);
      if (delErr) {
        return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ ok: true });
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
  const { error } = await getSupabaseAdmin().from("routines").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
