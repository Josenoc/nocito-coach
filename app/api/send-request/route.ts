import { NextResponse } from "next/server";
import {
  getResend,
  getDestinationEmail,
  SENDER_EMAIL,
} from "@/app/lib/resend";
import {
  parsePayload,
  renderRoutineHtml,
  renderRoutineText,
} from "@/app/lib/routine";

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
  const payload = parsePayload(o);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "Faltan los datos del diagnóstico para generar el plan." },
      { status: 400 }
    );
  }

  const subject = `SOLICITUD DE PLAN (Pendiente de Pago) - ${payload.name}`;
  const html = renderRoutineHtml(payload);
  const text = renderRoutineText(payload);

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: SENDER_EMAIL,
      to: getDestinationEmail(),
      subject,
      html,
      text,
    });
    if (result.error) {
      const r = result.error as unknown;
      const msg =
        r && typeof r === "object" && "message" in r
          ? String((r as { message: unknown }).message)
          : String(r);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-request]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}