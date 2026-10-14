import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
  const [profileRes, routinesRes, logsRes, audioRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, activo, created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("routines")
      .select("*, exercises(*)")
      .eq("client_id", id)
      .order("week_number", { ascending: false })
      .order("position", { ascending: true }),
    supabase
      .from("sets_logs")
      .select("*, exercises(name)")
      .eq("client_id", id)
      .order("log_date", { ascending: false })
      .order("set_number", { ascending: true })
      .limit(300),
    supabase
      .from("audio_reports")
      .select("*, exercises(name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    profile: profileRes.data,
    routines: routinesRes.data ?? [],
    logs: logsRes.data ?? [],
    audio: audioRes.data ?? [],
  });
}
