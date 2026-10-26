import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { todayInArgentina, isValidISODate } from "@/lib/dates";
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
  exerciseName: string;
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
    .select("id, name, routines!inner(client_id, id, week_number, position)")
    .eq("id", exerciseId)
    .single();
  if (error || !data) return null;
  const routine = (data as any).routines;
  if (!routine || routine.client_id !== clientId) return null;
  return {
    routineId: String(routine.id),
    exerciseName: String((data as any).name ?? ""),
    weekNumber: typeof routine.week_number === "number" ? routine.week_number : null,
    dayNumber: typeof routine.position === "number" ? routine.position : null,
  };
}

const MISSING_LINK_COL =
  /(routine_id|week_number|day_number|does not exist|PGRST204|42703)/i;

// Guarda la serie. Es defensivo a propósito, porque el entorno de producción
// puede estar en un estado intermedio de migraciones:
//  a) si todavía no existen routine_id / week_number / day_number, reintenta
//     sin esas columnas (la serie nunca se pierde);
//  b) si falta la restricción única (exercise_id, client_id, log_date,
//     set_number), Postgres responde 42P10 y el upsert falla siempre; en ese
//     caso hacemos update-or-insert manual.
async function upsertSetLog(
  row: Record<string, unknown>,
  link: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin() as any;
  const onConflict = "exercise_id,client_id,log_date,set_number";
  let current: Record<string, unknown> = { ...row, ...link };

  let res = await supabase
    .from("sets_logs")
    .upsert(current, { onConflict })
    .select()
    .single();

  if (res.error && MISSING_LINK_COL.test(`${res.error.message} ${res.error.code ?? ""}`)) {
    console.warn("[sets] columnas de vínculo ausentes; guardando sin routine_id/week/day", {
      code: res.error.code,
      message: res.error.message,
    });
    current = { ...row };
    res = await supabase
      .from("sets_logs")
      .upsert(current, { onConflict })
      .select()
      .single();
  }

  if (
    res.error &&
    /42P10|no unique|on conflict/i.test(`${res.error.message} ${res.error.code ?? ""}`)
  ) {
    console.warn("[sets] falta la restricción única; usando update/insert manual", {
      code: res.error.code,
      message: res.error.message,
    });
    const match = {
      exercise_id: row.exercise_id,
      client_id: row.client_id,
      log_date: row.log_date,
      set_number: row.set_number,
    };
    const upd = await supabase
      .from("sets_logs")
      .update(current)
      .match(match)
      .select();
    if (!upd.error && Array.isArray(upd.data) && upd.data.length) {
      return { data: upd.data[0], error: null };
    }
    const ins = await supabase.from("sets_logs").insert(current).select().single();
    if (!ins.error) return ins;
    if (String(ins.error.code) === "23505") {
      const upd2 = await supabase
        .from("sets_logs")
        .update(current)
        .match(match)
        .select()
        .single();
      if (!upd2.error) return upd2;
    }
    return ins;
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
      console.error("[sets] GET error", { clientId, code: error.code, message: error.message });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { ok: true, logs: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[sets] GET excepción", err);
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

    if (!exerciseId || setNumber === null || setNumber < 0) {
      return NextResponse.json(
        { ok: false, error: "exercise_id y set_number requeridos" },
        { status: 400 }
      );
    }

    const owner = await loadExerciseOwner(clientId, exerciseId);
    if (!owner) {
      console.error("[sets] ejercicio no pertenece al cliente", {
        clientId,
        exerciseId,
        role: session.role,
      });
      return NextResponse.json(
        {
          ok: false,
          code: "EXERCISE_NOT_OWNED",
          error: "Ejercicio no pertenece al cliente. Recargá la app para actualizar tu rutina.",
        },
        { status: 403 }
      );
    }

    const logDate = isValidISODate(body?.log_date) ? body.log_date : todayInArgentina();

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
      exercise_name: owner.exerciseName,
    };

    const { data, error } = await upsertSetLog(row, link);

    if (error) {
      const rlsBlocked =
        String(error.code) === "42501" ||
        /row-level security|permission denied|PGRST301/i.test(
          `${error.message} ${error.details ?? ""}`
        );
      console.error("[sets] POST upsert error", {
        clientId,
        exerciseId,
        setNumber,
        logDate,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        rlsBlocked,
      });
      return NextResponse.json(
        {
          ok: false,
          code: rlsBlocked ? "RLS_BLOCKED" : "SAVE_FAILED",
          error: rlsBlocked
            ? "La base rechazó el guardado por permisos (RLS). El administrador debe revisar SUPABASE_SERVICE_ROLE_KEY."
            : `No se pudo guardar la serie: ${error.message}`,
        },
        { status: 500 }
      );
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
  } catch (err) {
    console.error("[sets] POST excepción", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
