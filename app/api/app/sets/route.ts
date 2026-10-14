import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function ownsExercise(clientId: string, exerciseId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, routines!inner(client_id)")
    .eq("id", exerciseId)
    .single();
  if (error || !data) return false;
  return (data as any).routines?.client_id === clientId;
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

    if (!(await ownsExercise(clientId, exerciseId))) {
      return NextResponse.json(
        { ok: false, error: "Ejercicio no pertenece al cliente" },
        { status: 403 }
      );
    }

    const logDate =
      typeof body?.log_date === "string" && body.log_date
        ? body.log_date
        : new Date().toISOString().slice(0, 10);

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

    const { data, error } = await getSupabaseAdmin()
      .from("sets_logs")
      .upsert(row, { onConflict: "exercise_id,client_id,log_date,set_number" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, log: data }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
