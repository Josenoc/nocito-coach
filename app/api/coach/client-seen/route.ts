import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";
import type { Anamnesis } from "@/lib/app-types";

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
  const { data: current } = await supabase
    .from("profiles")
    .select("anamnesis")
    .eq("id", clientId)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  const anamnesis: Anamnesis = (current.anamnesis as Anamnesis) ?? ({} as Anamnesis);
  anamnesis.coachSeenAt = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({ anamnesis })
    .eq("id", clientId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
