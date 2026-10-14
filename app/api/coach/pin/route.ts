import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach, hashPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = String(body?.client_id ?? "");
  const pin = String(body?.pin ?? "").trim();

  if (!clientId || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { ok: false, error: "client_id y PIN de 4 dígitos requeridos" },
      { status: 400 }
    );
  }

  const { error } = await getSupabaseAdmin()
    .from("profiles")
    .update({ pin_hash: hashPin(pin) })
    .eq("id", clientId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
