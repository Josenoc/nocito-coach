import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { sendRoutineForPaymentId } from "@/app/lib/process-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KV_KEY = "paidRoutineProcessed";

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

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

  let alreadyProcessed = false;
  if (kvConfigured()) {
    try {
      alreadyProcessed = Boolean(
        await kv.sismember(KV_KEY, String(paymentId))
      );
    } catch (err) {
      console.error("[webhook] KV:", err);
    }
  }
  if (alreadyProcessed) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let result;
  try {
    result = await sendRoutineForPaymentId(String(paymentId));
  } catch (err) {
    console.error("[webhook]", err);
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  if (!result.ok) {
    console.error("[webhook]", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  if (!result.skipped && kvConfigured()) {
    try {
      await kv.sadd(KV_KEY, String(paymentId));
    } catch (err) {
      console.error("[webhook] KV sadd:", err);
    }
  }

  return NextResponse.json({ ok: true });
}