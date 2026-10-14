import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { verifyPin, setSessionCookie, type Role } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const pin = String(body?.pin ?? "").trim();

    if (!email || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, error: "Ingresá tu email y un PIN de 4 dígitos." },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from("profiles")
      .select("id, email, role, full_name, pin_hash, activo")
      .eq("email", email)
      .eq("activo", true)
      .single();

    if (error || !data || !verifyPin(pin, data.pin_hash)) {
      return NextResponse.json(
        { ok: false, error: "Email o PIN incorrectos." },
        { status: 401 }
      );
    }

    const profile = {
      id: data.id as string,
      email: data.email as string,
      role: data.role as Role,
      full_name: (data.full_name as string) || "",
    };
    await setSessionCookie(profile);

    return NextResponse.json({ ok: true, profile });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
