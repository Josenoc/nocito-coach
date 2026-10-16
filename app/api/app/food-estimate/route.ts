import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { estimateFoodItems } from "@/app/lib/food";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? "").trim().slice(0, 600);
  if (!text) {
    return NextResponse.json({ ok: false, error: "Escribí qué comiste" }, { status: 400 });
  }
  try {
    const items = await estimateFoodItems(text);
    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No pudimos reconocer ningún alimento. Probá con más detalle." },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error estimando los alimentos" },
      { status: 500 }
    );
  }
}
