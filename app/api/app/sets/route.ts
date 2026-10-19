import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { sendCoachActivityEmail } from "@/app/lib/notify";
import { sendCoachPush } from "@/app/lib/push";

export const dynamic = "force-dynamic";

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Vínculo del ejercicio con su rutina (semana / día) para trazabilidad.
type ExerciseOwner = {
  routineId: string;
  weekNumber: number | null;
  dayNumber: number | null;
};

async function loadExerciseOwner(
  clientId: string,
  exerciseId: string
): Promise<ExerciseOwner | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, routines!inner(client_id, id, week_number, position)")
    .eq("id", exerciseId)
    .single();
  if (error || !data) return null;
  const routine = (data as any).routines;
  if (!routine || routine.client_id !== clientId) return null;
  return {
    routineId: String(routine.id),
    weekNumber: typeof routine.week_number === "number" ? routine.week_number : null,
    dayNumber: typeof routine.position === "number" ? routine.position : null,
  };
}

const MISSING_LINK_COL =
  /(routine_id|week_number|day_number|does not exist|PGRST204|42703)/i;

// Guarda la serie. Si la migración que agrega las columnas de vínculo
// (routine_id / week_number / day_number) todavía no se aplicó, reintenta
// sin ellas para no romper el registro del alumno.
async function upsertSetLog(
  row: Record<string, unknown>,
  link: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin();
  const onConflict = "exercise_id,client_id,log_date,set_number";
  let res = await supabase
    .from("sets_logs")
    .upsert({ ...row, ...link }, { onConflict })
    .select()
    .single();
  if (res.error && MISSING_LINK_COL.test(`${res.error.message} ${res.error.code ?? ""}`)) {
    res = await supabase.from("sets_logs").upsert(row, { onConflict }).select().single();
  }
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }
    const url = new URL(req.url);
    const clientId =
      session.role === "coach" ? url.searchParams.get("client_id") : session.id;
    if (!clientId) {
      return NextResponse.json({ ok: false, error: "client_id requerido" }, { status: 400 });
    }

    let query = getSupabaseAdmin()
      .from("sets_logs")
      .select("*")
      .eq("client_id", clientId)
      .order("log_date", { ascending: false })
      .order("set_number", { ascending: true });

    const date = url.searchParams.get("date");
    const exerciseId = url.searchParams.get("exercise_id");
    if (date) query = query.eq("log_date", date);
    if (exerciseId) query = query.eq("exercise_id", exerciseId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, logs: data ?? [] });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const exerciseId = String(body?.exercise_id ?? "");
    const setNumber = toNum(body?.set_number);
    const clientId =
      session.role === "coach" && body?.client_id ? String(body.client_id) : session.id;

    if (!exerciseId || setNumber === null || setNumber < 1) {
      return NextResponse.json(
        { ok: false, error: "exercise_id y set_number requeridos" },
        { status: 400 }
      );
    }

    const owner = await loadExerciseOwner(clientId, exerciseId);
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: "Ejercicio no pertenece al cliente" },
        { status: 403 }
      );
    }

    const logDate =
      typeof body?.log_date === "string" && body.log_date
        ? body.log_date
        : new Date().toISOString().slice(0, 10);

    const supabase = getSupabaseAdmin();

    let firstOfDay = false;
    if (session.role === "client") {
      const { count } = await supabase
        .from("sets_logs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("log_date", logDate);
      firstOfDay = !count;
    }

    const row = {
      exercise_id: exerciseId,
      client_id: clientId,
      set_number: Math.round(setNumber),
      target_reps: toNum(body?.target_reps),
      target_weight: toNum(body?.target_weight),
      actual_reps: toNum(body?.actual_reps),
      actual_weight: toNum(body?.actual_weight),
      phantom_reference_10_percent: toNum(body?.phantom_reference_10_percent),
      log_date: logDate,
    };

    const link = {
      routine_id: owner.routineId,
      week_number: owner.weekNumber,
      day_number: owner.dayNumber,
    };

    const { data, error } = await upsertSetLog(row, link);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rirVal = toNum(body?.rir);
    if (session.role === "client" && rirVal !== null) {
      const rirKey = `${exerciseId}|${logDate}|${Math.round(setNumber)}`;
      const { data: profRow } = await supabase
        .from("profiles")
        .select("anamnesis")
        .eq("id", clientId)
        .single();
      const anam = ((profRow?.anamnesis ?? {}) as Record<string, unknown>) || {};
      const setRir = { ...((anam.setRir as Record<string, number>) ?? {}) };
      if (rirVal <= 0) delete setRir[rirKey];
      else setRir[rirKey] = rirVal;
      await supabase
        .from("profiles")
        .update({ anamnesis: { ...anam, setRir } })
        .eq("id", clientId);
    }

    if (firstOfDay) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", clientId)
        .maybeSingle();
      sendCoachActivityEmail({
        kind: "workout",
        name: profile?.full_name || "",
        email: profile?.email || "",
        detail: `Fecha: ${logDate}`,
      }).catch((err) => console.error("notify workout", err));

      sendCoachPush({
        title: "Nocito Coach",
        body: `${profile?.full_name || profile?.email || "Tu alumno"} registró su sesión`,
        url: "/app/admin",
      }).catch((err) => console.error("push workout", err));
    }

    return NextResponse.json({ ok: true, log: data }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
