import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { todayInArgentina } from "@/lib/dates";
import type { Exercise, Routine } from "@/lib/app-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const clientId =
      session.role === "coach" ? url.searchParams.get("client_id") : session.id;
    const date = url.searchParams.get("date") || todayInArgentina();

    if (!clientId) {
      return NextResponse.json(
        { ok: false, error: "client_id requerido" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("routines")
      .select("*, exercises(*)")
      .eq("client_id", clientId)
      .eq("active", true)
      .order("position", { ascending: true });
    if (error) {
      console.error("[app/routine] error leyendo rutinas", {
        clientId,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const routines: Routine[] = (data ?? []).map((r: any) => ({
      ...r,
      exercises: ((r.exercises ?? []) as Exercise[]).sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      ),
    }));

    const exerciseIds = routines.flatMap((r) => (r.exercises ?? []).map((e) => e.id));
    let logs: unknown[] = [];
    if (exerciseIds.length) {
      const { data: logData, error: logError } = await supabase
        .from("sets_logs")
        .select("*")
        .eq("client_id", clientId)
        .in("exercise_id", exerciseIds)
        .order("log_date", { ascending: false })
        .order("set_number", { ascending: true });
      if (logError) {
        console.error("[app/routine] error leyendo sets_logs", {
          clientId,
          code: logError.code,
          message: logError.message,
        });
      }
      logs = logData ?? [];
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("routine_status, nutrition_plan, anamnesis, full_name, phone, email")
      .eq("id", clientId)
      .single();

    const status = prof?.routine_status ?? "active";
    const pending = session.role === "client" && status !== "active";
    const anamnesis = (prof?.anamnesis ?? null) as {
      setRir?: Record<string, number>;
      trainingBlock?: { guideline?: string; weeks?: number } | null;
    } | null;

    return NextResponse.json(
      {
        ok: true,
        date,
        routines: pending ? [] : routines,
        logs: pending ? [] : logs,
        status,
        nutrition: pending ? null : prof?.nutrition_plan ?? null,
        anamnesis: prof?.anamnesis ?? null,
        setRir: pending ? {} : anamnesis?.setRir ?? {},
        trainingBlock: pending ? null : anamnesis?.trainingBlock ?? null,
        client: prof
          ? {
              full_name: prof.full_name ?? "",
              email: prof.email ?? "",
              phone: prof.phone ?? "",
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[app/routine] excepción", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
