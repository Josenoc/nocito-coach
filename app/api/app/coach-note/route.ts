import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { sendCoachActivityEmail } from "@/app/lib/notify";

export const dynamic = "force-dynamic";

const BUCKET = "audio-reports";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Nota de voz libre del alumno hacia el coach (no ligada a un ejercicio).
 * Sube el audio a Supabase Storage e inserta el registro en `audio_reports`.
 * Si el almacenamiento no está disponible, devuelve error para que el cliente
 * ofrezca el fallback por WhatsApp.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "client") {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const form = await req.formData().catch(() => null);
    const audio = form?.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ ok: false, error: "Audio requerido" }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "La nota es demasiado larga (máx. 8 MB)." },
        { status: 413 }
      );
    }

    const supabase = getSupabaseAdmin();
    const clientId = session.id;

    // Asegura el bucket (idempotente).
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some((b) => b.name === BUCKET)) {
        await supabase.storage.createBucket(BUCKET, { public: false });
      }
    } catch {
      /* seguimos e intentamos subir de todos modos */
    }

    const ext = (audio.type || "audio/webm").includes("mp4") ? "m4a" : "webm";
    const path = `${clientId}/${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await audio.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: audio.type || "audio/webm",
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: upErr.message || "No se pudo subir la nota." },
        { status: 500 }
      );
    }

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 30);

    const url = signed?.signedUrl ?? `storage://${BUCKET}/${path}`;

    const { error: insErr } = await supabase.from("audio_reports").insert({
      client_id: clientId,
      exercise_id: null,
      audio_storage_url: url,
    });

    if (insErr) {
      return NextResponse.json(
        { ok: false, error: insErr.message || "No se pudo registrar la nota." },
        { status: 500 }
      );
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", clientId)
      .maybeSingle();

    await sendCoachActivityEmail({
      kind: "voice",
      name: prof?.full_name || "",
      email: prof?.email || "",
      detail: "Nota de voz libre enviada desde el resumen de sesión.",
    }).catch(() => {});

    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
