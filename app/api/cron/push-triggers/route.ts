import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { sendCoachPush, sendPushToProfile } from "@/app/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEEP_SENT_DAYS = 7;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin() as any;
  const { data: rows, error } = await supabase
    .from("push_queue")
    .select("id, target, client_id, title, body, url, tag")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    console.error("[cron push] lectura", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const row of (rows ?? []) as any[]) {
    const payload = {
      title: row.title,
      body: row.body,
      url: row.url ?? undefined,
      tag: row.tag ?? undefined,
    };
    try {
      if (row.target === "coach") await sendCoachPush(payload);
      else if (row.client_id) await sendPushToProfile(row.client_id, payload);
      sent += 1;
    } catch (err) {
      console.error("[cron push] envío", row.id, err);
    }
    await supabase
      .from("push_queue")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  const cutoff = new Date(Date.now() - KEEP_SENT_DAYS * 86400_000).toISOString();
  await supabase.from("push_queue").delete().lt("sent_at", cutoff);

  return NextResponse.json({ ok: true, processed: rows?.length ?? 0, sent });
}
