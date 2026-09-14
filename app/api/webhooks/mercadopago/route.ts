import { NextResponse } from "next/server";
import { getResend, getDestinationEmail, SENDER_EMAIL } from "@/app/lib/resend";
import { generatePayload } from "@/app/lib/routine-gen";
import { renderRoutineHtml, renderRoutineText } from "@/app/lib/routine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = process.env.MP_ACCESS_TOKEN || "";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  const paymentId =
    typeof data.id === "number" || typeof data.id === "string"
      ? data.id
      : body.id ?? null;

  if (body.type && body.type !== "payment") {
    return NextResponse.json({ ok: true, ignored: body.type });
  }
  if (paymentId === null) {
    return NextResponse.json({ ok: true });
  }

  let payment: Record<string, unknown>;
  try {
    const resp = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }
    );
    if (!resp.ok) {
      console.error(`[webhook] MP API status ${resp.status}`);
      return NextResponse.json({ ok: false }, { status: 502 });
    }
    payment = (await resp.json()) as Record<string, unknown>;
  } catch (err) {
    console.error("[webhook] MP API fetch:", err);
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  if (payment.status !== "approved") {
    return NextResponse.json({ ok: true, status: payment.status });
  }

  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  const payload = generatePayload(metadata);
  if (!payload) {
    console.error("[webhook] sin datos del alumno en metadata, pago", paymentId);
    return NextResponse.json(
      { ok: false, error: "sin datos del alumno en metadata" },
      { status: 400 }
    );
  }

  const subject = `PAGO CONFIRMADO - Rutina de ${payload.name}`;

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: SENDER_EMAIL,
      to: getDestinationEmail(),
      subject,
      html: renderRoutineHtml(payload),
      text: renderRoutineText(payload),
    });
    if (result.error) {
      console.error("[webhook] Resend error:", result.error);
      return NextResponse.json({ ok: false }, { status: 502 });
    }
  } catch (err) {
    console.error("[webhook] Resend send:", err);
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}