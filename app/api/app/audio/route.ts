import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { sendCoachActivityEmail } from "@/app/lib/notify";
import { sendPushToProfile } from "@/app/lib/push";
import { notifyCoachEvent } from "@/app/lib/push-triggers";
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

    if (session.role === "client") {
      const [profileRes, exRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", clientId)
          .maybeSingle(),
        exerciseId
          ? supabase.from("exercises").select("name").eq("id", exerciseId).maybeSingle()
          : Promise.resolve({ data: null } as { data: any }),
      ]);
      sendCoachActivityEmail({
        kind: "voice",
        name: profileRes?.data?.full_name || "",
        email: profileRes?.data?.email || "",
        detail: (exRes as any)?.data?.name
          ? `Ejercicio: ${(exRes as any).data.name}`
          : "Nota de voz general",
      }).catch((err) => console.error("notify voice", err));

      sendPushToProfile(session.id, { title: "Nota guardada", body: "Tu nota de voz se envió al coach.", url: "/app", tag: `note-${exerciseId || "general"}` }).catch((e) => console.error("push student", e));
      notifyCoachEvent(session.id, "voice", `envió una nota de voz${(exRes as any)?.data?.name ? ` (${(exRes as any).data.name})` : ""}`).catch((e) => console.error("push voice", e));
    }

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
