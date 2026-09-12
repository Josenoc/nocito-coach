import { NextResponse } from "next/server";
import { saveRoutine } from "@/app/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json inválido" }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Falta el nombre del cliente." },
      { status: 400 }
    );
  }

  try {
    const ref = await saveRoutine(o);
    return NextResponse.json({ ok: true, ref });
  } catch (err) {
    console.error("[save-routine]", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "No se pudo guardar tu plan. Verificá que DATABASE_URL esté configurada en Vercel y que la base exista.",
      },
      { status: 500 }
    );
  }
}