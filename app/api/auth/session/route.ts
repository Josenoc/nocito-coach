import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getSession();
  if (!profile) {
    return NextResponse.json({ ok: false, profile: null }, { status: 401 });
  }
  return NextResponse.json({ ok: true, profile });
}
