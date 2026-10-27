import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetId =
    session.role === "coach" && body?.client_id ? String(body.client_id) : session.id;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("push_queue").insert({
    target: "client",
    client_id: targetId,
    title: "Nocito Coach",
    body: body?.message || "Prueba de notificación push. Si ves esto, todo funciona.",
    url: "/app",
    tag: `test-${targetId}-${Date.now()}`,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  fetch(new URL("/api/app/push/flush", req.url), {
    method: "POST",
    headers: { cookie: req.headers.get("cookie") || "" },
  }).catch(() => {});

  return NextResponse.json({ ok: true, clientId: targetId });
}
