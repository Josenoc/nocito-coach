import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, profile: null }, { status: 401 });
  }

  // Trial: bloquear si vencio (solo clientes en plan trial).
  if (session.role === "client") {
    try {
      const { data } = await getSupabaseAdmin()
        .from("profiles")
        .select("plan, trial_ends_at")
        .eq("id", session.id)
        .maybeSingle();
      if (
        data &&
        (data.plan ?? "trial") === "trial" &&
        data.trial_ends_at &&
        new Date(data.trial_ends_at as string).getTime() < Date.now()
      ) {
        return NextResponse.json(
          { ok: false, profile: null, trialExpired: true },
          { status: 403 }
        );
      }
    } catch {
      /* no bloquear por error de lectura */
    }
  }

  return NextResponse.json({ ok: true, profile: session });
}