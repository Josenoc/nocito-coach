import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const form = await req.formData();
    const audio = form.get("audio") as File | null;
    const exerciseId = (form.get("exercise_id") as string) || null;
    const clientId =
      session.role === "coach"
        ? ((form.get("client_id") as string) || null)
        : session.id;

    if (!audio || !clientId) {
      return NextResponse.json(
        { ok: false, error: "audio y cliente requeridos" },
        { status: 400 }
      );
    }

    const ext = (audio.name.split(".").pop() || "webm").toLowerCase();
    const path = `${clientId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await audio.arrayBuffer());

    const supabase = getSupabaseAdmin();
    const { error: upErr } = await supabase.storage
      .from("audios")
      .upload(path, buffer, {
        contentType: audio.type || "audio/webm",
        upsert: false,
      });
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from("audios").getPublicUrl(path);
    const audioUrl = pub.publicUrl;

    const { data: report, error: insErr } = await supabase
      .from("audio_reports")
      .insert({
        client_id: clientId,
        exercise_id: exerciseId,
        audio_storage_url: audioUrl,
      })
      .select()
      .single();

    if (insErr) {
      return NextResponse.json({ ok: true, audio_url: audioUrl, warning: insErr.message });
    }
    return NextResponse.json({ ok: true, audio_url: audioUrl, report });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}
