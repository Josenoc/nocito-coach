import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import type { PushSubscriptionJson } from "@/app/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validSub(value: unknown): PushSubscriptionJson | null {
  if (!value || typeof value !== "object") return null;
  const v = value as any;
  if (typeof v.endpoint !== "string" || !v.endpoint) return null;
  if (!v.keys || typeof v.keys.p256dh !== "string" || typeof v.keys.auth !== "string") {
    return null;
  }
  return {
    endpoint: v.endpoint,
    expirationTime: v.expirationTime ?? null,
    keys: { p256dh: v.keys.p256dh, auth: v.keys.auth },
  };
}

async function readSubs(clientId: string) {
  const { data } = await getSupabaseAdmin()
    .from("profiles")
    .select("anamnesis")
    .eq("id", clientId)
    .maybeSingle();
  const anamnesis = ((data?.anamnesis as Record<string, unknown>) ?? {}) as Record<
    string,
    unknown
  >;
  const subs = Array.isArray(anamnesis.pushSubscriptions)
    ? (anamnesis.pushSubscriptions as PushSubscriptionJson[])
    : [];
  return { subs, anamnesis };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sub = validSub(body?.subscription);
  if (!sub) {
    return NextResponse.json({ ok: false, error: "Suscripción inválida" }, { status: 400 });
  }

  const { subs, anamnesis } = await readSubs(session.id);
  const next = subs.filter((s) => s.endpoint !== sub.endpoint);
  next.push(sub);

  const { error } = await getSupabaseAdmin()
    .from("profiles")
    .update({ anamnesis: { ...anamnesis, pushSubscriptions: next } })
    .eq("id", session.id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, devices: next.length });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "client") {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: "endpoint requerido" }, { status: 400 });
  }

  const { subs, anamnesis } = await readSubs(session.id);
  const next = subs.filter((s) => s.endpoint !== endpoint);

  const { error } = await getSupabaseAdmin()
    .from("profiles")
    .update({ anamnesis: { ...anamnesis, pushSubscriptions: next } })
    .eq("id", session.id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, devices: next.length });
}
