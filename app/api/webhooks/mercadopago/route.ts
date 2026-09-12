import { NextResponse } from "next/server";
import { resend, DESTINATION_EMAIL, SENDER_EMAIL } from "@/app/lib/resend";
import { getRoutine, confirmPlan } from "@/app/lib/store";
import { parsePayload, renderRoutineHtml, renderRoutineText } from "@/app/lib/routine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = process.env.MP_ACCESS_TOKEN ?? "";

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

  const data = (body?.data as Record<string, unknown>) ?? body;
  const paymentId = (data?.id as number | string) ?? (body.id as number | string);

  if (body.type && body.type !== "payment") {
    return NextResponse.json({ ok: true });
  }
  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

  let payment: Record<string, unknown>;
  try {
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!resp.ok) {
      console.error("MP payment lookup failed:", resp.status, await resp.text());
      return NextResponse.json({ ok: false }, { status: 502 });
    }
    payment = (await resp.json()) as Record<string, unknown>;
  } catch (err) {
    console.error("MP payment lookup error:", err);
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  if (payment.status !== "approved" && payment.status !== "authorized") {
    return NextResponse.json({ ok: true, ignored: payment.status });
  }

  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  const ref =
    (typeof payment.external_reference === "string" && payment.external_reference !== "direct"
      ? payment.external_reference
      : "") ||
    (typeof metadata.client_ref === "string" ? metadata.client_ref : "");

  if (!ref) {
    return NextResponse.json({ ok: false, error: "sin referencia" }, { status: 400 });
  }

  const raw = getRoutine(ref);
  const payload = parsePayload(raw);
  if (!payload) {
    console.error("Routine no encontrada para ref:", ref);
    return NextResponse.json({ ok: false, error: "rutina no encontrada; reintentar" }, { status: 500 });
  }

  const planName =
    (typeof metadata.plan_name === "string" && metadata.plan_name) ||
    (typeof raw?.plan === "object" && raw.plan ? (raw.plan as { name?: string }).name : "");
  if (planName) {
    payload.plan = { name: planName, confirmed: true };
  }

  const subject = `NUEVA RUTINA PARA ENVIAR - Cliente: ${payload.name}`;
  const html = renderRoutineHtml(payload);
  const text = renderRoutineText(payload);

  try {
    const result = await resend.emails.send({
      from: SENDER_EMAIL,
      to: DESTINATION_EMAIL,
      subject,
      html,
      text,
    });
    if (result.error) {
      console.error("Resend error:", result.error);
      return NextResponse.json({ ok: false }, { status: 502 });
    }
  } catch (err) {
    console.error("Resend send error:", err);
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  if (ref) confirmPlan(ref);
  return NextResponse.json({ ok: true });
}