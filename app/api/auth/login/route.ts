import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { verifyPin, setSessionCookie, type Role } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const username = String(body?.username ?? "").trim().toLowerCase();
    const identifier = email || username;
    const pin = String(body?.pin ?? "").trim();

    if (!identifier || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, error: "Ingresá tu usuario/email y un PIN de 4 dígitos." },
        { status: 400 }
      );
    }

    const query = getSupabaseAdmin()
      .from("profiles")
      .select("id, email, username, role, full_name, pin_hash, activo, plan, trial_ends_at")
      .eq("activo", true);

    const { data, error } = await (identifier.includes("@")
      ? query.eq("email", identifier)
      : query.eq("username", identifier)
    ).maybeSingle();

    if (error || !data || !verifyPin(pin, data.pin_hash)) {
      return NextResponse.json(
        { ok: false, error: "Usuario/email o PIN incorrectos." },
        { status: 401 }
      );
    }

    // Trial: bloquear si vencio (solo clientes en plan trial).
    if (
      data.role === "client" &&
      (data.plan ?? "trial") === "trial" &&
      data.trial_ends_at &&
      new Date(data.trial_ends_at as string).getTime() < Date.now()
    ) {
      return NextResponse.json(
        { ok: false, error: "Tu prueba gratuita vencio.", trialExpired: true },
        { status: 403 }
      );
    }

    const profile = {
      id: data.id as string,
      email: data.email as string,
      username: (data.username as string) || "",
      role: data.role as Role,
      full_name: (data.full_name as string) || "",
    };
    await setSessionCookie(profile);

    return NextResponse.json({ ok: true, profile });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
