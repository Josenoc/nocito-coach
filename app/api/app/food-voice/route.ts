import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { estimateFoodItems, transcribeAudio, argentinaHour } from "@/app/lib/food";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const form = await req.formData();
    const audio = form.get("audio") as File | null;
    if (!audio) {
      return NextResponse.json({ ok: false, error: "audio requerido" }, { status: 400 });
    }

    const transcript = await transcribeAudio(audio);
    if (!transcript) {
      return NextResponse.json(
        { ok: false, error: "No se escuchó nada. Probá de nuevo." },
        { status: 200 }
      );
    }

    const items = await estimateFoodItems(transcript, argentinaHour());
    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        transcript,
        items,
        warning: "No pudimos reconocer alimentos en el audio.",
      });
    }
    return NextResponse.json({ ok: true, transcript, items });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error procesando el audio" },
      { status: 500 }
    );
  }
}
