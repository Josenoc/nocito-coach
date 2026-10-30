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
  peso?: unknown;
  rir?: unknown;
  technique_type?: unknown;
  technique?: unknown;
};

type ImportDay = {
  dia?: unknown;
  nombre?: unknown;
  ejercicios?: ImportExercise[];
  training_day_of_week?: unknown;
};

type ImportWeek = {
  week_number?: unknown;
  days?: ImportDay[];
};

function lastInt(value: unknown): number | null {
  const match = String(value ?? "").match(/\d+/g);
  if (!match || !match.length) return null;
  return Number(match[match.length - 1]);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function techniqueFor(ex: ImportExercise): string | null {
  // Mantener corto: solo RIR y (opcional) descanso. Las notas largas van en un
  // bloque global de "Notas Generales", no por ejercicio.
  const parts: string[] = [];
  const rir = asNumber(ex.rir);
  if (rir != null) parts.push(`RIR ${rir}`);
  const descanso = ex.descanso ? String(ex.descanso).trim() : "";
  if (descanso) parts.push(`Descanso ${descanso}`);
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
      const technique = String(ex?.technique_type ?? ex?.technique ?? "normal").trim().toLowerCase();
      const allowed = ["normal", "superset", "drop_set", "rest_pause"];
      const techniqueType = allowed.includes(technique) ? technique : "normal";
      return {
        routine_id: routineId,
        name,
        order_index: idx,
        target_sets: Number.isFinite(Number(ex?.series)) ? Number(ex.series) : null,
        target_reps: lastInt(ex?.reps),
        target_weight: asNumber(ex?.peso),
        unit: "kg" as const,
        technique_notes: techniqueFor(ex),
        technique_type: techniqueType,
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

  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId requerido" }, { status: 400 });
  }

  // Normaliza entrada: bloque multi-semana (`weeks`) o semana única legada (`days`).
  let weeks: { week_number: number; days: ImportDay[] }[] = [];
  if (Array.isArray(body?.weeks) && body.weeks.length) {
    weeks = (body.weeks as ImportWeek[]).map((w, i) => ({
      week_number: Math.max(1, Math.round(Number(w?.week_number) || i + 1)),
      days: Array.isArray(w?.days) ? (w.days as ImportDay[]) : [],
    }));
  } else if (Array.isArray(body?.days) && body.days.length) {
    weeks = [{ week_number: 1, days: body.days as ImportDay[] }];
  }

  const hasAnyExercises = weeks.some((w) =>
    w.days.some((d) => Array.isArray(d?.ejercicios) && d.ejercicios.length > 0)
  );
  if (!weeks.length || !hasAnyExercises) {
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
  for (const week of weeks) {
    for (let i = 0; i < week.days.length; i++) {
      const day = week.days[i];
      const dia = String(day?.dia ?? "").trim() || `Día ${i + 1}`;
      const nombre = String(day?.nombre ?? "").trim() || dia;

      const dowRaw = Number(day?.training_day_of_week);
      const trainingDayOfWeek = Number.isFinite(dowRaw) && dowRaw >= 0 && dowRaw <= 6 ? dowRaw : null;
      const { data: row, error: rErr } = await supabase
        .from("routines")
        .insert({
          client_id: clientId,
          name: nombre,
          day_name: dia,
          week_number: week.week_number,
          position: i,
          active: true,
          training_day_of_week: trainingDayOfWeek,
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
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ routine_status: "active", approved_at: new Date().toISOString() })
    .eq("id", clientId);
  if (profErr) {
    return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, days: created, weeks: weeks.length });
}
