import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { sendRoutineForPaymentId } from "@/app/lib/process-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = process.env.MP_ACCESS_TOKEN || "";
const KV_KEY = "paidRoutineProcessed";
const WINDOW_HOURS = Number(process.env.MP_WINDOW_HOURS || "24");

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!kvConfigured()) {
    console.log("[cron] Vercel KV no configurado; sin dedup, no proceso nada");
    return NextResponse.json({ ok: true, skipped: "kv-not-configured" });
  }

  const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
  const params = new URLSearchParams({
    status: "approved",
    sort: "date_approved",
    criteria: "desc",
    limit: "50",
  });

  let list;
  try {
    const resp = await fetch(
      `https://api.mercadopago.com/v1/payments/search?${params}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (!resp.ok) {
      console.error("[cron] MP search status", resp.status);
      return NextResponse.json({ ok: false }, { status: 502 });
    }
    list = (await resp.json()) as {
      results?: Array<{ id: number; date_approved: string | null }>;
    };
  } catch (err) {
    console.error("[cron] MP search:", err);
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const results = list.results ?? [];
  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const p of results) {
    if (!p.date_approved) continue;
    if (new Date(p.date_approved) < new Date(since)) continue;

    let dup = false;
    try {
      dup = Boolean(await kv.sismember(KV_KEY, String(p.id)));
    } catch (err) {
      console.error("[cron] KV sismember:", err);
    }
    if (dup) continue;

    const result = await sendRoutineForPaymentId(p.id).catch((err) => ({
      ok: false as const,
      error: String(err?.message ?? err),
    }));

    if (result.ok) {
      if (!result.skipped) {
        try {
          await kv.sadd(KV_KEY, String(p.id));
        } catch (err) {
          console.error("[cron] KV sadd:", err);
        }
      }
      sent++;
    } else {
      failed++;
      console.error("[cron] error pago", p.id, result.error);
    }
    processed++;
  }

  return NextResponse.json({
    ok: true,
    window_from: since,
    processed,
    sent,
    failed,
  });
}