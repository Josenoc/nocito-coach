import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
  const { data: prof, error: readErr } = await supabase
    .from("profiles")
    .select("anamnesis")
    .eq("id", clientId)
    .single();
  if (readErr || !prof) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  const anam = ((prof.anamnesis ?? {}) as Record<string, unknown>) || {};
  const guideline = typeof body?.guideline === "string" ? body.guideline : "";
  const weeksRaw = Number(body?.weeks);
  const weeks = Number.isFinite(weeksRaw) && weeksRaw > 0 ? Math.round(weeksRaw) : undefined;

  const trainingBlock = {
    ...((anam.trainingBlock as Record<string, unknown>) ?? {}),
    guideline,
    ...(weeks ? { weeks } : {}),
  };

  const { error } = await supabase
    .from("profiles")
    .update({ anamnesis: { ...anam, trainingBlock } })
    .eq("id", clientId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, trainingBlock });
}
