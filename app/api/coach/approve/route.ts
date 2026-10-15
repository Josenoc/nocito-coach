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
  const clientId = String(body?.clientId ?? body?.client_id ?? "");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ routine_status: "active", approved_at: new Date().toISOString() })
    .eq("id", clientId);
  if (profErr) {
    return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
  }

  const { error: routineErr } = await supabase
    .from("routines")
    .update({ active: true })
    .eq("client_id", clientId);
  if (routineErr) {
    return NextResponse.json({ ok: false, error: routineErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
