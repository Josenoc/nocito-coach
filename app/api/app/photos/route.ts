import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { sendClientUpdatedEmail } from "@/app/lib/notify";
import { sendCoachPush } from "@/app/lib/push";
import type { Anamnesis, ClientPhotos, PhotoSlot } from "@/lib/app-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "client-photos";
const SLOTS: PhotoSlot[] = ["front", "side", "back"];
const SLOT_LABELS: Record<PhotoSlot, string> = {
  front: "Foto de frente",
  side: "Foto de perfil",
  back: "Foto de espaldas",
};
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const form = await req.formData();
    const slot = String(form.get("slot") ?? "") as PhotoSlot;
    const file = form.get("photo");

    if (!SLOTS.includes(slot)) {
      return NextResponse.json({ ok: false, error: "Ubicación de foto inválida" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: "Falta la imagen" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "El archivo debe ser una imagen" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "La imagen supera los 8 MB" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: current } = await supabase
      .from("profiles")
      .select("email, full_name, anamnesis")
      .eq("id", session.id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${session.id}/${slot}-${Date.now()}.${ext || "jpg"}`;

    const bucket = await supabase.storage.createBucket(BUCKET, { public: true });
    if (bucket.error && !/exist/i.test(bucket.error.message)) {
      console.error("[photos] createBucket:", bucket.error.message);
    }

    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(arrayBuffer), {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = pub.publicUrl;

    const anamnesis: Anamnesis = (current.anamnesis as Anamnesis) ?? ({} as Anamnesis);
    const photos: ClientPhotos = anamnesis.photos ?? {};
    photos[slot] = url;
    anamnesis.photos = photos;
    anamnesis.clientUpdatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("profiles")
      .update({ anamnesis })
      .eq("id", session.id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    sendClientUpdatedEmail({
      name: current.full_name || current.email,
      email: current.email,
      changes: [SLOT_LABELS[slot]],
    }).catch((err) => console.error("[photos] aviso al coach:", err));

    sendCoachPush({
      title: "Nocito Coach",
      body: `${current.full_name || current.email} subió ${SLOT_LABELS[slot].toLowerCase()}`,
      url: "/app/admin",
    }).catch((err) => console.error("[photos] push al coach:", err));

    return NextResponse.json({ ok: true, url, anamnesis });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
