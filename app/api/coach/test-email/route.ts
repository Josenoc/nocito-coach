import { NextResponse } from "next/server";
import { getCoach } from "@/lib/auth";
import { sendCoachActivityEmail } from "@/app/lib/notify";
import { getDestinationEmail, SENDER_EMAIL } from "@/app/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const result = await sendCoachActivityEmail({
    kind: "profile",
    name: "Prueba Nocito",
    email: coach.email || "test@nocito.local",
    detail: "Mensaje de prueba de configuracion de email",
  });

  return NextResponse.json({
    ok: result.ok,
    to: result.to,
    error: result.error,
    config: {
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
      resendKeyPrefix: (process.env.RESEND_API_KEY ?? "").slice(0, 3),
      destination: getDestinationEmail(),
      sender: SENDER_EMAIL,
    },
  });
}
