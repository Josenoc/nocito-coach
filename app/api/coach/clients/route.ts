import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach, hashPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("id, email, full_name, activo, created_at, pin_hash, routine_status")
    .eq("role", "client")
    .order("full_name", { ascending: true });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const clients = (data ?? []).map((c: any) => ({
    id: c.id,
    email: c.email,
    full_name: c.full_name,
    activo: c.activo,
    created_at: c.created_at,
    has_pin: Boolean(c.pin_hash),
    routine_status: c.routine_status ?? "active",
  }));
  return NextResponse.json({ ok: true, clients });
}

export async function POST(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const fullName = String(body?.full_name ?? "").trim();
  const pin = String(body?.pin ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Email inválido" }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: "El PIN debe tener 4 dígitos" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .insert({
      email,
      role: "client",
      full_name: fullName || email,
      pin_hash: hashPin(pin),
      activo: true,
    })
    .select("id, email, full_name, activo, created_at")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Ese email ya existe" : error.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 409 });
  }
  return NextResponse.json({ ok: true, client: { ...data, has_pin: true } }, { status: 201 });
}
