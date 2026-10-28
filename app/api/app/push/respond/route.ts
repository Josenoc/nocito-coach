import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind || "general");
  const responseType = String(body?.response_type || "text");
  const content = body?.content ? String(body.content) : null;
  const choice = body?.choice ? String(body.choice) : null;
  const audioUrl = body?.audio_url ? String(body.audio_url) : null;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("push_interactions").insert({
    client_id: session.id,
    kind,
    response_type: responseType,
    content,
    choice,
    audio_url: audioUrl,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
