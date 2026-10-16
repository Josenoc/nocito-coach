import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { normalizeFoodItems } from "@/app/lib/food";
import { sendCoachPush } from "@/app/lib/push";
import type { Anamnesis, FoodItem, FoodLogs } from "@/lib/app-types";

export const dynamic = "force-dynamic";

const MAX_PER_DAY = 150;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function totals(items: FoodItem[]) {
  return items.reduce(
    (a, it) => ({
      cal: a.cal + (it.cal || 0),
      prot: a.prot + (it.prot || 0),
      carbs: a.carbs + (it.carbs || 0),
      fat: a.fat + (it.fat || 0),
    }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 }
  );
}

function resolveClientId(session: { role: string; id: string }, param: string | null): string | null {
  if (session.role === "coach") return param || null;
  return session.id;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const clientId = resolveClientId(session, url.searchParams.get("client_id"));
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "client_id requerido" }, { status: 400 });
  }
  const date = url.searchParams.get("date") || today();

  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("anamnesis")
    .eq("id", clientId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const anamnesis = (data?.anamnesis as Anamnesis) ?? ({} as Anamnesis);
  const items = (anamnesis.foodLogs?.[date] as FoodItem[]) ?? [];
  return NextResponse.json({ ok: true, date, items, totals: totals(items) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = resolveClientId(session, body?.clientId ? String(body.clientId) : null);
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId requerido" }, { status: 400 });
  }

  const date = typeof body?.date === "string" && body.date ? body.date : today();
  const source = body?.source === "voice" ? "voice" : "manual";
  const parsed = normalizeFoodItems(body?.items);
  if (parsed.length === 0) {
    return NextResponse.json({ ok: false, error: "Sin alimentos para agregar" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, anamnesis")
    .eq("id", clientId)
    .maybeSingle();
  const anamnesis = (data?.anamnesis as Anamnesis) ?? ({} as Anamnesis);
  const foodLogs: FoodLogs = anamnesis.foodLogs ?? {};

  const existing = foodLogs[date] ?? [];
  const isFirstToday = existing.length === 0;
  const now = new Date().toISOString();
  const created: FoodItem[] = parsed.map((p) => ({
    ...p,
    id: crypto.randomUUID(),
    source,
    created_at: now,
  }));
  const merged = [...existing, ...created].slice(-MAX_PER_DAY);
  foodLogs[date] = merged;
  anamnesis.foodLogs = foodLogs;

  const { error } = await getSupabaseAdmin()
    .from("profiles")
    .update({ anamnesis })
    .eq("id", clientId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (session.role !== "coach" && isFirstToday) {
    const clientName = (data?.full_name as string) || (data?.email as string) || "Un alumno";
    sendCoachPush({
      title: "Nocito Coach",
      body: `${clientName} registró comidas hoy`,
      url: "/app/admin",
    }).catch((err) => console.error("[food] push al coach:", err));
  }

  return NextResponse.json({ ok: true, date, items: merged, totals: totals(merged) });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const clientId = resolveClientId(session, url.searchParams.get("client_id"));
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "client_id requerido" }, { status: 400 });
  }
  const date = url.searchParams.get("date") || today();
  const id = url.searchParams.get("id") || "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("anamnesis")
    .eq("id", clientId)
    .maybeSingle();
  const anamnesis = (data?.anamnesis as Anamnesis) ?? ({} as Anamnesis);
  const foodLogs: FoodLogs = anamnesis.foodLogs ?? {};
  const items = (foodLogs[date] ?? []).filter((it) => it.id !== id);
  foodLogs[date] = items;
  anamnesis.foodLogs = foodLogs;

  const { error } = await supabase
    .from("profiles")
    .update({ anamnesis })
    .eq("id", clientId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, date, items, totals: totals(items) });
}
