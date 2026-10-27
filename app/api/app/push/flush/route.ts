import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { sendCoachPush, sendPushToProfile } from "@/app/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Procesa la cola de notificaciones pendientes (push_queue).
 * Lo dispara el cliente después de guardar una serie o enviar un audio,
 * de forma asíncrona (fire-and-forget) para no bloquear la respuesta.
 * Requiere sesión válida (alumno o coach).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin() as any;
  const { data: rows, error } = await supabase
    .from("push_queue")
    .select("id, target, client_id, title, body, url, tag")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[flush push] lectura", error.message);
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
      console.error("[flush push] envío", row.id, err);
    }
    await supabase
      .from("push_queue")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return NextResponse.json({ ok: true, processed: rows?.length ?? 0, sent });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
