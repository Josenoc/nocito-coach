import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";
import { generateOnboardingDraft } from "@/app/lib/onboarding";
import type { Anamnesis } from "@/lib/app-types";

export const dynamic = "force-dynamic";

const PROFILE_FIELDS =
  "id, email, full_name, activo, created_at, phone, anamnesis, routine_status, nutrition_plan, approved_at";

export async function GET(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const [profileRes, routinesRes] = await Promise.all([
    supabase.from("profiles").select(PROFILE_FIELDS).eq("id", id).single(),
    supabase
      .from("routines")
      .select("*, exercises(*)")
      .eq("client_id", id)
      .order("week_number", { ascending: false })
      .order("position", { ascending: true }),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  let profile = profileRes.data;
  let routines = routinesRes.data ?? [];

  if (profile.anamnesis && !profile.nutrition_plan && routines.length === 0) {
    try {
      await generateOnboardingDraft(id, profile.anamnesis as Anamnesis);
      const [profileAgain, routinesAgain] = await Promise.all([
        supabase.from("profiles").select(PROFILE_FIELDS).eq("id", id).single(),
        supabase
          .from("routines")
          .select("*, exercises(*)")
          .eq("client_id", id)
          .order("week_number", { ascending: false })
          .order("position", { ascending: true }),
      ]);
      if (profileAgain.data) profile = profileAgain.data;
      routines = routinesAgain.data ?? routines;
    } catch {
      // si falla la generación, seguimos devolviendo lo que haya
    }
  }

  const [logsRes, audioRes] = await Promise.all([
    supabase
      .from("sets_logs")
      .select("*, exercises(name)")
      .eq("client_id", id)
      .order("log_date", { ascending: false })
      .order("set_number", { ascending: true })
      .limit(2000),
    supabase
      .from("audio_reports")
      .select("*, exercises(name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    ok: true,
    profile,
    routines,
    logs: logsRes.data ?? [],
    audio: audioRes.data ?? [],
  });
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

  const supabase = getSupabaseAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }
  if (target.role !== "client") {
    return NextResponse.json(
      { ok: false, error: "Solo se pueden eliminar cuentas de clientes" },
      { status: 400 }
    );
  }

  const { data: routines } = await supabase.from("routines").select("id").eq("client_id", id);
  const routineIds = (routines ?? []).map((r: { id: string }) => r.id);

  const logsDel = await supabase.from("sets_logs").delete().eq("client_id", id);
  if (logsDel.error) {
    return NextResponse.json({ ok: false, error: logsDel.error.message }, { status: 500 });
  }

  const audioDel = await supabase.from("audio_reports").delete().eq("client_id", id);
  if (audioDel.error) {
    return NextResponse.json({ ok: false, error: audioDel.error.message }, { status: 500 });
  }

  if (routineIds.length) {
    const exDel = await supabase.from("exercises").delete().in("routine_id", routineIds);
    if (exDel.error) {
      return NextResponse.json({ ok: false, error: exDel.error.message }, { status: 500 });
    }
  }

  const routinesDel = await supabase.from("routines").delete().eq("client_id", id);
  if (routinesDel.error) {
    return NextResponse.json({ ok: false, error: routinesDel.error.message }, { status: 500 });
  }

  const profileDel = await supabase.from("profiles").delete().eq("id", id);
  if (profileDel.error) {
    return NextResponse.json({ ok: false, error: profileDel.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: id });
}
