import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportExercise = {
  ejercicio?: unknown;
  series?: unknown;
  reps?: unknown;
  descanso?: unknown;
  notas?: unknown;
};

type ImportDay = {
  dia?: unknown;
  nombre?: unknown;
  ejercicios?: ImportExercise[];
};

function lastInt(value: unknown): number | null {
  const match = String(value ?? "").match(/\d+/g);
  if (!match || !match.length) return null;
  return Number(match[match.length - 1]);
}

function techniqueFor(ex: ImportExercise): string | null {
  const parts: string[] = [];
  const reps = ex.reps ? String(ex.reps).trim() : "";
  if (reps && /[^\d]/.test(reps)) parts.push(`Reps ${reps}`);
  const descanso = ex.descanso ? String(ex.descanso).trim() : "";
  if (descanso) parts.push(`Descanso ${descanso}`);
  const notas = ex.notas ? String(ex.notas).trim() : "";
  if (notas) parts.push(notas);
  return parts.length ? parts.join(" · ") : null;
}

function cleanExercises(
  list: ImportExercise[] | undefined,
  routineId: string
): Record<string, unknown>[] {
  return (Array.isArray(list) ? list : [])
    .map((ex, idx) => {
      const name = String(ex?.ejercicio ?? "").trim();
      if (!name) return null;
      return {
        routine_id: routineId,
        name,
        order_index: idx,
        target_sets: Number.isFinite(Number(ex?.series)) ? Number(ex.series) : null,
        target_reps: lastInt(ex?.reps),
        target_weight: null,
        unit: "kg" as const,
        technique_notes: techniqueFor(ex),
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
  const clientId = String(body?.clientId ?? body?.client_id ?? "");
  const days = Array.isArray(body?.days) ? (body.days as ImportDay[]) : [];

  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId requerido" }, { status: 400 });
  }
  if (!days.length) {
    return NextResponse.json({ ok: false, error: "No hay días para importar." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("routines")
    .select("id")
    .eq("client_id", clientId);

  const routineIds = (existing ?? []).map((r: { id: string }) => r.id);
  if (routineIds.length) {
    const { error: delExErr } = await supabase
      .from("exercises")
      .delete()
      .in("routine_id", routineIds);
    if (delExErr) {
      return NextResponse.json({ ok: false, error: delExErr.message }, { status: 500 });
    }
    const { error: delErr } = await supabase
      .from("routines")
      .delete()
      .eq("client_id", clientId);
    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }
  }

  let created = 0;
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const dia = String(day?.dia ?? "").trim() || `Día ${i + 1}`;
    const nombre = String(day?.nombre ?? "").trim() || dia;

    const { data: row, error: rErr } = await supabase
      .from("routines")
      .insert({
        client_id: clientId,
        name: nombre,
        day_name: dia,
        week_number: 1,
        position: i,
        active: true,
      })
      .select("id")
      .single();

    if (rErr || !row) {
      return NextResponse.json(
        { ok: false, error: rErr?.message || "No se pudo crear la rutina" },
        { status: 500 }
      );
    }

    const exercises = cleanExercises(day?.ejercicios, row.id as string);
    if (exercises.length) {
      const { error: exErr } = await supabase.from("exercises").insert(exercises);
      if (exErr) {
        return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
      }
    }
    created++;
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ routine_status: "active", approved_at: new Date().toISOString() })
    .eq("id", clientId);
  if (profErr) {
    return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, days: created });
}
